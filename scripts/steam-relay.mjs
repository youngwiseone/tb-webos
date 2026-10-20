// Optional PC-side bridge. Never package this script or an API key inside the TV app.
import http from 'node:http';
import {timingSafeEqual} from 'node:crypto';
import {pathToFileURL} from 'node:url';

const STATES = ['Offline', 'Online', 'Busy', 'Away', 'Snooze', 'Looking to trade', 'Looking to play'];
export async function readSteam (key, steamId, fetcher = fetch) {
  const request = async (method, version, params) => {
    const url = new URL(`https://api.steampowered.com/ISteamUser/${method}/${version}/`);
    url.search = new URLSearchParams({key, ...params}).toString();
    let result;
    try { result = await fetcher(url, {signal: AbortSignal.timeout(6000)}); }
    catch { throw new Error('Steam is unreachable.'); }
    if (!result.ok) throw new Error(result.status === 401 || result.status === 403 ? 'Steam denied access. Check your API key and friends-list privacy.' : 'Steam is temporarily unavailable.');
    return result.json();
  };
  const list = await request('GetFriendList', 'v1', {steamid: steamId, relationship: 'friend'});
  if (!Array.isArray(list.friendslist?.friends)) throw new Error('Steam did not return a readable friends list.');
  const ids = [...new Set([steamId, ...list.friendslist.friends.map(f => f.steamid).filter(id => /^\d{17}$/.test(id))])];
  const players = [];
  // Steam accepts at most 100 IDs per summaries request. Keep the TV endpoint bounded.
  for (let i = 0; i < ids.length; i += 100) {
    const data = await request('GetPlayerSummaries', 'v2', {steamids: ids.slice(i, i + 100).join(',')});
    if (!Array.isArray(data.response?.players)) throw new Error('Steam did not return player information.');
    players.push(...data.response.players);
  }
  const owner = players.find(p => p.steamid === steamId);
  const friends = players.filter(p => p.steamid !== steamId).map(p => ({
    id: p.steamid, name: String(p.personaname || 'Steam friend').slice(0, 80),
    state: STATES[p.personastate] || 'Offline', ...(p.gameextrainfo ? {game: String(p.gameextrainfo).slice(0, 100)} : {})
  })).sort((a, b) => (Boolean(b.game) - Boolean(a.game)) || ((b.state !== 'Offline') - (a.state !== 'Offline')) || a.name.localeCompare(b.name));
  return {profile: String(owner?.personaname || 'Steam'), updatedAt: new Date().toISOString(), friends};
}

export function createRelay ({key, steamId, token, fetcher = fetch}) {
  if (!/^[a-f0-9]{32}$/i.test(key || '') || !/^\d{17}$/.test(steamId || '') || typeof token !== 'string' || token.length < 24) {
    throw new Error('Set STEAM_WEB_API_KEY (32 hex characters), STEAM_ID (17 digits), and STEAM_RELAY_TOKEN (at least 24 characters).');
  }
  let cached; let cachedAt = 0; let pending;
  const expected = Buffer.from(`Bearer ${token}`);
  return http.createServer(async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Private-Network', 'true');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    const send = (status, data) => {res.writeHead(status); res.end(JSON.stringify(data));};
    if (req.method === 'OPTIONS') {res.writeHead(204); res.end(); return;}
    const supplied = Buffer.from(req.headers.authorization || '');
    if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) {send(401, {error: 'Relay token required.'}); return;}
    if (req.url !== '/friends' || req.method !== 'GET') {send(404, {error: 'Not found.'}); return;}
    try {
      if (!cached || Date.now() - cachedAt > 60000) {
        if (!pending) pending = readSteam(key, steamId, fetcher).then(data => {cached = data; cachedAt = Date.now();}).finally(() => {pending = undefined;});
        await pending;
      }
      send(200, cached);
    } catch (error) {send(502, {error: error instanceof Error ? error.message : 'Steam unavailable.'});}
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const host = process.env.STEAM_RELAY_HOST || '127.0.0.1';
    if (!/^(127\.0\.0\.1|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3})$/.test(host)) throw new Error('Use a specific private LAN IPv4 address or 127.0.0.1 for STEAM_RELAY_HOST.');
    const port = Number(process.env.STEAM_RELAY_PORT || 8788);
    if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('Use a port between 1024 and 65535.');
    const relay = createRelay({key: process.env.STEAM_WEB_API_KEY, steamId: process.env.STEAM_ID, token: process.env.STEAM_RELAY_TOKEN});
    relay.requestTimeout = 15000;
    relay.on('error', () => {console.error('Could not listen on the configured address and port.'); process.exitCode = 1;});
    relay.listen(port, host, () => console.log(`Steam relay listening on http://${host}:${port}/friends. Keep this terminal open. Ctrl+C stops it.`));
  } catch (error) {console.error(error.message); process.exitCode = 1;}
}

import test from 'node:test';
import assert from 'node:assert/strict';
import {createRelay, readSteam} from './steam-relay.mjs';
const steamId = '76561198000000000';
const key = '0'.repeat(32);
const token = 'test-token-only-never-a-real-secret';
const friendIds = Array.from({length: 103}, (_, i) => String(BigInt(steamId) + BigInt(i + 1)));
const calls = [];
const fixture = async url => {
  calls.push(url);
  if (url.pathname.includes('GetFriendList')) return {ok: true, json: async () => ({friendslist: {friends: friendIds.map(steamid => ({steamid}))}})};
  const ids = url.searchParams.get('steamids').split(',');
  assert.ok(ids.length <= 100);
  return {ok: true, json: async () => ({response: {players: ids.map((id, i) => ({steamid: id, personaname: id === steamId ? 'Test profile' : `Fixture ${id}`, personastate: i % 2, ...(i === 3 ? {gameextrainfo: 'Test game'} : {})}))}})};
};
test('Steam batches summaries, excludes owner and sorts playing friends first', async () => {
  const result = await readSteam(key, steamId, fixture);
  assert.equal(result.friends.length, 103); assert.equal(result.profile, 'Test profile');
  assert.equal(result.friends[0].game, 'Test game'); assert.equal(calls.length, 3);
  assert.ok(result.friends.every(f => f.id !== steamId));
  assert.ok(!JSON.stringify(result).includes(key));
});
test('Private Steam list reports actionable error without exposing the key', async () => {
  await assert.rejects(readSteam(key, steamId, async () => ({ok: false, status: 401})), /privacy/);
});
test('Relay requires token, handles CORS preflight, caches and returns only friends data', async () => {
  calls.length = 0;
  const server = createRelay({key, steamId, token, fetcher: fixture});
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = `http://127.0.0.1:${server.address().port}/friends`;
  try {
    assert.equal((await fetch(address)).status, 401);
    assert.equal((await fetch(address, {method: 'OPTIONS'})).status, 204);
    const response = await fetch(address, {headers: {Authorization: `Bearer ${token}`}});
    assert.equal(response.status, 200); assert.equal((await response.json()).friends.length, 103);
    await fetch(address, {headers: {Authorization: `Bearer ${token}`}});
    assert.equal(calls.length, 3);
  } finally {server.closeAllConnections(); await new Promise(resolve => server.close(resolve));}
});

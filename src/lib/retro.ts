export type StartupVoice='gba'|'ps2';
export interface RetroPreferences {
  background: 'frieren' | 'blue' | 'custom';
  fade: number;
  scanlines: boolean;
  sound: boolean;
  boot: boolean;
  startupSound: boolean;
  startupVoice: StartupVoice;
  startupVolume: number;
  idle: boolean;
  wallpaper: string;
  steamUrl: string;
  steamToken: string;
}
const KEY = 'frieren-retro-v1';
export const RETRO_DEFAULTS: RetroPreferences = {background: 'blue', fade: 55, scanlines: true, sound: false, boot: true, startupSound: false, startupVoice: 'gba', startupVolume: 25, idle: true, wallpaper: '', steamUrl: '', steamToken: ''};
export function webUrl (value: string): string {
  if (!value.trim()) return '';
  const url = new URL(value.trim());
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error('Use an http:// or https:// address.');
  return url.href;
}
export function loadRetro (): RetroPreferences {
  try {
    const p = JSON.parse(localStorage.getItem(KEY) || '{}');
    return {...RETRO_DEFAULTS,
      background: ['frieren', 'blue', 'custom'].includes(p.background) ? p.background : 'blue',
      fade: typeof p.fade === 'number' && Number.isFinite(p.fade) ? Math.max(0, Math.min(85, p.fade)) : RETRO_DEFAULTS.fade,
      scanlines: typeof p.scanlines === 'boolean' ? p.scanlines : true,
      startupVoice: p.startupVoice === 'ps2' ? 'ps2' : 'gba',
      startupVolume: typeof p.startupVolume === 'number' && Number.isFinite(p.startupVolume) ? Math.max(0,Math.min(100,p.startupVolume)) : 25,
      sound: p.sound === true, startupSound: p.startupSound === true, boot: p.boot !== false, idle: p.idle !== false,
      wallpaper: webUrl(typeof p.wallpaper === 'string' ? p.wallpaper : ''),
      steamUrl: webUrl(typeof p.steamUrl === 'string' ? p.steamUrl : ''),
      steamToken: typeof p.steamToken === 'string' ? p.steamToken : ''};
  } catch { return {...RETRO_DEFAULTS}; }
}
export function saveRetro (p: RetroPreferences): void { localStorage.setItem(KEY, JSON.stringify(p)); }

// Original navigation tones; startup samples are optional user-supplied local files.
let audio: AudioContext | undefined;
const startupBuffers:Partial<Record<StartupVoice,Promise<AudioBuffer>>>={};
export function playStartupSound (enabled: boolean, onReady:(playing:boolean)=>void=()=>undefined,options:{voice?:StartupVoice;volume?:number}={}): () => void {
  const voice=options.voice==='ps2'?'ps2':'gba';
  const volume=Number.isFinite(options.volume)?Math.max(0,Math.min(100,options.volume!)):25;
  if(!enabled||volume===0){onReady(false);return ()=>undefined;}
  let stopped=false,settled=false,buffer:AudioBuffer|undefined;
  let source:AudioBufferSourceNode|undefined,gain:GainNode|undefined,ctx:AudioContext|undefined;
  const cleanup=()=>{clearTimeout(timeout);document.removeEventListener('visibilitychange',wake);window.removeEventListener('keydown',wake,true);window.removeEventListener('pointerdown',wake,true);ctx?.removeEventListener('statechange',attempt);};
  const ready=(playing=false)=>{if(settled||stopped)return;settled=true;cleanup();onReady(playing);};
  const attempt=()=>{
    if(stopped||settled||document.hidden||!ctx||ctx.state!=='running'||!buffer)return;
    source=ctx.createBufferSource();source.buffer=buffer;gain=ctx.createGain();gain.gain.value=volume/100;
    source.connect(gain);gain.connect(ctx.destination);source.onended=()=>{source?.disconnect();gain?.disconnect();};
    source.start();ready(true);
  };
  const wake=()=>{
    if(stopped||settled||document.hidden)return;
    try{
      if(!ctx){
        if(!audio||audio.state==='closed')audio=new AudioContext();ctx=audio;
        ctx.addEventListener('statechange',attempt);
        if(!startupBuffers[voice]){
          const url=new URL(voice==='ps2'?'audio/ps2-startup-reference.wav':'audio/gba-startup.wav',document.baseURI);
          const bytes:Promise<ArrayBuffer>=url.protocol==='file:'?new Promise((resolve,reject)=>{
            const request=new XMLHttpRequest();request.open('GET',url.href);request.responseType='arraybuffer';request.timeout=3000;
            request.onload=()=>request.response&&(request.status===0||request.status>=200&&request.status<300)?resolve(request.response):reject(Error('Startup sample unavailable'));
            request.onerror=request.ontimeout=()=>reject(Error('Startup sample unavailable'));request.send();
          }):fetch(url.href).then(response=>{if(!response.ok)throw Error('Startup sample unavailable');return response.arrayBuffer();});
          startupBuffers[voice]=bytes.then(data=>ctx!.decodeAudioData(data)).catch(error=>{delete startupBuffers[voice];throw error;});
        }
        void startupBuffers[voice]!.then(data=>{buffer=data;attempt();}).catch(()=>ready());
      }
      if(ctx.state!=='running')void ctx.resume().then(attempt).catch(()=>undefined);
      attempt();
    }catch{ready();}
  };
  // Warm-up and foreground delays must not silently discard otherwise valid audio.
  // If playback cannot start, continue silently rather than hang or play late over Home.
  const timeout=window.setTimeout(()=>ready(),3500);
  document.addEventListener('visibilitychange',wake);window.addEventListener('keydown',wake,true);window.addEventListener('pointerdown',wake,true);wake();
  return()=>{
    if(stopped)return;stopped=true;cleanup();
    if(!ctx||!gain||!source)return;
    const now=ctx.currentTime;gain.gain.setTargetAtTime(.0001,now,.018);
    try{source.stop(now+.09);}catch{/* Already finished. */}
  };
}
export function playTone (kind: 'move' | 'open' | 'back', enabled: boolean): void {
  if (!enabled || document.hidden) return;
  try {
    if (!audio) audio = new AudioContext();
    const ctx = audio;
    void ctx.resume().catch(() => undefined);
    const notes = kind === 'open' ? [440, 660, 880] : kind === 'back' ? [330, 220] : [587];
    notes.forEach((frequency, index) => {
      const osc = ctx.createOscillator(); const gain = ctx.createGain();
      const start = ctx.currentTime + index * 0.035;
      const duration = kind === 'open' ? 0.42 : 0.13;
      osc.type = 'sine'; osc.frequency.setValueAtTime(frequency, start);
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(kind === 'move' ? 0.018 : 0.013, start + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
      osc.connect(gain); gain.connect(ctx.destination); osc.start(start); osc.stop(start + duration + 0.02);
      osc.onended = () => {osc.disconnect(); gain.disconnect();};
    });
  } catch { /* Audio is optional; TV navigation must always work. */ }
}

export interface SteamFriend {id: string; name: string; state: string; game?: string; avatar?: string;}
export interface SteamSnapshot {profile: string; friends: SteamFriend[]; updatedAt: string;}
export async function fetchSteam (url: string, token: string, signal: AbortSignal): Promise<SteamSnapshot> {
  const response = await fetch(webUrl(url), {signal, headers: token ? {Authorization: `Bearer ${token}`} : {}});
  if (!response.ok) {
    let detail = '';
    try {const error = await response.json(); if (typeof error.error === 'string') detail = error.error.slice(0, 220);} catch { /* A proxy may return HTML. */ }
    throw new Error(response.status === 401 ? 'Check the relay token.' : detail || 'The Steam relay could not load friends.');
  }
  const data = await response.json();
  if (!data || !Array.isArray(data.friends) || typeof data.updatedAt !== 'string' || !Number.isFinite(Date.parse(data.updatedAt))) throw new Error('This address did not return a Steam friends list.');
  return {profile: typeof data.profile === 'string' ? data.profile : 'Steam', updatedAt: data.updatedAt,
    friends: data.friends.filter((f: SteamFriend) => f && typeof f.id === 'string' && typeof f.name === 'string' && typeof f.state === 'string')
      .map((f: SteamFriend) => ({id: f.id, name: f.name.slice(0, 80), state: f.state.slice(0, 30), game: typeof f.game === 'string' ? f.game.slice(0, 100) : undefined}))};
}

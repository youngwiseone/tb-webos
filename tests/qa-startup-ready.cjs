const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),esbuild=require('esbuild');
const code=esbuild.transformSync(fs.readFileSync('src/lib/retro.ts','utf8'),{loader:'ts',format:'cjs'}).code;
function fixture({state='running',hidden=false,delayedDecode=false}={}){
 const contexts=[],gains=[],urls=[],listeners=new Map(),timers=new Map();let now=0,id=0,loads=0,decodeFinish,resumeFinish,fail=false;
 const add=(type,fn)=>{if(!listeners.has(type))listeners.set(type,new Set());listeners.get(type).add(fn);},remove=(type,fn)=>listeners.get(type)?.delete(fn),dispatch=type=>[...(listeners.get(type)||[])].forEach(fn=>fn());
 class AudioContext{constructor(){this.state=state;this.currentTime=10;this.sources=[];this.events=new Set();contexts.push(this);}addEventListener(type,fn){this.events.add(fn);}removeEventListener(type,fn){this.events.delete(fn);}createGain(){const g={gain:{value:0,setTargetAtTime(){}},connect(){},disconnect(){}};gains.push(g);return g;}createBufferSource(){const s={connect(){},disconnect(){},start(){this.started=true;},stop(t){this.stopAt=t;}};this.sources.push(s);return s;}decodeAudioData(){return delayedDecode?new Promise(r=>{decodeFinish=()=>r({duration:5.2});}):Promise.resolve({duration:5.2});}resume(){return new Promise(r=>{resumeFinish=()=>{this.state='running';this.events.forEach(fn=>fn());r();};});}}
 const document={hidden,baseURI:'https://tv.test/index.html',addEventListener:add,removeEventListener:remove};
 const window={addEventListener:add,removeEventListener:remove,setTimeout:(fn,ms)=>{const n=++id;timers.set(n,{fn,at:now+ms});return n;}};
 const box={module:{exports:{}},exports:{},window,document,URL,AudioContext,clearTimeout:n=>timers.delete(n),localStorage:{getItem:()=>JSON.stringify({sound:false})},fetch:async url=>{urls.push(String(url));loads++;if(fail)throw Error('offline');return {ok:true,arrayBuffer:async()=>new ArrayBuffer(4)};}};box.exports=box.module.exports;vm.runInNewContext(code,box);
 return {api:box.module.exports,contexts,gains,urls,loads:()=>loads,decode:()=>decodeFinish(),resume:()=>resumeFinish(),fail:v=>fail=v,show:()=>{document.hidden=false;dispatch('visibilitychange');},advance:ms=>{now+=ms;for(const [n,t] of timers)if(t.at<=now){timers.delete(n);t.fn();}}};
}
const settle=async()=>{for(let i=0;i<16;i++)await Promise.resolve();};
(async()=>{
 let f=fixture(),ready=0;f.api.playStartupSound(false,()=>ready++);assert.equal(ready,1);assert.equal(f.contexts.length,0);
 assert.equal(f.api.loadRetro().sound,false);assert.equal(f.api.loadRetro().startupSound,false);
 assert.equal(f.api.loadRetro().startupVoice,'gba');assert.equal(f.api.loadRetro().startupVolume,25);
 f=fixture();f.api.playStartupSound(true,()=>{}, {volume:0});assert.equal(f.contexts.length,0);
 f.api.playStartupSound(true,()=>{}, {voice:'gba',volume:25});await settle();assert.ok(f.urls[0].endsWith('/audio/gba-startup.wav'));assert.equal(f.gains[0].gain.value,.25);
 f.api.playStartupSound(true,()=>{}, {voice:'ps2',volume:10});await settle();assert.ok(f.urls[1].endsWith('/audio/ps2-startup-reference.wav'));assert.equal(f.gains[1].gain.value,.1);
 f.api.playStartupSound(true,()=>{}, {voice:'gba',volume:100});await settle();assert.equal(f.loads(),2);assert.equal(f.gains[2].gain.value,1);
 f=fixture();ready=0;const stop=f.api.playStartupSound(true,()=>ready++);await settle();assert.equal(ready,1);assert.equal(f.contexts[0].sources[0].started,true);stop();assert.equal(f.contexts[0].sources[0].stopAt,10.09);f.api.playStartupSound(true);await settle();assert.equal(f.loads(),1);
 f=fixture({delayedDecode:true});ready=0;f.api.playStartupSound(true,()=>ready++);await settle();f.advance(1500);assert.equal(ready,0);f.decode();await settle();assert.equal(ready,1);assert.equal(f.contexts[0].sources.length,1);
 f=fixture({state:'suspended'});ready=0;f.api.playStartupSound(true,()=>ready++);await settle();assert.equal(ready,0);f.resume();await settle();assert.equal(ready,1);
 f=fixture({hidden:true});ready=0;f.api.playStartupSound(true,()=>ready++);await settle();assert.equal(f.contexts.length,0);f.show();await settle();assert.equal(ready,1);
 f=fixture({delayedDecode:true});ready=0;const cancel=f.api.playStartupSound(true,()=>ready++);await settle();cancel();f.decode();await settle();assert.equal(ready,0);assert.equal(f.contexts[0].sources.length,0);
 f=fixture({state:'suspended'});ready=0;f.api.playStartupSound(true,()=>ready++);await settle();f.advance(3500);assert.equal(ready,1);f.resume();await settle();assert.equal(f.contexts[0].sources.length,0);
 f=fixture();ready=0;f.fail(true);f.api.playStartupSound(true,()=>ready++);await settle();assert.equal(ready,1);f.fail(false);f.api.playStartupSound(true);await settle();assert.equal(f.contexts[0].sources.length,1);
 console.log('Startup: independent sound setting, disabled path, playback/cache,1500ms decode, suspended resume, hidden-first foreground, cancellation, bounded timeout/no-late-play, load-failure retry passed.');
})().catch(e=>{console.error(e);process.exitCode=1;});

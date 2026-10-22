import {useEffect,useRef,useState} from 'preact/hooks';
import {readNetwork,openNetworkSettings,type NetworkSnapshot} from '../lib/network';
import {isWebOS} from '../lib/luna';

interface Props{allowHomebrew:boolean;onBack:()=>void;onActivity:()=>void;}
export function NetworkSettings({allowHomebrew,onBack,onActivity}:Props){
  const [snapshot,setSnapshot]=useState<NetworkSnapshot|null>(null),[loading,setLoading]=useState(true),[opening,setOpening]=useState(false),[error,setError]=useState(''),[focus,setFocus]=useState(0);
  const alive=useRef(true),pending=useRef(false),launching=useRef(false),keys=useRef<(e:KeyboardEvent)=>void>(()=>undefined);
  const load=async()=>{if(pending.current||!alive.current)return;pending.current=true;setLoading(true);setError('');try{const next=await readNetwork(allowHomebrew);if(alive.current)setSnapshot(next);}catch(e){if(alive.current){setSnapshot(null);setError(e instanceof Error?e.message:'Could not read the connection.');}}finally{pending.current=false;if(alive.current)setLoading(false);}};
  useEffect(()=>{alive.current=true;void load();const visible=()=>{if(!document.hidden)void load();};const timer=window.setInterval(visible,30000);document.addEventListener('visibilitychange',visible);window.addEventListener('focus',visible);return()=>{alive.current=false;clearInterval(timer);document.removeEventListener('visibilitychange',visible);window.removeEventListener('focus',visible);};},[allowHomebrew]);
  const open=async()=>{onActivity();if(launching.current)return;if(!isWebOS()){setError('Wi-Fi setup opens on the TV. This PC preview shows sample connection details.');return;}launching.current=true;setOpening(true);setError('');try{await openNetworkSettings();}catch{if(alive.current)setError('Could not open LG network settings. Try again.');}finally{launching.current=false;if(alive.current)setOpening(false);}};
  keys.current=e=>{if(![13,27,37,38,39,40,461].includes(e.keyCode))return;e.preventDefault();e.stopImmediatePropagation();onActivity();if(e.keyCode===27||e.keyCode===461){onBack();return;}if(e.keyCode===37||e.keyCode===38)setFocus(0);else if(e.keyCode===39||e.keyCode===40)setFocus(1);else if(e.keyCode===13&&!e.repeat){if(focus===0)void open();else void load();}};
  useEffect(()=>{const handle=(e:KeyboardEvent)=>keys.current(e);addEventListener('keydown',handle);return()=>removeEventListener('keydown',handle);},[]);
  const details=[['Connection',snapshot?.kind],['Network',snapshot?.name],['TV IP address',snapshot?.ip],['Gateway',snapshot?.gateway],['Subnet mask',snapshot?.netmask],['DNS',snapshot?.dns]];
  return <section class="ps-content ps-page-enter ps-network-page">
    <div class="ps-page-heading"><h1>Internet</h1></div>
    <div class="ps-network-panel" aria-busy={loading||opening}>
      <div class="ps-network-main"><div class="ps-network-status"><i class={snapshot?.internet==='Connected'?'is-online':''}/><span>{loading?'Checking connection…':snapshot?.internet==='Connected'?'Connected to the internet':snapshot?.internet==='No internet'?'No internet connection':snapshot?'Internet status unknown':'Connection unavailable'}</span></div>
        <dl>{details.map(([label,value])=><div class={label==='TV IP address'?'is-address':''}><dt>{label}</dt><dd>{loading&&!snapshot?'…':value||'—'}</dd></div>)}</dl>
        <div class="ps-network-actions"><button class={`ps-action ${focus===0?'is-focused':''}`} disabled={opening} onMouseMove={()=>setFocus(0)} onClick={()=>void open()}>Wi-Fi & network settings</button><button class={`ps-action ${focus===1?'is-focused':''}`} disabled={loading} onMouseMove={()=>setFocus(1)} onClick={()=>{onActivity();void load();}}>Refresh</button></div>
      </div><aside class="ps-network-detail"><span class="ps-eyebrow">YOUR CONNECTION</span><h2>Stay connected.</h2><p>Choose a Wi-Fi network, enter its password or change connection settings in LG’s network menu.</p><p>Your TV’s current address appears here and refreshes when you return.</p>{!isWebOS()&&<p class="ps-network-preview">PC preview · sample details</p>}<p class="ps-network-error" role="status">{error}</p></aside>
    </div>
  </section>;
}

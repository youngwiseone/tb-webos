import {useEffect,useRef,useState} from 'preact/hooks';
import {readPicture,writePicture,pictureContextLabel,type PictureContext,type PictureSnapshot} from '../lib/picture';
import {launchApp} from '../lib/launch';

interface Props{context?:PictureContext;onBack:()=>void;onActivity:()=>void;}
export function PictureSettings({context,onBack,onActivity}:Props){
  const [snapshot,setSnapshot]=useState<PictureSnapshot|null>(null),[focus,setFocus]=useState(0),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(''),[saved,setSaved]=useState('');
  const alive=useRef(true),lock=useRef(false),request=useRef(0),keys=useRef<(e:KeyboardEvent)=>void>(()=>undefined);
  const load=async()=>{
    if(lock.current)return;const id=++request.current;setLoading(true);setError('');
    try{const data=await readPicture(context);if(alive.current&&id===request.current){setSnapshot(data);setFocus(old=>Math.min(old,data.controls.length+1));}}
    catch(e){if(alive.current&&id===request.current)setError(e instanceof Error?e.message:'Could not read the TV.');}
    finally{if(alive.current&&id===request.current)setLoading(false);}
  };
  useEffect(()=>{alive.current=true;void load();const visible=()=>{if(!document.hidden)void load();};document.addEventListener('visibilitychange',visible);return()=>{alive.current=false;request.current++;document.removeEventListener('visibilitychange',visible);};},[context?.input,context?.dynamicRange,context?.pictureMode]);
  const change=async(index:number,direction:number)=>{
    onActivity();if(lock.current||loading||!snapshot)return;
    const control=snapshot.controls[index];if(!control?.active)return;
    const next=Math.max(control.min,Math.min(control.max,control.value+direction*control.step));if(next===control.value)return;
    lock.current=true;setBusy(true);setError('');setSaved('');
    try{const actual=await writePicture(control,next,snapshot.context);if(alive.current){setSnapshot(old=>old?{...old,controls:old.controls.map(c=>c.key===control.key?{...c,value:actual}:c)}:old);setSaved('Saved to TV');}}
    catch(e){if(alive.current)setError(e instanceof Error?e.message:'Could not save the change.');}
    finally{lock.current=false;if(alive.current)setBusy(false);}
  };
  const openLG=async()=>{onActivity();setError('');try{await launchApp('com.palm.app.settings');}catch{setError('Could not open LG Settings. Try again.');}};
  const count=snapshot?.controls.length||0;
  keys.current=e=>{
    if(![13,27,37,38,39,40,461].includes(e.keyCode))return;
    e.preventDefault();e.stopImmediatePropagation();onActivity();
    if(e.keyCode===27||e.keyCode===461){if(!lock.current)onBack();return;}
    if(e.keyCode===38)setFocus(old=>Math.max(0,old-1));
    else if(e.keyCode===40)setFocus(old=>Math.min(count+1,old+1));
    else if(focus<count){if(e.keyCode===37||e.keyCode===39||(e.keyCode===13&&!e.repeat))void change(focus,(e.keyCode===37?-1:1)*(e.repeat?5:1));}
    else if(e.keyCode===13&&!e.repeat){if(focus===count)void load();else void openLG();}
  };
  useEffect(()=>{const handler=(e:KeyboardEvent)=>keys.current(e);addEventListener('keydown',handler);return()=>removeEventListener('keydown',handler);},[]);
  const selected=snapshot?.controls[Math.min(focus,Math.max(0,count-1))];
  return <section class="ps-content ps-page-enter ps-picture-page">
    <div class="ps-page-heading"><h1>TV Settings</h1></div>
    <div class="ps-picture-context">{snapshot?pictureContextLabel(snapshot.context):loading?'Reading TV picture profile…':'TV picture controls unavailable'}</div>
    <div class="ps-picture-panel" aria-busy={loading||busy}>
      <div class="ps-picture-list">
        {loading&&!snapshot?<p class="ps-empty">Reading picture settings…</p>:snapshot?.controls.map((control,i)=><div class={`ps-picture-row ${focus===i?'is-focused':''} ${!control.active?'is-disabled':''}`} onMouseMove={()=>setFocus(i)}>
          <div><span>{control.label}</span><div class="ps-picture-meter" role="meter" aria-label={control.label} aria-valuemin={control.min} aria-valuemax={control.max} aria-valuenow={control.value}><i style={{width:`${(control.value-control.min)/(control.max-control.min)*100}%`}}/></div></div>
          <button aria-label={`Decrease ${control.label}`} disabled={!control.active||busy||loading||control.value<=control.min} onClick={()=>{setFocus(i);void change(i,-1);}}>−</button><strong>{control.value}</strong><button aria-label={`Increase ${control.label}`} disabled={!control.active||busy||loading||control.value>=control.max} onClick={()=>{setFocus(i);void change(i,1);}}>+</button>
        </div>)}
        <div class="ps-picture-actions"><button class={`ps-action ${focus===count?'is-focused':''}`} disabled={busy||loading} onMouseMove={()=>setFocus(count)} onClick={()=>void load()}>Refresh</button><button class={`ps-action ${focus===count+1?'is-focused':''}`} onMouseMove={()=>setFocus(count+1)} onClick={()=>void openLG()}>All LG settings</button></div>
      </div>
      <aside class="ps-picture-detail"><span class="ps-eyebrow">PICTURE CONTROL</span><h2>{focus<count?selected?.label:'Your TV, your picture'}</h2><p>{focus<count?selected?.help:'Open LG’s complete settings for picture modes, sound, connections and advanced controls.'}</p>{focus<count&&selected&&!selected.active&&<p class="ps-picture-locked">Locked by the current picture mode.</p>}<div class="ps-picture-profile"><small>APPLIES TO</small><span>{snapshot?pictureContextLabel(snapshot.context):'Current TV profile'}</span></div><p class="ps-picture-note">Changes save automatically to this profile. Other input profiles stay unchanged.</p><div class={`ps-picture-status ${error?'has-error':''}`} role="status">{error||((busy||loading)?'Reading / saving…':saved||'')}</div></aside>
    </div>
  </section>;
}

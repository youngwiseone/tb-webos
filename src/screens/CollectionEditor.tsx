import {useEffect, useRef, useState} from 'preact/hooks';
import type {SettingsTab} from './Settings';
import {MemoryCard} from '../components/MemoryCard';
import {moveItem} from '../lib/order';
import {playTone} from '../lib/retro';

interface Props {tabs: SettingsTab[]; discovery:boolean; onDiscovery:()=>void; sound: boolean; loading: boolean; onRefresh:()=>Promise<void>; onToggle: (tab: string, id: string) => void; onReorder: (tab: string, ids: string[]) => void; onClose: () => void;}
export function CollectionEditor ({tabs, discovery, onDiscovery, sound, loading, onRefresh, onToggle, onReorder, onClose}: Props) {
  const [tabIndex,setTabIndex] = useState(0);
  const [arrange,setArrange] = useState(false);
  const [zone,setZone] = useState<'toolbar'|'items'>('toolbar');
  const [tool,setTool] = useState(0);
  const [index,setIndex] = useState(0);
  const [held,setHeld] = useState<{key:string;original:string[]}|null>(null);
  const [announcement,setAnnouncement] = useState('');
  const handler=useRef<(event:KeyboardEvent)=>void>(()=>undefined);
  const tab = tabs[tabIndex];
  const items = tab ? (arrange ? tab.shown : tab.items) : [];
  const selected = items[Math.min(index, Math.max(0,items.length-1))];
  const start = Math.floor(index/7)*7;
  const activateTool = (i:number) => {
    if(i===5){if(held)return;onDiscovery();return;}
    if(i===4){if(loading||held)return;setTool(i);setAnnouncement('Refreshing installed apps…');void onRefresh().then(()=>setAnnouncement(''));return;}
    if (held) {onReorder(tab.id,held.original); setHeld(null);}
    setTool(i);setIndex(0);setAnnouncement('');
    if (i<2) setTabIndex(i); else setArrange(i===3);
    playTone('move',sound);
  };
  const activateItem = (i:number) => {
    if (!tab || !items[i]) return;
    setIndex(i);setZone('items');playTone('open',sound);
    if (!arrange) {onToggle(tab.id,items[i].key);return;}
    if (held) {setHeld(null);setAnnouncement('Order saved.');}
    else {setHeld({key:items[i].key,original:tab.shown.map(item=>item.key)});setAnnouncement('Card selected for moving.');}
  };
  const back = () => {
    playTone('back',sound);
    if (held) {onReorder(tab.id,held.original);setIndex(Math.max(0,held.original.indexOf(held.key)));setHeld(null);setAnnouncement('Move cancelled.');}
    else onClose();
  };
  useEffect(()=>{if(index>=items.length)setIndex(Math.max(0,items.length-1));},[index,items.length]);
  handler.current=(event:KeyboardEvent)=>{
      const code=event.keyCode;
      if (![13,27,37,38,39,40,461].includes(code))return;
      event.preventDefault();
      if(event.repeat&&[13,27,461].includes(code))return;
      if(code===27||code===461){back();return;}
      if(zone==='toolbar'){
        if(code===37)setTool(old=>Math.max(0,old-1));
        if(code===39)setTool(old=>Math.min(5,old+1));
        if(code===13)activateTool(tool);
        if(code===40&&items.length)setZone('items');
      }else{
        if(code===13){activateItem(index);return;}
        if(code===37&&!held){setZone('toolbar');return;}
        if(code!==38&&code!==40)return;
        if(index===0&&code===38&&!held){setZone('toolbar');return;}
        const next=Math.max(0,Math.min(items.length-1,index+(code===38?-1:1)));
        if(held&&next!==index)onReorder(tab.id,moveItem(tab.shown.map(item=>item.key),index,next));
        setIndex(next);playTone('move',sound);
      }
  };
  useEffect(()=>{const key=(event:KeyboardEvent)=>handler.current(event);addEventListener('keydown',key);return()=>removeEventListener('keydown',key);},[]);
  return <section class="ps-content ps-collection ps-page-enter">
    <div class="ps-page-heading"><div><span class="ps-sr-only">SYSTEM / COLLECTION</span><h1>Apps & inputs</h1></div></div>
    <div class="ps-collection-toolbar" role="toolbar" aria-label="Collection controls">{['Applications','HDMI inputs','Show / hide','Arrange',loading?'Refreshing…':'Refresh',`Homebrew: ${discovery?'On':'Off'}`].map((label,i)=><button class={`${zone==='toolbar'&&tool===i?'is-focused':''} ${(i===5?discovery:i<2?tabIndex===i:arrange?i===3:i===2)?'is-active':''}`} disabled={(i===4&&loading)||((i===4||i===5)&&!!held)} onMouseMove={()=>{setZone('toolbar');setTool(i);}} onClick={()=>activateTool(i)} aria-pressed={i===5?discovery:i<2?tabIndex===i:arrange?i===3:i===2}>{label}</button>)}</div>
    <div class="ps-collection-list">{items.slice(start,start+7).map((item,i)=>{const n=start+i;const shown=tab.shown.some(s=>s.key===item.key);return <button key={item.key} class={`ps-collection-item ${zone==='items'&&index===n?'is-focused':''} ${held?.key===item.key?'is-held':''}`} aria-label={`${item.label}, ${shown?'shown':'hidden'}`} aria-pressed={shown} onMouseMove={()=>{if(!held){setIndex(n);setZone('items');}}} onClick={()=>activateItem(n)}><span>{item.label}</span><b>{held?.key===item.key?'Moving':arrange?'':shown?'Shown':'Hidden'}</b></button>;})}
      {!items.length&&<p class="ps-empty">{arrange?'No visible items. Choose Show / hide to add some.':'No available items in this collection.'}</p>}
      {items.length>7&&<span class="ps-collection-count">{start+1}–{Math.min(start+7,items.length)} / {items.length}</span>}
    </div>
    <aside class="ps-collection-detail">{selected&&<div class={`ps-collection-card ${held?'is-held':''}`}><MemoryCard item={selected} input={tab.id==='sources'}/></div>}<h2>{selected?.label||'Your collection'}</h2><p>{zone==='toolbar'&&tool===5?'Optional installed-app discovery uses Homebrew Channel root access. Enable only on your own rooted TV; otherwise the built-in catalogue remains available.':held?'Place this card in its new position.':arrange?'Arrange your memory cards in the order you prefer.':'Choose which installed apps and HDMI inputs appear in Apps. Install something in LG Apps or Homebrew Channel, then return here to show it.'}</p><small>{arrange?'YOUR ORDER, EVERY TIME':'HOME TRAY FOLLOWS RECENT USE'}</small></aside>
    <div class="ps-collection-hint" role="status">{announcement}</div>
  </section>;
}

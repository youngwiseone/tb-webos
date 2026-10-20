import {useEffect,useMemo,useRef,useState} from 'preact/hooks';
import type {HomeRow} from './JourneyHome';
import type {SettingsTab} from './Settings';
import type {TileModel} from '../components/Tile';
import {MemoryCard,MenuSymbol} from '../components/MemoryCard';
import {maintainStandby} from '../lib/standby';
import {Atmosphere,CrystalOrbit,BootScene} from '../components/RetroAtmosphere';
import {CollectionEditor} from './CollectionEditor';
import {useClock} from '../hooks/useClock';
import {fetchSteam,loadRetro,playStartupSound,playTone,saveRetro,webUrl,type RetroPreferences,type SteamSnapshot} from '../lib/retro';
import {loadRecents,recentItems,rememberRecent,saveRecents} from '../lib/recents';
import {isWebOS} from '../lib/luna';
import wallpaper from '../assets/wallpaper.svg';
import {GbaBootScene} from '../components/GbaBootScene';
import {STARTUP_DURATION,startupGreeting} from '../lib/startup';
import {PictureSettings} from './PictureSettings';
import {readLaunchIntent} from '../lib/launch-intent';
import {type PictureContext} from '../lib/picture';
import {launchApp} from '../lib/launch';

interface Props {rows:HomeRow[]; collections:SettingsTab[]; loading:boolean; onRefreshApps:()=>Promise<void>; discovery:boolean; onDiscovery:()=>void; onActivate:(row:string,item:TileModel)=>Promise<void>; onToggle:(tab:string,id:string)=>void; onReorder:(tab:string,ids:string[])=>void;}
type Page='menu'|'browser'|'config'|'friends'|'collection'|'picture';
type Form='wallpaper'|'steam'|null;
type Entry={row:string;item:TileModel};
const MENUS=['Apps','System Configuration','TV Settings','Friends'];
const PAGES:Page[]=['browser','config','picture','friends'];
const BACKGROUNDS:RetroPreferences['background'][]=['frieren','blue','custom'];
const BACKGROUND_NAMES={frieren:'Frieren · dusk',blue:'Classic blue',custom:'Custom image'};
const pad=(n:number)=>String(n).padStart(2,'0');
const SETTINGS=[
  ['Background','Choose your atmosphere','The bundled blue horizon, the classic blue void, or an image of your own.'],
  ['Image fade','Keep the scene in the background','Set the image fade from 0% to 85%. Your original picture stays untouched.'],
  ['Scanlines','A little analogue texture','A subtle texture over the background. Menus stay sharp, and your streaming apps are unaffected.'],
  ['Menu sounds','A softer kind of feedback','Short, original tones for movement, selection and Back. Kept quiet so they never take over.'],
  ['Startup sequence','A small moment of nostalgia','A handheld greeting with the Game Boy Advance chime, or towers and clouds with PlayStation 2. Replay the sequence from the system menu whenever you like.'],
  ['Startup sound','Choose your startup chime','Game Boy Advance pairs a time-of-day greeting with its chime. PlayStation 2 restores the towers intro. Off mutes the selected intro.'],
  ['Startup volume','A quieter welcome','Adjust only the startup chime. Navigation sounds and your TV volume stay independent.'],
  ['Quiet idle view','Let the menu drift away','After two minutes, your scene dims around drifting blue lights and a clock. The scene fades away, leaving blue lights roaming the dark. They fade too, then return with the time before your background reappears. Any button wakes it.'],
  ['Custom wallpaper','Make it your own','Add a direct image address reachable from the TV. Clear the address to return to the bundled blue horizon.'],
  ['Apps & inputs','Your collection, your order','Choose what appears and arrange your Apps memory cards. The home tray shows your six most recently opened apps or HDMI inputs.'],
  ['Steam connection','Good company, wherever they are','Connect the optional PC relay to see online friends and their games. Your Steam API key stays on the PC.'],
  ['LG Home','The original TV menu','Open LG’s home screen whenever you need the TV’s own apps or controls.']
];

export function Home ({rows,collections,loading,onRefreshApps,discovery,onDiscovery,onActivate,onToggle,onReorder}:Props) {
  const [prefs,setPrefs]=useState(loadRetro);
  const [initialIntent]=useState(()=>readLaunchIntent());
  const [page,setPage]=useState<Page>(initialIntent.page);
  const [pictureContext,setPictureContext]=useState<PictureContext|undefined>(initialIntent.context);
  const [pictureReturnApp,setPictureReturnApp]=useState(initialIntent.returnApp||'');
  const [collectionReturn,setCollectionReturn]=useState<Page>('config');
  const [menu,setMenu]=useState(0);
  const [menuZone,setMenuZone]=useState<'main'|'quick'>('main');
  const [quick,setQuick]=useState(0);
  const [card,setCard]=useState(0);
  const [filter,setFilter]=useState(0);
  const [browserZone,setBrowserZone]=useState<'tabs'|'cards'>('cards');
  const [tabFocus,setTabFocus]=useState(0);
  const [setting,setSetting]=useState(0);
  const [booting,setBooting]=useState(()=>initialIntent.page!=='picture'&&prefs.boot);
  const [bootReady,setBootReady]=useState(false);
  const [greeting,setGreeting]=useState(startupGreeting);
  const [bootAudio,setBootAudio]=useState('warming');
  const [scale,setScale]=useState(()=>Math.min(innerWidth/1920,innerHeight/1080));
  const [visible,setVisible]=useState(!document.hidden);
  const [idle,setIdle]=useState(false);
  const [guide,setGuide]=useState(false);
  const [guideIndex,setGuideIndex]=useState(0);
  const [notice,setNotice]=useState('');
  const [form,setForm]=useState<Form>(null);
  const [formFocus,setFormFocus]=useState(0);
  const [draftUrl,setDraftUrl]=useState('');
  const [draftToken,setDraftToken]=useState('');
  const [imageFailed,setImageFailed]=useState(false);
  const [snapshot,setSnapshot]=useState<SteamSnapshot|null>(null);
  const [steamState,setSteamState]=useState('');
  const [refresh,setRefresh]=useState(0);
  const [friendPage,setFriendPage]=useState(0);
  const [launching,setLaunching]=useState<{entry:Entry;error:boolean}|null>(null);
  const [recents,setRecents]=useState(loadRecents);
  const lastActivity=useRef(Date.now());
  const launchLock=useRef(false);
  const launchAttempt=useRef(0);
  const launchTimer=useRef(0);
  const noticeTimer=useRef(0);
  const formElement=useRef<HTMLFormElement>(null);
  const handler=useRef<(event:KeyboardEvent)=>void>(()=>undefined);
  const intentHandler=useRef<(detail:unknown)=>void>(()=>undefined);
  const snapshotRef=useRef(snapshot);snapshotRef.current=snapshot;
  const now=useClock();
  const allItems=useMemo<Entry[]>(()=>rows.filter(r=>r.id!=='misc').flatMap(r=>r.items.map(item=>({row:r.id,item}))),[rows]);
  const items=useMemo(()=>allItems.filter(entry=>filter===0||(filter===1?entry.row==='apps':entry.row==='sources')),[allItems,filter]);
  const quickItems=useMemo(()=>recentItems(allItems,recents,entry=>entry.item.key),[allItems,recents]);
  const selected=items[Math.min(card,Math.max(0,items.length-1))];
  const start=Math.floor(card/8)*8;
  const image=prefs.background==='frieren'?wallpaper:prefs.background==='custom'?prefs.wallpaper:'';
  const clock=`${pad(now.getHours())}:${pad(now.getMinutes())}`;
  const date=now.toLocaleDateString('en-NZ',{weekday:'short',day:'2-digit',month:'short',year:'numeric'}).toUpperCase();
  const online=snapshot?.friends.filter(f=>f.state!=='Offline')||[];
  const crystalAngle=now.getHours()*30+now.getMinutes()/2;
  const touch=()=>{lastActivity.current=Date.now();if(idle)setIdle(false);};
  const notify=(text:string)=>{setNotice(text);clearTimeout(noticeTimer.current);noticeTimer.current=window.setTimeout(()=>setNotice(''),4200);};
  const update=(patch:Partial<RetroPreferences>)=>{const next={...prefs,...patch};setPrefs(next);try{saveRetro(next);}catch{notify('Could not save preferences. Storage may be full.');}};
  const enter=(next:Page)=>{touch();playTone('open',prefs.sound);setBooting(false);setGuide(false);if(next==='collection'){setCollectionReturn(page==='browser'?'browser':'config');void onRefreshApps();}if(next==='picture'){setPictureContext(undefined);setPictureReturnApp('');}setPage(next);};
  const returnFromPicture=()=>{const app=pictureReturnApp;setPictureReturnApp('');setPage('menu');setMenuZone('main');touch();if(app)void launchApp(app).catch(()=>notify('Could not return to the previous app. Choose it in Apps.'));};
  intentHandler.current=detail=>{
    const intent=readLaunchIntent(detail);lastActivity.current=Date.now();setIdle(false);setBooting(intent.startup===true&&prefs.boot);setGuide(false);setForm(null);setLaunching(null);launchLock.current=false;launchAttempt.current++;clearTimeout(launchTimer.current);
    if(intent.page==='picture'){if(page!=='picture'||intent.context){setPictureContext(intent.context);setPictureReturnApp(intent.returnApp||'');}setPage('picture');}
    else{setPictureReturnApp('');setPage('menu');setMenuZone('main');}
  };
  const openForm=(type:Exclude<Form,null>)=>{setDraftUrl(type==='wallpaper'?prefs.wallpaper:prefs.steamUrl);setDraftToken(prefs.steamToken);setFormFocus(0);setForm(type);};
  const saveForm=()=>{
    try{
      const url=webUrl(draftUrl);
      if(form==='wallpaper')update({wallpaper:url,background:url?'custom':'frieren'});
      else{update({steamUrl:url,steamToken:url?draftToken.trim():''});setSnapshot(null);setSteamState('');setFriendPage(0);}
      setForm(null);playTone('open',prefs.sound);notify('Saved.');
    }catch(error){notify(error instanceof Error?error.message:'Please check the address.');}
  };
  const launch=async (entry:Entry)=>{
    if(launchLock.current)return;
    touch();launchLock.current=true;const attempt=++launchAttempt.current;setGuide(false);setLaunching({entry,error:false});playTone('open',prefs.sound);
    try{
      await onActivate(entry.row,entry.item);
      if(attempt!==launchAttempt.current)return;
      if(entry.row!=='misc'){const next=rememberRecent(recents,entry.item.key);setRecents(next);setQuick(0);try{saveRecents(next);}catch{/* Optional history. */}}
      clearTimeout(launchTimer.current);launchTimer.current=window.setTimeout(()=>{setLaunching(null);launchLock.current=false;},isWebOS()?1800:1000);
    }catch{if(attempt===launchAttempt.current){launchLock.current=false;setLaunching({entry,error:true});}}
  };
  const dismissLaunch=()=>{clearTimeout(launchTimer.current);launchAttempt.current++;launchLock.current=false;setLaunching(null);};
  const back=()=>{
    playTone('back',prefs.sound);
    if(form){setForm(null);return;}
    if(guide){setGuide(false);return;}
    if(launching){dismissLaunch();return;}
    if(page==='menu'){if(menuZone==='quick')setMenuZone('main');else{setGuideIndex(0);setGuide(true);}return;}
    setPage('menu');setMenuZone('main');
  };
  const configure=(index:number,direction=1)=>{
    touch();playTone('move',prefs.sound);
    if(index===0){const next=BACKGROUNDS[(BACKGROUNDS.indexOf(prefs.background)+direction+3)%3];if(next==='custom'&&!prefs.wallpaper)openForm('wallpaper');else update({background:next});}
    else if(index===1)update({fade:Math.max(0,Math.min(85,prefs.fade+direction*5))});
    else if(index===2)update({scanlines:!prefs.scanlines});
    else if(index===3){update({sound:!prefs.sound});if(!prefs.sound)playTone('open',true);}
    else if(index===4)update({boot:!prefs.boot});
    else if(index===5){const voices=['gba','ps2','off'] as const;const current=prefs.startupSound?prefs.startupVoice:'off';const next=voices[(voices.indexOf(current)+direction+3)%3];update(next==='off'?{startupSound:false}:{startupSound:true,startupVoice:next});}
    else if(index===6)update({startupVolume:Math.max(0,Math.min(100,prefs.startupVolume+direction*5))});
    else if(index===7)update({idle:!prefs.idle});
    else if(index===8)openForm('wallpaper');
    else if(index===9)enter('collection');
    else if(index===10)openForm('steam');
    else void launch({row:'misc',item:{key:'lg-home',label:'LG Home'}});
  };
  const filterTo=(index:number)=>{setFilter(index);setTabFocus(index);setCard(0);playTone('move',prefs.sound);};
  const guideAction=(index:number)=>{if(index===0)setGuide(false);else if(index===1){touch();setGuide(false);setPage('menu');setBooting(true);}else if(index===2)enter('config');else void launch({row:'misc',item:{key:'lg-home',label:'LG Home'}});};

  useEffect(()=>{
    const resize=()=>{setScale(Math.min(innerWidth/1920,innerHeight/1080));};
    const foreground=()=>{setVisible(!document.hidden);lastActivity.current=Date.now();if(!document.hidden){setIdle(false);setLaunching(null);launchLock.current=false;launchAttempt.current++;clearTimeout(launchTimer.current);}};
    resize();addEventListener('resize',resize);document.addEventListener('visibilitychange',foreground);document.addEventListener('webOSRelaunch',foreground);
    return()=>{removeEventListener('resize',resize);document.removeEventListener('visibilitychange',foreground);document.removeEventListener('webOSRelaunch',foreground);clearTimeout(launchTimer.current);clearTimeout(noticeTimer.current);};
  },[]);
  useEffect(()=>{const receive=(event:Event)=>{const detail=(event as CustomEvent).detail;if(event.type==='webOSLaunch'&&readLaunchIntent(detail).page!=='picture')return;intentHandler.current(detail);};document.addEventListener('webOSRelaunch',receive);document.addEventListener('webOSLaunch',receive);return()=>{document.removeEventListener('webOSRelaunch',receive);document.removeEventListener('webOSLaunch',receive);};},[]);
  useEffect(()=>{
    if(!booting)return;
    setBootReady(false);setBootAudio('warming');setGreeting(startupGreeting());let cancelled=false,timer=0;
    const begin=(playing:boolean)=>{if(cancelled)return;setBootAudio(playing?'playing':prefs.startupSound&&prefs.startupVolume>0?'unavailable':'off');setBootReady(true);timer=window.setTimeout(()=>setBooting(false),STARTUP_DURATION[prefs.startupVoice]);};
    const stopSound=playStartupSound(prefs.startupSound,begin,{voice:prefs.startupVoice,volume:prefs.startupVolume});
    const silence=()=>{if(document.hidden){stopSound();setBooting(false);}};
    document.addEventListener('visibilitychange',silence);
    return()=>{cancelled=true;clearTimeout(timer);stopSound();document.removeEventListener('visibilitychange',silence);};
  },[booting]);
  useEffect(()=>prefs.idle?maintainStandby():undefined,[prefs.idle]);
  useEffect(()=>{if(card>=items.length)setCard(Math.max(0,items.length-1));},[items.length,card]);
  useEffect(()=>{if(quick>=quickItems.length)setQuick(Math.max(0,quickItems.length-1));},[quickItems.length,quick]);
  useEffect(()=>{
    if(!prefs.idle){setIdle(false);return;}
    if(!visible||booting||form||launching)return;
    const timer=setInterval(()=>{if(Date.now()-lastActivity.current>=120000)setIdle(true);},1000);
    return()=>clearInterval(timer);
  },[prefs.idle,visible,booting,form,launching,page]);
  useEffect(()=>{setImageFailed(false);if(!image)return;const img=new Image();let live=true;img.onerror=()=>{if(live)setImageFailed(true);};img.src=image;return()=>{live=false;img.onerror=null;};},[image]);
  useEffect(()=>{
    if(!prefs.steamUrl||!visible||idle||page!=='friends')return;
    let disposed=false;let controller:AbortController|undefined;
    const read=async()=>{
      controller=new AbortController();const timeout=setTimeout(()=>controller?.abort(),10000);
      setSteamState(snapshotRef.current?'Refreshing…':'Connecting…');
      try{const data=await fetchSteam(prefs.steamUrl,prefs.steamToken,controller.signal);if(!disposed){setSnapshot(data);setSteamState('');setFriendPage(old=>Math.min(old,Math.max(0,Math.ceil(data.friends.length/6)-1)));}}
      catch(error){if(!disposed)setSteamState(error instanceof Error&&error.name!=='AbortError'?error.message:'Connection unavailable. Is the relay PC on?');}
      finally{clearTimeout(timeout);}
    };
    void read();const timer=setInterval(()=>{void read();},60000);
    return()=>{disposed=true;controller?.abort();clearInterval(timer);};
  },[prefs.steamUrl,prefs.steamToken,visible,idle,page,refresh]);

  handler.current=(event:KeyboardEvent)=>{
    const code=event.keyCode;
    if(idle){touch();event.preventDefault();event.stopImmediatePropagation();return;}
    if(page==='picture')return;
    if(![13,27,37,38,39,40,461].includes(code))return;
    touch();
    if(page==='collection')return;
    if(form&&(event.target as HTMLElement).tagName==='INPUT'&&![13,27,461].includes(code))return;
    event.preventDefault();if(event.repeat&&[13,27,461].includes(code))return;
    const isBack=code===27||code===461;
    if(booting){setBooting(false);return;}
    if(form){
      if(isBack){setForm(null);return;}
      const target=event.target as HTMLElement;
      if(target.tagName==='INPUT'){if(code===13){target.blur();setFormFocus(form==='steam'&&target.getAttribute('name')==='url'?1:form==='steam'?2:1);}else event.stopPropagation();return;}
      const count=form==='steam'?4:3;
      if(code===38||code===37)setFormFocus(old=>(old+count-1)%count);
      else if(code===40||code===39)setFormFocus(old=>(old+1)%count);
      else if(formFocus<(form==='steam'?2:1))formElement.current?.querySelectorAll('input')[formFocus]?.focus();
      else if(formFocus===count-1)setForm(null);else saveForm();
      return;
    }
    if(launching){if(isBack){dismissLaunch();return;}if(code===13&&launching.error)void launch(launching.entry);return;}
    if(guide){if(isBack){setGuide(false);return;}if(code===38||code===40){setGuideIndex(old=>(old+(code===38?3:1))%4);playTone('move',prefs.sound);}if(code===13)guideAction(guideIndex);return;}
    if(isBack){back();return;}
    if(code!==13)playTone('move',prefs.sound);
    if(page==='menu'){
      if(menuZone==='main'){
        if(code===38)setMenu(old=>Math.max(0,old-1));
        if(code===40){if(menu===MENUS.length-1&&quickItems.length)setMenuZone('quick');else setMenu(old=>Math.min(MENUS.length-1,old+1));}
        if(code===13||code===39)enter(PAGES[menu]);
      }else{
        if(code===38)setMenuZone('main');
        if(code===37)setQuick(old=>Math.max(0,old-1));
        if(code===39)setQuick(old=>Math.min(quickItems.length-1,old+1));
        if(code===13&&quickItems[quick])void launch(quickItems[quick]);
      }
    }else if(page==='browser'){
      if(browserZone==='tabs'){
        if(code===37)setTabFocus(old=>Math.max(0,old-1));if(code===39)setTabFocus(old=>Math.min(2,old+1));
        if(code===13){filterTo(tabFocus);setBrowserZone('cards');}if(code===40)setBrowserZone('cards');
      }else{
        if(!items.length){if(code===38){setBrowserZone('tabs');setTabFocus(filter);}if(code===13)enter('collection');return;}
        if(code===38&&card%8<4){setBrowserZone('tabs');setTabFocus(filter);return;}
        if(code===37)setCard(old=>Math.max(0,old-1));if(code===39)setCard(old=>Math.min(items.length-1,old+1));
        if(code===38)setCard(old=>Math.max(0,old-4));if(code===40)setCard(old=>Math.max(0,Math.min(items.length-1,old+4)));
        if(code===13&&selected)void launch(selected);
      }
    }else if(page==='config'){
      if(code===38)setSetting(old=>(old+SETTINGS.length-1)%SETTINGS.length);if(code===40)setSetting(old=>(old+1)%SETTINGS.length);
      if(code===37||code===39||code===13)configure(setting,code===37?-1:1);
    }else if(page==='friends'){
      if(code===13)openForm('steam');
      if(code===37||code===38)setFriendPage(old=>Math.max(0,old-1));
      if(code===39||code===40)setFriendPage(old=>Math.min(Math.max(0,Math.ceil((snapshot?.friends.length||0)/6)-1),old+1));
    }
  };
  useEffect(()=>{const key=(event:KeyboardEvent)=>handler.current(event);addEventListener('keydown',key,true);return()=>removeEventListener('keydown',key,true);},[]);

  const values=[BACKGROUND_NAMES[prefs.background],`${prefs.fade}%`,prefs.scanlines?'On':'Off',prefs.sound?'On':'Off',prefs.boot?'On':'Off',prefs.startupSound?(prefs.startupVoice==='gba'?'Game Boy Advance':'PlayStation 2'):'Off',`${prefs.startupVolume}%`,prefs.idle?'After 2 minutes':'Off',prefs.wallpaper?'Change image':'Add image address','Choose & arrange',prefs.steamUrl?'Relay configured':'Not connected','Open original menu'];
  const menuDescription=['Streaming apps and HDMI, collected in one place.','Set the atmosphere. Make yourself at home.','Brightness, contrast and colour, saved to your TV.','See who’s online before the next adventure.'];
  const orbitActive=visible&&!idle&&!booting&&!guide&&!form&&!launching?.error;
  const title=(eyebrow:string,label:string)=><div class="ps-page-heading"><div><span class="ps-sr-only">{eyebrow}</span><h1>{label}</h1></div></div>;

  return <div class={`ps-viewport ${!visible?'is-paused':''}`} onMouseMove={touch} onClickCapture={event=>{touch();if(idle){event.preventDefault();event.stopPropagation();}}}>
    <main class={`ps-stage ps-${page} ${prefs.scanlines?'has-scanlines':''} ${idle?'is-idle':''} ${booting?'is-booting':''} ${guide||form||launching?.error?'has-overlay':''}`} style={{transform:`translate(-50%,-50%) scale(${scale})`}}>
      <Atmosphere image={image} fade={prefs.fade} imageFailed={imageFailed}/>
      <header class="ps-header ps-interface" aria-hidden={idle||!!form||guide||!!launching?.error} {...(idle||!!form||guide||!!launching?.error?{inert:true}:{})}><div class="ps-clock"><strong>{clock}</strong><span>{date}</span></div></header>
      <div class="ps-interface ps-page-shell" key={page} aria-hidden={idle||!!form||guide||!!launching?.error} {...(idle||!!form||guide||!!launching?.error?{inert:true}:{})}>
        {page==='menu'?<section class="ps-main ps-page-enter"><div class="ps-menu-panel"><span class="ps-eyebrow">SYSTEM MENU</span><h1 class="ps-sr-only">Main menu</h1><nav aria-label="Main menu"><div class={`ps-menu-focus ${menuZone==='quick'?'is-muted':''}`} style={{transform:`translateY(${menu*91}px)`}}/>{MENUS.map((label,index)=><button class={`ps-menu-item ${menu===index&&menuZone==='main'?'is-focused':''}`} aria-current={menu===index&&menuZone==='main'?'page':undefined} onMouseMove={()=>{setMenu(index);setMenuZone('main');}} onClick={()=>{setMenu(index);setMenuZone('main');enter(PAGES[index]);}}><MenuSymbol name={(['browser','config','config','friends'] as const)[index]}/><span>{label}</span></button>)}</nav><p key={menu} class="ps-menu-detail">{menuDescription[menu]}</p></div>
          <div class="ps-menu-orbit"><CrystalOrbit angle={crystalAngle} large active={orbitActive}/><span>MEMORIES OF ANOTHER WORLD</span></div>
          <div class="ps-quick"><div class="ps-quick-row">{quickItems.map((entry,i)=><button key={entry.item.key} class={`ps-quick-item ${menuZone==='quick'&&quick===i?'is-focused':''} ${launching?.entry.item.key===entry.item.key?'is-opening':''}`} aria-label={`Open ${entry.item.label}`} onMouseMove={()=>{setMenuZone('quick');setQuick(i);}} onClick={()=>{setQuick(i);setMenuZone('quick');void launch(entry);}}><div class="ps-quick-card"><MemoryCard item={entry.item} input={entry.row==='sources'} mini/></div><span>{entry.item.label}</span></button>)}</div>{!quickItems.length&&<p class="ps-quick-empty">{loading?'Reading your applications…':'Add apps or HDMI inputs in System Configuration, under Apps & inputs.'}</p>}</div>
        </section>:page==='browser'?<section class="ps-content ps-page-enter">{title('SYSTEM / APPS','Apps')}<div class="ps-filter-rail" role="tablist" aria-label="Apps collection">{['All items','Applications','HDMI inputs'].map((label,i)=><button role="tab" aria-selected={filter===i} class={`${filter===i?'is-active':''} ${browserZone==='tabs'&&tabFocus===i?'is-focused':''}`} onMouseMove={()=>{setBrowserZone('tabs');setTabFocus(i);}} onClick={()=>filterTo(i)}>{label}<small>{i===0?allItems.length:allItems.filter(e=>e.row===(i===1?'apps':'sources')).length}</small></button>)}</div>

          <div class="ps-memory-grid" aria-label="Apps and HDMI inputs">{items.slice(start,start+8).map((entry,i)=>{const index=start+i;return <button key={entry.item.key} class={`ps-memory-item ${card===index&&browserZone==='cards'?'is-focused':''} ${launching?.entry.item.key===entry.item.key?'is-opening':''}`} aria-label={entry.item.label} aria-current={card===index&&browserZone==='cards'?'true':undefined} onMouseMove={()=>{setCard(index);setBrowserZone('cards');}} onClick={()=>{setCard(index);setBrowserZone('cards');void launch(entry);}}><div class="ps-card-platform"/><MemoryCard item={entry.item} input={entry.row==='sources'}/><span class="ps-card-title">{entry.item.label}</span><small class="ps-card-index">{entry.row==='sources'?(entry.item.connected?'DEVICE CONNECTED':'NO DEVICE DETECTED'):''}</small></button>;})}</div>
          {!items.length&&<div class="ps-empty-browser"><MenuSymbol name="browser"/><h2>{loading?'Reading your collection…':'A little room for something new.'}</h2><p>Add apps and inputs in System Configuration.</p><button class="ps-action is-focused" onClick={()=>enter('collection')}>Manage collection</button></div>}{items.length>8&&<div class="ps-pagination">COLLECTION {Math.floor(card/8)+1} / {Math.ceil(items.length/8)}</div>}
        </section>:page==='config'?<section class="ps-content ps-page-enter">{title('SYSTEM / PREFERENCES','System Configuration')}<div class="ps-settings-panel"><div class="ps-settings-list">{SETTINGS.map(([label],i)=><button class={`ps-setting ${setting===i?'is-focused':''}`} aria-label={`${label}: ${values[i]}`} onMouseMove={()=>setSetting(i)} onClick={()=>{setSetting(i);configure(i);}}><span>{label}</span><b>{values[i]}</b></button>)}</div><aside class="ps-setting-detail" key={setting}><span class="ps-eyebrow">{setting<3?'APPEARANCE':setting<8?'EXPERIENCE':'SYSTEM'}</span><h2>{SETTINGS[setting][1]}</h2><p>{SETTINGS[setting][2]}</p>{setting===1?<div class="ps-fade-meter"><input type="range" min="0" max="85" step="5" value={prefs.fade} aria-label="Image fade" onClick={event=>event.stopPropagation()} onInput={event=>{touch();update({fade:Number(event.currentTarget.value)});}}/><span>{prefs.fade}% FADE</span></div>:setting===6?<div class="ps-fade-meter"><input type="range" min="0" max="100" step="5" value={prefs.startupVolume} aria-label="Startup volume" onClick={event=>event.stopPropagation()} onInput={event=>{touch();update({startupVolume:Number(event.currentTarget.value)});}}/><span>{prefs.startupVolume}%</span></div>:setting===0||setting===8?<div class={`ps-theme-preview ${prefs.background==='blue'?'is-blue':''}`} style={image&&!imageFailed?{backgroundImage:`linear-gradient(90deg,#05112c88,#05112c44),url(${JSON.stringify(image)})`}:undefined}><CrystalOrbit active={orbitActive}/><span>{BACKGROUND_NAMES[prefs.background]}</span></div>:<div class="ps-setting-symbol"><MenuSymbol name={setting===10?'friends':setting===11?'home':'config'}/></div>}{imageFailed&&(setting===0||setting===8)&&<p class="ps-error-text">Image unavailable. Classic blue is shown until it loads.</p>}</aside></div></section>
        :page==='picture'?<PictureSettings context={pictureContext} onBack={returnFromPicture} onActivity={touch}/>:page==='collection'?<CollectionEditor discovery={discovery} onDiscovery={onDiscovery} tabs={collections} sound={prefs.sound} loading={loading} onRefresh={onRefreshApps} onToggle={onToggle} onReorder={onReorder} onClose={()=>setPage(collectionReturn)}/>
        :<section class="ps-content ps-page-enter">{title('SYSTEM / FRIENDS','Friends')}{!prefs.steamUrl?<div class="ps-friends-empty"><div class="ps-friends-orbit"><CrystalOrbit active={orbitActive}/></div><div><span class="ps-eyebrow">STEAM / NOT CONNECTED</span><h2>A good adventure.<br/>Even better company.</h2><p>See who’s online and what they’re playing.<br/>Connect the optional PC relay to get started.</p><button class="ps-action is-focused" onClick={()=>openForm('steam')}>Connect Steam</button><small>ACCOUNT SETUP IS STILL NEEDED</small></div></div>:<><div class="ps-friends-toolbar"><div><span><i class={steamState?'is-stale':''}/>{snapshot?`${snapshot.profile} · ${online.length} online`:'Steam relay'}</span><small role="status">{steamState||(snapshot?`Updated ${new Date(snapshot.updatedAt).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})} · refreshes every minute`:'Connecting…')}</small></div><button onClick={()=>setRefresh(old=>old+1)}>Refresh</button><button class="ps-action" onClick={()=>openForm('steam')}>Connection settings</button></div><div class="ps-friends-grid">{snapshot?.friends.slice(friendPage*6,friendPage*6+6).map(friend=><article key={friend.id} class={`ps-friend ${friend.state!=='Offline'?'is-online':''}`}><div class="ps-friend-avatar">{friend.name.charAt(0).toUpperCase()}</div><div><h2>{friend.name}</h2><p>{friend.game||friend.state}</p></div><i/></article>)}</div>{!snapshot&&<p class="ps-empty">{steamState||'Connecting…'}</p>}{snapshot&&!snapshot.friends.length&&<p class="ps-empty">No friends returned. Check your Steam friends-list privacy settings.</p>}{snapshot&&snapshot.friends.length>6&&<div class="ps-friend-pages"><button onClick={()=>setFriendPage(old=>Math.max(0,old-1))}>Previous</button><span>{friendPage+1} / {Math.ceil(snapshot.friends.length/6)}</span><button onClick={()=>setFriendPage(old=>Math.min(Math.ceil(snapshot.friends.length/6)-1,old+1))}>Next</button></div>}</>}</section>}
      </div>
      {idle&&<div class="ps-idle-view"><div class="ps-idle-shade" aria-hidden="true"/><div class="ps-idle-lights"><CrystalOrbit angle={crystalAngle} ambient active={visible&&idle}/></div><div class="ps-idle-caption"><div class="ps-idle-caption-drift"><strong>{clock}</strong><small>PRESS ANY BUTTON TO WAKE</small></div></div></div>}
      {guide&&<div class="ps-overlay"><section class="ps-guide ps-dialog-enter" role="dialog" aria-modal="true" aria-label="System menu"><div class="ps-guide-heading"><span class="ps-eyebrow">SYSTEM MENU</span><strong>{clock}</strong></div><h2>A moment between journeys.</h2>{['Resume menu','Replay startup','System Configuration','LG Home'].map((label,i)=><button class={`ps-guide-item ${guideIndex===i?'is-focused':''}`} onMouseMove={()=>setGuideIndex(i)} onClick={()=>guideAction(i)}><MenuSymbol name={i<2?'browser':i===2?'config':'home'}/><span>{label}</span></button>)}</section></div>}
      {form&&<div class="ps-overlay"><form class="ps-form ps-dialog-enter" ref={formElement} onSubmit={event=>{event.preventDefault();saveForm();}} role="dialog" aria-modal="true" aria-label={form==='steam'?'Steam connection':'Custom wallpaper'}><span class="ps-eyebrow">SYSTEM CONFIGURATION</span><h2>{form==='steam'?'Steam connection':'Custom wallpaper'}</h2><p>{form==='steam'?'Enter the address and token from the PC relay. Your Steam API key stays on the PC. Clear the address to disconnect.':'Use a direct image URL reachable from the TV. Clear the address to return to the bundled scene.'}</p><label class={formFocus===0?'is-focused':''}>{form==='steam'?'Relay URL':'Image URL'}<input name="url" type="url" autoComplete="off" value={draftUrl} placeholder={form==='steam'?'http://PC-IP:8788/friends':'https://example.com/wallpaper.jpg'} onFocus={()=>setFormFocus(0)} onInput={event=>setDraftUrl(event.currentTarget.value)}/></label>{form==='steam'&&<label class={formFocus===1?'is-focused':''}>Relay token<input name="token" type="password" autoComplete="off" value={draftToken} onFocus={()=>setFormFocus(1)} onInput={event=>setDraftToken(event.currentTarget.value)}/></label>}<div class="ps-form-buttons"><button type="submit" class={`ps-action ${formFocus===(form==='steam'?2:1)?'is-focused':''}`} onMouseMove={()=>setFormFocus(form==='steam'?2:1)}>Save changes</button><button type="button" class={formFocus===(form==='steam'?3:2)?'is-focused':''} onMouseMove={()=>setFormFocus(form==='steam'?3:2)} onClick={()=>setForm(null)}>Cancel</button></div></form></div>}
      {launching?.error&&<div class="ps-overlay ps-launch-overlay"><section class={`ps-launch ps-dialog-enter ${launching.error?'has-error':''}`} role="status"><div class="ps-launch-art"><MemoryCard item={launching.entry.item} input={launching.entry.row==='sources'}/></div><span class="ps-eyebrow">{launching.error?'COULD NOT OPEN':isWebOS()?'OPENING':'DESKTOP PREVIEW'}</span><h2>{launching.entry.item.label}</h2>{launching.error?<><p>The TV couldn’t open this item. Try opening it again.</p><button class="ps-action is-focused" onClick={()=>void launch(launching.entry)}>Try again</button><button class="ps-launch-back" onClick={dismissLaunch}>Close</button></>:<><div class="ps-launch-line"/><p>{isWebOS()?'A new journey begins.':'App and HDMI launches happen on the TV.'}</p></>}</section></div>}
      {booting&&<div class={`ps-boot ps-boot--${prefs.startupVoice} ${bootReady?'is-ready':'is-warming'}`} data-ready={bootReady} data-audio={bootAudio} onClick={()=>setBooting(false)} role="status" aria-label="Startup sequence">{prefs.startupVoice==='gba'?<GbaBootScene greeting={greeting}/>:<BootScene running={bootReady}/>}</div>}
      {notice&&<div class="ps-notice" role="status"><i/> {notice}</div>}
    </main>
  </div>;
}

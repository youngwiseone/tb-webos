import {useCallback,useEffect,useMemo,useRef,useState} from 'preact/hooks';
import {Home} from './screens/RetroHome';
import type {SettingsTab} from './screens/Settings';
import {Toast,type ToastMessage} from './components/Toast';
import type {TileModel} from './components/Tile';
import {listApps,type AppEntry} from './lib/apps';
import {listInputs,MOCK_INPUTS,type InputSource} from './lib/inputs';
import {launchApp,launchLgHome} from './lib/launch';
import {isWebOS} from './lib/luna';
import {hidePointerOnForeground} from './lib/pointer';
import {loadConfig,saveConfig,toggleId,type UserConfig} from './lib/storage';
import {appTile,inputTile,pickInOrder} from './lib/tiles';

export function App () {
  const [config,setConfig]=useState<UserConfig>(loadConfig);
  const [apps,setApps]=useState<AppEntry[]>([]);
  const [inputs,setInputs]=useState<InputSource[]>([]);
  const [loading,setLoading]=useState(true);
  const [toast,setToast]=useState<ToastMessage|null>(null);
  const timer=useRef(0);
  const appRequest=useRef(0);
  const notify=useCallback((text:string)=>{clearTimeout(timer.current);setToast({text,kind:'error'});timer.current=window.setTimeout(()=>setToast(null),4500);},[]);
  useEffect(()=>hidePointerOnForeground(),[]);
  const refreshApps=useCallback(async()=>{
    const request=++appRequest.current;setLoading(true);
    try{
      const result=await listApps(config.useHomebrew);
      if(request!==appRequest.current)return;
      setApps(result.apps);
      if(config.useHomebrew&&isWebOS()&&result.source!=='homebrew')notify('Installed apps could not be refreshed. Try Refresh in Apps & inputs.');
    }catch{if(request===appRequest.current)notify('Could not read applications. Try Refresh in Apps & inputs.');}
    finally{if(request===appRequest.current)setLoading(false);}
  },[config.useHomebrew,notify]);
  useEffect(()=>{
    void refreshApps();let refreshTimer=0;
    const foreground=()=>{if(!document.hidden){clearTimeout(refreshTimer);refreshTimer=window.setTimeout(()=>void refreshApps(),150);}};
    document.addEventListener('visibilitychange',foreground);document.addEventListener('webOSRelaunch',foreground);
    return()=>{appRequest.current++;clearTimeout(refreshTimer);document.removeEventListener('visibilitychange',foreground);document.removeEventListener('webOSRelaunch',foreground);};
  },[refreshApps]);
  useEffect(()=>{
    let live=true;
    const refresh=()=>{
      if(!isWebOS()){setInputs(MOCK_INPUTS.filter(i=>i.port>0));return;}
      listInputs().then(list=>{if(live)setInputs(list.filter(i=>i.port>0));}).catch(()=>notify('Could not read HDMI inputs. Reopen TB to retry.'));
    };
    const foreground=()=>{if(!document.hidden)refresh();};
    refresh();document.addEventListener('visibilitychange',foreground);document.addEventListener('webOSRelaunch',foreground);
    return()=>{live=false;document.removeEventListener('visibilitychange',foreground);document.removeEventListener('webOSRelaunch',foreground);};
  },[notify]);
  const shownApps=useMemo(()=>pickInOrder(apps,config.appIds,a=>a.id),[apps,config.appIds]);
  const shownInputs=useMemo(()=>config.sourceIds?pickInOrder(inputs,config.sourceIds,s=>s.appId):inputs,[inputs,config.sourceIds]);
  const rows=useMemo(()=>[
    {id:'apps',label:'Applications',items:shownApps.map(appTile)},
    {id:'sources',label:'HDMI inputs',items:shownInputs.map(inputTile)}
  ],[shownApps,shownInputs]);
  const collections:SettingsTab[]=useMemo(()=>[
    {id:'apps',label:'Applications',noun:'apps',items:apps.map(appTile),shown:shownApps.map(appTile)},
    {id:'sources',label:'HDMI inputs',noun:'inputs',items:inputs.map(inputTile),shown:shownInputs.map(inputTile)}
  ],[apps,inputs,shownApps,shownInputs]);
  const onToggle=useCallback((tab:string,key:string)=>setConfig(old=>{
    const next=tab==='apps'?{...old,appIds:toggleId(old.appIds,key)}:{...old,sourceIds:toggleId(old.sourceIds||inputs.map(i=>i.appId),key)};
    saveConfig(next);return next;
  }),[inputs]);
  const onReorder=useCallback((tab:string,keys:string[])=>setConfig(old=>{
    const next=tab==='apps'?{...old,appIds:keys}:{...old,sourceIds:keys};saveConfig(next);return next;
  }),[]);
  const activate=useCallback(async (row:string,item:TileModel)=>{
    if(!isWebOS())return;
    if(row==='misc'&&item.key==='lg-home')await launchLgHome();else await launchApp(item.key);
  },[]);
  return <><Home rows={rows} collections={collections} loading={loading} onRefreshApps={refreshApps} discovery={config.useHomebrew} onDiscovery={()=>setConfig(old=>{const next={...old,useHomebrew:!old.useHomebrew};saveConfig(next);return next;})} onActivate={activate} onToggle={onToggle} onReorder={onReorder}/><Toast message={toast}/></>;
}

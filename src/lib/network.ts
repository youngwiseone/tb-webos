import {isWebOS,lunaCall,type LunaResponse} from './luna';
import {LUNA} from '../config/constants';
import {launchApp} from './launch';

interface Connection {state?:string;ipAddress?:string;ssid?:string;gateway?:string;netmask?:string;dns1?:string;dns2?:string;onInternet?:string;}
interface Status extends LunaResponse {isInternetConnectionAvailable?:boolean;wifi?:Connection;wired?:Connection;}
export interface NetworkSnapshot {kind:'Wi-Fi'|'Ethernet'|'Disconnected';name:string;ip:string;gateway:string;netmask:string;dns:string;internet:'Connected'|'No internet'|'Unknown';}
const connected=(c?:Connection)=>!!c&&['connected','online','ready'].includes(c.state||'');
export function networkSnapshot(status:Status):NetworkSnapshot {
  if(!status||status.returnValue!==true||(!status.wifi&&!status.wired))throw Error('The TV did not return connection details.');
  const wired=connected(status.wired),wifi=connected(status.wifi),connection=wired?status.wired:wifi?status.wifi:undefined;
  return {kind:wired?'Ethernet':wifi?'Wi-Fi':'Disconnected',name:wired?'Wired connection':wifi?(status.wifi?.ssid||'Wireless network'):'No network connected',ip:connection?.ipAddress||'Not assigned',gateway:connection?.gateway||'—',netmask:connection?.netmask||'—',dns:[connection?.dns1,connection?.dns2].filter(Boolean).join(' · ')||'—',internet:!connection?'No internet':status.isInternetConnectionAvailable===true?'Connected':status.isInternetConnectionAvailable===false?'No internet':'Unknown'};
}
export async function readNetwork(allowHomebrew=false):Promise<NetworkSnapshot>{
  if(!isWebOS())return networkSnapshot({returnValue:true,isInternetConnectionAvailable:true,wifi:{state:'connected',ssid:'Home Wi-Fi (preview)',ipAddress:'192.0.2.20',gateway:'192.0.2.1',netmask:'255.255.255.0',dns1:'192.0.2.1'}});
  try{return networkSnapshot(await lunaCall<Status>('luna://com.webos.service.connectionmanager/getStatus',{}));}
  catch{
    if(!allowHomebrew)throw Error('Connection details are unavailable. Open Wi-Fi & network settings, or enable Homebrew in Apps & inputs on a rooted TV.');
    // Fixed read-only command: no network names, passwords or user values enter a shell.
    try{const result=await lunaCall<LunaResponse&{stdoutString?:string}>(LUNA.homebrewExec,{command:"luna-send -n 1 -w 5000 luna://com.webos.service.connectionmanager/getStatus '{}'"},8000);return networkSnapshot(JSON.parse(result.stdoutString||''));}
    catch{throw Error('Connection details are unavailable. Try Refresh or open Wi-Fi & network settings.');}
  }
}
/** Route checked on an LG C2 running webOS 24; other firmware may differ. LG handles network selection and passwords. */
export async function openNetworkSettings():Promise<void>{
  if(!isWebOS())return;
  try{await launchApp('com.palm.app.settings',{target:'general',item:'network'});}
  catch{await launchApp('com.palm.app.settings');}
}

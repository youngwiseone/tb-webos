import {lunaCall,isWebOS,type LunaResponse} from './luna';
import {LUNA} from '../config/constants';

export const PICTURE_CONTROLS = [
  {key:'backlight',label:'OLED pixel brightness',help:'Controls the light output of the OLED panel. Energy Saving can also affect brightness.'},
  {key:'brightness',label:'Black level',help:'Adjusts darker parts of the picture. This is LG’s Brightness control; OLED pixel brightness changes the overall light output.'},
  {key:'contrast',label:'Contrast',help:'Adjusts the difference between bright and dark areas.'},
  {key:'color',label:'Colour depth',help:'Adjusts the strength of colours.'},
  {key:'sharpness',label:'Sharpness',help:'Adjusts edge enhancement and fine detail.'},
  {key:'colorTemperature',label:'Colour temperature',help:'Shifts the picture between warmer and cooler tones. Some picture modes lock this setting.'}
] as const;
export type PictureKey = typeof PICTURE_CONTROLS[number]['key'];
export interface PictureContext {input?:string;pictureMode?:string;dynamicRange?:string;}
export interface PictureControl {key:PictureKey;label:string;help:string;value:number;min:number;max:number;step:number;active:boolean;}
export interface PictureSnapshot {context:PictureContext;controls:PictureControl[];}
interface SettingsReply extends LunaResponse {settings?:Record<string,unknown>;dimension?:PictureContext;}
interface Descriptor {key:string;ui?:{active?:boolean;visible?:boolean};values?:{range?:{min:number;max:number;interval?:number}};}
interface DescReply extends LunaResponse {results?:Descriptor[];}

export function cleanPictureContext(value:unknown):PictureContext {
  const out:PictureContext={};
  if(!value||typeof value!=='object')return out;
  for(const key of ['input','pictureMode','dynamicRange'] as const){const v=(value as Record<string,unknown>)[key];if(typeof v==='string'&&/^[A-Za-z0-9_:-]{1,40}$/.test(v))out[key]=v;}
  return out;
}

/** Only these two fixed settings APIs and validated picture values reach the root shell. */
async function pictureCall<T extends LunaResponse>(method:'getSystemSettings'|'getSystemSettingDesc'|'setSystemSettings',payload:object):Promise<T>{
  const params=JSON.stringify(payload).replace(/'/g,"'\\''");
  const command=`luna-send -n 1 -w 5000 luna://com.webos.settingsservice/${method} '${params}'`;
  let result:LunaResponse&{stdoutString?:string};
  try{result=await lunaCall<LunaResponse&{stdoutString?:string}>(LUNA.homebrewExec,{command},8000);}catch{throw Error('Picture controls are unavailable. Try Refresh or open All LG settings.');}
  let data:T;
  try{data=JSON.parse(result.stdoutString||'') as T;}catch{throw Error('The TV did not return picture settings. Try Refresh.');}
  if(data.returnValue===false)throw Error('The TV could not apply this request. The picture mode may lock this setting.');
  return data;
}

export async function readPicture(context:PictureContext={}):Promise<PictureSnapshot>{
  if(!isWebOS())return {context:{input:'default',pictureMode:'eco',dynamicRange:'sdr'},controls:PICTURE_CONTROLS.map((c,i)=>({...c,value:[80,50,100,60,25,20][i],min:c.key==='colorTemperature'?-50:0,max:c.key==='sharpness'||c.key==='colorTemperature'?50:100,step:1,active:c.key!=='colorTemperature'}))};
  const input=cleanPictureContext(context);
  // Resolve the selected input's current mode, rather than copying the launcher's mode.
  delete input.pictureMode;
  const mode=await pictureCall<SettingsReply>('getSystemSettings',{category:'picture',keys:['pictureMode'],...(Object.keys(input).length?{dimension:input}:{})});
  const current=cleanPictureContext({...mode.dimension,...input,pictureMode:mode.settings?.pictureMode});
  const profile={input:current.input,pictureMode:current.pictureMode};
  const keys=PICTURE_CONTROLS.map(c=>c.key);
  const [values,descriptions]=await Promise.all([
    pictureCall<SettingsReply>('getSystemSettings',{category:'picture',keys,dimension:profile}),
    pictureCall<DescReply>('getSystemSettingDesc',{category:'picture',keys})
  ]);
  const controls:PictureControl[]=[];
  for(const definition of PICTURE_CONTROLS){
    const raw=values.settings?.[definition.key];
    const desc=descriptions.results?.find(d=>d.key===definition.key),range=desc?.values?.range;
    const value=Number(raw);
    if(raw===undefined||!range||!Number.isFinite(value)||desc?.ui?.visible===false)continue;
    if(range.min< -50||range.max>100||range.min>=range.max)continue;
    controls.push({...definition,value,min:range.min,max:range.max,step:Math.max(1,range.interval||1),active:desc?.ui?.active!==false});
  }
  if(!controls.length)throw Error('Picture controls are unavailable. Open LG Settings for this input.');
  return {context:current,controls};
}

export async function writePicture(control:PictureControl,value:number,context:PictureContext):Promise<number>{
  if(!PICTURE_CONTROLS.some(c=>c.key===control.key)||!control.active||!Number.isFinite(value)||!Number.isInteger(value)||value<control.min||value>control.max)throw Error('That picture adjustment is unavailable.');
  if(!isWebOS())return value;
  const cleaned=cleanPictureContext(context);
  const dimension={input:cleaned.input,pictureMode:cleaned.pictureMode};
  await pictureCall('setSystemSettings',{category:'picture',dimension,settings:{[control.key]:value},notify:true});
  const checked=await pictureCall<SettingsReply>('getSystemSettings',{category:'picture',dimension,keys:[control.key]});
  const actual=Number(checked.settings?.[control.key]);
  if(!Number.isFinite(actual))throw Error('The TV could not confirm the change. Refresh to check it.');
  return actual;
}

const MODES:Record<string,string>={eco:'APS / Eco',normal:'Standard',vivid:'Vivid',cinema:'Cinema',game:'Game Optimiser',filmMaker:'Filmmaker',expert1:'Expert (Bright)',expert2:'Expert (Dark)'};
export function pictureContextLabel(c:PictureContext):string{
  const input=/^hdmi([1-4])$/.exec(c.input||'');
  return [input?`HDMI ${input[1]}`:c.input==='default'?'TV apps':c.input||'Current input',MODES[c.pictureMode||'']||c.pictureMode,c.dynamicRange?.toUpperCase()].filter(Boolean).join(' · ');
}

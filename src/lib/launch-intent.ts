import {cleanPictureContext,type PictureContext} from './picture';
interface Intent {page:'menu'|'picture';startup?:boolean;context?:PictureContext;returnApp?:string;}
export function readLaunchIntent(detail?:unknown):Intent{
  const platform=window as Window&{launchParams?:string;webOSSystem?:{launchParams?:string};PalmSystem?:{launchParams?:string}};
  let data:Record<string,unknown>={};
  try{
    const raw=detail!==undefined?detail:platform.webOSSystem?.launchParams||platform.PalmSystem?.launchParams||platform.launchParams||'{}';
    const parsed=typeof raw==='string'?JSON.parse(raw):raw;
    if(parsed&&typeof parsed==='object')data=parsed as Record<string,unknown>;
  }catch{/* A normal Home launch needs no parameters. */}
  if(data.page!=='picture')return {page:'menu',...(data.tbStartup===true?{startup:true}:{})};
  const context=cleanPictureContext(data.pictureContext);
  return {page:'picture',...(Object.keys(context).length?{context}:{}),...(typeof data.returnApp==='string'&&/^[A-Za-z0-9._-]{1,120}$/.test(data.returnApp)&&data.returnApp!=='com.tb.weboslauncher'?{returnApp:data.returnApp}:{})};
}

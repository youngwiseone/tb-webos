import {isWebOS,lunaCall} from './luna';

const POWER='luna://com.webos.service.tvpower/power/';
const CLIENT='com.tb.weboslauncher';

// Participate in the TV's screensaver handshake only while our own view is visible.
// Cancelling the subscription releases the client; no persistent TV setting changes.
export function maintainStandby():()=>void {
  if(!isWebOS())return ()=>undefined;
  let stopped=false;
  let subscription:InstanceType<NonNullable<typeof window.PalmServiceBridge>>|undefined;
  const healthy=()=>{
    if(stopped||document.hidden)return false;
    const stage=document.querySelector('.ps-stage');
    if(!stage)return false;
    return !stage.classList.contains('is-idle')||['.ps-idle-shade','.ps-idle-lights','.ps-idle-caption'].every(selector=>document.querySelector(selector)?.getAnimations().some(a=>a.playState==='running'));
  };
  const release=()=>{const old=subscription;subscription=undefined;try{old?.cancel?.();}catch{/* Already disconnected. */}};
  const connect=()=>{
    if(!healthy()){release();return;}
    if(subscription)return;
    const bridge=new window.PalmServiceBridge!();subscription=bridge;
    bridge.onservicecallback=message=>{
      if(subscription!==bridge)return;
      try{
        const request=JSON.parse(message);
        if(request.returnValue===false){release();return;}
        if(typeof request.timestamp!=='string'&&typeof request.timestamp!=='number')return;
        const ack=!healthy();
        // false = our custom standby is handling idle; true = allow LG's screensaver.
        void lunaCall(POWER+'responseScreenSaverRequest',{clientName:CLIENT,ack,timestamp:request.timestamp},3000)
          .catch(()=>release()).finally(()=>{if(ack)release();});
      }catch{release();}
    };
    try{bridge.call(POWER+'registerScreenSaverRequest',JSON.stringify({clientName:CLIENT,subscribe:true}));}catch{release();}
  };
  connect();
  const timer=window.setInterval(connect,5000);
  document.addEventListener('visibilitychange',connect);
  const close=()=>{stopped=true;release();};
  window.addEventListener('pagehide',close);
  return()=>{close();clearInterval(timer);document.removeEventListener('visibilitychange',connect);window.removeEventListener('pagehide',close);};
}

import type {TileModel} from './Tile';
import {useEffect,useState} from 'preact/hooks';
import {memo} from 'preact/compat';

const LABELS: Record<string, string> = {
  'youtube.leanback.v4': 'linear-gradient(140deg,#ef434e,#b61536)',
  'com.crunchyroll.webapp': 'linear-gradient(140deg,#ffbd73,#e68039)',
  netflix: 'linear-gradient(140deg,#252b39,#080c15)',
  'nz.co.tvnz.xdk.prod': 'linear-gradient(140deg,#d8ec8e,#a6bc62)',
  'com.limelight.webos': 'linear-gradient(140deg,#c2e9ff,#679cdd)',
  'tv.twitch.tv.starshot.lg': 'linear-gradient(140deg,#b58aff,#7739d7)'
};

export function MenuSymbol ({name}: {name: 'browser' | 'config' | 'friends' | 'home'}) {
  return <svg class="ps-symbol" viewBox="0 0 40 40" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true">
    {name === 'browser' ? <><path d="M9 5h22v30H9zM13 9h14M13 12h14M13 16h14v11H13zM14 31h12"/><path d="M16 20h8M16 23h5"/></>
      : name === 'config' ? <><path d="m23 5-4 9-8 6-5 11 4 4 10-6 6-8 9-4-9-2z"/><circle cx="12" cy="28" r="2"/></>
      : name === 'friends' ? <><circle cx="20" cy="20" r="9"/><circle cx="7" cy="9" r="3"/><circle cx="33" cy="11" r="3"/><circle cx="20" cy="35" r="3"/><path d="m9 11 5 4m16-2-4 3m-6 13v3"/></>
      : <path d="m5 18 15-12 15 12M10 16v18h20V16M17 34V23h6v11"/>}
  </svg>;
}

function MemoryCardView ({item, input = false, mini = false}: {item: TileModel; input?: boolean; mini?: boolean}) {
  const [imageFailed,setImageFailed]=useState(false);
  useEffect(()=>setImageFailed(false),[item.imageUrl]);
  const port = item.port || item.key.replace('com.webos.app.hdmi', '');
  return <div class={`ps-memory-card ${input ? 'is-input' : ''} ${mini ? 'is-mini' : ''}`} aria-hidden="true">
    <div class="ps-card-contacts"><i/><i/><i/><i/><i/><i/></div>
    <div class="ps-card-ridges"/>
    <div class={`ps-card-label ${item.key === 'netflix' ? 'is-dark' : ''}`} style={LABELS[item.key] ? {background: LABELS[item.key]} : undefined}>
      <span class="ps-card-label-top">{input ? 'EXTERNAL INPUT' : 'MEMORY CARD'}</span>
      {input ? <div class="ps-hdmi-label"><span>HDMI</span><strong>{port}</strong></div>
        : item.imageUrl && !imageFailed ? <img src={item.imageUrl} alt="" onError={()=>setImageFailed(true)}/>
          : <strong class="ps-card-wordmark">{item.label}</strong>}
      <span class="ps-card-label-bottom">{input ? 'DIGITAL CONNECTION' : 'PERSONAL ENTERTAINMENT'}</span>
    </div>
    <div class="ps-card-emboss"><span>TB</span><i/></div><div class="ps-card-screw left"/><div class="ps-card-screw right"/>
  </div>;
}
export const MemoryCard=memo(MemoryCardView);

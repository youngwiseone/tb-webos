/** Use vectors instead of Unicode: the TV has fewer fallback glyphs than desktop Chrome. */
export function RemoteHint ({kind}: {kind:'directions'|'back'}) {
  return <svg class="ps-remote-symbol" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    {kind==='directions'?<><path d="M12 3v18M3 12h18M9 6l3-3 3 3M9 18l3 3 3-3M6 9l-3 3 3 3M18 9l3 3-3 3"/></>:<path d="m9 5-5 5 5 5M4 10h9a6 6 0 0 1 0 12h-2"/>}
  </svg>;
}

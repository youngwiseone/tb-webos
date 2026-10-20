/** Original SVG lettering and animation, inspired by the handheld's rainbow-to-blue reveal. */
export function GbaBootScene({greeting}:{greeting:string}) {
  return <div class="tb-gba-scene" aria-label={greeting}>
    <div class="tb-gba-logo">
      <svg class="tb-gba-wordmark" viewBox="0 0 1600 340" role="img" aria-label={greeting}>
        <defs><linearGradient id="tb-gba-colour" x1="0" y1="0" x2="1" y2=".2"><stop offset="0" stop-color="#ed4a74"/><stop offset=".23" stop-color="#edb343"/><stop offset=".45" stop-color="#5cbd84"/><stop offset=".67" stop-color="#4d9bd6"/><stop offset="1" stop-color="#7456ba"/></linearGradient></defs>
        <g class="tb-gba-letters" font-family="'Inter Variable',Arial,sans-serif" font-weight="900" font-style="italic" font-size="164" letter-spacing="-8" text-anchor="middle">
          <text x="800" y="220" textLength="1390" lengthAdjust="spacingAndGlyphs" class="tb-gba-depth">{greeting}</text>
          <text x="800" y="210" textLength="1390" lengthAdjust="spacingAndGlyphs" fill="url(#tb-gba-colour)">{greeting}</text>
          <text x="800" y="210" textLength="1390" lengthAdjust="spacingAndGlyphs" class="tb-gba-blue">{greeting}</text>
          <path class="tb-gba-glint" d="M1345 104v38m-19-19h38" fill="none" stroke="#fff" stroke-width="6"/>
        </g>
      </svg>
      <div class="tb-gba-signature">TB</div>
    </div>
  </div>;
}

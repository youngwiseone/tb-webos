import {useCallback, useState} from 'preact/hooks';
import type {TileModel} from '../components/Tile';
import {Glyph} from '../components/Glyph';
import {useKeys, clamp, type NavKey} from '../hooks/useKeys';
import {useClock} from '../hooks/useClock';
import {useTimeFormat} from '../hooks/useTimeFormat';
import {dateText, dayName, timeParts} from '../lib/clock';

export interface HomeRow { id: string; label: string; items: TileModel[]; emptyText?: string; }
interface Props { rows: HomeRow[]; active: boolean; onActivate: (rowId: string, item: TileModel) => void; }

export function Home ({rows, active, onActivate}: Props) {
  const now = useClock();
  const format = useTimeFormat();
  const {time, period} = timeParts(now, format);
  const apps = rows.find((r) => r.id === 'apps');
  const sources = rows.find((r) => r.id === 'sources');
  const misc = rows.find((r) => r.id === 'misc');
  const [area, setArea] = useState<'apps' | 'controls' | 'inputs'>('apps');
  const [appIndex, setAppIndex] = useState(0);
  const [controlIndex, setControlIndex] = useState(0);
  const [inputIndex, setInputIndex] = useState(0);
  const appItems = apps ? apps.items : [];
  const inputItems = sources ? sources.items : [];
  const selectedApp = clamp(appIndex, 0, Math.max(0, appItems.length - 1));
  const selectedInput = clamp(inputIndex, 0, Math.max(0, inputItems.length - 1));
  const openControl = (index: number) => {
    if (index === 0) { setArea('inputs'); return; }
    const key = index === 1 ? 'lg-home' : 'settings';
    const item = misc && misc.items.find((i) => i.key === key);
    if (item) onActivate('misc', item);
  };
  const handleKey = useCallback((key: NavKey): boolean => {
    if (key === 'back') { setArea('apps'); return true; }
    if (area === 'controls') {
      if (key === 'left') setControlIndex((i) => clamp(i - 1, 0, 2));
      if (key === 'right') setControlIndex((i) => clamp(i + 1, 0, 2));
      if (key === 'down') setArea('apps');
      if (key === 'enter') openControl(controlIndex);
    } else if (area === 'apps') {
      if (key === 'left') setAppIndex((i) => clamp(i - 1, 0, Math.max(0, appItems.length - 1)));
      if (key === 'right') setAppIndex((i) => clamp(i + 1, 0, Math.max(0, appItems.length - 1)));
      if (key === 'up') setArea('controls');
      if (key === 'down') setArea('inputs');
      if (key === 'enter' && appItems[selectedApp]) onActivate('apps', appItems[selectedApp]);
    } else {
      if (key === 'left') setInputIndex((i) => clamp(i - 1, 0, Math.max(0, inputItems.length - 1)));
      if (key === 'right') setInputIndex((i) => clamp(i + 1, 0, Math.max(0, inputItems.length - 1)));
      if (key === 'up') setArea('apps');
      if (key === 'enter' && inputItems[selectedInput]) onActivate('sources', inputItems[selectedInput]);
    }
    return true;
  }, [area, appItems, inputItems, selectedApp, selectedInput, controlIndex, misc, onActivate]);
  useKeys(handleKey, active);

  const offset = Math.min(Math.max(0, selectedApp - 1), Math.max(0, appItems.length - 4)) * 380;
  const inputOffset = Math.min(Math.max(0, selectedInput - 2), Math.max(0, inputItems.length - 5)) * 300;
  return (
    <div class="screen frieren-home">
      <div class="journey-clock">
        <div class="journey-eyebrow">FRIEREN · BEYOND JOURNEY'S END</div>
        <div class="journey-time">{time}<span>{period}</span></div>
        <div class="journey-date">{dayName(now)}<i />{dateText(now)}</div>
      </div>
      <nav class="journey-controls" aria-label="TV controls">
        {(['Inputs', 'LG Home', 'Settings'] as const).map((label, i) => (
          <button key={label} class={`journey-pill${area === 'controls' && controlIndex === i ? ' is-focused' : ''}`}
            onMouseEnter={() => { setArea('controls'); setControlIndex(i); }} onClick={() => openControl(i)}>
            <Glyph name={i === 0 ? 'hdmi' : i === 1 ? 'house' : 'gear'} /><span>{label}</span>
          </button>
        ))}
      </nav>
      <div class="journey-app-title">{area === 'inputs' ? 'Choose your input' : appItems[selectedApp] ? appItems[selectedApp].label : 'Your favourites'}</div>
      <section class="journey-dock" aria-label={area === 'inputs' ? 'Inputs' : 'Favourite apps'}>
        <div class="journey-dock-viewport">
          {area === 'inputs' ? (
            <div class="journey-inputs" style={{transform: `translateX(-${inputOffset}px)`}}>
              {inputItems.map((item, i) => (
                <button key={item.key} class={`journey-input${selectedInput === i ? ' is-focused' : ''}`}
                  onMouseEnter={() => setInputIndex(i)} onClick={() => onActivate('sources', item)}>
                  <Glyph name={item.glyph || 'hdmi'} /><span>{item.label}</span>
                </button>
              ))}
              {!inputItems.length && <p class="journey-empty">No inputs available. Press Back to return.</p>}
            </div>
          ) : (
            <div class="journey-app-track" style={{transform: `translateX(-${offset}px)`, justifyContent: appItems.length <= 4 ? 'center' : 'flex-start'}}>
              {appItems.map((item, i) => (
                <button key={item.key} data-app={item.key} class={`journey-app${area === 'apps' && selectedApp === i ? ' is-focused' : ''}`}
                  style={{backgroundColor: item.color || 'rgba(26, 22, 40, .8)'}}
                  onMouseEnter={() => { setArea('apps'); setAppIndex(i); }} onClick={() => onActivate('apps', item)}>
                  {item.imageUrl ? <img src={item.imageUrl} alt={item.label} /> : <span class="journey-app-wordmark">{item.label}</span>}
                  {item.imageUrl && <span class="journey-app-caption">{item.label}</span>}
                </button>
              ))}
              {!appItems.length && <p class="journey-empty">Choose your favourite apps in Settings.</p>}
            </div>
          )}
        </div>
      </section>
      <div class="journey-hint">{area === 'inputs' ? '↑  Favourites     ·     Back  Return' : '↑  Controls     ·     ↓  Inputs     ·     OK  Open'}</div>
    </div>
  );
}

import {useEffect, useRef} from 'preact/hooks';
import {memo} from 'preact/compat';
import {orbitPoint} from '../lib/orbit';

export function CrystalOrbit ({angle = 0, large = false, ambient = false, active = true}: {angle?: number; large?: boolean; ambient?: boolean; active?: boolean}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const elapsed = useRef(0);
  const clock = useRef(angle);clock.current = angle;
  useEffect(() => {
    const canvas = ref.current;if (!canvas || !active) return;
    const ctx = canvas.getContext('2d');if (!ctx) return;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    let frame = 0;let previous = 0;
    // One reusable glow texture instead of eight radial gradients on every frame.
    const glow=document.createElement('canvas');glow.width=96;glow.height=96;
    const sprite=glow.getContext('2d')!;
    const gradient=sprite.createRadialGradient(48,48,0,48,48,48);
    gradient.addColorStop(0,'#e8fcff');gradient.addColorStop(.09,'#b5e9ff');gradient.addColorStop(.22,'#57b9ffb0');gradient.addColorStop(.48,'#287eff45');gradient.addColorStop(1,'#1b62e000');
    sprite.fillStyle=gradient;sprite.fillRect(0,0,96,96);
    const draw = () => {
      const time=elapsed.current;
      const size = canvas.width;ctx.clearRect(0, 0, size, canvas.height);ctx.globalCompositeOperation = 'lighter';
      const project = (p:{x:number;y:number},i:number,t:number) => ambient
        ? {x:960+p.x*540+Math.sin(t*.055+i*.28)*220,y:540+p.y*260+Math.cos(t*.071+i*.31)*135}
        : {x:size/2+p.x*size*.46,y:size/2+p.y*size*.46};
      const lights = Array.from({length:8}, (_, i) => ({i, ...orbitPoint(i, time, clock.current)})).sort((a, b) => a.z - b.z);
      for (const light of lights) {
        const depth = (light.z + 1) / 2;
        const radius = 7 + depth * 6;
        // Tails follow the actual path, rather than a decorative ring.
        if (!reduced.matches) for (let n = 12; n > 0; n--) {
          const p = orbitPoint(light.i, time - n * 0.045, clock.current);
          const point=project(p,light.i,time-n*.045);
          ctx.beginPath();ctx.arc(point.x,point.y,radius*(1-n/15),0,Math.PI*2);
          ctx.fillStyle = `rgba(78,158,255,${(1-n/13)*0.045*(0.5+depth)})`;ctx.fill();
        }
        const {x,y}=project(light,light.i,time);
        ctx.globalAlpha=.8+depth*.2;ctx.drawImage(glow,x-radius*3,y-radius*3,radius*6,radius*6);ctx.globalAlpha=1;
      }
    };
    const tick = (now: number) => {
      if (now - previous >= 33) {elapsed.current += previous ? Math.min((now-previous)/1000,.05) : 0;if(!ambient||Number(getComputedStyle(canvas.parentElement!.parentElement!).opacity)>.001)draw();previous = now;}
      if (!reduced.matches && !document.hidden) frame = requestAnimationFrame(tick);
    };
    const resume = () => {cancelAnimationFrame(frame);previous = 0;if (!document.hidden) {draw();if (!reduced.matches) frame = requestAnimationFrame(tick);}};
    resume();document.addEventListener('visibilitychange', resume);reduced.addEventListener('change', resume);
    return () => {cancelAnimationFrame(frame);document.removeEventListener('visibilitychange', resume);reduced.removeEventListener('change', resume);};
  }, [active]);
  return <div class={`ps-orbit ${large ? 'is-large' : ''} ${ambient?'is-ambient':''}`} aria-hidden="true"><canvas ref={ref} width={ambient?1920:540} height={ambient?1080:540} class="ps-orbit-canvas"/></div>;
}

export function Towers ({boot = false}: {boot?: boolean}) {
  return <div class={`ps-tower-scene ${boot ? 'is-boot' : ''}`} aria-hidden="true"><div class="ps-tower-floor"/>{Array.from({length:17},(_,i)=><div class="ps-tower" style={{left:`${(i * 137 % 106) - 3}%`, height:`${80 + (i * 83 % 285)}px`, width:`${24 + i % 4 * 10}px`, animationDelay:`${-i * 1.1}s`, opacity:0.15 + i % 3 * 0.12}}><i/><b/><span/></div>)}</div>;
}

function AtmosphereScene ({image, fade, imageFailed}: {image: string; fade: number; imageFailed: boolean}) {
  return <><div class="ps-background"/>{image && !imageFailed && <div class="ps-wallpaper" style={{backgroundImage:`url(${JSON.stringify(image)})`,opacity:1-fade/100}}/>}<div class="ps-haze"/><div class="ps-stars" aria-hidden="true">{Array.from({length:26},(_,i)=><i style={{left:`${(i * 73) % 100}%`,top:`${(i * 41) % 91}%`,animationDelay:`${-i * 0.6}s`}}/>)}</div><Towers/><div class="ps-vignette"/></>;
}

export const Atmosphere=memo(AtmosphereScene);

export {BootScene} from './BootScene';

import {useEffect,useRef} from 'preact/hooks';

type V={x:number;y:number;z:number};
const clamp=(n:number)=>Math.max(0,Math.min(1,n));
const smooth=(a:number,b:number,t:number)=>{const p=clamp((t-a)/(b-a));return p*p*(3-2*p);};
const noise=(n:number)=>{const v=Math.sin(n*127.1+311.7)*43758.5453;return v-Math.floor(v);};

/** Solid projected boxes avoid the TV compositor's nested CSS-3D face fragmentation. */
export function BootScene({running}:{running:boolean}){
  const ref=useRef<HTMLCanvasElement>(null);
  useEffect(()=>{
    const canvas=ref.current,ctx=canvas?.getContext('2d',{alpha:false});if(!canvas||!ctx)return;
    const reduced=matchMedia('(prefers-reduced-motion: reduce)');
    const cloud=document.createElement('canvas');cloud.width=960;cloud.height=420;
    const fog=cloud.getContext('2d')!;
    for(let i=0;i<34;i++){
      const x=noise(i+1)*1100-70,y=noise(i+70)*420,r=95+noise(i+110)*150;
      const g=fog.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,`rgba(148,171,193,${.12+noise(i+160)*.14})`);g.addColorStop(.45,'rgba(91,119,149,.07)');g.addColorStop(1,'rgba(60,87,120,0)');
      fog.fillStyle=g;fog.fillRect(x-r,y-r,r*2,r*2);
    }
    // Feather all texture edges so moving fog never reveals a rectangular sheet.
    fog.globalCompositeOperation='destination-in';
    const vertical=fog.createLinearGradient(0,0,0,420);vertical.addColorStop(0,'#0000');vertical.addColorStop(.22,'#000');vertical.addColorStop(.78,'#000');vertical.addColorStop(1,'#0000');fog.fillStyle=vertical;fog.fillRect(0,0,960,420);
    const horizontal=fog.createLinearGradient(0,0,960,0);horizontal.addColorStop(0,'#0000');horizontal.addColorStop(.15,'#000');horizontal.addColorStop(.85,'#000');horizontal.addColorStop(1,'#0000');fog.fillStyle=horizontal;fog.fillRect(0,0,960,420);
    const columns=Array.from({length:35},(_,i)=>({x:(i%7-3)*2.9+(noise(i+20)-.5)*.7,z:Math.floor(i/7)*3.4+noise(i+50),h:1.4+noise(i+90)*5.2,w:.7+noise(i+150)*.4}));
    const paint=(elapsed:number)=>{
      const t=clamp(elapsed/5200),travel=smooth(0,.83,t),camera={x:-1.7+travel*1.5,y:12-travel*3.6,z:-18+travel*10};
      const pitch=.43-travel*.1,yaw=.035-travel*.025,cp=Math.cos(pitch),sp=Math.sin(pitch),cy=Math.cos(yaw),sy=Math.sin(yaw);
      const project=(p:V)=>{const x=p.x-camera.x,y=p.y-camera.y,z=p.z-camera.z;const rx=x*cy-z*sy,rz=x*sy+z*cy,ry=y*cp+rz*sp,depth=rz*cp-y*sp;return {x:960+rx*1080/depth,y:510-ry*1080/depth,depth};};
      const sky=ctx.createLinearGradient(0,0,0,1080);sky.addColorStop(0,'#03080f');sky.addColorStop(.56,'#172b40');sky.addColorStop(1,'#02070f');ctx.fillStyle=sky;ctx.fillRect(0,0,1920,1080);
      ctx.globalAlpha=.55;ctx.drawImage(cloud,-200+Math.sin(t*1.4)*180,30-t*55,2320,800);ctx.globalAlpha=1;
      const horizon=ctx.createRadialGradient(980,560,20,980,560,900);horizon.addColorStop(0,'#71829440');horizon.addColorStop(.5,'#34537022');horizon.addColorStop(1,'#06112100');ctx.fillStyle=horizon;ctx.fillRect(0,0,1920,1080);
      const faces:{points:ReturnType<typeof project>[];depth:number;color:number[]}[]=[];
      for(const c of columns){
        const x=c.x,z=c.z,w=c.w,h=c.h;
        const vertices=[{x:x-w,y:0,z:z-w},{x:x+w,y:0,z:z-w},{x:x+w,y:h,z:z-w},{x:x-w,y:h,z:z-w},{x:x-w,y:0,z:z+w},{x:x+w,y:0,z:z+w},{x:x+w,y:h,z:z+w},{x:x-w,y:h,z:z+w}];
        for(const [ids,color] of [ [[0,1,2,3],[100,119,137]], [camera.x<x?[4,0,3,7]:[1,5,6,2],[43,62,82]], [[3,2,6,7],[165,184,201]] ] as [number[],number[]][]){
          const points=ids.map(i=>project(vertices[i]));if(points.some(p=>p.depth<1))continue;
          faces.push({points,depth:points.reduce((sum,p)=>sum+p.depth,0)/4,color});
        }
      }
      const fieldFade=smooth(0,.12,t)*(1-smooth(.48,.83,t));
      ctx.globalAlpha=fieldFade;ctx.lineJoin='round';
      for(const face of faces.sort((a,b)=>b.depth-a.depth)){
        const mist=clamp((face.depth-8)/45)*.75;
        const color=face.color.map((c,i)=>Math.round(c*(1-mist)+[28,45,64][i]*mist));ctx.fillStyle=`rgb(${color.join(',')})`;ctx.strokeStyle=ctx.fillStyle;ctx.lineWidth=.8;
        ctx.beginPath();face.points.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();ctx.fill();ctx.stroke();
      }
      // Separate near/far cloud sheets pass in front of the solid field.
      ctx.globalAlpha=.45+Math.sin(t*Math.PI)*.22;ctx.drawImage(cloud,-300+t*390,380-t*90,2530,720);
      ctx.globalAlpha=.23;ctx.drawImage(cloud,120-t*260,-100+t*75,2200,830);ctx.globalAlpha=1;
      const light=smooth(.2,.57,t)*(1-smooth(.82,1,t));
      if(light>0){
        const radius=100+t*390,g=ctx.createRadialGradient(960,480,0,960,480,radius);g.addColorStop(0,`rgba(227,251,255,${light*.9})`);g.addColorStop(.08,`rgba(128,206,255,${light*.68})`);g.addColorStop(.3,`rgba(54,123,215,${light*.36})`);g.addColorStop(1,'rgba(22,72,155,0)');ctx.fillStyle=g;ctx.fillRect(960-radius,480-radius,radius*2,radius*2);
        const beam=ctx.createLinearGradient(300,0,1620,0);beam.addColorStop(0,'#6fb5ff00');beam.addColorStop(.5,`rgba(172,229,255,${light*.4})`);beam.addColorStop(1,'#6fb5ff00');ctx.fillStyle=beam;ctx.fillRect(300,479,1320,2);
      }
      const vignette=ctx.createRadialGradient(960,500,220,960,500,1120);vignette.addColorStop(0,'#00000000');vignette.addColorStop(1,'#00060dd9');ctx.fillStyle=vignette;ctx.fillRect(0,0,1920,1080);
    };
    let frame=0,start=0,previous=-100;
    const tick=(now:number)=>{if(document.hidden)return;if(!start)start=now;if(now-previous>=33){paint(reduced.matches?2200:now-start);previous=now;}if(now-start<5200)frame=requestAnimationFrame(tick);};
    paint(reduced.matches?2200:0);
    if(running)frame=requestAnimationFrame(tick);
    return()=>cancelAnimationFrame(frame);
  },[running]);
  return <canvas ref={ref} class="ps-boot-canvas" width="1920" height="1080" aria-hidden="true"/>;
}

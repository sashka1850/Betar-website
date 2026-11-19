import {art} from './art.js';
import {home,StudioMotion} from './motion.js';
import {readingAt,drawReading} from './displays.js';

export function createStudio(){
  const scene=document.querySelector("#scene"),plate=document.querySelector("#plate");
  const reduce=matchMedia("(prefers-reduced-motion: reduce)");
  const compact=matchMedia("(max-width:740px)");
  const motion=new StudioMotion(),models={};
  const started=performance.now();
  let metrics,raf=0,timer=0;

  function schedule(){
    clearTimeout(timer);
    if(!document.hidden&&!raf)raf=requestAnimationFrame(draw);
  }
  function measure(){
    const {width,height}=scene.getBoundingClientRect();
    const crop=compact.matches?515:0,sx=width/(1753-crop),sy=height/697;
    const size=Math.min(sx*1.075,sy*1.08,Math.sqrt(sx*sy));
    metrics={width,crop,sx,sy,size};
    plate.style.width=(1753*sx)+"px";plate.style.left=(-crop*sx)+"px";schedule();
  }
  function load(url,onReady){
    const image=new Image();image.decoding="async";
    image.onload=()=>{onReady(image);schedule()};image.src="./assets/"+url;
  }
  for(const [id,asset] of Object.entries(art)){
    const el=document.querySelector("#actor-"+id),base=el.querySelector("img"),canvas=el.querySelector("canvas");
    const [width,height]=asset.size;const ctx=canvas.getContext("2d");
    const dpr=Math.min(2,window.devicePixelRatio||1);
    canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);
    ctx.setTransform(canvas.width/width,0,0,canvas.height/height,0,0);ctx.imageSmoothingQuality="high";
    const anchor=[home[id].x-asset.bounds[0],home[id].y+76-asset.bounds[1]];
    el.style.width=width+"px";el.style.height=height+"px";
    el.style.setProperty("--foot-y",anchor[1]+"px");el.style.setProperty("--shadow",(id==="water"?134:width*.72)+"px");
    const model={id,asset,el,ctx,base,width,height,anchor,last:""};
    models[id]=model;base.addEventListener("load",schedule);
    if(asset.selected){
      load(asset.selected.sheet,image=>{model.sheet=image;model.last=""});
      load(asset.selected.file,image=>{model.end=image;model.last=""});
    }
  }
  function paint(m,turn,r){
    if(!m.base.complete||!m.base.naturalWidth)return;
    const {width,height,asset,ctx}=m, alt=asset.selected;
    const frame=alt?Math.round(turn*(alt.count-1)):0;
    const key=frame+"/"+r.whole+"/"+Math.round(r.roll*50);
    if(key===m.last)return;
    m.last=key;ctx.clearRect(0,0,width,height);
    let quad=asset.digitQuad;
    if(frame&&m.sheet){
      const col=frame%alt.columns,row=Math.floor(frame/alt.columns);
      ctx.drawImage(m.sheet,col*width,row*height,width,height,0,0,width,height);
      quad=alt.frames[frame];
    }else if(frame>8&&m.end){
      ctx.drawImage(m.end,0,0,width,height);quad=alt.digitQuad;
    }else ctx.drawImage(m.base,0,0,width,height);
    drawReading(ctx,m.id,quad,r);m.el.classList.add("painted");
  }
  function draw(now){
    raf=0;if(!metrics||document.hidden)return;
    const moving=motion.sample(now);
    const {width,crop,sx,sy,size}=metrics;
    for(const [id,m] of Object.entries(models)){
      const a=motion.actors[id],{x,y,turn}=a.position;
      const footX=id==="water"?m.anchor[0]+(133-m.anchor[0])*turn:m.anchor[0];
      const left=(x-crop)*sx-footX*size,top=y*sy-m.anchor[1]*size;
      const r=readingAt(id,Math.max(0,now-started),reduce.matches);
      m.el.dataset.reading=r.value;
      m.el.style.setProperty("--foot-x",footX+"px");
      m.el.style.transform=`translate3d(${left}px,${top}px,0) scale(${size})`;
      m.el.hidden=a.hidden||left+m.width*size < -2||left > width+2;
      m.el.style.visibility="visible";
      if(!m.el.hidden)paint(m,turn,r);
    }
    if(moving)schedule();else timer=setTimeout(schedule,reduce.matches?200:75);
  }
  function select(id){
    motion.select(id,performance.now(),reduce.matches);
    for(const [key,m] of Object.entries(models))m.el.style.zIndex=key===id?3:key==="gas"?2:1;
    schedule();
  }
  new ResizeObserver(measure).observe(scene);
  compact.addEventListener("change",measure);reduce.addEventListener("change",()=>select(motion.selection));
  document.addEventListener("visibilitychange",()=>{
    if(document.hidden){clearTimeout(timer);cancelAnimationFrame(raf);raf=0}else schedule();
  });
  measure();return {select};
}

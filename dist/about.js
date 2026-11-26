import {setupAboutIcons} from "./about-icons.js";

const textureUrl="./assets/about-globe.webp";
const section=document.querySelector('#about');
const renderIcons=setupAboutIcons(section);
const globe=document.querySelector('#globe'),routes=document.querySelector('#routes');
const gl=globe.getContext('webgl',{alpha:true,premultipliedAlpha:false,antialias:false});
const ctx=routes.getContext('2d');
const rad=Math.PI/180, lat=43*rad, slow=10, cycle=14;
const origin=[55.37,50.63]; // Chistopol, Republic of Tatarstan.
const v=([a,b])=>[Math.cos(a*rad)*Math.sin(b*rad),Math.sin(a*rad),Math.cos(a*rad)*Math.cos(b*rad)];
const source=v(origin);
// Each burst is a longitude band. Every band has destinations north and
// south of Chistopol, so the fan opens vertically as it moves east.
const routeBands=[
 // Western Russia: Arkhangelsk, Moscow, Kaluga, Bryansk, Voronezh, Belgorod.
 [[64.54,40.54],[55.76,37.62],[54.51,36.26],[53.24,34.36],[51.67,39.20],[50.60,36.59]],
 // Volga and northern European Russia.
 [[61.67,50.83],[59.22,39.88],[54.19,45.18],[53.20,45],[51.53,46.03],[48.71,44.51]],
 // Urals.
 [[67.64,53.01],[61.12,57.08],[58.01,56.25],[56.84,60.61],[53.42,58.98],[51.77,55.10]],
 // Western Siberia.
 [[66.53,66.60],[61.25,73.40],[60.94,76.58],[57.15,65.53],[55.03,82.92],[54.99,73.37]],
 // Central and eastern Siberia.
 [[69.35,88.20],[62.03,129.73],[61.66,113.40],[56.02,92.87],[55.35,86.09],[52.29,104.28]]
].map(band=>band.map(v));
function destination(pass,beat,slot){
 const band=routeBands[beat];
 return band[(slot+pass)%band.length];
}
let width,height,radius,cx,cy,dpr,ready=false;
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
let inView=false, elapsed=0, previous=0, animation=0, painter;

function longitude(time){
  const mobile=width<=720, startLon=mobile?27:19, slowDegrees=mobile?60:89;
  if(time<=slow)return (startLon+slowDegrees*time/slow)*rad;
  const fast=time-slow, span=cycle-slow, t=fast/span, speed=slowDegrees/slow;
  const smooth=t*t*t*(10+t*(-15+6*t));
  return (startLon+slowDegrees+fast*speed+(360-slowDegrees-span*speed)*smooth)*rad;
}
function project(vec,alt,lon){
  const [x,y,z]=vec;
  const right=x*Math.cos(lon)-z*Math.sin(lon);
  const forward=x*Math.sin(lon)+z*Math.cos(lon);
  const up=y*Math.cos(lat)-forward*Math.sin(lat);
  const depth=y*Math.sin(lat)+forward*Math.cos(lat);
  return {x:cx+radius*right*alt,y:cy-radius*up*alt,visible:depth>0};
}
function setup(){
 const shader=(type,source)=>{
  const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);
  if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(s));
  return s;
 };
 const program=gl.createProgram();
 gl.attachShader(program,shader(gl.VERTEX_SHADER,'attribute vec2 pos;void main(){gl_Position=vec4(pos,0.,1.);}'));
 gl.attachShader(program,shader(gl.FRAGMENT_SHADER,`
 precision highp float;
 uniform vec2 center;
 uniform float radius, longitude, pixelRatio;
 uniform sampler2D surface;
 void main(){
  vec2 p=(gl_FragCoord.xy-center)/radius;
  float len=length(p);
  if(len>1.035)discard;
  vec3 glow=vec3(.76,.88,1.);
  if(len>1.){gl_FragColor=vec4(glow,.27*(1.-smoothstep(1.,1.035,len)));return;}
  vec3 n=vec3(p,sqrt(max(0.,1.-dot(p,p))));
  const float latitude=.750491578;
  float y=n.y*cos(latitude)+n.z*sin(latitude);
  float front=n.z*cos(latitude)-n.y*sin(latitude);
  vec2 uv=vec2(fract((atan(n.x,front)+longitude)/6.2831853+.5),.5-asin(clamp(y,-1.,1.))/3.14159265);
  vec3 color=texture2D(surface,uv).rgb;
  float diffuse=max(0.,dot(n,normalize(vec3(-.6,.7,.9))));
  color=mix(color,vec3(.96,.987,1.),.16+diffuse*.40);
  color=mix(color,vec3(.75,.85,.97),pow(1.-n.z,2.)*.50);
  float sheen=pow(max(0.,dot(n,normalize(vec3(-.55,.78,.4)))),25.);
  color+=vec3(.095,.11,.12)*sheen;
  color=mix(color,vec3(.97,.99,1.),pow(1.-n.z,4.)*.78);
  gl_FragColor=vec4(color,.96*(1.-smoothstep(1.-pixelRatio/radius,1.,len)));
 }`));
 gl.linkProgram(program);
 if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(program));
 gl.useProgram(program);
 const slot=name=>gl.getUniformLocation(program,name);
 const [center,size,yaw,ratio]=['center','radius','longitude','pixelRatio'].map(slot);
 const quad=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,quad);
 gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),gl.STATIC_DRAW);
 const pos=gl.getAttribLocation(program,'pos');gl.enableVertexAttribArray(pos);gl.vertexAttribPointer(pos,2,gl.FLOAT,false,0,0);
 const tex=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,tex);
 gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
 gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR_MIPMAP_LINEAR);
 const anisotropy=gl.getExtension('EXT_texture_filter_anisotropic');
 if(anisotropy)gl.texParameterf(gl.TEXTURE_2D,anisotropy.TEXTURE_MAX_ANISOTROPY_EXT,Math.min(8,gl.getParameter(anisotropy.MAX_TEXTURE_MAX_ANISOTROPY_EXT)));
 return {
  load(image){gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,image);gl.generateMipmap(gl.TEXTURE_2D)},
  draw(lon){gl.viewport(0,0,globe.width,globe.height);gl.uniform2f(center,cx*dpr,(height-cy)*dpr);gl.uniform1f(size,radius*dpr);gl.uniform1f(yaw,lon);gl.uniform1f(ratio,dpr);gl.drawArrays(gl.TRIANGLE_STRIP,0,4)}
 };
}
function dot(p,r,alpha=1){
 ctx.globalAlpha=alpha;ctx.beginPath();ctx.arc(p.x,p.y,r,0,Math.PI*2);ctx.fillStyle='#ff8508';ctx.fill();
 ctx.strokeStyle='#fff4e5';ctx.lineWidth=1.4;ctx.stroke();ctx.globalAlpha=1;
}
function arc(dst,t,lon){
 const angle=Math.acos(Math.max(-1,Math.min(1,source.reduce((sum,x,i)=>sum+x*dst[i],0))));
 const denom=Math.sin(angle);
 const a=Math.sin((1-t)*angle)/denom,b=Math.sin(t*angle)/denom;
 return project(source.map((x,i)=>x*a+dst[i]*b),1+Math.sin(Math.PI*t)*(.06+Math.min(.13,angle*.2)),lon);
}

const slideElements=[...document.querySelectorAll('.slide')].map(element=>({
 element,heading:element.querySelector('.slide-heading'),body:element.querySelector('.slide-body')
}));
const steps=[...document.querySelectorAll('.step')];
const fade=value=>{
 const p=Math.max(0,Math.min(1,value));
 return p*p*(3-2*p);
};
const wrap=index=>(index+steps.length)%steps.length;
let activeSlide=0, slideOffset=0, selectedLap=-2, manualSlide=0, slideStarted=0;
function updateSlide(time,lap){
 const isManualLap=lap===selectedLap;
 const isFollowingLap=lap===selectedLap+1;
 const index=isManualLap?manualSlide:wrap(lap%steps.length+slideOffset);
 if(index!==activeSlide){
  slideElements.forEach(({element},i)=>{element.hidden=i!==index;steps[i].setAttribute('aria-pressed',String(i===index));});
  activeSlide=index;
  slideStarted=elapsed;
 }
 if(index===1)renderIcons(reduced.matches?0:elapsed-slideStarted);
 const slide=slideElements[index];
 const fadeOut=isManualLap||reduced.matches?1:fade(1-(time-slow)/.55);
 const skipIntro=isManualLap||isFollowingLap||reduced.matches||elapsed<.8;
 slide.heading.style.opacity=(skipIntro?1:fade(time/.39))*fadeOut;
 slide.body.style.opacity=(skipIntro?1:fade((time-.23)/.43))*fadeOut;
}
function selectSlide(index){
 const lap=Math.floor(elapsed/cycle);
 manualSlide=index;
 selectedLap=lap;
 slideOffset=wrap(index-(lap+1)%steps.length);
 render();
}
steps.forEach((button,index)=>button.addEventListener('click',()=>selectSlide(index)));
document.querySelector('#prev-slide').addEventListener('click',()=>selectSlide(wrap(activeSlide-1)));
document.querySelector('#next-slide').addEventListener('click',()=>selectSlide(wrap(activeSlide+1)));
function render(){
 const t=elapsed%cycle, pass=Math.floor(elapsed/cycle);
 updateSlide(t,pass);
 if(!ready)return;
 const lon=longitude(t);
 painter.draw(lon);
 ctx.clearRect(0,0,width,height);
 const p=project(source,1,lon);
 if(t<slow){
  const beat=Math.floor(t/2),phase=t%2;
  for(let k=0;k<6;k++){
   const dst=destination(pass,beat,k);
   const progress=(phase-.07-k*.055)/1.12;
   if(progress<0||progress>1.55)continue;
   const head=Math.min(1,progress);
   const point=arc(dst,head,lon);
   if(!point.visible)continue;
   if(progress<=1){
    for(let j=0;j<14;j++){
     const a=arc(dst,Math.max(0,head-(14-j)*.018),lon);
     const b=arc(dst,Math.max(0,head-(13-j)*.018),lon);
     if(!a.visible||!b.visible)continue;
     ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);
     ctx.strokeStyle='rgba(246,110,0,'+((j+1)/15)+')';ctx.lineWidth=1+j/12;ctx.stroke();
    }
   }
   dot(point,3.2,progress<=1?1:Math.max(0,1-(progress-1)/.55));
  }
 }
 if(p.visible){
  const pulse=3.2+7.3*(.5+.5*Math.cos(Math.PI*elapsed));
  ctx.beginPath();ctx.arc(p.x,p.y,pulse+5,0,Math.PI*2);
  ctx.fillStyle='rgba(255,138,12,.19)';ctx.fill();dot(p,pulse);
 }
}
function resize(){
 width=routes.clientWidth;height=routes.clientHeight;dpr=Math.min(devicePixelRatio,1.5);
 for(const canvas of [globe,routes]){canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr)}
 ctx.setTransform(dpr,0,0,dpr,0,0);
 const mobile=width<=720;
 radius=1.5*(mobile?width*.84:Math.min(width*.51,height*1.18));
 cx=mobile?width*.52:width*.68;
 cy=mobile?height*.90:height*.91;
 render();
}
function tick(now){
 if(previous)elapsed+=(now-previous)/1000;
 previous=now;render();
 animation=requestAnimationFrame(tick);
}
function syncMotion(){
 cancelAnimationFrame(animation);previous=0;
 const moving=inView&&!document.hidden&&!reduced.matches;
 section.toggleAttribute('data-motion',moving);
 section.querySelector('[data-next-date]').setAttribute('visibility',reduced.matches?'hidden':'visible');
 if(ready&&moving)animation=requestAnimationFrame(tick);
 render();
}
new IntersectionObserver(([entry])=>{
 inView=entry.intersectionRatio>=.15;syncMotion();
},{threshold:.15}).observe(section);
reduced.addEventListener('change',syncMotion);
document.addEventListener('visibilitychange',syncMotion);
new ResizeObserver(resize).observe(routes);
(async()=>{
 const img=new Image();img.src=textureUrl;await img.decode();
 painter=gl?setup():fallback(img);
 if(gl)painter.load(img);
 ready=true;resize();syncMotion();
})().catch(error=>console.warn("Не удалось отобразить глобус",error));
function fallback(img){
 const flat=document.createElement('canvas');flat.width=img.width;flat.height=img.height;
 const source=flat.getContext('2d',{willReadFrequently:true});source.drawImage(img,0,0);
 const tex=source.getImageData(0,0,img.width,img.height).data;
 const raster=document.createElement('canvas');raster.width=raster.height=360;
 const rctx=raster.getContext('2d'),frame=rctx.createImageData(360,360);
 const lookup=[];
 for(let y=0;y<360;y++)for(let x=0;x<360;x++){
  const nx=(x-180)/179,ny=(180-y)/179,nz=Math.sqrt(1-nx*nx-ny*ny);
  if(!Number.isFinite(nz))continue;
  const u=Math.atan2(nx,nz*Math.cos(lat)-ny*Math.sin(lat))/(2*Math.PI)+.5;
  const row=Math.floor((.5-Math.asin(ny*Math.cos(lat)+nz*Math.sin(lat))/Math.PI)*img.height);
  lookup.push([4*(y*360+x),row*img.width,u,.19+.36*nz]);
 }
 const output=globe.getContext('2d');
 return {draw(lon){
  const shift=lon/(2*Math.PI);
  for(const [i,row,u,light] of lookup){
   const f=u+shift-Math.floor(u+shift),a=(row+Math.floor(f*img.width))*4;
   for(let c=0;c<3;c++)frame.data[i+c]=tex[a+c]*(1-light)+250*light;
   frame.data[i+3]=249;
  }
  rctx.putImageData(frame,0,0);
  output.setTransform(dpr,0,0,dpr,0,0);output.clearRect(0,0,width,height);
  output.drawImage(raster,cx-radius,cy-radius,radius*2,radius*2);
 }};
}

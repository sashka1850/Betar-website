const cubeSides=[
 [[1,-1],[1,1]],[[1,1],[-1,1]],[[-1,1],[-1,-1]],[[-1,-1],[1,-1]]
];
const easeUnit=value=>{
 const t=Math.max(0,Math.min(1,value));
 return t*t*(3-2*t);
};
function drawBoxes(boxes,time){
 boxes.forEach(({faces,params},i)=>{
  const [cx,cy,size,delay]=params;
  const phase=((time+delay)%2.6)/2.6;
  const lift=i===0?0:4*easeUnit((phase-.13)/.24)*(1-easeUnit((phase-.62)/.24));
  const turn=i===0?0:easeUnit((phase-.34)/.30)*Math.PI/2;
  const sin=Math.sin(turn),cos=Math.cos(turn);
  const point=([x,z],base=false)=>{
   const rx=x*cos-z*sin,rz=x*sin+z*cos;
   return [cx+(rx-rz)*size*.38,cy-lift+(rx+rz)*size*.21+(base?size*.66:0)];
  };
  const visible=cubeSides.filter(side=>{
   const [a,b]=side;
   return (a[0]+b[0])*(cos+sin)+(a[1]+b[1])*(cos-sin)>1e-5;
  });
  for(let slot=0;slot<2;slot++){
   const face=faces[slot],side=visible[slot];
   face.setAttribute('visibility',side?'visible':'hidden');
   if(!side)continue;
   const [a,b]=side;
   face.setAttribute('points',[point(a),point(b),point(b,true),point(a,true)].join(' '));
  }
  faces[2].setAttribute('points',cubeSides.map(([corner])=>point(corner)).join(' '));
 });
}
export function setupAboutIcons(section){
 const boxes=[...section.querySelectorAll('.cube')].map(el=>({
  faces:[...el.children],params:el.dataset.cube.split(' ').map(Number)
 }));
 const path=section.querySelector('#route-line');
 const box=section.querySelector('#route-box'),pin=section.querySelector('#route-pin');
 const length=path.getTotalLength(),trip=2.75,span=trip+.42;
 const sheet=section.querySelector('.calendar-page');
 const current=sheet.querySelector('[data-current-date]');
 const next=section.querySelector('[data-next-date]');
 let day=1;
 sheet.addEventListener('animationiteration',event=>{
  if(event.target!==sheet)return;
  day=day%31+1;
  current.textContent=day;
  next.textContent=day%31+1;
 });
 drawBoxes(boxes,0);
 return time=>{
  const leg=Math.floor(time/span),forward=leg%2===0;
  const progress=easeUnit((time%span)/trip);
  const point=path.getPointAtLength(length*(forward?progress:1-progress));
  const goal=path.getPointAtLength(forward?length:0);
  box.setAttribute('transform',`translate(${point.x} ${point.y})`);
  pin.setAttribute('transform',`translate(${goal.x} ${goal.y})`);
  drawBoxes(boxes,time);
 };
}

const from={x:88,y:134},center={x:200,y:83},to={x:321,y:124};
const clamp=t=>Math.max(0,Math.min(1,t));
const ease=t=>t*t*(3-2*t);

function cubic(a,b,c,d,t){
  const k=1-t;
  return {
    x:k*k*k*a.x+3*k*k*t*b.x+3*k*t*t*c.x+t*t*t*d.x,
    y:k*k*k*a.y+3*k*k*t*b.y+3*k*t*t*c.y+t*t*t*d.y
  };
}

export function createMailFlight(scene){
  const envelope=scene.querySelector("#envelope"),trail=scene.querySelector("#trail");
  const people=scene.querySelector("#people");
  const reduced=matchMedia("(prefers-reduced-motion: reduce)");
  let state="idle",stageAt=0,animation=0,point=from,previous=from,angle=0,tail=[];
  let deliveryStart,deliveryDirection;

  function paint(next,opacity,scale=1){
    const dx=next.x-point.x,dy=next.y-point.y;
    previous=point;point=next;
    if(Math.hypot(dx,dy)>.1){
      const direction=Math.atan2(dy,dx)*180/Math.PI;
      const wanted=Math.max(-18,Math.min(18,direction*.22));
      angle+=(wanted-angle)*.24;
    }
    envelope.setAttribute("transform",`translate(${point.x.toFixed(2)} ${point.y.toFixed(2)}) rotate(${angle.toFixed(2)}) scale(${scale})`);
    envelope.setAttribute("opacity",opacity);
    const last=tail.at(-1);
    if(!last||Math.hypot(point.x-last.x,point.y-last.y)>=2.5){
      tail.push(point);
      if(tail.length>56)tail.shift();
    }
    trail.setAttribute("d",tail.map(({x,y},i)=>`${i===0?"M":"L"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" "));
  }

  function stop(){
    cancelAnimationFrame(animation);
    envelope.setAttribute("opacity","0");
    trail.setAttribute("d","");
  }

  function reset(){
    stop();
    state="idle";
    scene.hidden=true;
    people.removeAttribute("data-arrived");
  }

  function finish(){
    stop();
    state="done";
    people.setAttribute("data-arrived","");
  }

  function frame(now){
    const elapsed=now-stageAt;
    if(state==="launch"){
      const t=clamp(elapsed/620);
      paint(cubic(from,{x:115,y:106},{x:181,y:83},center,ease(t)),clamp(t*7),.5+.5*clamp(t*6));
      if(t===1){state="waiting";stageAt=now;}
    }else if(state==="waiting"){
      const t=elapsed/1000,ramp=ease(clamp(t/.55));
      paint({x:center.x+ramp*(37*Math.sin(t*2.5)+13*Math.sin(t*4.1)),
             y:center.y+ramp*(19*Math.sin(t*3.2)+10*Math.sin(t*5.1))},1);
    }else if(state==="delivery"){
      const t=clamp(elapsed/700),fade=clamp((1-t)/.16);
      paint(cubic(deliveryStart,deliveryDirection,{x:296,y:90},to,t),fade,.5+.5*fade);
      if(t===1){finish();return;}
    }else return;
    animation=requestAnimationFrame(frame);
  }

  function start(){
    reset();
    tail=[];point=from;previous=from;angle=0;
    scene.hidden=false;
    state="launch";stageAt=performance.now();
    if(!reduced.matches)animation=requestAnimationFrame(frame);
  }

  function succeed(){
    if(state!=="launch"&&state!=="waiting")return;
    if(reduced.matches){finish();return;}
    cancelAnimationFrame(animation);
    deliveryStart=point;
    const vx=point.x-previous.x,vy=point.y-previous.y;
    const speed=Math.hypot(vx,vy);
    deliveryDirection=speed>.1?{x:point.x+vx/speed*29,y:point.y+vy/speed*29}:{x:point.x+29,y:point.y-30};
    state="delivery";stageAt=performance.now();
    animation=requestAnimationFrame(frame);
  }

  return {start,succeed,reset};
}

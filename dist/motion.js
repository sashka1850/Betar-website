// Foot contact points in the 1753 x 697 approved studio scene.
export const home = {
  water: {x:805,y:516,turn:0},
  gas: {x:1162,y:621,turn:0},
  electric: {x:1484,y:470,turn:0}
};
const layouts = {
  overview: {water:"water",gas:"gas",electric:"electric"},
  water: {water:"electric",gas:"right",electric:"right"},
  electric: {water:"left",gas:"left",electric:"electric"},
  gas: {water:"left",gas:"electric",electric:"right"}
};
const exits = {left:-510,right:2250};
const mix = (a,b,t) => a+(b-a)*t;
const smooth = t => t*t*t*(t*(t*6-15)+10);
export class StudioMotion {
  constructor(){
    this.selection="overview";
    this.actors=Object.fromEntries(Object.entries(home).map(([id,p])=>[id,{position:{...p},hidden:false,tween:null}]));
  }
  select(id,now,reduce=false){
    if (!Object.hasOwn(layouts,id)) return;
    this.sample(now);
    this.selection=id;
    for (const [key,actor] of Object.entries(this.actors)){
      const slot=layouts[id][key], exiting=Object.hasOwn(exits,slot);
      const start={...actor.position};
      const end=exiting ? {...start,x:exits[slot]} : {...home[slot],turn:key===id&&key!=="electric"?1:0};
      const parked=exiting&&(actor.hidden||start.x < -360||start.x > 2120);
      const same=start.x===end.x&&start.y===end.y&&start.turn===end.turn;
      if(reduce||parked||same){
        actor.position=end;actor.hidden=exiting;actor.tween=null;
      }else{
        actor.hidden=false;
        actor.tween={start,end,exiting,time:now,duration:exiting?720:910,
          lift:exiting?0:Math.min(12,Math.abs(end.y-start.y)*.09)};
      }
    }
  }
  sample(now){
    let moving=false;
    for(const a of Object.values(this.actors)){
      const t=a.tween;if(!t)continue;
      const progress=Math.max(0,Math.min(1,(now-t.time)/t.duration));
      if(progress===1){a.position={...t.end};a.hidden=t.exiting;a.tween=null;continue}
      const travel=smooth(progress);
      a.position={x:mix(t.start.x,t.end.x,travel),y:mix(t.start.y,t.end.y,travel)-t.lift*Math.sin(Math.PI*travel),turn:mix(t.start.turn,t.end.turn,travel)};
      moving=true;
    }
    return moving;
  }
}

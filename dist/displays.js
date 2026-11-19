const clocks={
  water:{start:12345,period:1120,count:9,places:3},
  gas:{start:632,period:1480,count:9,places:3},
  electric:{start:4632,period:1850,count:8,places:2}
};
export function readingAt(id,elapsed,reduce){
  const c=clocks[id], value=c.start+elapsed/c.period, whole=Math.floor(value);
  const digits=String(whole).padStart(c.count,"0").slice(-c.count);
  const split=c.count-c.places;
  const fraction=Math.max(0,Math.min(1,(value-whole-.72)/.28));
  const roll=!reduce&&id==="water"?fraction*fraction*(3-2*fraction):0;
  return {whole,digits,split,roll,value:digits.slice(0,split)+"."+digits.slice(split)};
}

// Project the seven segments into the LCD's four measured corners.
const segments=[
 [[1.3,.2],[8.8,.2],[7.5,1.65],[2.45,1.65]],
 [[9.15,.55],[8.8,8.15],[7.75,8.95],[7.55,7.95],[7.95,2.1]],
 [[8.7,9.35],[8.3,16.65],[7.1,17.75],[6.95,16.2],[7.3,10.55]],
 [[1.1,18.1],[7.9,18.1],[6.9,16.75],[2.15,16.75]],
 [[.7,17.55],[.95,10.25],[2.15,9.25],[2.4,10.45],[2.05,16.25]],
 [[1.05,8.65],[1.4,.65],[2.55,2.05],[2.35,7.8],[1.95,9]],
 [[1.75,9.2],[2.6,8.45],[7.3,8.45],[8,9.1],[7,9.85],[2.55,9.85]]
];
const mask=[63,6,91,79,102,109,125,7,127,111];
function polygon(ctx,[tl,tr,br,bl],points){
  ctx.beginPath();
  points.forEach(([u,v],i)=>{
    const ax=tl[0]+(tr[0]-tl[0])*u,ay=tl[1]+(tr[1]-tl[1])*u;
    const bx=bl[0]+(br[0]-bl[0])*u,by=bl[1]+(br[1]-bl[1])*u;
    const x=ax+(bx-ax)*v,y=ay+(by-ay)*v;
    if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);
  });
  ctx.closePath();ctx.fill();
}
function lcd(ctx,quad,number){
  const width=(number.length-1)*11.5+2.6;
  let offset=0;ctx.fillStyle="#192018";
  for(const char of number){
    if(char==="."){
      polygon(ctx,quad,[[offset,.87],[offset+1.9,.87],[offset+1.85,.99],[offset-.05,.99]].map(([x,y])=>[x/width,y]));
      offset+=3.6;
    }else{
      segments.forEach((points,i)=>{
        if(mask[Number(char)]&(1<<i))polygon(ctx,quad,points.map(([x,y])=>[(x+offset)/width,y/18.5]));
      });offset+=11.5;
    }
  }
}
function wheels(ctx,[tl,tr,,bl],reading){
  const {digits,roll,split}=reading;const count=digits.length,cell=19,row=32;
  ctx.save();
  ctx.transform((tr[0]-tl[0])/(cell*count),(tr[1]-tl[1])/(cell*count),
    (bl[0]-tl[0])/row,(bl[1]-tl[1])/row,tl[0],tl[1]);
  ctx.beginPath();ctx.rect(0,0,cell*count,row);ctx.clip();
  ctx.font='bold 32px "Arial Narrow", Arial, sans-serif';ctx.textAlign="center";ctx.textBaseline="middle";
  for(let i=0;i<count;i++){
    const shift=!/[^9]/.test(digits.slice(i+1))?roll*row:0;
    const x=(i+.5)*cell;
    ctx.fillStyle=i<split?"#171a1c":"#b52c25";
    ctx.fillText(digits[i],x,row*.55-shift,cell*.78);
    if(shift>0)ctx.fillText(String((Number(digits[i])+1)%10),x,row*1.55-shift,cell*.78);
  }
  ctx.restore();
}
export function drawReading(ctx,id,quad,r){
  if(id==="water")wheels(ctx,quad,r);else lcd(ctx,quad,r.value);
}

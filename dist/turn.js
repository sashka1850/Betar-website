import {drawReading} from './displays.js';

// Project strips of the original artwork so the texture and its relief
// follow the same perspective, without redrawing the meter labels.
function projectStrips(ctx, image, source, left, right, project){
  const [sx,sy,height]=source;
  let start=project(left);
  for(let x=left;x<right;x+=2){
    const next=Math.min(x+2,right),end=project(next);
    ctx.drawImage(image,sx+x,sy,next-x,height,
      start.x,(start.y+end.y)/2,end.x-start.x,(start.height+end.height)/2);
    start=end;
  }
}

const dialCenter={x:169,y:134};

export function createWaterDial(sheet,asset){
  const [width,height]=asset.size;
  const atlas=asset.selected,front=Math.floor(atlas.count/2);
  const source=[(front%atlas.columns)*width,Math.floor(front/atlas.columns)*height];
  const face=document.createElement("canvas");
  face.width=width;face.height=height;
  const ctx=face.getContext("2d");
  const quad=atlas.frames[front];
  return function paintDial(target,frame,reading){
    ctx.clearRect(0,0,width,height);
    ctx.drawImage(sheet,...source,width,height,0,0,width,height);
    drawReading(ctx,"water",quad,reading);

    // Feather the insert on the pale dial, inside the glass and bezel.
    ctx.save();
    ctx.translate(dialCenter.x,dialCenter.y);
    ctx.scale(113,118);
    const mask=ctx.createRadialGradient(0,0,.96,0,0,1);
    mask.addColorStop(0,"#fff");mask.addColorStop(1,"#fff0");
    ctx.globalCompositeOperation="destination-in";
    ctx.fillStyle=mask;
    ctx.fillRect(-2,-2,4,4);
    ctx.restore();

    const pose=atlas.frames[frame];
    const compression=(pose[1][0]-pose[0][0])/(quad[1][0]-quad[0][0]);
    const center=pose[0][0]+(dialCenter.x-quad[0][0])*compression;
    const yaw=(frame-front)/front;
    projectStrips(target,face,[0,0,height],54,284,x=>{
      const offset=x-dialCenter.x;
      const scale=1+.10*yaw*offset/113;
      return {
        x:center+offset*compression,
        y:dialCenter.y*(1-scale),
        height:height*scale
      };
    });
  };
}

import {artTexture} from './effect-art.mjs';
// One flowing ribbon per wall shape, bent around rings rather than scattered flame stamps.
export function makeFireWall(layer,shapes,size){
 const strips=[],walls=shapes.filter(s=>!s.hole).flatMap(s=>s.type!=='polygon'?[s]:Array.from({length:s.points.length/2},(_,i)=>{const j=(i+1)%(s.points.length/2),x=s.points[i*2],y=s.points[i*2+1],dx=s.points[j*2]-x,dy=s.points[j*2+1]-y;return {type:'line',x,y,length:Math.hypot(dx,dy),width:size*.4,rotation:Math.atan2(dy,dx)*180/Math.PI}}));
 return {draw(time,alpha){
  const texture=artTexture('wall-fire');if(!texture)return false;
  if(!strips.length)for(const shape of walls){
   const mesh=new PIXI.SimplePlane(texture,65,9);mesh.name='shadow-edge-fire-wall';layer.addChild(mesh);strips.push({mesh,shape});
   if(['circle','ellipse'].includes(shape.type)){const uv=mesh.geometry.getBuffer('aTextureCoord');for(let row=0;row<9;row++)for(let col=0;col<65;col++){const u=col/64;uv.data[(row*65+col)*2]=u<=.5?u*2:2-u*2}uv.update()}
  }
  for(const {mesh,shape:s}of strips){
   const buffer=mesh.geometry.getBuffer('aVertexPosition'),angle=(s.rotation??0)*Math.PI/180,c=Math.cos(angle),sn=Math.sin(angle);
   const ring=s.type==='circle'||s.type==='ellipse',w=s.width??s.radius*2,h=s.height??s.radius*2;
   for(let row=0;row<9;row++)for(let col=0;col<65;col++){
    const u=col/64,v=row/8-.5,phase=u*Math.PI*12-time*3.4;
    const pulse=1+.12*Math.sin(phase)+.07*Math.sin(u*39+time*4.7),thickness=Math.max(size*.9,Math.min(w||size,h||size)*1.6);
    let x,y;
    if(ring){const theta=u*Math.PI*2,r=v*size*1.2*pulse,rx=w/2,ry=h/2;x=(s.type==='circle'?0:rx)+Math.cos(theta)*(rx+r);y=(s.type==='circle'?0:ry)+Math.sin(theta)*(ry+r)}
    else if(s.type==='line'){x=u*s.length;y=v*Math.max(size*.9,s.width*1.6)*pulse}
    else if(s.type==='rectangle'){x=w>=h?u*w:w/2+v*thickness*pulse;y=w>=h?h/2+v*thickness*pulse:u*h}
    else {continue}
    const i=(row*65+col)*2;buffer.data[i]=s.x+x*c-y*sn;buffer.data[i+1]=s.y+x*sn+y*c;
   }
   buffer.update();mesh.alpha=alpha*(.9+.07*Math.sin(time*5));
  }
  return true;
 }};
}

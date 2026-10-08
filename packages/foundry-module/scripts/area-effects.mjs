import {areaProfiles,zoneGeometry} from './area-profiles.mjs';
let mist;
function mistTexture(){if(mist)return mist;const c=document.createElement('canvas');c.width=c.height=128;const ctx=c.getContext('2d'),d=ctx.createImageData(128,128);for(let y=0;y<128;y++)for(let x=0;x<128;x++){const r=Math.hypot((x-64)/64,(y-64)/64),noise=.65+.35*Math.sin(x*.25+Math.sin(y*.17)*3)*Math.cos(y*.22);const i=(y*128+x)*4;d.data[i]=d.data[i+1]=d.data[i+2]=255;d.data[i+3]=255*Math.max(0,1-r)**1.3*noise}ctx.putImageData(d,0,0);mist=PIXI.Texture.from(c);return mist}
export function drawShape(g,s){
 if(s.type==='polygon'){g.drawPolygon(s.points);return}
 if(s.type==='circle'){g.drawCircle(s.x,s.y,s.radius);return}
 const a=(s.rotation??0)*Math.PI/180,c=Math.cos(a),v=Math.sin(a),point=(x,y)=>[s.x+x*c-y*v,s.y+x*v+y*c];
 if(s.type==='ellipse'){const points=[];for(let j=0;j<48;j++){const theta=j*Math.PI/24;points.push(...point(s.width/2+Math.cos(theta)*s.width/2,s.height/2+Math.sin(theta)*s.height/2))}g.drawPolygon(points)}
 else g.drawPolygon((s.type==='line'?[[0,-s.width/2],[s.length,-s.width/2],[s.length,s.width/2],[0,s.width/2]]:[[0,0],[s.width,0],[s.width,s.height],[0,s.height]]).flatMap(([x,y])=>point(x,y)));
}
function shapeContains(s,x,y){
 if(s.type==='polygon')return new PIXI.Polygon(s.points).contains(x,y);
 if(s.type==='circle')return (x-s.x)**2+(y-s.y)**2<=s.radius**2;
 const a=-(s.rotation??0)*Math.PI/180,dx=x-s.x,dy=y-s.y,u=dx*Math.cos(a)-dy*Math.sin(a),v=dx*Math.sin(a)+dy*Math.cos(a);
 return s.type==='ellipse'?((u-s.width/2)/(s.width/2))**2+((v-s.height/2)/(s.height/2))**2<=1:s.type==='line'?u>=0&&u<=s.length&&Math.abs(v)<=s.width/2:u>=0&&v>=0&&u<=s.width&&v<=s.height;
}
export function makeZonePainter(layer,key,shapes,size){
 const bounds=zoneGeometry(shapes),profile=areaProfiles[key];if(!bounds||!profile)return null;
 const g=new PIXI.Graphics(),mask=new PIXI.Graphics(),clouds=new PIXI.Container();layer.addChild(clouds,g,mask);mask.beginFill(0xffffff);for(const s of shapes.filter(s=>!s.hole))drawShape(mask,s);for(const s of shapes.filter(s=>s.hole)){mask.beginHole();drawShape(mask,s);mask.endHole()}mask.endFill();
 if(key!=='wall-of-fire'){clouds.mask=mask;g.mask=mask}else mask.visible=false;
 let seed=137;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296},points=[];
 for(let tries=0;points.length<90&&tries<12000;tries++){const x=bounds.x+random()*bounds.width,y=bounds.y+random()*bounds.height;if(shapes.some(s=>!s.hole&&shapeContains(s,x,y))&&!shapes.some(s=>s.hole&&shapeContains(s,x,y)))points.push({x,y,phase:random()*Math.PI*2})}
 const sprites=[];let index=0;
 const glow=(x,y,r,color,alpha,rotation=0)=>{let s=sprites[index++];if(!s){s=new PIXI.Sprite(mistTexture());s.anchor.set(.5);clouds.addChild(s);sprites.push(s)}s.visible=true;s.position.set(x,y);s.width=r*2;s.height=r*2;s.tint=color;s.alpha=alpha;s.rotation=rotation;s.blendMode=['darkness','fog-cloud','grease','oil'].includes(key)?PIXI.BLEND_MODES.NORMAL:PIXI.BLEND_MODES.ADD};
 const line=(x,y,x2,y2,width,color,alpha)=>{g.lineStyle(width,color,alpha);g.moveTo(x,y);g.lineTo(x2,y2)};
 return {graphics:g,bounds,draw(time,alpha=1){g.clear();index=0;for(const s of sprites)s.visible=false;
  const color=profile.color,thunder=['thunderwave','shatter'].includes(key),ice=key==='ice-storm';
  if(['grease','oil'].includes(key)){
   g.beginFill(key==='oil'?0x332811:0x354922,.72*alpha);for(const s of shapes.filter(s=>!s.hole))drawShape(g,s);g.endFill();
   for(const [j,p] of points.entries()){const phase=time*.7+p.phase,r=size*(.1+.08*Math.sin(phase));glow(p.x,p.y,size*.45,color,.14*alpha,phase);if(j%3===0){g.lineStyle(1.7,0xd5d788,alpha*(.2+.15*Math.sin(phase)));g.drawEllipse(p.x,p.y,r*1.7,r*.65)}if(j%9===0){const bubble=(time*.22+p.phase/7)%1;g.lineStyle(1.5,0xeeefb5,alpha*(1-bubble)*.45);g.drawCircle(p.x,p.y-size*.08*bubble,size*.07*bubble)}}
  }else if(['darkness','fog-cloud'].includes(key)){
   const dark=key==='darkness';g.beginFill(dark?0x120c20:0x9aafb9,(dark?.75:.24)*alpha);for(const s of shapes.filter(s=>!s.hole))drawShape(g,s);g.endFill();
   for(const p of points){const phase=time*.35+p.phase;glow(p.x+Math.sin(phase)*size*.25,p.y+Math.cos(phase*.8)*size*.25,size*(.8+.2*Math.sin(phase)),dark?0x392951:0xddeaf0,(dark?.32:.3)*alpha,phase)}
  }else if(key==='wall-of-fire'){
   for(const p of points){const phase=(time*.8+p.phase/7)%1,r=size*(.35+.32*(1-phase));glow(p.x,p.y-phase*size*1.4,r,0xff4915,alpha*(1-phase)*.7);glow(p.x,p.y-phase*size*1.1,r*.58,0xffda80,alpha*(1-phase)*.8);if(phase<.6){g.lineStyle(size*.025,0xffe3a4,alpha*(1-phase));g.moveTo(p.x,p.y);g.bezierCurveTo(p.x-size*.12,p.y-size*.25,p.x+size*.15,p.y-size*.45,p.x+Math.sin(time*5+p.phase)*size*.1,p.y-size*.6)}}
  }else if(['spike-growth','entangle','web'].includes(key)){
   g.beginFill(key==='web'?0x849b9e:0x213c23,.22*alpha);for(const s of shapes.filter(s=>!s.hole))drawShape(g,s);g.endFill();
   for(const [j,p] of points.entries()){const wave=Math.sin(time*.8+p.phase)*size*.06,h=size*(.16+(j%5)*.025);if(key==='web'){const q=points[(j+13)%points.length];line(p.x,p.y,q.x,q.y,1.1,0xedf6fa,.4*alpha);glow(p.x,p.y,size*.07,0xeaffff,.2*alpha)}else{g.lineStyle(size*.027,color,.8*alpha);g.moveTo(p.x-h,p.y);g.bezierCurveTo(p.x-h,p.y-h*1.2,p.x+h+wave,p.y+h,p.x+h,p.y);for(let n=-1;n<=1;n++){g.beginFill(j%2?0xb6d178:0x476537,.9*alpha);g.drawPolygon([p.x+n*h*.5,p.y,p.x+n*h*.5+wave,p.y-h*.6,p.x+n*h*.5+h*.2,p.y]);g.endFill()}glow(p.x,p.y,size*.18,color,.08*alpha)}}
  }else if(key==='moonbeam'){
   for(const [j,p] of points.entries()){const phase=(time*.25+p.phase/7)%1;glow(p.x,p.y,size*.4,0xabcfff,.24*alpha);if(j%3===0)line(p.x,p.y-size*(.3+phase),p.x,p.y+size*.15,1.5,0xebf7ff,alpha*(1-phase)*.65)}
  }else if(thunder){for(let j=0;j<6;j++){const r=Math.min(bounds.width,bounds.height)*(.12+((time*.45+j/6)%1)*.7);g.lineStyle(size*.035,color,alpha*(1-(time*.45+j/6)%1));g.drawCircle(bounds.cx,bounds.cy,r)}for(const p of points){glow(p.x,p.y,size*.18,color,alpha*.3);if(key==='shatter')line(p.x,p.y,p.x+Math.sin(p.phase)*size*.25,p.y+Math.cos(p.phase)*size*.25,2,0xeeecff,alpha*.8)}}
  else if(ice){for(const p of points){const phase=(time*.7+p.phase/7)%1,y=p.y-(1-phase)*size*.8;line(p.x,y-size*.15,p.x+size*.04,y,size*.04,0xddfaff,alpha*.8);glow(p.x,y,size*.1,color,alpha*.5);if(phase>.8){g.lineStyle(1.5,0xb7eeff,alpha*(1-phase)*3);g.drawEllipse(p.x,p.y,size*.15,size*.05)}}}
 }};
}

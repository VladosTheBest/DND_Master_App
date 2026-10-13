import {zoneGeometry} from './area-profiles.mjs';
export function shapeOverlapsToken(s,t,size){
 const x=t.x,y=t.y,w=t.width*size,h=t.height*size;
 if(s.type==='circle'){const dx=Math.max(x,Math.min(s.x,x+w))-s.x,dy=Math.max(y,Math.min(s.y,y+h))-s.y;return dx*dx+dy*dy<=s.radius*s.radius}
 const angle=(s.rotation??0)*Math.PI/180,rotate=([u,v])=>[s.x+u*Math.cos(angle)-v*Math.sin(angle),s.y+u*Math.sin(angle)+v*Math.cos(angle)];
 const poly=s.type==='polygon'?Array.from({length:s.points.length/2},(_,i)=>s.points.slice(i*2,i*2+2)):s.type==='ellipse'?Array.from({length:64},(_,i)=>rotate([s.width/2*(1+Math.cos(i*Math.PI/32)),s.height/2*(1+Math.sin(i*Math.PI/32))])):(s.type==='line'?[[0,-s.width/2],[s.length,-s.width/2],[s.length,s.width/2],[0,s.width/2]]:[[0,0],[s.width,0],[s.width,s.height],[0,s.height]]).map(rotate);
 const corners=[[x,y],[x+w,y],[x+w,y+h],[x,y+h]],inside=([px,py])=>{let yes=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const a=poly[i],b=poly[j];if((a[1]>py)!==(b[1]>py)&&px<(b[0]-a[0])*(py-a[1])/(b[1]-a[1])+a[0])yes=!yes}return yes};
 if(corners.some(inside)||poly.some(([u,v])=>u>=x&&u<=x+w&&v>=y&&v<=y+h))return true;
 const cross=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
 for(let i=0;i<poly.length;i++)for(let j=0;j<4;j++){const a=poly[i],b=poly[(i+1)%poly.length],c=corners[j],d=corners[(j+1)%4];if(Math.max(a[0],b[0])<Math.min(c[0],d[0])||Math.max(c[0],d[0])<Math.min(a[0],b[0])||Math.max(a[1],b[1])<Math.min(c[1],d[1])||Math.max(c[1],d[1])<Math.min(a[1],b[1]))continue;if(cross(a,b,c)*cross(a,b,d)<=0&&cross(c,d,a)*cross(c,d,b)<=0)return true}
 return false;
}
export function animationTemplate(doc,scene){
 const d=doc.document??doc,unit=scene.grid.size/scene.grid.distance;
 const shapes=d.shapes?.map(s=>s.toObject?.()??{...s})??(d.t==='circle'?[{type:'circle',x:d.x,y:d.y,radius:d.distance*unit}]:null);
 const bounds=shapes&&zoneGeometry(shapes);
 if(bounds)return {x:bounds.cx,y:bounds.cy,length:Math.max(bounds.width,bounds.height)/2,direction:0,shapes};
 return {x:d.x,y:d.y,length:(d.distance??20)*unit,direction:d.direction??0};
}
export function animationTheme(item,activity){
 const types=activity?.damage?.parts?.flatMap(p=>Array.from(p.types??[]))??[];
 const text=[item.name,item.system?.description?.value,item.flags?.['shadow-edge-gm']?.aiAnimation].join(' ').toLowerCase();
 if(types.includes('cold'))return 'cold';
 if(types.includes('fire'))return 'fire';
 if(/\bcold\b|\bfrost|\bfreez|\bice\b|\bsnow|холод|мороз|лед|лёд|сне[гж]|замерз/.test(text))return 'cold';
 if(/fire|flame|огнен|плам|огонь/.test(text))return 'fire';
 return '';
}

import type {SessionMapDocument} from '@shadow-edge/shared-types';
export type SceneLevel=SessionMapDocument['levels'][number];
type Wall=SceneLevel['walls'][number];
type Point=Wall['start'];
const distance=(a:Point,b:Point)=>Math.hypot(a.x-b.x,a.y-b.y);
const pixel=(p:Point,l:SceneLevel)=>({x:p.x*l.width,y:p.y*l.height});
const normal=(p:Point,l:SceneLevel)=>({x:p.x/l.width,y:p.y/l.height});
function projection(p:Point,a:Point,b:Point){const dx=b.x-a.x,dy=b.y-a.y,t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy||1)));return {x:a.x+t*dx,y:a.y+t*dy};}

// Keep the uncut wall in the editor. Only the published geometry contains openings.
export function snapSceneDoor(door:Wall,walls:Wall[],level:SceneLevel,tolerance=20):Wall {
 if(door.kind!=='door')return door;
 const a=pixel(door.start,level),b=pixel(door.end,level),center={x:(a.x+b.x)/2,y:(a.y+b.y)/2},length=distance(a,b);
 let best=door,nearest=tolerance;
 for(const wall of walls){if(wall.kind!=='wall'||wall.id===door.id)continue;const u=pixel(wall.start,level),v=pixel(wall.end,level),total=distance(u,v);if(total<length||!total)continue;const p=projection(center,u,v),d=distance(center,p);if(d>=nearest)continue;nearest=d;const t=Math.max(length/2,Math.min(total-length/2,distance(u,p))),dx=(v.x-u.x)/total,dy=(v.y-u.y)/total;best={...door,start:normal({x:u.x+dx*(t-length/2),y:u.y+dy*(t-length/2)},level),end:normal({x:u.x+dx*(t+length/2),y:u.y+dy*(t+length/2)},level)};}
 return best;
}
export function cutSceneOpenings(walls:Wall[],level:SceneLevel):Wall[]{
 const doors=walls.filter(w=>w.kind==='door');
 return walls.flatMap(w=>{
  if(w.kind!=='wall')return [w];
  const a=pixel(w.start,level),b=pixel(w.end,level),length=distance(a,b);if(!length)return [w];
  const dx=(b.x-a.x)/length,dy=(b.y-a.y)/length;let spans=[[0,length]];
  for(const door of doors){const p=pixel(door.start,level),q=pixel(door.end,level);if(Math.abs((p.x-a.x)*dy-(p.y-a.y)*dx)>1||Math.abs((q.x-a.x)*dy-(q.y-a.y)*dx)>1)continue;const t=[(p.x-a.x)*dx+(p.y-a.y)*dy,(q.x-a.x)*dx+(q.y-a.y)*dy].sort((x,y)=>x-y);spans=spans.flatMap(([lo,hi])=>t[1]<=lo||t[0]>=hi?[[lo,hi]]:[[lo,Math.max(lo,t[0])],[Math.min(hi,t[1]),hi]].filter(([x,y])=>y-x>.1));}
  return spans.map(([lo,hi],i)=>({...w,id:i===0?w.id:`${w.id.slice(0,60)}-gap-${i}`,start:normal({x:a.x+dx*lo,y:a.y+dy*lo},level),end:normal({x:a.x+dx*hi,y:a.y+dy*hi},level)}));
 });
}
function restoreDoorHosts(level:SceneLevel):Wall[]{
 const walls=[...level.walls];
 for(const door of level.walls.filter(w=>w.kind==='door')){
  const a=pixel(door.start,level),b=pixel(door.end,level),length=distance(a,b);if(!length)continue;
  // Only bridge an existing, evidenced opening: both jambs must touch collinear walls.
  const touches=(p:Point)=>level.walls.some(w=>{
   if(w.kind!=='wall')return false;const u=pixel(w.start,level),v=pixel(w.end,level);
   return Math.min(distance(p,u),distance(p,v))<=2&&Math.abs((u.x-a.x)*(b.y-a.y)-(u.y-a.y)*(b.x-a.x))/length<=2&&Math.abs((v.x-a.x)*(b.y-a.y)-(v.y-a.y)*(b.x-a.x))/length<=2;
  });
  if(touches(a)&&touches(b))walls.push({id:`${door.id.slice(0,60)}-host`,kind:'wall',start:door.start,end:door.end});
 }
 return walls;
}
export function editableScene(map:SessionMapDocument):SessionMapDocument{return {...map,levels:map.levels.map(l=>({...l,walls:l.editorWalls||restoreDoorHosts(l)}))};}
export function publishScene(map:SessionMapDocument):SessionMapDocument{return {...map,levels:map.levels.map(l=>({...l,editorWalls:l.walls,walls:cutSceneOpenings(l.walls,l)}))};}

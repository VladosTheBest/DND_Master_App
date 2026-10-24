import type {CreativeItem,CreativeScene,Point} from './creative-map';

/** Snap to actual endpoints before rounding, including off-grid imported walls. */
export function wallEndpoint(scene:CreativeScene,raw:Point,grid:Point,tolerance:number,snap:boolean):Point {
 if(!snap)return raw;
 let best=grid,nearest=tolerance;
 for(const item of scene.items){
  if(item.kind!=='wall'||!item.points||!scene.layers?.some(l=>l.id===item.layerId&&l.visible))continue;
  for(const endpoint of [item.points[0],item.points[item.points.length-1]]){
   const angle=item.rotation*Math.PI/180,dx=endpoint[0]-item.x,dy=endpoint[1]-item.y;
   const rotated:Point=[item.x+dx*Math.cos(angle)-dy*Math.sin(angle),item.y+dx*Math.sin(angle)+dy*Math.cos(angle)];
   const distance=Math.hypot(raw[0]-rotated[0],raw[1]-rotated[1]);
   if(distance<=nearest){nearest=distance;best=rotated;}
  }
 }
 return [...best];
}

/** Each committed segment is independently undoable in the existing scene format. */
export function wallSegment(start:Point,end:Point,width:number,color:string,layerId:string,id:string):CreativeItem|null {
 if(Math.hypot(end[0]-start[0],end[1]-start[1])<1)return null;
 const thickness=Math.max(1,Math.min(8,width));
 return {id,kind:'wall',x:start[0],y:start[1],w:thickness,h:thickness,rotation:0,color,layerId,points:[[...start],[...end]]};
}

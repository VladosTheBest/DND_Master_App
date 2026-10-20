import {creativePNG,floorKinds,geometry,normalizeScene,sceneSize,type CreativeScene,type Point} from './creative-map';
export type WallSegment=[Point,Point];
export function projectToWall(p:Point,[a,b]:WallSegment):Point{const dx=b[0]-a[0],dy=b[1]-a[1],t=Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/(dx*dx+dy*dy||1)));return [a[0]+t*dx,a[1]+t*dy];}
const distance=(a:Point,b:Point)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
export function nearestWall(p:Point,walls:WallSegment[],tolerance=16){let best:WallSegment|undefined,d=tolerance;for(const wall of walls){const next=distance(p,projectToWall(p,wall));if(next<d){d=next;best=wall;}}return best;}
function simplify(points:Point[]):Point[]{if(points.length<=2)return points;let max=1.25,index=0;for(let n=1;n<points.length-1;n++){const d=distance(points[n],projectToWall(points[n],[points[0],points.at(-1)!]));if(d>max){max=d;index=n;}}return index?[...simplify(points.slice(0,index+1)).slice(0,-1),...simplify(points.slice(index))]:[points[0],points.at(-1)!];}
// Trace the same union/subtraction mask used by the editor, not individual room rectangles.
// This avoids invisible walls across joined rooms and preserves cutouts and curved caves.
export function creativeWalls(raw:CreativeScene):WallSegment[]{
 const scene=normalizeScene(raw),{width,height}=sceneSize(scene),walls:WallSegment[]=[];
 for(const layer of scene.layers!){if(!layer.visible||layer.opacity===0)continue;const items=scene.items.filter(i=>i.layerId===layer.id),floors=items.filter(i=>floorKinds.has(i.kind));
  if(floors.length){const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;const c=canvas.getContext('2d',{willReadFrequently:true})!;c.fillStyle=c.strokeStyle='#fff';for(const i of floors){c.globalCompositeOperation=i.kind==='cut'?'destination-out':'source-over';geometry(c,i);}
   const pixels=c.getImageData(0,0,width,height).data,inside=(x:number,y:number)=>x>=0&&y>=0&&x<width&&y<height&&pixels[(y*width+x)*4+3]>=128;
   const edges=new Map<number,number[]>(),key=(x:number,y:number)=>y*(width+1)+x,point=(k:number):Point=>[k%(width+1),Math.floor(k/(width+1))];
   const add=(a:number,b:number)=>{const list=edges.get(a)||[];list.push(b);edges.set(a,list);};
   for(let y=0;y<height;y++)for(let x=0;x<width;x++)if(inside(x,y)){if(!inside(x,y-1))add(key(x,y),key(x+1,y));if(!inside(x+1,y))add(key(x+1,y),key(x+1,y+1));if(!inside(x,y+1))add(key(x+1,y+1),key(x,y+1));if(!inside(x-1,y))add(key(x,y+1),key(x,y));}
   while(edges.size){const start=edges.keys().next().value!,path:Point[]=[point(start)];let current=start;do{const nexts=edges.get(current);if(!nexts)break;const next=nexts.pop()!;if(!nexts.length)edges.delete(current);path.push(point(next));current=next;}while(current!==start);
    if(path.length<4)continue;let far=1;for(let n=2;n<path.length-1;n++)if(distance(path[0],path[n])>distance(path[0],path[far]))far=n;const reduced=[...simplify(path.slice(0,far+1)).slice(0,-1),...simplify(path.slice(far))];for(let n=1;n<reduced.length;n++)if(distance(reduced[n-1],reduced[n])>.5)walls.push([reduced[n-1],reduced[n]]);
   }
  }
  for(const i of items.filter(i=>i.kind==='wall')){const rotate=(p:Point):Point=>{const a=i.rotation*Math.PI/180,x=p[0]-i.x,y=p[1]-i.y;return [i.x+x*Math.cos(a)-y*Math.sin(a),i.y+x*Math.sin(a)+y*Math.cos(a)];};for(let n=1;n<(i.points?.length||0);n++)walls.push([rotate(i.points![n-1]),rotate(i.points![n])]);}
 }
 return walls;
}
export function creativeStructure(scene:CreativeScene){
 const normalized=normalizeScene(scene),doors=normalized.items.filter(i=>i.kind==='portal'&&normalized.layers!.some(l=>l.id===i.layerId&&l.visible&&l.opacity>0)).map(i=>i.points! as WallSegment);
 let walls=creativeWalls(scene);
 // Replace the overlapping wall span, rather than putting a door over a blocking wall.
 for(const door of doors){walls=walls.flatMap(wall=>{const [a,b]=wall,len=distance(a,b);if(len<.01)return [];const [p,q]=door,dx=(b[0]-a[0])/len,dy=(b[1]-a[1])/len;
  if(Math.abs((p[0]-a[0])*dy-(p[1]-a[1])*dx)>2||Math.abs((q[0]-a[0])*dy-(q[1]-a[1])*dx)>2)return [wall];
  const t=[(p[0]-a[0])*dx+(p[1]-a[1])*dy,(q[0]-a[0])*dx+(q[1]-a[1])*dy].sort((x,y)=>x-y),lo=Math.max(0,t[0]),hi=Math.min(len,t[1]);if(hi<=lo)return [wall];const pieces:WallSegment[]=[];if(lo>.1)pieces.push([a,[a[0]+dx*lo,a[1]+dy*lo]]);if(hi<len-.1)pieces.push([[a[0]+dx*hi,a[1]+dy*hi],b]);return pieces;});}
 return {walls,doors};
}
export async function creativeUVTT(scene:CreativeScene){
 const {width,height}=sceneSize(scene),grid=scene.gridSize||50,{walls,doors}=creativeStructure(scene),point=([x,y]:Point)=>({x:x/grid,y:y/grid});
 if(walls.length>20000)throw new Error('Слишком сложный контур для VTT: упрости пещеры и стены.');
 const png=await creativePNG({...scene,grid:false},1,true),image=await new Promise<string>((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(String(r.result).split(',')[1]);r.onerror=()=>reject(new Error('Не удалось подготовить изображение VTT.'));r.readAsDataURL(png);});
 return {format:.3,resolution:{map_origin:{x:0,y:0},map_size:{x:width/grid,y:height/grid},pixels_per_grid:grid},line_of_sight:walls.map(w=>w.map(point)),portals:doors.map(([a,b])=>({position:point([(a[0]+b[0])/2,(a[1]+b[1])/2]),bounds:[point(a),point(b)],rotation:Math.atan2(b[1]-a[1],b[0]-a[0]),closed:true,freestanding:false})),objects_line_of_sight:[],lights:[],environment:{baked_lighting:true,ambient_light:'#ffffff'},image,shadow_edge:{feet_per_cell:scene.feetPerCell??5}};
}

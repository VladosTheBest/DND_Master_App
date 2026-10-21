import type {SessionMapDocument} from '@shadow-edge/shared-types';
import {api} from '../../app/api';
import {creativePNG,sceneFromJSON,type CreativeItem} from './creative-map';
type Level=SessionMapDocument['levels'][number];

// A private snapshot belongs to the scene; the source map is never overwritten.
export function drawingWithSceneDoors(level:Level){
 const drawing=sceneFromJSON(level.creative!);
 const old=drawing.items.filter(i=>i.kind==='portal');
 const layer=drawing.layers!.find(l=>l.id==='dungeon'&&l.visible&&l.opacity>0)||drawing.layers!.find(l=>l.visible&&l.opacity>0);
 if(!layer)throw Error('В рисунке нужен видимый слой для проёмов.');
 const portals:CreativeItem[]=level.walls.filter(w=>w.kind==='door').map(w=>{
  const previous=old.find(i=>i.id===w.id)||old[0];
  const a:[number,number]=[w.start.x*level.width,w.start.y*level.height],b:[number,number]=[w.end.x*level.width,w.end.y*level.height];
  return {id:w.id,kind:'portal',x:(a[0]+b[0])/2,y:(a[1]+b[1])/2,w:previous?.w||Math.max(32,2*(drawing.wallWidth||5)+4),h:previous?.h||50,rotation:0,color:previous?.color||'#404139',layerId:previous?.layerId||layer.id,points:[a,b]};
 });
 return {...drawing,grid:false,items:[...drawing.items.filter(i=>i.kind!=='portal'),...portals]};
}
export async function saveCreativeBackgrounds(map:SessionMapDocument,campaign:string):Promise<SessionMapDocument>{
 const levels=[];
 for(const level of map.levels){
  if(!level.creative){levels.push(level);continue;}
  const drawing=drawingWithSceneDoors(level);
  // Export first. Failure leaves the saved document and its old background intact.
  const png=await creativePNG(drawing,1,true);
  const uploaded=await api.uploadImage(campaign,new File([png],'scene-background.png',{type:'image/png'}));
  levels.push({...level,creative:JSON.stringify(drawing),imageUrl:new URL(uploaded.url,location.origin).pathname});
 }
 return {...map,levels};
}

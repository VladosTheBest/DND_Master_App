import {sceneBackground} from './scene-background.mjs';
import {clone,MODULE} from './core.mjs';
export function topologySnapshot(scene){return {background:sceneBackground(scene),width:scene.width,height:scene.height,gridSize:scene.grid?.size,walls:Array.from(scene.walls,w=>w.toObject()),lights:Array.from(scene.lights,l=>l.toObject()),darkness:scene.environment?.darknessLevel??0}}
export async function replaceSceneTopology(scene,expected,plan){
 if(JSON.stringify(topologySnapshot(scene))!==JSON.stringify(expected))throw Error('Разметка сцены изменена после запуска AI. Повторите анализ, чтобы сохранить ручные правки.');
 const sx=scene.width/plan.width,sy=scene.height/plan.height;
 const walls=plan.walls.map(w=>({...clone(w),c:w.c.map((n,i)=>n*(i%2?sy:sx))})),lights=plan.lights.map(l=>({...clone(l),x:l.x*sx,y:l.y*sy}));
 let createdWalls=[],createdLights=[];
 try{
  createdWalls=await scene.createEmbeddedDocuments('Wall',walls);createdLights=await scene.createEmbeddedDocuments('AmbientLight',lights);
  await scene.deleteEmbeddedDocuments('Wall',expected.walls.filter(w=>!w.flags?.[MODULE]?.areaRegion).map(w=>w._id));await scene.deleteEmbeddedDocuments('AmbientLight',expected.lights.map(l=>l._id));
  await scene.update({'environment.darknessLevel':plan.environment.darknessLevel});
 }catch(error){
  // Restore any deleted original documents; keep IDs and all GM-authored settings.
  await scene.deleteEmbeddedDocuments('Wall',createdWalls.map(w=>w.id));await scene.deleteEmbeddedDocuments('AmbientLight',createdLights.map(l=>l.id));
  await scene.createEmbeddedDocuments('Wall',expected.walls.filter(w=>!scene.walls.get(w._id)),{keepId:true});await scene.createEmbeddedDocuments('AmbientLight',expected.lights.filter(l=>!scene.lights.get(l._id)),{keepId:true});
  await scene.update({'environment.darknessLevel':expected.darkness});throw error;
 }
}

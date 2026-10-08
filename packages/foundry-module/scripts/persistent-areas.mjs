import {MODULE} from './core.mjs';
import {areaProfile,areaProfiles,durationSeconds,zoneGeometry} from './area-profiles.mjs';
import {makeZonePainter} from './area-effects.mjs';
import {controlsCombat,enqueue} from './combat.mjs';
import {midiAnimationMode} from './animations.mjs';
import {playEffectSound} from './sounds.mjs';
const visuals=new Map();let registered=false,syncQueued=false;
export function areaExpired(state,worldTime,concentration){return worldTime>=state.expiresAt||Boolean(state.concentrationUuid&&(!concentration||concentration.disabled||concentration.isSuppressed||concentration.duration?.expired||concentration.active===false))}
function renderArea(region,state){
 const shapes=region.shapes.map(s=>s.toObject?.()??{...s}),layer=new PIXI.Container();layer.name=`shadow-edge-area:${region.uuid}`;canvas.interface.addChild(layer);
 const painter=makeZonePainter(layer,state.key,shapes,canvas.grid.size);if(!painter){layer.destroy({children:true});return null}
 const trail=new PIXI.Graphics();layer.addChild(trail);let frame,stopped=false;const age=Date.now()-state.createdAt,stopSound=age<2800?playEffectSound(state.key,region.uuid):null;
 const stop=()=>{if(stopped)return;stopped=true;cancelAnimationFrame(frame);stopSound?.();layer.parent?.removeChild(layer);layer.destroy({children:true});Hooks.callAll('shadow-edge-gm.areaEnd',{id:region.uuid,key:state.key})};
 const draw=()=>{if(!canvas.ready||canvas.scene.id!==region.parent.id||!region.parent.regions.has(region.id)||areaExpired(state,game.time.worldTime,state.concentrationUuid?fromUuidSync(state.concentrationUuid):null)){stop();return}
  const seconds=(Date.now()-state.createdAt)/1000,arrival=Math.min(1,Math.max(0,(seconds-.8)/1.2));painter.draw(seconds,arrival);trail.clear();
  if(state.source&&seconds<1.4){const u=Math.min(1,seconds/1.1),x=state.source.x+(painter.bounds.cx-state.source.x)*u,y=state.source.y+(painter.bounds.cy-state.source.y)*u,color=areaProfiles[state.key].color;trail.lineStyle(canvas.grid.size*.05,color,1-u*.5);trail.moveTo(state.source.x,state.source.y);trail.lineTo(x,y);trail.beginFill(0xf0faff,1-u*.6);trail.drawCircle(x,y,canvas.grid.size*.09);trail.endFill()}
  layer.visible=(!region.hidden||game.user.isGM)&&!region.object?.isFilteredOut;Hooks.callAll('shadow-edge-gm.areaFrame',{id:region.uuid,key:state.key,graphics:painter.graphics});frame=requestAnimationFrame(draw);
 };draw();Hooks.callAll('shadow-edge-gm.areaStart',{id:region.uuid,key:state.key,graphics:painter.graphics});return {stop,layer};
}
function syncVisuals(){
 if(!canvas.ready)return;const wanted=new Set();for(const region of canvas.scene.regions){const state=region.flags?.[MODULE]?.area;if(!state||!Object.hasOwn(areaProfiles,state.key)||region.hidden&&!game.user.isGM||areaExpired(state,game.time.worldTime,state.concentrationUuid?fromUuidSync(state.concentrationUuid):null))continue;wanted.add(region.uuid);const signature=JSON.stringify([region.shapes,state,region.hidden]);const existing=visuals.get(region.uuid);if(existing?.layer.destroyed||existing?.signature!==signature){existing?.stop();visuals.delete(region.uuid)}if(!visuals.has(region.uuid)&&visuals.size<30){const v=renderArea(region,state);if(v)visuals.set(region.uuid,{...v,signature})}}
 for(const [id,v]of visuals)if(!wanted.has(id)){v.stop();visuals.delete(id)}
}
function scheduleVisuals(){if(syncQueued)return;syncQueued=true;queueMicrotask(()=>{syncQueued=false;syncVisuals()})}
async function deleteArea(region){const scene=region.parent;for(const type of ['AmbientLight','Wall']){const collection=type==='Wall'?scene.walls:scene.lights,ids=collection.filter(d=>d.flags?.[MODULE]?.areaRegion===region.uuid).map(d=>d.id);if(ids.length)await scene.deleteEmbeddedDocuments(type,ids)}if(scene.regions.has(region.id))await region.delete()}
function boundaryPoints(shape){if(shape.type==='circle')return Array.from({length:32},(_,j)=>[shape.x+Math.cos(j*Math.PI/16)*shape.radius,shape.y+Math.sin(j*Math.PI/16)*shape.radius]);if(shape.type==='polygon')return Array.from({length:shape.points.length/2},(_,j)=>shape.points.slice(j*2,j*2+2));const a=(shape.rotation??0)*Math.PI/180,corners=shape.type==='line'?[[0,-shape.width/2],[shape.length,-shape.width/2],[shape.length,shape.width/2],[0,shape.width/2]]:[[0,0],[shape.width,0],[shape.width,shape.height],[0,shape.height]];return corners.map(([x,y])=>[shape.x+x*Math.cos(a)-y*Math.sin(a),shape.y+x*Math.sin(a)+y*Math.cos(a)])}
async function syncObscurity(region,state){
 const scene=region.parent,profile=areaProfiles[state.key];if(!profile.obscures)return;
 const walls=scene.walls.filter(w=>w.flags?.[MODULE]?.areaRegion===region.uuid);if(walls.length)await scene.deleteEmbeddedDocuments('Wall',walls.map(w=>w.id));
 const points=region.shapes.filter(s=>!s.hole).flatMap(s=>{const p=boundaryPoints(s);return p.map((point,j)=>({c:[...point,...p[(j+1)%p.length]],levels:[...region.levels],sight:CONST.WALL_SENSE_TYPES.NORMAL,move:CONST.WALL_MOVEMENT_TYPES.NONE,light:CONST.WALL_SENSE_TYPES.NONE,sound:CONST.WALL_SENSE_TYPES.NONE,flags:{[MODULE]:{areaRegion:region.uuid}}}))});await scene.createEmbeddedDocuments('Wall',points);
 if(state.key==='darkness'){const shape=region.shapes[0],radius=shape.radius??Math.max(shape.width,shape.height)/2,b=zoneGeometry(region.shapes),data={x:b.cx,y:b.cy,levels:[...region.levels],config:{negative:true,bright:radius*scene.grid.distance/scene.grid.size,dim:radius*scene.grid.distance/scene.grid.size,priority:10,luminosity:1,alpha:1,attenuation:0},flags:{[MODULE]:{areaRegion:region.uuid}}};const light=scene.lights.find(l=>l.flags?.[MODULE]?.areaRegion===region.uuid);if(light)await light.update(data);else await scene.createEmbeddedDocuments('AmbientLight',[data])}
}
async function prepareArea(origin){
 if(!controlsCombat()||origin.flags?.[MODULE]?.areaStarted||!origin.flags?.[MODULE]?.areaReady)return;
 const data=origin.flags[MODULE].areaOrigin,ready=origin.flags[MODULE].areaReady,a=await fromUuid(data?.activityUuid),profile=areaProfile(a?.item);
 if(!profile?.persistent||!origin.author||!a.actor.testUserPermission(origin.author,'OWNER')||origin.speaker.actor!==a.actor.id)return;
 const region=await fromUuid(ready.regionUuid),source=await fromUuid(data.sourceTokenUuid);if(!region||region.documentName!=='Region'||region.parent.id!==data.sceneId||region.flags.dnd5e?.activity!==a.uuid||source?.actor?.uuid!==a.actor.uuid||!zoneGeometry(region.shapes))return;
 const conc=a.duration.concentration?origin.system.concentration:null,concentration=typeof conc==='string'?a.actor.effects.get(conc):conc;
 if(a.duration.concentration&&!concentration){await deleteArea(region);await origin.setFlag(MODULE,'areaStarted','cancelled');return}
 const state={key:profile.key,actorUuid:a.actor.uuid,activityUuid:a.uuid,originUuid:origin.uuid,concentrationUuid:concentration?.uuid??null,expiresAt:game.time.worldTime+durationSeconds(a.duration,profile.duration??60),createdAt:Date.now(),source:source.hidden?null:{x:source.x+source.width*region.parent.grid.size/2,y:source.y+source.height*region.parent.grid.size/2}};
 await region.update({name:a.item.name,visibility:CONST.REGION_VISIBILITY.LAYER,displayMeasurements:false,'flags.core.-=MeasuredTemplate':null,[`flags.${MODULE}.area`]:state});
 if(profile.terrain&&!region.behaviors.some(b=>b.type==='dnd5e.difficultTerrain'))await region.createEmbeddedDocuments('RegionBehavior',[{name:'Труднопроходимая область',type:'dnd5e.difficultTerrain',system:{magical:profile.key!=='oil',types:[],ignoredDispositions:[]}}]);
 await syncObscurity(region,state);await origin.setFlag(MODULE,'areaStarted',region.uuid);scheduleVisuals();
}
async function cleanupAreas(){if(!controlsCombat())return;for(const scene of game.scenes)for(const region of [...scene.regions]){const state=region.flags?.[MODULE]?.area;if(state&&(areaExpired(state,game.time.worldTime,state.concentrationUuid?fromUuidSync(state.concentrationUuid):null)||!fromUuidSync(state.actorUuid)))await deleteArea(region)}}
export function registerPersistentAreas(){
 if(registered)return;registered=true;
 Hooks.on('dnd5e.preUseActivity',(a,usage,dialog,message)=>{const profile=areaProfile(a.item);if(!profile?.persistent||Number.parseInt(game.system.version,10)<6||midiAnimationMode())return;const source=a.actor.token?.object??a.actor.getActiveTokens().find(t=>t.controlled)??a.actor.getActiveTokens()[0];if(!source){ui.notifications.warn('Разместите токен исполнителя на сцене.');return false}usage.create??={};usage.create.measuredTemplate=true;usage.subsequentActions=false;message.data.flags??={};message.data.flags[MODULE]??={};message.data.flags[MODULE].areaOrigin={activityUuid:a.uuid,sceneId:canvas.scene.id,sourceTokenUuid:source.document.uuid}});
 Hooks.on('dnd5e.postUseActivity',(a,usage,result)=>{if(result.message?.flags?.[MODULE]?.areaOrigin&&result.templates?.[0])void result.message.setFlag(MODULE,'areaReady',{regionUuid:result.templates[0].uuid}).catch(e=>ui.notifications.warn(e.message))});
 Hooks.on('updateChatMessage',m=>{if(m.flags?.[MODULE]?.areaReady)enqueue(()=>prepareArea(m))});
 Hooks.on('createChatMessage',request=>{const id=request.flags?.[MODULE]?.endArea;if(!id)return;enqueue(async()=>{if(!controlsCombat())return;try{const region=await fromUuid(id),state=region?.flags?.[MODULE]?.area,actor=state&&await fromUuid(state.actorUuid);if(!state||!actor?.testUserPermission(request.author,'OWNER'))return;const concentration=state.concentrationUuid&&await fromUuid(state.concentrationUuid);if(concentration)await actor.endConcentration(concentration);await deleteArea(region);const origin=await fromUuid(state.originUuid);if(origin)await origin.setFlag(MODULE,'areaEnded',true)}finally{if(game.messages.has(request.id))await request.delete()}})});
 Hooks.on('renderChatMessageHTML',(message,html)=>{if(message.flags?.[MODULE]?.endArea){(html[0]??html).hidden=true;return}const id=message.flags?.[MODULE]?.areaStarted;if(!id||id==='cancelled')return;const region=fromUuidSync(id),state=region?.flags?.[MODULE]?.area,actor=state&&fromUuidSync(state.actorUuid);if(!state||message.flags[MODULE].areaEnded||!actor?.isOwner)return;const root=html[0]??html,b=document.createElement('button');b.textContent='Убрать область';b.dataset.segmArea=region.uuid;b.onclick=async()=>{b.disabled=true;try{const gm=game.users.activeGM;if(!gm)throw Error('Нужен активный мастер.');await ChatMessage.create({content:'Shadow Edge · убрать область',whisper:[gm.id],flags:{[MODULE]:{endArea:region.uuid}}})}catch(e){ui.notifications.warn(e.message);b.disabled=false}};root.append(b)});
 Hooks.on('shadow-edge-gm.combatCoordinatorReady',()=>enqueue(async()=>{for(const m of game.messages)if(m.flags?.[MODULE]?.areaReady)await prepareArea(m);await cleanupAreas()}));
 for(const h of ['canvasReady','createRegion','updateRegion','deleteRegion','updateActiveEffect','deleteActiveEffect','updateWorldTime','updateCombat','deleteActor'])Hooks.on(h,()=>{scheduleVisuals();enqueue(cleanupAreas)});
 Hooks.on('updateRegion',(region,changes)=>{if((changes.shapes||changes.levels)&&region.flags?.[MODULE]?.area)enqueue(async()=>{if(controlsCombat())await syncObscurity(region,region.flags[MODULE].area)})});
 Hooks.on('deleteRegion',region=>enqueue(async()=>{if(controlsCombat()&&region.flags?.[MODULE]?.area)await deleteArea(region)}));
 Hooks.on('canvasTearDown',()=>{for(const v of visuals.values())v.stop();visuals.clear()});
}

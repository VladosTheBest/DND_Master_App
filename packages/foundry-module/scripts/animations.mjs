import {MODULE,activityValues} from './core.mjs';
import {profiles,renderEffect,validEffect,clearEffects,effectFinished} from './native-effects.mjs';
import {areaProfile,zoneGeometry} from './area-profiles.mjs';
export const effects=Object.fromEntries(Object.entries(profiles).map(([key,[mode]])=>[key,{key,mode}]));
export function midiAnimationMode(){const m=game.modules.get('midi-qol');return Boolean(m?.active&&(Number.parseInt(game.system.version,10)<6||m.version?.startsWith('14.6.')))}
export function weaponProfile(item){
 const name=[item.system?.type?.baseItem,item.system?.identifier,item.name].filter(Boolean).join(' ').toLowerCase();
 for(const [key,re] of [['crossbow',/crossbow|арбалет/],['bow',/\bbow\b|longbow|shortbow|лук/],['axe',/axe|топор|секир/],['hammer',/hammer|maul|mace|club|молот|булав|дубин/],['dagger',/dagger|knife|кинжал|нож/],['spear',/spear|pike|halberd|glaive|копь|пик[а-и]|алебард|глеф/],['claw',/claw|bite|когт|укус/],['sword',/sword|rapier|scimitar|меч|рапир|сабл/]])if(re.test(name))return effects[key];
 return null;
}
export function animationProfile(item,activity){
 if(!item?.flags?.[MODULE])return null;
 const area=areaProfile(item);if(area)return effects[area.key];
 const spell=item.flags[MODULE].spellId?.replace(/-(2014|2024)$/,'');if(effects[spell])return effects[spell];
 activity??=activityValues(item.system?.activities)[0];
 if(activity?.type==='heal')return effects['cure-wounds'];
 if(activity?.type==='attack'){const weapon=weaponProfile(item),ranged=activity.attack?.type?.value==='ranged';if(ranged){const thrown=/метан|брос|throw|javelin/u.test(item.name?.toLowerCase()??'');return thrown?effects.thrown:weapon?.key==='crossbow'?effects.crossbow:effects.bow}return weapon??effects.sword}
 if(['save','damage'].includes(activity?.type)){const types=activity.damage?.parts?.flatMap(p=>Array.from(p.types??[]))??[];if(types.includes('fire'))return activity.target?.template?.type==='circle'?effects.fireball:effects['fire-bolt'];return effects.impact}
 return null;
}
export function animationStatus(){return `Встроенные анимации готовы · ${midiAnimationMode()?'Midi-QOL':'обычные способности dnd5e'}. Выделите свой токен и отметьте цель.`}
const seen=new Set();
function receive(p){if(!validEffect(p)||seen.has(p.id))return false;seen.add(p.id);if(seen.size>500)seen.delete(seen.values().next().value);return renderEffect(p)}
export async function receiveAnimation(p){
 if(!validEffect(p)||p.sceneId!==canvas.scene?.id)return false;
 const user=game.users.get(p.userId),actor=await fromUuid(p.actorUuid);
 if(!user||!actor||(!user.isGM&&!actor.testUserPermission(user,'OWNER')))return false;
 return receive(p);
}
export async function playAnimation({item,activity,source,targets=[],template,id,waitForEnd=false,loop=false}){
 const profile=animationProfile(item,activity);source=source?.object??source;template=template?.object??template;
 if(!profile||!source?.center||!item.actor?.uuid||!canvas.ready)return false;
 const point=t=>({x:t.center.x,y:t.center.y,tokenId:t.id??t.document?.id});
 targets=targets.map(t=>t?.object??t).filter(t=>t?.center).slice(0,20);
 if(profile.mode==='self'||(!targets.length&&!template&&activity?.type==='heal'))targets=[source];
 if(!targets.length&&!template)return false;
 const p={key:profile.key,id:String(id??foundry.utils.randomID()),sceneId:canvas.scene.id,userId:game.user.id,actorUuid:item.actor.uuid,source:point(source),targets:targets.map(point),size:Math.min(1000,Math.max(10,canvas.grid.size)),loop};
 if(template){const d=template.document??template,s=d.shapes?.[0],bounds=d.shapes&&zoneGeometry(d.shapes);p.template=bounds&&profile.mode==='zone'?{x:bounds.cx,y:bounds.cy,length:Math.max(bounds.width,bounds.height)/2,direction:0,shapes:d.shapes.map(s=>({...s}))}:s?{x:s.x,y:s.y,length:s.radius??s.length??20*canvas.grid.size/canvas.scene.grid.distance,direction:s.rotation??0}:{x:d.x,y:d.y,length:(d.distance??20)*canvas.grid.size/canvas.scene.grid.distance,direction:d.direction??0}}
 if(!validEffect(p))return false;
 const played=receive(p);
 // Hidden tokens stay local to the GM; do not publish even their coordinates.
 if(played&&!source.document?.hidden){const publicTargets=p.targets.filter(t=>!canvas.tokens.get(t.tokenId)?.document.hidden);if(publicTargets.length||p.template)game.socket.emit(`module.${MODULE}`,{...p,targets:publicTargets})}
 if(played&&waitForEnd)await effectFinished(p.id);
 return played;
}
let registered=false;
export function registerAnimations(){
 if(registered)return;registered=true;
 game.socket.on(`module.${MODULE}`,p=>{void receiveAnimation(p).catch(()=>{})});
 Hooks.on('canvasTearDown',clearEffects);
 const play=data=>void playAnimation(data).catch(()=>ui.notifications.warn('Не удалось воспроизвести анимацию. Способность остаётся доступной.'));
 Hooks.on('dnd5e.postUseActivity',(activity,config,results)=>{
  if(midiAnimationMode()||!results?.message)return;
  if(areaProfile(activity.item)?.persistent)return;
  if(results.message.flags?.[MODULE]?.combatOrigin?.areaExpected&&!results.templates?.length)return;
  // Managed areas are captured, removed and animated by the authoritative GM before resolving combat.
  if(results.templates?.length&&results.message.flags?.[MODULE]?.combatOrigin)return;
  const actor=activity.item?.actor,source=actor?.token?.object??actor?.getActiveTokens()?.find(t=>t.controlled)??actor?.getActiveTokens()?.[0];
  play({item:activity.item,activity,source,targets:Array.from(game.user.targets??[]),template:results.templates?.[0],id:results.message.uuid??results.message.id,loop:Boolean(results.message.flags?.[MODULE]?.healCast)});
 });
 Hooks.on('midi-qol.RollComplete',workflow=>{
  if(!midiAnimationMode()||(workflow.userId??workflow.user?.id)!==game.user.id)return;
  void (async()=>{const template=workflow.templateUuid?await fromUuid(workflow.templateUuid):null;await playAnimation({item:workflow.item,activity:workflow.activity,source:workflow.token,targets:Array.from(workflow.targets??[]),template,id:workflow.uuid??workflow.id})})().catch(()=>ui.notifications.warn('Не удалось воспроизвести анимацию Midi-QOL.'));
 });
}

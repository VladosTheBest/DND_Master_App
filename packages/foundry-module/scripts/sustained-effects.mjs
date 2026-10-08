import {MODULE} from './core.mjs';
import {midiAnimationMode} from './animations.mjs';
import {endEffect,renderShieldAura,renderEffect} from './native-effects.mjs';

export function shieldEffectActive(effect){
 if(effect.disabled||effect.isSuppressed||effect.duration?.expired||effect.active===false)return false;
 const item=effect.item??(effect.origin?.startsWith('Actor.')?globalThis.fromUuidSync?.(effect.origin):null),key=item?.flags?.[MODULE]?.spellId?.replace(/-(2014|2024)$/,'');
 return effect.flags?.[MODULE]?.visual==='shield'||key==='shield'||(/^(shield|щит|imperceptible barrier)$/i.test(effect.name??'')&&(effect.system?.changes??effect.changes??[]).some(c=>c.key==='system.attributes.ac.bonus'&&Number(c.value)===5));
}
const bubbles=new Map(),finishing=new Set(),pendingDice=new Set(),completedDice=new Set(),diceWaiters=new Map();
let registered=false,syncQueued=false;
function syncShields(){
 if(!canvas.ready)return;
 const wanted=new Set();
 for(const token of canvas.tokens.placeables){if(!token.actor||!game.user.isGM&&(!token.visible||token.document.hidden))continue;
  const id=token.document.uuid,active=()=>Boolean(token.actor?.effects.some(shieldEffectActive));if(!active())continue;wanted.add(id);
  if(bubbles.get(id)?.graphics.destroyed)bubbles.delete(id);if(!bubbles.has(id)){const bubble=renderShieldAura(token,id,active);if(bubble)bubbles.set(id,bubble)}
 }
 for(const [id,bubble] of bubbles)if(!wanted.has(id)){bubble.stop();bubbles.delete(id)}
}
function scheduleSync(){if(syncQueued)return;syncQueued=true;queueMicrotask(()=>{syncQueued=false;syncShields()})}
function clearBubbles(){for(const bubble of bubbles.values())bubble.stop();bubbles.clear()}
function restoreHealing(){
 if(!canvas.ready)return;
 for(const message of game.messages){const state=message.flags?.[MODULE]?.healCast;if(!message.visible||state?.status!=='pending'||Date.now()-state.startedAt>120000)continue;
  const activity=fromUuidSync(state.activityUuid),source=canvas.tokens.get(message.speaker.token);if(!source?.actor||activity?.type!=='heal'||message.speaker.scene!==canvas.scene.id)continue;
  const targets=message.system.targets.map(t=>fromUuidSync(t.token)?.object).filter(Boolean);if(!targets.length)targets.push(source);
  const point=t=>({x:t.center.x,y:t.center.y,tokenId:t.id});
  if(!message.author)continue;
  renderEffect({id:message.uuid,key:activity.item.flags[MODULE].spellId?.startsWith('healing-word')?'healing-word':'cure-wounds',sceneId:canvas.scene.id,userId:message.author.id,actorUuid:source.actor.uuid,source:point(source),targets:targets.slice(0,20).map(point),size:canvas.grid.size,loop:true});
 }
}
function healOrigin(activity,message){
 const id=message?.data?.system?.origin,explicit=id&&game.messages.get(id);
 if(explicit?.flags?.[MODULE]?.healCast?.activityUuid===activity.uuid)return explicit;
 return [...game.messages].reverse().find(m=>m.flags?.[MODULE]?.healCast?.activityUuid===activity.uuid&&m.flags[MODULE].healCast.status==='pending'&&(m.author?.id===game.user.id||game.user.isGM));
}
async function cancelHealing(origin){if(!origin)return;endEffect(origin.uuid);await origin.setFlag(MODULE,'healCast',{...origin.flags[MODULE].healCast,status:'cancelled'})}
async function finishHealing(origin,rollMessage){
 if(!origin||finishing.has(origin.id))return;finishing.add(origin.id);
 try{
  const state=origin.flags[MODULE].healCast;
  const minimum=new Promise(resolve=>setTimeout(resolve,Math.max(0,2600-(Date.now()-state.startedAt))));
  // Let all createChatMessage listeners run regardless of module load order before inspecting DSN.
  await Promise.resolve();
  let dice=Promise.resolve();
  if(game.dice3d&&!completedDice.has(rollMessage.id)&&(pendingDice.has(rollMessage.id)||rollMessage._dice3danimating))dice=new Promise(resolve=>{const timeout=setTimeout(()=>{diceWaiters.delete(rollMessage.id);resolve()},20000);diceWaiters.set(rollMessage.id,()=>{clearTimeout(timeout);resolve()})});
  await Promise.all([minimum,dice]);endEffect(origin.uuid);
 }finally{finishing.delete(origin.id)}
}
const shieldApplications=new Map();
async function applyShield(activity,message){
 if(shieldApplications.has(message.id))return shieldApplications.get(message.id);
 const task=(async()=>{
  const actor=activity.actor,source=activity.effects?.map(e=>activity.item.effects.get(e._id)).find(Boolean);if(!source||!actor.isOwner)return;
  const existing=actor.effects.find(e=>e.flags?.[MODULE]?.visual==='shield'||e._stats?.duplicateSource===source.uuid);
  const data=foundry.utils.mergeObject(source.toObject(),activity.getAppliedEffectChanges(source,{chatMessage:message,target:actor}));
  delete data._id;delete data._stats;data.disabled=false;data.transfer=false;data.duration.expired=false;data.start=source.constructor.getEffectStart();
  data.origin=activity.item.uuid;data.flags??={};data.flags[MODULE]={...data.flags[MODULE],visual:'shield'};
  data.system.origin={activity:activity.uuid,item:activity.item.uuid,message:message.uuid,profile:source.id};
  data.system.changes=await source.constructor.forApplication(data.system.changes,activity,actor);
  data._stats={duplicateSource:source.uuid};
  if(existing)await existing.update(data);else await actor.createEmbeddedDocuments('ActiveEffect',[data]);
  await message.setFlag(MODULE,'shieldApplied',true);scheduleSync();
 })();shieldApplications.set(message.id,task);try{await task}finally{if(shieldApplications.size>100)shieldApplications.delete(shieldApplications.keys().next().value)}
}
export function registerSustainedEffects(){
 if(registered)return;registered=true;
 for(const hook of ['canvasReady','drawToken','refreshToken','createActiveEffect','updateActiveEffect','deleteActiveEffect','updateActor','updateToken','updateCombat','updateWorldTime'])Hooks.on(hook,scheduleSync);
 Hooks.on('canvasTearDown',clearBubbles);
 Hooks.on('dnd5e.preUseActivity',(a,usage,dialog,message)=>{
  if(Number.parseInt(game.system.version,10)<6||midiAnimationMode()||!a.item.flags?.[MODULE])return;
  const source=a.actor.token?.object??a.actor.getActiveTokens().find(t=>t.controlled)??a.actor.getActiveTokens()[0];if(!source)return;
  message.data.flags??={};message.data.flags[MODULE]??={};
  if(a.type==='heal')message.data.flags[MODULE].healCast={activityUuid:a.uuid,startedAt:Date.now(),status:'pending'};
  if(a.item.flags[MODULE].spellId?.startsWith('shield-'))message.data.flags[MODULE].shieldCast=true;
 });
 Hooks.on('dnd5e.postUseActivity',(a,usage,result)=>{if(result.message?.flags?.[MODULE]?.shieldCast&&!result.message.flags[MODULE].shieldApplied)void applyShield(a,result.message).catch(e=>ui.notifications.warn(`Щит: ${e.message}`))});
 Hooks.on('dnd5e.preRollDamage',(config,dialog,message)=>{const a=config.subject;if(a?.type!=='heal')return;const origin=healOrigin(a,message);if(origin){message.data.system??={};message.data.system.origin=origin.id}});
 Hooks.on('dnd5e.postDamageRollConfiguration',(rolls,config,dialog,message)=>{if(!rolls.length&&config.subject?.type==='heal')void cancelHealing(healOrigin(config.subject,message))});
 Hooks.on('diceSoNiceMessageProcessed',(id,data)=>{if(data.willTrigger3DRoll){pendingDice.add(id);if(pendingDice.size>500)pendingDice.delete(pendingDice.values().next().value)}});
 Hooks.on('diceSoNiceRollComplete',id=>{pendingDice.delete(id);completedDice.add(id);if(completedDice.size>500)completedDice.delete(completedDice.values().next().value);diceWaiters.get(id)?.();diceWaiters.delete(id)});
 Hooks.on('createChatMessage',message=>{
  if(message.type!=='healing')return;const reference=message.system.origin,origin=typeof reference==='string'?game.messages.get(reference):reference,state=origin?.flags?.[MODULE]?.healCast;
  if(!state||message.system.activity?.uuid!==state.activityUuid)return;
  const actor=fromUuidSync(state.activityUuid)?.actor;if(!actor||!message.author||message.speaker.actor!==actor.id||(!message.author.isGM&&!actor.testUserPermission(message.author,'OWNER')))return;
  void finishHealing(origin,message);
  if(message.author.id===game.user.id)void origin.setFlag(MODULE,'healCast',{...state,status:'rolled',rollMessageId:message.id}).catch(e=>console.error(`${MODULE}: healing state`,e));
 });
 Hooks.on('updateChatMessage',message=>{const state=message.flags?.[MODULE]?.healCast;if(state?.status==='cancelled')endEffect(message.uuid);if(state?.status==='rolled'){const roll=game.messages.get(state.rollMessageId);if(roll)void finishHealing(message,roll)}});
 Hooks.on('deleteChatMessage',message=>endEffect(message.uuid));
 // dnd5e enriches the effects tray after the render hook; the class also hides later-inserted trays.
 Hooks.on('renderChatMessageHTML',(message,html)=>{if(message.flags?.[MODULE]?.shieldApplied){const root=html[0]??html;root.classList.add('shadow-edge-shield-applied')}});
 Hooks.on('canvasReady',restoreHealing);Hooks.on('ready',restoreHealing);
 Hooks.on('ready',scheduleSync);
}

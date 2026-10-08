import {MODULE,clone} from './core.mjs';
import {safeHTML} from './adapter.mjs';
import {midiAnimationMode,playAnimation} from './animations.mjs';
const key='combat',requestKey='combatRequest';
export function combatEnabled(activity){return Number.parseInt(game.system.version,10)>=6&&!midiAnimationMode()&&activity?.item?.flags?.[MODULE]?.coverage==='partial'&&!activity.item.flags[MODULE].spellId?.startsWith('magic-missile')&&['attack','save','damage'].includes(activity.type)}
export function attackHits(roll,ac){const die=roll.dice?.find(d=>d.faces===20)?.results?.find(r=>r.active!==false&&!r.discarded)?.result;return die!==1&&(roll.isCritical||die===20||roll.total>=ac)}
export function areaTargets(scene,template){
 if(template.shapes?.length){const size=scene.grid.size;return scene.tokens.filter(t=>t.actor&&template.shapes.some(s=>{const cx=t.x+t.width*size/2,cy=t.y+t.height*size/2,point={x:s.type==='circle'?Math.max(t.x,Math.min(s.x,t.x+t.width*size)):cx,y:s.type==='circle'?Math.max(t.y,Math.min(s.y,t.y+t.height*size)):cy,elevation:t.elevation??0};return template.testPoint?.(point)??(s.type==='circle'&&(point.x-s.x)**2+(point.y-s.y)**2<=s.radius**2)})).map(t=>t.uuid)}
 const size=scene.grid.size,length=template.distance*size/scene.grid.distance;
 return scene.tokens.filter(t=>{if(!t.actor)return false;const x=t.x+t.width*size/2-template.x,y=t.y+t.height*size/2-template.y;
  if(template.t==='circle'){const dx=Math.max(0,Math.abs(x)-t.width*size/2),dy=Math.max(0,Math.abs(y)-t.height*size/2);return dx*dx+dy*dy<=length*length}
  return template.object?.shape?.contains(x,y)??false;
 }).map(t=>t.uuid);
}
function gm(){return game.users.filter(u=>u.active&&u.isGM).sort((a,b)=>a.id.localeCompare(b.id))[0]}
const owns=(user,actor)=>Boolean(user?.isGM||actor?.testUserPermission(user,'OWNER'));
let queue=Promise.resolve(),registered=false,coordinator=true;
const controlsCombat=()=>coordinator&&game.user.id===gm()?.id&&game.user.flags?.[MODULE]?.combatSession===game.socket.id;
function enqueue(fn){queue=queue.then(fn).catch(e=>{console.error(`${MODULE}: combat`,e);ui.notifications.error(`Бой: ${e.message}`)})}
async function activityFor(w){let a=await fromUuid(w.activityUuid);if(w.scaling)a=a.item.scaledClone(w.scaling).system.activities.get(a.id);return a}
async function write(message,w){await message.update({[`flags.${MODULE}.${key}`]:w})}
export async function startCombat(origin){
 if(!controlsCombat()||!origin.flags?.[MODULE]?.combatReady||origin.flags[MODULE].combatStarted||origin.flags[MODULE].combatStopped)return;
 if(origin.flags[MODULE].combatReady.cancelled){await origin.setFlag(MODULE,'combatStopped',true);return}
 if(game.messages.some(m=>m.flags?.[MODULE]?.[key]?.origin===origin.uuid))return;
 const data=origin.flags[MODULE].combatOrigin,activity=await fromUuid(data?.activityUuid),author=origin.author;
 if(!combatEnabled(activity)||!owns(author,activity.actor)||origin.speaker?.actor!==activity.actor.id)return;
 const scene=game.scenes.get(data.sceneId),source=await fromUuid(data.sourceTokenUuid);
 if(!scene||source?.parent?.id!==scene.id||source.actor?.uuid!==activity.actor.uuid)return;
 const ready=origin.flags[MODULE].combatReady,template=ready.templateUuid?await fromUuid(ready.templateUuid):null;
 if(ready.templateUuid&&!template){await origin.setFlag(MODULE,'combatStopped',true);ui.notifications.warn('Область способности уже удалена. Используйте способность снова.');return}
 if(template&&template.parent.id!==scene.id)return;
 let targets=template?areaTargets(scene,template):origin.system.targets.map(t=>t.token).filter(Boolean);
 targets=[...new Set(targets)].slice(0,50);if(!targets.length&&!template){await origin.setFlag(MODULE,'combatStopped',true);ui.notifications.warn('Нет целей для способности.');return}
 if(activity.type==='attack'&&targets.length!==1)throw Error('Для одной атаки выберите ровно одну цель.');
 const w={origin:origin.uuid,ownerId:author.id,activityUuid:activity.uuid,sceneId:scene.id,sourceTokenUuid:source.uuid,scaling:Math.max(0,Math.min(20,Number(origin.system.scaling)||0)),type:activity.type,rows:[],damageStatus:'pending',phase:template?'animation':'resolve'};
 for(const uuid of targets){const t=await fromUuid(uuid);if(t?.parent?.id===scene.id&&t.actor&&!w.rows.some(r=>r.actorUuid===t.actor.uuid))w.rows.push({tokenUuid:uuid,actorUuid:t.actor.uuid,save:null,applied:false})}
 if(!w.rows.length)w.notice='В области нет целей для способности.';
 const a=await activityFor(w);w.name=a.item.name;w.dc=a.save?.dc?.value??null;w.ability=Array.from(a.save?.ability??[])[0];w.onSave=a.damage?.onSave??'none';
 if(w.type==='save'&&(!w.ability||!Number.isFinite(w.dc)))throw Error('У способности отсутствует характеристика или сложность спасброска.');
 const card=await ChatMessage.create({content:safeHTML(w.name),speaker:ChatMessage.getSpeaker({actor:a.actor,token:source}),whisper:origin.whisper.map(u=>u.id??u),blind:origin.blind,flags:{[MODULE]:{[key]:w}}});
 await origin.setFlag(MODULE,'combatStarted',card.uuid);
 if(template){
  // Snapshot geometry/targets before deleting only this use's template; unrelated regions are untouched.
  const geometry=template.toObject();
  try{await template.delete();await playAnimation({item:a.item,activity:a,source:source.object,targets:w.rows.map(r=>fromUuidSync(r.tokenUuid)?.object).filter(Boolean),template:geometry,id:origin.uuid,waitForEnd:true})}
  catch(e){console.error(`${MODULE}: area animation`,e);ui.notifications.warn('Не удалось завершить эффект области. Цели сохранены в карточке боя.')}
  w.phase='resolve';await write(card,w);
 }
 if(w.type==='attack'){
  const target=await fromUuid(w.rows[0].tokenUuid),ac=target.actor.system.attributes.ac.value;
  if(!Number.isFinite(ac)||target.actor.statuses.has('coverTotal')){w.damageStatus='blocked';w.notice='КД недоступна или цель за полным укрытием.';await write(card,w);return}
  const rolls=await a.rollAttack({target:ac},{configure:false},{data:{whisper:card.whisper.map(u=>u.id??u),blind:card.blind}});
  if(!rolls?.length){w.damageStatus='blocked';w.notice='Бросок отменён.'}else{w.attack=rolls[0].total;w.hit=attackHits(rolls[0],ac);w.critical=Boolean(rolls[0].isCritical);w.attackOptions={ability:rolls[0].options.ability,attackMode:rolls[0].options.attackMode};if(!w.hit)w.damageStatus='miss'}
  await write(card,w);
 }
 return card;
}
async function applyRows(card,w){
 for(const row of w.rows){if(row.applied||w.type==='save'&&row.save===null)continue;
  const token=await fromUuid(row.tokenUuid);if(!token?.actor||token.parent.id!==w.sceneId)throw Error('Цель больше не существует на сцене.');
  const actor=token.actor,receipt=`${card.id}:${token.id}`,receipts=actor.flags?.[MODULE]?.damageReceipts??[];
  if(!receipts.includes(receipt)){
   const multiplier=w.type==='save'&&row.save>=w.dc?(w.onSave==='half'?.5:w.onSave==='full'?1:0):1;
   const h=Hooks.on('dnd5e.preApplyDamage',(a,amount,updates)=>{if(a.uuid===actor.uuid)updates[`flags.${MODULE}.damageReceipts`]=[...receipts,receipt].slice(-100)});
   try{await actor.applyDamage(w.damage.map(d=>({...d,properties:new Set(d.properties)})),{multiplier})}finally{Hooks.off('dnd5e.preApplyDamage',h)}
   if(!actor.flags?.[MODULE]?.damageReceipts?.includes(receipt))throw Error('Система или другой модуль отменили применение урона.');
  }
  row.applied=true;await write(card,w);
 }
}
export async function processCombatRequest(request){
 if(!controlsCombat()||request.flags?.[MODULE]?.processed)return;
 const input=request.flags?.[MODULE]?.[requestKey],card=await fromUuid(input?.workflowUuid),stored=card?.flags?.[MODULE]?.[key];
 if(!stored||stored.phase==='animation'||!card.author?.isGM||!['save','damage'].includes(input.action))return;
 const w=clone(stored),user=request.author,a=await activityFor(w);
 if(input.action==='save'){
  const row=w.rows.find(r=>r.tokenUuid===input.targetUuid),token=row?await fromUuid(row.tokenUuid):null;
  if(!row||row.save!==null||!owns(user,token?.actor))return;
  await request.setFlag(MODULE,'processed',true);
  const saveConfig={ability:w.ability,target:w.dc};
  const bonus=CONFIG.Dice.BasicRoll.replaceFormulaData(a.save?.bonus??'',a.getRollData(),{missing:0}),bonusData=CONFIG.Dice.BasicRoll.constructParts({activityBonus:bonus});if(bonusData.parts.length)saveConfig.rolls=[bonusData];
  const rolls=await token.actor.rollSavingThrow(saveConfig,{configure:false},{data:{whisper:card.whisper.map(u=>u.id??u),blind:card.blind}});
  if(!rolls?.length)return;row.save=rolls[0].total;await write(card,w);
  if(w.damage)await applyRows(card,w);
 }else{
  if(!owns(user,a.actor)||w.type==='attack'&&!w.hit)return;
  await request.setFlag(MODULE,'processed',true);
  if(w.damageStatus==='rolling')return;
  if(!w.damage){w.damageStatus='rolling';await write(card,w);try{const rolls=await a.rollDamage({isCritical:w.critical,...w.attackOptions},{configure:false},{data:{whisper:card.whisper.map(u=>u.id??u),blind:card.blind}});if(!rolls?.length){w.damageStatus='pending';await write(card,w);return}w.damage=rolls.map(r=>({value:r.total,type:r.options.type,properties:Array.from(r.options.properties??[])}));w.damageStatus='rolled';await write(card,w)}catch(e){w.damageStatus='pending';await write(card,w);throw e}}
  await applyRows(card,w);
 }
}
function renderCard(message,html){
 if(message.flags?.[MODULE]?.[requestKey]){const root=html[0]??html;root.hidden=true;return}
 if(message.flags?.[MODULE]?.combatOrigin){const root=html[0]??html;for(const b of root.querySelectorAll('[data-action="rollAttack"],[data-action="rollDamage"],[data-action="rollSave"]'))b.hidden=true}
 const w=message.flags?.[MODULE]?.[key];if(!w)return;
 const root=html[0]??html,container=root.querySelector('.message-content');if(!container)return;container.replaceChildren();
 const title=document.createElement('strong');title.textContent=w.name;container.append(title);
 if(w.phase==='animation'){const p=document.createElement('p');p.textContent='Заклинание… После затухания появятся спасброски и урон.';container.append(p);return}
 const status=document.createElement('p');status.textContent=w.notice??(w.type==='attack'?(w.attack===undefined?'Бросок попадания…':`${w.attack} · ${w.hit?'Попадание'+(w.critical?' · Критический удар':''):'Промах'}`):w.type==='save'?`Спасбросок ${CONFIG.DND5E.abilities[w.ability]?.label??w.ability} · СЛ ${w.dc}`:'Урон без броска попадания');container.append(status);
 const button=(label,action,targetUuid)=>{const b=document.createElement('button');b.textContent=label;b.dataset.segmAction=action;b.onclick=async()=>{b.disabled=true;try{if(!gm())throw Error('Нужен активный мастер.');await ChatMessage.create({content:'Shadow Edge · запрос броска',whisper:[gm().id],flags:{[MODULE]:{[requestKey]:{workflowUuid:message.uuid,action,targetUuid}}}})}catch(e){ui.notifications.error(e.message);b.disabled=false}};return b};
 for(const row of w.rows){const token=fromUuidSync(row.tokenUuid);if(!token||!game.user.isGM&&token.hidden)continue;const p=document.createElement('p');p.textContent=`${token.name}: ${row.applied?'урон применён':row.save!==null?`${row.save} · ${row.save>=w.dc?'успех':'провал'}`:w.type==='save'?'ожидает спасбросок':'ожидает урон'}`;if(w.type==='save'&&row.save===null&&owns(game.user,token.actor))p.append(button('Спасбросок','save',row.tokenUuid));container.append(p)}
 const a=fromUuidSync(w.activityUuid);if(owns(game.user,a?.actor)&&w.damageStatus!=='miss'&&w.damageStatus!=='blocked'&&w.damageStatus!=='rolling'&&(w.type!=='attack'||w.hit)&&w.rows.some(r=>!r.applied))container.append(button(w.damage?'Применить оставшийся урон':'Бросить урон','damage'));
 if(w.damage){const p=document.createElement('p');p.textContent=`Урон: ${w.damage.map(d=>`${d.value} ${d.type??''}`).join(' + ')}`;container.append(p)}
}
export function registerCombat(){
 if(registered)return;registered=true;
 const handleRequest=message=>{const blocked=fromUuidSync(message.flags?.[MODULE]?.[requestKey]?.workflowUuid)?.flags?.[MODULE]?.[key]?.phase==='animation';enqueue(async()=>{if(!controlsCombat())return;try{if(!blocked)await processCombatRequest(message)}finally{if(game.messages.has(message.id))await message.delete()}})};
 Hooks.on('ready',()=>{if(!game.user.isGM)return;coordinator=false;const claim=async()=>{await game.user.setFlag(MODULE,'combatSession',game.socket.id);coordinator=true;for(const m of game.messages){if(m.flags?.[MODULE]?.combatReady)enqueue(()=>startCombat(m));else if(m.flags?.[MODULE]?.[key]?.phase==='animation')enqueue(async()=>{if(controlsCombat()){const w=clone(m.flags[MODULE][key]);w.phase='resolve';await write(m,w)}});else if(m.flags?.[MODULE]?.[requestKey]&&controlsCombat())handleRequest(m)}};if(globalThis.navigator?.locks)void navigator.locks.request(`${MODULE}:combat:${game.world.id}:${game.user.id}`,async()=>{await claim();await new Promise(resolve=>window.addEventListener('pagehide',resolve,{once:true}));coordinator=false});else void claim()});
 Hooks.on('dnd5e.preUseActivity',(a,usage,dialog,message)=>{
  if(!combatEnabled(a)||!gm()||usage.subsequentActions===false)return;
  const source=a.actor.token?.object??a.actor.getActiveTokens().find(t=>t.controlled)??a.actor.getActiveTokens()[0];
  if(!source){ui.notifications.warn('Разместите токен исполнителя на сцене.');return false}
  if(a.type==='attack'&&game.user.targets.size!==1){ui.notifications.warn('Выберите ровно одну цель атаки.');return false}
  if(a.target?.template?.type){usage.create??={};usage.create.measuredTemplate=true}
  usage.subsequentActions=false;message.data.flags??={};message.data.flags[MODULE]??={};message.data.flags[MODULE].combatOrigin={activityUuid:a.uuid,sceneId:canvas.scene.id,sourceTokenUuid:source.document.uuid,areaExpected:Boolean(a.target?.template?.type)};
 });
 Hooks.on('dnd5e.postUseActivity',(a,usage,results)=>{if(results.message?.flags?.[MODULE]?.combatOrigin)void results.message.setFlag(MODULE,'combatReady',{templateUuid:results.templates?.[0]?.uuid??null,cancelled:Boolean(results.message.flags[MODULE].combatOrigin.areaExpected&&!results.templates?.length)}).catch(e=>ui.notifications.error(e.message))});
 Hooks.on('updateChatMessage',message=>{if(coordinator&&message.flags?.[MODULE]?.combatReady)enqueue(()=>startCombat(message))});
 Hooks.on('createChatMessage',message=>{if(controlsCombat()&&message.flags?.[MODULE]?.[requestKey])handleRequest(message)});
 Hooks.on('renderChatMessageHTML',renderCard);
}

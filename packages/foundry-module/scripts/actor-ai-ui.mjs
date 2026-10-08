import {MODULE,clone,equal,authoringActor} from './core.mjs';
import {actorPlan,safeHTML,persistentProjection} from './adapter.mjs';
import {aiActorSystem,aiSkillNames,aiFieldPaths,aiDefaultField} from './actor-ai-profile.mjs';

// Receipts live in the GM's IndexedDB. Combat resource values are deliberately excluded.
export function aiItemTemplate(item){const data=clone(item.toObject?item.toObject():item);for(const k of ['_id','_stats','sort','folder','ownership'])delete data[k];if(data.system?.uses)delete data.system.uses.spent;for(const a of Object.values(data.system?.activities??{}))if(a.uses)delete a.uses.spent;return data}
const get=(obj,path)=>path.split('.').reduce((o,k)=>o?.[k],obj);
const paths=aiFieldPaths;
const fields=actor=>Object.fromEntries(paths.map(p=>[p,get(actor,p)??null]));
const items=actor=>Object.fromEntries(actor.items.filter(i=>i.flags?.[MODULE]?.importKey).map(i=>[i.flags[MODULE].importKey,aiItemTemplate(i)]));
export const aiInCombat=actor=>game.combats?.some(c=>c.started&&c.combatants.some(t=>t.actorId===actor.id));
export function aiRestorableFields(before,after,current){return Object.fromEntries(Object.entries(before).filter(([key])=>equal(current[key],after[key])&&!equal(before[key],after[key])))}
async function restoreReceipt(actor,receipt){
  let kept=0;const current=items(actor);
  for(const [key,after]of Object.entries(receipt.afterItems??{})){
    const before=receipt.beforeItems[key];if(equal(before,after))continue;
    const existing=actor.items.find(i=>i.flags?.[MODULE]?.importKey===key);
    if(!existing||!equal(current[key],after)){kept++;continue}
    if(!before){await existing.delete();continue}
    const spent=existing.system.uses?.spent,data=clone(before);
    if(existing.type!==data.type){const [replacement]=await actor.createEmbeddedDocuments('Item',[data]);try{await existing.delete()}catch(error){await replacement.delete();throw error}if(spent!==undefined)await replacement.update({'system.uses.spent':spent})}
    else {for(const id of Object.keys(existing.system.activities??{}))if(!data.system?.activities?.[id])data[`system.activities.-=${id}`]=null;await existing.update(data);if(spent!==undefined)await existing.update({'system.uses.spent':spent})}
  }
  for(const [key,before]of Object.entries(receipt.beforeItems))if(receipt.deletedKeys?.includes(key)&&!receipt.afterItems?.[key]&&!actor.items.some(i=>i.flags?.[MODULE]?.importKey===key))await actor.createEmbeddedDocuments('Item',[clone(before)]);
  const update=aiRestorableFields(receipt.beforeFields,receipt.afterFields??{},fields(actor));if(Object.keys(update).length)await actor.update(update);
  return kept;
}
export function createActorAI({connected,request,saveState,importItems,waitClosed}){
  const post=(state,action,body)=>request(state,`v1/actors/ai/${action}`,{method:'POST',body:JSON.stringify(body),signal:AbortSignal.timeout(120000)});
  async function undo(state,entry,actor){
    const receipt=entry.aiReceipt;if(!receipt||!receipt.serverUndone&&receipt.profileId!==entry.record.data.foundryAI?.id)throw Error('В этом браузере нет подходящего снимка отмены.');
    if(aiInCombat(actor))throw Error('Завершите бой перед изменением способностей.');
    if(!await foundry.applications.api.DialogV2.confirm({window:{title:`Отменить AI · ${actor.name}`},content:'<p>Вернуть предыдущее состояние? Последующие ручные изменения и потраченные ресурсы сохраняются.</p>'}))return;
    if(!receipt.serverUndone){await post(state,'undo',{recordKey:entry.record.key,profileId:receipt.profileId});receipt.serverUndone=true;await saveState(state)}
    const kept=await restoreReceipt(actor,receipt),snapshot=await request(state,'v1/snapshot'),record=snapshot.records.find(r=>r.key===entry.record.key);
    entry.record=record??entry.record;entry.itemBaselines=receipt.baselines;entry.projection=receipt.projection;entry.authoring=authoringActor(actor);delete entry.aiReceipt;await saveState(state);ui.notifications.info(`AI-настройка отменена.${kept?' Сохранены изменённые вручную предметы.':''}`);
  }
  async function apply(state,entry,actor,proposal){
    const receipt=entry.aiReceipt?.profileId===proposal.profile.id&&!entry.aiReceipt.complete?entry.aiReceipt:{complete:false,profileId:proposal.profile.id,deletedKeys:[],beforeItems:items(actor),beforeFields:fields(actor),baselines:clone(entry.itemBaselines??{}),projection:clone(entry.projection),afterItems:items(actor),afterFields:fields(actor)};
    await post(state,'apply',{recordKey:entry.record.key,proposalId:proposal.proposalId});
    entry.aiReceipt=receipt;entry.record.data.foundryAI=proposal.profile;await saveState(state);
    try{
      const snapshot=await request(state,'v1/snapshot'),record=snapshot.records.find(r=>r.key===entry.record.key);if(!record)throw Error('Актёр больше не находится в кампании.');
      const plan=await actorPlan(record,snapshot.spells??[]),system=aiActorSystem(record),update={};
      // Apply only AI-owned actor fields, preserving every other statistic and combat resource.
      for(const path of paths){const value=get({system},path);if(value!==undefined){const current=get(actor,path),baseline=get(entry.projection,path)??aiDefaultField(path);if(!equal(current,baseline)&&!equal(current,value)){ui.notifications.warn(`Сохранена ручная настройка: ${actor.name} · ${path}`);continue}update[path]=value}}
      if(Object.keys(update).length)await actor.update(update);
      const wanted=new Set(plan.items.map((i,index)=>i.flags?.[MODULE]?.inventoryKey??i.flags?.[MODULE]?.spellId??`ability-${index}`));
      for(const item of [...actor.items]){const flag=item.flags?.[MODULE],key=flag?.importKey,baseline=entry.itemBaselines?.[key];if(flag?.aiAdded&&!wanted.has(key)&&baseline&&equal(persistentProjection(item,baseline),baseline)){await item.delete();receipt.deletedKeys.push(key);delete entry.itemBaselines[key]}}
      await importItems(actor,plan.items,entry);entry.record=record;
      entry.projection??={};for(const path of paths){const keys=path.split('.');let cursor=entry.projection;for(const key of keys.slice(0,-1))cursor=cursor[key]??={};const desired=get({system},path);if(desired!==undefined)cursor[keys.at(-1)]=desired}
      entry.authoring=authoringActor(actor);entry.adapterVersion=11;receipt.complete=true;
    }finally{receipt.afterItems=items(actor);receipt.afterFields=fields(actor);await saveState(state)}
  }
  async function launch(single){
    const state=await connected(),snapshot=await request(state,'v1/snapshot'),candidates=[];
    for(const record of snapshot.records){if(!['npc','monster'].includes(record.kind))continue;const entry=state.records[record.key];const actor=entry?.uuid?await fromUuid(entry.uuid):null;if(actor&&entry.itemBaselines&&(!single||actor.id===single.id))candidates.push({record,entry,actor})}
    if(!candidates.length)throw Error('Сначала импортируйте НПС и монстров кнопкой «Обновить с сайта».');
    const config=await waitClosed({window:{title:single?`AI · ${single.name}`:'AI · НПС и монстры кампании'},content:`<p>Предложения показываются перед применением. Новые запросы используют подписку и AI сайта; сохранённый профиль используется повторно.</p><label>Режим<select name="mode"><option value="configure">Настроить существующее</option><option value="enrich">Дополнить по описанию</option></select></label><label>Описание / указания AI для выбранных актёров<textarea name="instructions" rows="4" maxlength="4000" placeholder="Например: распознай заклинания из особенностей; адский огонь должен быть зелёным. В режиме дополнения можно описать новые способности и лут."></textarea></label><label>Редакция<select name="edition"><option value="2014">2014</option><option value="2024">2024</option></select></label><label><input type="checkbox" name="force">Запросить новый вариант вместо сохранённого</label><div class="shadow-edge-preview">${candidates.map((x,i)=>`<label><input type="checkbox" name="actor" value="${i}" checked>${safeHTML(x.actor.name)}${aiInCombat(x.actor)?' · в бою (будет пропущен)':''}</label>`).join('')}</div>`,buttons:[{action:'preview',label:'Предпросмотр',default:true,callback:(_e,_b,d)=>({mode:d.element.querySelector('[name=mode]').value,edition:d.element.querySelector('[name=edition]').value,instructions:d.element.querySelector('[name=instructions]').value.trim(),force:d.element.querySelector('[name=force]').checked,selected:[...d.element.querySelectorAll('[name=actor]:checked')].map(el=>candidates[Number(el.value)])})},...(single&&candidates[0].entry.aiReceipt?[{action:'undo',label:'Отменить последнюю AI-настройку',callback:()=>({undo:true})}]:[]),{action:'cancel',label:'Отмена',callback:()=>null}]});
    if(!config)return;if(config.undo)return undo(state,candidates[0].entry,candidates[0].actor);
    const root=document.createElement('section');root.className='shadow-edge-import-progress';root.setAttribute('role','status');const stage=document.createElement('div'),bar=document.createElement('progress'),cancel=document.createElement('button');cancel.textContent='Остановить после текущего актёра';let stopped=false;cancel.onclick=()=>{stopped=true;cancel.disabled=true};root.append(stage,bar,cancel);document.body.append(root);bar.max=Math.max(config.selected.length,1);let count=0,applied=0;const errors=[];
    try{for(const {record,entry,actor}of config.selected){if(stopped)break;stage.textContent=`AI · ${actor.name} · ${count+1} из ${config.selected.length} · Осталось ${config.selected.length-count}`;
      try{if(aiInCombat(actor))throw Error('Настройка отложена до конца боя.');const proposal=await post(state,'preview',{recordKey:record.key,mode:config.mode,edition:config.edition,force:config.force,instructions:config.instructions}),p=proposal.profile;
        const spellNames=new Map((proposal.spells??[]).map(s=>[s.id,s.name]));
        const kinds={attack:'атака',save:'спасбросок',heal:'лечение',damage:'урон',manual:'вручную'},abilityNames={str:'Сила',dex:'Ловкость',con:'Телосложение',int:'Интеллект',wis:'Мудрость',cha:'Харизма'};
        const slots=aiActorSystem({...record,data:{...record.data,foundryAI:p}}).spells;
        const lines=[...(p.abilities??[]).map(a=>`${a.index<0?'Добавить':'Настроить'}: ${a.name} · ${kinds[a.mechanics.kind]??'вручную'} · ${a.toHit||''} ${a.damage||''}${a.mechanics.kind==='save'?` · Сл ${a.mechanics.saveDc} (${abilityNames[a.mechanics.saveAbility]})`:''}${a.mechanics.range?` · дальность ${a.mechanics.range} футов`:''}${a.radius?` · радиус ${a.radius} футов`:''}${a.dailyUses?` · ${a.dailyUses}/день`:''} · ${a.animation||'автовыбор анимации'}${a.animationColor?' · цвет '+a.animationColor:''}${a.itemType==='spell'?' · заклинание':''}${a.description?` · ${a.description}`:''}`),...(p.spells??[]).map(s=>`Заклинание: ${spellNames.get(s.id)??s.id} · ${s.method==='innate'?`врождённое (${s.dailyUses||'без лимита'}/день)`:'ячейки'}`),...(p.skills??[]).map(s=>`Навык: ${aiSkillNames[s.id]??s.id} · ${['без владения','владение','экспертиза'][s.proficient]}`),...(p.loot??[]).map(l=>`Лут: ${l.name} × ${l.quantity} · ${l.description}`),...(p.casterLevel?[`Предложенный уровень полного заклинателя: ${p.casterLevel}`]:[]),...(p.castingAbility?[`Характеристика заклинаний: ${abilityNames[p.castingAbility]}`]:[]),...(slots?[`Ячейки: ${Object.entries(slots).map(([level,s])=>`${level.replace('spell','')} ур. — ${s.override}`).join(', ')} (текущий расход сохраняется)`]:[]),...(p.notes??[])];
        const previewPlan=await actorPlan({...record,data:{...record.data,foundryAI:p}},proposal.spells??[]);for(const item of previewPlan.items)if(item.type==='spell'&&item.flags?.[MODULE]?.coverage==='manual')lines.push(`Проверить вручную: ${item.name} — ${item.flags[MODULE].reason}`);
        const decision=await waitClosed({window:{title:`Предпросмотр AI · ${actor.name}`},content:`<p>${config.mode==='enrich'?'Дополнения по описанию: проверьте баланс перед применением.':'Настройка существующих способностей.'}${proposal.cached?' Использован сохранённый профиль.':''}</p><div class="shadow-edge-preview">${lines.map(line=>safeHTML(line)).join('')}</div><p>Сложные условия и эффекты могут требовать ручного решения мастера.</p>`,buttons:[{action:'apply',label:'Применить',default:true},{action:'skip',label:'Пропустить'},{action:'stop',label:'Завершить'}]});
        if(decision==='stop'||!decision){stopped=true;break}if(decision==='apply'){if(entry.record.data.foundryAI?.id===p.id&&entry.aiReceipt?.complete!==false){ui.notifications.info('Сохранённый профиль уже применён; повторные дополнения не создаются.')}else{await apply(state,entry,actor,proposal);applied++}}
      }catch(error){errors.push(`${actor.name}: ${error.message}`)}finally{count++;bar.value=count}
    }}finally{stage.textContent=`AI: обработано ${count} из ${config.selected.length}, применено ${applied}.${stopped?' Остановлено.':''}`;cancel.textContent='Закрыть';cancel.disabled=false;cancel.onclick=()=>root.remove();for(const message of errors){const line=document.createElement('div');line.textContent=message;root.append(line)}}
  }
  return {launch};
}

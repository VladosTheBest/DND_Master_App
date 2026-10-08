import {MODULE,clone,equal,mergeThree,validBaseURL,authoringActor,exportEntity,exportJournal,sceneLevel,plainText} from "./core.mjs";
import {loadState,saveState} from "./storage.mjs";
import {actorPlan,journalPlan,scenePlan,persistentProjection,safeHTML} from "./adapter.mjs";
import {registerAnimations,animationStatus} from "./animations.mjs";
import {registerCombat} from "./combat.mjs";
import {mapAuthoring,importMapLabels} from "./map-labels.mjs";
const sceneAuthoring=(record,doc)=>record?.kind==="world-map"?mapAuthoring(doc):sceneLevel(doc);

import {createDemoScene} from "./demo.mjs";
const DialogV2=()=>foundry.applications.api.DialogV2;
let busy=false;
function exchangeGM(){const gm=game.users.filter(u=>u.active&&u.isGM).sort((a,b)=>a.id.localeCompare(b.id))[0];if(gm?.id!==game.user.id)throw Error(`Обмен выполняет активный мастер ${gm?.name??"—"}.`)}
async function run(task){if(busy)return;busy=true;try{exchangeGM();await task()}catch(e){ui.notifications.error(e.message);console.error(`${MODULE}: operation failed`,e.message)}finally{busy=false}}
async function request(state,path,options={}){
  const headers=new Headers(options.headers);if(state.token)headers.set("Authorization",`Bearer ${state.token}`);
  if(options.body&&!(options.body instanceof FormData))headers.set("Content-Type","application/json");
  const response=await fetch(`${state.base}/api/integrations/foundry/${path}`,{...options,headers,credentials:"omit",signal:AbortSignal.timeout(60000)});
  if(!response.ok){let data;try{data=await response.json()}catch{}throw Error(data?.error?.message??`HTTP ${response.status}`)}return response.json().then(b=>b.data);
}
async function beginConnection(){
  const base=await DialogV2().prompt({window:{title:"Подключить Shadow Edge GM"},content:'<label>Адрес сайта<input name="base" type="url" placeholder="https://…" required></label>',ok:{label:"Открыть подтверждение",callback:(_event,_button,dialog)=>dialog.element.querySelector('[name="base"]').value}});
  if(!base)return;const state={base:validBaseURL(base),token:crypto.randomUUID().replaceAll("-","")+crypto.randomUUID().replaceAll("-",""),records:{}};
  const bytes=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(state.token));const tokenHash=Array.from(new Uint8Array(bytes),v=>v.toString(16).padStart(2,"0")).join("");
  const pairing=await request(state,"pairings",{method:"POST",body:JSON.stringify({tokenHash})});state.pairing=pairing.id;await saveState(state);
  const url=new URL(pairing.url,state.base).href;window.open(url,"_blank","noopener");
  await DialogV2().wait({window:{title:"Подтверждение подключения"},content:`<p>Подтвердите кампанию на сайте, затем нажмите «Завершить подключение» в модуле.</p><a href="${url}" target="_blank" rel="noopener">Открыть страницу подтверждения</a>`,buttons:[{action:"ok",label:"Понятно",default:true}]});
}
async function finishConnection(){const state=await loadState();if(!state.pairing)throw Error("Сначала начните подключение.");const result=await request(state,`pairings/${encodeURIComponent(state.pairing)}`);if(!result.approved)throw Error("Подтвердите кампанию на сайте.");const snapshot=await request(state,"v1/snapshot");state.campaignId=snapshot.campaignId;state.title=snapshot.title;state.connectionId=result.connectionId;delete state.pairing;await saveState(state);ui.notifications.info(`Подключено: ${snapshot.title}. Нажмите «Обновить с сайта».`)}
async function connected(){const s=await loadState();if(!s.campaignId)throw Error("Сначала подключите кампанию.");return s}
async function folder(type,title){let f=game.folders.find(f=>f.type===type&&f.name===title);if(!f)f=await Folder.create({name:title,type,ownership:{default:0}});return f.id}
const tracked=(doc,state)=>doc.flags?.[MODULE]?.campaignId===state.campaignId && doc.flags?.[MODULE]?.site===state.base;
function findDocument(entry){return entry?.uuid?fromUuid(entry.uuid):null}
async function localAsset(state,url){
  if(!url)return "";const cached=state.assets?.[url];if(cached)return cached;
  if(!url.startsWith("/uploads/")&&!url.startsWith("/api/campaign-templates/"))return "";
  const response=await fetch(`${state.base}/api/integrations/foundry/v1/assets?url=${encodeURIComponent(url)}`,{headers:{Authorization:`Bearer ${state.token}`},credentials:"omit",signal:AbortSignal.timeout(60000)});if(!response.ok)throw Error("Не удалось получить изображение кампании.");
  const blob=await response.blob(),digest=await crypto.subtle.digest("SHA-256",await blob.arrayBuffer());const name=Array.from(new Uint8Array(digest),v=>v.toString(16).padStart(2,"0")).join("")+({"image/png":".png","image/jpeg":".jpg","image/webp":".webp","video/webm":".webm","video/mp4":".mp4"}[blob.type]??".bin");
  const root="shadow-edge-gm",path=`${root}/${state.campaignId}`;const Picker=foundry.applications.apps.FilePicker.implementation;
  for(const dir of [root,path]){try{await Picker.createDirectory("data",dir)}catch{await Picker.browse("data",dir)}}
  const result=await Picker.upload("data",path,new File([blob],name,{type:blob.type}),{}, {notify:false});state.assets??={};state.assets[url]=result.path;return result.path;
}
async function updateProjection(doc,projection,previous){
  const local=persistentProjection(doc,previous??projection),result=mergeThree(previous??projection,local,projection);
  if(result.conflicts.length){const remote=await DialogV2().confirm({window:{title:`Конфликт: ${doc.name}`},content:`<p>Изменены с обеих сторон: ${safeHTML(result.conflicts.join(", "))}</p><p>Применить версию сайта? «Нет» сохраняет местные значения конфликтующих полей.</p>`});if(remote)result.value=projection}
  // Applying authoring data must not reset combat resources.
  delete result.value.active;
  await doc.update(result.value);return persistentProjection(doc,projection);
}
async function importItems(actor,items,state){
  const previous=state.itemBaselines??{};const next={...previous};
  for(let index=0;index<items.length;index++){
    const source=clone(items[index]);if(source.system?.uses)delete source.system.uses.spent;for(const activity of Object.values(source.system?.activities??{}))if(activity.uses)delete activity.uses.spent;
    const key=source.flags?.[MODULE]?.spellId??(source.flags?.[MODULE]?.sourceClass?"class":`ability-${index}`);
    let existing=actor.items.find(i=>i.flags?.[MODULE]?.importKey===key);source.flags??={};source.flags[MODULE]={...source.flags[MODULE],importKey:key};
    if(existing){const template=clone(source);delete template._id;const local=persistentProjection(existing,template);const baseline=previous[key];if(!baseline || !equal(local,baseline)){ui.notifications.warn(`Сохранена местная способность: ${existing.name}.`);continue};const spent=existing.system.uses?.spent;await existing.update(template);if(spent!==undefined)await existing.update({"system.uses.spent":spent})}else{[existing]=await actor.createEmbeddedDocuments("Item",[source])}
    next[key]=persistentProjection(existing,source);
  }state.itemBaselines=next;
}
export async function refresh(){
  const state=await connected(),snapshot=await request(state,"v1/snapshot");if(snapshot.schemaVersion!==1)throw Error("Версия API не поддерживается.");
  const deferred=[];const nativePlayers=new Set(snapshot.records.filter(r=>r.kind==="character").map(r=>r.data.playerId));
  for(const record of snapshot.records){
    if(record.kind==="player"&&nativePlayers.has(record.id)&&!record.data.foundryCharacter)continue;
    // An external sheet overrides the imported wizard sheet, but never rewrites wizard choices.
    if(record.kind==="character"&&snapshot.records.some(r=>r.id===record.data.playerId&&r.data.foundryCharacter))continue;
    const actorKind=["character","player","npc","monster"].includes(record.kind);
    const sceneKind=["session-map","world-map"].includes(record.kind);
    const levels=record.kind==="session-map"?record.data.levels:[null];
    for(const level of levels){
      const key=level?`${record.key}/${level.id}`:record.key;
      const overridden=record.data.foundryCharacter?Object.values(state.records).find(e=>e.record.kind==="character"&&e.record.data.playerId===record.id):null;
      const entry=state.records[key]??overridden;let doc=await findDocument(entry);
      if(!doc){const collection=actorKind?game.actors:sceneKind?game.scenes:game.journal;doc=collection.find(d=>tracked(d,state)&&d.flags?.[MODULE]?.sourceKey===record.key&&(!level||d.flags[MODULE].levelId===level.id));if(!doc)doc=collection.find(d=>snapshot.aliases?.[d.uuid]===record.id&&(!level||!d.flags?.[MODULE]?.levelId||d.flags[MODULE].levelId===level.id))}
      if(doc && entry?.record.hash===record.hash&&entry.adapterVersion===5)continue;
      const localChanged=doc&&entry?.authoring&&!equal(actorKind?authoringActor(doc):sceneKind?sceneAuthoring(record,doc):exportJournal(entry.record.data,doc),entry.authoring);
      if(actorKind&&doc&&game.combats.some(c=>c.started&&c.combatants.some(x=>x.actorId===doc.id))){deferred.push(record.title);continue}
      let plan=actorKind?await actorPlan(record,snapshot.spells??[]):null;
      const projection=plan?.projection??(sceneKind?scenePlan(record,level):journalPlan(record));
      projection.flags[MODULE]={...projection.flags[MODULE],campaignId:state.campaignId,site:state.base};
      if(projection.img){projection.img=await localAsset(state,projection.img)||"icons/svg/mystery-man.svg";if(actorKind)projection.prototypeToken.texture={src:projection.img}}
      if(projection.background?.src)projection.background.src=await localAsset(state,projection.background.src)||projection.background.src;
      if(doc)await updateProjection(doc,projection,entry?.projection);
      else{projection.folder=await folder(actorKind?"Actor":sceneKind?"Scene":"JournalEntry",`Shadow Edge · ${snapshot.title}`);const creation=clone(projection);if(actorKind)creation.system.attributes.hp.value=creation.system.attributes.hp.max;doc=await (actorKind?Actor:sceneKind?Scene:JournalEntry).create(creation)}
      const saved={...entry,uuid:doc.uuid,record:clone(record),projection:clone(projection),adapterVersion:5};
      if(plan)await importItems(doc,plan.items,saved);
      if(record.kind==="world-map")await importMapLabels(doc,record.data.labels,saved,(name,fields)=>DialogV2().confirm({window:{title:`Конфликт подписи: ${name}`},content:`<p>Изменены: ${safeHTML(fields.join(", "))}. Применить версию сайта?</p>`}));
      saved.authoring=localChanged?entry.authoring:actorKind?authoringActor(doc):sceneKind?sceneAuthoring(record,doc):exportJournal(record.data,doc);
      state.records[key]=saved;await saveState(state);
      // GM text never lives on an Actor owned by a player.
      if(actorKind&&(record.data.content||entry?.notesText!==undefined)){let notes=game.journal.find(j=>tracked(j,state)&&j.flags?.[MODULE]?.gmFor===doc.id);const changed=notes&&entry?.notesText!==undefined&&entry.notesText!==plainText(Array.from(notes.pages)[0]?.text?.content);const data={name:`GM · ${record.title}`,ownership:{default:0},pages:[{name:"Заметки мастера",type:"text",text:{content:safeHTML(record.data.content),format:1}}],flags:{[MODULE]:{campaignId:state.campaignId,site:state.base,gmFor:doc.id}}};if(!notes){notes=await JournalEntry.create(data)}else if(!changed){const page=Array.from(notes.pages)[0];if(page)await page.update({"text.content":safeHTML(record.data.content)})}saved.notesText=changed?entry.notesText:plainText(Array.from(notes.pages)[0]?.text?.content);await saveState(state)}
    }
  }
  for(const [key,entry] of Object.entries(state.records)){if(!snapshot.records.some(r=>r.key===entry.record.key)){entry.archived=true}}
  await saveState(state);ui.notifications.info(`Обновление завершено.${deferred.length?` Отложено до конца боя: ${deferred.join(", ")}.`:""}`);
}
async function uploadAsset(state,path){
  if(!path)return "";const known=Object.entries(state.assets??{}).find(([,local])=>local===path);if(known)return known[0];
  const u=new URL(path,window.location.origin);if(u.origin!==window.location.origin)throw Error("Для экспорта загрузите внешнее изображение в хранилище Foundry.");
  const response=await fetch(u,{credentials:"same-origin",signal:AbortSignal.timeout(60000)});if(!response.ok)throw Error("Не удалось прочитать медиа Foundry.");const blob=await response.blob();const form=new FormData();form.set("file",new File([blob],u.pathname.split("/").at(-1)||"map.png",{type:blob.type}));const result=await request(state,"v1/assets",{method:"POST",body:form});state.assets??={};state.assets[result.url]=path;await saveState(state);return result.url;
}
export async function exportSite(){
  const state=await connected(),candidates=[];const byUUID=new Map(Object.values(state.records).map(e=>[e.uuid,e]));
  for(const collection of [game.actors,game.scenes,game.journal])for(const doc of collection){
    if(doc.flags?.[MODULE]?.gmFor)continue;
    if(doc.flags?.[MODULE]?.demo)continue;
    if(doc.flags?.[MODULE]?.campaignId && !tracked(doc,state))continue;
    const entry=byUUID.get(doc.uuid),record=entry?.record;
    const kind=record?.kind??(doc.documentName==="Actor"?(doc.type==="character"?"character":"npc"):doc.documentName==="Scene"?"session-map":"lore");
    const current=doc.documentName==="Actor"?authoringActor(doc):doc.documentName==="Scene"?sceneAuthoring(record,doc):exportJournal(record?.data,doc);
    const notes=doc.documentName==="Actor"?game.journal.find(j=>tracked(j,state)&&j.flags?.[MODULE]?.gmFor===doc.id):null;
    const notesText=notes?plainText(Array.from(notes.pages)[0]?.text?.content):undefined;
    if(entry&&equal(current,entry.authoring)&&notesText===entry.notesText)continue;
    candidates.push({doc,entry,kind,current,notesText});
  }
  if(!candidates.length){ui.notifications.info("Нет изменений для экспорта.");return}
  const content=`<p>Выберите записи. Текущее состояние боя не экспортируется.</p><div class="shadow-edge-preview">${candidates.map((x,i)=>`<label><input type="checkbox" name="pick" value="${i}" ${x.entry?"checked":""}> ${safeHTML(x.doc.name)} ${x.entry?"(изменено)":"(новое)"}${!x.entry&&x.doc.documentName==="JournalEntry"?`<select name="kind-${i}"><option value="lore">Лор</option><option value="location">Локация</option><option value="quest">Квест</option><option value="prep">Подготовка</option></select>`:""}</label>`).join("")}</div>`;
  const selected=await DialogV2().wait({window:{title:"Экспорт на сайт — выбор записей"},content,buttons:[{action:"preview",label:"Предпросмотр",default:true,callback:(_e,_b,d)=>Array.from(d.element.querySelectorAll('[name="pick"]:checked')).map(el=>{const x=candidates[Number(el.value)];return {...x,kind:d.element.querySelector(`[name="kind-${el.value}"]`)?.value??x.kind}})},{action:"cancel",label:"Отмена",callback:()=>null}]});
  if(!selected?.length)return;
  const changes=[];
  for(const x of selected){let data;
    if(x.doc.documentName==="Actor"){data=x.kind==="character"?x.current:exportEntity(x.entry?.record.data,x.doc);if(x.kind!=="character"&&x.notesText!==undefined)data.content=x.notesText;if(x.kind!=="character"&&x.doc.img&&!x.doc.img.startsWith("icons/")&&!x.doc.img.startsWith("systems/dnd5e/icons/"))data.art={url:await uploadAsset(state,x.doc.img)}}
    else if(x.doc.documentName==="Scene"){const l=clone(x.current);l.imageUrl=await uploadAsset(state,l.imageUrl);if(x.kind==="world-map"){data={...clone(x.entry.record.data),title:x.doc.name,imageUrl:l.imageUrl,width:l.width,height:l.height,labels:l.labels}}else{data={title:x.entry?.record.title??x.doc.name,levels:[l]};if(x.entry?.record.data.levels){data=clone(x.entry.record.data);const index=data.levels.findIndex(v=>v.id===x.doc.flags[MODULE].levelId);const before=data.levels[index];if(x.doc.name===`${data.title} — ${before.name}`)l.name=before.name;data.levels[index]={...before,...l};l.id=x.doc.flags[MODULE].levelId;data.levels[index].id=l.id}}}
    else{data=exportJournal(x.entry?.record.data,x.doc);if(x.kind==="prep")data={title:x.doc.name,focus:data.content??data.focus??"",status:"draft",location:""}}
    changes.push({key:x.doc.uuid,id:x.entry?.record.id??"",kind:x.kind,baseHash:x.entry?.record.hash??"",data});
  }
  // Several floors share one source map: combine them into one change.
  const grouped=[];for(const change of changes){const other=grouped.find(x=>x.id&&x.id===change.id&&x.kind===change.kind);if(other&&change.kind==="session-map"){for(const l of change.data.levels){const original=selected.find(s=>s.doc.uuid===change.key)?.doc.flags[MODULE].levelId;if(l.id===original){const i=other.data.levels.findIndex(x=>x.id===l.id);other.data.levels[i]=l}}}else grouped.push(change)}
  let input={requestId:crypto.randomUUID(),changes:grouped};let preview=await request(state,"v1/export/preview",{method:"POST",body:JSON.stringify(input)});
  const conflicts=preview.items.filter(i=>i.status==="conflict");
  if(conflicts.length){const overwrite=await DialogV2().confirm({window:{title:"Изменения на сайте"},content:`${conflicts.map(i=>safeHTML(`${i.title||i.key}: ${i.message}`)).join("")}<p>Сохранить для этих записей версию Foundry?</p>`});if(!overwrite)return;for(const item of conflicts)input.changes.find(c=>c.key===item.key).baseHash=item.currentHash;preview=await request(state,"v1/export/preview",{method:"POST",body:JSON.stringify(input)})}
  const confirmed=await DialogV2().confirm({window:{title:"Экспорт на сайт — подтверждение"},content:preview.items.map(i=>safeHTML(`${i.title||i.key}: ${i.status}${i.message?` — ${i.message}`:""}`)).join("")});if(!confirmed||!preview.canCommit)return;
  const result=await request(state,"v1/export/commit",{method:"POST",body:JSON.stringify(input)});
  const snapshot=await request(state,"v1/snapshot");
  for(const x of selected){const id=result.mappings[x.doc.uuid]??result.mappings[grouped.find(c=>c.id===x.entry?.record.id)?.key];if(!id)continue;const playerId=x.kind==="character"?x.entry?.record.data.playerId??id:id;const record=snapshot.records.find(r=>r.id===playerId&&r.kind==="player"&&x.kind==="character")??snapshot.records.find(r=>r.id===id&&r.kind===x.kind);if(!record)continue;const key=record.kind==="session-map"?`${record.key}/${x.doc.flags?.[MODULE]?.levelId??record.data.levels[0].id}`:record.key;
    await x.doc.update({[`flags.${MODULE}.sourceKey`]:record.key,[`flags.${MODULE}.kind`]:record.kind,[`flags.${MODULE}.site`]:state.base,[`flags.${MODULE}.campaignId`]:state.campaignId});if(x.entry&&x.entry.record.key!==record.key)delete state.records[x.entry.record.key];state.records[key]={...x.entry,uuid:x.doc.uuid,record,authoring:x.current,notesText:x.notesText};
  }
  await saveState(state);ui.notifications.info("Экспорт сохранён на сайте.");
}
async function configureAutomation(){
  if(Number.parseInt(game.system.version,10)>=6&&game.modules.get("midi-qol")?.active&&!game.modules.get("midi-qol").version.startsWith("14.6."))throw Error("Для dnd5e 6 нужен совместимый Midi-QOL 14.6.x. Обмен с сайтом работает без него.");
  if(!game.modules.get("midi-qol")?.active)throw Error("Встроенные расчёты работают без дополнений. Эта кнопка предназначена для необязательного профиля Midi-QOL.");
  const accepted=await DialogV2().confirm({window:{title:"Настроить полный расчёт"},content:"<p>Включить автоматические атаки, спасброски, применение урона и расход ресурсов? Текущие настройки будут сохранены для восстановления.</p>"});if(!accepted)return;
  const old=clone(game.settings.get("midi-qol","ConfigSettings"));if(!game.settings.get(MODULE,"automationBackup"))await game.settings.set(MODULE,"automationBackup",old);
  await game.settings.set("midi-qol","ConfigSettings",{...old,autoRollAttack:true,gmAutoAttack:true,autoRollDamage:"always",gmAutoDamage:"always",autoCheckHit:"all",autoCheckSaves:"all",autoApplyDamage:"yes",consumeResource:"both",gmConsumeResource:"both",autoItemEffects:"applyRemove",concentrationAutomation:true});ui.notifications.info("Профиль автоматизации сохранён.");
}
async function panel(){const state=await loadState();const abilities=game.actors.filter(a=>tracked(a,state)).flatMap(a=>a.items.contents).filter(i=>i.flags?.[MODULE]?.coverage);const manual=abilities.filter(i=>i.flags[MODULE].coverage==="manual").length;await DialogV2().wait({window:{title:"Shadow Edge GM"},content:`<div class="shadow-edge-panel"><p>${safeHTML(state.title??"Кампания не подключена")}</p><p>Обмен выполняется только по кнопкам.</p><p>${safeHTML(animationStatus())}</p><p>Способности: ${abilities.length-manual} с частичной настройкой, ${manual} для ручного расчёта. Сложные условия и эффекты требуют проверки мастером.</p></div>`,buttons:[{action:"connect",label:"Подключить",callback:()=>run(beginConnection)},{action:"finish",label:"Завершить подключение",callback:()=>run(finishConnection)},{action:"refresh",label:"Обновить с сайта",callback:()=>run(refresh)},{action:"export",label:"Экспортировать на сайт",callback:()=>run(exportSite)},{action:"demo",label:"Тестовая сцена анимаций",callback:()=>run(createDemoScene)},{action:"setup",label:"Дополнительно: Midi-QOL",callback:()=>run(configureAutomation)},{action:"restore",label:"Восстановить настройки",callback:()=>run(async()=>{const backup=game.settings.get(MODULE,"automationBackup");if(backup){await game.settings.set("midi-qol","ConfigSettings",backup);await game.settings.set(MODULE,"automationBackup",null)}})},{action:"disconnect",label:"Отключить в браузере",callback:()=>run(async()=>saveState({records:{}}))}]})}
Hooks.once("init",()=>{game.settings.register(MODULE,"automationBackup",{scope:"world",config:false,type:Object,default:null});registerCombat()});
Hooks.once("ready",()=>{registerAnimations();registerCombat();if(!game.user.isGM)return;const button=document.createElement("button");button.className="shadow-edge-launch";button.textContent="Shadow Edge GM";button.onclick=()=>panel().catch(e=>ui.notifications.error(e.message));document.body.append(button)});

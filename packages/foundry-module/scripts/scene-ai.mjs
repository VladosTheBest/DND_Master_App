import {topologySnapshot,replaceSceneTopology} from './scene-topology.mjs';
import {sceneCreation,sceneBackground,setSceneBackground,verifySceneImage} from './scene-background.mjs';
import {watchSceneJob,scenePreviewHTML,renderScenePreview,createSceneMonitor} from './scene-job-ui.mjs';
import {MODULE,clone,sceneLevel} from './core.mjs';
import {scenePlan,safeHTML} from './adapter.mjs';
import {managedFolder,folderPath} from './presentation.mjs';

export function sceneAIRecord(map){return {key:`session-map:${map.id}`,id:map.id,kind:'session-map',title:map.title,data:map}}
export function createSceneAI({connected,request,saveState,localAsset,waitClosed,readState}){
 let opening=false;
 async function open(){if(opening)return;opening=true;try{return await launch()}finally{opening=false}}
 const monitor=readState?createSceneMonitor({readState,request,onOpen:()=>open().catch(e=>ui.notifications.error(e.message))}):null;
 async function analyzeCurrent(wallMode="auto",scene=canvas.scene){
  const state=await connected();if(state.sceneAI){ui.notifications.info('Сначала завершите или отклоните текущую AI-задачу.');return open()}
  const tracked=Object.values(state.records??{}).find(r=>r.uuid===scene?.uuid),map=tracked?.record?.data;
  const source=map?.levels?.find(l=>l.id===scene.flags?.[MODULE]?.levelId)??map?.levels?.[0];
  if(!scene||!source||sceneBackground(scene)!==tracked.projection?.background?.src)throw Error('Для анализа откройте сцену, импортированную с сайта, с исходным фоном. Изменённый фон сначала загрузите в мастерскую сцен.');
  const native=sceneLevel(scene);
  state.sceneAI={input:{wallMode,requestId:crypto.randomUUID(),title:map.title,prompt:map.generation?.prompt||`Распознай стены, двери и свет на существующей карте: ${map.title}`,columns:native.columns||30,rows:native.rows||20,distance:native.gridDistance||5,weather:native.weather||'none',referenceUrl:source.imageUrl,improve:false,topology:true,animatedDoors:map.generation?.animatedDoors??source.walls?.some(w=>!!w.doorVisual)},target:{uuid:scene.uuid,geometry:topologySnapshot(scene)}};
  await saveState(state);return open();
 }
 async function launch(){
  monitor?.stop();
  const state=await connected();let pending=state.sceneAI;
  // DialogV2 falls back to the button action when a callback returns null.
  // Repair drafts written by older builds after Cancel, before making any request.
  if(pending&&(!pending.input||typeof pending.input!=='object')){delete state.sceneAI;pending=null;await saveState(state)}
  if(pending?.input){state.sceneDraft=clone(pending.input);await saveState(state)}
  if(!pending){
   const input=await waitClosed({window:{title:'Создать сцену с AI'},position:{width:600,height:'auto'},render:(_e,d)=>{const saved=state.sceneDraft;if(!saved)return;for(const name of ['title','prompt','columns','rows','distance','weather','wallMode']){const el=d.element.querySelector(`[name=${name}]`);if(el&&saved[name]!=null)el.value=String(saved[name]);}},content:'<p>AI создаёт фон с пустыми дверными проёмами, распознаёт стены, двери и источники света. Отдельные створки открываются по штатному значку двери. Положение и петли: «Настроить двери сцены» в панели модуля. Задача выполняется на сервере, пока вы ведёте игру. Используется Codex или подписка и провайдер изображений сайта.</p><label>Название<input name="title" maxlength="160" placeholder="Необязательно"></label><label>Описание локации<textarea name="prompt" minlength="10" maxlength="4000" rows="6" required placeholder="Например: заброшенная таверна, большой зал, кухня, подвал и выход во двор. Вид строго сверху."></textarea></label><label>Клеток по горизонтали<input name="columns" type="number" min="10" max="100" value="30" required></label><label>Клеток по вертикали<input name="rows" type="number" min="10" max="100" value="20" required></label><label>Футов в клетке<input name="distance" type="number" value="5" readonly></label><label>Метод стен<select name="wallMode"><option value="auto">Авто: пещеры по пикселям, здания через AI</option><option value="cave">Пещера с тёмной скалой — по пикселям</option><option value="ai">AI-разметка</option></select></label><label>Погода<select name="weather"><option value="none">Без осадков</option><option value="rain">Дождь</option><option value="storm">Гроза</option><option value="snow">Снег</option><option value="fog">Туман</option></select></label><p>Ориентировочно 2–8 минут. Проверьте разметку в предпросмотре; после импорта её можно поправить инструментами Foundry.</p>',buttons:[{action:'generate',label:'Сгенерировать сцену',default:true,callback:(_e,_b,d)=>({requestId:crypto.randomUUID(),title:d.element.querySelector('[name=title]').value.trim()||d.element.querySelector('[name=prompt]').value.trim().slice(0,80),prompt:d.element.querySelector('[name=prompt]').value.trim(),columns:Number(d.element.querySelector('[name=columns]').value),rows:Number(d.element.querySelector('[name=rows]').value),distance:5,topology:true,wallMode:d.element.querySelector('[name=wallMode]').value,weather:d.element.querySelector('[name=weather]').value})},{action:'cancel',label:'Отмена',type:'button',callback:()=>false}]});if(!input||typeof input!=='object')return;
   // Save the request before transport: retrying a lost response reuses the same paid request.
   pending=state.sceneAI={input};state.sceneDraft=clone(input);await saveState(state);
  }
  if(!pending.jobId){const job=await request(state,'v1/scenes/ai',{method:'POST',body:JSON.stringify(pending.input)});pending.jobId=job.id;await saveState(state)}
  for(;;){
   let job;try{job=await request(state,`v1/scenes/ai/${pending.jobId}`)}catch(error){if(error.status===404){delete state.sceneAI;await saveState(state)}throw error}
   if(job.state==='failed'){const message=job.result?.error?.message??'Не удалось создать фон.';const action=await waitClosed({window:{title:'AI-сцена — ошибка'},content:`<p>${safeHTML(message)}</p><p>Описание и настройки сохранены: ${safeHTML(pending.input.title)} · ${pending.input.columns} × ${pending.input.rows} клеток.</p>`,buttons:[{action:'clear',label:'Повторить с теми же настройками'},{action:'edit',label:'Изменить описание'},{action:'later',label:'Позже'}]});if(action==='edit'){state.sceneDraft=clone(pending.input);delete state.sceneAI;await saveState(state);return launch()}if(action==='clear'){state.sceneAI={target:pending.target,input:{...pending.input,requestId:crypto.randomUUID()}};await saveState(state);return launch()}return}
   if(job.state!=='succeeded'){
    const result=await watchSceneJob({job,title:pending.input.title,getJob:signal=>request(state,`v1/scenes/ai/${pending.jobId}`,{signal}),waitClosed});if(!result){monitor?.resume();return;}continue;
   }
   const map=job.result?.data;if(!map?.levels?.[0])throw Error('Сайт не вернул фон сцены.');const record=sceneAIRecord(map),level=map.levels[0];
   ui.notifications.info('Фон готов. Загружаем изображение в Foundry…');
   const src=await localAsset(state,level.imageUrl,'Карты');await saveState(state);await verifySceneImage(src);const plan=scenePlan(record,level);ui.notifications.info('Фон готов. Посмотрите изображение и создайте сцену.');
   const action=await waitClosed({window:{title:`Фон готов · ${map.title}`},position:{width:640},content:(pending.target&&map.generation?.wallMethod==='raster-cave'?'<p><strong>Пиксельная трассировка: заменятся только стены. Свет, темнота, фон и токены сохранятся.</strong></p>':pending.target?'<p><strong>После подтверждения существующие стены, двери и свет этой сцены будут заменены.</strong> Фон, токены и прочие настройки останутся. Ручные изменения во время анализа блокируют замену.</p>':'')+(map.generation?.topologyError?`<p role="alert"><strong>Фон готов, но разметка не завершена.</strong> ${safeHTML(map.generation.topologyError)} Можно создать сцену с этим фоном или повторить только стены, двери и свет.</p>`:'')+scenePreviewHTML(src,level,plan),render:(_e,dialog)=>renderScenePreview(dialog.element,level),buttons:[{action:'create',label:pending.target?'Заменить разметку открытой сцены':'Создать сцену',default:true},{action:'topology',label:'Заново стены, двери и свет'},...(!pending.target?[{action:'retry',label:'Новый фон с тем же описанием'}]:[]),{action:'discard',label:pending.target?'Отменить повторную разметку':'Отклонить фон'},{action:'later',label:'Сохранить предпросмотр на потом'}]});
   if(action==='topology'){state.sceneAI={target:pending.target,input:{...pending.input,referenceUrl:level.imageUrl,improve:false,topology:true,animatedDoors:map.generation?.animatedDoors??level.walls?.some(w=>!!w.doorVisual),requestId:crypto.randomUUID()}};await saveState(state);return launch();}
   if(action==='retry'){pending=state.sceneAI={input:{...pending.input,referenceUrl:undefined,improve:false,requestId:crypto.randomUUID()}};await saveState(state);return launch();}
   if(action==='discard'){delete state.sceneAI;await saveState(state);return}if(action!=='create')return;
   if(pending.target){const target=await fromUuid(pending.target.uuid);if(!target)throw Error('Исходная сцена удалена.');if(map.generation?.topologyError)throw Error('Разметка не готова. Существующие стены сохранены; повторите только разметку.');await replaceSceneTopology(target,pending.target.geometry,plan,{wallsOnly:map.generation?.wallMethod==="raster-cave"});delete state.sceneAI;await saveState(state);ui.notifications.info('Стены, двери и свет обновлены. Фон и остальные данные сцены сохранены.');return;}
   ui.notifications.info('Сохраняем фон и создаём сцену…');
   const accepted=await request(state,`v1/scenes/ai/${pending.jobId}/apply`,{method:'POST',body:'{}'});
   const savedRecord=sceneAIRecord(accepted),savedLevel=accepted.levels[0],key=`${savedRecord.key}/${savedLevel.id}`;
   let scene=state.records[key]?.uuid?await fromUuid(state.records[key].uuid):null;
   scene??=game.scenes.find(s=>s.flags?.[MODULE]?.site===state.base&&s.flags?.[MODULE]?.campaignId===state.campaignId&&s.flags?.[MODULE]?.sourceKey===savedRecord.key&&s.flags?.[MODULE]?.levelId===savedLevel.id);
   const projection=scenePlan(savedRecord,savedLevel);projection.background.src=await localAsset(state,savedLevel.imageUrl,'Карты');projection.folder=await managedFolder(state,state.title,'Scene',folderPath(savedRecord,[],'Scene'));projection.flags[MODULE]={...projection.flags[MODULE],site:state.base,campaignId:state.campaignId};
   await verifySceneImage(projection.background.src);
   if(!scene)scene=await Scene.create(sceneCreation(projection));
   else if(!sceneBackground(scene))await setSceneBackground(scene,projection.background.src);
   if(!sceneBackground(scene))throw Error('Сцена осталась без фона. Повторите создание.');
   state.records[key]={uuid:scene.uuid,record:clone(savedRecord),projection:clone(projection),authoring:sceneLevel(scene),adapterVersion:13};delete state.sceneAI;await saveState(state);
   ui.notifications.info(`Сцена создана: ${scene.name}.`);await scene.view();return;
  }
 }
 return {launch:open,analyzeCurrent,resume:()=>monitor?.resume()};
}

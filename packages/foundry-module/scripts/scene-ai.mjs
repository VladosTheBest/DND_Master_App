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
 async function launch(){
  monitor?.stop();
  const state=await connected();let pending=state.sceneAI;
  if(!pending){
   const input=await waitClosed({window:{title:'Создать сцену с AI'},content:'<p>AI создаёт фон с пустыми дверными проёмами, распознаёт стены, двери и источники света. Отдельные створки открываются по штатному значку двери. Положение и петли: «Настроить двери сцены» в панели модуля. Задача выполняется на сервере, пока вы ведёте игру. Используется Codex или подписка и провайдер изображений сайта.</p><label>Название<input name="title" maxlength="160" placeholder="Необязательно"></label><label>Описание локации<textarea name="prompt" minlength="10" maxlength="4000" rows="6" required placeholder="Например: заброшенная таверна, большой зал, кухня, подвал и выход во двор. Вид строго сверху."></textarea></label><label>Клеток по горизонтали<input name="columns" type="number" min="10" max="100" value="30" required></label><label>Клеток по вертикали<input name="rows" type="number" min="10" max="100" value="20" required></label><label>Футов в клетке<input name="distance" type="number" value="5" readonly></label><label>Погода<select name="weather"><option value="none">Без осадков</option><option value="rain">Дождь</option><option value="storm">Гроза</option><option value="snow">Снег</option><option value="fog">Туман</option></select></label><p>Ориентировочно 2–8 минут. Проверьте разметку в предпросмотре; после импорта её можно поправить инструментами Foundry.</p>',buttons:[{action:'generate',label:'Сгенерировать сцену',default:true,callback:(_e,_b,d)=>({requestId:crypto.randomUUID(),title:d.element.querySelector('[name=title]').value.trim()||d.element.querySelector('[name=prompt]').value.trim().slice(0,80),prompt:d.element.querySelector('[name=prompt]').value.trim(),columns:Number(d.element.querySelector('[name=columns]').value),rows:Number(d.element.querySelector('[name=rows]').value),distance:5,topology:true,weather:d.element.querySelector('[name=weather]').value})},{action:'cancel',label:'Отмена',callback:()=>null}]});if(!input)return;
   // Save the request before transport: retrying a lost response reuses the same paid request.
   pending=state.sceneAI={input};await saveState(state);
  }
  if(!pending.jobId){const job=await request(state,'v1/scenes/ai',{method:'POST',body:JSON.stringify(pending.input)});pending.jobId=job.id;await saveState(state)}
  for(;;){
   let job;try{job=await request(state,`v1/scenes/ai/${pending.jobId}`)}catch(error){if(error.status===404){delete state.sceneAI;await saveState(state)}throw error}
   if(job.state==='failed'){const message=job.result?.error?.message??'Не удалось создать фон.';const action=await waitClosed({window:{title:'AI-сцена — ошибка'},content:safeHTML(message),buttons:[{action:'clear',label:'Закрыть задачу и создать новый вариант'},{action:'later',label:'Позже'}]});if(action==='clear'){delete state.sceneAI;await saveState(state)}return}
   if(job.state!=='succeeded'){
    const result=await watchSceneJob({job,title:pending.input.title,getJob:signal=>request(state,`v1/scenes/ai/${pending.jobId}`,{signal}),waitClosed});if(!result){monitor?.resume();return;}continue;
   }
   const map=job.result?.data;if(!map?.levels?.[0])throw Error('Сайт не вернул фон сцены.');const record=sceneAIRecord(map),level=map.levels[0];
   ui.notifications.info('Фон готов. Загружаем изображение в Foundry…');
   const src=await localAsset(state,level.imageUrl,'Карты');await saveState(state);await verifySceneImage(src);const plan=scenePlan(record,level);ui.notifications.info('Фон готов. Посмотрите изображение и создайте сцену.');
   const action=await waitClosed({window:{title:`Фон готов · ${map.title}`},position:{width:640},content:scenePreviewHTML(src,level,plan),render:(_e,dialog)=>renderScenePreview(dialog.element,level),buttons:[{action:'create',label:'Создать сцену',default:true},{action:'retry',label:'Перегенерировать'},{action:'discard',label:'Отклонить фон'},{action:'later',label:'Сохранить предпросмотр на потом'}]});
   if(action==='retry'){pending=state.sceneAI={input:{...pending.input,requestId:crypto.randomUUID()}};await saveState(state);return launch();}
   if(action==='discard'){delete state.sceneAI;await saveState(state);return}if(action!=='create')return;
   ui.notifications.info('Сохраняем фон и создаём сцену…');
   const accepted=await request(state,`v1/scenes/ai/${pending.jobId}/apply`,{method:'POST',body:'{}'}),snapshot=await request(state,'v1/snapshot');
   const savedRecord=snapshot.records.find(r=>r.key===`session-map:${accepted.id}`)??sceneAIRecord(accepted),savedLevel=accepted.levels[0],key=`${savedRecord.key}/${savedLevel.id}`;
   let scene=state.records[key]?.uuid?await fromUuid(state.records[key].uuid):null;
   scene??=game.scenes.find(s=>s.flags?.[MODULE]?.site===state.base&&s.flags?.[MODULE]?.campaignId===state.campaignId&&s.flags?.[MODULE]?.sourceKey===savedRecord.key&&s.flags?.[MODULE]?.levelId===savedLevel.id);
   const projection=scenePlan(savedRecord,savedLevel);projection.background.src=await localAsset(state,savedLevel.imageUrl,'Карты');projection.folder=await managedFolder(state,snapshot.title,'Scene',folderPath(savedRecord,snapshot.records,'Scene'));projection.flags[MODULE]={...projection.flags[MODULE],site:state.base,campaignId:state.campaignId};
   await verifySceneImage(projection.background.src);
   if(!scene)scene=await Scene.create(sceneCreation(projection));
   else if(!sceneBackground(scene))await setSceneBackground(scene,projection.background.src);
   if(!sceneBackground(scene))throw Error('Сцена осталась без фона. Повторите создание.');
   state.records[key]={uuid:scene.uuid,record:clone(savedRecord),projection:clone(projection),authoring:sceneLevel(scene),adapterVersion:13};delete state.sceneAI;await saveState(state);
   ui.notifications.info(`Сцена создана: ${scene.name}.`);await scene.view();return;
  }
 }
 return {launch:open,resume:()=>monitor?.resume()};
}

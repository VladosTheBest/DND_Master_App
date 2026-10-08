import {sceneCreation,sceneBackground,setSceneBackground,verifySceneImage} from './scene-background.mjs';
import {watchSceneJob} from './scene-job-ui.mjs';
import {MODULE,clone,sceneLevel} from './core.mjs';
import {scenePlan,safeHTML} from './adapter.mjs';
import {managedFolder,folderPath} from './presentation.mjs';

export function sceneAIRecord(map){return {key:`session-map:${map.id}`,id:map.id,kind:'session-map',title:map.title,data:map}}
export function createSceneAI({connected,request,saveState,localAsset,waitClosed}){
 async function launch(){
  const state=await connected();let pending=state.sceneAI;
  if(!pending){
   const input=await waitClosed({window:{title:'Создать сцену с AI'},content:'<p>AI создаёт фон карты по описанию. Затем можно посмотреть его и создать сцену. Используется Codex или подписка и провайдер изображений сайта.</p><label>Название<input name="title" maxlength="160" required></label><label>Описание локации<textarea name="prompt" minlength="10" maxlength="4000" rows="6" required placeholder="Например: заброшенная таверна, большой зал, кухня, подвал и выход во двор. Вид строго сверху."></textarea></label><label>Клеток по горизонтали<input name="columns" type="number" min="10" max="100" value="30" required></label><label>Клеток по вертикали<input name="rows" type="number" min="10" max="100" value="20" required></label><label>Футов в клетке<input name="distance" type="number" min="1" max="100" value="5" required></label><p>Размер сетки зависит от разрешения фона. Стены, освещение и токены можно настроить после создания.</p>',buttons:[{action:'generate',label:'Создать фон',default:true,callback:(_e,_b,d)=>({requestId:crypto.randomUUID(),title:d.element.querySelector('[name=title]').value.trim(),prompt:d.element.querySelector('[name=prompt]').value.trim(),columns:Number(d.element.querySelector('[name=columns]').value),rows:Number(d.element.querySelector('[name=rows]').value),distance:Number(d.element.querySelector('[name=distance]').value)})},{action:'cancel',label:'Отмена',callback:()=>null}]});if(!input)return;
   // Save the request before transport: retrying a lost response reuses the same paid request.
   pending=state.sceneAI={input};await saveState(state);
  }
  if(!pending.jobId){const job=await request(state,'v1/scenes/ai',{method:'POST',body:JSON.stringify(pending.input)});pending.jobId=job.id;await saveState(state)}
  for(;;){
   let job;try{job=await request(state,`v1/scenes/ai/${pending.jobId}`)}catch(error){if(error.status===404){delete state.sceneAI;await saveState(state)}throw error}
   if(job.state==='failed'){const message=job.result?.error?.message??'Не удалось создать фон.';const action=await waitClosed({window:{title:'AI-сцена — ошибка'},content:safeHTML(message),buttons:[{action:'clear',label:'Закрыть задачу и создать новый вариант'},{action:'later',label:'Позже'}]});if(action==='clear'){delete state.sceneAI;await saveState(state)}return}
   if(job.state!=='succeeded'){
    const result=await watchSceneJob({job,title:pending.input.title,getJob:signal=>request(state,`v1/scenes/ai/${pending.jobId}`,{signal}),waitClosed});if(!result)return;continue;
   }
   const map=job.result?.data;if(!map?.levels?.[0])throw Error('Сайт не вернул фон сцены.');const record=sceneAIRecord(map),level=map.levels[0];
   ui.notifications.info('Фон готов. Загружаем изображение в Foundry…');
   const src=await localAsset(state,level.imageUrl,'Карты');await saveState(state);await verifySceneImage(src);const plan=scenePlan(record,level);ui.notifications.info('Фон готов. Посмотрите изображение и создайте сцену.');
   const action=await waitClosed({window:{title:`Фон готов · ${map.title}`},position:{width:640},content:`<img src="${safeHTML(src).replace(/^<p>|<\/p>$/g,'').replaceAll('"','&quot;')}" alt="Фон сцены" style="display:block;width:100%;height:320px;max-height:40vh;object-fit:contain"><p>${level.width} × ${level.height} px · клетка ${plan.grid.size} px · ${plan.grid.distance} футов. Стены и освещение пока не настроены.</p>`,buttons:[{action:'create',label:'Создать сцену',default:true},{action:'discard',label:'Отклонить фон'},{action:'later',label:'Сохранить предпросмотр на потом'}]});
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
 return {launch};
}

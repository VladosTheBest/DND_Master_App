import {missingPortrait,syncPortraitToken} from './token-art.mjs';
export {missingPortrait} from './token-art.mjs';

export async function createActorPortrait({state,entry,actor,request,saveState,localAsset,stage}){
 if(!missingPortrait(actor.img)){await syncPortraitToken(state,actor);await saveState(state);return 'Портрет уже есть — сохранён; токены проверены.'}
 const before=actor.img;
 let pending=entry.portraitAI;
 if(!pending||pending.failed){pending=entry.portraitAI={input:{requestId:crypto.randomUUID(),recordKey:entry.record.key}};await saveState(state)}
 if(!pending.jobId){const job=await request(state,'v1/actors/portraits',{method:'POST',body:JSON.stringify(pending.input)});pending.jobId=job.id;await saveState(state)}
 for(;;){
  const job=await request(state,`v1/actors/portraits/${pending.jobId}`);
  stage.textContent=`Портрет · ${actor.name} · ${job.stage??'Создаётся'}`;
  if(job.state==='failed'){pending.failed=true;await saveState(state);throw Error(job.result?.error?.message??'Не удалось создать портрет.')}
  if(job.state!=='succeeded'){await new Promise(resolve=>setTimeout(resolve,2000));continue}
  const url=job.result?.data?.url;if(!url)throw Error('Сервер не вернул портрет.');
  const image=await localAsset(state,url,'Портреты');
  if(actor.img!==before)return 'Сохранён портрет, изменённый во время генерации.';
  await actor.update({img:image});
  await syncPortraitToken(state,actor,before);
  pending.applied=true;pending.url=url;await saveState(state);return 'Портрет и круглый токен созданы.';
 }
}

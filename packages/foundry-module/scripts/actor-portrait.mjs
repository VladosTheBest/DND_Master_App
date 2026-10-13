import {roundTokenAsset,updatePlacedTokenArt} from './token-art.mjs';
export const missingPortrait=src=>!src||/^icons\/svg\/(?:mystery-man|skull|cowled|item-bag)\.svg(?:\?.*)?$/.test(src);

export async function createActorPortrait({state,entry,actor,request,saveState,localAsset,stage}){
 if(!missingPortrait(actor.img))return 'Портрет уже есть — сохранён.';
 const before=actor.img,tokenBefore=actor.prototypeToken.texture.src;
 let pending=entry.portraitAI;
 if(!pending||pending.failed){pending=entry.portraitAI={input:{requestId:crypto.randomUUID(),recordKey:entry.record.key}};await saveState(state)}
 if(!pending.jobId){const job=await request(state,'v1/actors/portraits',{method:'POST',body:JSON.stringify(pending.input)});pending.jobId=job.id;await saveState(state)}
 for(;;){
  const job=await request(state,`v1/actors/portraits/${pending.jobId}`);
  stage.textContent=`Портрет · ${actor.name} · ${job.stage??'Создаётся'}`;
  if(job.state==='failed'){pending.failed=true;await saveState(state);throw Error(job.result?.error?.message??'Не удалось создать портрет.')}
  if(job.state!=='succeeded'){await new Promise(resolve=>setTimeout(resolve,2000));continue}
  const url=job.result?.data?.url;if(!url)throw Error('Сервер не вернул портрет.');
  const image=await localAsset(state,url,'Портреты'),token=await roundTokenAsset(state,image);await saveState(state);
  if(actor.img!==before)return 'Сохранён портрет, изменённый во время генерации.';
  const update={img:image};if(actor.prototypeToken.texture.src===tokenBefore&&missingPortrait(tokenBefore))update['prototypeToken.texture.src']=token;
  await actor.update(update);
  if(update['prototypeToken.texture.src'])await updatePlacedTokenArt(actor,new Set([tokenBefore,before]));
  pending.applied=true;pending.url=url;await saveState(state);return 'Портрет и круглый токен созданы.';
 }
}

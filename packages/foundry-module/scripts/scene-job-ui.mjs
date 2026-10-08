import {safeHTML} from './adapter.mjs';
// Watch only this open generation dialog. Closing it cancels the timer and in-flight status read.
export async function watchSceneJob({job,title,getJob,waitClosed,intervalMs=3000}){
 let timer,controller,stopped=false,latest=job;
 const stop=()=>{stopped=true;clearTimeout(timer);controller?.abort()};
 try{const action=await waitClosed({window:{title:'Генерация фона сцены'},content:`<p>${safeHTML(title)}</p><p data-scene-stage role="status" aria-live="polite">${safeHTML(job.stage||'Задача в очереди')}</p><progress style="width:100%"></progress><p>Готовый фон откроется автоматически. После просмотра останется нажать «Создать сцену». Можно закрыть окно: задача сохранится и продолжится на сайте.</p>`,buttons:[{action:'check',label:'Проверить сейчас'},{action:'later',label:'Продолжить позже'}],render:(_e,dialog)=>{
  dialog.addEventListener('close',stop,{once:true});
  const check=async()=>{if(stopped)return;controller=new AbortController();try{latest=await getJob(controller.signal);if(stopped)return;const stage=dialog.element.querySelector('[data-scene-stage]');stage.textContent=latest.stage||'Генерация продолжается';if(['succeeded','failed'].includes(latest.state)){stage.textContent=latest.state==='succeeded'?'Фон готов. Открываем предпросмотр…':'Генерация завершилась с ошибкой';dialog.element.querySelector('button[data-action=check]').click();return}timer=setTimeout(check,intervalMs)}catch(error){if(!stopped){dialog.element.querySelector('[data-scene-stage]').textContent='Не удалось проверить статус. Нажмите «Проверить сейчас» или вернитесь позже.';dialog.element.querySelector('progress')?.remove()}}};timer=setTimeout(check,intervalMs);
 }});return action==='check'?latest:null}finally{stop()}
}

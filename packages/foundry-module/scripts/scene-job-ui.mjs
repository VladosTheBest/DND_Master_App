import {safeHTML} from './adapter.mjs';
export function sceneEstimate(job,now=Date.now()){
 const seconds=Math.max(0,(now-Date.parse(job.startedAt||job.createdAt||new Date(now).toISOString()))/1000);
 return seconds<300?`Ориентировочно ещё ${Math.max(1,Math.ceil((300-seconds)/60))} мин · обычно 2–8 мин`:'Дольше первоначальной оценки · задача продолжает выполняться';
}
const attr=value=>String(value??'').replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;').replaceAll('>','&gt;');
export function scenePreviewHTML(src,level,plan){
 const w=level.width,h=level.height;
 return `<div data-scene-preview style="position:relative"><img src="${attr(src)}" alt="Фон сцены" style="display:block;width:100%"></div><p>${level.columns||Math.round(w/plan.grid.size)} × ${level.rows||Math.round(h/plan.grid.size)} клеток · ${plan.grid.distance} футов. ${level.walls?.length||0} стен/дверей · ${level.lights?.length||0} источников света.</p><p>Проверьте разметку: стены бирюзовые, двери оранжевые, свет жёлтый. AI может ошибаться. После создания всё редактируется штатными инструментами Foundry.</p>`;
}
// DialogV2 sanitizes SVG out of content strings. Mount trusted geometry after rendering.
export function renderScenePreview(root,level){
 const host=root.querySelector('[data-scene-preview]');if(!host)return;
 host.querySelector('svg')?.remove();
 const w=level.width,h=level.height,doc=host.ownerDocument;
 const element=(tag,attrs)=>{const e=doc.createElementNS('http://www.w3.org/2000/svg',tag);for(const [key,value] of Object.entries(attrs))e.setAttribute(key,String(value));return e};
 const svg=element('svg',{viewBox:`0 0 ${w} ${h}`,'aria-label':'Стены, двери и источники света'});
 Object.assign(svg.style,{position:'absolute',inset:'0',width:'100%',height:'100%',pointerEvents:'none'});
 for(const v of level.lights||[])svg.append(element('circle',{cx:v.x*w,cy:v.y*h,r:Math.max(5,v.dim/5*w/(level.columns||30)),fill:'#ffd16633',stroke:'#ffd166'}));
 for(const v of level.walls||[])svg.append(element('line',{x1:v.start.x*w,y1:v.start.y*h,x2:v.end.x*w,y2:v.end.y*h,stroke:v.kind==='door'?'#ff9e45':'#52e8d4','stroke-width':Math.max(3,w/250)}));
 host.append(svg);
}
// Only watches an explicitly submitted pending job; never imports or switches scenes.
export function createSceneMonitor({readState,request,onOpen,intervalMs=5000,notify=(message)=>ui.notifications.info(message,{permanent:true})}){
 let timer,controller,version=0,badge;
 function stop(){version++;clearTimeout(timer);controller?.abort();badge?.remove();badge=null;}
 async function resume(){stop();const current=version;
  async function tick(){
   let state;try{state=await readState()}catch{return;}
   try{if(current!==version||!state?.sceneAI?.jobId)return;
    controller=new AbortController();const job=await request(state,`v1/scenes/ai/${state.sceneAI.jobId}`,{signal:controller.signal});if(current!==version)return;
    if(['succeeded','failed'].includes(job.state)){
     const latest=await readState();if(current!==version||latest?.sceneAI?.jobId!==state.sceneAI.jobId||latest.base!==state.base||latest.campaignId!==state.campaignId)return;
     notify(job.state==='succeeded'?'Сцена готова. Откройте «Сцена · результат» для предпросмотра.':'Генерация сцены завершилась с ошибкой. Откройте результат для повторной попытки.');
     if(globalThis.document?.body){badge=document.createElement('button');badge.className='shadow-edge-scene-ready';badge.textContent='Сцена · результат';badge.onclick=()=>{stop();onOpen()};document.body.append(badge);}return;
    }
   }catch(error){if(current!==version)return;if([401,403,404].includes(error.status))return;}
   if(current===version)timer=setTimeout(tick,intervalMs);
  }await tick();
 }return {resume,stop};
}
// Watch only this open generation dialog. Closing it cancels the timer and in-flight status read.
export async function watchSceneJob({job,title,getJob,waitClosed,intervalMs=3000}){
 let timer,controller,stopped=false,latest=job;
 const stop=()=>{stopped=true;clearTimeout(timer);controller?.abort()};
 try{const action=await waitClosed({window:{title:'Генерация фона сцены'},content:`<p>${safeHTML(title)}</p><p data-scene-stage role="status" aria-live="polite">${safeHTML(job.stage||'Задача в очереди')}</p><progress style="width:100%"></progress><p data-scene-estimate>${sceneEstimate(job)}</p><p>Готовый фон откроется автоматически. После просмотра останется нажать «Создать сцену». Можно закрыть окно и вести игру: задача продолжится на сайте, а модуль уведомит о готовности.</p>`,buttons:[{action:'check',label:'Проверить сейчас'},{action:'later',label:'Продолжить позже'}],render:(_e,dialog)=>{
  dialog.addEventListener('close',stop,{once:true});
  const check=async()=>{if(stopped)return;controller=new AbortController();try{latest=await getJob(controller.signal);if(stopped)return;const stage=dialog.element.querySelector('[data-scene-stage]');stage.textContent=latest.stage||'Генерация продолжается';const estimate=dialog.element.querySelector('[data-scene-estimate]');if(estimate)estimate.textContent=sceneEstimate(latest);if(['succeeded','failed'].includes(latest.state)){stage.textContent=latest.state==='succeeded'?'Фон готов. Открываем предпросмотр…':'Генерация завершилась с ошибкой';dialog.element.querySelector('button[data-action=check]').click();return}timer=setTimeout(check,intervalMs)}catch(error){if(!stopped){dialog.element.querySelector('[data-scene-stage]').textContent='Не удалось проверить статус. Нажмите «Проверить сейчас» или вернитесь позже.';dialog.element.querySelector('progress')?.remove()}}};timer=setTimeout(check,intervalMs);
 }});return action==='check'?latest:null}finally{stop()}
}

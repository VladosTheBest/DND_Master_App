import {useEffect,useRef,useState} from 'react';
import type {SessionMapDocument} from '@shadow-edge/shared-types';
import {useWorkspaceGuard} from '../../app/workspace-route';
import {useDeviceDraft} from '../../app/hooks/useDeviceDraft';
import {useDraftOwner} from '../../app/hooks/useDraftOwner';
import {DeviceDraftControls} from '../../app/DeviceDraftControls';

type Video=NonNullable<SessionMapDocument['levels'][number]['video']>;
type Prepared={previewUrl:string;posterUrl:string;width:number;height:number;duration:number};
export function ExternalSceneForm({campaignId,onReady}:{campaignId:string;onReady:(map:SessionMapDocument,afterSave:()=>void)=>void}){
 const [form,setForm]=useState({title:'',url:'',startSeconds:0,durationSeconds:300,maxHeight:1440 as Video['maxHeight'],columns:30,rows:20});
 const [helperURL,setHelperURL]=useState('http://127.0.0.1:4197');
 const [key,setKey]=useState(''),[busy,setBusy]=useState(false),[status,setStatus]=useState(''),[error,setError]=useState('');
 const lock=useRef(false),request=useRef<AbortController|null>(null);
 useEffect(()=>()=>request.current?.abort(),[]);
 const ownerId=useDraftOwner();
 const draft=useDeviceDraft({ownerId,campaignId,target:'scene-video-form',revision:0,enabled:true,dirty:!!(form.title||form.url),value:form,restore:d=>{if(!d.value||typeof d.value.title!=='string'||typeof d.value.url!=='string')return false;setForm({...form,...d.value});return true;}});
 useWorkspaceGuard(busy||!!(form.title||form.url));
 const patch=(v:Partial<typeof form>)=>setForm(f=>({...f,...v}));
 async function create(){
  if(lock.current||draft.candidate)return;lock.current=true;setBusy(true);setError('');const abort=new AbortController();request.current=abort;
  try{
   const source=new URL(form.url);if(source.protocol!=='https:'||source.username||source.password)throw Error('Нужна HTTPS-ссылка без логина и пароля.');
   const direct=/\.(mp4|webm)$/i.test(source.pathname);let prepared:Prepared;
   if(direct){
    setStatus('Проверяем видео напрямую в браузере…');
    const element=document.createElement('video');element.preload='metadata';element.crossOrigin='anonymous';element.muted=true;
    prepared=await new Promise<Prepared>((resolve,reject)=>{const clean=()=>{clearTimeout(timer);element.removeAttribute('src');element.load();};const fail=()=>{clean();reject(Error('Видео недоступно или формат не поддерживается. Нужна прямая ссылка MP4/WebM, доступная игрокам.'));};const timer=setTimeout(fail,20000);abort.signal.addEventListener('abort',fail,{once:true});element.onerror=fail;element.onloadedmetadata=()=>{const data={previewUrl:form.url,posterUrl:'',width:element.videoWidth,height:element.videoHeight,duration:element.duration};clean();if(!data.width||!Number.isFinite(data.duration)||form.startSeconds>=data.duration)reject(Error('Начало фрагмента находится за пределами видео.'));else resolve(data);};element.src=form.url;});
   }else{
    if(!key.trim())throw Error('Запустите помощник рядом с Foundry и вставьте его ключ подключения.');
    const base=new URL(helperURL);if(base.username||base.password||base.search||base.hash||(base.protocol!=='https:'&&!(base.protocol==='http:'&&['localhost','127.0.0.1','[::1]'].includes(base.hostname))))throw Error('Помощник должен иметь HTTPS-адрес либо работать на localhost.');
    const call=async(path:string,body?:unknown)=>{const response=await fetch(helperURL.replace(/\/$/,'')+path,{method:body?'POST':'GET',headers:{Authorization:'Bearer '+key.trim(),...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined,credentials:'omit',signal:abort.signal});if(!response.ok)throw Error((await response.text()).slice(0,500));return response.json();};
    let job=await call('/jobs',{url:form.url,startSeconds:form.startSeconds,durationSeconds:form.durationSeconds,maxHeight:form.maxHeight});
    const deadline=Date.now()+26*60*1000;
    while(job.state==='working'){
     setStatus(job.stage+' · видео готовится на компьютере Foundry, это может занять несколько минут');
     await new Promise<void>((resolve,reject)=>{const cancel=()=>{clearTimeout(timer);reject(Error('Ожидание отменено. Повторный запрос найдёт подготовленный результат.'));};const timer=setTimeout(()=>{abort.signal.removeEventListener('abort',cancel);resolve();},2000);abort.signal.addEventListener('abort',cancel,{once:true});});
     if(Date.now()>deadline)throw Error('Ожидание истекло. Повторите запрос: готовый файл останется в кеше Foundry.');job=await call('/jobs/'+encodeURIComponent(job.id));
    }
    if(job.state!=='ready'||!job.result)throw Error(job.error||'Не удалось подготовить фон.');prepared=job.result;
   }
   if(prepared.width>32000||prepared.height>32000)throw Error('Размер видео превышает ограничение сцены.');
   onReady({id:crypto.randomUUID(),title:form.title.trim(),revision:0,levels:[{id:'ground',name:form.title.trim(),imageUrl:'',video:{url:form.url,startSeconds:form.startSeconds,durationSeconds:form.durationSeconds,maxHeight:form.maxHeight,previewUrl:prepared.previewUrl,posterUrl:prepared.posterUrl},width:prepared.width,height:prepared.height,columns:form.columns,rows:Math.round(form.columns*prepared.height/prepared.width),gridDistance:5,grid:{type:'square',size:1/form.columns,color:'#ffffff',opacity:.2},walls:[],lights:[]}]},()=>draft.clear());setStatus('Фон готов. Разметьте стены, двери и свет и сохраните сцену.');
  }catch(e){setError(e instanceof TypeError?'Не удалось связаться с источником или помощником. Проверьте адрес, запустите помощник и разрешите браузеру доступ к локальной сети.':(e as Error).message);}finally{request.current=null;lock.current=false;setBusy(false);}
 }
 return <form className="scene-create" onSubmit={e=>{e.preventDefault();void create();}}>
  <DeviceDraftControls draft={draft} label="настройки видеофона"/>
  <h3>Видеофон по ссылке</h3><p>На сайте сохраняются только ссылки и разметка. YouTube-фрагмент готовится в папке Foundry; игроки видят обычный фон без плеера. Используйте ролик с неподвижной камерой.</p>
  <fieldset disabled={busy}>
   <label>Название сцены<input required maxLength={160} value={form.title} onChange={e=>patch({title:e.target.value})}/></label>
   <label>Ссылка YouTube или MP4/WebM<input required type="url" value={form.url} onChange={e=>patch({url:e.target.value})} placeholder="https://…"/></label>
   <div className="scene-dimensions"><label>Начало, секунд<input required type="number" min={0} max={86400} value={form.startSeconds} onChange={e=>patch({startSeconds:+e.target.value})}/></label><label>Длительность<select value={form.durationSeconds} onChange={e=>patch({durationSeconds:+e.target.value})}><option value={60}>1 минута</option><option value={300}>5 минут</option><option value={600}>10 минут</option></select></label><label>Качество YouTube<select value={form.maxHeight} onChange={e=>patch({maxHeight:+e.target.value as Video['maxHeight']})}><option value={1440}>До 1440p</option><option value={1080}>До 1080p</option><option value={720}>До 720p</option></select></label></div>
   <small>Для MP4/WebM качество задано самой ссылкой. Короткий фрагмент YouTube зацикливается без звука; стык может быть заметен.</small>
   <div className="scene-dimensions"><label>Ширина, клеток<input required type="number" min={10} max={100} value={form.columns} onChange={e=>patch({columns:+e.target.value})}/></label><small>Высота и пропорции определяются по видео автоматически.</small></div>
   <details><summary>Подключить помощник YouTube</summary><p><a href="/foundry/foundry-video-helper.exe" download>Скачать помощник для Windows</a> · <a href="/foundry/foundry-video-helper-linux-amd64" download>Linux</a></p><p>На компьютере Foundry запустите foundry-video-helper с путём к папке Data и адресом Foundry. Он требует yt-dlp и FFmpeg. Пример запуска: foundry-video-helper.exe --foundry-data "C:/Foundry/Data" --foundry-url "http://localhost:30000". Ключ из его окна вставьте здесь и в настройках модуля Foundry. Ключ не отправляется на сайт и не сохраняется в кампании.</p><label>Адрес помощника<input type="url" value={helperURL} onChange={e=>setHelperURL(e.target.value)}/></label><label>Ключ помощника<input type="password" autoComplete="off" value={key} onChange={e=>setKey(e.target.value)}/></label></details>
   <button className="map-primary" disabled={busy||!!draft.candidate} type="submit">Подготовить фон и разметить стены</button>
  </fieldset>
  {draft.candidate&&<p role="status">Сначала восстановите найденные настройки или выберите «Продолжить текущие правки».</p>}{busy&&<button type="button" onClick={()=>request.current?.abort()}>Прекратить ожидание</button>}{status&&<p role="status">{status}</p>}{error&&<p role="alert">{error}</p>}
 </form>;
}

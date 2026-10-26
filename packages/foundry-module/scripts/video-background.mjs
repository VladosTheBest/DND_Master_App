import {MODULE} from './core.mjs';
export const directVideo=url=>{try{const u=new URL(url);return u.protocol==='https:'&&!u.username&&!u.password&&/\.(mp4|webm)$/i.test(u.pathname)}catch{return false}};
export async function prepareVideoBackground(source,stage=()=>{}){
 if(directVideo(source.url))return source.url;
 const token=game.settings.get(MODULE,'videoHelperKey');if(!token)throw Error('Для YouTube запустите foundry-video-helper рядом с Foundry и укажите ключ в настройках Shadow Edge GM.');
 const base=game.settings.get(MODULE,'videoHelperURL')||'http://127.0.0.1:4197',u=new URL(base);if(u.username||u.password||u.search||u.hash||(u.protocol!=='https:'&&!(u.protocol==='http:'&&['localhost','127.0.0.1','[::1]'].includes(u.hostname))))throw Error('Помощник требует HTTPS или localhost');
 const call=async(path,body)=>{const r=await fetch(base.replace(/\/$/,'')+path,{method:body?'POST':'GET',headers:{Authorization:`Bearer ${token}`,...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined,credentials:'omit',signal:AbortSignal.timeout(15000)});if(!r.ok)throw Error((await r.text()).slice(0,400));return r.json()};
 let job=await call('/jobs',{url:source.url,startSeconds:source.startSeconds,durationSeconds:source.durationSeconds,maxHeight:source.maxHeight});const deadline=Date.now()+26*60*1000;
 while(job.state==='working'){stage('Подготовка YouTube-фона в Foundry · '+job.stage);await new Promise(r=>setTimeout(r,2000));if(Date.now()>deadline)throw Error('Ожидание видео истекло. Повторите импорт: готовый фрагмент останется в кеше.');job=await call('/jobs/'+encodeURIComponent(job.id))}
 if(job.state!=='ready'||!/^shadow-edge-gm\/video-cache\/[a-f0-9]{32}\.mp4$/.test(job.result?.path||''))throw Error(job.error||'Помощник не вернул готовый видеофон');
 return job.result.path;
}
export function registerVideoBackground(){
 game.settings.register(MODULE,'videoHelperURL',{name:'Адрес помощника видео',hint:'Для Foundry на этом компьютере оставьте localhost. Для удалённого сервера нужен настроенный HTTPS reverse proxy к помощнику.',scope:'client',config:true,restricted:true,type:String,default:'http://127.0.0.1:4197'});
 game.settings.register(MODULE,'videoHelperKey',{name:'Ключ локального помощника YouTube',hint:'Запустите foundry-video-helper на компьютере Foundry. Ключ хранится только в браузере мастера; видео остаётся в папке Data.',scope:'client',config:true,restricted:true,type:String,default:''});
 let cleanup=()=>{};
 Hooks.on('canvasTearDown',()=>{cleanup();cleanup=()=>{}});
 Hooks.on('canvasReady',()=>{
  cleanup();cleanup=()=>{};
  const source=canvas.scene?.flags?.[MODULE]?.videoSource;if(!source)return;
  const video=game.video.getVideoSource(canvas.primary.background);if(!video)return;
  const start=directVideo(source.url)?source.startSeconds:0;
  video.muted=true;video.loop=true;video.preload='metadata';
  const reset=()=>{if(video.readyState&&Number.isFinite(video.duration)){if(start>=video.duration){ui.notifications.warn('Начало видеофрагмента за пределами ролика');return}video.currentTime=start;}};
  const tick=()=>{if(video.currentTime>=Math.min(video.duration,start+source.durationSeconds)-.1)reset()};
  if(video.readyState)reset();else video.addEventListener('loadedmetadata',reset,{once:true});
  video.addEventListener('timeupdate',tick);video.addEventListener('ended',reset);
  cleanup=()=>{video.removeEventListener('loadedmetadata',reset);video.removeEventListener('timeupdate',tick);video.removeEventListener('ended',reset)};
 });
}

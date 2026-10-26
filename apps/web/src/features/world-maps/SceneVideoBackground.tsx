import {useEffect,useRef} from 'react';
import type {SessionMapDocument} from '@shadow-edge/shared-types';
type Level=SessionMapDocument['levels'][number];
export function SceneVideoBackground({level,playing,onError}:{level:Level;playing:boolean;onError:(message:string)=>void}){
 const ref=useRef<HTMLVideoElement>(null),source=level.video!;
 const direct=/\.(mp4|webm)(?:[?#]|$)/i.test(source.url),start=direct?source.startSeconds:0;
 useEffect(()=>{const video=ref.current;if(!video)return;if(playing)void video.play().catch(()=>onError('Браузер не запустил видео. Повторите воспроизведение или проверьте доступность Foundry.'));else video.pause();},[playing,source.previewUrl,source.url,level.id]);
 return <>{source.posterUrl&&<image href={source.posterUrl} width={level.width} height={level.height}/>}<foreignObject width={level.width} height={level.height} pointerEvents="none"><video ref={ref} src={source.previewUrl||source.url} poster={source.posterUrl||undefined} muted playsInline preload="metadata" style={{width:'100%',height:'100%',objectFit:'fill'}} onLoadedMetadata={e=>{e.currentTarget.currentTime=start;}} onTimeUpdate={e=>{const v=e.currentTarget;if(v.currentTime>=Math.min(v.duration,start+source.durationSeconds)-.1)v.currentTime=start;}} onEnded={e=>{e.currentTarget.currentTime=start;if(playing)void e.currentTarget.play().catch(()=>{});}} onError={()=>onError('Видеофон недоступен. Проверьте ссылку или запустите Foundry и помощник. Разметка сохранена отдельно.')}/></foreignObject></>;
}

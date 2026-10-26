import {AIConnectionSummary} from "../ai-jobs/PersonalAISettings";
import { useWorkspaceListState, useWorkspaceGuard } from "../../app/workspace-route";
import { useDeviceDraft } from "../../app/hooks/useDeviceDraft";
import { useDraftOwner } from "../../app/hooks/useDraftOwner";
import { DeviceDraftControls } from "../../app/DeviceDraftControls";
import { useWorkspaceRoute, navigateWorkspace, workspaceURL } from "../../app/workspace-route";
import { confirmAction } from "../../app/confirm-action";
import { useEffect, useRef, useState } from 'react';
import type { AIJob, SessionMapDocument, WorldMapDocument } from '@shadow-edge/shared-types';
import { api } from '../../app/api';
import { mapMediaURL, mapRequest, worldMapsAPI } from './world-maps.api';
import { prepareMapImage } from './map-image-upload';
import { CreativeMapEditor } from './CreativeMapEditor';
import { creativePNG, sceneFromJSON, sceneSize } from './creative-map';
import { useAIJobs, isActiveJob } from '../ai-jobs/useAIJobs';
import { AIJobProgress } from '../ai-jobs/AIJobProgress';
import './scenes.css';
import {ExternalSceneForm} from './ExternalSceneForm';
import {ScenePreview} from './ScenePreview';
import {creativeStructure,creativeWalls} from './creative-vtt';
import {saveCreativeBackgrounds} from './scene-creative';

type Level = SessionMapDocument['levels'][number];
const weatherNames = {none:'Без осадков',rain:'Дождь',storm:'Гроза',snow:'Снег',fog:'Туман'};
export function ScenesWorkspace({campaignId,readOnly,aiAllowed=true}:{campaignId:string;readOnly:boolean;aiAllowed?:boolean}) {
 const [aiAvailable,setAIAvailable]=useState(false);
 const videoDraft=useRef<{id:string;clear:()=>void}|null>(null);
 const [sourceMode,setSourceMode]=useState<'image'|'video'>('image');
 const workspace=useWorkspaceRoute();
 const [view,setView]=useWorkspaceListState<'library'|'create'|'history'>('scenes.tab','library'),[search,setSearch]=useWorkspaceListState<string>('scenes.search','');
 const route=`/api/campaigns/${encodeURIComponent(campaignId)}`;
 const {jobs,refresh,error:jobError}=useAIJobs(campaignId);
 const [maps,setMaps]=useState<SessionMapDocument[]>([]),[sources,setSources]=useState<WorldMapDocument[]>([]);
 const [title,setTitle]=useState(''),[prompt,setPrompt]=useState(''),[reference,setReference]=useState('');
 const [columns,setColumns]=useState(30),[rows,setRows]=useState(20),[weather,setWeather]=useState<NonNullable<Level['weather']>>('none');
 const [improve,setImprove]=useState(false),[topology,setTopology]=useState(true),[drawing,setDrawing]=useState(false),[drawingDirty,setDrawingDirty]=useState(false);
 const needsAI=aiAllowed&&(improve||topology||!reference);
 const [loading,setLoading]=useState(true);
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const [preview,setPreview]=useState<SessionMapDocument|null>(null),[jobId,setJobId]=useState('');
 const lock=useRef(false), requestRef=useRef<{key:string;id:string}|null>(null);
 const ownerId=useDraftOwner();
 const form=JSON.stringify({title,prompt,reference,columns,rows,weather,improve,topology});
 const baseline=useRef(form);
 const dirty=!readOnly&&form!==baseline.current;
 useWorkspaceGuard(dirty||drawingDirty);
 const formDraft=useDeviceDraft({ownerId,campaignId,target:'scene-form',revision:0,enabled:!readOnly,dirty,value:{title,prompt,reference,columns,rows,weather,improve,topology,request:requestRef.current},restore:({value})=>{if(!value||typeof value.title!=='string'||typeof value.prompt!=='string'||typeof value.reference!=='string')return false;setTitle(value.title);setPrompt(value.prompt);setReference(value.reference);setColumns(Math.min(100,Math.max(10,Number(value.columns)||30)));setRows(Math.min(100,Math.max(10,Number(value.rows)||20)));setWeather(Object.hasOwn(weatherNames,value.weather)?value.weather:'none');setImprove(Boolean(value.improve));setTopology(Boolean(value.topology));if(value.request&&typeof value.request.key==='string'&&typeof value.request.id==='string')requestRef.current=value.request;setView('create');}});
 const load=async()=>{setLoading(true);try{const [scenes,worlds]=await Promise.all([mapRequest<SessionMapDocument[]|null>(`${route}/session-maps`),worldMapsAPI.list(campaignId)]);setMaps(scenes||[]);setSources(worlds);}finally{setLoading(false);}};
 useEffect(()=>{void load().catch(e=>setError(e.message));},[campaignId]);
 useEffect(()=>{if(workspace.view!=="scenes")return;if(!workspace.target){setPreview(null);return;}const found=maps.find(map=>map.id===workspace.target);if(found&&(!preview||preview.id!==found.id)){setPreview(found);setJobId("");}else if(!found&&!loading){setError("Сцена не найдена или недоступна. Выберите сцену из списка.");}},[workspace.target,maps,loading]);
 async function action(work:()=>Promise<void>){if(lock.current)return;lock.current=true;setBusy(true);setError('');try{await work();}catch(e){setError((e as Error).message);}finally{lock.current=false;setBusy(false);}}
 async function manualScene(){await action(async()=>{
  if(!reference||!title.trim())throw Error('Добавьте название и фон сцены.');
  const image=new Image();image.crossOrigin='use-credentials';await new Promise<void>((resolve,reject)=>{image.onload=()=>resolve();image.onerror=()=>reject(Error('Фон недоступен. Загрузите изображение заново.'));image.src=mapMediaURL(reference);});
  let ownReference=reference;const ownPrefix=`/uploads/${encodeURIComponent(ownerId)}/${encodeURIComponent(campaignId)}/`;
  if(!reference.startsWith(ownPrefix)){const response=await fetch(mapMediaURL(reference),{credentials:'include'});if(!response.ok)throw Error('Не удалось скопировать фон в сцену прохождения.');const blob=await response.blob();const saved=await api.uploadImage(campaignId,new File([blob],'scene-background.png',{type:blob.type||'image/png'}));ownReference=new URL(saved.url,location.origin).pathname;}
  setPreview({id:crypto.randomUUID(),title:title.trim(),revision:0,levels:[{id:'ground',name:title.trim(),imageUrl:ownReference,width:image.naturalWidth,height:image.naturalHeight,columns,rows,gridDistance:5,grid:{type:'square',size:1/columns,color:'#ffffff',opacity:.2},weather,walls:[],lights:[]}]});setJobId('');setNotice('Сцена готова к ручной разметке. После проверки сохраните её; исходный шаблон не изменяется.');
 });}
 async function generate(){if(!aiAvailable)return;if(!aiAllowed){setError("AI недоступен для шаблона. Создайте собственную сцену вручную.");return;}await action(async()=>{
  const input={title:title.trim()||prompt.trim().slice(0,80),prompt,referenceUrl:reference,columns,rows,distance:5,weather,improve,topology};
  const key=JSON.stringify(input);if(requestRef.current?.key!==key)requestRef.current={key,id:crypto.randomUUID()};
  await mapRequest<AIJob>(`${route}/scenes/ai`,'POST',{...input,requestId:requestRef.current.id});requestRef.current=null;
  baseline.current=form;formDraft.clear();setView('history');setNotice('Задача запущена. Можно продолжать игру: результат появится в истории генераций.');await refresh();
 });}
 async function useDrawing(map:WorldMapDocument){setDrawingDirty(false);setDrawing(false);await action(async()=>{
  const scene=sceneFromJSON(map.creative!),size=sceneSize(scene),structure=creativeStructure(scene);
  const png=await creativePNG({...scene,grid:false},1,true),upload=await api.uploadImage(campaignId,new File([png],'scene-background.png',{type:'image/png'}));
  const point=([x,y]:[number,number])=>({x:x/size.width,y:y/size.height});
  const cells=(px:number)=>Math.max(10,Math.min(100,Math.round(px/(scene.gridSize||50)*(scene.feetPerCell||5)/5)));
  setPreview({id:crypto.randomUUID(),title:map.title,revision:0,generation:{prompt:'',animatedDoors:true},levels:[{creative:map.creative,id:'ground',name:map.title,imageUrl:new URL(upload.url,location.origin).pathname,...size,columns:cells(size.width),rows:cells(size.height),gridDistance:5,grid:{type:'square',size:1/cells(size.width),color:'#ffffff',opacity:.2},weather,lights:[],walls:[...creativeWalls(scene).map(([a,b])=>({id:crypto.randomUUID(),kind:'wall' as const,start:point(a),end:point(b)})),...structure.doors.map(([a,b])=>({id:crypto.randomUUID(),kind:'door' as const,start:point(a),end:point(b),doorVisual:{style:'wood' as const,direction:1 as const,double:false,flip:false,strength:1,duration:700}}))]}]});setJobId('');setDrawingDirty(false);setDrawing(false);setNotice('Рисунок перенесён со стенами и дверями. Проверьте разметку и сохраните сцену; AI не требуется.');
 });}
 function source(map:WorldMapDocument){void action(async()=>{
  let url=map.imageUrl;
  if(map.creative){const scene=sceneFromJSON(map.creative),size=sceneSize(scene);const png=await creativePNG({...scene,grid:false});const uploaded=await api.uploadImage(campaignId,new File([png],'scene-background.png',{type:'image/png'}));url=new URL(uploaded.url,location.origin).pathname;const cells=(px:number)=>Math.max(10,Math.min(100,Math.round(px/(scene.gridSize||50)*(scene.feetPerCell||5)/5)));setColumns(cells(size.width));setRows(cells(size.height));}
  if(map.columns&&map.rows){setColumns(map.columns);setRows(map.rows);}setReference(url);setTitle(map.title);setNotice('Фон выбран. Можно улучшить его с AI или сразу распознать стены, двери и свет.');
 });}
 const sceneJobs=jobs.filter(j=>j.kind==='foundry-scene');
 if(drawing)return <><button onClick={async ()=>{if(!drawingDirty||await confirmAction('Закрыть холст без сохранения?'))setDrawing(false);}}>Вернуться к сценам</button><CreativeMapEditor campaignId={campaignId} initialSize={{columns,rows}} onDirty={setDrawingDirty} onSaved={m=>void useDrawing(m)} onVariant={m=>{source(m);setDrawing(false);}}/></>;
 return <section className="scene-workspace"><DeviceDraftControls draft={formDraft} label="черновик сцены"/><header><small>МАСТЕРСКАЯ СЦЕН</small><h2>Сцены кампании</h2><p>Выберите готовую сцену для просмотра и правок или создайте новую. Одна клетка — 5 футов.</p></header>
 <nav className="scene-tabs" aria-label="Разделы сцен"><button aria-pressed={view==='library'} onClick={()=>setView('library')}>Готовые сцены · {maps.length}</button><button aria-pressed={view==='history'} onClick={()=>setView('history')}>История генераций · {sceneJobs.length}{sceneJobs.some(isActiveJob)?' · В работе':''}</button>{!readOnly&&<button className="map-primary" aria-pressed={view==='create'} onClick={()=>setView('create')}>＋ Создать сцену</button>}</nav>
 {!aiAllowed&&!readOnly&&<p>Это собственные сцены вашего прохождения: их можно создавать и редактировать. Исходные карты готовой кампании защищены; AI для шаблона отключён.</p>}{view==='create'&&!readOnly&&<div className="scene-source-actions" role="group" aria-label="Источник сцены"><button aria-pressed={sourceMode==='image'} onClick={()=>setSourceMode('image')}>Изображение / AI</button><button aria-pressed={sourceMode==='video'} onClick={()=>setSourceMode('video')}>Видео по ссылке</button></div>}{view==='create'&&!readOnly&&sourceMode==='video'&&<ExternalSceneForm campaignId={campaignId} onReady={(map,clear)=>{videoDraft.current={id:map.id,clear};setPreview(map);setJobId('');}}/>}{view==='create'&&!readOnly&&sourceMode==='image'&&<form className="scene-create" onSubmit={e=>{e.preventDefault();void (needsAI?generate():manualScene());}}><fieldset disabled={busy}>
 <label>Название<input value={title} onChange={e=>setTitle(e.target.value)} maxLength={160} placeholder="Заброшенная церковь"/></label>
 <label>Описание<textarea value={prompt} onChange={e=>setPrompt(e.target.value)} minLength={aiAllowed&&!reference?10:undefined} required={aiAllowed&&!reference} maxLength={4000} rows={4} placeholder="Заброшенная церковь: разрушенный алтарь, боковые приделы, факелы у входа, двор. Вид сверху, без крыши."/></label>
 <div className="scene-source-actions"><label className="scene-upload">Загрузить свой фон<input type="file" accept="image/*" onChange={e=>{const file=e.target.files?.[0];if(file)void action(async()=>{const uploaded=await api.uploadImage(campaignId,await prepareMapImage(file));setReference(new URL(uploaded.url,location.origin).pathname);if(!title)setTitle(file.name.replace(/\.[^.]+$/,''));});e.target.value='';}}/></label>{aiAllowed&&<button type="button" onClick={()=>setDrawing(true)}>Нарисовать в Креативе</button>}</div>
 <label>Или взять сохранённую карту<select value={sources.find(m=>m.imageUrl===reference)?.id||''} onChange={e=>{const map=sources.find(m=>m.id===e.target.value);if(map)source(map);}}><option value="">Выберите фон</option>{sources.map(m=><option key={m.id} value={m.id}>{m.title}</option>)}</select></label>
 {reference&&<div className="scene-reference"><img src={mapMediaURL(reference)} alt="Выбранный фон"/><button type="button" onClick={()=>setReference('')}>Убрать фон</button>{aiAllowed&&<label><input type="checkbox" checked={improve} onChange={e=>setImprove(e.target.checked)}/>Улучшить фон с AI перед разметкой</label>}</div>}
 <div className="scene-dimensions"><label>Ширина, клеток<input type="number" min={10} max={100} required value={columns} onChange={e=>setColumns(+e.target.value)}/></label><span>×</span><label>Высота, клеток<input type="number" min={10} max={100} required value={rows} onChange={e=>setRows(+e.target.value)}/></label><label>Погода<select aria-label="Погода" value={weather} onChange={e=>setWeather(e.target.value as typeof weather)}>{Object.entries(weatherNames).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></label></div>
 <small>{columns*5} × {rows*5} футов · фон подгоняется под выбранное соотношение сторон</small>
 {aiAllowed&&<label><input type="checkbox" checked={topology} onChange={e=>setTopology(e.target.checked)}/>Распознать стены, двери и освещение по картинке</label>}
 <>{aiAllowed&&<AIConnectionSummary feature="images" onAvailable={setAIAvailable}/>}</><button className="map-primary" type="submit" disabled={needsAI&&!aiAvailable}>{busy?'Подготавливаем…':!needsAI?'Открыть ручную разметку':reference&&!improve?(topology?'Сгенерировать стены, двери и свет':'Подготовить сцену по картинке'):'Сгенерировать сцену'}</button>{needsAI&&<small>Ориентир: 2–8 минут; анализ готового фона обычно быстрее. Время зависит от провайдера и очереди.</small>}
 </fieldset></form>}
 {readOnly&&<p>Шаблон кампании доступен только для чтения.</p>}
 {(error||jobError)&&<p role="alert">{error||jobError} <button onClick={()=>{setError('');void load().catch(reason=>setError(reason.message));}}>Повторить загрузку сцен</button></p>}{notice&&<p role="status">{notice}</p>}
 {view==='history'&&<section aria-label="Фоновые сцены" className="scene-jobs">{!sceneJobs.length&&<p>Здесь появятся фоновые задачи и результаты генерации.</p>}{[...sceneJobs].sort((a,b)=>Date.parse(b.createdAt)-Date.parse(a.createdAt)).map(job=><article key={job.id}>{isActiveJob(job)?<AIJobProgress job={job}/>:<><strong>{job.title}</strong><p>{job.state==='succeeded'?'✓ Сцена готова к просмотру':'Генерация не завершена'}</p><button disabled={busy} onClick={()=>void action(async()=>{const result=await api.getAIJob(job.id);if(result.result?.error){const saved=result.sceneInput;if(saved){setView('create');setTitle(saved.title);setPrompt(saved.prompt);setColumns(saved.columns);setRows(saved.rows);setWeather(saved.weather as Level['weather']||'none');setReference(saved.referenceUrl||'');setImprove(saved.improve);setTopology(saved.topology);}throw Error(result.result.error.message+(saved?' Описание и настройки восстановлены в форме.':''));}setPreview(result.result?.data as SessionMapDocument);setJobId(job.id);})}>Посмотреть результат</button></>}</article>)}</section>}
 {view==='library'&&<section aria-label="Готовые сцены"><label>Найти сцену<input type="search" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Название сцены"/></label><p>В модуле Foundry нажмите «Обновить с сайта». Сцены появятся в папке кампании → «Карты сессий», с отдельными папками для этажей.</p>
 <div className="scene-library">{maps.filter(map=>map.title.toLocaleLowerCase().includes(search.toLocaleLowerCase())).map(map=><button key={map.id} onClick={()=>{setPreview(map);setJobId('');navigateWorkspace(workspaceURL({campaignId,section:'maps',view:'scenes',target:map.id}));}}>{map.levels[0].video?<div className="scene-video-thumbnail">{map.levels[0].video.posterUrl&&<img loading="lazy" src={map.levels[0].video.posterUrl} alt=""/>}<span>▶ Видеофон</span></div>:<img loading="lazy" src={mapMediaURL(map.levels[0].imageUrl)} alt=""/>}<strong>{map.title}</strong><small>{map.levels.length} этаж · {map.levels[0].walls.length} стен и дверей</small></button>)}</div>{loading&&<p role="status">Загружаю сцены…</p>}{!loading&&!error&&!maps.length&&<p>Пока нет сохранённых сцен. Нажмите «Создать сцену» и выберите фон для разметки.</p>}{maps.length>0&&!maps.some(m=>m.title.toLocaleLowerCase().includes(search.toLocaleLowerCase()))&&<p>Сцен с таким названием нет.</p>}</section>}
 {preview&&<ScenePreview campaignId={campaignId} key={`${preview.id}:${preview.revision}:${jobId}`} map={preview} creativeSources={sources.filter(m=>!!m.creative)} error={error} editable={!readOnly} busy={busy} onClose={()=>{setPreview(null);navigateWorkspace(workspaceURL({campaignId,section:"maps",view:"scenes"}));}} onSave={(map,afterSave)=>void action(async()=>{map=await saveCreativeBackgrounds(map,campaignId);await mapRequest(map.revision?`${route}/session-maps/${encodeURIComponent(map.id)}`:`${route}/session-maps`,map.revision?'PUT':'POST',map);afterSave?.();if(videoDraft.current?.id===map.id){videoDraft.current.clear();videoDraft.current=null;}if(!map.revision){baseline.current=form;formDraft.clear();}await load();setPreview(null);navigateWorkspace(workspaceURL({campaignId,section:'maps',view:'scenes'}),true);setView('library');setNotice('Сцена сохранена. Обновите её в модуле Foundry.');})} onAccept={jobId&&!readOnly&&aiAllowed?(edited)=>void action(async()=>{const saved=await mapRequest<SessionMapDocument>(`${route}/scenes/ai/${jobId}/apply`,'POST',{scene:edited});setPreview(saved);setJobId('');navigateWorkspace(workspaceURL({...workspace,campaignId,section:'maps',view:'scenes',target:saved.id}));await load();setNotice('Сцена добавлена. Можно поправить разметку и импортировать в Foundry.');}):undefined} onTopology={aiAllowed&&!preview.levels.some(l=>!!l.video)?level=>void action(async()=>{await mapRequest(`${route}/scenes/ai`,'POST',{requestId:crypto.randomUUID(),title:preview.title,prompt:preview.generation?.prompt||`Повторная разметка существующей сцены: ${preview.title}`,referenceUrl:level.imageUrl,columns:level.columns||30,rows:level.rows||20,distance:level.gridDistance||5,weather:level.weather||'none',topology:true,improve:false,animatedDoors:preview.generation?.animatedDoors??level.walls.some(w=>!!w.doorVisual)});setNotice('Повторная разметка запущена по готовому фону. Результат появится в фоновых сценах; исходная сцена сохранена.');await refresh();}):undefined} onRegenerate={aiAllowed&&!preview.levels.some(l=>!!l.video)?()=>{setView('create');setTitle(preview.title);setPrompt(preview.generation?.prompt||prompt);setReference(preview.levels[0].imageUrl);setColumns(preview.levels[0].columns||30);setRows(preview.levels[0].rows||20);setWeather(preview.levels[0].weather||'none');setPreview(null);setNotice('Фон выбран для нового варианта. Уточните описание и запустите генерацию. Исходная сцена сохранится.');}:undefined}/>}
 </section>;
}

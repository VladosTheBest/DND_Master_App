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

type Level = SessionMapDocument['levels'][number];
const weatherNames = {none:'Без осадков',rain:'Дождь',storm:'Гроза',snow:'Снег',fog:'Туман'};
export function ScenesWorkspace({campaignId,readOnly}:{campaignId:string;readOnly:boolean}) {
 const route=`/api/campaigns/${encodeURIComponent(campaignId)}`;
 const {jobs,refresh,error:jobError}=useAIJobs(campaignId);
 const [maps,setMaps]=useState<SessionMapDocument[]>([]),[sources,setSources]=useState<WorldMapDocument[]>([]);
 const [title,setTitle]=useState(''),[prompt,setPrompt]=useState(''),[reference,setReference]=useState('');
 const [columns,setColumns]=useState(30),[rows,setRows]=useState(20),[weather,setWeather]=useState<NonNullable<Level['weather']>>('none');
 const [improve,setImprove]=useState(false),[topology,setTopology]=useState(true),[drawing,setDrawing]=useState(false),[drawingDirty,setDrawingDirty]=useState(false);
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const [preview,setPreview]=useState<SessionMapDocument|null>(null),[jobId,setJobId]=useState('');
 const lock=useRef(false), requestRef=useRef<{key:string;id:string}|null>(null);
 const load=async()=>{const [scenes,worlds]=await Promise.all([mapRequest<SessionMapDocument[]|null>(`${route}/session-maps`),worldMapsAPI.list(campaignId)]);setMaps(scenes||[]);setSources(worlds);};
 useEffect(()=>{void load().catch(e=>setError(e.message));},[campaignId]);
 async function action(work:()=>Promise<void>){if(lock.current)return;lock.current=true;setBusy(true);setError('');try{await work();}catch(e){setError((e as Error).message);}finally{lock.current=false;setBusy(false);}}
 async function generate(){await action(async()=>{
  const input={title:title.trim()||prompt.trim().slice(0,80),prompt,referenceUrl:reference,columns,rows,distance:5,weather,improve,topology};
  const key=JSON.stringify(input);if(requestRef.current?.key!==key)requestRef.current={key,id:crypto.randomUUID()};
  await mapRequest<AIJob>(`${route}/scenes/ai`,'POST',{...input,requestId:requestRef.current.id});requestRef.current=null;
  setNotice('Задача запущена. Можно продолжать игру: готовый вариант появится ниже и в AI-задачах.');await refresh();
 });}
 function source(map:WorldMapDocument){void action(async()=>{
  let url=map.imageUrl;
  if(map.creative){const scene=sceneFromJSON(map.creative),size=sceneSize(scene);const png=await creativePNG({...scene,grid:false});const uploaded=await api.uploadImage(campaignId,new File([png],'scene-background.png',{type:'image/png'}));url=new URL(uploaded.url,location.origin).pathname;const cells=(px:number)=>Math.max(10,Math.min(100,Math.round(px/(scene.gridSize||50)*(scene.feetPerCell||5)/5)));setColumns(cells(size.width));setRows(cells(size.height));}
  setReference(url);setTitle(map.title);setNotice('Фон выбран. Можно улучшить его с AI или сразу распознать стены, двери и свет.');
 });}
 const sceneJobs=jobs.filter(j=>j.kind==='foundry-scene');
 if(drawing)return <><button onClick={()=>{if(!drawingDirty||confirm('Закрыть холст без сохранения?'))setDrawing(false);}}>Вернуться к сценам</button><CreativeMapEditor campaignId={campaignId} onDirty={setDrawingDirty} onSaved={m=>{source(m);setSources(v=>[m,...v.filter(x=>x.id!==m.id)]);}} onVariant={m=>{source(m);setDrawing(false);}}/></>;
 return <section className="scene-workspace"><header><small>МАСТЕРСКАЯ СЦЕН</small><h2>От замысла до игрового стола</h2><p>Фон, стены, двери, свет и погода. Одна клетка — 5 футов. Новые AI-фоны создаются с отдельными подвижными створками в Foundry; положение и петли настраиваются в модуле.</p></header>
 {!readOnly&&<form className="scene-create" onSubmit={e=>{e.preventDefault();void generate();}}><fieldset disabled={busy}>
 <label>Название<input value={title} onChange={e=>setTitle(e.target.value)} maxLength={160} placeholder="Заброшенная церковь"/></label>
 <label>Описание<textarea value={prompt} onChange={e=>setPrompt(e.target.value)} minLength={reference?undefined:10} required={!reference} maxLength={4000} rows={4} placeholder="Заброшенная церковь: разрушенный алтарь, боковые приделы, факелы у входа, двор. Вид сверху, без крыши."/></label>
 <div className="scene-source-actions"><label className="scene-upload">Загрузить свой фон<input type="file" accept="image/*" onChange={e=>{const file=e.target.files?.[0];if(file)void action(async()=>{const uploaded=await api.uploadImage(campaignId,await prepareMapImage(file));setReference(new URL(uploaded.url,location.origin).pathname);if(!title)setTitle(file.name.replace(/\.[^.]+$/,''));});e.target.value='';}}/></label><button type="button" onClick={()=>setDrawing(true)}>Нарисовать в Креативе</button></div>
 <label>Или взять сохранённую карту<select value={sources.find(m=>m.imageUrl===reference)?.id||''} onChange={e=>{const map=sources.find(m=>m.id===e.target.value);if(map)source(map);}}><option value="">Выберите фон</option>{sources.map(m=><option key={m.id} value={m.id}>{m.title}</option>)}</select></label>
 {reference&&<div className="scene-reference"><img src={mapMediaURL(reference)} alt="Выбранный фон"/><button type="button" onClick={()=>setReference('')}>Убрать фон</button><label><input type="checkbox" checked={improve} onChange={e=>setImprove(e.target.checked)}/>Улучшить фон с AI перед разметкой</label></div>}
 <div className="scene-dimensions"><label>Ширина, клеток<input type="number" min={10} max={100} required value={columns} onChange={e=>setColumns(+e.target.value)}/></label><span>×</span><label>Высота, клеток<input type="number" min={10} max={100} required value={rows} onChange={e=>setRows(+e.target.value)}/></label><label>Погода<select aria-label="Погода" value={weather} onChange={e=>setWeather(e.target.value as typeof weather)}>{Object.entries(weatherNames).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></label></div>
 <small>{columns*5} × {rows*5} футов · фон подгоняется под выбранное соотношение сторон</small>
 <label><input type="checkbox" checked={topology} onChange={e=>setTopology(e.target.checked)}/>Распознать стены, двери и освещение по картинке</label>
 <button className="map-primary" type="submit">{busy?'Отправляем…':reference&&!improve?(topology?'Сгенерировать стены, двери и свет':'Подготовить сцену по картинке'):'Сгенерировать сцену'}</button><small>Ориентир: 2–8 минут; анализ готового фона обычно быстрее. Время зависит от провайдера и очереди.</small>
 </fieldset></form>}
 {readOnly&&<p>Шаблон кампании доступен только для чтения.</p>}
 {(error||jobError)&&<p role="alert">{error||jobError}</p>}{notice&&<p role="status">{notice}</p>}
 <section aria-label="Фоновые сцены" className="scene-jobs">{sceneJobs.map(job=><article key={job.id}>{isActiveJob(job)?<AIJobProgress job={job}/>:<><strong>{job.title}</strong><p>{job.state==='succeeded'?'✓ Сцена готова к просмотру':'Генерация не завершена'}</p><button disabled={busy} onClick={()=>void action(async()=>{const result=await api.getAIJob(job.id);if(result.result?.error)throw Error(result.result.error.message);setPreview(result.result?.data as SessionMapDocument);setJobId(job.id);})}>Посмотреть результат</button></>}</article>)}</section>
 <h3>Сцены кампании · {maps.length}</h3><p>В модуле Foundry нажмите «Обновить с сайта». Сцены появятся в папке кампании → «Карты сессий», с отдельными папками для этажей.</p>
 <div className="scene-library">{maps.map(map=><button key={map.id} onClick={()=>{setPreview(map);setJobId('');}}><img src={mapMediaURL(map.levels[0].imageUrl)} alt=""/><strong>{map.title}</strong><small>{map.levels.length} этаж · {map.levels[0].walls.length} стен и дверей</small></button>)}</div>
 {preview&&<ScenePreview key={`${preview.id}:${preview.revision}:${jobId}`} map={preview} editable={!readOnly&&!jobId} busy={busy} onClose={()=>setPreview(null)} onSave={map=>void action(async()=>{await mapRequest(`${route}/session-maps/${encodeURIComponent(map.id)}`,'PUT',map);await load();setPreview(null);setNotice('Сцена сохранена. Обновите её в модуле Foundry.');})} onAccept={jobId&&!readOnly?()=>void action(async()=>{const saved=await mapRequest<SessionMapDocument>(`${route}/scenes/ai/${jobId}/apply`,'POST',{});setPreview(saved);setJobId('');await load();setNotice('Сцена добавлена. Можно поправить разметку и импортировать в Foundry.');}):undefined} onRegenerate={()=>{setTitle(preview.title);setReference(preview.levels[0].imageUrl);setColumns(preview.levels[0].columns||30);setRows(preview.levels[0].rows||20);setWeather(preview.levels[0].weather||'none');setPreview(null);setNotice('Фон выбран для нового варианта. Уточните описание и запустите генерацию. Исходная сцена сохранится.');}}/>}
 </section>;
}

function ScenePreview({map,editable,busy,onClose,onSave,onAccept,onRegenerate}:{map:SessionMapDocument;editable:boolean;busy:boolean;onClose:()=>void;onSave:(map:SessionMapDocument)=>void;onAccept?:()=>void;onRegenerate:()=>void}){
 const [doc,setDoc]=useState(map),[levelIndex,setLevelIndex]=useState(0),[tool,setTool]=useState<'inspect'|'wall'|'door'|'light'|'delete'>('inspect');
 const [start,setStart]=useState<{x:number;y:number}|null>(null),[history,setHistory]=useState<SessionMapDocument[]>([]);
 const dialog=useRef<HTMLDialogElement>(null),level=doc.levels[levelIndex],dirty=JSON.stringify(doc)!==JSON.stringify(map);
 function close(){if(!dirty||confirm('Закрыть без сохранения правок сцены?'))onClose();}
 useEffect(()=>{dialog.current?.showModal();},[]);
 function change(patch:Partial<Level>){setHistory(h=>[...h.slice(-49),doc]);setDoc({...doc,levels:doc.levels.map((l,i)=>i===levelIndex?{...l,...patch}:l)});}
 return <dialog ref={dialog} className="scene-preview" onCancel={e=>{e.preventDefault();close();}}><header><h2>{doc.title}</h2><button aria-label="Закрыть предпросмотр" onClick={close}>✕</button></header><p>Проверьте разметку: стены — бирюзовые, двери — оранжевые, свет — жёлтый. AI может ошибаться.</p>
 <select aria-label="Этаж" value={levelIndex} onChange={e=>{setLevelIndex(+e.target.value);setStart(null);}}>{doc.levels.map((l,i)=><option key={l.id} value={i}>{l.name}</option>)}</select>
 <div className="scene-preview-canvas"><svg viewBox={`0 0 ${level.width} ${level.height}`} onClick={e=>{if(!editable||busy||tool==='inspect'||tool==='delete')return;const rect=e.currentTarget.getBoundingClientRect(),p={x:(e.clientX-rect.left)/rect.width,y:(e.clientY-rect.top)/rect.height};if(tool==='light'){change({lights:[...(level.lights||[]),{id:crypto.randomUUID(),...p,bright:10,dim:20,color:'#ffbd72'}]});return;}if(start){if(Math.hypot(p.x-start.x,p.y-start.y)>.002)change({walls:[...level.walls,{id:crypto.randomUUID(),kind:tool,start,end:p}]});setStart(null);}else setStart(p);}}>
 <image href={mapMediaURL(level.imageUrl)} width={level.width} height={level.height}/>
 {(level.lights||[]).map(l=><circle key={l.id} cx={l.x*level.width} cy={l.y*level.height} r={Math.max(5,l.dim/5*level.width/(level.columns||30))} fill="#ffd16633" stroke="#ffd166" strokeWidth={2} onClick={e=>{if(editable&&!busy&&tool==='delete'){e.stopPropagation();change({lights:level.lights?.filter(x=>x.id!==l.id)});}}}/>)}
 {level.walls.map(w=><line key={w.id} x1={w.start.x*level.width} y1={w.start.y*level.height} x2={w.end.x*level.width} y2={w.end.y*level.height} stroke={w.kind==='door'?'#ff9e45':'#52e8d4'} strokeWidth={Math.max(3,level.width/250)} style={{cursor:tool==='delete'?'pointer':undefined}} onClick={e=>{if(editable&&!busy&&tool==='delete'){e.stopPropagation();change({walls:level.walls.filter(x=>x.id!==w.id)});}}}/>)}
 {start&&<circle cx={start.x*level.width} cy={start.y*level.height} r={6} fill="white"/>}</svg></div>
 <p>{level.columns||Math.round(1/(level.grid?.size||.1))} × {level.rows||'—'} клеток · 5 футов · {level.walls.filter(w=>w.kind!=='door').length} стен · {level.walls.filter(w=>w.kind==='door').length} дверей · {level.lights?.length||0} источников света</p>
 {editable&&<fieldset disabled={busy}><div className="scene-source-actions">{(['inspect','wall','door','light','delete'] as const).map((t,i)=><button key={t} aria-pressed={t===tool} onClick={()=>{setTool(t);setStart(null);}}>{['Просмотр','Стена: две точки','Дверь: две точки','Добавить свет','Удалить элемент'][i]}</button>)}<button disabled={!history.length} onClick={()=>{setDoc(history[history.length-1]);setHistory(h=>h.slice(0,-1));setStart(null);}}>Отменить</button></div><p>Для двери удалите перекрывающий сегмент стены и поставьте две стены по краям проёма.</p><label>Темнота<input type="range" min={0} max={1} step={.05} value={level.darkness||0} onChange={e=>change({darkness:+e.target.value})}/></label><label>Погода<select aria-label="Погода сцены" value={level.weather||'none'} onChange={e=>change({weather:e.target.value as Level['weather']})}>{Object.entries(weatherNames).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></label></fieldset>}
 <footer>{onAccept&&<button disabled={busy} onClick={onAccept}>Добавить в сцены кампании</button>}{editable&&<button disabled={busy||!dirty} onClick={()=>onSave(doc)}>Сохранить правки</button>}<button disabled={busy} onClick={()=>{if(!dirty||confirm('Продолжить без сохранения правок?'))onRegenerate();}}>Новый вариант / повторная разметка</button><button onClick={close}>Закрыть</button></footer></dialog>;
}

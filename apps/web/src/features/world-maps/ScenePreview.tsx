import {useEffect,useRef,useState,type PointerEvent} from 'react';
import type {SessionMapDocument} from '@shadow-edge/shared-types';
import {mapMediaURL} from './world-maps.api';
import {cutSceneOpenings,editableScene,publishScene,snapSceneDoor,type SceneLevel} from './scene-editing';

type Point={x:number;y:number};
type Props={map:SessionMapDocument;editable:boolean;busy:boolean;error?:string;onClose:()=>void;onSave:(map:SessionMapDocument)=>void;onAccept?:(map:SessionMapDocument)=>void;onRegenerate:()=>void;onTopology:(level:SceneLevel)=>void};
const weatherNames={none:'Без осадков',rain:'Дождь',storm:'Гроза',snow:'Снег',fog:'Туман'};
export function ScenePreview({map,editable,busy,error,onClose,onSave,onAccept,onRegenerate,onTopology}:Props){
 const [doc,setDoc]=useState(()=>editableScene(map)),[levelIndex,setLevelIndex]=useState(0);
 const [tool,setTool]=useState<'inspect'|'wall'|'door'|'light'|'delete'>('inspect'),[start,setStart]=useState<Point|null>(null);
 const [history,setHistory]=useState<SessionMapDocument[]>([]),[selected,setSelected]=useState(''),[zoom,setZoom]=useState(1);
 const dialog=useRef<HTMLDialogElement>(null),svg=useRef<SVGSVGElement>(null);
 const drag=useRef<{id:string;part:'start'|'end'|'body'|'light';origin:Point;before:SessionMapDocument}|null>(null);
 const latest=useRef(doc);latest.current=doc;
 const level=doc.levels[levelIndex],dirty=JSON.stringify(doc)!==JSON.stringify(editableScene(map));
 const wall=level.walls.find(w=>w.id===selected);
 useEffect(()=>{dialog.current?.showModal();},[]);
 function close(){if(!dirty||confirm('Закрыть без сохранения правок сцены?'))onClose();}
 function change(patch:Partial<SceneLevel>){setHistory(h=>[...h.slice(-49),doc]);setDoc({...doc,levels:doc.levels.map((l,i)=>i===levelIndex?{...l,...patch}:l)});}
 function point(e:{clientX:number;clientY:number}):Point{const matrix=svg.current!.getScreenCTM()!,p=new DOMPoint(e.clientX,e.clientY).matrixTransform(matrix.inverse());return {x:Math.max(0,Math.min(1,p.x/level.width)),y:Math.max(0,Math.min(1,p.y/level.height))};}
 function begin(e:PointerEvent,id:string,part:'start'|'end'|'body'|'light'){
  if(!editable||busy||tool!=='inspect')return;e.stopPropagation();e.preventDefault();setSelected(id);drag.current={id,part,origin:point(e),before:doc};svg.current!.setPointerCapture(e.pointerId);
 }
 function move(e:PointerEvent){const g=drag.current;if(!g||busy)return;const p=point(e),base=g.before.levels[levelIndex];let dx=p.x-g.origin.x,dy=p.y-g.origin.y;
  if(g.part==='light'){setDoc({...g.before,levels:g.before.levels.map((l,i)=>i!==levelIndex?l:{...l,lights:l.lights?.map(v=>v.id===g.id?{...v,x:Math.max(0,Math.min(1,v.x+dx)),y:Math.max(0,Math.min(1,v.y+dy))}:v)})});return;}
  const w=base.walls.find(w=>w.id===g.id)!;
  if(g.part==='body'){dx=Math.max(-Math.min(w.start.x,w.end.x),Math.min(1-Math.max(w.start.x,w.end.x),dx));dy=Math.max(-Math.min(w.start.y,w.end.y),Math.min(1-Math.max(w.start.y,w.end.y),dy));}
  let moved={...w,start:g.part==='end'?w.start:g.part==='start'?p:{x:w.start.x+dx,y:w.start.y+dy},end:g.part==='start'?w.end:g.part==='end'?p:{x:w.end.x+dx,y:w.end.y+dy}};
  if(w.kind==='door')moved=snapSceneDoor(moved,base.walls,base,18*level.width/svg.current!.getBoundingClientRect().width);
  setDoc({...g.before,levels:g.before.levels.map((l,i)=>i!==levelIndex?l:{...l,walls:l.walls.map(v=>v.id===w.id?moved:v)})});
 }
 function end(cancel=false){const g=drag.current;if(!g)return;drag.current=null;if(cancel){setDoc(g.before);return;}if(JSON.stringify(latest.current)!==JSON.stringify(g.before))setHistory(h=>[...h.slice(-49),g.before]);}
 function remove(id:string,light=false){if(!editable||busy||tool!=='delete')return;change(light?{lights:level.lights?.filter(v=>v.id!==id)}:{walls:level.walls.filter(v=>v.id!==id)});setSelected('');}
 function add(e:PointerEvent){if(!editable||busy||tool==='inspect'||tool==='delete'||e.button!==0)return;const p=point(e);
  if(tool==='light'){change({lights:[...(level.lights||[]),{id:crypto.randomUUID(),...p,bright:10,dim:20,color:'#ffbd72'}]});return;}
  if(start){if(Math.hypot(p.x-start.x,p.y-start.y)>.002){let w:SceneLevel['walls'][number]={id:crypto.randomUUID(),kind:tool,start,end:p};if(tool==='door'){w=snapSceneDoor(w,level.walls,level,24*level.width/svg.current!.getBoundingClientRect().width);if(map.generation?.animatedDoors)w.doorVisual={style:'wood',direction:1,double:false,flip:false,strength:1,duration:700};}change({walls:[...level.walls,w]});setSelected(w.id);}setStart(null);}else setStart(p);
 }
 const line=(w:SceneLevel['walls'][number],interactive:boolean)=> <line key={`${interactive?'hit':'visible'}-${w.id}`} x1={w.start.x*level.width} y1={w.start.y*level.height} x2={w.end.x*level.width} y2={w.end.y*level.height} stroke={interactive?'transparent':w.kind==='door'?'#ff9e45':'#52e8d4'} strokeWidth={interactive?16:3} vectorEffect="non-scaling-stroke" pointerEvents={interactive?'stroke':'none'} onPointerDown={interactive?e=>{if(tool==='delete'){e.stopPropagation();remove(w.id);}else begin(e,w.id,'body');}:undefined}/>;
 return <dialog ref={dialog} className="scene-preview" onCancel={e=>{e.preventDefault();close();}}>
 <header><h2>{doc.title}</h2><button aria-label="Закрыть предпросмотр" onClick={close}>✕</button></header>
 {map.generation?.topologyError&&<p role="alert">Фон сохранён, но AI-разметка не завершена: {map.generation.topologyError} Можно повторить распознавание или расставить элементы вручную.</p>}
 <p>Стены — бирюзовые, двери — оранжевые, свет — жёлтый. Проверьте расположение перед сохранением.</p>
 <select aria-label="Этаж" value={levelIndex} onChange={e=>{setLevelIndex(+e.target.value);setStart(null);setSelected('');}}>{doc.levels.map((l,i)=><option key={l.id} value={i}>{l.name}</option>)}</select>
 {editable&&<fieldset disabled={busy} className="scene-edit-tools"><legend>Разметка · исправьте перед сохранением</legend><div className="scene-source-actions">{(['inspect','wall','door','light','delete'] as const).map((t,i)=><button key={t} aria-pressed={t===tool} onClick={()=>{setTool(t);setStart(null);setSelected('');}}>{['Выбрать / двигать','＋ Стена','＋ Дверь','☀ Свет','Удалить'][i]}</button>)}<button disabled={!history.length} onClick={()=>{setDoc(history[history.length-1]);setHistory(h=>h.slice(0,-1));setStart(null);setSelected('');}}>Отменить</button></div><p>{tool==='inspect'?'Перетяните линию целиком, её круглые концы или источник света.':tool==='door'?'Нажмите начало и конец двери рядом со стеной: проём вырезается автоматически.':tool==='wall'?'Нажмите начало и конец стены.':tool==='delete'?'Нажмите элемент, который нужно удалить.':'Нажмите на карте, чтобы поставить источник света.'} При переносе двери прежний проём в добавленной стене закрывается.</p></fieldset>}
 <div className="scene-source-actions"><button disabled={zoom<=1} onClick={()=>setZoom(v=>Math.max(1,v-.5))}>−</button><output>{Math.round(zoom*100)}%</output><button disabled={zoom>=4} onClick={()=>setZoom(v=>Math.min(4,v+.5))}>＋</button><button onClick={()=>setZoom(1)}>Вся карта</button>{start&&<button onClick={()=>setStart(null)}>Отменить первую точку</button>}</div>
 <div className="scene-preview-scroll"><div className="scene-preview-canvas" style={{width:`${zoom*100}%`,maxWidth:'none'}}><svg ref={svg} viewBox={`0 0 ${level.width} ${level.height}`} onPointerDown={add} onPointerMove={move} onPointerUp={()=>end()} onPointerCancel={()=>end(true)} onLostPointerCapture={()=>end()}>
 <image href={mapMediaURL(level.imageUrl)} width={level.width} height={level.height}/>
 {(level.lights||[]).map(l=><g key={l.id}><circle cx={l.x*level.width} cy={l.y*level.height} r={Math.max(5,l.dim/5*level.width/(level.columns||30))} fill="#ffd16622" stroke="#ffd166" pointerEvents="none"/><circle aria-label="Источник света" cx={l.x*level.width} cy={l.y*level.height} r={8*level.width/850/zoom} fill="#ffd166" onPointerDown={e=>{if(tool==='delete'){e.stopPropagation();remove(l.id,true);}else begin(e,l.id,'light');}}/></g>)}
 {cutSceneOpenings(level.walls,level).map(w=>line(w,false))}
 {level.walls.filter(w=>w.kind!=='door').map(w=>line(w,true))}{level.walls.filter(w=>w.kind==='door').map(w=>line(w,true))}
 {editable&&tool==='inspect'&&wall&&(['start','end'] as const).map(part=><circle key={part} aria-label={part==='start'?'Начало выбранной линии':'Конец выбранной линии'} cx={wall[part].x*level.width} cy={wall[part].y*level.height} r={7*level.width/850/zoom} fill="white" stroke="#1b5351" onPointerDown={e=>begin(e,wall.id,part)}/>)}
 {start&&<circle cx={start.x*level.width} cy={start.y*level.height} r={6} fill="white"/>}</svg></div></div>
 <p>{level.columns||'—'} × {level.rows||'—'} клеток · 1 клетка = {level.gridDistance||5} футов · {level.walls.filter(w=>w.kind!=='door').length} стен · {level.walls.filter(w=>w.kind==='door').length} дверей · {level.lights?.length||0} источников света {dirty?'· Есть несохранённые правки':''}</p>
 {editable&&<details><summary>Погода и освещение</summary><fieldset disabled={busy}><label>Темнота<input type="range" min={0} max={1} step={.05} value={level.darkness||0} onChange={e=>change({darkness:+e.target.value})}/></label><label>Погода<select aria-label="Погода сцены" value={level.weather||'none'} onChange={e=>change({weather:e.target.value as SceneLevel['weather']})}>{Object.entries(weatherNames).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></label></fieldset></details>}
 <footer>{error&&<p role="alert" className="scene-save-error">{error}</p>}{busy&&<span role="status">Сохраняем / подготавливаем сцену…</span>}{onAccept?<button className="map-primary" disabled={busy} onClick={()=>onAccept(publishScene(doc))}>Сохранить сцену с разметкой</button>:editable&&<button className="map-primary" disabled={busy||(!dirty&&map.revision>0)} onClick={()=>onSave(publishScene(doc))}>{map.revision?'Сохранить правки':'Сохранить сцену'}</button>}<button disabled={busy||!editable} onClick={()=>{if(!dirty||confirm('Запустить повторную разметку без несохранённых правок?'))onTopology(level);}}>Заново стены, двери и свет</button><button disabled={busy||!editable} onClick={()=>{if(!dirty||confirm('Продолжить без сохранения правок?'))onRegenerate();}}>Новый вариант</button><button onClick={close}>Закрыть</button></footer>
 </dialog>;
}

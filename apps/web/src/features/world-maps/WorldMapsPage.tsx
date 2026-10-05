import { useEffect, useId, useRef, useState } from "react";
import { ArrowLeft, Bold, Download, Italic, Map, MessageSquare, Plus, Redo2, Save, Sparkles, Trash2, Type, Undo2, Scan, ZoomIn, ZoomOut } from "lucide-react";
import { TransformWrapper, TransformComponent, type ReactZoomPanPinchRef } from "react-zoom-pan-pinch";
import type { WorldMapDocument, WorldMapLabel } from "@shadow-edge/shared-types";
import { api } from "../../app/api";
import { MapCreateForm } from "./MapCreateForm";
import { mapFont, mapMediaURL, renderMapPNG, worldMapsAPI } from "./world-maps.api";
import { labelGeometry, labelTextSize, labelRoleSizes } from "./map-label-geometry";
import { arrangeMapLabels } from "./map-label-layout";
import { AISoundToggle } from "../ai-jobs/AISoundToggle";
import { useAIJobs } from "../ai-jobs/useAIJobs";
import "./world-maps.css";

export function WorldMapsPage(){
  useAIJobs();
  const [campaigns,setCampaigns]=useState<{id:string;title:string}[]>([]);
  const [campaign,setCampaign]=useState(new URLSearchParams(location.search).get("campaign")||"");
  const [error,setError]=useState("");
  useEffect(()=>{let alive=true;void api.listCampaigns().then(items=>{if(alive){setCampaigns(items);setCampaign(current=>items.some(c=>c.id===current)?current:items[0]?.id||"");}}).catch(()=>{if(alive)setError("Войди в аккаунт в кабинете мастера, чтобы открыть карты.");});return()=>{alive=false;};},[]);
  return <main className="world-maps-page"><aside className="world-maps-nav"><a href="/"><ArrowLeft size={17}/>Кабинет мастера</a><h1><Map size={25}/>Карты мира</h1><label>Кампания<select value={campaign} onChange={e=>{if(confirm("Перейти к другой кампании? Несохранённые правки будут потеряны.")){setCampaign(e.target.value);history.replaceState(null,"",`/maps?campaign=${encodeURIComponent(e.target.value)}`);}}}>{campaigns.map(c=><option key={c.id} value={c.id}>{c.title}</option>)}</select></label><a href={`/chat?campaign=${encodeURIComponent(campaign)}`}><MessageSquare size={17}/>AI-чат</a></aside><section className="world-maps-main">{error?<p role="alert">{error}</p>:campaign?<MapWorkspace key={campaign} campaignId={campaign}/>:<p role="status">{campaigns.length?"Выбери кампанию":"Нет доступных кампаний. Создай кампанию в кабинете мастера."}</p>}</section></main>;
}

function MapWorkspace({campaignId}:{campaignId:string}){
  const [maps,setMaps]=useState<WorldMapDocument[]>([]),[selected,setSelected]=useState(new URLSearchParams(location.search).get("map")||"");
  const [error,setError]=useState(""),[loading,setLoading]=useState(true),[creating,setCreating]=useState(false),[dirty,setDirty]=useState(false);
  useEffect(()=>{const abort=new AbortController();void worldMapsAPI.list(campaignId,abort.signal).then(items=>{setMaps(items);setSelected(current=>items.some(m=>m.id===current)?current:items[0]?.id||"");setCreating(!items.length);}).catch(e=>{if(!abort.signal.aborted)setError(e.message);}).finally(()=>{if(!abort.signal.aborted)setLoading(false);});return()=>abort.abort();},[campaignId]);
  useEffect(()=>{const leave=(event:BeforeUnloadEvent)=>{if(dirty){event.preventDefault();event.returnValue="";}};window.addEventListener("beforeunload",leave);return()=>window.removeEventListener("beforeunload",leave);},[dirty]);
  function navigate(id:string){if(dirty&&!confirm("Есть несохранённые правки. Перейти без сохранения?"))return;setDirty(false);setSelected(id);setCreating(!id);history.replaceState(null,"",`/maps?campaign=${encodeURIComponent(campaignId)}${id?`&map=${encodeURIComponent(id)}`:""}`);}
  function upsert(map:WorldMapDocument){setMaps(items=>[map,...items.filter(item=>item.id!==map.id)]);}
  const current=maps.find(map=>map.id===selected);
  return <><header className="world-maps-heading"><div><small>АТЛАС КАМПАНИИ</small><h2>{creating?"Новая карта":current?.title||"Карты мира"}</h2></div><div className="world-map-tools"><AISoundToggle/><button type="button" onClick={()=>navigate("")}><Plus size={18}/>Новая карта</button></div></header>
    <nav className="world-map-library" aria-label="Карты кампании">{maps.map(map=><button type="button" key={map.id} aria-current={!creating&&selected===map.id?"page":undefined} onClick={()=>navigate(map.id)}><img src={mapMediaURL(map.imageUrl)} alt=""/><span>{map.title}</span></button>)}</nav>
    {error&&<p role="alert">{error}</p>}{loading?<p role="status">Загружаю карты…</p>:creating?<div className="world-map-new"><h3>Каким будет этот мир?</h3><MapCreateForm campaignId={campaignId} onCreated={map=>{upsert(map);navigate(map.id);}}/></div>:current?<MapEditor key={current.id} campaignId={campaignId} original={current} onSaved={upsert} onVariant={map=>{upsert(map);navigate(map.id);}} onDirty={setDirty}/>:null}
  </>;
}

export function MapEditor({campaignId,original,onSaved,onDirty,onVariant}:{campaignId:string;original:WorldMapDocument;onSaved:(map:WorldMapDocument)=>void;onDirty:(dirty:boolean)=>void;onVariant?:(map:WorldMapDocument)=>void}){
  const [doc,setDoc]=useState(original),[saved,setSaved]=useState(original),[selection,setSelection]=useState(original.labels[0]?.id||"");
  const [past,setPast]=useState<WorldMapDocument[]>([]),[future,setFuture]=useState<WorldMapDocument[]>([]);
  const [zoom,setZoom]=useState(100),[busy,setBusy]=useState(false),[error,setError]=useState(""),[notice,setNotice]=useState("");
  const [editingAI,setEditingAI]=useState(false);
  const [imageError,setImageError]=useState(false);
	const [wheelStep,setWheelStep]=useState(()=>{try{const n=Number(localStorage.getItem("shadow-edge:map-wheel-step"));return n>=1&&n<=20?n:2;}catch{return 2;}});
	function changeWheelStep(value:number){const n=Math.min(20,Math.max(1,value||2));setWheelStep(n);try{localStorage.setItem("shadow-edge:map-wheel-step",String(n));}catch{/* Storage may be unavailable in private browsing. */}}
	const transform=useRef<ReactZoomPanPinchRef>(null);
  const svg=useRef<SVGSVGElement>(null),drag=useRef<{id:string;dx:number;dy:number}|null>(null),latest=useRef(doc),lock=useRef(false);
  latest.current=doc;
  const dirty=JSON.stringify(doc)!==JSON.stringify(saved),label=doc.labels.find(l=>l.id===selection);
  useEffect(()=>{onDirty(dirty);},[dirty,onDirty]);
  function change(next:WorldMapDocument){setPast(values=>[...values.slice(-49),latest.current]);setFuture([]);setDoc(next);setNotice("");}
  function patchLabel(patch:Partial<WorldMapLabel>){change({...doc,labels:doc.labels.map(l=>l.id===selection?{...l,...patch}:l)});}
  function arrange(){const result=arrangeMapLabels(doc);change(result.map);setNotice(result.unresolved?`Тесных участков: ${result.unresolved}. Проверь подписи вручную.`:"Подписи упорядочены. Сохрани изменения.");}
  function point(event:React.PointerEvent){const rect=svg.current!.getBoundingClientRect();return{x:(event.clientX-rect.left)/rect.width,y:(event.clientY-rect.top)/rect.height};}
  async function save(){
    if(lock.current)return;lock.current=true;setBusy(true);setError("");
    try{const result=await worldMapsAPI.save(campaignId,doc);setDoc(result);setSaved(result);setPast([]);setFuture([]);onSaved(result);setNotice("Карта сохранена");}catch(e){setError((e as Error).message);}finally{lock.current=false;setBusy(false);}
  }
  async function download(){
    if(lock.current)return;lock.current=true;setBusy(true);setError("");
    try{const blob=await renderMapPNG(doc),url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download=`${doc.title.replace(/[\\/:*?"<>|]/g,"_")||"world-map"}.png`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}catch(e){setError((e as Error).message);}finally{lock.current=false;setBusy(false);}
  }
  const labelPrefix=useId().replace(/:/g,"");
  const h=1000*doc.height/doc.width;
  return <section className="world-map-editor" aria-label="Редактор карты">
    <div className="world-map-toolbar"><label>Название<input aria-label="Название карты" maxLength={160} value={doc.title} disabled={busy} onChange={e=>change({...doc,title:e.target.value})}/></label><div className="world-map-tools">
      <button type="button" aria-label="Отменить правку" title="Отменить правку" disabled={!past.length||busy} onClick={()=>{setFuture(v=>[doc,...v]);setDoc({...past[past.length-1],revision:doc.revision});setPast(v=>v.slice(0,-1));}}><Undo2 size={18}/></button>
      <button type="button" aria-label="Повторить правку" title="Повторить правку" disabled={!future.length||busy} onClick={()=>{setPast(v=>[...v,doc]);setDoc({...future[0],revision:doc.revision});setFuture(v=>v.slice(1));}}><Redo2 size={18}/></button>
      <button type="button" disabled={busy||doc.labels.length>=100} onClick={()=>{const l:WorldMapLabel={id:crypto.randomUUID(),text:"Новое название",x:.5,y:.5,size:22,rotation:0,font:"serif",color:"#eee8ff",outline:"#211b30",bold:true,italic:false};change({...doc,labels:[...doc.labels,l]});setSelection(l.id);}}><Type size={18}/>Подпись</button>
      <button type="button" disabled={busy||!doc.labels.length} onClick={arrange}><Scan size={18}/>Упорядочить подписи</button>
      <button type="button" className="map-primary" disabled={busy||!dirty||!doc.title.trim()||doc.labels.some(l=>!l.text.trim())} onClick={()=>void save()}><Save size={18}/>Сохранить</button>
      <button type="button" title={dirty?"Сначала сохрани правки карты":"Изменить фон карты с AI"} disabled={busy||dirty||imageError} onClick={()=>setEditingAI(v=>!v)} aria-expanded={editingAI}><Sparkles size={18}/>Изменить с AI</button>
      <button type="button" disabled={busy||imageError} onClick={()=>void download()}><Download size={18}/>PNG</button>
    </div></div>
    {editingAI&&<section className="world-map-ai-edit"><h3>Новый вариант карты</h3>{dirty?<p role="status">Сохрани правки перед AI-редактированием.</p>:<MapCreateForm campaignId={campaignId} sourceMap={saved} storageKey={`edit:${saved.id}`} onCreated={map=>{setEditingAI(false);onVariant?.(map);}}/>}</section>}
    <div className="world-map-edit-layout"><div className="world-map-canvas-area"><div className="world-map-viewport">
		<TransformWrapper ref={transform} minScale={.01} maxScale={32} limitToBounds={false} fitOnInit="contain" centerOnInit smooth={false} wheel={{step:wheelStep/100}} panning={{excluded:["text","textPath"],velocityDisabled:true,allowMiddleClickPan:true}} doubleClick={{disabled:true}} zoomAnimation={{disabled:true}} autoAlignment={{disabled:true}} onTransform={(_,state)=>setZoom(Math.round(state.scale*100))}>
		<TransformComponent wrapperStyle={{width:"100%",height:"100%"}} contentStyle={{width:doc.width,height:doc.height}}><div className="world-map-surface" style={{width:doc.width,height:doc.height}}>
      <img src={mapMediaURL(doc.imageUrl)} alt={doc.title} draggable={false} onError={()=>setImageError(true)} onLoad={()=>setImageError(false)}/>
      <svg ref={svg} viewBox={`0 0 1000 ${h}`} aria-label="Подписи на карте" onPointerMove={event=>{if(!drag.current||busy)return;const p=point(event),active=drag.current;setDoc(d=>({...d,labels:d.labels.map(l=>l.id===active.id?{...l,x:Math.max(0,Math.min(1,p.x-active.dx)),y:Math.max(0,Math.min(1,p.y-active.dy))}:l)}));}} onPointerUp={()=>{drag.current=null;}} onPointerCancel={()=>{drag.current=null;}}>
        {doc.labels.map((l,index)=><g key={l.id} transform={`translate(${l.x*1000} ${l.y*h}) rotate(${l.rotation})`}><defs><path id={`${labelPrefix}-${index}`} d={labelGeometry(l).path}/></defs><text role="button" aria-label={`Подпись: ${l.text}`} tabIndex={0} className={selection===l.id?"selected":""} x={0} y={0} textAnchor="middle" dominantBaseline="central" fontFamily={mapFont(l.font)} fontSize={labelTextSize(l)} letterSpacing={0} fontWeight={l.bold?700:400} fontStyle={l.italic?"italic":"normal"} fill={l.color} stroke={l.outline} strokeWidth={3} paintOrder="stroke" strokeLinejoin="round" onFocus={()=>setSelection(l.id)} onKeyDown={event=>{if(busy)return;if(["ArrowLeft","ArrowRight","ArrowUp","ArrowDown"].includes(event.key)){event.preventDefault();const step=event.shiftKey?.02:.002;change({...doc,labels:doc.labels.map(item=>item.id===l.id?{...item,x:Math.max(0,Math.min(1,item.x+(event.key==="ArrowRight"?step:event.key==="ArrowLeft"?-step:0))),y:Math.max(0,Math.min(1,item.y+(event.key==="ArrowDown"?step:event.key==="ArrowUp"?-step:0)))}:item)});}}} onPointerDown={event=>{if(busy)return;event.preventDefault();setSelection(l.id);const p=point(event);drag.current={id:l.id,dx:p.x-l.x,dy:p.y-l.y};setPast(v=>[...v.slice(-49),doc]);setFuture([]);svg.current?.setPointerCapture(event.pointerId);}}>{l.curve?<textPath href={`#${labelPrefix}-${index}`} startOffset="50%">{l.text}</textPath>:l.text}</text></g>)}
      </svg>
    </div></TransformComponent></TransformWrapper></div><div className="world-map-canvas-footer"><span>{doc.width} × {doc.height} · {doc.labels.length} подписей</span><div className="world-map-zoom-controls">
		<button type="button" title="Отдалить" aria-label="Отдалить карту" onClick={()=>void transform.current?.zoomOut(.3,0)}><ZoomOut size={17}/></button>
		<select aria-label="Масштаб карты" value={zoom} onChange={e=>void transform.current?.centerView(Number(e.target.value)/100,0)}>{[...new Set([1,5,10,25,50,100,200,400,800,1600,3200,zoom])].sort((a,b)=>a-b).map(z=><option key={z} value={z}>{z}%</option>)}</select>
		<button type="button" title="Приблизить" aria-label="Приблизить карту" onClick={()=>void transform.current?.zoomIn(.3,0)}><ZoomIn size={17}/></button>
		<button type="button" title="Вписать карту" aria-label="Вписать карту" onClick={()=>void transform.current?.fitToView({mode:"contain",animationTime:0})}><Scan size={17}/></button>
		<label className="world-map-wheel-step" title="Изменение масштаба за шаг колеса">Шаг, %<input type="number" aria-label="Шаг колеса, %" min={1} max={20} step={1} value={wheelStep} onChange={e=>changeWheelStep(Number(e.target.value))}/></label>
		</div></div>{imageError&&<p role="alert">Не удалось загрузить изображение карты. Обнови страницу.</p>}</div>
    <aside className="world-map-properties"><h3>Подписи</h3><select aria-label="Выбранная подпись" value={selection} onChange={e=>setSelection(e.target.value)}><option value="">Не выбрана</option>{doc.labels.map(l=><option key={l.id} value={l.id}>{l.text||"Без названия"}</option>)}</select>
      {label?<fieldset disabled={busy}><label>Текст<input aria-label="Текст подписи" maxLength={160} value={label.text} onChange={e=>patchLabel({text:e.target.value})}/></label><label>Шрифт<select value={label.font} onChange={e=>patchLabel({font:e.target.value as WorldMapLabel["font"]})}><option value="serif">Georgia</option><option value="sans-serif">Arial</option><option value="monospace">Courier New</option></select></label>
      <div className="world-map-style-row"><button type="button" title="Полужирный" aria-label="Полужирный" aria-pressed={label.bold} onClick={()=>patchLabel({bold:!label.bold})}><Bold size={18}/></button><button type="button" title="Курсив" aria-label="Курсив" aria-pressed={label.italic} onClick={()=>patchLabel({italic:!label.italic})}><Italic size={18}/></button><label>Текст<input type="color" aria-label="Цвет текста" value={label.color} onChange={e=>patchLabel({color:e.target.value})}/></label><label>Обводка<input type="color" aria-label="Цвет обводки" value={label.outline} onChange={e=>patchLabel({outline:e.target.value})}/></label></div>
      <label>Уровень подписи<select aria-label="Уровень подписи" value={label.role||""} onChange={e=>{const role=e.target.value as NonNullable<WorldMapLabel["role"]>;patchLabel({role,size:labelRoleSizes[role]});}}><option value="" disabled>Произвольный</option><option value="major">Крупная география</option><option value="region">Регион / район</option><option value="settlement">Поселение</option><option value="site">Место</option></select></label>
      <label>Изгиб · {label.curve||0}<input type="range" aria-label="Изгиб подписи" min={-100} max={100} value={label.curve||0} onChange={e=>patchLabel({curve:+e.target.value})}/></label>
      {!!label.curve&&<label>Ширина дуги · {label.span||240}<input type="range" aria-label="Ширина дуги" min={60} max={900} value={label.span||240} onChange={e=>patchLabel({span:+e.target.value})}/></label>}
      <label>Размер · {label.size}<input type="range" aria-label="Размер подписи" min={8} max={100} value={label.size} onChange={e=>patchLabel({size:+e.target.value})}/></label><label>Поворот · {label.rotation}°<input type="range" aria-label="Поворот подписи" min={-180} max={180} value={label.rotation} onChange={e=>patchLabel({rotation:+e.target.value})}/></label>
      <button type="button" className="map-delete" onClick={()=>{change({...doc,labels:doc.labels.filter(l=>l.id!==selection)});setSelection("");}}><Trash2 size={17}/>Удалить подпись</button></fieldset>:<p>Нет выбранной подписи</p>}
      <details><summary>Описание карты</summary><p>{doc.prompt||"По референсу"}</p><small>{doc.provider==="codex"?"Codex":"API"}</small></details>
    </aside></div>
    <footer className="world-map-save-state" aria-live="polite">{busy?"Обрабатываю…":notice||(dirty?"Есть несохранённые изменения":"Все изменения сохранены")}</footer>{error&&<p role="alert">{error}</p>}
  </section>;
}

import { useEffect, useRef, useState, type ChangeEvent, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent } from "react";
import { createPortal } from "react-dom";
import type { PlayerDisplayFogPoint, PlayerDisplayFogRegion } from "@shadow-edge/shared-types";
import { api } from "./api";

type Props = { campaignId: string; open: boolean; onClose: () => void };
const youtubeId = (raw: string) => { try { const u=new URL(raw.trim()); const h=u.hostname.replace(/^www\./,"").toLowerCase(); if(h==="youtu.be") return u.pathname.split("/").filter(Boolean)[0]??""; if(["youtube.com","m.youtube.com","youtube-nocookie.com"].includes(h)) return u.searchParams.get("v")||u.pathname.match(/^\/(?:embed|shorts)\/([^/]+)/)?.[1]||""; } catch { return ""; } return ""; };
const eventPoint = (event: ReactPointerEvent<SVGSVGElement>): PlayerDisplayFogPoint => { const r=event.currentTarget.getBoundingClientRect(); return {x:Math.max(0,Math.min(1,(event.clientX-r.left)/r.width)),y:Math.max(0,Math.min(1,(event.clientY-r.top)/r.height))}; };
const svgPoints = (points: PlayerDisplayFogPoint[]) => points.map(p=>`${p.x*1000},${p.y*1000}`).join(" ");

export function SessionMapModal({campaignId,open,onClose}:Props){
  const [imageUrl,setImageUrl]=useState(""); const [mediaType,setMediaType]=useState<"image"|"youtube">("image");
  const [sourceUrl,setSourceUrl]=useState(""); const [title,setTitle]=useState("Карта приключения");
  const [regions,setRegions]=useState<PlayerDisplayFogRegion[]>([]); const [drawMode,setDrawMode]=useState(false);
  const [draft,setDraft]=useState<PlayerDisplayFogPoint[]>([]); const [busy,setBusy]=useState(false);
  const [notice,setNotice]=useState(""); const [displayUrl,setDisplayUrl]=useState("");
  const [regionMenu,setRegionMenu]=useState<{id:string;x:number;y:number}|null>(null);
  const drawing=useRef(false); const draftRef=useRef<PlayerDisplayFogPoint[]>([]);
  const previewPlayer=useRef<HTMLIFrameElement|null>(null); const [previewMuted,setPreviewMuted]=useState(true);

  useEffect(()=>{if(!open)return; const close=(e:KeyboardEvent)=>e.key==="Escape"&&onClose(); document.addEventListener("keydown",close); const old=document.body.style.overflow; document.body.style.overflow="hidden"; return()=>{document.removeEventListener("keydown",close);document.body.style.overflow=old;};},[onClose,open]);
  if(!open||typeof document==="undefined")return null;

  const publish=async(next=regions,openDisplay=false)=>{if(!imageUrl){setNotice("Сначала загрузите или подключите карту.");return;} setBusy(true);try{const share=await api.showPlayerDisplayImage(campaignId,{alt:title||"Карта игровой сессии",fogRegions:next,mediaType,sessionMap:true,title,url:imageUrl});setDisplayUrl(share.url);setNotice("Экран игроков обновлён.");if(openDisplay)window.open(share.url,"shadow-edge-session-display")?.focus();}catch(error){setNotice(error instanceof Error?error.message:"Не удалось обновить экран игроков.");}finally{setBusy(false);}};
  const updateRegions=(next:PlayerDisplayFogRegion[])=>{setRegions(next);if(displayUrl)void publish(next);};
  const resetFog=()=>{setRegions([]);setDraft([]);draftRef.current=[];};
  const upload=async(event:ChangeEvent<HTMLInputElement>)=>{const file=event.target.files?.[0];if(!file)return;setBusy(true);try{const result=await api.uploadImage(campaignId,file);setImageUrl(result.url);setMediaType("image");setTitle(file.name.replace(/\.[^.]+$/,"")||"Карта приключения");resetFog();setNotice("Карта загружена. Обведите скрываемые области.");}catch(error){setNotice(error instanceof Error?error.message:"Не удалось загрузить карту.");}finally{setBusy(false);event.target.value="";}};
  const useUrl=()=>{const value=sourceUrl.trim();if(!value)return;const id=youtubeId(value);if(id){setImageUrl(value);setMediaType("youtube");setTitle("Анимированная карта");resetFog();setNotice("YouTube-карта подключена. Обведите зоны тумана.");return;}try{const parsed=new URL(value);if(!/^https?:$/.test(parsed.protocol))throw new Error();setImageUrl(value);setMediaType("image");resetFog();setNotice("Карта по ссылке подключена.");}catch{setNotice("Укажите прямую ссылку на изображение или YouTube.");}};
  const begin=(event:ReactPointerEvent<SVGSVGElement>)=>{if(!drawMode||event.button!==0)return;setRegionMenu(null);event.currentTarget.setPointerCapture(event.pointerId);const p=eventPoint(event);drawing.current=true;draftRef.current=[p];setDraft([p]);};
  const move=(event:ReactPointerEvent<SVGSVGElement>)=>{if(!drawMode||!drawing.current)return;const p=eventPoint(event),last=draftRef.current.at(-1);if(last&&Math.hypot(p.x-last.x,p.y-last.y)<.006)return;draftRef.current=[...draftRef.current,p];setDraft(draftRef.current);};
  const finish=(event:ReactPointerEvent<SVGSVGElement>)=>{if(!drawing.current)return;drawing.current=false;event.currentTarget.releasePointerCapture(event.pointerId);const points=draftRef.current;draftRef.current=[];setDraft([]);if(points.length<3){setNotice("Нарисуйте область чуть длиннее.");return;}const next=[...regions,{id:crypto.randomUUID?.()??`region-${Date.now()}`,points,revealed:false}];updateRegions(next);setNotice(`Добавлена область ${next.length}. Она скрыта.`);};
  const togglePreviewSound=()=>{const next=!previewMuted;previewPlayer.current?.contentWindow?.postMessage(JSON.stringify({event:"command",func:next?"mute":"unMute",args:[]}),"https://www.youtube-nocookie.com");setPreviewMuted(next);};
  const openRegionMenu=(event:ReactMouseEvent<SVGPolygonElement>,id:string)=>{event.preventDefault();event.stopPropagation();setRegionMenu({id,x:event.clientX,y:event.clientY});};
  const deleteRegionFromMenu=()=>{if(!regionMenu)return;updateRegions(regions.filter(region=>region.id!==regionMenu.id));setRegionMenu(null);};

  return createPortal(<div className="session-map-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)onClose();else setRegionMenu(null);}}><section aria-modal="true" className="session-map-modal" role="dialog">
    <header className="session-map-head"><div><p className="eyebrow">Режим сессии</p><h2>Карта на телевизоре</h2><p>Обводите комнаты и открывайте их по мере исследования.</p></div><button aria-label="Закрыть" className="ghost" onClick={onClose} type="button">✕</button></header>
    <div className="session-map-layout"><div className="session-map-stage">{imageUrl?<div className={`session-map-image-shell ${mediaType==="youtube"?"video":""}`}>
      {mediaType==="youtube"?<iframe allow="autoplay; encrypted-media" ref={previewPlayer} src={`https://www.youtube-nocookie.com/embed/${youtubeId(imageUrl)}?autoplay=1&mute=1&loop=1&playlist=${youtubeId(imageUrl)}&controls=0&disablekb=1&enablejsapi=1&fs=0&playsinline=1&rel=0`} title={title}/>:<img alt={title} src={imageUrl}/>}
      <svg className={`session-map-region-editor ${drawMode?"drawing":""}`} onContextMenu={event=>event.preventDefault()} onPointerDown={begin} onPointerMove={move} onPointerUp={finish} preserveAspectRatio="none" viewBox="0 0 1000 1000">{regions.map((r,i)=><polygon className={r.revealed?"revealed":"hidden"} key={r.id} onContextMenu={event=>openRegionMenu(event,r.id)} points={svgPoints(r.points)}><title>{`Область ${i+1}`}</title></polygon>)}{draft.length>1?<polyline className="draft" points={svgPoints(draft)}/>:null}</svg>
    </div>:<label className="session-map-dropzone"><strong>Загрузить карту</strong><span>PNG, JPG, WEBP или GIF до 10 МБ</span><input accept="image/png,image/jpeg,image/webp,image/gif" disabled={busy} onChange={upload} type="file"/></label>}</div>
    <aside className="session-map-controls"><label>Ссылка на карту или YouTube<div className="session-map-url-row"><input onChange={e=>setSourceUrl(e.target.value)} placeholder="https://…" value={sourceUrl}/><button className="ghost" onClick={useUrl} type="button">Подключить</button></div></label>
      {imageUrl?<label className="session-map-upload-small">Заменить карту<input accept="image/png,image/jpeg,image/webp,image/gif" disabled={busy} onChange={upload} type="file"/></label>:null}
      <label>Название сцены<input onChange={e=>setTitle(e.target.value)} value={title}/></label>
      {mediaType==="youtube"?<button className="ghost" onClick={togglePreviewSound} type="button">{previewMuted?"Включить музыку у мастера":"Выключить музыку у мастера"}</button>:null}
      <button className={drawMode?"primary":"ghost"} disabled={!imageUrl} onClick={()=>setDrawMode(v=>!v)} type="button">{drawMode?"Рисование включено — ведите мышью":"Нарисовать область тумана"}</button>
      <p className="session-map-source-hint">Зажмите мышь и обведите комнату или зону. Контур замкнётся автоматически.</p>
      <div className="session-map-region-list">{regions.map((r,i)=><div className="session-map-region-row" key={r.id}><span>Область {i+1}</span><button className="ghost" onClick={()=>updateRegions(regions.map(item=>item.id===r.id?{...item,revealed:!item.revealed}:item))} type="button">{r.revealed?"Скрыть":"Показать"}</button><button aria-label="Удалить" className="ghost danger" onClick={()=>updateRegions(regions.filter(item=>item.id!==r.id))} type="button">✕</button></div>)}{!regions.length?<p className="session-map-tip">Нарисованных областей пока нет.</p>:null}</div>
      <div className="session-map-actions-grid"><button className="ghost" onClick={()=>updateRegions(regions.map(r=>({...r,revealed:false})))} type="button">Скрыть всё</button><button className="ghost" onClick={()=>updateRegions(regions.map(r=>({...r,revealed:true})))} type="button">Показать всё</button></div>
      <button className="primary session-map-launch" disabled={busy||!imageUrl} onClick={()=>void publish(regions,true)} type="button">{busy?"Обновляю…":displayUrl?"Открыть экран телевизора":"Запустить сцену"}</button>{displayUrl?<p className="session-map-tip">Изменения областей автоматически появляются на телевизоре.</p>:null}{notice?<p className="session-map-notice">{notice}</p>:null}
    </aside></div>
    {regionMenu?<div className="session-map-region-menu" onMouseDown={event=>event.stopPropagation()} style={{left:regionMenu.x,top:regionMenu.y}}><button onClick={deleteRegionFromMenu} type="button">Удалить область</button></div>:null}
  </section></div>,document.body);
}

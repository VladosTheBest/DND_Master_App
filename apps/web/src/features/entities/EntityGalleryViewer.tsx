import {useEffect,useRef,useState} from "react";
import {TransformComponent,TransformWrapper,type ReactZoomPanPinchRef} from "react-zoom-pan-pinch";
import {AppModal} from "../../app/AppModal";
import {ActionMenu} from "../../app/ActionMenu";
import {galleryImageTitle} from "../../app-shared";
import {MediaThumbnail} from "../entity-images/MediaThumbnail";
import type {GalleryImage} from "@shadow-edge/shared-types";
import type {GalleryViewerState} from "../../media";
type Props={onClose:()=>void;onCopyLink:(url:string)=>Promise<void>;onSelect:(index:number)=>void;onShowToPlayers?:(item:GalleryImage)=>Promise<void>|void;showToPlayersBusy?:boolean;viewer:GalleryViewerState|null};
export function EntityGalleryViewer(props:Props){
 return props.viewer?.items[props.viewer.currentIndex]?<GalleryViewerContent {...props} viewer={props.viewer}/>:null;
}
function GalleryViewerContent({onClose,onCopyLink,onSelect,onShowToPlayers,showToPlayersBusy=false,viewer}:Props&{viewer:GalleryViewerState}) {
 const item=viewer.items[viewer.currentIndex],title=galleryImageTitle(item,viewer.currentIndex);
 const camera=useRef<ReactZoomPanPinchRef>(null);
 const [notice,setNotice]=useState("");
 useEffect(()=>setNotice(""),[item.url]);
 return <AppModal label="Галерея изображений" onClose={onClose} fullscreen><div className="panel gallery-lightbox" onKeyDown={event=>{
  if((event.target as HTMLElement).closest("input,textarea,select,[contenteditable],.action-menu-popover"))return;
  if(event.key==="ArrowLeft"&&viewer.items.length>1){event.preventDefault();onSelect(viewer.currentIndex-1);}
  if(event.key==="ArrowRight"&&viewer.items.length>1){event.preventDefault();onSelect(viewer.currentIndex+1);}
 }}><header className="record-block-heading"><div className="stack compact"><strong>{title}</strong><small aria-live="polite">{viewer.ownerTitle} · {viewer.currentIndex+1} из {viewer.items.length}</small></div><div className="actions gallery-viewer-controls">
 <button className="ghost" aria-label="Предыдущее изображение" disabled={viewer.items.length<2} onClick={()=>onSelect(viewer.currentIndex-1)}>←</button>
 <button className="ghost" aria-label="Следующее изображение" disabled={viewer.items.length<2} onClick={()=>onSelect(viewer.currentIndex+1)}>→</button>
 <button className="ghost" aria-label="Отдалить изображение" onClick={()=>camera.current?.zoomOut()}>−</button><button className="ghost" aria-label="Приблизить изображение" onClick={()=>camera.current?.zoomIn()}>+</button><button className="ghost" onClick={()=>camera.current?.resetTransform()}>Вписать</button>
 <ActionMenu label="Действия" ariaLabel="Действия с изображением"><button className="ghost" onClick={()=>void onCopyLink(item.url).then(()=>setNotice("Ссылка скопирована")).catch(()=>setNotice("Не удалось скопировать ссылку. Попробуйте ещё раз."))}>Скопировать ссылку</button>
 {onShowToPlayers&&<button className="ghost" disabled={showToPlayersBusy} onClick={()=>void onShowToPlayers(item)}>{showToPlayersBusy?"Показываем…":"Показать игрокам"}</button>}
 <button className="ghost" onClick={()=>window.open(item.url,"_blank","noopener,noreferrer")}>Открыть файл</button></ActionMenu></div><button className="ghost gallery-viewer-close" onClick={onClose}>Закрыть</button></header>
 <div className="gallery-lightbox-image-shell"><TransformWrapper key={item.url} ref={camera} minScale={1} maxScale={8} centerOnInit><TransformComponent wrapperStyle={{width:"100%",height:"100%"}} contentStyle={{width:"100%",height:"100%"}}><MediaThumbnail className="gallery-lightbox-image" src={item.url} alt={item.caption||title} lazy={false}/></TransformComponent></TransformWrapper></div>
 {(item.caption?.trim()||notice)&&<footer>{item.caption?.trim()&&<p>{item.caption}</p>}{notice&&<p role="status">{notice}</p>}</footer>}
 </div></AppModal>;
}

import { useRef, useState } from "react";
import { TransformComponent, TransformWrapper, type ReactZoomPanPinchRef } from "react-zoom-pan-pinch";
import { AppModal } from "../../app/AppModal";

/** Illustrations retain their intrinsic proportions; map coordinates are untouched. */
export function RecordIllustration({url,title,alt,onReplace,onGallery}:{url?:string;title:string;alt?:string;onReplace?:()=>void;onGallery?:()=>void}) {
  const [open,setOpen]=useState(false),[failed,setFailed]=useState("");
  return <section className="record-illustration">
    {url&&failed!==url?<button type="button" className="record-banner" aria-label={`Открыть изображение «${title}»`} onClick={()=>setOpen(true)}><img src={url} alt={alt||title} onError={()=>setFailed(url)}/></button>:url?<p role="status">Не удалось загрузить изображение.</p>:null}
    <div className="actions">{onReplace&&<button className="ghost" type="button" onClick={onReplace}>{url?"Заменить изображение":"Добавить изображение"}</button>}{onGallery&&<button className="ghost" type="button" onClick={onGallery}>Галерея</button>}</div>
    {open&&url&&<ImageZoomDialog url={url} title={title} onClose={()=>setOpen(false)}/>}
  </section>;
}

export function ImageZoomDialog({url,title,onClose}:{url:string;title:string;onClose:()=>void}) {
 const camera=useRef<ReactZoomPanPinchRef>(null);
 return <AppModal label={`Изображение: ${title}`} onClose={onClose} fullscreen><div className="record-image-viewer"><header className="record-block-heading"><strong>{title}</strong><div className="actions"><button className="ghost" aria-label="Отдалить изображение" onClick={()=>camera.current?.zoomOut()}>−</button><button className="ghost" aria-label="Приблизить изображение" onClick={()=>camera.current?.zoomIn()}>+</button><button className="ghost" onClick={()=>camera.current?.resetTransform()}>Вписать</button><button className="ghost" onClick={onClose}>Закрыть</button></div></header><TransformWrapper ref={camera} minScale={1} maxScale={8} centerOnInit><TransformComponent wrapperStyle={{width:"100%",height:"100%"}} contentStyle={{width:"100%",height:"100%"}}><img src={url} alt={title} draggable={false}/></TransformComponent></TransformWrapper></div></AppModal>;
}

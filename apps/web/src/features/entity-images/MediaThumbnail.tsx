import {useState} from "react";
export function MediaThumbnail({src,alt,className="",lazy=true}:{src:string;alt:string;className?:string;lazy?:boolean}) {
 const [failed,setFailed]=useState("");
 return failed===src?<span className={`${className} media-image-fallback`} role="img" aria-label={`${alt}: изображение недоступно`}>Изображение недоступно</span>:<img src={src} alt={alt} className={className} loading={lazy?"lazy":undefined} draggable={false} onError={()=>setFailed(src)}/>;
}

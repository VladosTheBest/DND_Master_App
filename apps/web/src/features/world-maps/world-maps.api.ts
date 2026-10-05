import type { AIJob, WorldMapDocument, WorldMapLabel } from "@shadow-edge/shared-types";
import { labelGeometry, labelTextSize } from "./map-label-geometry";

export const mapMediaURL = (url: string) => `${import.meta.env.VITE_API_BASE_URL || ""}${url}`;
export const mapRoute = (campaign: string) => `/api/campaigns/${encodeURIComponent(campaign)}/world-maps`;
export async function mapRequest<T>(path: string, method = "GET", body?: unknown, signal?: AbortSignal): Promise<T> {
  const response = await fetch(mapMediaURL(path), {method, credentials:"include", signal,
    headers: body ? {"Content-Type":"application/json", ...(path.endsWith("/generate") ? {Prefer:"respond-async"} : {})} : {},
    body: body ? JSON.stringify(body) : undefined});
  const result = await response.json().catch(()=>null);
  if (!response.ok) {
    if(response.status===402)window.dispatchEvent(new Event("shadow-edge:subscription-required"));
    throw new Error(result?.error?.message || "Не удалось выполнить запрос. Проверь соединение.");
  }
  return result.data;
}
export const worldMapsAPI = {
  list: (campaign: string, signal?:AbortSignal) => mapRequest<WorldMapDocument[]>(mapRoute(campaign),"GET",undefined,signal),
  save: (campaign:string,map:WorldMapDocument) => mapRequest<WorldMapDocument>(`${mapRoute(campaign)}/${encodeURIComponent(map.id)}`,"PUT",{title:map.title,revision:map.revision,labels:map.labels}),
  generate: (campaign:string,input:{requestId:string;prompt:string;referenceUrl:string;context?:WorldMapDocument["context"];scale?:WorldMapDocument["scale"]}) => mapRequest<AIJob|WorldMapDocument>(`${mapRoute(campaign)}/generate`,"POST",input),
};

export const mapFont = (font:WorldMapLabel["font"]) => font === "serif" ? "Georgia" : font === "monospace" ? "Courier New" : "Arial";
export async function renderMapPNG(map:WorldMapDocument):Promise<Blob> {
  const image = new Image();image.crossOrigin="use-credentials";
  await new Promise<void>((resolve,reject)=>{image.onload=()=>resolve();image.onerror=()=>reject(new Error("Не удалось загрузить фон для экспорта."));image.src=mapMediaURL(map.imageUrl);});
  const canvas=document.createElement("canvas");canvas.width=map.width;canvas.height=map.height;
  const ctx=canvas.getContext("2d");if(!ctx)throw new Error("Экспорт недоступен в этом браузере.");
  ctx.drawImage(image,0,0,map.width,map.height);
  const ns="http://www.w3.org/2000/svg", overlay=document.createElementNS(ns,"svg");
  overlay.setAttribute("width",String(map.width));overlay.setAttribute("height",String(map.height));
  overlay.setAttribute("viewBox",`0 0 1000 ${1000*map.height/map.width}`);
  map.labels.forEach((label,index)=>{
    const group=document.createElementNS(ns,"g"),text=document.createElementNS(ns,"text");
    group.setAttribute("transform",`translate(${label.x*1000} ${label.y*1000*map.height/map.width}) rotate(${label.rotation})`);
    const attrs={"text-anchor":"middle","dominant-baseline":"central","font-family":mapFont(label.font),"font-size":String(labelTextSize(label)),"font-weight":label.bold?"700":"400","font-style":label.italic?"italic":"normal",fill:label.color,stroke:label.outline,"stroke-width":"3","paint-order":"stroke","stroke-linejoin":"round","letter-spacing":"0"};
    Object.entries(attrs).forEach(([key,value])=>text.setAttribute(key,value));
    if(label.curve){
      const path=document.createElementNS(ns,"path"),child=document.createElementNS(ns,"textPath");
      path.id=`label-${index}`;path.setAttribute("d",labelGeometry(label).path);path.setAttribute("fill","none");
      const defs=document.createElementNS(ns,"defs");defs.append(path);group.append(defs);
      child.setAttributeNS("http://www.w3.org/1999/xlink","xlink:href",`#${path.id}`);child.setAttribute("startOffset","50%");child.textContent=label.text;text.append(child);
    }else text.textContent=label.text;
    group.append(text);overlay.append(group);
  });
  const url=URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(overlay)],{type:"image/svg+xml;charset=utf-8"}));
  try{const labels=new Image();await new Promise<void>((resolve,reject)=>{labels.onload=()=>resolve();labels.onerror=()=>reject(new Error("Не удалось экспортировать подписи."));labels.src=url;});ctx.drawImage(labels,0,0);}finally{URL.revokeObjectURL(url);}
  return new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error("Не удалось экспортировать карту.")),"image/png"));
}

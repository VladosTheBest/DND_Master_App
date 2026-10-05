import type { AIJob, WorldMapDocument, WorldMapLabel } from "@shadow-edge/shared-types";

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
  generate: (campaign:string,input:{requestId:string;prompt:string;referenceUrl:string}) => mapRequest<AIJob|WorldMapDocument>(`${mapRoute(campaign)}/generate`,"POST",input),
};

export const mapFont = (font:WorldMapLabel["font"]) => font === "serif" ? "Georgia" : font === "monospace" ? "Courier New" : "Arial";
export async function renderMapPNG(map:WorldMapDocument):Promise<Blob> {
  const image = new Image();image.crossOrigin="use-credentials";
  await new Promise<void>((resolve,reject)=>{image.onload=()=>resolve();image.onerror=()=>reject(new Error("Не удалось загрузить фон для экспорта."));image.src=mapMediaURL(map.imageUrl);});
  const canvas=document.createElement("canvas");canvas.width=map.width;canvas.height=map.height;
  const ctx=canvas.getContext("2d");if(!ctx)throw new Error("Экспорт недоступен в этом браузере.");
  ctx.drawImage(image,0,0,map.width,map.height);
  const scale=map.width/1000;
  for(const label of map.labels){
    ctx.save();ctx.translate(label.x*map.width,label.y*map.height);ctx.rotate(label.rotation*Math.PI/180);
    ctx.font=`${label.italic?"italic ":""}${label.bold?"bold ":""}${label.size*scale}px "${mapFont(label.font)}"`;
    ctx.textAlign="center";ctx.textBaseline="middle";ctx.lineJoin="round";ctx.lineWidth=3*scale;ctx.strokeStyle=label.outline;ctx.fillStyle=label.color;
    ctx.strokeText(label.text,0,0);ctx.fillText(label.text,0,0);ctx.restore();
  }
  return new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error("Не удалось экспортировать карту.")),"image/png"));
}

const paintedIDs=['tree','pine','rock','table','chair','bed','chest','barrel','cottage','fire','lantern','bush','well','bridge','stone-wall-1','altar','tent','slate-house','thatch-house','crate','rug','stairs','fountain','cart','brazier'];
const aliases:Record<string,string>={'oak-1':'tree','oak-2':'tree','oak-3':'tree','conifer-1':'pine','conifer-2':'pine','conifer-3':'pine','conifer-4':'pine','conifer-5':'pine','rocks':'rock'};
export const paintedAssetURL=(id:string)=>paintedIDs.includes(id)||aliases[id]?`/map-assets/painted-v1/${aliases[id]||id}.webp`:undefined;
const decoded=new Map<string,HTMLImageElement>(),pending=new Map<string,Promise<void>>();
export function paintedImage(id:string){const url=paintedAssetURL(id);return url?decoded.get(url):undefined;}
export async function preparePaintedAssets(ids:string[]){
 await Promise.all([...new Set(ids.map(paintedAssetURL).filter((url):url is string=>!!url))].map(async url=>{
  if(decoded.has(url))return;let job=pending.get(url);
  if(!job){job=new Promise<void>((resolve,reject)=>{const image=new Image();image.onload=()=>{decoded.set(url,image);resolve();};image.onerror=()=>reject(new Error('Не удалось загрузить рисованный ассет. Проверь соединение и повтори сохранение.'));image.src=url;});pending.set(url,job);job.finally(()=>pending.delete(url)).catch(()=>{});}
  await job;
 }));
}

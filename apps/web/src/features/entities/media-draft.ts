import type { GalleryImage } from "@shadow-edge/shared-types";
export function readMediaDraft(value:unknown):GalleryImage[]|null {
 if(!Array.isArray(value))return null;
 if(value.some(item=>!item||typeof item!=="object"||typeof item.title!=="string"||typeof item.url!=="string"||(item.caption!==undefined&&typeof item.caption!=="string")))return null;
 return value.map(item=>({title:item.title,url:item.url,...(item.caption===undefined?{}:{caption:item.caption})}));
}

/** Explicit merge keeps every URL; local captions/titles win only for the same URL. */
export function mergeMediaDraft(server:GalleryImage[],local:GalleryImage[]) {
 const result=server.map(item=>({...item}));
 for(const item of local){const index=result.findIndex(existing=>existing.url.trim()===item.url.trim());if(index<0)result.push({...item});else result[index]={...item};}
 return result;
}

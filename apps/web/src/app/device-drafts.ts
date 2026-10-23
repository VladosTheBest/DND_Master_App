import { browserStorage } from "./browser-storage";

export type DeviceDraft<T> = { version:1|2; baseRevision:number; savedAt:string; value:T };
export type StoredDeviceDraft<T> = DeviceDraft<T> & { key:string; memoryOnly?:boolean };
const memoryDrafts=new Map<string,string>();
let memoryWarning=false;
function rememberFailedDraft(key:string,raw:string){memoryDrafts.set(key,raw);if(!memoryWarning&&typeof window!=="undefined"){memoryWarning=true;window.addEventListener?.("beforeunload",event=>{if(memoryDrafts.size){event.preventDefault();event.returnValue="";}});}}
export const deviceDraftPrefix=(owner:string,campaign:string,target:string)=>`shadow-edge.draft.v2:${JSON.stringify([owner,campaign,target])}:`;
export function readDeviceDrafts<T>(owner:string,campaign:string,target:string):StoredDeviceDraft<T>[] {
  const prefix=deviceDraftPrefix(owner,campaign,target);
  const keys=[...new Set([...(browserStorage.keys()??[]),...memoryDrafts.keys()])].filter(key=>key.startsWith(prefix));
  keys.push(`shadow-edge.draft.v1:${JSON.stringify([owner,campaign,target])}`);
  const result:StoredDeviceDraft<T>[]=[];
  for(const key of keys) {
    try {
      const raw=memoryDrafts.get(key)??browserStorage.getItem(key);if(!raw)continue;const draft=JSON.parse(raw);
      if((draft.version===1||draft.version===2)&&Number.isInteger(draft.baseRevision)&&draft.baseRevision>=-1&&typeof draft.savedAt==="string"&&Number.isFinite(Date.parse(draft.savedAt))&&draft.value)result.push({...draft,key,memoryOnly:memoryDrafts.has(key)});
    } catch {/* Preserve malformed source bytes and leave server editing usable. */}
  }
  return result.sort((a,b)=>Date.parse(b.savedAt)-Date.parse(a.savedAt)||a.key.localeCompare(b.key));
}
// Distinct writer/revision keys avoid a localStorage read/modify/write race.
export const deviceDraftKey=(owner:string,campaign:string,target:string,writer:string,revision:number)=>`${deviceDraftPrefix(owner,campaign,target)}${revision}:${writer}`;
export function writeDeviceDraft<T>(owner:string,campaign:string,target:string,writer:string,draft:DeviceDraft<T>):string|null {
  const key=deviceDraftKey(owner,campaign,target,writer,draft.baseRevision),raw=JSON.stringify({...draft,version:2});
  if(browserStorage.setItem(key,raw)){memoryDrafts.delete(key);return key;}
  rememberFailedDraft(key,raw);return null;
}
export function removeDeviceDrafts(keys:Iterable<string>):boolean {
  let ok=true;for(const key of keys){memoryDrafts.delete(key);if(!browserStorage.removeItem(key))ok=false;}return ok;
}

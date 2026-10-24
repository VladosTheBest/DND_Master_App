import {useState} from "react";
import type {GalleryImage,KnowledgeEntity} from "@shadow-edge/shared-types";
import {useDeviceDraft} from "../../app/hooks/useDeviceDraft";
import {useWorkspaceGuard} from "../../app/workspace-route";
import {confirmAction} from "../../app/confirm-action";
import {mergeMediaDraft,readMediaDraft} from "./media-draft";

export function useEntityMediaDraft({ownerId,campaignId,field,target,setTarget,items,setItems,open,busy,onClose}:{
 ownerId:string;campaignId:string;field:"gallery"|"playlist";target:KnowledgeEntity|null;setTarget:(entity:KnowledgeEntity)=>void;
 items:GalleryImage[];setItems:(items:GalleryImage[])=>void;open:boolean;busy:boolean;onClose:()=>void;
}) {
 const [revision,setRevision]=useState(0),[baseline,setBaseline]=useState("[]"),[error,setError]=useState("");
 const [conflict,setConflict]=useState<KnowledgeEntity|null>(null);
 const dirty=open&&JSON.stringify(items)!==baseline;
 const draft=useDeviceDraft({ownerId,campaignId,target:`entity-${field}:${target?.id||""}`,revision,value:items,dirty,enabled:open,restore:copy=>{
  const next=readMediaDraft(copy.value);
  if(!next||!Number.isSafeInteger(copy.baseRevision)||copy.baseRevision<0){setError("Локальная копия повреждена. Скачайте её для проверки.");return false;}
  setItems(next);setRevision(copy.baseRevision);setError("");setConflict(null);return true;
 }});
 useWorkspaceGuard(open&&(dirty||busy));
 function begin(entity:KnowledgeEntity,next:GalleryImage[]){setRevision(entity.revision??0);setBaseline(JSON.stringify(next));setError("");setConflict(null);}
 async function requestClose(pendingSelection=false){if(busy)return;if((dirty||pendingSelection)&&!await confirmAction(pendingSelection?"Выбранные изображения ещё не добавлены в галерею. Закрыть выбор? Добавленные изображения и подписи останутся в локальном черновике.":"Закрыть без сохранения на сервере? Проверьте статус локального черновика; при ошибке хранения скачайте копию."))return;draft.flush();onClose();}
 function review(mode:"local"|"server"|"merge"){
  if(!conflict)return;draft.flush();const next=readMediaDraft(conflict[field]??[])??[];
  setTarget(conflict);setRevision(conflict.revision??0);setBaseline(JSON.stringify(next));if(mode==="server")setItems(next);else if(mode==="merge")setItems(mergeMediaDraft(next,items));setConflict(null);setError("");
 }
 return {draft,revision,dirty,busy,error,setError,conflict,setConflict,begin,requestClose,review,
  canSave:!busy&&!draft.candidate&&!conflict&&dirty};
}
export type EntityMediaDraft=ReturnType<typeof useEntityMediaDraft>;

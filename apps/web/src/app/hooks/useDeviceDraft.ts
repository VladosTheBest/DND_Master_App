import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { readDeviceDrafts, writeDeviceDraft, deviceDraftKey, removeDeviceDrafts, type DeviceDraft, type StoredDeviceDraft } from "../device-drafts";
export type { DeviceDraft } from "../device-drafts";

export function useDeviceDraft<T>({ownerId,campaignId,target,revision,value,dirty,enabled,restore}:
  {ownerId:string;campaignId:string;target:string;revision:number;value:T;dirty:boolean;enabled:boolean;restore:(draft:DeviceDraft<T>)=>void|boolean}) {
  const writer=useRef(crypto.randomUUID());
  const [candidates,setCandidates]=useState<StoredDeviceDraft<T>[]>([]);
  const [candidateKey,setCandidateKey]=useState("");
  const candidate=candidates.find(item=>item.key===candidateKey)??candidates[0]??null;
  const [status,setStatus]=useState("");
  const scope=JSON.stringify([ownerId,campaignId,target]);
  const bound=useRef("");const waiting=useRef(false);
  const written=useRef(new Set<string>()),recovered=useRef<string|null>(null);
  const pending=useRef<null|((report?:boolean)=>void)>(null),timer=useRef<ReturnType<typeof setTimeout>|null>(null);
  const serializedValue=JSON.stringify(value);
  useLayoutEffect(()=>{
    if(!enabled){bound.current="";return;}
    bound.current=scope;written.current=new Set();recovered.current=null;
    const found=ownerId&&campaignId?readDeviceDrafts<T>(ownerId,campaignId,target):[];
    waiting.current=Boolean(found.length);setCandidates(found);setCandidateKey(found[0]?.key??"");
    setStatus(!ownerId?"Черновик на устройстве пока недоступен: проверяем доступ.":found.length?"Найдены черновики на этом устройстве.":"");
    return()=>{if(timer.current)clearTimeout(timer.current);pending.current?.(false);pending.current=null;bound.current="";};
  },[scope,enabled]);
  useLayoutEffect(()=>{
    if(timer.current)clearTimeout(timer.current);pending.current=null;
    if(!enabled||!dirty||!ownerId||!campaignId||bound.current!==scope)return;
    const save=(report=true)=>{
      const key=writeDeviceDraft(ownerId,campaignId,target,writer.current,{version:2,baseRevision:revision,savedAt:new Date().toISOString(),value});
      written.current.add(deviceDraftKey(ownerId,campaignId,target,writer.current,revision));
      if(report)setStatus(key?"Черновик на устройстве · на сервер ещё не сохранён":"Ошибка: черновик только в памяти этой вкладки. Скачайте копию перед уходом.");
      pending.current=null;
    };
    pending.current=save;setStatus("Сохраняю черновик на устройстве…");timer.current=setTimeout(save,450);
    return()=>{if(timer.current)clearTimeout(timer.current);};
  },[scope,revision,serializedValue,dirty,enabled]);
  useEffect(()=>{
    if(!enabled||!dirty)return;const warn=(event:BeforeUnloadEvent)=>{event.preventDefault();event.returnValue="";};window.addEventListener("beforeunload",warn);return()=>window.removeEventListener("beforeunload",warn);
  },[enabled,dirty]);
  const clear=()=>{
    if(timer.current)clearTimeout(timer.current);pending.current=null;
    // A recovered key may still be written by another open tab. Never delete it
    // automatically: its contents can have changed since we selected the copy.
    const keys=new Set(written.current);
    const removed=removeDeviceDrafts(keys);written.current.clear();recovered.current=null;waiting.current=false;setCandidates([]);setCandidateKey("");
    setStatus(removed?"Сохранено на сервере":"Сохранено на сервере. Локальную копию удалить не удалось.");
  };
  const download=()=>{
    const snapshot=candidate??{version:2,baseRevision:revision,savedAt:new Date().toISOString(),value};
    const {key:_,...safe}=snapshot as StoredDeviceDraft<T>;
    const url=URL.createObjectURL(new Blob([JSON.stringify(safe,null,2)],{type:"application/json"}));const anchor=document.createElement("a");anchor.href=url;anchor.download="shadow-edge-draft.json";anchor.click();window.setTimeout(()=>URL.revokeObjectURL(url),1000);
  };
  const recover=()=>{
    if(!candidate)return;
    try {
      if(restore(candidate)===false)return;
      // Preserve text entered before choosing a recovered copy as its own branch.
      if(timer.current)clearTimeout(timer.current);
      pending.current?.(false);pending.current=null;
      writer.current=crypto.randomUUID();written.current=new Set();
      recovered.current=candidate.key;waiting.current=false;setCandidates([]);setCandidateKey("");
    }
    catch(reason){setStatus(reason instanceof Error?reason.message:"Не удалось восстановить черновик. Скачайте копию.");}
  };
  // Keep another tab's saved copy intact, but allow an explicit choice to
  // continue the current form without restoring or deleting that copy.
  const keepCurrent=()=>{waiting.current=false;setCandidates([]);setCandidateKey("");setStatus("Продолжаем текущие правки. Другие копии остаются на устройстве.");};
  const discard=()=>{
    if(!candidate)return;if(!removeDeviceDrafts([candidate.key])){setStatus("Не удалось удалить копию с устройства.");return;}
    const remaining=candidates.filter(item=>item.key!==candidate.key);setCandidates(remaining);setCandidateKey(remaining[0]?.key??"");waiting.current=Boolean(remaining.length);setStatus(remaining.length?"Остались другие черновики.":"");
  };
  const flush=()=>{if(timer.current)clearTimeout(timer.current);pending.current?.();pending.current=null;};
  return {candidate,candidates,selectCandidate:setCandidateKey,status,clear,download,recover,discard,flush,keepCurrent};
}

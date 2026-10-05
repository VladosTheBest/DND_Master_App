import { useEffect, useRef, useState } from "react";
import { ExternalLink, ImagePlus, LoaderCircle, Sparkles, X } from "lucide-react";
import type { AIJob, WorldMapDocument } from "@shadow-edge/shared-types";
import { api } from "../../app/api";
import { mapMediaURL, mapRequest, worldMapsAPI } from "./world-maps.api";
import "./world-maps.css";

export function MapCreateForm({campaignId, initialPrompt="", onCreated, storageKey="composer"}:{campaignId:string;initialPrompt?:string;onCreated?:(map:WorldMapDocument)=>void;storageKey?:string}){
  const key=`shadow-edge:map-job:${campaignId}:${storageKey}`;
  const [prompt,setPrompt]=useState(initialPrompt),[reference,setReference]=useState("");
  const [jobId,setJobId]=useState(()=>sessionStorage.getItem(key)||"");
  const [busy,setBusy]=useState(false),[stage,setStage]=useState(""),[error,setError]=useState("");
  const [created,setCreated]=useState<WorldMapDocument|null>(null);
  const [retry,setRetry]=useState(0);
  const lock=useRef(false),input=useRef<HTMLInputElement>(null),callback=useRef(onCreated);
  callback.current=onCreated;
  const request=useRef<{signature:string;id:string}|null>(null);
  useEffect(()=>{const id=sessionStorage.getItem(`${key}:result`);if(!id)return;const abort=new AbortController();void worldMapsAPI.list(campaignId,abort.signal).then(maps=>setCreated(maps.find(m=>m.id===id)||null)).catch(()=>{});return()=>abort.abort();},[campaignId,key]);
  useEffect(()=>{setPrompt(initialPrompt);},[initialPrompt]);
  useEffect(()=>{
    if(!jobId)return;
    const abort=new AbortController();let timer:ReturnType<typeof setTimeout>;
    async function poll(){
      try{
        const job=await mapRequest<AIJob>(`/api/ai/jobs/${encodeURIComponent(jobId)}`,"GET",undefined,abort.signal);
        if(abort.signal.aborted)return;
        setStage(job.stage||"Создаю карту…");
        if(job.state==="succeeded"){
          const result=job.result as {data?:WorldMapDocument};if(!result?.data?.imageUrl)throw new Error("Карта не найдена в результате задачи. Обнови список карт.");
          setCreated(result.data);sessionStorage.setItem(`${key}:result`,result.data.id);callback.current?.(result.data);sessionStorage.removeItem(key);setJobId("");setStage("");request.current=null;
        }else if(job.state==="failed"){
          const result=job.result as {error?:{message?:string;code?:string}};
          if(result?.error?.code==="subscription_required")window.dispatchEvent(new Event("shadow-edge:subscription-required"));
          setError(result?.error?.message||job.stage||"Не удалось создать карту.");sessionStorage.removeItem(key);setJobId("");setStage("");
        }else timer=setTimeout(poll,1800);
      }catch(e){if(!abort.signal.aborted){setError((e as Error).message);setStage("");}}
    }
    void poll();return()=>{abort.abort();clearTimeout(timer);};
  },[jobId,key,retry]);
  async function upload(file:File){
    if(lock.current)return;lock.current=true;setBusy(true);setError("");
    try{if(file.size>20*1024*1024||!/^image\/(png|jpeg|webp)$/.test(file.type))throw new Error("Выбери PNG, JPEG или WebP до 20 МБ.");const result=await api.uploadImage(campaignId,file);setReference(new URL(result.url,location.origin).pathname);}catch(e){setError((e as Error).message);}finally{lock.current=false;setBusy(false);if(input.current)input.current.value="";}
  }
  async function generate(){
    if(lock.current||jobId)return;lock.current=true;setBusy(true);setError("");setCreated(null);setStage("Запускаю генерацию…");
    try{
      const signature=JSON.stringify([prompt.trim(),reference]);if(request.current?.signature!==signature)request.current={signature,id:crypto.randomUUID()};
      const result=await worldMapsAPI.generate(campaignId,{requestId:request.current.id,prompt:prompt.trim(),referenceUrl:reference});
      if("imageUrl" in result){setCreated(result);sessionStorage.setItem(`${key}:result`,result.id);callback.current?.(result);setStage("");request.current=null;}
      else{sessionStorage.setItem(key,result.id);setJobId(result.id);}
    }catch(e){setError((e as Error).message);setStage("");}finally{lock.current=false;setBusy(false);}
  }
  const disabled=busy||Boolean(jobId);
  return <section className="world-map-create" aria-label="Создание карты мира">
    <label>Описание карты<textarea aria-label="Описание карты" rows={4} maxLength={6000} value={prompt} disabled={disabled} onChange={e=>setPrompt(e.target.value)}/></label>
    <div className="world-map-create-actions">
      <input ref={input} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={e=>{if(e.target.files?.[0])void upload(e.target.files[0]);}}/>
      <button type="button" disabled={disabled} onClick={()=>input.current?.click()}><ImagePlus size={17}/>{reference?"Заменить референс":"Референс"}</button>
      <button type="button" className="map-primary" disabled={disabled||prompt.length>6000||(!prompt.trim()&&!reference)} onClick={()=>void generate()}><Sparkles size={17}/>Создать карту</button>
    </div>
    {prompt.length>6000&&<p role="alert">Описание слишком длинное: {prompt.length} из 6000 символов.</p>}
    {reference&&<div className="world-map-reference"><img src={mapMediaURL(reference)} alt="Референс карты"/><button type="button" title="Убрать референс" aria-label="Убрать референс" disabled={disabled} onClick={()=>setReference("")}><X size={16}/></button></div>}
    {stage&&<p role="status" className="map-progress"><LoaderCircle size={17}/>{stage}</p>}
    {error&&<p role="alert">{error}{jobId&&<button type="button" onClick={()=>{setError("");setRetry(v=>v+1);}}>Проверить задачу</button>}</p>}
    {created&&<a className="world-map-result" href={`/maps?campaign=${encodeURIComponent(campaignId)}&map=${encodeURIComponent(created.id)}`}><img src={mapMediaURL(created.imageUrl)} alt={created.title}/><span>{created.title}<small>Открыть карту</small></span><ExternalLink size={18}/></a>}
  </section>;
}

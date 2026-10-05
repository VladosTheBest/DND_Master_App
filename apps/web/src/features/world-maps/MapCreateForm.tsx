import { useEffect, useRef, useState } from "react";
import { ExternalLink, ImagePlus, LoaderCircle, Sparkles, X } from "lucide-react";
import type { AIJob, WorldMapDocument } from "@shadow-edge/shared-types";
import { api } from "../../app/api";
import { finishGeneratedMap, mapMediaURL, mapRequest, worldMapsAPI } from "./world-maps.api";
import "./world-maps.css";
import { notifyAICompletion, prepareAISound } from "../ai-jobs/ai-completion-sound";

export function MapCreateForm({campaignId, initialPrompt="", onCreated, storageKey="composer", sourceMap}:{campaignId:string;initialPrompt?:string;onCreated?:(map:WorldMapDocument)=>void;storageKey?:string;sourceMap?:WorldMapDocument}){
  const key=`shadow-edge:map-job:${campaignId}:${storageKey}`;
  const [prompt,setPrompt]=useState(initialPrompt),[reference,setReference]=useState("");
  const [scale,setScale]=useState<NonNullable<WorldMapDocument["scale"]>>("auto");
	const [includeCampaign,setIncludeCampaign]=useState(true),[useLocation,setUseLocation]=useState(false),[locationId,setLocationId]=useState("");
	const [locations,setLocations]=useState<{id:string;title:string}[]>([]),[locationsError,setLocationsError]=useState("");
	useEffect(()=>{let alive=true;setLocations([]);setLocationId("");setUseLocation(false);setLocationsError("");void api.getCampaign(campaignId).then(c=>{if(alive)setLocations(c.locations);}).catch(()=>{if(alive)setLocationsError("Не удалось загрузить локации. Открой форму заново, чтобы повторить.");});return()=>{alive=false;};},[campaignId]);
  const [jobId,setJobId]=useState(()=>sessionStorage.getItem(key)||"");
  const [busy,setBusy]=useState(false),[stage,setStage]=useState(""),[error,setError]=useState("");
  const [created,setCreated]=useState<WorldMapDocument|null>(null);
  const [retry,setRetry]=useState(0);
  const lock=useRef(false),input=useRef<HTMLInputElement>(null),callback=useRef(onCreated);
  callback.current=onCreated;
  const request=useRef<{signature:string;id:string}|null>(null);
  useEffect(()=>prepareAISound(),[]);
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
          notifyAICompletion(job.id);
          const result=job.result as {data?:WorldMapDocument};if(!result?.data?.imageUrl)throw new Error("Карта не найдена в результате задачи. Обнови список карт.");
          const finished=await finishGeneratedMap(campaignId,result.data);if(abort.signal.aborted)return;
          setCreated(finished);sessionStorage.setItem(`${key}:result`,finished.id);callback.current?.(finished);sessionStorage.removeItem(key);setJobId("");setStage("");request.current=null;
        }else if(job.state==="failed"){
          notifyAICompletion(job.id,true);
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
		const context={includeCampaign,locationId:useLocation?locationId:""};
      const signature=JSON.stringify([prompt.trim(),reference,context,scale,sourceMap?.id,sourceMap?.revision]);if(request.current?.signature!==signature)request.current={signature,id:crypto.randomUUID()};
      const result=await worldMapsAPI.generate(campaignId,{requestId:request.current.id,prompt:prompt.trim(),referenceUrl:reference,context,scale,...(sourceMap?{sourceMapId:sourceMap.id,sourceRevision:sourceMap.revision}:{})});
      if("imageUrl" in result){const finished=await finishGeneratedMap(campaignId,result);notifyAICompletion(finished.id);setCreated(finished);sessionStorage.setItem(`${key}:result`,finished.id);callback.current?.(finished);setStage("");request.current=null;}
      else{sessionStorage.setItem(key,result.id);setJobId(result.id);}
    }catch(e){setError((e as Error).message);setStage("");}finally{lock.current=false;setBusy(false);}
  }
  const disabled=busy||Boolean(jobId);
  return <section className="world-map-create" aria-label="Создание карты мира" tabIndex={0} onPaste={event=>{
    if(event.defaultPrevented||disabled||sourceMap)return;
    const file=Array.from(event.clipboardData.items).find(item=>item.kind==="file"&&item.type.startsWith("image/"))?.getAsFile()
      ||Array.from(event.clipboardData.files).find(item=>item.type.startsWith("image/"));
    if(!file)return;
    event.preventDefault();void upload(file);
  }}>
    {!sourceMap&&<label>Уровень детализации<select aria-label="Уровень детализации" value={scale} disabled={disabled} onChange={e=>setScale(e.target.value as typeof scale)}><option value="auto">По описанию</option><option value="world">Мир · страны и крупная география</option><option value="region">Регион · поселения и дороги</option><option value="island">Остров · места и побережья</option><option value="city">Город · районы и достопримечательности</option><option value="site">Место · помещения и проходы</option></select></label>}
    <label>{sourceMap?"Что изменить на карте":"Описание карты"}<textarea aria-label={sourceMap?"Что изменить на карте":"Описание карты"} rows={4} maxLength={6000} value={prompt} disabled={disabled} onChange={e=>setPrompt(e.target.value)}/></label>
		{!sourceMap&&<fieldset className="world-map-context" disabled={disabled}><legend>Контекст карты</legend>
			<label><input type="checkbox" checked={includeCampaign} onChange={e=>setIncludeCampaign(e.target.checked)}/>Учитывать контекст кампании</label>
			<label><input type="checkbox" checked={useLocation} onChange={e=>setUseLocation(e.target.checked)}/>Карта конкретной локации</label>
			{useLocation&&<label>Локация<select aria-label="Локация карты" value={locationId} onChange={e=>setLocationId(e.target.value)}><option value="">Выбери локацию</option>{locations.map(l=><option key={l.id} value={l.id}>{l.title}</option>)}</select></label>}
			{useLocation&&locationsError&&<p role="alert">{locationsError}</p>}
			{useLocation&&!locationsError&&!locations.length&&<p>Нет доступных локаций</p>}
		</fieldset>}
    <div className="world-map-create-actions">
      <input ref={input} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={e=>{if(e.target.files?.[0])void upload(e.target.files[0]);}}/>
      {!sourceMap&&<button type="button" disabled={disabled} onClick={()=>input.current?.click()}><ImagePlus size={17}/>{reference?"Заменить референс":"Референс"}</button>}
      <button type="button" className="map-primary" disabled={disabled||(!!sourceMap&&!prompt.trim())||prompt.length>6000||(useLocation&&!locationId)||(!prompt.trim()&&!reference&&!includeCampaign&&!useLocation)} onClick={()=>void generate()}><Sparkles size={17}/>{sourceMap?"Создать новый вариант":"Создать карту"}</button>
    </div>
    {prompt.length>6000&&<p role="alert">Описание слишком длинное: {prompt.length} из 6000 символов.</p>}
    {reference&&<div className="world-map-reference"><img src={mapMediaURL(reference)} alt="Референс карты"/><button type="button" title="Убрать референс" aria-label="Убрать референс" disabled={disabled} onClick={()=>setReference("")}><X size={16}/></button></div>}
    {stage&&<p role="status" className="map-progress"><LoaderCircle size={17}/>{stage}</p>}
    {error&&<p role="alert">{error}{jobId&&<button type="button" onClick={()=>{setError("");setRetry(v=>v+1);}}>Проверить задачу</button>}</p>}
    {created&&<a className="world-map-result" href={`/maps?campaign=${encodeURIComponent(campaignId)}&map=${encodeURIComponent(created.id)}`}><img src={mapMediaURL(created.imageUrl)} alt={created.title}/><span>{created.title}<small>Открыть карту</small></span><ExternalLink size={18}/></a>}
  </section>;
}

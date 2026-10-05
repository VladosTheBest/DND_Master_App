import { useEffect, useState } from "react";
import { ArrowLeft, Compass } from "lucide-react";
import { api } from "../../app/api";
import { AIJobsPanel } from "./AIJobsPanel";
import type { ChatContext } from "./AIChat";
import "./ai-jobs.css";

function initialContext():ChatContext|undefined {
  try {const value=JSON.parse(new URLSearchParams(location.search).get("context")||"null");if(value&&typeof value.includeCampaign==="boolean"&&Array.isArray(value.sessionIds)&&value.sessionIds.every((id:unknown)=>typeof id==="string"))return value;} catch { /* Invalid links fall back to campaign context. */ }
}
export function AIChatPage(){
  const [campaigns,setCampaigns]=useState<{id:string;title:string}[]>([]);
  const [selected,setSelected]=useState(new URLSearchParams(location.search).get("campaign")||"");
  const [error,setError]=useState("");const [loading,setLoading]=useState(true);
  const [context,setContext]=useState(initialContext);
  useEffect(()=>{let active=true;void api.listCampaigns().then(items=>{if(!active)return;setCampaigns(items);setSelected(current=>items.some(item=>item.id===current)?current:items[0]?.id||"");}).catch(()=>{if(active)setError("Не удалось загрузить кампании. Войди в аккаунт в кабинете мастера.");}).finally(()=>{if(active)setLoading(false);});return()=>{active=false;};},[]);
  return <main className="ai-chat-page"><aside className="ai-chat-page-sidebar"><a href="/"><ArrowLeft size={17}/>Кабинет мастера</a><div className="ai-chat-page-brand"><Compass size={29}/><h1>AI-чат</h1></div><label>Кампания<select value={selected} onChange={event=>{setSelected(event.target.value);setContext(undefined);history.replaceState(null,"",`/chat?campaign=${encodeURIComponent(event.target.value)}`);}}>{campaigns.map(campaign=><option key={campaign.id} value={campaign.id}>{campaign.title}</option>)}</select></label><div className="ai-chat-page-current"><small>Текущая кампания</small><strong>{campaigns.find(campaign=>campaign.id===selected)?.title || "Не выбрана"}</strong></div></aside><section className="ai-chat-page-main">{loading?<p role="status">Загружаю кампании…</p>:error?<p role="alert">{error}</p>:!selected?<p>Сначала создай кампанию в кабинете мастера.</p>:<AIJobsPanel key={selected} campaignId={selected} pageMode initialContext={context} onOpenSession={()=>{location.href="/";}} onOpenProposal={()=>{location.href="/";}}/>}</section></main>;
}

import { useEffect, useRef, useState } from "react";
import { Send, RefreshCw, MessageSquare, Sparkles, UserRound, MapPin, BookOpen } from "lucide-react";
import type { AIJob } from "@shadow-edge/shared-types";
import { FormattedText } from "../formatting/FormattedText";
import { isActiveJob } from "./useAIJobs";
import "./ai-chat.css";

type Source = { id: string; targetId: string; title: string; kind: string; text: string; firstLine: number; lastLine: number; entity?: {title: string; summary: string; imageUrl?: string} };
type Turn = { id: string; question: string; answer: string; suggestions: string[]; sources: Source[]; createdAt: string };
type ChatData = { turns: Turn[]; sessions: {id: string; title: string}[] };
type Pending = {id: string; question: string; createdAt: string; jobId?: string; error?: string};
const kindLabels: Record<string,string> = {locations:"Локация",npcs:"НПС",players:"Персонаж",monsters:"Существо",quests:"Квест",lore:"Заметка",events:"Событие",shops:"Магазин"};

async function chatRequest<T>(path: string, body?: unknown, signal?: AbortSignal): Promise<T> {
  const response = await fetch(`${import.meta.env.VITE_API_BASE_URL || ""}${path}`, {
    credentials: "include", signal, method: body ? "POST" : "GET",
    headers: body ? {"Content-Type":"application/json", Prefer:"respond-async"} : {}, body: body ? JSON.stringify(body) : undefined,
  });
  const result = await response.json();
  if (!response.ok) {
    if (response.status === 402) window.dispatchEvent(new Event("shadow-edge:subscription-required"));
    throw new Error(result.error?.message || "Не удалось открыть чат.");
  }
  return result.data;
}

function Question({text, time}: {text:string; time:string}) {
  return <div className="ai-chat-message ai-chat-user"><span className="ai-chat-avatar"><UserRound size={18}/></span><div className="ai-chat-question"><small><strong>Вы</strong><time>{new Date(time).toLocaleTimeString("ru-RU",{hour:"2-digit",minute:"2-digit"})}</time></small><p>{text}</p></div></div>;
}

function EntityPreview({source}: {source: Source}) {
  const [broken,setBroken] = useState(false);
  const entity = source.entity!;
  useEffect(()=>setBroken(false),[entity.imageUrl]);
  const url = entity.imageUrl?.startsWith("/uploads/") && !entity.imageUrl.includes("\\") ? `${import.meta.env.VITE_API_BASE_URL || ""}${entity.imageUrl}` : "";
  return <article className="ai-chat-entity">
    {url && !broken ? <img src={url} alt={entity.title} loading="lazy" onError={()=>setBroken(true)}/> : <span className="ai-chat-entity-icon">{source.kind==="locations" ? <MapPin size={26}/> : <BookOpen size={26}/>}</span>}
    <div><small>{kindLabels[source.kind] || "Материал кампании"}</small><strong>{entity.title}</strong>{entity.summary && <p>{entity.summary}</p>}</div>
  </article>;
}

export function AIChat({campaignId, jobs, refreshJobs}: {campaignId: string; jobs: AIJob[]; refreshJobs: () => void}) {
  const [scope,setScope] = useState("");
  const [data,setData] = useState<ChatData|null>(null);
  const [question,setQuestion] = useState("");
  const [error,setError] = useState("");
  const [loading,setLoading] = useState(true);
  const [reload,setReload] = useState(0);
  const [pending,setPending] = useState<Pending|null>(null);
  const lock = useRef(false);
  const end = useRef<HTMLDivElement>(null);
  const composer = useRef<HTMLTextAreaElement>(null);
  const chatJobs = jobs.filter(job=>job.kind==="chat" && job.campaignId===campaignId);
  const currentJob = chatJobs.find(job=>job.id===pending?.jobId);
  const pendingError = pending?.error || (currentJob?.state==="failed" ? "Не удалось получить ответ. Можно повторить запрос." : "");
  const visiblePending = pending && !data?.turns.some(turn=>turn.id===pending.id);
  const busy = chatJobs.some(isActiveJob) || Boolean(visiblePending && !pendingError);
  const fingerprint = chatJobs.map(job=>`${job.id}:${job.state}`).join("|");

  useEffect(()=>{
    const controller = new AbortController();
    setLoading(true); setError("");
    void chatRequest<ChatData>(`/api/campaigns/${encodeURIComponent(campaignId)}/ai/chat?sessionId=${encodeURIComponent(scope)}`,undefined,controller.signal)
      .then(value=>{
        if (controller.signal.aborted) return;
        setData(value);
        setPending(previous=>previous && value.turns.some(turn=>turn.id===previous.id) ? null : previous);
      })
      .catch(e=>{if (!controller.signal.aborted) setError(e.message);})
      .finally(()=>{if (!controller.signal.aborted) setLoading(false);});
    return ()=>controller.abort();
  },[campaignId,scope,fingerprint,reload]);
  useEffect(()=>{end.current?.scrollIntoView({block:"nearest"});},[data?.turns.length,scope,pending?.id,busy]);

  async function send(retry?: Pending) {
    if (lock.current || busy || (!retry && question.trim().length<2)) return;
    const next: Pending = retry ? {...retry,error:undefined,jobId:undefined} : {id:crypto.randomUUID(),question:question.trim(),createdAt:new Date().toISOString()};
    lock.current = true;
    setPending(next); setQuestion(""); setError("");
    try {
      const job = await chatRequest<AIJob>(`/api/campaigns/${encodeURIComponent(campaignId)}/ai/chat`,{id:next.id,question:next.question,sessionId:scope});
      setPending(previous=>previous?.id===next.id ? {...previous,jobId:job.id} : previous);
      refreshJobs();
    } catch(e) { setPending(previous=>previous?.id===next.id ? {...previous,error:(e as Error).message} : previous); }
    finally { lock.current = false; }
  }
  function choosePrompt(text: string) { setQuestion(text); composer.current?.focus(); }

  return <section className="ai-chat" aria-label="Чат по кампании">
    <div className="ai-chat-scope"><BookOpen size={18}/><label>Контекст<select aria-label="Контекст чата" value={scope} disabled={busy} onChange={e=>{setScope(e.target.value);setData(null);setQuestion("");setPending(null);}}><option value="">Кампания и все сессии</option>{data?.sessions.map(session=><option key={session.id} value={session.id}>{session.title}</option>)}</select></label><button type="button" title="Обновить диалог" aria-label="Обновить диалог" onClick={()=>{setReload(v=>v+1);refreshJobs();}} disabled={loading}><RefreshCw size={17}/></button></div>
    <div className="ai-chat-messages" aria-label="История диалога">
      {loading && !data && <p role="status">Загружаю диалог…</p>}
      {data && !data.turns.length && !visiblePending && <div className="ai-chat-empty"><Sparkles size={28}/><h3>Обсудим вашу кампанию</h3><div>{["Какие сюжетные линии остались открыты?","Что стоит подготовить к следующей игре?","Где в истории есть противоречия?"].map(prompt=><button type="button" key={prompt} disabled={busy} onClick={()=>choosePrompt(prompt)}><MessageSquare size={16}/>{prompt}</button>)}</div></div>}
      {data?.turns.map(turn=>{
        const entities = turn.sources?.filter((source,i,all)=>source.entity && all.findIndex(other=>other.kind===source.kind && other.targetId===source.targetId)===i).slice(0,4) || [];
        return <article className="ai-chat-turn" key={turn.id}>
          <Question text={turn.question} time={turn.createdAt}/>
          <div className="ai-chat-message"><span className="ai-chat-avatar assistant"><Sparkles size={19}/></span><div className="ai-chat-answer"><small><strong>Помощник мастера</strong><time>{new Date(turn.createdAt).toLocaleString("ru-RU")}</time></small><FormattedText content={turn.answer}/>
            {entities.length>0 && <div className="ai-chat-entities">{entities.map(source=><EntityPreview key={`${source.kind}:${source.targetId}`} source={source}/>)}</div>}
            {turn.suggestions?.length>0 && <section className="ai-chat-suggestions"><strong>Что можно доработать</strong><ul>{turn.suggestions.map((text,i)=><li key={i}><FormattedText content={text}/></li>)}</ul></section>}
            {turn.sources?.length>0 && <details className="ai-chat-sources"><summary>Источники · {turn.sources.length}</summary>{turn.sources.map(source=><details key={source.id}><summary>{source.title}{source.kind==="transcript" ? ` · строки ${source.firstLine}–${source.lastLine}` : ""}</summary><small>{source.id}</small><pre>{source.text}</pre></details>)}</details>}
          </div></div>
        </article>;
      })}
      {visiblePending && <Question text={pending.question} time={pending.createdAt}/>}
      {busy && <div className="ai-chat-message ai-chat-waiting" role="status"><span className="ai-chat-avatar assistant"><Sparkles size={19}/></span><div><strong>Помощник мастера</strong><p>Изучаю материалы<span className="ai-chat-dots" aria-hidden="true"><i/><i/><i/></span></p></div></div>}
      {visiblePending && pendingError && <div className="ai-chat-send-error" role="alert"><p>{pendingError}</p><button type="button" disabled={busy} onClick={()=>void send(pending)}><RefreshCw size={15}/>Повторить</button><button type="button" disabled={busy} onClick={()=>{setQuestion(pending.question);setPending(null);composer.current?.focus();}}>Редактировать</button></div>}
      <div ref={end}/>
    </div>
    {error && <p role="alert" className="ai-job-error">{error}</p>}
    <form className="ai-chat-compose" onSubmit={e=>{e.preventDefault();void send();}}><textarea ref={composer} aria-label="Вопрос AI" placeholder="Спросить о кампании или сессии…" rows={2} maxLength={4000} required minLength={2} disabled={busy} value={question} onChange={e=>setQuestion(e.target.value)}/><button type="submit" title="Отправить вопрос" aria-label="Отправить вопрос" disabled={busy||loading||question.trim().length<2}><Send size={20}/></button></form><small className="ai-chat-disclaimer">Ответы AI могут ошибаться. Предложения не меняют кампанию.</small>
  </section>;
}

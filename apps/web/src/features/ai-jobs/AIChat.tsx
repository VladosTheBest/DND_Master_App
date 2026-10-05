import { useEffect, useRef, useState } from "react";
import { Send, RefreshCw, MessageSquare, Sparkles, UserRound, MapPin, BookOpen, Plus, Check, ScrollText, Store, CalendarDays, ShieldCheck, Compass, Pencil, Save } from "lucide-react";
import type { AIJob } from "@shadow-edge/shared-types";
import { FormattedText } from "../formatting/FormattedText";
import { isActiveJob } from "./useAIJobs";
import "./ai-chat.css";
import { MapCreateForm } from "../world-maps/MapCreateForm";

type Source = { id: string; targetId: string; title: string; kind: string; text: string; firstLine: number; lastLine: number; entity?: {title: string; summary: string; imageUrl?: string} };
type Draft = {id:string;kind:string;title:string;subtitle:string;summary:string;content:string;createdId?:string;revision?:number};
type Turn = { id: string; question: string; answer: string; suggestions: string[]; sources: Source[]; createdAt: string; drafts?:Draft[] };
export type ChatContext = {includeCampaign:boolean;sessionIds:string[]};
type ChatData = { turns: Turn[]; sessions: {id: string; title: string}[] };
type DraftRef = {turnId:string;draftId:string;revision:number};
type Pending = {draftRef?:DraftRef;id: string; question: string; createdAt: string; jobId?: string; error?: string};
function readable(text: string, sources: Source[]) {
  for (const source of sources) { text=text.split(source.id).join(source.title); if(source.targetId) text=text.split(source.targetId).join(source.title); }
  return text;
}
function excerpt(source: Source) {
  try {
    const value=JSON.parse(source.text);
    const clean=(v: unknown): unknown=>Array.isArray(v)?v.map(clean):v && typeof v==='object'?Object.fromEntries(Object.entries(v).filter(([key])=>!/id$|ids$|revision/i.test(key)).map(([key,item])=>[key,clean(item)])):v;
    return JSON.stringify(clean(value),null,2);
  } catch { return source.text.replace(/^.*"[^"\n]*(?:Id|ID|Ids|id)"\s*:.*$/gm,""); }
}
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

function DraftCard({draft,turnId,campaignId,onSaved,onRefine,busy}:{draft:Draft;turnId:string;campaignId:string;onSaved:(draft:Draft)=>void;onRefine:(draft:Draft,instruction:string)=>void;busy:boolean}) {
  const [current,setCurrent]=useState(draft);
  const [editing,setEditing]=useState(false);
  const [fields,setFields]=useState(draft);
  const [changing,setChanging]=useState(false);
  const [instruction,setInstruction]=useState("");
  const [saving,setSaving]=useState(false);
  const [error,setError]=useState("");
  const lock=useRef(false);
  useEffect(()=>{setCurrent(draft);},[draft]);
  const added=Boolean(current.createdId);
  const labels:Record<string,string>={npc:"этого НПС",location:"эту локацию",player:"этого игрока",monster:"этого монстра",quest:"этот квест",lore:"эту заметку",event:"это событие",shop:"этот магазин",sessionPrep:"эту подготовку"};
  async function persist(apply:boolean) {
    if(lock.current||added)return;
    lock.current=true;setSaving(true);setError("");
    try {
      const ref={turnId,draftId:current.id,revision:(apply?current.revision:fields.revision)||0};
      const body=apply?ref:{...ref,title:fields.title,subtitle:fields.subtitle,summary:fields.summary,content:fields.content};
      const result=await chatRequest<{draft:Draft;campaign?:unknown}>(`/api/campaigns/${encodeURIComponent(campaignId)}/ai/chat/drafts/${apply?"apply":"edit"}`,body);
      setCurrent(result.draft);setEditing(false);onSaved(result.draft);
      if(apply)window.dispatchEvent(new CustomEvent("shadow-edge:chat-created",{detail:result.campaign}));
    } catch(e){setError((e as Error).message);} finally{lock.current=false;setSaving(false);}
  }
  return <article className="ai-chat-draft">
    <div className="ai-chat-draft-heading"><span><Sparkles size={16}/>Предложение для кампании</span>{added&&<span><Check size={16}/>Добавлено</span>}</div>
    {editing ? <form className="ai-chat-draft-editor" onSubmit={event=>{event.preventDefault();void persist(false);}}>
      <label>Название<input required maxLength={160} value={fields.title} onChange={event=>setFields({...fields,title:event.target.value})}/></label>
      <label>Роль или категория<input maxLength={300} value={fields.subtitle} onChange={event=>setFields({...fields,subtitle:event.target.value})}/></label>
      <label>Краткое описание<textarea aria-label="Краткое описание" maxLength={2000} rows={3} value={fields.summary} onChange={event=>setFields({...fields,summary:event.target.value})}/></label>
      <label>Полное описание<textarea aria-label="Полное описание" required maxLength={20000} rows={12} value={fields.content} onChange={event=>setFields({...fields,content:event.target.value})}/></label>
      <div className="ai-chat-draft-actions"><button type="submit" disabled={saving||!fields.title.trim()||!fields.content.trim()}><Save size={16}/>{saving?"Сохраняю…":"Сохранить в чате"}</button><button type="button" disabled={saving} onClick={()=>{setEditing(false);setError("");}}>Отмена</button></div>
    </form> : <><h3>{current.title}</h3>{current.subtitle&&<small>{current.subtitle}</small>}<FormattedText content={current.summary}/><details><summary>Посмотреть полное описание</summary><FormattedText content={current.content}/></details>
      <div className="ai-chat-draft-actions">
        {current.kind!=="worldMap"&&<button type="button" className="ai-chat-add" disabled={saving||added||busy} onClick={()=>void persist(true)}>{added?<Check size={17}/>:<Plus size={17}/>} {added?"Добавлено в кампанию":saving?"Сохраняю…":`Добавить ${labels[current.kind]||"запись"} в кампанию`}</button>}
        {!added&&<><button type="button" disabled={saving||busy} onClick={()=>onRefine(current,"Расширь эту сущность: глубже проработай характерные особенности, мотивации, связи, секреты, варианты использования и детали, полезные мастеру. Сохрани существующие факты и ручные правки. Верни полную улучшенную версию.")}><Sparkles size={16}/>Расширить</button>
        <button type="button" disabled={saving||busy} onClick={()=>setChanging(!changing)}><MessageSquare size={16}/>Изменить с AI</button>
        <button type="button" disabled={saving||busy} onClick={()=>{setFields(current);setEditing(true);setChanging(false);setError("");}}><Pencil size={16}/>Редактировать</button></>}
      </div>
      {changing&&<form className="ai-chat-draft-editor" onSubmit={event=>{event.preventDefault();if(instruction.trim()){onRefine(current,instruction.trim());setChanging(false);setInstruction("");}}}><label>Что изменить?<textarea required maxLength={3000} rows={3} value={instruction} onChange={event=>setInstruction(event.target.value)}/></label><button type="submit" disabled={busy||!instruction.trim()}><Send size={16}/>Доработать</button></form>}
    </>}
    {current.kind==="worldMap"&&!editing&&<MapCreateForm key={current.id} campaignId={campaignId} initialPrompt={`${current.title}\n${current.content}`} storageKey={current.id}/>}
    {error&&<p role="alert">{error}</p>}
  </article>;
}

export function AIChat({campaignId, jobs, refreshJobs, initialContext, onContextChange}: {campaignId: string; jobs: AIJob[]; refreshJobs: () => void;initialContext?:ChatContext;onContextChange?:(context:ChatContext)=>void}) {
  const [mapComposer,setMapComposer]=useState(false);
  const [includeCampaign,setIncludeCampaign] = useState(initialContext?.includeCampaign ?? true);
  const [sessionIds,setSessionIds] = useState<string[]>(initialContext?.sessionIds ?? []);
  const scope = JSON.stringify({includeCampaign,sessionIds:[...sessionIds].sort()});
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
  useEffect(()=>onContextChange?.(JSON.parse(scope)),[scope,onContextChange]);

  useEffect(()=>{
    const controller = new AbortController();
    setLoading(true); setError("");
    const selected=JSON.parse(scope) as {includeCampaign:boolean;sessionIds:string[]};
    const params=new URLSearchParams({includeCampaign:String(selected.includeCampaign)});
    selected.sessionIds.forEach(id=>params.append("sessionIds",id));
    void chatRequest<ChatData>(`/api/campaigns/${encodeURIComponent(campaignId)}/ai/chat?${params}`,undefined,controller.signal)
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
      const job = await chatRequest<AIJob>(`/api/campaigns/${encodeURIComponent(campaignId)}/ai/chat`,{id:next.id,question:next.question,context:JSON.parse(scope),...(next.draftRef?{draftRef:next.draftRef}:{})});
      setPending(previous=>previous?.id===next.id ? {...previous,jobId:job.id} : previous);
      refreshJobs();
    } catch(e) { setPending(previous=>previous?.id===next.id ? {...previous,error:(e as Error).message} : previous); }
    finally { lock.current = false; }
  }
  function choosePrompt(text: string) { setQuestion(text); composer.current?.focus(); }
  function changeContext(campaign:boolean, ids:string[]) {
    setIncludeCampaign(campaign);setSessionIds(ids);setPending(null);
    setData(previous=>previous?{...previous,turns:[]}:previous);
  }

  const latest = data?.turns.at(-1);
  const related = (latest?.sources || []).filter((source, index, all) =>
    all.findIndex(other => other.kind === source.kind && other.targetId === source.targetId) === index
  );
  const quickCreate = [
    {label:"НПС", icon:UserRound, prompt:"Создай нового НПС для выбранного контекста. Придумай имя, характер, мотив и сюжетную зацепку."},
    {label:"Локация", icon:MapPin, prompt:"Создай новую локацию для выбранного контекста: атмосферу, приметы, опасности и зацепки."},
    {label:"Квест", icon:ScrollText, prompt:"Создай квест для выбранного контекста: завязку, цель, препятствия, варианты исхода и награды."},
    {label:"Магазин", icon:Store, prompt:"Создай магазин для выбранного контекста: название, владельца, ассортимент и секрет."},
    {label:"Событие", icon:CalendarDays, prompt:"Создай событие для следующей игры с завязкой и вариантами развития."},
    {label:"Заметка", icon:BookOpen, prompt:"Создай заметку лора для выбранного контекста с полезными мастеру деталями."},
  ];

  return <section className="ai-chat" aria-label="Чат по кампании">
    <div className="ai-chat-scope"><BookOpen size={18}/><details className="ai-chat-context"><summary>Контекст: {includeCampaign ? "кампания" : "без кампании"}{sessionIds.length ? ` · сессии: ${sessionIds.length}` : ""}</summary><fieldset disabled={busy}><label><input type="checkbox" checked={includeCampaign} onChange={e=>changeContext(e.target.checked,sessionIds)}/>Материалы кампании</label><div className="ai-chat-context-actions"><button type="button" onClick={()=>changeContext(true,[])}>Только кампания</button><button type="button" disabled={!data?.sessions.length} onClick={()=>changeContext(includeCampaign,data?.sessions.map(s=>s.id)||[])}>Все сессии</button><button type="button" disabled={!sessionIds.length} onClick={()=>changeContext(includeCampaign,[])}>Снять сессии</button></div><div className="ai-chat-session-options">{data?.sessions.map(session=><label key={session.id}><input type="checkbox" checked={sessionIds.includes(session.id)} onChange={e=>changeContext(includeCampaign,e.target.checked?[...sessionIds,session.id]:sessionIds.filter(id=>id!==session.id))}/>{session.title}</label>)}{data && !data.sessions.length && <small>Загруженных сессий пока нет</small>}</div></fieldset></details><button type="button" title="Обновить диалог" aria-label="Обновить диалог" onClick={()=>{setReload(v=>v+1);refreshJobs();}} disabled={loading}><RefreshCw size={17}/></button></div>
    <div className="ai-chat-scope-shortcuts" aria-label="Выбор материалов"><button type="button" disabled={busy} aria-pressed={includeCampaign&&!sessionIds.length} onClick={()=>changeContext(true,[])}>Только кампания</button><button type="button" disabled={busy||!data?.sessions.length} aria-pressed={Boolean(data?.sessions.length)&&sessionIds.length===data?.sessions.length} onClick={()=>changeContext(includeCampaign,data?.sessions.map(session=>session.id)||[])}>Все сессии</button>{data?.sessions.filter(session=>sessionIds.includes(session.id)).map(session=><button type="button" disabled={busy} key={session.id} title={`Убрать из контекста: ${session.title}`} onClick={()=>changeContext(includeCampaign,sessionIds.filter(id=>id!==session.id))}>{session.title}<span aria-hidden="true">×</span></button>)}</div>
    <div className="ai-chat-quick-create" aria-label="Быстрое создание">{quickCreate.map(({label,icon:Icon,prompt})=><button type="button" key={label} disabled={busy} onClick={()=>choosePrompt(prompt)}><Icon size={17}/>{label}<Plus size={12}/></button>)}<button type="button" aria-pressed={mapComposer} onClick={()=>setMapComposer(!mapComposer)}><Compass size={17}/>Карта мира<Plus size={12}/></button></div>
    {mapComposer&&<MapCreateForm key={campaignId} campaignId={campaignId} initialPrompt={question} onCreated={refreshJobs}/>}
    <div className="ai-chat-workspace"><div className="ai-chat-conversation">
    <div className="ai-chat-messages" aria-label="История диалога">
      {loading && !data && <p role="status">Загружаю диалог…</p>}
      {data && !data.turns.length && !visiblePending && <div className="ai-chat-empty"><Sparkles size={28}/><h3>Обсудим вашу кампанию</h3><div>{["Какие сюжетные линии остались открыты?","Что стоит подготовить к следующей игре?","Где в истории есть противоречия?"].map(prompt=><button type="button" key={prompt} disabled={busy} onClick={()=>choosePrompt(prompt)}><MessageSquare size={16}/>{prompt}</button>)}</div></div>}
      {data?.turns.map(turn=>{
        const entities = turn.sources?.filter((source,i,all)=>source.entity && all.findIndex(other=>other.kind===source.kind && other.targetId===source.targetId)===i).slice(0,4) || [];
        return <article className="ai-chat-turn" key={turn.id}>
          <Question text={turn.question} time={turn.createdAt}/>
          <div className="ai-chat-message"><span className="ai-chat-avatar assistant"><Sparkles size={19}/></span><div className="ai-chat-answer"><small><strong>Помощник мастера</strong><time>{new Date(turn.createdAt).toLocaleString("ru-RU")}</time></small><FormattedText content={readable(turn.answer,turn.sources||[])}/>
            {entities.length>0 && <div className="ai-chat-entities">{entities.map(source=><EntityPreview key={`${source.kind}:${source.targetId}`} source={source}/>)}</div>}
            <div className="ai-chat-drafts">{turn.drafts?.map(draft=><DraftCard key={draft.id} draft={draft} turnId={turn.id} campaignId={campaignId} busy={busy} onSaved={updated=>{setData(previous=>previous?{...previous,turns:previous.turns.map(item=>item.id===turn.id?{...item,drafts:item.drafts?.map(value=>value.id===updated.id?updated:value)}:item)}:previous);}} onRefine={(updated,instruction)=>void send({id:crypto.randomUUID(),question:`Доработай «${updated.title}». ${instruction}`,createdAt:new Date().toISOString(),draftRef:{turnId:turn.id,draftId:updated.id,revision:updated.revision||0}})}/>)}</div>
            {turn.suggestions?.length>0 && <section className="ai-chat-suggestions"><strong>Что можно доработать</strong><ul>{turn.suggestions.map((text,i)=><li key={i}><FormattedText content={readable(text,turn.sources||[])}/></li>)}</ul></section>}
            {turn.sources?.length>0 && <details className="ai-chat-sources"><summary>Источники · {turn.sources.length}</summary>{turn.sources.map(source=><details key={source.id}><summary>{source.title}{source.kind==="transcript" ? ` · строки ${source.firstLine}–${source.lastLine}` : ""}</summary><pre>{readable(excerpt(source),turn.sources)}</pre></details>)}</details>}
          </div></div>
        </article>;
      })}
      {visiblePending && <Question text={pending.question} time={pending.createdAt}/>}
      {busy && <div className="ai-chat-message ai-chat-waiting" role="status"><span className="ai-chat-avatar assistant"><Sparkles size={19}/></span><div><strong>Помощник мастера</strong><p>Изучаю материалы<span className="ai-chat-dots" aria-hidden="true"><i/><i/><i/></span></p></div></div>}
      {visiblePending && pendingError && <div className="ai-chat-send-error" role="alert"><p>{pendingError}</p><button type="button" disabled={busy} onClick={()=>void send(pending)}><RefreshCw size={15}/>Повторить</button><button type="button" disabled={busy} onClick={()=>{setQuestion(pending.question);setPending(null);composer.current?.focus();}}>Редактировать</button></div>}
      <div ref={end}/>
    </div>
    {error && <p role="alert" className="ai-job-error">{error}</p>}
    <form className="ai-chat-compose" onSubmit={e=>{e.preventDefault();if(includeCampaign||sessionIds.length)void send();}}><textarea ref={composer} aria-label="Вопрос AI" placeholder="Спросить о кампании или создать сущность…" onKeyDown={event=>{if(event.key==="Enter"&&(event.ctrlKey||event.metaKey)){event.preventDefault();if(!loading&&(includeCampaign||sessionIds.length))void send();}}} rows={2} maxLength={4000} required minLength={2} disabled={busy} value={question} onChange={e=>setQuestion(e.target.value)}/><button type="submit" title="Отправить вопрос" aria-label="Отправить вопрос" disabled={busy||loading||question.trim().length<2||(!includeCampaign&&!sessionIds.length)}><Send size={20}/></button></form><small className="ai-chat-disclaimer">{!includeCampaign&&!sessionIds.length ? "Выбери материалы кампании или хотя бы одну сессию." : "AI может ошибаться. Записи добавляются только после подтверждения."}</small>
    </div><aside className="ai-chat-inspector" aria-label="Материалы ответа">
      <header><Compass size={20}/><div><h3>Рабочая панель</h3><small>Материалы текущего ответа</small></div></header>
      <section><h4><BookOpen size={17}/>Найдено в контексте <span>{related.length}</span></h4>
        {related.length ? related.map(source=><details className="ai-chat-related" key={source.id}><summary><span className="ai-chat-related-icon">{source.kind==="locations"?<MapPin size={19}/>:source.kind==="npcs"?<UserRound size={19}/>:<BookOpen size={19}/>}</span><span><strong>{source.title}</strong><small>{kindLabels[source.kind]||"Материал сессии"}</small></span></summary><FormattedText content={source.entity?.summary || readable(excerpt(source),latest?.sources||[])}/></details>) : <p className="ai-chat-inspector-empty">Связанные материалы появятся после ответа помощника.</p>}
      </section>
      {!!latest?.drafts?.length && <section><h4><Sparkles size={17}/>Предложения <span>{latest.drafts.length}</span></h4>{latest.drafts.map(draft=><div className="ai-chat-draft-index" key={draft.id}><span><strong>{draft.title}</strong><small>{draft.createdId?"Добавлено в кампанию":"Ожидает подтверждения"}</small></span>{draft.createdId?<Check size={17}/>:<Plus size={17}/>}</div>)}</section>}
      <section className="ai-chat-save-policy"><h4><ShieldCheck size={18}/>Сохранение</h4><p>После подтверждения</p><small>Предложения остаются в истории чата. Добавляй нужные записи кнопкой под описанием.</small></section>
    </aside></div>
  </section>;
}

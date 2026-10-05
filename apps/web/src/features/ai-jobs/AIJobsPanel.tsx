import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { AIJob } from "@shadow-edge/shared-types";
import { api } from "../../app/api";
import { isActiveJob, useAIJobs } from "./useAIJobs";
import { AISoundToggle } from "./AISoundToggle";
import { AIJobProgress } from "./AIJobProgress";
import { AIChat, type ChatContext } from "./AIChat";
import { useAssistantWindow, type ResizeEdge } from "./useAssistantWindow";
import { Maximize2, Minimize2, X, MessageSquare, Compass, ListChecks, ArrowUpRight } from "lucide-react";

const labels: Record<string,string> = { answer:"Ответ", suggestions:"Предложения", title:"Название", name:"Имя", summary:"Кратко", content:"Описание", sceneText:"Сцена", notes:"Примечания", entity:"Запись", linkedDrafts:"Связанные записи", card:"Карточка", event:"Событие", message:"Ответ", warning:"Обрати внимание", createdEntities:"Участники боя", role:"Роль", note:"Заметка", subtitle:"Подзаголовок", tags:"Теги" };
function resultText(value: unknown, depth = 0): string {
  if (depth > 8 || value == null) return "";
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map(item => resultText(item,depth+1)).filter(Boolean).join("\n\n");
  if (typeof value === "object") return Object.entries(value).flatMap(([key,item]) => labels[key] ? [`${labels[key]}\n${resultText(item,depth+1)}`] : []).join("\n\n");
  return "";
}

export function AIJobsPanel({ campaignId, onOpenSession, onOpenProposal, pageMode=false, initialContext }: { campaignId?: string; onOpenSession: (job: AIJob) => void; onOpenProposal: (id: string) => void;pageMode?:boolean;initialContext?:ChatContext }) {
  const { jobs, error, loading, refresh } = useAIJobs();
  const [tab,setTab] = useState<"chat"|"jobs">("chat");
  const [expanded,setExpanded] = useState(false);
  const [open,setOpen] = useState(pageMode);
  const [context,setContext] = useState<ChatContext>(initialContext||{includeCampaign:true,sessionIds:[]});
  const [detail,setDetail] = useState<AIJob|null>(null);
  const [detailError,setDetailError] = useState("");
  const [loadingDetail,setLoadingDetail] = useState("");
  const dialog = useRef<HTMLDialogElement>(null);
  const floating = useAssistantWindow();
  const requestVersion = useRef(0);
  useEffect(() => { if(pageMode)return;if(open) dialog.current?.show(); else dialog.current?.close(); },[open,pageMode]);
  useEffect(() => () => { requestVersion.current++; },[]);
  const active = jobs.filter(isActiveJob);
  const showResult = async (job: AIJob) => {
    const version = ++requestVersion.current;
    setLoadingDetail(job.id); setDetailError(""); setDetail(null);
    try { const result = await api.getAIJob(job.id); if(version === requestVersion.current) setDetail(result); }
    catch { if(version === requestVersion.current) setDetailError("Не удалось открыть результат. Попробуй ещё раз."); }
    finally { if(version === requestVersion.current) setLoadingDetail(""); }
  };
  const data = detail?.result?.data as { proposalIds?: string[]; id?: string; kind?: string } | undefined;
  const proposals = data?.proposalIds || (data?.id && data?.kind ? [data.id] : []);
  const downloadResult = () => {
    if (!detail?.result?.data) return;
    const url = URL.createObjectURL(new Blob([JSON.stringify(detail.result.data, null, 2)], { type: "application/json" }));
    const link = document.createElement("a"); link.href = url; link.download = `ai-result-${detail.id}.json`; link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return <>
    {!pageMode && <button className={`ai-jobs-launcher ${active.length ? "working" : ""}`} onClick={() => setOpen(true)} type="button">
      <MessageSquare size={17} aria-hidden="true"/>{active.length ? `AI работает · ${active.length}` : "AI-помощник"}{error ? " · !" : ""}
    </button>}
    {createPortal(<dialog open={pageMode?true:undefined} className={`panel ai-jobs-dialog ai-assistant ${expanded ? "expanded" : ""} ${pageMode ? "ai-assistant-page" : ""}`} style={pageMode?{position:"relative",left:0,top:0,width:"100%",height:"100%"}:expanded?{left:8,top:8,width:"calc(100vw - 16px)",height:"calc(100dvh - 16px)"}:floating.box} ref={dialog} onCancel={() => setOpen(false)} onKeyDown={event=>{if(!pageMode && event.key==="Escape"){event.stopPropagation();setOpen(false);}}} aria-modal="false" aria-label="AI-помощник">
      <><header className="ai-assistant-drag" tabIndex={pageMode?undefined:expanded?-1:0} title="Переместить окно" aria-label="Переместить окно помощника" onPointerDown={event=>{if(!expanded&&!pageMode)floating.start(event);}} onPointerMove={floating.move} onPointerUp={floating.end} onPointerCancel={floating.end} onKeyDown={event=>{if(!expanded&&!pageMode)floating.key(event);}}><div className="ai-assistant-brand"><span className="ai-assistant-emblem"><Compass size={38}/></span><div><h2>{pageMode?"Чат по кампании":"AI-помощник"}</h2><p>Кампания, сессии и новые истории</p></div></div><div className="ai-assistant-tools"><AISoundToggle/>{!pageMode && <><a className="ai-chat-page-link" href={`/chat?campaign=${encodeURIComponent(campaignId||"")}&context=${encodeURIComponent(JSON.stringify(context))}`} title="Открыть страницу чата" aria-label="Открыть страницу чата"><ArrowUpRight size={19}/></a><button type="button" className="ghost" title={expanded ? "Свернуть" : "На весь экран"} aria-label={expanded ? "Свернуть" : "На весь экран"} onClick={()=>setExpanded(!expanded)}>{expanded ? <Minimize2 size={18}/> : <Maximize2 size={18}/>}</button><button type="button" className="ghost" title="Закрыть" aria-label="Закрыть AI-помощник" onClick={() => setOpen(false)}><X size={18}/></button></>}</div></header>
        {!pageMode && <nav className="ai-assistant-tabs" aria-label="Разделы AI"><button type="button" aria-pressed={tab==="chat"} onClick={()=>setTab("chat")}><MessageSquare size={17}/>Чат</button><button type="button" aria-pressed={tab==="jobs"} onClick={()=>setTab("jobs")}><ListChecks size={17}/>Задачи{active.length ? ` · ${active.length}` : ""}</button></nav>}
        <div className="ai-assistant-chat" hidden={tab!=="chat"}>{campaignId ? <AIChat key={campaignId} campaignId={campaignId} jobs={jobs} refreshJobs={()=>void refresh()} initialContext={initialContext} onContextChange={setContext}/> : <p>Открой кампанию, чтобы начать диалог.</p>}</div>
        <div className="ai-assistant-job-list" hidden={tab!=="jobs"}>
        {error && <p role="alert">{error}</p>}{loading && <p role="status">Проверяю задачи…</p>}
        {!loading && !jobs.length && <p>Здесь появятся анализы сессий, изображения и другие генерации.</p>}
        {jobs.map(job => <article className="ai-job-card" key={job.id}>
          {isActiveJob(job) ? <AIJobProgress job={job}/> : <><strong>{job.title}</strong><p className={job.state === "failed" ? "ai-job-error" : ""}>{job.state === "failed" ? "Не завершено" : "✓ Готово"} · {new Date(job.finishedAt || job.createdAt).toLocaleString("ru-RU")}</p></>}
          {!isActiveJob(job) && job.stage !== "Готово" && job.stage !== "Не удалось завершить" && <p>{job.stage}</p>}
          <div className="actions">{job.sessionId && <button className="ghost" onClick={() => { onOpenSession(job); setOpen(false); }}>Открыть сессию</button>}
            {!isActiveJob(job) && <button className="ghost" disabled={loadingDetail === job.id} onClick={() => void showResult(job)}>{loadingDetail === job.id ? "Загружаю…" : job.state === "failed" ? "Причина ошибки" : "Посмотреть результат"}</button>}
          </div>
          {detail?.id === job.id && <div className="ai-job-result">{detail.result?.error ? <p role="alert">{detail.result.error.message}</p> : <>
            <p className="ai-job-result-text">{resultText(detail.result?.data) || (job.sessionId ? "Отчёт сохранён в сессии." : "Результат сохранён. Изменения кампании доступны в соответствующем разделе.")}</p>
            {job.kind==="world-map"&&data?.id&&job.campaignId&&<a href={`/maps?campaign=${encodeURIComponent(job.campaignId)}&map=${encodeURIComponent(data.id)}`}>Открыть карту</a>}
            {proposals.map(id => <button key={id} className="ghost" onClick={() => {onOpenProposal(id); setOpen(false);}}>Открыть AI-черновик</button>)}
            <button className="ghost" onClick={downloadResult}>Скачать полные данные результата</button>
          </>}</div>}
        </article>)}
        {detailError && <p role="alert">{detailError}</p>}
        <small>История хранит до 50 недавних завершённых задач на аккаунт. Перезапуск сервера прерывает незавершённые задачи и отмечает их ошибкой.</small>
        </div>
      </>
      {!expanded && !pageMode && (["n","s","e","w","ne","nw","se","sw"] as ResizeEdge[]).map(edge=><button key={edge} className={`ai-assistant-edge edge-${edge}`} type="button" title="Изменить размер окна" aria-label={`Изменить размер окна ${edge}`} onPointerDown={event=>floating.start(event,edge)} onPointerMove={floating.move} onPointerUp={floating.end} onPointerCancel={floating.end} onKeyDown={event=>floating.key(event,edge)}/>)}
    </dialog>, pageMode ? document.querySelector(".ai-chat-page-main") || document.body : document.body)}
  </>;
}

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { AIJob } from "@shadow-edge/shared-types";
import { api } from "../../app/api";
import { isActiveJob, useAIJobs } from "./useAIJobs";
import { AIJobProgress } from "./AIJobProgress";
import { AIChat } from "./AIChat";
import { Maximize2, Minimize2, X, MessageSquare } from "lucide-react";

const labels: Record<string,string> = { answer:"Ответ", suggestions:"Предложения", title:"Название", name:"Имя", summary:"Кратко", content:"Описание", sceneText:"Сцена", notes:"Примечания", entity:"Запись", linkedDrafts:"Связанные записи", card:"Карточка", event:"Событие", message:"Ответ", warning:"Обрати внимание", createdEntities:"Участники боя", role:"Роль", note:"Заметка", subtitle:"Подзаголовок", tags:"Теги" };
function resultText(value: unknown, depth = 0): string {
  if (depth > 8 || value == null) return "";
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map(item => resultText(item,depth+1)).filter(Boolean).join("\n\n");
  if (typeof value === "object") return Object.entries(value).flatMap(([key,item]) => labels[key] ? [`${labels[key]}\n${resultText(item,depth+1)}`] : []).join("\n\n");
  return "";
}

export function AIJobsPanel({ campaignId, onOpenSession, onOpenProposal }: { campaignId?: string; onOpenSession: (job: AIJob) => void; onOpenProposal: (id: string) => void }) {
  const { jobs, error, loading, refresh } = useAIJobs();
  const [tab,setTab] = useState<"chat"|"jobs">("chat");
  const [expanded,setExpanded] = useState(false);
  const [open,setOpen] = useState(false);
  const [detail,setDetail] = useState<AIJob|null>(null);
  const [detailError,setDetailError] = useState("");
  const [loadingDetail,setLoadingDetail] = useState("");
  const dialog = useRef<HTMLDialogElement>(null);
  const requestVersion = useRef(0);
  useEffect(() => { if(open) dialog.current?.showModal(); else dialog.current?.close(); },[open]);
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
    <button className={`ai-jobs-launcher ${active.length ? "working" : ""}`} onClick={() => setOpen(true)} type="button">
      <MessageSquare size={17} aria-hidden="true"/>{active.length ? `AI работает · ${active.length}` : "AI-помощник"}{error ? " · !" : ""}
    </button>
    {createPortal(<dialog className={`panel ai-jobs-dialog ai-assistant ${expanded ? "expanded" : ""}`} ref={dialog} onCancel={() => setOpen(false)} aria-label="AI-помощник">
      <><header><h2>AI-помощник</h2><div className="ai-assistant-tools"><button type="button" className="ghost" title={expanded ? "Свернуть" : "На весь экран"} aria-label={expanded ? "Свернуть" : "На весь экран"} onClick={()=>setExpanded(!expanded)}>{expanded ? <Minimize2 size={18}/> : <Maximize2 size={18}/>}</button><button type="button" className="ghost" title="Закрыть" aria-label="Закрыть AI-помощник" onClick={() => setOpen(false)}><X size={18}/></button></div></header>
        <nav className="ai-assistant-tabs" aria-label="Разделы AI"><button type="button" aria-pressed={tab==="chat"} onClick={()=>setTab("chat")}>Чат</button><button type="button" aria-pressed={tab==="jobs"} onClick={()=>setTab("jobs")}>Задачи{active.length ? ` · ${active.length}` : ""}</button></nav>
        <div className="ai-assistant-chat" hidden={tab!=="chat"}>{campaignId ? <AIChat key={campaignId} campaignId={campaignId} jobs={jobs} refreshJobs={()=>void refresh()}/> : <p>Открой кампанию, чтобы начать диалог.</p>}</div>
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
            {proposals.map(id => <button key={id} className="ghost" onClick={() => {onOpenProposal(id); setOpen(false);}}>Открыть AI-черновик</button>)}
            <button className="ghost" onClick={downloadResult}>Скачать полные данные результата</button>
          </>}</div>}
        </article>)}
        {detailError && <p role="alert">{detailError}</p>}
        <small>История хранит до 50 недавних завершённых задач на аккаунт. Перезапуск сервера прерывает незавершённые задачи и отмечает их ошибкой.</small>
        </div>
      </>
    </dialog>, document.body)}
  </>;
}

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { AIJob } from "@shadow-edge/shared-types";
import { api } from "../../app/api";
import { isActiveJob, useAIJobs } from "./useAIJobs";
import { AIJobProgress } from "./AIJobProgress";

const labels: Record<string,string> = { title:"Название", name:"Имя", summary:"Кратко", content:"Описание", sceneText:"Сцена", notes:"Примечания", entity:"Запись", linkedDrafts:"Связанные записи", card:"Карточка", event:"Событие", message:"Ответ", warning:"Обрати внимание", createdEntities:"Участники боя", role:"Роль", note:"Заметка", subtitle:"Подзаголовок", tags:"Теги" };
function resultText(value: unknown, depth = 0): string {
  if (depth > 8 || value == null) return "";
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map(item => resultText(item,depth+1)).filter(Boolean).join("\n\n");
  if (typeof value === "object") return Object.entries(value).flatMap(([key,item]) => labels[key] ? [`${labels[key]}\n${resultText(item,depth+1)}`] : []).join("\n\n");
  return "";
}

export function AIJobsPanel({ onOpenSession, onOpenProposal }: { onOpenSession: (job: AIJob) => void; onOpenProposal: (id: string) => void }) {
  const { jobs, error, loading } = useAIJobs();
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
      <span aria-hidden="true">✦</span>{active.length ? `AI работает · ${active.length}` : "Задачи AI"}{error ? " · !" : ""}
    </button>
    {createPortal(<dialog className="panel ai-jobs-dialog" ref={dialog} onCancel={() => setOpen(false)} aria-label="Фоновые задачи AI">
      {open && <><header><div><h2>Задачи AI</h2><p>Работают на сервере, даже когда страница закрыта.</p></div><button className="ghost" onClick={() => setOpen(false)}>Закрыть</button></header>
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
      </>}
    </dialog>, document.body)}
  </>;
}

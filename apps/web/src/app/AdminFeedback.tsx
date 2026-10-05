import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, RefreshCw, Search } from "lucide-react";
import { feedbackRequest, feedbackTypes, feedbackStatuses, FeedbackAccessError, type FeedbackEntry } from "./feedback-api";
import "./feedback.css";

export function AdminFeedback({ onDenied }: { onDenied: () => void }) {
  const [type, setType] = useState(""); const [status, setStatus] = useState("");
  const [query, setQuery] = useState(""); const [search, setSearch] = useState("");
  const [offset, setOffset] = useState(0); const [version, setVersion] = useState(0);
  const [data, setData] = useState<{ items: FeedbackEntry[]; total: number } | null>(null);
  const [busy, setBusy] = useState(false); const [saving, setSaving] = useState(false); const [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController(); setBusy(true); setError(""); setData(null);
    void feedbackRequest<{ items: FeedbackEntry[]; total: number }>(`/api/admin/feedback?${new URLSearchParams({type,status,q:search,offset:String(offset)})}`, undefined, controller.signal)
      .then(setData).catch(e => { if (controller.signal.aborted) return; if (e instanceof FeedbackAccessError) onDenied(); setError(e.message); }).finally(() => { if (!controller.signal.aborted) setBusy(false); });
    return () => controller.abort();
  }, [type, status, search, offset, version]);
  async function update(entry: FeedbackEntry, next: string) {
    setSaving(true); setError("");
    try { await feedbackRequest("/api/admin/feedback", { id: entry.id, status: next, expected: entry.status }); setVersion(v => v + 1); }
    catch (e) { if (e instanceof FeedbackAccessError) onDenied(); setError((e as Error).message); }
    finally { setSaving(false); }
  }
  return <section className="admin-feedback" aria-labelledby="admin-feedback-title"><h2 id="admin-feedback-title">Отзывы пользователей{data ? ` · ${data.total}` : ""}</h2>
    <form className="feedback-filters" onSubmit={e => { e.preventDefault(); setOffset(0); setSearch(query.trim()); setVersion(v => v + 1); }}>
      <label>Тип<select aria-label="Тип" value={type} disabled={saving} onChange={e => {setType(e.target.value);setOffset(0);}}><option value="">Все типы</option>{Object.entries(feedbackTypes).map(([v,l]) => <option key={v} value={v}>{l}</option>)}</select></label>
      <label>Статус<select aria-label="Статус" value={status} disabled={saving} onChange={e => {setStatus(e.target.value);setOffset(0);}}><option value="">Все статусы</option>{Object.entries(feedbackStatuses).map(([v,l]) => <option key={v} value={v}>{l}</option>)}</select></label>
      <label>Поиск<input aria-label="Поиск отзывов" value={query} onChange={e => setQuery(e.target.value)} maxLength={200} placeholder="Текст, пользователь или ID" /></label><button type="submit" disabled={saving} title="Найти" aria-label="Найти отзывы"><Search size={18}/></button><button type="button" disabled={busy || saving} title="Обновить" aria-label="Обновить отзывы" onClick={() => setVersion(v => v + 1)}><RefreshCw size={18}/></button>
    </form>
    {error && <p role="alert" className="admin-error">{error}</p>}{busy && <p role="status">Загрузка отзывов…</p>}
    {data && <><div className="feedback-list">{data.items.map(entry => <article key={entry.id}><header><div><strong>{feedbackTypes[entry.type]}</strong><small>{entry.username} · {entry.accountId}</small><time>{new Date(entry.createdAt).toLocaleString("ru-RU")}</time></div><label>Статус<select aria-label={`Статус отзыва ${entry.id}`} disabled={saving || busy} value={entry.status} onChange={e => void update(entry,e.target.value)}>{Object.entries(feedbackStatuses).map(([v,l]) => <option key={v} value={v}>{l}</option>)}</select></label></header><p>{entry.message}</p></article>)}</div>{!data.items.length && <p>По выбранным условиям отзывов нет.</p>}<nav className="admin-pagination" aria-label="Страницы отзывов"><button type="button" aria-label="Предыдущие отзывы" title="Назад" disabled={offset===0 || busy || saving} onClick={() => setOffset(Math.max(0,offset-50))}><ChevronLeft size={18}/></button><span>{data.total && data.items.length ? offset+1 : 0}–{Math.min(offset+data.items.length,data.total)} / {data.total}</span><button type="button" aria-label="Следующие отзывы" title="Далее" disabled={offset+50>=data.total || busy || saving} onClick={() => setOffset(offset+50)}><ChevronRight size={18}/></button></nav></>}
  </section>;
}

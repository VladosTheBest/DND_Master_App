import { useEffect, useRef, useState } from "react";
import { MessageSquare, Send, X, CheckCircle } from "lucide-react";
import { feedbackRequest, feedbackTypes } from "./feedback-api";
import "./feedback.css";

export function FeedbackButton() {
  return <button type="button" className="ghost feedback-trigger" onClick={() => window.dispatchEvent(new Event("shadow-edge:feedback"))}><MessageSquare size={17} aria-hidden="true" />Оставить отзыв</button>;
}

export function FeedbackDialog() {
  const ref = useRef<HTMLDialogElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);
  const requestID = useRef("");
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<keyof typeof feedbackTypes>("bug");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const sending = useRef(false);
  useEffect(() => {
    const show = () => { previousFocus.current = document.activeElement as HTMLElement; setSent(false); setError(""); setOpen(true); };
    window.addEventListener("shadow-edge:feedback", show);
    return () => window.removeEventListener("shadow-edge:feedback", show);
  }, []);
  useEffect(() => { if (open) ref.current?.showModal(); else { ref.current?.close(); previousFocus.current?.focus(); } }, [open]);
  const close = () => { if (!sending.current) setOpen(false); };
  async function submit() {
    if (sending.current) return;
    sending.current = true; setBusy(true); setError("");
    try { requestID.current ||= crypto.randomUUID(); await feedbackRequest("/api/feedback", { type, message: message.trim(), submissionId: requestID.current }); setSent(true); setMessage(""); requestID.current = ""; }
    catch (e) { setError((e as Error).message); }
    finally { sending.current = false; setBusy(false); }
  }
  return <dialog ref={ref} className="feedback-dialog" aria-labelledby="feedback-title" onCancel={e => { e.preventDefault(); close(); }} onClick={e => { if (e.target === e.currentTarget) close(); }}>
    <header><h2 id="feedback-title">Обратная связь</h2><button type="button" aria-label="Закрыть отзыв" title="Закрыть" disabled={busy} onClick={close}><X size={20} /></button></header>
    {sent ? <section className="feedback-success" role="status"><CheckCircle size={32} /><h3>Спасибо за обратную связь</h3><p>Отзыв отправлен команде Shadow Edge GM.</p><button type="button" onClick={close}>Готово</button></section> : <form onSubmit={e => { e.preventDefault(); void submit(); }}>
      <label>Тип обращения<select value={type} disabled={busy} onChange={e => { setType(e.target.value as keyof typeof feedbackTypes); requestID.current = ""; }}>{Object.entries(feedbackTypes).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <label>Сообщение<textarea aria-label="Сообщение" required minLength={5} maxLength={5000} rows={8} value={message} disabled={busy} placeholder={type === "bug" ? "Что произошло? Что вы ожидали? Какие действия привели к ошибке?" : type === "suggestion" ? "Что стоит улучшить и какую задачу это поможет решить?" : "Что оказалось полезным или удобным? Что можно сделать лучше?"} onChange={e => { setMessage(e.target.value); requestID.current = ""; }} /></label>
      <small className="feedback-hint">{message.length} / 5000 · Не указывайте пароли и другую конфиденциальную информацию.</small>
      {error && <p role="alert" className="admin-error">{error}</p>}
      <footer><button type="button" disabled={busy} onClick={close}>Отмена</button><button type="submit" className="primary" disabled={busy || message.trim().length < 5}><Send size={16} />{busy ? "Отправка…" : "Отправить отзыв"}</button></footer>
    </form>}
  </dialog>;
}

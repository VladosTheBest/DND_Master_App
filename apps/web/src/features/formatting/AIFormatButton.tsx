import { useEffect, useRef, useState } from "react";
import { Sparkles, X } from "lucide-react";
import { api } from "../../app/api";
import { FormattedText } from "./FormattedText";

export function AIFormatButton({ campaignId, sourceId, title, content, disabled, onApply }: {
  campaignId: string; sourceId: string; title: string; content: string; disabled?: boolean; onApply: (text: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState("");
  const dialog = useRef<HTMLDialogElement>(null);
  const snapshot = JSON.stringify([campaignId, sourceId, title, content]);
  const current = useRef(snapshot); current.current = snapshot;
  useEffect(() => { setResult(null); setError(""); }, [snapshot]);
  useEffect(() => { if (result !== null) dialog.current?.showModal(); }, [result]);
  useEffect(() => () => { current.current = ""; }, []);
  const format = async () => {
    setBusy(true); setError("");
    try {
      const response = await api.formatPlayerFacingCard(campaignId, { title, content, mode: "format_markdown" });
      if (current.current !== snapshot) return;
      if (!response.card.content.trim()) throw new Error("AI вернул пустой текст. Исходник сохранён.");
      setResult(response.card.content);
    } catch (cause) {
      if (current.current === snapshot) setError(cause instanceof Error ? cause.message : "Не удалось оформить текст.");
    } finally { setBusy(false); }
  };
  return <>
    <button className="ghost ai-format-button" disabled={disabled || busy || !content.trim() || !campaignId} onClick={() => void format()} type="button"><Sparkles size={16} />{busy ? "Оформляю…" : "AI-форматирование"}</button>
    {error ? <span className="format-error" role="alert">{error}</span> : null}
    {result !== null ? <dialog ref={dialog} className="format-dialog" onCancel={() => setResult(null)} onClose={() => setResult(null)}>
      <header><div><h2>Оформление текста</h2><p>Проверь содержание перед заменой.</p></div><button autoFocus type="button" className="ghost" title="Закрыть" aria-label="Закрыть оформление" onClick={() => setResult(null)}><X size={18} /></button></header>
      <div className="format-preview"><FormattedText content={result} /></div>
      <footer><button className="ghost" type="button" onClick={() => setResult(null)}>Оставить исходный текст</button><button className="primary" disabled={disabled} type="button" onClick={() => { onApply(result); setResult(null); }}>Использовать оформление</button></footer>
    </dialog> : null}
  </>;
}

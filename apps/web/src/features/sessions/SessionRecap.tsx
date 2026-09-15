import type { SessionAnalysis } from "./sessions.api";

export function SessionRecap({ analysis, busy, onAnalyze }: {
  analysis?: SessionAnalysis;
  busy: boolean;
  onAnalyze: () => void;
}) {
  const recap = analysis?.recap?.trim();
  const paragraphs = recap?.split(/\n\s*\n/).filter(Boolean) || [];
  const minutes = Math.max(1, Math.ceil((recap?.split(/\s+/).length || 0) / 180));
  return <article className="session-recap" aria-labelledby="session-recap-title">
    <div className="session-card-heading">
      <div><span className="session-eyebrow">ВСПОМНИТЬ ПРИКЛЮЧЕНИЕ</span><h3 id="session-recap-title">Общий разбор сессии</h3></div>
      {recap && <span className="session-reading-time">≈ {minutes} мин чтения</span>}
    </div>
    {analysis?.summary && <div className="session-recap-lead"><span className="session-eyebrow">В ДВУХ СЛОВАХ</span><p>{analysis.summary}</p></div>}
    {recap ? <div className="session-recap-prose">{paragraphs.map((paragraph, index) => <p key={index}>{paragraph}</p>)}</div> : <div className="session-recap-empty">
      <p>{analysis ? "Краткий итог уже готов. Обновите анализ, чтобы прочитать всю историю сессии: от первых событий до того, на чём остановилась партия." : "Здесь будет связный рассказ о вашей игре: важные события, решения, встречи и их последствия. Его удобно перечитать перед следующей сессией."}</p>
      <button className="primary" disabled={busy} onClick={onAnalyze}>{busy ? "Готовим разбор…" : analysis ? "Дополнить общим разбором" : "Создать разбор сессии"}</button>
      <small>Разбор создаётся из сохранённой расшифровки вместе с хроникой и локациями.</small>
    </div>}
  </article>;
}

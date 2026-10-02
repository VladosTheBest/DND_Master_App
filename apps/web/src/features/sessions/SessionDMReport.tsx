import { useEffect, useMemo, useState } from "react";
import type { ImportedSession, SourceRange } from "./sessions.api";
import { parseSessionText, speakerStatistics, transcriptDiagnostics } from "./session-stats";
import "./session-dm-report.css";

import { sections, basis, status, clock } from "./dm-report-content";

export function SessionDMReport({ session, master, onMaster, onSource, sourceLabel, onAnalyze, busy }: {
  session: ImportedSession; master: string; onMaster: (name: string) => void;
  onSource: (source: SourceRange) => void; sourceLabel: (source: SourceRange) => string;
  onAnalyze: () => void; busy: boolean;
}) {
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState("");
  const [pdfFile, setPdfFile] = useState<{ url: string; filename: string } | null>(null);
  useEffect(() => () => { if (pdfFile) URL.revokeObjectURL(pdfFile.url); }, [pdfFile]);
  const download = async () => {
    setExporting(true); setExportError("");
    try { const { downloadSessionPdf } = await import("./session-pdf"); setPdfFile(await downloadSessionPdf(session, master)); }
    catch (error) { setExportError(error instanceof Error ? error.message : "Не удалось подготовить PDF."); }
    finally { setExporting(false); }
  };
  const entries = useMemo(() => parseSessionText(session.text || ""), [session.text]);
  const diagnostics = useMemo(() => transcriptDiagnostics(session.text || "", entries), [session.text, entries]);
  const allStats = useMemo(() => speakerStatistics(entries), [entries]);
  const stats = useMemo(() => speakerStatistics(entries, master), [entries, master]);
  const analysis = session.analysis, report = analysis?.dmReport;
  const sources = (refs: SourceRange[]) => <div className="dm-sources">{refs.map((ref, i) => <button key={i} className="ghost" onClick={() => onSource(ref)} title={sourceLabel(ref)}>{sourceLabel(ref)}<span> · строки {ref.fromLine}–{ref.toLine}</span></button>)}</div>;
  return <article className="dm-report">
    <header className="dm-report-heading">
      <div><span className="session-eyebrow">ХРОНИКА МАСТЕРА · СЕССИЯ {session.number}</span><h2>{session.title}</h2><p>Итоги, наблюдения и подготовка следующей игры</p></div>
      <button className="ghost dm-no-print" disabled={exporting} onClick={() => void download()}>{exporting ? "Готовим PDF…" : "Скачать PDF"}</button>
    </header>
    {exportError && <p role="alert" className="dm-no-print">{exportError}</p>}
    {pdfFile && <p className="dm-no-print" role="status"><a className="dm-pdf-link" href={pdfFile.url} download={pdfFile.filename}>PDF готов — скачать файл</a></p>}
    <p className="dm-print-note">Личный отчёт мастера · {analysis?.generatedAt ? new Date(analysis.generatedAt).toLocaleDateString("ru-RU") : "Анализ ещё не выполнен"}</p>
    <nav className="dm-index dm-no-print" aria-label="Разделы отчёта мастера">
      {[["dm-summary", "За две минуты"], ["dm-statistics", "Статистика"], ...(report ? [["dm-scenes", "Хронология"], ["dm-feedback", "Отзывы"], ["dm-preparation", "К следующей игре"]] : [])].map(([id, title]) => <button key={id} onClick={() => document.getElementById(id)?.scrollIntoView({ block: "start", behavior: "auto" })}>{title}</button>)}
    </nav>
    <section id="dm-summary"><h3>Сессия за две минуты</h3><p className="dm-lead">{analysis?.summary || "Текст импортирован. Запустите анализ, чтобы получить итоги сессии и рекомендации."}</p></section>
    {!report && <div className="dm-upgrade dm-no-print"><p>{analysis ? "Этот отчёт создан в прежнем формате. Повторный анализ добавит сцены, отзывы, сюжетные линии и рекомендации с источниками." : "Статистика доступна сразу. AI-разбор заполнит остальные разделы по содержанию расшифровки."}</p><button className="primary" disabled={busy} onClick={onAnalyze}>{busy ? "Анализируем…" : "Подготовить отчёт мастера"}</button></div>}
    <section id="dm-statistics"><h3>Запись и участие в разговоре</h3>
      <div className="dm-metrics"><div><strong>{diagnostics.lastSecond === null ? "—" : clock(diagnostics.lastSecond)}</strong><span>до последней реплики</span></div><div><strong>{diagnostics.utterances.toLocaleString("ru-RU")}</strong><span>реплик без точных дублей</span></div><div><strong>{allStats.length}</strong><span>говорящих в записи</span></div></div>
      <label className="dm-master dm-no-print">Мастер <select value={master} onChange={e => onMaster(e.target.value)}><option value="">Не выбран — показаны все</option>{allStats.map(s => <option key={s.name}>{s.name}</option>)}</select></label>
      <p className="dm-caption">{master ? `Мастер (${master}) исключён из таблицы и долей.` : "В таблице все говорящие, включая мастера."} Количество речи не измеряет удовольствие или вовлечённость. Время — интервалы распознанных реплик, а не точная длительность голоса.</p>
      <div className="dm-table-scroll"><table><thead><tr><th scope="col">Участник</th><th scope="col">Реплики</th><th scope="col">Слова</th><th scope="col">Доля слов</th><th scope="col">Время реплик</th></tr></thead><tbody>{stats.map(s => <tr key={s.name}><th scope="row">{s.name}</th><td>{s.turns}</td><td>{s.words.toLocaleString("ru-RU")}</td><td><div className="dm-share"><span style={{ width: `${s.wordShare}%` }} /></div>{Math.round(s.wordShare)}%</td><td>{clock(s.seconds)}</td></tr>)}</tbody></table></div>
      <p className="dm-caption">Точных дублей исключено: {diagnostics.duplicates}. Технических отметок Quill: {diagnostics.technicalEvents} (это не число отдельных сбоев и не время простоя). {diagnostics.untimed > 0 && `Реплик без корректного времени: ${diagnostics.untimed}. `}Пересечения времени одного участника считаются один раз; одновременная речь разных людей сохраняется. Исходный текст не изменён.</p>
    </section>
    {report && <><section id="dm-scenes"><h3>Хронология и темп</h3><p className="dm-caption">Переходы между сценами по тексту. Метки относятся к записи, а не к игровому времени.</p>
      {report?.scenes.length ? <ol className="dm-scenes">{report.scenes.map((scene, i) => <li key={i}><h4>{scene.title}</h4><p>{scene.detail}</p>{sources(scene.sources)}</li>)}</ol> : <p className="session-muted">Сцены появятся после анализа. Пустоты записи не считаются паузами в игре автоматически.</p>}
    </section>
    {sections.map(section => <section id={`dm-${section.key}`} key={section.key}><h3>{section.title}</h3>{section.key === "interests" && <p className="dm-caption">Гипотезы по этой сессии — повод предложить сцену и спросить игрока, а не постоянный психологический профиль.</p>}
      {report?.findings.some(f => f.section === section.key) ? report.findings.filter(f => f.section === section.key).map((finding, i) => <div className="dm-finding" key={i}><div className="dm-finding-meta"><span className={`dm-basis ${finding.basis}`}>{basis[finding.basis]}</span>{finding.speaker && <strong>{finding.speaker}</strong>}{finding.status && <span>{status[finding.status]}</span>}</div><h4>{finding.title}</h4><p>{finding.detail}</p>{sources(finding.sources)}</div>) : <p className="session-muted">{report ? section.empty : "Раздел ещё не проанализирован."}</p>}
    </section>)}</> }
    {!!analysis?.uncertainties?.length && <section><h3>Неясности и ограничения</h3><ul>{analysis.uncertainties.map((item, i) => <li key={i}>{item}</li>)}</ul></section>}
    <footer className="dm-caption">Выводы AI могут ошибаться: проверяйте отмеченные источники. Предложения по подготовке не меняют события и сущности кампании. В печатном отчёте указаны номера строк исходного TXT.</footer>
  </article>;
}

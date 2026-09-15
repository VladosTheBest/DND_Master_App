import { combineTranscripts, maxImportBytes, type TranscriptFile } from "./session-import";
import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "../../app/api";
import { sessionsApi, type ImportedSession, type SourceRange, type SpeechKind } from "./sessions.api";
import { SessionJournal } from "./SessionJournal";
import { SessionRecap } from "./SessionRecap";
import { classifySpeech, journalKinds, overlapsSource, speechLabels } from "./session-journal";
import {
  highlightedParts,
  parseSessionText,
  speakerStatistics,
} from "./session-stats";
import "./sessions.css";

const colors = [
  "#b5a0ff",
  "#77d9bf",
  "#e8bc7a",
  "#f39ebd",
  "#83b9ed",
  "#b9d982",
];
const tabs = ["Обзор", "Хроника", "Локации", "Игроки", "Активность", "Полный текст"] as const;
type SessionTab = (typeof tabs)[number];
const dateLabel = (value: string) =>
  new Date(value).toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
  });
const duration = (seconds: number) =>
  seconds < 60
    ? `${Math.round(seconds)} сек`
    : `${Math.floor(seconds / 60)} мин ${Math.round(seconds % 60)} сек`;
const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : "Не удалось выполнить действие.";
const renderHighlight = (text: string, query: string) =>
  highlightedParts(text, query).map((part, i) =>
    part.match ? <mark key={i}>{part.text}</mark> : part.text,
  );
function BulletList({ items, empty }: { items?: string[]; empty: string }) {
  return items?.length ? (
    <ul className="session-bullets">
      {items.map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </ul>
  ) : (
    <p className="session-muted">{empty}</p>
  );
}

export function SessionsPage({
  campaignId,
  onOpenAI,
  onOpenProposal,
}: {
  campaignId: string;
  onOpenAI: () => void;
  onOpenProposal: (id: string) => void;
}) {
  const [sessions, setSessions] = useState<ImportedSession[]>([]),
    [selected, setSelected] = useState<ImportedSession | null>(null);
  const [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const [filter, setFilter] = useState(""),
    [query, setQuery] = useState(""),
    [tab, setTab] = useState<SessionTab>("Обзор"),
    [speaker, setSpeaker] = useState("");
  const [master, setMaster] = useState(""),
    [metric, setMetric] = useState<"words" | "time">("words"),
    [page, setPage] = useState(0);
  const [draft, setDraft] = useState<{
      text: string;
      title: string;
      files: TranscriptFile[];
    } | null>(null),
    [saving, setSaving] = useState(false),
    [busyId, setBusyId] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const [speechFilter, setSpeechFilter] = useState<SpeechKind | "all">("all");
  const [sourceFocus, setSourceFocus] = useState<SourceRange | null>(null);
  const [journalCategory, setJournalCategory] = useState("");
  const fileRef = useRef<HTMLInputElement>(null),
    currentId = useRef(""),
    loadVersion = useRef(0),
    mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const select = async (id: string) => {
    const version = ++loadVersion.current;
    currentId.current = id;
    setLoading(true);
    setError("");
    setSelected(null);
    setSpeaker("");
    setQuery("");
    setMaster("");
    setPage(0);
    setSpeechFilter("all");
    setSourceFocus(null);
    setJournalCategory("");
    setTab("Обзор");
    try {
      const session = await sessionsApi.get(campaignId, id);
      if (mounted.current && loadVersion.current === version) {
        setSelected(session);
        setMaster(localStorage.getItem(`session-gm:${campaignId}:${id}`) || "");
      }
    } catch (e) {
      if (mounted.current && loadVersion.current === version)
        setError(errorMessage(e));
    } finally {
      if (mounted.current && loadVersion.current === version) setLoading(false);
    }
  };
  useEffect(() => {
    let active = true;
    void sessionsApi
      .list(campaignId)
      .then((items) => {
        if (!active) return;
        setSessions(items);
        if (items[0]) void select(items[0].id);
        else setLoading(false);
      })
      .catch((e) => {
        if (active) {
          setError(errorMessage(e));
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [campaignId]);
  useEffect(() => {
    if (!busyId) return;
    setElapsed(0);
    const timer = window.setInterval(() => setElapsed((v) => v + 1), 1000);
    return () => clearInterval(timer);
  }, [busyId]);
  const entries = useMemo(
    () => parseSessionText(selected?.text || ""),
    [selected?.text],
  );
  const allStats = useMemo(() => speakerStatistics(entries), [entries]);
  const classifiedEntries = useMemo(() => entries.map(entry => ({ ...entry, speechKind: classifySpeech(entry, selected?.analysis?.journal?.speech) })), [entries, selected?.analysis?.journal]);
  const stats = useMemo(
    () => speakerStatistics(entries, master),
    [entries, master],
  );
  const activeSpeaker = speaker || allStats[0]?.name || "";
  const playerReport = selected?.analysis?.players?.find(
    (p) => p.name === activeSpeaker,
  );
  const filteredEntries = useMemo(
    () =>
      classifiedEntries.filter(
        (e) =>
          (tab !== "Игроки" || e.name === activeSpeaker) &&
          (speechFilter === "all" || e.speechKind === speechFilter) &&
          (!query.trim() ||
            `${e.name} ${e.text}`
              .toLocaleLowerCase()
              .includes(query.trim().toLocaleLowerCase())),
      ),
    [classifiedEntries, tab, activeSpeaker, query, speechFilter],
  );
  useEffect(() => {
    if (sourceFocus && tab === "Полный текст") {
      const frame = requestAnimationFrame(() => document.querySelector(".session-line.cited")?.scrollIntoView({ block: "center", behavior: "auto" }));
      return () => cancelAnimationFrame(frame);
    }
  }, [sourceFocus, tab, page]);
  const openSource = (source: SourceRange) => {
    setTab("Полный текст");
    setQuery("");
    setSpeechFilter("all");
    setSourceFocus(source);
    const index = entries.findIndex(entry => overlapsSource(entry, source));
    setPage(Math.floor(Math.max(0, index) / 50));
  };
  const sourceLabel = (source: SourceRange) => {
    const entry = entries.find(entry => overlapsSource(entry, source));
    return entry?.stamp ? `${entry.name} · ${entry.stamp}` : `Строки ${source.fromLine}–${source.toLine}`;
  };
  const visibleSessions = sessions.filter((s) =>
    `${s.number} ${s.title} ${s.analysis?.summary || ""} ${s.participants.join(" ")}`
      .toLocaleLowerCase()
      .includes(filter.toLocaleLowerCase()),
  );
  const readFiles = async (selectedFiles: File[]) => {
    if (!selectedFiles.length) return;
    setError("");
    setNotice("");
    try {
      if (selectedFiles.some(file => !/\.txt$/i.test(file.name)) || selectedFiles.reduce((sum, file) => sum + file.size, 0) > maxImportBytes)
        throw new Error("Выберите TXT-файлы общим размером до 4 МБ.");
      const files = await Promise.all(selectedFiles.map(async file => ({
        name: file.name,
        text: new TextDecoder("utf-8", { fatal: true }).decode(await file.arrayBuffer()),
      })));
      files.sort((a, b) => a.name.localeCompare(b.name, "ru", { numeric: true }));
      const text = combineTranscripts(files);
      const sourceDate = files[0].text.match(/^Quill — (\d{4}-\d{2}-\d{2})/);
      setDraft({ text, files, title: sourceDate ? `Игра ${dateLabel(sourceDate[1])}` : files[0].name.replace(/\.txt$/i, "") });
    } catch (e) {
      setError(errorMessage(e));
    }
  };
  const changeParts = (files: TranscriptFile[]) => {
    if (!draft) return;
    try {
      setDraft(files.length ? { ...draft, files, text: combineTranscripts(files) } : null);
      setError("");
    } catch (e) { setError(errorMessage(e)); }
  };
  const saveImport = async () => {
    if (!draft) return;
    setSaving(true);
    setError("");
    try {
      const result = await sessionsApi.import(
        campaignId,
        draft.title,
        draft.text,
      );
      setDraft(null);
      setSessions(await sessionsApi.list(campaignId));
      await select(result.session.id);
      setTab("Обзор");
      setNotice(
        result.duplicate
          ? "Этот текст уже импортирован — открыта существующая сессия."
          : "Сессия сохранена. Статистика готова; можно запустить AI-анализ.",
      );
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setSaving(false);
    }
  };
  const analyze = async () => {
    if (!selected || busyId) return;
    const id = selected.id;
    setBusyId(id);
    setError("");
    setNotice("");
    try {
      const connection = await api.getCodexConnectionStatus();
      if (connection.state !== "connected") {
        setNotice(
          "Подключите ChatGPT в панели AI, затем вернитесь и запустите анализ.",
        );
        onOpenAI();
        return;
      }
      const model = localStorage.getItem("dnd-master.codex-model") || undefined;
      const result = await api.runCodexPrompt({
        campaignId,
        sessionId: id,
        model,
        prompt: `Собери удобную хронику D&D: важные события, диалоги и договорённости, добычу (что нашли, взяли, потратили и у кого осталось), открытия (что изучили и узнали), встречи и отдельные итоги по каждой посещённой локации. Отдели события от планов, игровую речь от обсуждения за столом; неоднозначное помечай, не угадывай. Привяжи выводы к исходным репликам. Также подготовь действия участников, подсказки к следующей игре и проверяемые предложения изменений кампании.${master ? ` Мастер обозначен именем ${JSON.stringify(master)}; его описание мира является игровой речью, а не автоматически обсуждением за столом.` : " Мастер не указан, не угадывай роли участников."}`,
      });
      if (!mounted.current) return;
      setSessions(await sessionsApi.list(campaignId));
      const updated = await sessionsApi.get(campaignId, id);
      if (mounted.current && currentId.current === id) setSelected(updated);
      setNotice(
        result.warning ||
          "Анализ сохранён. Предложения изменений готовы к проверке.",
      );
    } catch (e) {
      if (mounted.current) setError(errorMessage(e));
    } finally {
      if (mounted.current) setBusyId("");
    }
  };
  const remove = async () => {
    if (!selected || busyId) return;
    if (
      !window.confirm(
        `Удалить «${selected.title}» из журнала сайта? Копия в Quill и сущности кампании останутся.`,
      )
    )
      return;
    setSaving(true);
    try {
      await sessionsApi.remove(campaignId, selected.id);
      const items = await sessionsApi.list(campaignId);
      setSessions(items);
      setSelected(null);
      currentId.current = "";
      if (items[0]) await select(items[0].id);
      setNotice("Сессия удалена из журнала.");
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setSaving(false);
    }
  };
  const download = () => {
    if (!selected) return;
    const url = URL.createObjectURL(
      new Blob([selected.text || ""], { type: "text/plain;charset=utf-8" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `session-${selected.number}.txt`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const transcript = (
    <div className="session-transcript">
      <div className="session-speech-filters" aria-label="Тип речи">
        {(["all", "game", "table", "uncertain"] as const).map(kind => <button key={kind} className={speechFilter === kind ? "active" : ""} aria-pressed={speechFilter === kind} onClick={() => { setSpeechFilter(kind); setPage(0); setSourceFocus(null); }}>{kind === "all" ? "Вся речь" : speechLabels[kind]} <small>{classifiedEntries.filter(entry => (tab !== "Игроки" || entry.name === activeSpeaker) && (kind === "all" || entry.speechKind === kind)).length}</small></button>)}
      </div>
      <p className="session-muted">{selected?.analysis?.journal ? "Разметка AI: повествование мастера тоже считается игрой. Смешанные и неразмеченные реплики — в «Неясно». Исходник сохраняется целиком." : "После обновления анализа появится разделение речи. Пока реплики находятся в «Неясно»."}</p>
      {sourceFocus && <details className="session-source-excerpt" open><summary>Источник · строки {sourceFocus.fromLine}–{sourceFocus.toLine}</summary><pre>{selected?.text?.split("\n").slice(sourceFocus.fromLine - 1, sourceFocus.toLine).join("\n")}</pre></details>}
      <div className="session-search-row">
        <label>
          <span className="sr-only">Поиск по расшифровке</span>
          <input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(0);
            }}
            placeholder="Найти слово или фразу…"
            type="search"
          />
        </label>
        <span aria-live="polite">{filteredEntries.length} реплик</span>
      </div>
      <div className="session-lines">
        {filteredEntries.slice(page * 50, (page + 1) * 50).map((entry, i) => (
          <article key={`${page}-${i}`} className={`session-line ${sourceFocus && overlapsSource(entry, sourceFocus) ? "cited" : ""}`}>
            <div>
              <strong>{entry.name}</strong>
              <time>{entry.stamp}</time>
              <span className={`session-speech-label ${entry.speechKind}`}>{speechLabels[entry.speechKind]}</span>
            </div>
            <p>{renderHighlight(entry.text, query)}</p>
          </article>
        ))}
        {!filteredEntries.length && (
          <p className="session-muted">
            Совпадений нет. Попробуйте другое слово.
          </p>
        )}
      </div>
      {filteredEntries.length > 50 && (
        <div className="session-paging">
          <button
            className="ghost"
            disabled={!page}
            onClick={() => setPage((p) => p - 1)}
          >
            ← Назад
          </button>
          <span>
            {page + 1} / {Math.ceil(filteredEntries.length / 50)}
          </span>
          <button
            className="ghost"
            disabled={(page + 1) * 50 >= filteredEntries.length}
            onClick={() => setPage((p) => p + 1)}
          >
            Далее →
          </button>
        </div>
      )}
    </div>
  );
  return (
    <div className="sessions-page">
      <header className="sessions-heading">
        <div>
          <span className="session-eyebrow">ХРОНИКИ КАМПАНИИ</span>
          <h1>
            Сессии<span>{sessions.length}</span>
          </h1>
          <p>Всё, что случилось за игровым столом.</p>
        </div>
        <button
          className="primary session-import-btn"
          onClick={() => fileRef.current?.click()}
        >
          ＋ Импортировать текст
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".txt,text/plain"
          multiple
          hidden
          onChange={(e) => {
            void readFiles(Array.from(e.target.files || []));
            e.target.value = "";
          }}
        />
      </header>
      {error && (
        <div className="session-alert error" role="alert">
          {error}
        </div>
      )}
      {notice && (
        <div className="session-alert" role="status">
          {notice}
        </div>
      )}
      {busyId && (
        <div className="session-analyzing" role="status">
          <span className="session-orbit" />
          <div>
            <strong>AI читает сессию и контекст кампании</strong>
            <p>
              Собирает хронику, локации и разделяет игровую речь ·{" "}
              {Math.floor(elapsed / 60)}:{String(elapsed % 60).padStart(2, "0")}
            </p>
          </div>
        </div>
      )}
      {draft && (
        <section className="session-import-card">
          <div>
            <span className="session-eyebrow">НОВАЯ ЗАПИСЬ</span>
            <h2>Импорт из Quill</h2>
            <p>
              {draft.files.length} файл(ов) → 1 сессия · {Math.ceil(new Blob([draft.text]).size / 1024)}{" "}
              КБ · {speakerStatistics(parseSessionText(draft.text)).length}{" "}
              участников
            </p>
          </div>
          <ol className="session-import-parts">
            {draft.files.map((file, index) => (
              <li key={`${index}-${file.name}`}>
                <span>{file.name}</span>
                <button disabled={saving || index === 0} aria-label={`Выше: ${file.name}`} onClick={() => {
                  const files = [...draft.files];
                  [files[index - 1], files[index]] = [files[index], files[index - 1]];
                  changeParts(files);
                }}>↑</button>
                <button disabled={saving || index === draft.files.length - 1} aria-label={`Ниже: ${file.name}`} onClick={() => {
                  const files = [...draft.files];
                  [files[index + 1], files[index]] = [files[index], files[index + 1]];
                  changeParts(files);
                }}>↓</button>
                <button disabled={saving} aria-label={`Убрать: ${file.name}`} onClick={() => changeParts(draft.files.filter((_, i) => i !== index))}>Убрать</button>
              </li>
            ))}
          </ol>
          <p className="session-muted">Можно выбрать несколько TXT сразу (Ctrl или Shift). Части идут в порядке списка — поменяйте его стрелками. Время реплик продолжится между частями, без пауз между файлами. Общий размер — до 4 МБ.</p>
          <label>
            Название сессии
            <input
              autoFocus
              maxLength={160}
              value={draft.title}
              onChange={(e) => setDraft({ ...draft, title: e.target.value })}
            />
          </label>
          <p className="session-muted">
            Сохраним полный текст в этой кампании. Нейросеть получит его только
            после нажатия «Анализировать».
          </p>
          <div className="session-actions">
            <button
              className="primary"
              disabled={saving || !draft.title.trim()}
              onClick={() => void saveImport()}
            >
              {saving ? "Сохраняем…" : "Сохранить в журнал"}
            </button>
            <button
              className="ghost"
              disabled={saving}
              onClick={() => setDraft(null)}
            >
              Отмена
            </button>
          </div>
        </section>
      )}
      <div className="sessions-layout">
        <aside className="session-journal">
          <label>
            <span className="sr-only">Поиск сессий</span>
            <input
              type="search"
              placeholder="Найти сессию, игрока…"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            />
          </label>
          <div className="session-journal-list">
            {visibleSessions.map((s) => (
              <button
                key={s.id}
                className={`session-journal-item ${currentId.current === s.id ? "selected" : ""}`}
                onClick={() => void select(s.id)}
              >
                <span className="session-number">
                  СЕССИЯ {s.number || ""}
                  <time>{dateLabel(s.importedAt)}</time>
                </span>
                <strong>{s.title}</strong>
                <p>
                  {s.analysis?.summary ||
                    "Текст сохранён. Итоги появятся после анализа."}
                </p>
                <span className={`session-badge ${s.analysis ? "ready" : ""}`}>
                  {s.analysis
                    ? "✓ Итоги готовы"
                    : `${s.participants.length || "—"} участников`}
                </span>
              </button>
            ))}
          </div>
          {!visibleSessions.length && (
            <p className="session-muted">
              {filter
                ? "Ничего не найдено"
                : "Здесь появится история ваших игр."}
            </p>
          )}
        </aside>
        <main className="session-workspace">
          {loading ? (
            <div className="session-empty" role="status">
              Загружаем журнал…
            </div>
          ) : !selected ? (
            <div className="session-empty">
              <div className="session-empty-icon">✦</div>
              <h2>Первая страница вашей истории</h2>
              <p>
                В Quill откройте сессию и нажмите «Сохранить текст». Затем
                импортируйте полученный TXT-файл сюда.
              </p>
              <button
                className="primary"
                onClick={() => fileRef.current?.click()}
              >
                Выбрать текст сессии
              </button>
            </div>
          ) : (
            <>
              <header className="session-detail-heading">
                <div>
                  <span className="session-eyebrow">
                    СЕССИЯ {selected.number} · {dateLabel(selected.importedAt)}
                  </span>
                  <h2>{selected.title}</h2>
                  <div className="session-avatars">
                    {allStats.map((s, i) => (
                      <span
                        key={s.name}
                        title={s.name}
                        style={{
                          background: colors[i % colors.length],
                          color: "#181525",
                        }}
                      >
                        {s.name.slice(0, 1).toUpperCase()}
                      </span>
                    ))}
                    <small>
                      {allStats.length} участников · {entries.length} реплик
                    </small>
                  </div>
                </div>
                <button
                  className="primary"
                  disabled={!!busyId}
                  onClick={() => void analyze()}
                >
                  {busyId === selected.id
                    ? "Анализируем…"
                    : selected.analysis
                      ? "Обновить анализ"
                      : "✦ Анализировать"}
                </button>
              </header>
              <nav className="session-tabs" aria-label="Разделы сессии">
                {tabs.map((t) => (
                  <button
                    key={t}
                    aria-current={tab === t ? "page" : undefined}
                    className={tab === t ? "active" : ""}
                    onClick={() => {
                      setTab(t);
                      setJournalCategory("");
                      setPage(0);
                    }}
                  >
                    {t}
                  </button>
                ))}
              </nav>
              <div className="session-tab-content" key={tab}>
                {tab === "Обзор" && (
                  <>
                    <SessionRecap analysis={selected.analysis} busy={!!busyId} onAnalyze={() => void analyze()} />
                    <div className="session-detail-intro"><h3>Подробнее о приключении</h3><p className="session-muted">Выберите раздел: внутри — детали и ссылки на исходные реплики.</p></div>
                    <div className="session-overview-categories">
                      {journalKinds.map(category => <button key={category.id} onClick={() => { setJournalCategory(category.id); setTab("Хроника"); }}><span>{category.icon}</span><strong>{selected.analysis?.journal?.entries.filter(entry => entry.kind === category.id).length ?? "—"}</strong><small>{category.label}</small></button>)}
                      <button onClick={() => setTab("Локации")}><span>⌖</span><strong>{selected.analysis?.journal?.locations.length ?? "—"}</strong><small>Локации</small></button>
                    </div>
                    <div className="session-two-columns">
                      <section className="session-card">
                        <h3>Ключевые события</h3>
                        <BulletList
                          items={selected.analysis?.keyEvents}
                          empty="Здесь будут важные повороты истории и решения партии."
                        />
                      </section>
                      <section className="session-card">
                        <h3>К следующей игре</h3>
                        <BulletList
                          items={selected.analysis?.nextSession}
                          empty="Здесь появятся зацепки и рекомендации мастеру."
                        />
                      </section>
                    </div>
                    <section className="session-card">
                      <div className="session-card-heading">
                        <h3>Изменения в кампании</h3>
                        <button className="ghost" onClick={onOpenAI}>
                          Все AI-предложения ↗
                        </button>
                      </div>
                      <p className="session-muted">
                        Просмотрите изменения перед применением к квестам,
                        локациям и другим сущностям.
                      </p>
                      <div className="session-actions">
                        {selected.analysis?.proposalIds?.map((id, i) => (
                          <button
                            className="session-proposal"
                            key={id}
                            onClick={() => onOpenProposal(id)}
                          >
                            Предложение {i + 1} <span>Проверить →</span>
                          </button>
                        ))}
                      </div>
                      {selected.analysis &&
                        !selected.analysis.proposalIds?.length && (
                          <p className="session-muted">
                            Анализ не создал предложений изменений.
                          </p>
                        )}
                    </section>
                    {!!selected.analysis?.uncertainties?.length && (
                      <section className="session-card">
                        <h3>Что стоит уточнить</h3>
                        <BulletList
                          items={selected.analysis.uncertainties}
                          empty=""
                        />
                      </section>
                    )}
                  </>
                )}
                {(tab === "Хроника" || tab === "Локации") && <SessionJournal key={`${selected.id}:${tab}`} journal={selected.analysis?.journal} byLocation={tab === "Локации"} onSource={openSource} sourceLabel={sourceLabel} onAnalyze={() => void analyze()} busy={!!busyId} initialKind={tab === "Хроника" ? journalCategory : ""} />}
                {tab === "Игроки" && (
                  <>
                    <div className="session-player-tabs" aria-label="Участники">
                      {allStats.map((s, i) => (
                        <button
                          key={s.name}
                          className={activeSpeaker === s.name ? "active" : ""}
                          onClick={() => {
                            setSpeaker(s.name);
                            setPage(0);
                          }}
                        >
                          <span
                            style={{ background: colors[i % colors.length] }}
                          />
                          {s.name}
                        </button>
                      ))}
                    </div>
                    <div className="session-two-columns">
                      <section className="session-card">
                        <h3>Что сделал {activeSpeaker}</h3>
                        <BulletList
                          items={playerReport?.actions}
                          empty="AI выделит действия игрока после анализа сессии."
                        />
                      </section>
                      <section className="session-card">
                        <h3>Запоминающиеся моменты</h3>
                        <BulletList
                          items={playerReport?.moments}
                          empty="Здесь появятся важные решения и яркие эпизоды."
                        />
                      </section>
                    </div>
                    {playerReport?.nextSessionFocus && (
                      <div className="session-player-focus">
                        <strong>На следующей встрече</strong>
                        <p>{playerReport.nextSessionFocus}</p>
                      </div>
                    )}
                    <h3>Реплики участника</h3>
                    {transcript}
                  </>
                )}
                {tab === "Активность" && (
                  <>
                    <div className="session-stat-controls">
                      <label>
                        Мастер
                        <select
                          aria-label="Мастер"
                          value={master}
                          onChange={(e) => {
                            setMaster(e.target.value);
                            localStorage.setItem(
                              `session-gm:${campaignId}:${selected.id}`,
                              e.target.value,
                            );
                          }}
                        >
                          <option value="">Не указан — все участники</option>
                          {allStats.map((s) => (
                            <option key={s.name}>{s.name}</option>
                          ))}
                        </select>
                      </label>
                      <label>
                        Сравнивать по
                        <select
                          aria-label="Сравнивать по"
                          value={metric}
                          onChange={(e) =>
                            setMetric(e.target.value as "words" | "time")
                          }
                        >
                          <option value="words">Количеству слов</option>
                          <option
                            value="time"
                            disabled={!stats.some((s) => s.seconds)}
                          >
                            Времени речи
                          </option>
                        </select>
                      </label>
                    </div>
                    <section className="session-card">
                      <span className="session-eyebrow">
                        РАСПРЕДЕЛЕНИЕ ГОЛОСОВ
                      </span>
                      <h3>Доля речи {master ? "игроков" : "участников"}</h3>
                      <p className="session-muted">
                        {metric === "words"
                          ? "Процент от всех распознанных слов."
                          : "Процент от суммы времени речи участников; одновременная речь учитывается у каждого."}{" "}
                        {master
                          ? "Мастер исключён из расчёта."
                          : "Выберите мастера, чтобы сравнить только игроков."}
                      </p>
                      <div className="session-stat-list">
                        {stats.map((s, i) => (
                          <div className="session-stat" key={s.name}>
                            <div>
                              <strong>{s.name}</strong>
                              <b>
                                {(metric === "words"
                                  ? s.wordShare
                                  : s.timeShare
                                ).toFixed(1)}
                                %
                              </b>
                            </div>
                            <div className="session-stat-track">
                              <span
                                style={{
                                  width: `${metric === "words" ? s.wordShare : s.timeShare}%`,
                                  background: colors[i % colors.length],
                                }}
                              />
                            </div>
                            <small>
                              {s.words.toLocaleString("ru-RU")} слов · {s.turns}{" "}
                              реплик ·{" "}
                              {s.seconds
                                ? duration(s.seconds)
                                : "нет временных меток"}
                            </small>
                          </div>
                        ))}
                      </div>
                    </section>
                    <div className="session-note">
                      <strong>Ориентир для мастера, а не оценка игрока</strong>
                      <p>
                        Доля речи не измеряет интерес или вовлечённость: игрок
                        может внимательно слушать и активно действовать
                        короткими репликами. Используйте эту статистику, чтобы
                        заметить распределение разговора и предложить каждому
                        пространство для игры. Время приблизительное, по меткам
                        расшифровки. Участники без распознанных реплик в
                        статистику не попадают.
                      </p>
                    </div>
                  </>
                )}
                {tab === "Полный текст" && (
                  <>
                    <div className="session-card-heading">
                      <p className="session-muted">
                        Имена и время из расшифровки Quill. Исходный файл
                        сохранён целиком.
                      </p>
                      <button className="ghost" onClick={download}>
                        Скачать TXT ↓
                      </button>
                    </div>
                    {transcript}
                  </>
                )}
              </div>
              <footer className="session-footer">
                <span>
                  {selected.analysis
                    ? `AI-анализ · ${dateLabel(selected.analysis.generatedAt)}`
                    : "Текст сохранён в кампании"}
                </span>
                <button
                  className="ghost"
                  disabled={saving || !!busyId}
                  onClick={() => void remove()}
                >
                  Удалить из журнала
                </button>
              </footer>
            </>
          )}
        </main>
      </div>
    </div>
  );
}

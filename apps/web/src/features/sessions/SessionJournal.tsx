import { useState } from "react";
import type { SessionJournal as Journal, SourceRange } from "./sessions.api";
import { filterJournal, journalKinds } from "./session-journal";

const statusLabels = { confirmed: "Произошло", planned: "Только план", uncertain: "Нужно уточнить" };

export function SessionJournal({ journal, byLocation, onSource, sourceLabel, onAnalyze, busy, initialKind = "" }: {
  journal?: Journal;
  byLocation: boolean;
  onSource: (source: SourceRange) => void;
  sourceLabel: (source: SourceRange) => string;
  onAnalyze: () => void;
  busy: boolean;
  initialKind?: string;
}) {
  const [kind, setKind] = useState(initialKind);
  const [location, setLocation] = useState("");
  const [status, setStatus] = useState("");
  const [query, setQuery] = useState("");
  if (!journal) return (
    <section className="session-empty session-journal-empty">
      <span className="session-empty-icon">✦</span>
      <h3>Соберём приключение по главам</h3>
      <p>События, важные диалоги, добыча, открытия и встречи — отдельно для каждого места. Обновите анализ, чтобы добавить хронику и разделение игровой речи.</p>
      <button className="primary" disabled={busy} onClick={onAnalyze}>✦ Собрать хронику</button>
    </section>
  );
  const activeLocation = journal.locations.find(item => item.id === location);
  const entries = filterJournal(journal.entries, { kind, location, status, query });
  const sources = (ranges: SourceRange[]) => (
    <div className="session-evidence" aria-label="Места в расшифровке">
      {ranges.map((source, index) => <button className="ghost" key={index} onClick={() => onSource(source)}>↗ {sourceLabel(source)}</button>)}
    </div>
  );
  return (
    <div className="session-chronicle">
      <div className="session-card-heading">
        <div><span className="session-eyebrow">{byLocation ? "МАРШРУТ ПАРТИИ" : "ИТОГИ ПРИКЛЮЧЕНИЯ"}</span><h3>{byLocation ? "Где мы были" : "Что стоит запомнить"}</h3></div>
        <span className="session-muted">{journal.entries.length} записей · {journal.locations.length} локаций</span>
      </div>
      {byLocation && <div className="session-location-grid" aria-label="Посещённые локации">
        <button className={`session-location ${!location ? "active" : ""}`} aria-pressed={!location} onClick={() => setLocation("")}><span>ВЕСЬ ПУТЬ</span><strong>Все локации</strong><small>Общая история путешествия</small></button>
        {journal.locations.map((place, index) => <button key={place.id} className={`session-location ${place.id === location ? "active" : ""}`} aria-pressed={place.id === location} onClick={() => setLocation(place.id)}><span>МЕСТО {index + 1}</span><strong>{place.name}</strong><small>{journal.entries.filter(entry => entry.locationId === place.id).length} записей</small></button>)}
        {journal.entries.some(entry => !entry.locationId) && <button className={`session-location ${location === "__unknown" ? "active" : ""}`} aria-pressed={location === "__unknown"} onClick={() => setLocation("__unknown")}><span>БЕЗ ПРИВЯЗКИ</span><strong>Место не установлено</strong><small>Без догадок о локации</small></button>}
      </div>}
      {activeLocation && <section className="session-summary-card"><span className="session-eyebrow">ГЛАВА ПУТЕШЕСТВИЯ</span><h3>{activeLocation.name}</h3><p>{activeLocation.summary}</p>{sources(activeLocation.sources)}</section>}
      <div className="session-category-tabs" aria-label="Раздел хроники">
        <button className={!kind ? "active" : ""} aria-pressed={!kind} onClick={() => setKind("")}>Всё</button>
        {journalKinds.map(category => <button key={category.id} className={kind === category.id ? "active" : ""} aria-pressed={kind === category.id} onClick={() => setKind(category.id)}>{category.icon} {category.label} <small>{filterJournal(journal.entries, { location, kind: category.id }).length}</small></button>)}
      </div>
      <div className="session-chronicle-filters">
        <label><span>Поиск по хронике</span><input type="search" placeholder="Имя, предмет, обещание…" value={query} onChange={event => setQuery(event.target.value)} /></label>
        {!byLocation && <label><span>Локация</span><select value={location} onChange={event => setLocation(event.target.value)}><option value="">Все локации</option>{journal.locations.map(place => <option key={place.id} value={place.id}>{place.name}</option>)}<option value="__unknown">Место не установлено</option></select></label>}
        <label><span>Достоверность</span><select value={status} onChange={event => setStatus(event.target.value)}><option value="">Все записи</option><option value="confirmed">Произошло</option><option value="planned">Только планы</option><option value="uncertain">Нужно уточнить</option></select></label>
      </div>
      <p className="session-muted">AI отделяет произошедшее от намерений. Откройте источник у карточки, чтобы проверить детали.</p>
      <div className="session-journal-cards" aria-live="polite">
        {entries.map(entry => <article className={`session-card session-journal-card ${entry.kind}`} key={entry.id}>
          <div className="session-entry-meta"><span className="session-eyebrow">{journalKinds.find(category => category.id === entry.kind)?.label}</span><span className={`session-fact-status ${entry.status}`}>{statusLabels[entry.status]}</span></div>
          <h3>{entry.title}</h3><p>{entry.detail}</p>
          <div className="session-entry-context">{entry.locationId && <button className="ghost" onClick={() => setLocation(entry.locationId!)}>⌖ {journal.locations.find(place => place.id === entry.locationId)?.name}</button>}{!!entry.people.length && <span>{entry.people.join(" · ")}</span>}</div>
          {sources(entry.sources)}
        </article>)}
        {!entries.length && <section className="session-card"><h3>Пока нет записей</h3><p className="session-muted">Для выбранных фильтров ничего не найдено. Пустой раздел также может означать, что в тексте нет подтверждённых сведений.</p><button className="ghost" onClick={() => { setKind(""); setStatus(""); setQuery(""); setLocation(""); }}>Сбросить фильтры</button></section>}
      </div>
    </div>
  );
}

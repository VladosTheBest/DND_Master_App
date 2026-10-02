import {
  useMemo,
  useState,
  useEffect,
  type MouseEvent as ReactMouseEvent
} from "react";
import type {
  KnowledgeEntity,
  LocationEntity,
  WorldEvent,
  WorldEventDialogueBranch,
  WorldEventInput,
  WorldEventType
} from "@shadow-edge/shared-types";
import {
  NEW_LORE_NOTE_ID,
  NEW_WORLD_EVENT_ID,
  badge,
  EntityVisual,
  loreNoteExcerpt,
  matchesEntityDirectorySearch,
  resolveLoreNoteTitle,
  truncateInlineText,
  worldEventExcerpt,
  worldEventTypeLabels,
  worldEventTypeOptions,
  worldEventTypeTones
} from "./app-shared";
import "./features/events/events.css";

type LoreNoteEntity = Extract<KnowledgeEntity, { kind: "lore" }>;

export function EventSceneCard({ event, onOpenLocation }: { event: WorldEventInput; onOpenLocation?: (id: string) => void }) {
  const loot = (event.loot ?? []).filter((value) => value.trim());
  const branches = (event.dialogueBranches ?? []).filter((branch) => branch.lines?.some((line) => line.trim()) || branch.outcome?.trim());
  return <article className="event-scene-card">
    <div className="event-scene-meta"><span className={badge(worldEventTypeTones[event.type])}>{worldEventTypeLabels[event.type]}</span>{event.date ? <span>{event.date}</span> : null}{event.locationLabel ? <button className="ghost" disabled={!onOpenLocation || !event.locationId} onClick={() => event.locationId && onOpenLocation?.(event.locationId)} type="button">{event.locationLabel}</button> : null}</div>
    <h2>{event.title.trim() || "Новая сцена"}</h2>
    {event.summary ? <p className="event-scene-summary">{event.summary}</p> : null}
    <section className="event-read-aloud"><p className="eyebrow">{event.tags?.includes("gm-event") ? "Только для мастера · Краткий экскурс" : "Сцена за столом"}</p><div>{event.sceneText || "Текст сцены пока не добавлен."}</div></section>
    {branches.length ? <section className="event-outcomes"><h3>Варианты развития</h3>{branches.map((branch, index) => <details key={index} open={index === 0}><summary>{branch.title || `Вариант ${index + 1}`}</summary>{branch.lines?.length ? <ul>{branch.lines.filter(Boolean).map((line, lineIndex) => <li key={lineIndex}>{line}</li>)}</ul> : null}{branch.outcome ? <p><strong>Результат: </strong>{branch.outcome}</p> : null}</details>)}</section> : null}
    {loot.length ? <section className="event-rewards"><h3>{event.tags?.includes("gm-event") ? "Что могут получить игроки" : "Награды и находки"}</h3><ul>{loot.map((item, index) => <li key={index}>{item}</li>)}</ul></section> : null}
  </article>;
}

export function EventsWorkspace({
  events,
  locations,
  searchQuery,
  selectedEventId,
  draftId,
  draft,
  saving,
  generating,
  notice,
  error,
  onSearchChange,
  onSelectEvent,
  onCreateEvent,
  onOpenGenerator,
  onSave,
  onDelete,
  onOpenLocation,
  onDraftChange,
  onBranchChange,
  onAddBranch,
  onRemoveBranch,
  onLootChange,
  onAddLoot,
  onRemoveLoot,
  readOnly = false,
  dirty = false
}: {
  events: WorldEvent[];
  locations: LocationEntity[];
  searchQuery: string;
  selectedEventId: string;
  draftId: string;
  draft: WorldEventInput;
  saving: boolean;
  generating: boolean;
  notice: string;
  error: string;
  onSearchChange: (value: string) => void;
  onSelectEvent: (eventId: string) => void;
  onCreateEvent: () => void;
  onOpenGenerator: (generationMode: "read_aloud" | "gm_event") => void;
  onSave: () => void;
  onDelete: () => void;
  onOpenLocation: (locationId: string) => void;
  onDraftChange: (updater: (current: WorldEventInput) => WorldEventInput) => void;
  onBranchChange: (index: number, updater: (current: WorldEventDialogueBranch) => WorldEventDialogueBranch) => void;
  onAddBranch: () => void;
  onRemoveBranch: (index: number) => void;
  onLootChange: (index: number, value: string) => void;
  onAddLoot: () => void;
  onRemoveLoot: (index: number) => void;
  readOnly?: boolean;
  dirty?: boolean;
}) {
  const [directoryOpen, setDirectoryOpen] = useState(false);
  const [typeFilter, setTypeFilter] = useState("");
  const [locationFilter, setLocationFilter] = useState("");
  const [editing, setEditing] = useState(draftId === NEW_WORLD_EVENT_ID);
  useEffect(() => { setEditing(draftId === NEW_WORLD_EVENT_ID); }, [draftId]);
  const normalizedQuery = searchQuery.trim().toLowerCase();
  const filteredEvents = useMemo(
    () =>
      events.filter((event) => (!typeFilter || event.type === typeFilter) && (!locationFilter || event.locationId === locationFilter)).filter((event) =>
        !normalizedQuery
          ? true
          : [
              event.title,
              event.summary,
              event.sceneText,
              event.locationLabel ?? "",
              worldEventTypeLabels[event.type],
              event.loot.join(" "),
              event.tags.join(" ")
            ]
              .join(" ")
              .toLowerCase()
              .includes(normalizedQuery)
      ),
    [events, normalizedQuery, typeFilter, locationFilter]
  );
  const selectedLocation = draft.locationId ? locations.find((location) => location.id === draft.locationId) ?? null : null;
  const resolvedLoot = (draft.loot ?? []).filter((item) => item.trim());
  const isDraft = draftId === NEW_WORLD_EVENT_ID;

  return (
    <div className={`notes-workspace events-workspace ${readOnly ? "events-workspace-readonly" : ""}`.trim()}>
      <section className="card notes-workspace-head">
        <div className="notes-workspace-copy">
          <p className="eyebrow">События</p>
          <h1>События и сцены</h1>
          <p className="notes-workspace-copy">
            Короткие эпизоды для игры: место действия, текст сцены и возможные последствия.
          </p>
        </div>
        {!readOnly ? <div className="actions">
          <button className="ghost" onClick={onCreateEvent} type="button">
            Новое событие
          </button>
          <button className="primary" onClick={() => onOpenGenerator("gm_event")} type="button">Случайное событие</button>
          <button className="ghost" onClick={() => onOpenGenerator("read_aloud")} type="button">Зачитка с AI</button>

        </div> : null}
      </section>

      {!readOnly ? <button className="ghost event-directory-toggle" aria-expanded={directoryOpen} aria-controls="events-directory" onClick={() => setDirectoryOpen((current) => !current)} type="button">{directoryOpen ? "Свернуть список" : "Выбрать событие"}<span>{events.length}</span></button> : null}
      <div className="notes-workspace-grid events-workspace-grid">
        {!readOnly ? <aside id="events-directory" className={`card notes-directory-panel ${directoryOpen ? "directory-open" : ""}`}>
          <div className="row">
            <strong>Все события</strong>
            <small>{filteredEvents.length}</small>
          </div>

          <label className="field">
            <span>Поиск</span>
            <input
              className="input"
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder="Искать сценку, лут или тип..."
              value={searchQuery}
            />
          </label>

          <div className="event-directory-filters">
            <label className="field"><span>Тип события</span><select className="input" value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}><option value="">Все типы</option>{worldEventTypeOptions.map((type) => <option key={type} value={type}>{worldEventTypeLabels[type]}</option>)}</select></label>
            <label className="field"><span>Место</span><select className="input" value={locationFilter} onChange={(event) => setLocationFilter(event.target.value)}><option value="">Все локации</option>{locations.map((location) => <option key={location.id} value={location.id}>{location.title}</option>)}</select></label>
          </div>
          <div className="notes-list">
            {isDraft ? <button
              className="notes-list-item selected unsaved"
              onClick={onCreateEvent}
              type="button"
            >
              <span className="notes-list-item-copy">
                <strong>Новый черновик</strong>
                <small>Ручная сценка</small>
                <p>Добавь описание и сохрани сцену в кампанию.</p>
              </span>
            </button> : null}

            {filteredEvents.length ? (
              filteredEvents.map((event) => (
                <button
                  key={event.id}
                  className={`notes-list-item ${selectedEventId === event.id ? "selected" : ""}`}
                  onClick={() => { onSelectEvent(event.id); setDirectoryOpen(false); }}
                  type="button"
                >
                  <span className="notes-list-item-copy">
                    <div className="row">
                      <strong>{event.title}</strong>
                      <span className={badge(worldEventTypeTones[event.type])}>{worldEventTypeLabels[event.type]}</span>
                    </div>
                    <small>
                      {event.locationLabel ? `${event.locationLabel} • ` : ""}
                      {event.date || (event.origin === "ai" ? "AI" : "Ручное")}
                    </small>
                    <p>{worldEventExcerpt(event, 110)}</p>
                  </span>
                </button>
              ))
            ) : (
              <div className="notes-empty-state">
                <strong>{events.length ? "Ничего не найдено" : "Первая сцена"}</strong>
                <span>{events.length ? "Измени поиск или фильтры." : "Создай событие вручную или с AI, чтобы подготовить эпизод для игры."}</span>
              </div>
            )}
          </div>
        </aside> : null}

        <section className="card notes-editor-panel events-editor-panel">
          <div className="notes-editor-head">
            <div className="stack tight">
              <div className="row">
                <strong>{editing ? draft.title.trim() || "Новое событие" : "Просмотр сцены"}</strong>
                {editing ? <span className={badge(worldEventTypeTones[draft.type])}>{worldEventTypeLabels[draft.type]}</span> : null}
              </div>
              {editing ? <small className="copy">{selectedLocation ? `Место действия: ${selectedLocation.title}.` : "Место действия можно указать ниже."}</small> : null}
            </div>
            {!readOnly ? <div className="actions event-editor-actions">
              <small className={dirty ? "event-unsaved" : "copy"}>{dirty ? "Есть несохранённые изменения" : isDraft ? "Новая сцена" : "Сохранено"}</small>
              {!isDraft ? <button className="ghost" onClick={() => setEditing((current) => !current)} type="button">{editing ? "Просмотреть" : "Редактировать"}</button> : null}
              {(editing || dirty) ? <button className="primary" disabled={saving || generating || (!dirty && !isDraft)} onClick={onSave} type="button">{saving ? "Сохраняю…" : "Сохранить событие"}</button> : null}
            </div> : null}
          </div>

          {notice ? <div className="notes-status notes-status-success">{notice}</div> : null}
          {error ? <div className="notes-status notes-status-error">{error}</div> : null}

          {readOnly || !editing ? <EventSceneCard event={draft} onOpenLocation={onOpenLocation} /> : <>
          <div className="form-grid">
            <label className="field">
              <span>Название</span>
              <input
                className="input notes-title-input"
                disabled={readOnly}
                onChange={(event) => onDraftChange((current) => ({ ...current, title: event.target.value }))}
                placeholder="Например: Торговец-сквернослов"
                value={draft.title}
              />
            </label>

            <label className="field">
              <span>Дата в мире</span>
              <input
                className="input"
                disabled={readOnly}
                onChange={(event) => onDraftChange((current) => ({ ...current, date: event.target.value }))}
                placeholder="17 Nightal, 1492 DR"
                value={draft.date ?? ""}
              />
            </label>

            <label className="field">
              <span>Локация</span>
              <select
                className="input"
                disabled={readOnly}
                onChange={(event) =>
                  onDraftChange((current) => ({
                    ...current,
                    locationId: event.target.value,
                    locationLabel: locations.find((location) => location.id === event.target.value)?.title ?? ""
                  }))
                }
                value={draft.locationId ?? ""}
              >
                <option value="">Без привязки</option>
                {locations.map((location) => (
                  <option key={location.id} value={location.id}>
                    {location.title}
                  </option>
                ))}
              </select>
            </label>

            <label className="field">
              <span>Тип</span>
              <select
                className="input"
                disabled={readOnly}
                onChange={(event) => onDraftChange((current) => ({ ...current, type: event.target.value as WorldEventType }))}
                value={draft.type}
              >
                {worldEventTypeOptions.map((type) => (
                  <option key={type} value={type}>
                    {worldEventTypeLabels[type]}
                  </option>
                ))}
              </select>
            </label>

            <label className="field field-full">
              <span>Коротко о сцене</span>
              <textarea
                className="input textarea"
                disabled={readOnly}
                onChange={(event) => onDraftChange((current) => ({ ...current, summary: event.target.value }))}
                placeholder="Один короткий абзац: что это за сценка и почему партии не всё равно."
                value={draft.summary}
              />
            </label>
          </div>

          <label className="field notes-editor-field">
            <span>{draft.tags?.includes("gm-event") ? "Памятка мастеру (скрытые детали)" : "Текст сцены"}</span>
            <textarea
              className="input textarea notes-editor-textarea event-scene-textarea"
              disabled={readOnly}
              onChange={(event) => onDraftChange((current) => ({ ...current, sceneText: event.target.value }))}
              placeholder="Что происходит прямо сейчас, кто начинает сцену, чем она цепляет игроков и куда может качнуться."
              value={draft.sceneText}
            />
          </label>

          <details className="event-optional"><summary>Награды и находки · {resolvedLoot.length}</summary>
          <section className="card mini event-editor-block">
            <div className="row">
              <strong>Что можно получить</strong>
              <small>{resolvedLoot.length}</small>
            </div>
            <div className="stack tight">
              {(draft.loot ?? []).map((item, index) => (
                <div key={`loot-${index}`} className="event-loot-row">
                  <input
                    className="input"
                    disabled={readOnly}
                    onChange={(event) => onLootChange(index, event.target.value)}
                    placeholder={index === 0 ? "15 зм" : "Предмет, пропуск или полезный слух"}
                    value={item}
                  />
                  {!readOnly ? (
                    <button className="ghost" onClick={() => onRemoveLoot(index)} type="button">
                      Убрать
                    </button>
                  ) : null}
                </div>
              ))}
            </div>
            {!readOnly ? <div className="actions">
              <button className="ghost" onClick={onAddLoot} type="button">
                Добавить находку
              </button>
            </div> : null}
          </section>
          </details>
          <details className="event-optional"><summary>Варианты развития · {(draft.dialogueBranches ?? []).length}</summary>
          <section className="stack event-branch-list">
            <div className="row">
              <strong>Варианты развития</strong>
              {!readOnly ? (
                <button className="ghost" onClick={onAddBranch} type="button">
                  Добавить вариант
                </button>
              ) : null}
            </div>

            {(draft.dialogueBranches ?? []).map((branch, index) => (
              <article key={`branch-${index}`} className="card mini event-branch-card">
                <div className="row">
                  <span className={badge("accent")}>Ветка {index + 1}</span>
                  {!readOnly ? (
                    <button className="ghost" onClick={() => onRemoveBranch(index)} type="button">
                      Убрать
                    </button>
                  ) : null}
                </div>

                <div className="form-grid">
                  <label className="field">
                    <span>Заголовок</span>
                    <input
                      className="input"
                      disabled={readOnly}
                      onChange={(event) => onBranchChange(index, (current) => ({ ...current, title: event.target.value }))}
                      placeholder="Если ответить шуткой"
                      value={branch.title}
                    />
                  </label>

                  <label className="field">
                    <span>Чем кончается</span>
                    <input
                      className="input"
                      disabled={readOnly}
                      onChange={(event) => onBranchChange(index, (current) => ({ ...current, outcome: event.target.value }))}
                      placeholder="Торговец смягчается и сдаёт слух"
                      value={branch.outcome ?? ""}
                    />
                  </label>

                  <label className="field field-full">
                    <span>Реплики и ходы</span>
                    <textarea
                      className="input textarea"
                      disabled={readOnly}
                      onChange={(event) =>
                        onBranchChange(index, (current) => ({
                          ...current,
                          lines: event.target.value.split("\n")
                        }))
                      }
                      placeholder="Каждая строка отдельной репликой или реакцией."
                      value={(branch.lines ?? []).join("\n")}
                    />
                  </label>
                </div>
              </article>
            ))}
          </section>

          </details>
          {!isDraft ? <details className="event-optional event-danger"><summary>Удаление события</summary><p className="copy">Удалить сцену из кампании.</p><button className="ghost danger-action" disabled={saving} onClick={onDelete} type="button">Удалить событие</button></details> : null}
          {!readOnly && selectedLocation ? (
            <div className="actions">
              <button className="ghost" onClick={() => onOpenLocation(selectedLocation.id)} type="button">
                Открыть локацию
              </button>
            </div>
          ) : null}
          </>}
        </section>
      </div>
    </div>
  );
}

export function NotesWorkspace({
  notes,
  searchQuery,
  selectedNoteId,
  draftId,
  draftTitle,
  draftContent,
  saving,
  notice,
  error,
  onSearchChange,
  onSelectNote,
  onCreateNote,
  onEditWithAI,
  onOpenEntityImage,
  onSave,
  onOpenPreview,
  onTitleChange,
  onContentChange,
  onContentContextMenu,
  editorRef
}: {
  notes: LoreNoteEntity[];
  searchQuery: string;
  selectedNoteId: string;
  draftId: string;
  draftTitle: string;
  draftContent: string;
  saving: boolean;
  notice: string;
  error: string;
  onSearchChange: (value: string) => void;
  onSelectNote: (noteId: string) => void;
  onCreateNote: () => void;
  onEditWithAI?: (note: LoreNoteEntity) => void;
  onOpenEntityImage?: (entity: KnowledgeEntity, displayUrl?: string) => void;
  onSave: () => void;
  onOpenPreview: (noteId: string) => void;
  onTitleChange: (value: string) => void;
  onContentChange: (value: string) => void;
  onContentContextMenu: (event: ReactMouseEvent<HTMLTextAreaElement>) => void;
  editorRef: { current: HTMLTextAreaElement | null };
}) {
  const filteredNotes = useMemo(
    () => notes.filter((note) => matchesEntityDirectorySearch(note, searchQuery)),
    [notes, searchQuery]
  );
  const editingNewNote = draftId === NEW_LORE_NOTE_ID;
  const selectedNote = notes.find((note) => note.id === selectedNoteId) ?? null;
  const editorTitle = resolveLoreNoteTitle(draftTitle, draftContent);
  const canSave = Boolean(draftTitle.trim() || draftContent.trim());

  return (
    <div className="notes-workspace">
      <section className="card notes-workspace-head">
        <div className="notes-workspace-copy">
          <h1>Заметки мастера</h1>
          <p className="copy">
            Планы игры, идеи и секреты мастера.
          </p>
        </div>

        <div className="actions">
          <button className="ghost" onClick={onCreateNote} type="button">
            Новая заметка
          </button>
          {onEditWithAI && selectedNote ? (
            <button className="ghost ai-edit-button" disabled={saving} onClick={() => onEditWithAI(selectedNote)} type="button">
              Изменить с AI
            </button>
          ) : null}
          <button className="primary" disabled={saving || !canSave} onClick={onSave} type="button">
            {saving ? "Сохраняю..." : "Сохранить"}
          </button>
        </div>
      </section>

      <div className="notes-workspace-grid">
        <aside className="card notes-directory-panel">
          <div className="row muted">
            <strong>Все заметки</strong>
            <span className={badge("accent")}>{filteredNotes.length}</span>
          </div>

          <label className="field field-full">
            <span>Поиск заметки</span>
            <input
              className="input"
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder="Поиск заметок..."
              value={searchQuery}
            />
          </label>

          <div className="notes-list">
            {editingNewNote ? (
              <button aria-pressed className="notes-list-item selected unsaved" onClick={onCreateNote} type="button">
                <span className="notes-list-item-copy">
                  <strong>{editorTitle}</strong>
                  <small>Черновик</small>
                  <p>{draftContent.trim() ? truncateInlineText(draftContent.replace(/\s+/g, " ").trim(), 90) : "Новая пустая заметка."}</p>
                </span>
              </button>
            ) : null}

            {filteredNotes.length ? (
              filteredNotes.map((note) => (
                <article
                  key={note.id}
                  className={`notes-list-item ${!editingNewNote && selectedNoteId === note.id ? "selected" : ""}`}
                >
                  <EntityVisual entity={note} onOpenEntityImage={onOpenEntityImage} />
                  <button
                    aria-pressed={!editingNewNote && selectedNoteId === note.id}
                    className="notes-list-item-copy"
                    onClick={() => onSelectNote(note.id)}
                    type="button"
                  >
                    <strong>{note.title}</strong>
                    <small>{note.visibility === "gm_only" ? "Только мастеру" : "Можно показать игрокам"}</small>
                    <p>{loreNoteExcerpt(note, 90)}</p>
                  </button>
                </article>
              ))
            ) : !editingNewNote ? (
              <div className="notes-empty-state">
                <strong>{searchQuery.trim() ? "Ничего не найдено" : "Заметок пока нет"}</strong>
                <p className="copy">{searchQuery.trim() ? "Попробуйте другой запрос." : "Создайте первую заметку."}</p>
              </div>
            ) : null}
          </div>
        </aside>

        <section className="card notes-editor-panel">
          <div className="notes-editor-head">
            <div className="stack compact">
              <strong>{editorTitle}</strong>
            </div>
            {selectedNote && !editingNewNote ? (
              <button className="ghost" onClick={() => onOpenPreview(selectedNote.id)} type="button">
                Быстрый просмотр
              </button>
            ) : null}
          </div>

          {notice ? (
            <div className="notes-status notes-status-success" role="status">
              {notice}
            </div>
          ) : null}
          {error ? (
            <div className="notes-status notes-status-error" role="status">
              {error}
            </div>
          ) : null}

          <label className="field field-full">
            <span>Название</span>
            <input
              className="input notes-title-input"
              onChange={(event) => onTitleChange(event.target.value)}
              placeholder="Например: Засада у тракта"
              value={draftTitle}
            />
          </label>

          <label className="field field-full notes-editor-field">
            <span>Текст заметки</span>
            <textarea
              className="input textarea notes-editor-textarea"
              onContextMenu={onContentContextMenu}
              onChange={(event) => onContentChange(event.target.value)}
              placeholder="Что нужно помнить мастеру?"
              ref={editorRef}
              value={draftContent}
            />
          </label>
        </section>
      </div>
    </div>
  );
}

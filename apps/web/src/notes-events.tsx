import {
  useMemo,
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
  loreNoteExcerpt,
  matchesEntityDirectorySearch,
  resolveLoreNoteTitle,
  truncateInlineText,
  worldEventExcerpt,
  worldEventTypeLabels,
  worldEventTypeOptions,
  worldEventTypeTones
} from "./app-shared";

type LoreNoteEntity = Extract<KnowledgeEntity, { kind: "lore" }>;

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
  onRemoveLoot
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
  onOpenGenerator: () => void;
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
}) {
  const normalizedQuery = searchQuery.trim().toLowerCase();
  const filteredEvents = useMemo(
    () =>
      events.filter((event) =>
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
    [events, normalizedQuery]
  );
  const selectedLocation = draft.locationId ? locations.find((location) => location.id === draft.locationId) ?? null : null;
  const resolvedLoot = (draft.loot ?? []).filter((item) => item.trim());
  const isDraft = draftId === NEW_WORLD_EVENT_ID;

  return (
    <div className="notes-workspace events-workspace">
      <section className="card notes-workspace-head">
        <div className="notes-workspace-copy">
          <p className="eyebrow">События</p>
          <h1>Маленькие сценки для стола</h1>
          <p className="notes-workspace-copy">
            Здесь живут короткие смешные, тревожные или боевые эпизоды. Они не тянут на полноценный квест, зато
            отлично оживляют сессию и дают мгновенную сцену с репликами, лутом и быстрым выбором.
          </p>
        </div>
        <div className="actions">
          <button className="ghost" onClick={onCreateEvent} type="button">
            Новое событие
          </button>
          <button className="ghost" onClick={onOpenGenerator} type="button">
            Сгенерировать ИИ
          </button>
          <button className="primary" disabled={saving || generating} onClick={onSave} type="button">
            {saving ? "Сохраняю..." : "Сохранить"}
          </button>
        </div>
      </section>

      <div className="notes-workspace-grid events-workspace-grid">
        <aside className="card notes-directory-panel">
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

          <div className="notes-list">
            <button
              className={`notes-list-item ${isDraft ? "selected unsaved" : ""}`}
              onClick={onCreateEvent}
              type="button"
            >
              <span className="notes-list-item-copy">
                <strong>Новый черновик</strong>
                <small>Ручная сценка</small>
                <p>Пустой лист для короткого события без квестовой формы.</p>
              </span>
            </button>

            {filteredEvents.length ? (
              filteredEvents.map((event) => (
                <button
                  key={event.id}
                  className={`notes-list-item ${selectedEventId === event.id ? "selected" : ""}`}
                  onClick={() => onSelectEvent(event.id)}
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
                <strong>Пока пусто</strong>
                <span>Создай сценку вручную или попроси ИИ подбросить что-то живое.</span>
              </div>
            )}
          </div>
        </aside>

        <section className="card notes-editor-panel events-editor-panel">
          <div className="notes-editor-head">
            <div className="stack tight">
              <div className="row">
                <strong>{draft.title.trim() || "Новое событие"}</strong>
                <span className={badge(worldEventTypeTones[draft.type])}>{worldEventTypeLabels[draft.type]}</span>
                <span className={badge(draft.origin === "ai" ? "accent" : "default")}>{draft.origin === "ai" ? "AI" : "Ручное"}</span>
              </div>
              <small className="copy">
                {selectedLocation ? `Привязано к локации ${selectedLocation.title}.` : "Можно оставить без привязки к локации."}
              </small>
            </div>
            {!isDraft ? (
              <button className="ghost danger-action" disabled={saving} onClick={onDelete} type="button">
                Удалить
              </button>
            ) : null}
          </div>

          {notice ? <div className="notes-status notes-status-success">{notice}</div> : null}
          {error ? <div className="notes-status notes-status-error">{error}</div> : null}

          <div className="form-grid">
            <label className="field">
              <span>Название</span>
              <input
                className="input notes-title-input"
                onChange={(event) => onDraftChange((current) => ({ ...current, title: event.target.value }))}
                placeholder="Например: Торговец-сквернослов"
                value={draft.title}
              />
            </label>

            <label className="field">
              <span>Дата в мире</span>
              <input
                className="input"
                onChange={(event) => onDraftChange((current) => ({ ...current, date: event.target.value }))}
                placeholder="17 Nightal, 1492 DR"
                value={draft.date ?? ""}
              />
            </label>

            <label className="field">
              <span>Локация</span>
              <select
                className="input"
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
                onChange={(event) => onDraftChange((current) => ({ ...current, summary: event.target.value }))}
                placeholder="Один короткий абзац: что это за сценка и почему партии не всё равно."
                value={draft.summary}
              />
            </label>
          </div>

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
                    onChange={(event) => onLootChange(index, event.target.value)}
                    placeholder={index === 0 ? "15 зм" : "Кинжал, пропуск, 2 какашки бабуина"}
                    value={item}
                  />
                  <button className="ghost" onClick={() => onRemoveLoot(index)} type="button">
                    Убрать
                  </button>
                </div>
              ))}
            </div>
            <div className="actions">
              <button className="ghost" onClick={onAddLoot} type="button">
                Добавить лут
              </button>
            </div>
          </section>

          <label className="field notes-editor-field">
            <span>Текст сцены</span>
            <textarea
              className="input textarea notes-editor-textarea event-scene-textarea"
              onChange={(event) => onDraftChange((current) => ({ ...current, sceneText: event.target.value }))}
              placeholder="Что происходит прямо сейчас, кто начинает сцену, чем она цепляет игроков и куда может качнуться."
              value={draft.sceneText}
            />
          </label>

          <section className="stack event-branch-list">
            <div className="row">
              <strong>Ветки диалога</strong>
              <button className="ghost" onClick={onAddBranch} type="button">
                Добавить ветку
              </button>
            </div>

            {(draft.dialogueBranches ?? []).map((branch, index) => (
              <article key={`branch-${index}`} className="card mini event-branch-card">
                <div className="row">
                  <span className={badge("accent")}>Ветка {index + 1}</span>
                  <button className="ghost" onClick={() => onRemoveBranch(index)} type="button">
                    Убрать
                  </button>
                </div>

                <div className="form-grid">
                  <label className="field">
                    <span>Заголовок</span>
                    <input
                      className="input"
                      onChange={(event) => onBranchChange(index, (current) => ({ ...current, title: event.target.value }))}
                      placeholder="Если ответить шуткой"
                      value={branch.title}
                    />
                  </label>

                  <label className="field">
                    <span>Чем кончается</span>
                    <input
                      className="input"
                      onChange={(event) => onBranchChange(index, (current) => ({ ...current, outcome: event.target.value }))}
                      placeholder="Торговец смягчается и сдаёт слух"
                      value={branch.outcome ?? ""}
                    />
                  </label>

                  <label className="field field-full">
                    <span>Реплики и ходы</span>
                    <textarea
                      className="input textarea"
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

          {selectedLocation ? (
            <div className="actions">
              <button className="ghost" onClick={() => onOpenLocation(selectedLocation.id)} type="button">
                Открыть локацию
              </button>
            </div>
          ) : null}
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
          <div className="quest-breadcrumbs">
            <span className="quest-breadcrumb-btn">Главная</span>
            <span>/</span>
            <strong>Заметки</strong>
          </div>
          <h1>Заметки мастера</h1>
          <p className="copy">
            Только рабочий текст и быстрые записи. Здесь новая заметка создаётся без общей формы сущности и без лишних полей.
          </p>
        </div>

        <div className="actions">
          <button className="ghost" onClick={onCreateNote} type="button">
            Новая заметка
          </button>
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
                <button
                  key={note.id}
                  aria-pressed={!editingNewNote && selectedNoteId === note.id}
                  className={`notes-list-item ${!editingNewNote && selectedNoteId === note.id ? "selected" : ""}`}
                  onClick={() => onSelectNote(note.id)}
                  type="button"
                >
                  <span className="notes-list-item-copy">
                    <strong>{note.title}</strong>
                    <small>{note.visibility === "gm_only" ? "GM only" : "Player safe"}</small>
                    <p>{loreNoteExcerpt(note, 90)}</p>
                  </span>
                </button>
              ))
            ) : (
              <div className="notes-empty-state">
                <strong>Ничего не найдено</strong>
                <p className="copy">Либо заметок пока нет, либо текущий поиск ничего не дал.</p>
              </div>
            )}
          </div>
        </aside>

        <section className="card notes-editor-panel">
          <div className="notes-editor-head">
            <div className="stack compact">
              <p className="eyebrow">Editor</p>
              <strong>{editorTitle}</strong>
              <p className="copy">
                {draftContent.trim()
                  ? truncateInlineText(draftContent.replace(/\s+/g, " ").trim(), 180)
                  : "Здесь можно вести сценовые заметки, планы сессии, скрытые мотивы, подсказки или просто быстрые GM-записи."}
              </p>
            </div>
            {selectedNote && !editingNewNote ? (
              <button className="ghost" onClick={() => onOpenPreview(selectedNote.id)} type="button">
                Открыть в preview
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
              placeholder="Пиши заметку как есть: ход сцены, реплики, скрытые мотивы, проверку, последствия, слух или рабочий план на сессию."
              ref={editorRef}
              value={draftContent}
            />
          </label>
        </section>
      </div>
    </div>
  );
}

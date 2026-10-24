import { InPlaceText } from "./features/entities/InPlaceText";
import { WorkspaceTabs } from "./app/WorkspaceTabs";
import {
  useMemo,
  useState,
  useEffect,
  type MouseEvent as ReactMouseEvent,
} from "react";
import type {
  KnowledgeEntity,
  LocationEntity,
  WorldEvent,
  WorldEventDialogueBranch,
  WorldEventInput,
  WorldEventType,
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
  worldEventTypeTones,
} from "./app-shared";
import "./features/events/events.css";
import { FormattedText } from "./features/formatting/FormattedText";
import { AIFormatButton } from "./features/formatting/AIFormatButton";

type LoreNoteEntity = Extract<KnowledgeEntity, { kind: "lore" }>;

export function EventSceneCard({
  event,
  onOpenLocation,
}: {
  event: WorldEventInput;
  onOpenLocation?: (id: string) => void;
}) {
  const loot = (event.loot ?? []).filter((value) => value.trim());
  const branches = (event.dialogueBranches ?? []).filter(
    (branch) =>
      branch.lines?.some((line) => line.trim()) || branch.outcome?.trim(),
  );
  return (
    <article className="event-scene-card">
      <div className="event-scene-meta">
        <span className={badge(worldEventTypeTones[event.type])}>
          {worldEventTypeLabels[event.type]}
        </span>
        {event.date ? <span>{event.date}</span> : null}
        {event.locationLabel ? (
          onOpenLocation && event.locationId ? (
            <button
              className="ghost"
              onClick={() => onOpenLocation(event.locationId!)}
              type="button"
            >
              {event.locationLabel}
            </button>
          ) : (
            <span>{event.locationLabel}</span>
          )
        ) : null}
      </div>
      <h2>{event.title.trim() || "Новая сцена"}</h2>
      {event.summary ? (
        <p className="event-scene-summary">{event.summary}</p>
      ) : null}
      <section className="event-read-aloud">
        <p className="eyebrow">
          {event.tags?.includes("gm-event")
            ? "Только для мастера · Краткий экскурс"
            : "Сцена за столом"}
        </p>
        <FormattedText
          content={event.sceneText || "Текст сцены пока не добавлен."}
        />
      </section>
      {branches.length ? (
        <section className="event-outcomes formatted-text">
          <h3>Варианты развития</h3>
          <div
            className="formatted-table-scroll"
            tabIndex={0}
            role="region"
            aria-label="Варианты развития"
          >
            <table>
              <thead>
                <tr>
                  <th>Действие игроков</th>
                  <th>Проверки и реакции</th>
                  <th>Последствия</th>
                </tr>
              </thead>
              <tbody>
                {branches.map((branch, index) => (
                  <tr key={index}>
                    <th scope="row">
                      {branch.title || `Вариант ${index + 1}`}
                    </th>
                    <td>
                      <FormattedText
                        content={
                          branch.lines?.filter(Boolean).join("\n\n") || "—"
                        }
                      />
                    </td>
                    <td>
                      <FormattedText content={branch.outcome || "—"} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
      {loot.length ? (
        <section className="event-rewards">
          <h3>
            {event.tags?.includes("gm-event")
              ? "Что могут получить игроки"
              : "Награды и находки"}
          </h3>
          <ul>
            {loot.map((item, index) => (
              <li key={index}>
                <FormattedText content={item} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </article>
  );
}

export function EventsWorkspace({
  campaignId,
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
  dirty = false,
}: {
  campaignId?: string;
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
  onDraftChange: (
    updater: (current: WorldEventInput) => WorldEventInput,
  ) => void;
  onBranchChange: (
    index: number,
    updater: (current: WorldEventDialogueBranch) => WorldEventDialogueBranch,
  ) => void;
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
  const [section, setSection] = useState("scene");
  const editable = editing && !readOnly && !saving && !generating;
  useEffect(() => setSection("scene"), [draftId]);
  useEffect(() => {
    setEditing(draftId === NEW_WORLD_EVENT_ID);
  }, [draftId]);
  const normalizedQuery = searchQuery.trim().toLowerCase();
  const filteredEvents = useMemo(
    () =>
      events
        .filter(
          (event) =>
            (!typeFilter || event.type === typeFilter) &&
            (!locationFilter || event.locationId === locationFilter),
        )
        .filter((event) =>
          !normalizedQuery
            ? true
            : [
                event.title,
                event.summary,
                event.sceneText,
                event.locationLabel ?? "",
                worldEventTypeLabels[event.type],
                event.loot.join(" "),
                event.tags.join(" "),
              ]
                .join(" ")
                .toLowerCase()
                .includes(normalizedQuery),
        ),
    [events, normalizedQuery, typeFilter, locationFilter],
  );
  const selectedLocation = draft.locationId
    ? (locations.find((location) => location.id === draft.locationId) ?? null)
    : null;
  const resolvedLoot = (draft.loot ?? []).filter((item) => item.trim());
  const isDraft = draftId === NEW_WORLD_EVENT_ID;

  return (
    <div
      className={`notes-workspace events-workspace ${readOnly ? "events-workspace-readonly" : ""}`.trim()}
      onKeyDown={(event) => {
        if (
          editable &&
          (event.ctrlKey || event.metaKey) &&
          event.key.toLowerCase() === "s"
        ) {
          event.preventDefault();
          onSave();
        }
      }}
    >
      <section className="card notes-workspace-head">
        <div className="notes-workspace-copy">
          <p className="eyebrow">События</p>
          <h1>События и сцены</h1>
          <p className="notes-workspace-copy">
            Сцены, реакции и находки для игры.
          </p>
        </div>
        {!readOnly ? (
          <div className="actions">
            <button className="ghost" onClick={onCreateEvent} type="button">
              Новое событие
            </button>
            <details className="workspace-secondary-actions">
              <summary>Создать с AI</summary>
              <div>
                <button
                  className="ghost"
                  type="button"
                  onClick={() => onOpenGenerator("gm_event")}
                >
                  Случайное событие
                </button>
                <button
                  className="ghost"
                  type="button"
                  onClick={() => onOpenGenerator("read_aloud")}
                >
                  Зачитка с AI
                </button>
              </div>
            </details>
          </div>
        ) : null}
      </section>

      {!readOnly ? (
        <button
          className="ghost event-directory-toggle"
          aria-expanded={directoryOpen}
          aria-controls="events-directory"
          onClick={() => setDirectoryOpen((current) => !current)}
          type="button"
        >
          {directoryOpen ? "Свернуть список" : "Выбрать событие"}
          <span>{events.length}</span>
        </button>
      ) : null}
      <div className="notes-workspace-grid events-workspace-grid">
        {!readOnly ? (
          <aside
            id="events-directory"
            className={`card notes-directory-panel ${directoryOpen ? "directory-open" : ""}`}
          >
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
              <label className="field">
                <span>Тип события</span>
                <select
                  className="input"
                  value={typeFilter}
                  onChange={(event) => setTypeFilter(event.target.value)}
                >
                  <option value="">Все типы</option>
                  {worldEventTypeOptions.map((type) => (
                    <option key={type} value={type}>
                      {worldEventTypeLabels[type]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Место</span>
                <select
                  className="input"
                  value={locationFilter}
                  onChange={(event) => setLocationFilter(event.target.value)}
                >
                  <option value="">Все локации</option>
                  {locations.map((location) => (
                    <option key={location.id} value={location.id}>
                      {location.title}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="notes-list">
              {isDraft ? (
                <button
                  className="notes-list-item selected unsaved"
                  onClick={onCreateEvent}
                  type="button"
                >
                  <span className="notes-list-item-copy">
                    <strong>Новый черновик</strong>
                    <small>Ручная сценка</small>
                    <p>Добавь описание и сохрани сцену в кампанию.</p>
                  </span>
                </button>
              ) : null}

              {filteredEvents.length ? (
                filteredEvents.map((event) => (
                  <button
                    key={event.id}
                    className={`notes-list-item ${selectedEventId === event.id ? "selected" : ""}`}
                    onClick={() => {
                      onSelectEvent(event.id);
                      setDirectoryOpen(false);
                    }}
                    type="button"
                  >
                    <span className="notes-list-item-copy">
                      <div className="row">
                        <strong>{event.title}</strong>
                        <span
                          className={badge(worldEventTypeTones[event.type])}
                        >
                          {worldEventTypeLabels[event.type]}
                        </span>
                      </div>
                      <small>
                        {event.locationLabel ? `${event.locationLabel} • ` : ""}
                        {event.date ||
                          (event.origin === "ai" ? "AI" : "Ручное")}
                      </small>
                      <p>{worldEventExcerpt(event, 110)}</p>
                    </span>
                  </button>
                ))
              ) : (
                <div className="notes-empty-state">
                  <strong>
                    {events.length ? "Ничего не найдено" : "Первая сцена"}
                  </strong>
                  <span>
                    {events.length
                      ? "Измени поиск или фильтры."
                      : "Создай событие вручную или с AI, чтобы подготовить эпизод для игры."}
                  </span>
                </div>
              )}
            </div>
          </aside>
        ) : null}

        <section className="card notes-editor-panel events-editor-panel">
          <div className="notes-editor-head">
            <div className="stack tight">
              <strong>Событие</strong>
              <small className="copy">
                {dirty
                  ? "Есть изменения"
                  : isDraft
                    ? "Новая сцена"
                    : "Сохранено"}
              </small>
            </div>
            {!readOnly ? (
              <div className="actions event-editor-actions">
                <details className="workspace-secondary-actions">
                  <summary>Ещё</summary>
                  <div>
                    {" "}
                    {campaignId ? (
                      <AIFormatButton
                        campaignId={campaignId}
                        sourceId={draftId}
                        title={draft.title}
                        content={draft.sceneText}
                        disabled={saving || generating}
                        onApply={(sceneText) => {
                          onDraftChange((current) => ({
                            ...current,
                            sceneText,
                          }));
                          setEditing(false);
                        }}
                      />
                    ) : null}
                  </div>
                </details>
                <button
                  className="ghost"
                  disabled={saving || generating}
                  onClick={() => setEditing((current) => !current)}
                  type="button"
                >
                  {editing ? "Завершить правку" : "Редактировать"}
                </button>
                <button
                  className="primary"
                  disabled={saving || generating || (!dirty && !isDraft)}
                  onClick={onSave}
                  type="button"
                >
                  {saving ? "Сохраняю…" : "Сохранить"}
                </button>
              </div>
            ) : null}
          </div>

          {notice ? (
            <div className="notes-status notes-status-success" role="status">
              {notice}
            </div>
          ) : null}
          {error ? (
            <div className="notes-status notes-status-error" role="alert">
              {error}
            </div>
          ) : null}

          <article className={`event-inplace ${editing ? "is-editing" : ""}`}>
            <div className="event-inplace-meta">
              <label>
                <span>Тип</span>
                <select
                  className="inplace-select"
                  aria-label="Тип события"
                  value={draft.type}
                  disabled={!editable}
                  onChange={(e) =>
                    onDraftChange((old) => ({
                      ...old,
                      type: e.target.value as WorldEventType,
                    }))
                  }
                >
                  {worldEventTypeOptions.map((type) => (
                    <option key={type} value={type}>
                      {worldEventTypeLabels[type]}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>Дата</span>
                <InPlaceText
                  label="Дата события"
                  value={draft.date || ""}
                  editing={editable}
                  onChange={(date) =>
                    onDraftChange((old) => ({ ...old, date }))
                  }
                />
              </label>
              <label>
                <span>Место</span>
                <select
                  className="inplace-select"
                  aria-label="Локация события"
                  value={draft.locationId || ""}
                  disabled={!editable}
                  onChange={(e) =>
                    onDraftChange((old) => ({
                      ...old,
                      locationId: e.target.value,
                      locationLabel:
                        locations.find((l) => l.id === e.target.value)?.title ||
                        "",
                    }))
                  }
                >
                  <option value="">
                    {!draft.locationId && draft.locationLabel
                      ? draft.locationLabel
                      : "Без привязки"}
                  </option>
                  {draft.locationId &&
                    !locations.some((l) => l.id === draft.locationId) && (
                      <option value={draft.locationId}>
                        {draft.locationLabel || "Связанное место"}
                      </option>
                    )}
                  {locations.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.title}
                    </option>
                  ))}
                </select>
              </label>
              {selectedLocation && (
                <button
                  className="ghost"
                  type="button"
                  onClick={() => onOpenLocation(selectedLocation.id)}
                >
                  Открыть место
                </button>
              )}
            </div>
            <h2 className="event-inplace-title">
              <InPlaceText
                label="Название события"
                value={draft.title}
                editing={editable}
                onChange={(title) =>
                  onDraftChange((old) => ({ ...old, title }))
                }
                placeholder="Название события"
              />
            </h2>
            <InPlaceText
              label="Кратко о сцене"
              value={draft.summary}
              editing={editable}
              multiline
              onChange={(summary) =>
                onDraftChange((old) => ({ ...old, summary }))
              }
            />
            <WorkspaceTabs
              id="event-workspace"
              label="Разделы события"
              value={section}
              onChange={setSection}
              tabs={[
                ["scene", "Сцена"],
                ["branches", "Варианты"],
                ["loot", "Находки"],
              ]}
            />
            <section
              role="tabpanel"
              id="event-workspace-panel-scene"
              aria-labelledby="event-workspace-tab-scene"
              hidden={section !== "scene"}
              tabIndex={0}
            >
              <h3>
                {draft.tags?.includes("gm-event")
                  ? "Памятка мастеру"
                  : "Текст сцены"}
              </h3>
              <InPlaceText
                label="Текст сцены"
                value={draft.sceneText}
                editing={editable}
                rich
                multiline
                onChange={(sceneText) =>
                  onDraftChange((old) => ({ ...old, sceneText }))
                }
              />
              {!isDraft && editing && (
                <details className="event-danger">
                  <summary>Удаление события</summary>
                  <p className="copy">Удалить сцену из кампании.</p>
                  <button
                    className="ghost danger-action"
                    disabled={saving}
                    onClick={onDelete}
                    type="button"
                  >
                    Удалить событие
                  </button>
                </details>
              )}
            </section>
            <section
              role="tabpanel"
              id="event-workspace-panel-branches"
              aria-labelledby="event-workspace-tab-branches"
              hidden={section !== "branches"}
              tabIndex={0}
            >
              <div className="workspace-section-heading">
                <h3>
                  Варианты развития{" "}
                  <small>{draft.dialogueBranches?.length || 0}</small>
                </h3>
                {editable && (
                  <button className="ghost" type="button" onClick={onAddBranch}>
                    + Добавить вариант
                  </button>
                )}
              </div>
              {(draft.dialogueBranches || []).map((branch, index) => (
                <article
                  className="event-inplace-branch"
                  key={`branch-${index}`}
                >
                  <div className="workspace-section-heading">
                    <h4>
                      <InPlaceText
                        label={`Вариант ${index + 1}: название`}
                        value={branch.title}
                        editing={editable}
                        onChange={(title) =>
                          onBranchChange(index, (old) => ({ ...old, title }))
                        }
                      />
                    </h4>
                    {editable && (
                      <button
                        className="ghost"
                        type="button"
                        aria-label={`Убрать вариант ${index + 1}`}
                        onClick={() => onRemoveBranch(index)}
                      >
                        Убрать
                      </button>
                    )}
                  </div>
                  <div className="event-branch-columns">
                    <section>
                      <h5>Проверки и реакции</h5>
                      {(branch.lines?.length ? branch.lines : [""]).map(
                        (line, lineIndex) => (
                          <div
                            className="event-dialogue-line"
                            key={`line-${lineIndex}`}
                          >
                            <InPlaceText
                              label={`Вариант ${index + 1}: реплика ${lineIndex + 1}`}
                              value={line}
                              editing={editable}
                              rich
                              multiline
                              onChange={(value) =>
                                onBranchChange(index, (old) => ({
                                  ...old,
                                  lines: (old.lines?.length
                                    ? old.lines
                                    : [""]
                                  ).map((text, i) =>
                                    i === lineIndex ? value : text,
                                  ),
                                }))
                              }
                            />
                            {editable && (branch.lines?.length || 0) > 1 && (
                              <button
                                className="ghost"
                                type="button"
                                aria-label={`Убрать реплику ${lineIndex + 1} варианта ${index + 1}`}
                                onClick={() =>
                                  onBranchChange(index, (old) => ({
                                    ...old,
                                    lines: old.lines.filter(
                                      (_, i) => i !== lineIndex,
                                    ),
                                  }))
                                }
                              >
                                Убрать
                              </button>
                            )}
                          </div>
                        ),
                      )}
                      {editable && (
                        <button
                          className="ghost"
                          type="button"
                          onClick={() =>
                            onBranchChange(index, (old) => ({
                              ...old,
                              lines: [...(old.lines || []), ""],
                            }))
                          }
                        >
                          + Реплика
                        </button>
                      )}
                    </section>
                    <section>
                      <h5>Последствия</h5>
                      <InPlaceText
                        label={`Вариант ${index + 1}: последствия`}
                        value={branch.outcome || ""}
                        editing={editable}
                        rich
                        multiline
                        onChange={(outcome) =>
                          onBranchChange(index, (old) => ({ ...old, outcome }))
                        }
                      />
                    </section>
                  </div>
                </article>
              ))}
              {!draft.dialogueBranches?.length && (
                <p className="copy">Варианты пока не добавлены.</p>
              )}
            </section>
            <section
              role="tabpanel"
              id="event-workspace-panel-loot"
              aria-labelledby="event-workspace-tab-loot"
              hidden={section !== "loot"}
              tabIndex={0}
            >
              <div className="workspace-section-heading">
                <h3>
                  Награды и находки <small>{resolvedLoot.length}</small>
                </h3>
                {editable && (
                  <button className="ghost" type="button" onClick={onAddLoot}>
                    + Добавить находку
                  </button>
                )}
              </div>
              {(draft.loot || []).map((item, index) => (
                <div className="event-inplace-loot" key={`loot-${index}`}>
                  <InPlaceText
                    label={`Находка ${index + 1}`}
                    value={item}
                    editing={editable}
                    rich
                    multiline
                    onChange={(value) => onLootChange(index, value)}
                  />
                  {editable && (
                    <button
                      className="ghost"
                      aria-label={`Убрать находку ${index + 1}`}
                      type="button"
                      onClick={() => onRemoveLoot(index)}
                    >
                      Убрать
                    </button>
                  )}
                </div>
              ))}
              {!resolvedLoot.length && !editing && (
                <p className="copy">Находки пока не добавлены.</p>
              )}
            </section>
          </article>
        </section>
      </div>
    </div>
  );
}

export function NotesWorkspace({
  entityByTitle,
  campaignId,
  dirty = false,
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
  editorRef,
  readOnly = false,
}: {
  readOnly?: boolean;
  entityByTitle?: Map<string, KnowledgeEntity>;
  campaignId?: string;
  dirty?: boolean;
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
    () =>
      notes.filter((note) => matchesEntityDirectorySearch(note, searchQuery)),
    [notes, searchQuery],
  );
  const editingNewNote = draftId === NEW_LORE_NOTE_ID;
  const selectedNote = notes.find((note) => note.id === selectedNoteId) ?? null;
  const editorTitle = resolveLoreNoteTitle(draftTitle, draftContent);
  const canSave = Boolean(draftTitle.trim() || draftContent.trim());
  const [editing, setEditing] = useState(editingNewNote);
  const noteEntities = useMemo(
    () =>
      new Map(
        [...(entityByTitle?.values() || [])].map((entity) => [
          entity.title.toLocaleLowerCase(),
          entity,
        ]),
      ),
    [entityByTitle],
  );
  useEffect(() => {
    setEditing(draftId === NEW_LORE_NOTE_ID);
  }, [draftId]);

  return (
    <div
      className="notes-workspace notes-inplace-workspace"
      onKeyDown={(event) => {
        if (
          !readOnly &&
          !saving &&
          (event.ctrlKey || event.metaKey) &&
          event.key.toLowerCase() === "s"
        ) {
          event.preventDefault();
          if (canSave) onSave();
        }
      }}
    >
      <section className="card notes-workspace-head">
        <div className="notes-workspace-copy">
          <h1>Заметки мастера</h1>
          <p className="copy">Планы игры, идеи и секреты мастера.</p>
        </div>

        <div className="actions">
          <button
            className="ghost"
            disabled={saving || readOnly}
            onClick={onCreateNote}
            type="button"
          >
            Новая заметка
          </button>
          {onEditWithAI && selectedNote ? (
            <button
              className="ghost ai-edit-button"
              disabled={saving || dirty || readOnly}
              title={dirty ? "Сначала сохрани изменения" : undefined}
              onClick={() => onEditWithAI(selectedNote)}
              type="button"
            >
              Изменить с AI
            </button>
          ) : null}
          {campaignId ? (
            <AIFormatButton
              campaignId={campaignId}
              sourceId={draftId}
              title={draftTitle}
              content={draftContent}
              disabled={saving || readOnly}
              onApply={(text) => {
                onContentChange(text);
                setEditing(false);
              }}
            />
          ) : null}
          <button
            className="primary"
            disabled={
              readOnly || saving || !canSave || (!dirty && !editingNewNote)
            }
            onClick={onSave}
            type="button"
          >
            {saving ? "Сохраняю..." : "Сохранить"}
          </button>
        </div>
      </section>

      <div className="notes-workspace-grid">
        <details className="card notes-directory-panel notes-chooser">
          <summary>
            Выбрать заметку <span>{filteredNotes.length}</span>
          </summary>
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
              <div className="notes-list-item selected unsaved">
                <span className="notes-list-item-copy">
                  <strong>{editorTitle}</strong>
                  <small>Черновик</small>
                  <p>
                    {draftContent.trim()
                      ? truncateInlineText(
                          draftContent.replace(/\s+/g, " ").trim(),
                          90,
                        )
                      : "Новая пустая заметка."}
                  </p>
                </span>
              </div>
            ) : null}

            {filteredNotes.length ? (
              filteredNotes.map((note) => (
                <article
                  key={note.id}
                  className={`notes-list-item ${!editingNewNote && selectedNoteId === note.id ? "selected" : ""}`}
                >
                  <EntityVisual
                    entity={note}
                    onOpenEntityImage={onOpenEntityImage}
                  />
                  <button
                    aria-pressed={!editingNewNote && selectedNoteId === note.id}
                    className="notes-list-item-copy"
                    disabled={saving}
                    onClick={() => onSelectNote(note.id)}
                    type="button"
                  >
                    <strong>{note.title}</strong>
                    <small>
                      {note.visibility === "gm_only"
                        ? "Только мастеру"
                        : "Можно показать игрокам"}
                    </small>
                    <p>{loreNoteExcerpt(note, 90)}</p>
                  </button>
                </article>
              ))
            ) : !editingNewNote ? (
              <div className="notes-empty-state">
                <strong>
                  {searchQuery.trim()
                    ? "Ничего не найдено"
                    : "Заметок пока нет"}
                </strong>
                <p className="copy">
                  {searchQuery.trim()
                    ? "Попробуйте другой запрос."
                    : "Создайте первую заметку."}
                </p>
              </div>
            ) : null}
          </div>
        </details>

        <section className="card notes-editor-panel">
          <div className="notes-editor-head">
            <h2 className="note-inplace-title">
              <InPlaceText
                label="Название заметки"
                value={draftTitle || (!editing ? editorTitle : "")}
                editing={editing && !saving && !readOnly}
                onChange={onTitleChange}
                placeholder="Название заметки"
              />
            </h2>
            {!readOnly && (
              <button
                className="ghost"
                disabled={saving}
                onClick={() => setEditing((old) => !old)}
                type="button"
              >
                {editing ? "Завершить правку" : "Редактировать"}
              </button>
            )}
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

          <InPlaceText
            className="notes-inplace-content"
            label="Текст заметки"
            value={draftContent}
            editing={editing && !saving && !readOnly}
            rich
            multiline
            entities={noteEntities}
            onOpen={onOpenPreview}
            onChange={onContentChange}
            placeholder="Что нужно помнить мастеру?"
          />
        </section>
      </div>
    </div>
  );
}

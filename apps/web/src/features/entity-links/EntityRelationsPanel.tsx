import { InPlaceText } from "../entities/InPlaceText";
import { Pencil } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { isApiError } from "@shadow-edge/api-client";
import { readRelationDraft } from "./relation-draft";
import type {
  CampaignData,
  KnowledgeEntity,
  RelatedEntity,
} from "@shadow-edge/shared-types";
import { api } from "../../app/api";
import { AppModal } from "../../app/AppModal";
import { EntityVisual, kindTitle } from "../../app-shared";
import { confirmAction } from "../../app/confirm-action";
import { useDeviceDraft } from "../../app/hooks/useDeviceDraft";
import { DeviceDraftControls } from "../../app/DeviceDraftControls";
import { useWorkspaceGuard } from "../../app/workspace-route";

type Props = {
  inlineEdit?: boolean;
  compact?: boolean;
  campaignId: string;
  ownerId: string;
  entity: KnowledgeEntity;
  onOpen: (r: RelatedEntity) => void;
  onResolve?: (r: RelatedEntity) => KnowledgeEntity | null;
  onChanged?: (c: CampaignData) => void;
};
export function EntityRelationsPanel(props: Props) {
  return (
    <Relations key={`${props.campaignId}:${props.entity.id}`} {...props} />
  );
}
function Relations({
  inlineEdit = false,
  compact = false,
  campaignId,
  ownerId,
  entity,
  onOpen,
  onResolve,
  onChanged,
}: Props) {
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  const [items, setItems] = useState<RelatedEntity[]>(entity.related),
    [revision, setRevision] = useState<number | null>(null);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [relatedQuery, setRelatedQuery] = useState(""),
    [visibleCount, setVisibleCount] = useState(8);
  const filtered = items.filter((item) =>
    `${item.label} ${item.reason || ""} ${kindTitle[item.kind]}`
      .toLocaleLowerCase()
      .includes(relatedQuery.trim().toLocaleLowerCase()),
  );
  const [open, setOpen] = useState(false),
    [editing, setEditing] = useState<string | null>(null),
    [selected, setSelected] = useState<Record<string, string>>({}),
    [reason, setReason] = useState("");
  const [q, setQ] = useState(""),
    [kind, setKind] = useState("all"),
    [results, setResults] = useState<KnowledgeEntity[]>([]),
    [cursor, setCursor] = useState(""),
    [page, setPage] = useState("");
  const [loading, setLoading] = useState(false),
    [saving, setSaving] = useState(false),
    [error, setError] = useState("");
  const [editRevision, setEditRevision] = useState<number | null>(null),
    [baselineReason, setBaselineReason] = useState("");
  const [conflict, setConflict] = useState(false),
    [comparison, setComparison] = useState<{
      revision: number;
      items: RelatedEntity[];
    } | null>(null);
  const dirty =
    open && (Object.keys(selected).length > 0 || reason !== baselineReason);
  const blocked = saving || Boolean(conflict);
  const draft = useDeviceDraft({
    ownerId,
    campaignId,
    target: `relations:${entity.id}`,
    revision: editRevision ?? revision ?? 0,
    value: { selected, reason, editing },
    dirty,
    enabled: open,
    restore: (d) => {
      const restored = readRelationDraft(d.value, d.baseRevision, entity.id);
      if (!restored) {
        setError(
          "Копия связей повреждена. Скачайте её для проверки или продолжите текущую форму.",
        );
        return false;
      }
      setSelected(restored.selected);
      setReason(restored.reason);
      setEditing(restored.editing);
      setEditRevision(restored.revision);
      setBaselineReason(
        items.find((i) => i.id === restored.editing)?.reason || "",
      );
      setConflict(false);
      setComparison(null);
      setError("");
      return true;
    },
  });
  useWorkspaceGuard(
    dirty || saving,
    "Есть несохранённые связи. Перейти без сохранения?",
  );
  useEffect(() => {
    const cancel = new AbortController();
    api
      .getEntityRelations(campaignId, entity.id, cancel.signal)
      .then((d) => {
        setItems(d.items);
        setRevision(d.revision);
      })
      .catch((e) => {
        if (!cancel.signal.aborted) setError(e.message);
      });
    return () => cancel.abort();
  }, [campaignId, entity.id, entity.revision, loadAttempt]);
  useEffect(() => {
    if (!open || editing) return;
    const cancel = new AbortController();
    setLoading(true);
    if (!page) setCursor("");
    const timer = setTimeout(
      () =>
        api
          .searchEntities(
            campaignId,
            { q, kind, exclude: entity.id, cursor: page },
            cancel.signal,
          )
          .then((d) => {
            if (!cancel.signal.aborted) {
              setResults((old) => (page ? [...old, ...d.items] : d.items));
              setCursor(d.nextCursor);
            }
          })
          .catch((e) => {
            if (!cancel.signal.aborted) setError(e.message);
          })
          .finally(() => {
            if (!cancel.signal.aborted) setLoading(false);
          }),
      250,
    );
    return () => {
      clearTimeout(timer);
      cancel.abort();
    };
  }, [open, editing, q, kind, page, campaignId, entity.id]);
  async function close() {
    if (saving) return;
    if (
      !dirty ||
      (await confirmAction(
        "Закрыть окно? Несохранённые связи останутся в черновике на устройстве.",
      ))
    ) {
      draft.flush();
      setOpen(false);
    }
  }
  function begin(target?: RelatedEntity) {
    setEditing(target?.id ?? null);
    setReason(target?.reason || "");
    setBaselineReason(target?.reason || "");
    setEditRevision(revision);
    setConflict(false);
    setComparison(null);
    setSelected({});
    setPage("");
    setResults([]);
    setError("");
    setOpen(true);
  }
  async function loadComparison() {
    try {
      const d = await api.getEntityRelations(campaignId, entity.id);
      if (alive.current) {
        setItems(d.items);
        setRevision(d.revision);
        setComparison(d);
      }
    } catch {
      if (alive.current)
        setError(
          "Не удалось загрузить текущие связи. Ваши правки остались в окне; повторите загрузку для сравнения.",
        );
    }
  }
  async function save(target?: string, remove = false) {
    if (editRevision === null || saving || conflict || draft.candidate) return;
    setSaving(true);
    setError("");
    try {
      const c = await api.mutateEntityRelations(
        campaignId,
        entity.id,
        {
          expectedRevision: editRevision,
          targetIds: Object.keys(selected),
          reason,
        },
        target,
        remove,
      );
      if (!alive.current) return;
      onChanged?.(c);
      draft.clear();
      setSelected({});
      setOpen(false);
      setEditRevision(null);
      setRevision(c.revision ?? null);
      // A failed read after a successful write must never invite replaying that write.
      try {
        const d = await api.getEntityRelations(campaignId, entity.id);
        if (alive.current) {
          setItems(d.items);
          setRevision(d.revision);
        }
      } catch {
        if (alive.current)
          setError(
            "Связи сохранены. Не удалось обновить список — повторите загрузку.",
          );
      }
    } catch (e) {
      if (!alive.current) return;
      setError(e instanceof Error ? e.message : "Не удалось сохранить связи.");
      if (isApiError(e) && e.status === 409) {
        setConflict(true);
        setComparison(null);
        await loadComparison();
      }
    } finally {
      if (alive.current) setSaving(false);
    }
  }
  const feedback = (
    <>
      {(draft.candidate || dirty) && (
        <DeviceDraftControls draft={draft} label="связи" />
      )}
      {error && !conflict && (
        <p className="form-error" role="alert">
          {error} Выбор и пояснение остаются в редакторе.
        </p>
      )}
      {conflict && (
        <section
          className="card mini relation-conflict"
          aria-label="Конфликт связей"
          role="alert"
        >
          <h3>Связи изменились на сервере</h3>
          <p>
            Ваши правки не отправлены. Сравните пояснения перед повторным
            сохранением.
          </p>
          {comparison ? (
            <>
              <div className="relation-comparison">
                <section tabIndex={0} aria-label="Моё пояснение">
                  <h4>Моё пояснение</h4>
                  <p>{reason || "Без пояснения"}</p>
                </section>
                <section tabIndex={0} aria-label="Пояснение на сервере">
                  <h4>Сейчас на сервере</h4>
                  {editing ? (
                    <p>
                      {comparison.items.find((i) => i.id === editing)?.reason ||
                        "Связь удалена или не имеет пояснения."}
                    </p>
                  ) : comparison.items.filter((i) => selected[i.id]).length ? (
                    comparison.items
                      .filter((i) => selected[i.id])
                      .map((i) => (
                        <p key={i.id}>
                          <strong>{i.label}</strong>:{" "}
                          {i.reason || "Без пояснения"}
                        </p>
                      ))
                  ) : (
                    <p>
                      Выбранные записи пока не связаны. Изменилась другая часть
                      кампании.
                    </p>
                  )}
                </section>
              </div>
              <button
                className="ghost"
                type="button"
                disabled={saving}
                onClick={() => {
                  setEditRevision(comparison.revision);
                  setBaselineReason(
                    comparison.items.find((i) => i.id === editing)?.reason ||
                      "",
                  );
                  setConflict(false);
                  setComparison(null);
                  setError("");
                }}
              >
                Продолжить с моими правками
              </button>
              <p className="copy">
                Это не сохраняет изменения. Затем нажмите нужное действие внизу
                окна.
              </p>
            </>
          ) : (
            <>
              <p>{error}</p>
              <button
                className="ghost"
                type="button"
                disabled={saving}
                onClick={() => void loadComparison()}
              >
                Загрузить текущие связи
              </button>
            </>
          )}
        </section>
      )}
    </>
  );
  const inlineSurface = (
    <div
      className="relation-inplace"
      aria-label="Редактирование пояснения связи"
    >
      <InPlaceText
        value={reason}
        editing={!saving}
        multiline
        label="Пояснение связи"
        onChange={setReason}
      />
      <small>{reason.length}/2000</small>
      {reason.length > 2000 && (
        <p role="alert">Сократите пояснение до 2000 символов.</p>
      )}
      {feedback}
      <div className="actions">
        <button
          className="ghost"
          type="button"
          disabled={saving}
          onClick={() => void close()}
        >
          Отмена
        </button>
        <button
          className="primary"
          type="button"
          disabled={
            blocked ||
            Boolean(draft.candidate) ||
            editRevision === null ||
            reason.length > 2000
          }
          onClick={() => void save(editing ?? undefined)}
        >
          Сохранить пояснение
        </button>
        <button
          className="ghost"
          type="button"
          disabled={blocked || Boolean(draft.candidate)}
          onClick={() => void save(editing ?? undefined, true)}
        >
          Убрать связь
        </button>
      </div>
    </div>
  );
  return (
    <section
      className={`entity-relations-manager${compact ? " relations-compact" : ""}`}
      aria-label="Управление связями"
    >
      <div className="record-block-heading">
        <h2>
          Связи <small>{items.length}</small>
        </h2>
        <button
          type="button"
          className="ghost"
          onClick={() => begin()}
          disabled={revision === null || Boolean(inlineEdit && open)}
        >
          + Добавить связь
        </button>
      </div>
      {!open && error && (
        <div>
          <p role="alert">{error}</p>
          <button
            className="ghost"
            onClick={() => {
              setError("");
              setLoadAttempt((n) => n + 1);
            }}
          >
            Повторить загрузку связей
          </button>
        </div>
      )}
      {items.length > 8 && (
        <input
          type="search"
          className="input"
          disabled={Boolean(inlineEdit && open && editing)}
          aria-label="Поиск по имеющимся связям"
          placeholder="Найти среди связей"
          value={relatedQuery}
          onChange={(e) => {
            setRelatedQuery(e.target.value);
            setVisibleCount(8);
          }}
        />
      )}
      {items.length ? (
        filtered.slice(0, visibleCount).map((item) => {
          const linked = onResolve?.(item);
          return (
            <div className="relation-row" key={item.id}>
              <button
                type="button"
                className="record-context-link"
                onClick={() => onOpen(item)}
              >
                {linked?.art?.url && (
                  <span className="relation-thumbnail" aria-hidden="true">
                    <EntityVisual entity={linked} variant="relation" />
                  </span>
                )}
                <span>
                  <small>{kindTitle[item.kind]}</small>
                  <strong>{item.label}</strong>
                  {!compact && item.reason && <small>{item.reason}</small>}
                </span>
              </button>
              <button
                className="ghost relation-edit"
                type="button"
                aria-label={`Изменить связь: ${item.label}`}
                disabled={Boolean(inlineEdit && open && editing !== item.id)}
                onClick={() => {
                  if (inlineEdit && open && editing === item.id) return;
                  begin(item);
                }}
                title={compact ? "Изменить связь" : undefined}
              >
                {compact ? <Pencil size={14} aria-hidden="true" /> : "Изменить"}
              </button>
              {compact &&
                (item.reason ||
                  (inlineEdit && open && editing === item.id)) && (
                  <details
                    open={
                      (inlineEdit && open && editing === item.id) || undefined
                    }
                    className="relation-explanation"
                  >
                    <summary>Пояснение</summary>
                    {inlineEdit && open && editing === item.id ? (
                      inlineSurface
                    ) : (
                      <p>{item.reason}</p>
                    )}
                  </details>
                )}
            </div>
          );
        })
      ) : revision === null && !error ? (
        <p role="status" className="copy">
          Загружаем связи…
        </p>
      ) : (
        <p className="copy">
          Свяжите записи, чтобы быстро переходить между местами, героями и
          сюжетами.
        </p>
      )}
      {items.length > 0 && !filtered.length && (
        <p className="copy">Таких связей нет.</p>
      )}
      {filtered.length > visibleCount && (
        <button
          type="button"
          className="ghost"
          onClick={() => setVisibleCount((n) => n + 8)}
        >
          Показать ещё · {filtered.length - visibleCount}
        </button>
      )}
      {inlineEdit &&
        compact &&
        open &&
        editing &&
        !filtered
          .slice(0, visibleCount)
          .some((item) => item.id === editing) && (
          <section>
            <p>
              Связь больше не отображается в списке. Ваше пояснение осталось
              доступно.
            </p>
            {inlineSurface}
          </section>
        )}
      {open && !(inlineEdit && compact && editing) && (
        <AppModal
          initialFocus={editing ? "textarea" : "input[type=search]"}
          label={editing ? "Изменить связь" : "Добавить связи"}
          onClose={() => void close()}
        >
          <div className="relation-picker">
            <header className="record-block-heading">
              <h2>{editing ? "Связь с записью" : "Добавить связи"}</h2>
              <button
                className="ghost"
                type="button"
                aria-label="Закрыть связи"
                onClick={() => void close()}
              >
                Закрыть
              </button>
            </header>
            <div className="relation-picker-body">
              <p className="copy">
                {editing
                  ? items.find((i) => i.id === editing)?.label ||
                    "Связь из черновика"
                  : `Для «${entity.title}». Связи появятся у обеих записей.`}
              </p>
              {!editing && (
                <>
                  <div className="relation-search">
                    <label>
                      Поиск
                      <input
                        autoFocus
                        disabled={saving}
                        className="input"
                        type="search"
                        value={q}
                        onChange={(e) => {
                          setQ(e.target.value);
                          setPage("");
                          setResults([]);
                        }}
                        placeholder="Название, описание или тег"
                      />
                    </label>
                    <label>
                      Тип записи
                      <select
                        disabled={saving}
                        className="input"
                        value={kind}
                        onChange={(e) => {
                          setKind(e.target.value);
                          setPage("");
                          setResults([]);
                        }}
                      >
                        <option value="all">Все записи</option>
                        {(
                          [
                            "location",
                            "npc",
                            "quest",
                            "player",
                            "monster",
                            "lore",
                          ] as const
                        ).map((k) => (
                          <option key={k} value={k}>
                            {k === "lore" ? "Заметки" : kindTitle[k]}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <div className="relation-search-results" aria-busy={loading}>
                    {results.map((e) => {
                      const linked = items.some((i) => i.id === e.id);
                      return (
                        <label
                          className={`relation-result ${selected[e.id] ? "selected" : ""}`}
                          key={e.id}
                        >
                          <input
                            type="checkbox"
                            disabled={
                              linked ||
                              blocked ||
                              (!selected[e.id] &&
                                Object.keys(selected).length >= 100)
                            }
                            checked={linked || Boolean(selected[e.id])}
                            onChange={() =>
                              setSelected((old) => {
                                const next = { ...old };
                                if (next[e.id]) delete next[e.id];
                                else next[e.id] = e.title;
                                return next;
                              })
                            }
                          />
                          {e.art?.url && (
                            <span
                              className="relation-thumbnail"
                              aria-hidden="true"
                            >
                              <EntityVisual entity={e} variant="relation" />
                            </span>
                          )}
                          <span>
                            <small>
                              {kindTitle[e.kind]}
                              {linked ? " · Уже связано" : ""}
                            </small>
                            <strong>{e.title}</strong>
                            <small className="relation-result-summary">
                              {e.summary.length > 140
                                ? `${e.summary.slice(0, 140).replace(/\s+\S*$/, "")}…`
                                : e.summary}
                            </small>
                          </span>
                        </label>
                      );
                    })}
                    {loading && <p role="status">Ищем записи…</p>}
                    {!loading && !results.length && (
                      <p>Записей по этому запросу нет.</p>
                    )}
                    {cursor && (
                      <button
                        type="button"
                        className="ghost"
                        disabled={loading}
                        onClick={() => setPage(cursor)}
                      >
                        Показать ещё
                      </button>
                    )}
                  </div>
                </>
              )}
              {!editing && Object.keys(selected).length > 0 && (
                <div
                  className="relation-selected"
                  aria-label="Выбранные записи"
                >
                  {Object.entries(selected).map(([id, title]) => (
                    <button
                      disabled={blocked}
                      className="ghost"
                      type="button"
                      key={id}
                      aria-label={`Убрать из выбора: ${title}`}
                      onClick={() =>
                        setSelected((old) => {
                          const next = { ...old };
                          delete next[id];
                          return next;
                        })
                      }
                    >
                      {title} ×
                    </button>
                  ))}
                </div>
              )}
              {!editing && Object.keys(selected).length >= 100 && (
                <p className="copy" role="status">
                  Выбрано 100 записей. Сохраните этот набор, затем добавьте
                  остальные.
                </p>
              )}
              <label>
                Пояснение <span className="muted">· необязательно</span>
                <textarea
                  disabled={saving}
                  className="input"
                  maxLength={2000}
                  rows={2}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Например: живёт здесь или выдаёт квест"
                />
              </label>
              {feedback}
            </div>
            <footer className="actions">
              {editing && (
                <button
                  className="ghost danger"
                  type="button"
                  disabled={blocked || Boolean(draft.candidate)}
                  onClick={() => void save(editing, true)}
                >
                  Убрать связь
                </button>
              )}
              <button
                className="ghost"
                type="button"
                disabled={saving}
                onClick={() => void close()}
              >
                Отмена
              </button>
              <button
                className="primary"
                type="button"
                disabled={
                  blocked ||
                  Boolean(draft.candidate) ||
                  editRevision === null ||
                  (!editing && !Object.keys(selected).length)
                }
                onClick={() => void save(editing ?? undefined)}
              >
                {saving
                  ? "Сохраняем…"
                  : editing
                    ? "Сохранить пояснение"
                    : `Связать · ${Object.keys(selected).length}`}
              </button>
            </footer>
          </div>
        </AppModal>
      )}
    </section>
  );
}

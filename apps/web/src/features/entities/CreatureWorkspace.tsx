import { extractPlainTextFromPlayerFacingHTML } from "../../player-facing-rich";
import {
  useEffect,
  useId,
  useRef,
  useState,
  useMemo,
  type ReactNode,
} from "react";
import type {
  CampaignData,
  CreateEntityInput,
  KnowledgeEntity,
  NpcEntity,
  MonsterEntity,
  NpcStatBlock,
  RelatedEntity,
  StatBlockEntry,
} from "@shadow-edge/shared-types";
import type { EntityEditorController } from "./useEntityEditorController";
import type {
  EntityEditorNavigation,
  StatEntrySectionKey,
} from "./entity.types";
import { InPlaceText } from "./InPlaceText";
import { createEmptyNpcStatBlock } from "./entity.utils";
import { EntityConflictReview } from "./EntityConflictReview";
import { DeviceDraftControls } from "../../app/DeviceDraftControls";
import { EntityRelationsPanel } from "../entity-links/EntityRelationsPanel";
import { MediaThumbnail } from "../entity-images/MediaThumbnail";
import {
  ImageZoomDialog,
  RecordIllustration,
} from "../entity-images/RecordIllustration";
import { CardAppearance } from "./CardAppearance";
import { ActionMenu } from "../../app/ActionMenu";
import "./creature-workspace.css";

type Props = {
  entity: NpcEntity | MonsterEntity;
  campaign: CampaignData;
  ownerId: string;
  controller: EntityEditorController;
  navigation?: EntityEditorNavigation;
  saving: boolean;
  error: string;
  onStart: (section?: string) => void;
  onClose: () => void;
  onChanged: (campaign: CampaignData) => void;
  onOpen: (id: string) => void;
  onResolve: (r: RelatedEntity) => KnowledgeEntity | null;
  onAI: () => void;
  pinned: boolean;
  onPin: () => void;
  onPreview: () => void;
  onCreateQuest: () => void;
  onShowCard: (index: number) => void;
  onGallery: (index: number) => void;
  onPlay: (index: number) => void;
  onStop: () => void;
  playbackLabel: string;
  playlistActive: boolean;
};
const abilityNames = [
  ["str", "СИЛ"],
  ["dex", "ЛОВ"],
  ["con", "ТЕЛ"],
  ["int", "ИНТ"],
  ["wis", "МДР"],
  ["cha", "ХАР"],
] as const;
const sectionTab = (section?: string) =>
  (
    ({
      stats: "stats",
      content: "notes",
      cards: "cards",
      rewards: "rewards",
      art: "media",
      gallery: "media",
      playlist: "media",
      media: "media",
    }) as Record<string, string>
  )[section || ""] || "overview";
const labels: Record<string, string> = {
  neutral: "Нейтральный",
  "lawful good": "Законопослушный добрый",
  "neutral good": "Нейтральный добрый",
  "chaotic good": "Хаотичный добрый",
  "lawful neutral": "Законопослушный нейтральный",
  "chaotic neutral": "Хаотичный нейтральный",
  "lawful evil": "Законопослушный злой",
  "neutral evil": "Нейтральный злой",
  "chaotic evil": "Хаотичный злой",
  unaligned: "Без мировоззрения",
  Medium: "Средний",
  Tiny: "Крошечный",
  Small: "Маленький",
  Large: "Большой",
  Huge: "Огромный",
  Gargantuan: "Громадный",
  Ally: "Союзник",
  Watcher: "Наблюдатель",
  Threat: "Угроза",
  Unknown: "Не определён",
  Hostile: "Враждебный",
  Territorial: "Охраняет территорию",
  Summoned: "Призван",
  Neutral: "Нейтральный",
  Background: "Фоновый",
  Major: "Важный",
  Critical: "Ключевой",
  Minion: "Приспешник",
  Standard: "Обычный",
  Elite: "Элитный",
  Boss: "Босс",
};

/** A select keeps the same text slot in both modes and retains nonstandard imported values. */
function ValueSelect({
  value,
  onChange,
  editing,
  label,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  editing: boolean;
  label: string;
  options: string[] | Array<[string, string]>;
}) {
  const items = options
    .map((item) =>
      typeof item === "string" ? [item, labels[item] || item || "—"] : item,
    )
    .filter(([key, title]) => key === value || title !== value);
  if (!items.some(([key]) => key === value))
    items.unshift([value, labels[value] || value || "—"]);
  return (
    <select
      className="creature-select"
      aria-label={label}
      disabled={!editing}
      value={value}
      onChange={(event) => onChange(event.target.value)}
    >
      {items.map(([key, title]) => (
        <option key={key} value={key}>
          {title}
        </option>
      ))}
    </select>
  );
}

function InPlaceTags({
  tags,
  editing,
  onChange,
}: {
  tags: string[];
  editing: boolean;
  onChange: (tags: string[]) => void;
}) {
  const typed = useRef<{ raw: string; signature: string } | null>(null),
    signature = JSON.stringify(tags);
  const value =
    editing && typed.current?.signature === signature
      ? typed.current.raw
      : tags.join(", ");
  return (
    <InPlaceText
      value={value}
      editing={editing}
      label="Теги через запятую"
      onChange={(raw) => {
        const next = raw
          .split(",")
          .map((v) => v.trim())
          .filter(Boolean);
        typed.current = { raw, signature: JSON.stringify(next) };
        onChange(next);
      }}
    />
  );
}

export function CreatureWorkspace(p: Props) {
  const { entity, controller: c } = p;
  const editing =
    c.entityModalOpen && c.editingEntityId === entity.id && c.isEditingEntity;
  const locked =
      p.saving ||
      c.entityFormImageUploading ||
      c.playerCardFormattingIndex !== null,
    enabled = editing && !locked;
  const form: CreateEntityInput = editing ? c.entityForm : entity;
  const [previewImage, setPreviewImage] = useState<{
    url: string;
    title: string;
  } | null>(null);
  const [tab, setTab] = useState(
    entity.kind === "monster" ? "stats" : "overview",
  );
  const tabs = [
    ["overview", "Обзор"],
    ["stats", "Статблок"],
    ["cards", "Карточки"],
    ["rewards", "Награды"],
    ["media", "Медиа"],
    ["notes", "Мастеру"],
  ];
  const id = useId(),
    notices = useRef<HTMLDivElement>(null),
    preserveTab = useRef<string | null>(null),
    artInput = useRef<HTMLInputElement>(null);
  const entities = useMemo(() => {
    const result = new Map(
      p.campaign.locations.map(
        (e) => [e.title.toLocaleLowerCase(), e] as [string, KnowledgeEntity],
      ),
    );
    for (const list of [
      p.campaign.npcs,
      p.campaign.players,
      p.campaign.monsters,
      p.campaign.quests,
      p.campaign.lore,
    ])
      for (const e of list) result.set(e.title.toLocaleLowerCase(), e);
    return result;
  }, [
    p.campaign.locations,
    p.campaign.npcs,
    p.campaign.players,
    p.campaign.monsters,
    p.campaign.quests,
    p.campaign.lore,
  ]);
  const readOnly = Boolean(p.campaign.readyCampaign);
  useEffect(() => {
    if (p.navigation?.entityId === entity.id) {
      setTab(preserveTab.current || sectionTab(p.navigation.section));
      preserveTab.current = null;
    }
  }, [p.navigation, entity.id]);
  useEffect(() => {
    if (editing && (p.error || c.conflict || c.deviceDraft.candidate))
      notices.current?.scrollIntoView({ block: "nearest" });
  }, [editing, p.error, c.conflict, c.deviceDraft.candidate]);
  const field = (
    key:
      "title" | "subtitle" | "summary" | "content" | "role" | "playerContent",
    label: string,
    rich = false,
    className = "",
  ) => (
    <InPlaceText
      value={String(form[key] || "")}
      editing={enabled}
      label={label}
      rich={rich}
      multiline={rich || key === "summary"}
      onChange={(value) => c.setEntityForm((old) => ({ ...old, [key]: value }))}
      entities={entities}
      onOpen={p.onOpen}
      className={className}
    />
  );
  const text = (
    value: string | undefined,
    label: string,
    change: (v: string) => void,
    rich = false,
  ) => (
    <InPlaceText
      value={value || ""}
      label={label}
      editing={enabled}
      onChange={change}
      rich={rich}
      multiline={rich}
      entities={entities}
      onOpen={p.onOpen}
    />
  );
  const stat = form.statBlock;
  const patchStat = (patch: Partial<NpcStatBlock>) =>
    c.updateNpcStatBlock((old) => ({ ...old, ...patch }));
  const statText = (key: keyof NpcStatBlock, label: string) => {
    if (key === "alignment" || key === "challenge")
      return (
        <ValueSelect
          value={(stat?.[key] as string) || ""}
          label={label}
          editing={enabled}
          onChange={(value) => patchStat({ [key]: value })}
          options={
            key === "alignment"
              ? [
                  "lawful good",
                  "neutral good",
                  "chaotic good",
                  "lawful neutral",
                  "neutral",
                  "chaotic neutral",
                  "lawful evil",
                  "neutral evil",
                  "chaotic evil",
                  "unaligned",
                ]
              : [
                  "",
                  "0",
                  "1/8",
                  "1/4",
                  "1/2",
                  ...Array.from({ length: 30 }, (_, i) => String(i + 1)),
                ]
          }
        />
      );
    return text(stat?.[key] as string | undefined, label, (value) =>
      patchStat({ [key]: value }),
    );
  };
  const start = (section = tab) => {
    preserveTab.current = tab;
    p.onStart(
      (
        {
          overview: "summary",
          notes: "content",
          cards: "cards",
          stats: "stats",
          rewards: "rewards",
          media: "gallery",
        } as Record<string, string>
      )[section] || section,
    );
  };
  const action = (section: string) =>
    !readOnly && (
      <button
        className="ghost creature-edit"
        disabled={locked}
        type="button"
        onClick={() => start(section)}
      >
        {editing ? "Продолжить правки" : "Редактировать"}
      </button>
    );
  const panel = (key: string, children: ReactNode) => (
    <section
      hidden={tab !== key}
      role="tabpanel"
      tabIndex={0}
      id={`${id}-panel-${key}`}
      aria-labelledby={`${id}-tab-${key}`}
      className="creature-tab-panel"
    >
      {children}
    </section>
  );
  const profile = (
    <section className="creature-statblock" aria-label="Статблок существа">
      <div className="creature-section-head">
        <h2>Боевой профиль</h2>
        {!stat && !readOnly ? (
          <button
            className="ghost"
            type="button"
            disabled={locked}
            onClick={() => {
              if (!editing) start("stats");
              patchStat(createEmptyNpcStatBlock());
            }}
          >
            Добавить статблок
          </button>
        ) : (
          action("stats")
        )}
      </div>
      {stat ? (
        <>
          <div className="creature-type-line">
            <ValueSelect
              value={stat.size}
              label="Размер"
              editing={enabled}
              onChange={(size) => patchStat({ size })}
              options={[
                "Tiny",
                "Small",
                "Medium",
                "Large",
                "Huge",
                "Gargantuan",
              ]}
            />
            {statText("creatureType", "Тип существа")}
            {statText("alignment", "Мировоззрение")}
          </div>
          <dl className="creature-metrics">
            {(
              [
                ["armorClass", "Класс доспеха"],
                ["hitPoints", "Хиты"],
                ["speed", "Скорость"],
                ["proficiencyBonus", "Мастерство"],
                ["challenge", "Опасность / CR"],
              ] as const
            ).map(([key, label]) => (
              <div key={key}>
                <dt>{label}</dt>
                <dd>{statText(key, label)}</dd>
              </div>
            ))}
          </dl>
          <dl className="creature-abilities">
            {abilityNames.map(([key, label]) => {
              const score = stat.abilityScores?.[key] ?? 10,
                mod = Math.floor((score - 10) / 2);
              return (
                <div key={key}>
                  <dt>{label}</dt>
                  <dd>
                    <ValueSelect
                      value={String(score)}
                      label={label}
                      editing={enabled}
                      onChange={(value) => c.updateNpcAbilityScore(key, value)}
                      options={Array.from({ length: 31 }, (_, i) => String(i))}
                    />
                    <small>
                      {mod >= 0 ? "+" : ""}
                      {mod}
                    </small>
                  </dd>
                </div>
              );
            })}
          </dl>
        </>
      ) : (
        <p className="copy">Характеристики пока не добавлены.</p>
      )}
    </section>
  );
  const statEntries = (section: StatEntrySectionKey, title: string) => (
    <section className="creature-entries">
      <div className="creature-section-head">
        <h3>{title}</h3>
        {enabled && (
          <button
            className="ghost"
            onClick={() => c.addNpcStatEntry(section)}
            type="button"
          >
            + Добавить
          </button>
        )}
      </div>
      {(stat?.[section] || []).map((entry: StatBlockEntry, index: number) => (
        <article key={index} className="creature-entry">
          <div className="creature-section-head">
            <h4>
              {text(entry.name, `${title} ${index + 1}: название`, (name) =>
                c.updateNpcStatEntry(section, index, { name }),
              )}
            </h4>
            {enabled && (
              <button
                type="button"
                className="ghost"
                aria-label={`Убрать ${title.toLowerCase()} ${index + 1}`}
                onClick={() => c.removeNpcStatEntry(section, index)}
              >
                Убрать
              </button>
            )}
          </div>
          {entry.subtitle &&
            text(
              entry.subtitle,
              `${title} ${index + 1}: подзаголовок`,
              (subtitle) => c.updateNpcStatEntry(section, index, { subtitle }),
            )}
          <div className="creature-entry-metrics">
            {(
              [
                ["toHit", "Попадание"],
                ["damage", "Урон"],
                ["saveDc", "СЛ спасброска"],
              ] as const
            )
              .filter(([key]) => entry[key])
              .map(([key, label]) => (
                <label key={key}>
                  <small>{label}</small>
                  {text(
                    entry[key],
                    `${title} ${index + 1}: ${label}`,
                    (value) =>
                      c.updateNpcStatEntry(section, index, { [key]: value }),
                  )}
                </label>
              ))}
          </div>
          {text(
            entry.description,
            `${title} ${index + 1}: описание`,
            (description) =>
              c.updateNpcStatEntry(section, index, { description }),
            true,
          )}
          <details className="creature-entry-extra">
            <summary>Параметры</summary>
            <div className="creature-entry-metrics">
              {(
                [
                  ["subtitle", "Подзаголовок"],
                  ["toHit", "Попадание"],
                  ["damage", "Урон"],
                  ["saveDc", "СЛ спасброска"],
                ] as const
              ).map(([key, label]) => (
                <label key={key}>
                  <small>{label}</small>
                  {text(
                    entry[key],
                    `${title} ${index + 1}: дополнить ${label}`,
                    (value) =>
                      c.updateNpcStatEntry(section, index, { [key]: value }),
                  )}
                </label>
              ))}
            </div>
          </details>
        </article>
      ))}
      {!(stat?.[section] || []).length && <p className="copy">Не добавлены.</p>}
    </section>
  );
  const reward = form.rewardProfile;
  const cards = form.playerCards || [];
  const quests = p.campaign.quests.filter(
    (q) =>
      q.issuerId === entity.id || q.related?.some((r) => r.id === entity.id),
  );
  return (
    <div
      className={`creature-workspace ${editing ? "is-editing" : ""}`}
      onKeyDown={(event) => {
        if (
          editing &&
          (event.ctrlKey || event.metaKey) &&
          event.key.toLowerCase() === "s"
        ) {
          event.preventDefault();
          if (
            !locked &&
            !c.conflict &&
            !c.deviceDraft.candidate &&
            form.title.trim()
          )
            void c.submitEntity();
        }
      }}
    >
      <div className="creature-main">
        <header className="creature-heading">
          <div>
            <span className="creature-eyebrow">
              {entity.kind === "npc" ? "НПС" : "Монстр"}
            </span>
            <h1>{field("title", "Название", false, "creature-title")}</h1>
            {field("subtitle", "Подзаголовок")}
            <details className="creature-tags">
              <summary>Теги · {(form.tags || []).length}</summary>
              <InPlaceTags
                tags={form.tags || []}
                editing={enabled}
                onChange={(tags) =>
                  c.setEntityForm((old) => ({ ...old, tags }))
                }
              />
            </details>
          </div>
          <div className="creature-portrait">
            <RecordIllustration
              compact
              url={form.art?.url}
              title={form.title}
              alt={form.art?.alt || form.art?.caption}
              onReplace={
                readOnly
                  ? undefined
                  : () => {
                      start("art");
                      preserveTab.current = "media";
                      setTab("media");
                    }
              }
              onGallery={() => setTab("media")}
            />
          </div>
          <div className="creature-heading-actions">
            {!editing && !readOnly && (
              <button
                className="primary"
                disabled={locked}
                onClick={() => start()}
                type="button"
              >
                Редактировать
              </button>
            )}
            {!editing && (
              <ActionMenu label="Действия" ariaLabel="Действия с существом">
                <button className="ghost" type="button" onClick={p.onPin}>
                  {p.pinned ? "Убрать закладку" : "В закладки"}
                </button>
                <button className="ghost" type="button" onClick={p.onPreview}>
                  Быстрый просмотр
                </button>
                {entity.kind === "npc" && !readOnly && (
                  <button
                    className="ghost"
                    type="button"
                    onClick={p.onCreateQuest}
                  >
                    Создать квест для НПС
                  </button>
                )}
                {!readOnly && (
                  <button className="ghost" onClick={p.onAI} type="button">
                    Изменить с AI
                  </button>
                )}
              </ActionMenu>
            )}
            {editing && (
              <>
                <button
                  className="ghost"
                  disabled={locked}
                  onClick={p.onClose}
                  type="button"
                >
                  Отмена
                </button>
                <button
                  className="primary"
                  disabled={
                    locked ||
                    Boolean(c.conflict) ||
                    Boolean(c.deviceDraft.candidate) ||
                    !form.title.trim()
                  }
                  onClick={() => void c.submitEntity()}
                  type="button"
                >
                  {p.saving ? "Сохраняю…" : "Сохранить"}
                </button>
              </>
            )}
          </div>
        </header>
        <div className="creature-save-strip">
          <span>
            {editing
              ? "Правьте текст на странице · Ctrl / ⌘ S — сохранить"
              : "Сохранённая запись"}
          </span>
          {editing && (
            <details className="creature-draft-menu">
              <summary>
                {c.deviceDraft.candidate
                  ? "Найден черновик"
                  : "Черновик на устройстве"}
              </summary>
              <div>
                <DeviceDraftControls draft={c.deviceDraft} />
              </div>
            </details>
          )}
        </div>
        {editing && (p.error || c.conflict || c.deviceDraft.candidate) && (
          <div ref={notices} className="creature-edit-status">
            {c.deviceDraft.candidate && (
              <p role="alert">
                Выберите сохранённую копию в меню «Найден черновик», чтобы
                продолжить сохранение.
              </p>
            )}
            {p.error && !c.conflict && (
              <p className="form-error" role="alert">
                {p.error} Правки остались на странице.
              </p>
            )}
            {c.conflict && c.comparisonServer && (
              <EntityConflictReview
                base={c.comparisonBase}
                local={c.entityForm}
                server={c.comparisonServer}
                choices={c.comparisonChoices}
                onChoose={c.chooseComparison}
                onChooseAll={c.chooseAllComparisons}
                onPrepare={c.useComparedDraft}
                resolve={(key) =>
                  c.comparisonEntityTitles.get(key)?.title || key
                }
              />
            )}
          </div>
        )}
        <div
          className="creature-tabs"
          role="tablist"
          aria-label="Разделы существа"
          onKeyDown={(event) => {
            if (
              !["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key) ||
              !(event.target instanceof HTMLButtonElement)
            )
              return;
            event.preventDefault();
            const i = tabs.findIndex(([key]) => key === tab),
              next =
                event.key === "Home"
                  ? 0
                  : event.key === "End"
                    ? tabs.length - 1
                    : (i +
                        (event.key === "ArrowRight" ? 1 : -1) +
                        tabs.length) %
                      tabs.length;
            setTab(tabs[next][0]);
            document.getElementById(`${id}-tab-${tabs[next][0]}`)?.focus();
          }}
        >
          {tabs.map(([key, label]) => (
            <button
              type="button"
              role="tab"
              key={key}
              id={`${id}-tab-${key}`}
              aria-controls={`${id}-panel-${key}`}
              aria-selected={tab === key}
              tabIndex={tab === key ? 0 : -1}
              onClick={() => setTab(key)}
            >
              {label}
            </button>
          ))}
        </div>
        {panel(
          "overview",
          <>
            <section className="creature-overview">
              <div className="creature-section-head">
                <h2>О существе</h2>
                {action("overview")}
              </div>
              {field("summary", "Краткое описание", true)}
              <dl className="creature-facts">
                <div>
                  <dt>Роль</dt>
                  <dd>{field("role", "Роль")}</dd>
                </div>
                <div>
                  <dt>Отношение</dt>
                  <dd>
                    <ValueSelect
                      value={form.status || ""}
                      editing={enabled}
                      label="Отношение"
                      options={
                        entity.kind === "npc"
                          ? ["Ally", "Watcher", "Threat", "Unknown"]
                          : ["Hostile", "Territorial", "Summoned", "Neutral"]
                      }
                      onChange={(value) =>
                        c.setEntityForm((old) => ({
                          ...old,
                          status: value as CreateEntityInput["status"],
                        }))
                      }
                    />
                  </dd>
                </div>
                <div>
                  <dt>Значимость</dt>
                  <dd>
                    <ValueSelect
                      value={form.importance || ""}
                      label="Значимость"
                      editing={enabled}
                      options={
                        entity.kind === "npc"
                          ? ["Background", "Major", "Critical"]
                          : ["Minion", "Standard", "Elite", "Boss"]
                      }
                      onChange={(value) =>
                        c.setEntityForm((old) => ({
                          ...old,
                          importance: value as CreateEntityInput["importance"],
                        }))
                      }
                    />
                  </dd>
                </div>
                <div>
                  <dt>Где найти</dt>
                  <dd>
                    <ValueSelect
                      value={form.locationId || ""}
                      label="Где найти"
                      editing={enabled}
                      options={[
                        ["", "Не указано"],
                        ...p.campaign.locations.map(
                          (l) => [l.id, l.title] as [string, string],
                        ),
                      ]}
                      onChange={(locationId) =>
                        c.setEntityForm((old) => ({ ...old, locationId }))
                      }
                    />
                  </dd>
                </div>
              </dl>
            </section>
            {profile}
            {quests.length > 0 && (
              <section>
                <h2>Связанные квесты</h2>
                {quests.map((q) => (
                  <button
                    className="creature-related-quest"
                    key={q.id}
                    onClick={() => p.onOpen(q.id)}
                    type="button"
                  >
                    {q.title}
                    <span>Открыть →</span>
                  </button>
                ))}
              </section>
            )}
          </>,
        )}
        {panel(
          "stats",
          <>
            {profile}
            {stat && (
              <>
                <dl className="creature-stat-details">
                  {(
                    [
                      ["savingThrows", "Спасброски"],
                      ["skills", "Навыки"],
                      ["senses", "Чувства"],
                      ["languages", "Языки"],
                      ["resistances", "Сопротивления"],
                      ["immunities", "Иммунитеты"],
                      ["conditionImmunities", "Иммунитеты к состояниям"],
                    ] as const
                  ).map(([key, label]) => (
                    <div key={key}>
                      <dt>{label}</dt>
                      <dd>{statText(key, label)}</dd>
                    </div>
                  ))}
                </dl>
                {statEntries("traits", "Особенности")}
                {statEntries("actions", "Действия")}
                {statEntries("bonusActions", "Бонусные действия")}
                {statEntries("reactions", "Реакции")}
                <section>
                  <div className="creature-section-head">
                    <h3>Заклинания</h3>
                    {enabled && !stat.spellcasting && (
                      <button
                        className="ghost"
                        onClick={() => c.setSpellcastingEnabled(true)}
                        type="button"
                      >
                        + Добавить магию
                      </button>
                    )}
                  </div>
                  {stat.spellcasting ? (
                    <>
                      <h4>
                        {text(
                          stat.spellcasting.title,
                          "Название магии",
                          (title) =>
                            c.updateNpcSpellcasting((s) => ({ ...s, title })),
                        )}
                      </h4>
                      <dl className="creature-metrics">
                        {(
                          [
                            ["ability", "Характеристика магии"],
                            ["saveDc", "СЛ заклинаний"],
                            ["attackBonus", "Атака заклинаниями"],
                          ] as const
                        ).map(([key, label]) => (
                          <div key={key}>
                            <dt>{label}</dt>
                            <dd>
                              {text(stat.spellcasting?.[key], label, (value) =>
                                c.updateNpcSpellcasting((s) => ({
                                  ...s,
                                  [key]: value,
                                })),
                              )}
                            </dd>
                          </div>
                        ))}
                      </dl>
                      {text(
                        stat.spellcasting.description,
                        "Описание магии",
                        (description) =>
                          c.updateNpcSpellcasting((s) => ({
                            ...s,
                            description,
                          })),
                        true,
                      )}
                      {
                        <InPlaceText
                          value={stat.spellcasting.spells.join("\n")}
                          multiline
                          editing={enabled}
                          label="Список заклинаний"
                          onChange={(value) =>
                            c.updateNpcSpellcasting((s) => ({
                              ...s,
                              spells: value.split("\n"),
                            }))
                          }
                        />
                      }
                      <div className="creature-slots">
                        {(stat.spellcasting.slots || []).map((slot, index) => (
                          <div key={index}>
                            {text(
                              slot.level,
                              `Уровень ячеек ${index + 1}`,
                              (level) => c.updateSpellSlot(index, { level }),
                            )}
                            {text(
                              slot.slots,
                              `Количество ячеек ${index + 1}`,
                              (slots) => c.updateSpellSlot(index, { slots }),
                            )}
                            {enabled && (
                              <button
                                type="button"
                                className="ghost"
                                onClick={() => c.removeSpellSlot(index)}
                              >
                                Убрать
                              </button>
                            )}
                          </div>
                        ))}
                        {enabled && (
                          <button
                            type="button"
                            className="ghost"
                            onClick={c.addSpellSlot}
                          >
                            + Ячейки
                          </button>
                        )}
                      </div>
                    </>
                  ) : (
                    <p className="copy">Не добавлены.</p>
                  )}
                </section>
              </>
            )}
          </>,
        )}
        {panel(
          "notes",
          <section>
            <div className="creature-section-head">
              <h2>Сведения мастера</h2>
              {action("notes")}
            </div>
            {field("content", "Сведения мастера", true)}
          </section>,
        )}
        {panel(
          "cards",
          <section>
            <div className="creature-section-head">
              <h2>Карточки и зачитки</h2>
              {action("cards")}
            </div>
            {!cards.length && form.playerContent && (
              <article className="creature-entry">
                {field("playerContent", "Зачитка игрокам", true)}
              </article>
            )}
            {cards.map((card, index) => (
              <article key={index} className="creature-entry">
                <h3>
                  {text(
                    card.title,
                    `Карточка ${index + 1}: название`,
                    (title) => c.updateEntityPlayerCard(index, { title }),
                  )}
                </h3>
                <InPlaceText
                  value={card.contentHtml || card.content}
                  editing={enabled}
                  label={`Карточка ${index + 1}: текст`}
                  rich
                  html={Boolean(card.contentHtml)}
                  multiline
                  entities={entities}
                  onOpen={p.onOpen}
                  onChange={(value) =>
                    c.updateEntityPlayerCard(
                      index,
                      card.contentHtml
                        ? {
                            contentHtml: value,
                            content:
                              extractPlainTextFromPlayerFacingHTML(value),
                          }
                        : { content: value, contentHtml: undefined },
                    )
                  }
                />
                <div className="actions">
                  {editing && (
                    <>
                      <button
                        className="ghost"
                        disabled={locked}
                        type="button"
                        onClick={() => void c.autoFormatEntityPlayerCard(index)}
                      >
                        {c.playerCardFormattingIndex === index
                          ? "Оформляю…"
                          : "Оформить с AI"}
                      </button>
                      <label className="ghost creature-upload">
                        Загрузить HTML
                        <input
                          type="file"
                          aria-label={`Загрузить HTML карточки ${index + 1}`}
                          accept=".html,.htm,text/html"
                          disabled={locked}
                          onChange={(event) =>
                            void c.handleEntityPlayerCardHtmlImport(
                              index,
                              event,
                            )
                          }
                        />
                      </label>
                    </>
                  )}
                  {!editing && (
                    <button
                      className="ghost"
                      type="button"
                      onClick={() => p.onShowCard(index)}
                    >
                      Показать игрокам
                    </button>
                  )}
                  {enabled && (
                    <button
                      className="ghost"
                      type="button"
                      onClick={() => c.removeEntityPlayerCard(index)}
                    >
                      Убрать карточку
                    </button>
                  )}
                </div>
              </article>
            ))}
            {!cards.length && !form.playerContent && (
              <p className="copy">
                Добавьте внешность, реплики и материалы без секретов мастера.
              </p>
            )}
            {enabled && (
              <button
                className="ghost"
                onClick={c.addEntityPlayerCard}
                type="button"
              >
                + Добавить карточку
              </button>
            )}
          </section>,
        )}
        {panel(
          "rewards",
          <section>
            <div className="creature-section-head">
              <h2>Награда и лут</h2>
              {action("rewards")}
            </div>
            <div
              className="creature-reward-summary"
              style={{
                color: reward?.textColor,
                background: reward?.backgroundColor,
              }}
            >
              {text(
                reward?.summary,
                "Описание наград",
                (summary) =>
                  c.updateEntityRewardProfile((r) => ({ ...r, summary })),
                true,
              )}
            </div>
            {enabled && (
              <details>
                <summary>Оформление наград</summary>
                <CardAppearance
                  textColor={reward?.textColor}
                  backgroundColor={reward?.backgroundColor}
                  onChange={(patch) =>
                    c.updateEntityRewardProfile((r) => ({ ...r, ...patch }))
                  }
                />
              </details>
            )}
            {(reward?.loot || []).map((loot, index) => (
              <article
                key={index}
                className="creature-entry creature-loot"
                style={{
                  color: loot.textColor,
                  background: loot.backgroundColor,
                }}
              >
                <h3>
                  {text(loot.name, `Лут ${index + 1}: название`, (name) =>
                    c.updateMonsterLootEntry(index, { name }),
                  )}
                </h3>
                <dl className="creature-facts">
                  {(
                    [
                      ["category", "Тип награды"],
                      ["quantity", "Количество"],
                      ["check", "Проверка"],
                      ["dc", "Сложность"],
                    ] as const
                  ).map(([key, label]) => (
                    <div key={key}>
                      <dt>{label}</dt>
                      <dd>
                        {text(
                          loot[key],
                          `Лут ${index + 1}: ${label}`,
                          (value) =>
                            c.updateMonsterLootEntry(index, { [key]: value }),
                        )}
                      </dd>
                    </div>
                  ))}
                </dl>
                {text(
                  loot.details,
                  `Лут ${index + 1}: описание`,
                  (details) => c.updateMonsterLootEntry(index, { details }),
                  true,
                )}
                {enabled && (
                  <div className="actions">
                    <details>
                      <summary>Оформление</summary>
                      <CardAppearance
                        textColor={loot.textColor}
                        backgroundColor={loot.backgroundColor}
                        onChange={(patch) =>
                          c.updateMonsterLootEntry(index, patch)
                        }
                      />
                    </details>
                    <button
                      className="ghost"
                      onClick={() => c.removeMonsterLootEntry(index)}
                      type="button"
                    >
                      Убрать награду
                    </button>
                  </div>
                )}
              </article>
            ))}
            {enabled && (
              <button
                className="ghost"
                onClick={c.addMonsterLootEntry}
                type="button"
              >
                + Добавить награду
              </button>
            )}
          </section>,
        )}
        {panel(
          "media",
          <>
            <details
              className="creature-art-source"
              open={(editing && p.navigation?.section === "art") || undefined}
            >
              <summary>Изображение и подпись</summary>
              {text(form.art?.url, "Ссылка на портрет", (url) =>
                c.setEntityForm((old) => ({
                  ...old,
                  art: { ...old.art, url },
                })),
              )}
              {text(form.art?.caption, "Подпись портрета", (caption) =>
                c.setEntityForm((old) => ({
                  ...old,
                  art: { ...old.art, url: old.art?.url || "", caption },
                })),
              )}
              {text(form.art?.alt, "Описание изображения", (alt) =>
                c.setEntityForm((old) => ({
                  ...old,
                  art: { ...old.art, url: old.art?.url || "", alt },
                })),
              )}
              {enabled && (
                <>
                  <input
                    ref={artInput}
                    className="creature-file-input"
                    type="file"
                    accept="image/*"
                    aria-label="Загрузить портрет"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) void c.uploadEntityArtFile(file);
                    }}
                  />
                  <button
                    className="ghost"
                    type="button"
                    onClick={() => artInput.current?.click()}
                  >
                    Загрузить портрет
                  </button>
                </>
              )}
            </details>

            <section>
              <div className="creature-section-head">
                <h2>Галерея</h2>
                {action("media")}
              </div>
              <div className="creature-gallery">
                {(form.gallery || []).map((image, index) => (
                  <article key={index}>
                    <button
                      type="button"
                      className="creature-gallery-image"
                      aria-label={`Открыть изображение ${index + 1}`}
                      onClick={() =>
                        editing
                          ? setPreviewImage({
                              url: image.url,
                              title: image.title,
                            })
                          : p.onGallery(index)
                      }
                    >
                      <MediaThumbnail
                        src={image.url}
                        alt={image.caption || image.title}
                      />
                    </button>
                    <h3>
                      {text(
                        image.title,
                        `Изображение ${index + 1}: название`,
                        (title) => c.updateEntityGalleryItem(index, { title }),
                      )}
                    </h3>
                    {text(
                      image.caption,
                      `Изображение ${index + 1}: подпись`,
                      (caption) =>
                        c.updateEntityGalleryItem(index, { caption }),
                    )}
                    <details>
                      <summary>Ссылка и файл</summary>
                      {text(
                        image.url,
                        `Изображение ${index + 1}: ссылка`,
                        (url) => c.updateEntityGalleryItem(index, { url }),
                      )}
                      {enabled && (
                        <>
                          <label className="ghost creature-upload">
                            Загрузить файл
                            <input
                              aria-label={`Загрузить изображение ${index + 1}`}
                              type="file"
                              accept="image/*"
                              onChange={(event) => {
                                const file = event.target.files?.[0];
                                if (file)
                                  void c.uploadEntityGalleryFile(index, file);
                              }}
                            />
                          </label>
                          <button
                            className="ghost"
                            type="button"
                            onClick={() => c.removeEntityGalleryItem(index)}
                          >
                            Убрать изображение
                          </button>
                        </>
                      )}
                    </details>
                  </article>
                ))}
              </div>
              {!form.gallery?.length && (
                <p className="copy">
                  Карты, письма и иллюстрации для этой записи.
                </p>
              )}
              {enabled && (
                <button
                  className="ghost"
                  type="button"
                  onClick={c.addEntityGalleryItem}
                >
                  + Изображение
                </button>
              )}
            </section>
            <section>
              <div className="creature-section-head">
                <h2>Музыка</h2>
                {!editing && p.playlistActive && (
                  <button className="ghost" type="button" onClick={p.onStop}>
                    Остановить
                  </button>
                )}
              </div>
              {p.playlistActive && (
                <p className="copy">Сейчас: {p.playbackLabel}</p>
              )}
              {(form.playlist || []).map((track, index) => (
                <article key={index} className="creature-track">
                  <button
                    disabled={editing}
                    className="ghost"
                    type="button"
                    onClick={() => p.onPlay(index)}
                  >
                    Слушать
                  </button>
                  <div>
                    {text(track.title, `Трек ${index + 1}: название`, (title) =>
                      c.updateEntityPlaylistTrack(index, { title }),
                    )}
                    {text(track.url, `Трек ${index + 1}: ссылка`, (url) =>
                      c.updateEntityPlaylistTrack(index, { url }),
                    )}
                  </div>
                  {enabled && (
                    <button
                      className="ghost"
                      onClick={() => c.removeEntityPlaylistTrack(index)}
                      type="button"
                    >
                      Убрать
                    </button>
                  )}
                </article>
              ))}
              {!form.playlist?.length && (
                <p className="copy">Добавьте музыку для сцены.</p>
              )}
              {enabled && (
                <button
                  className="ghost"
                  type="button"
                  onClick={c.addEntityPlaylistTrack}
                >
                  + Трек
                </button>
              )}
            </section>
          </>,
        )}
      </div>
      <aside className="creature-context" aria-label="Связанные записи">
        <EntityRelationsPanel
          inlineEdit
          compact
          campaignId={p.campaign.id}
          ownerId={p.ownerId}
          entity={entity}
          onResolve={p.onResolve}
          onOpen={(r) => {
            const target = p.onResolve(r);
            if (target) p.onOpen(target.id);
          }}
          onChanged={p.onChanged}
        />
      </aside>
      {previewImage && (
        <ImageZoomDialog
          url={previewImage.url}
          title={previewImage.title}
          onClose={() => setPreviewImage(null)}
        />
      )}
    </div>
  );
}

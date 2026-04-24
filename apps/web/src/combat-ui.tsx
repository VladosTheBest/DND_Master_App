import {
  useEffect,
  useState,
  type ReactNode
} from "react";
import type {
  CombatEntry,
  EntityKind,
  KnowledgeEntity,
  MonsterEntity,
  MonsterRewardProfile,
  NpcEntity,
  PlayerEntity,
  QuickFactTone,
  StatBlockEntry
} from "@shadow-edge/shared-types";
import {
  CollapsibleSection,
  abilityLabels,
  badge,
  clamp,
  createPortraitSource,
  formatModifier,
  isRewardableEntity,
  rewardSectionLabel,
  rewardSummaryText
} from "./app-shared";

type CombatProfileEntity = PlayerEntity | NpcEntity | MonsterEntity;
type CombatFocusTab = "overview" | "stats" | "abilities" | "combat" | "rewards";
export type CombatRosterFilter = "all" | "players" | "enemies";

export const combatEntrySelectionKey = (entry: CombatEntry, index: number) => `${entry.id}:${entry.entityId}:${index}`;
export const combatEntryInitiative = (entry: CombatEntry) => (Number.isFinite(entry.initiative) ? entry.initiative : 0);

export const sortCombatEntriesByInitiative = (entries: CombatEntry[]) =>
  [...entries].sort((left, right) => {
    const initiativeDelta = combatEntryInitiative(right) - combatEntryInitiative(left);
    if (initiativeDelta !== 0) {
      return initiativeDelta;
    }
    if (left.side !== right.side) {
      return left.side === "player" ? -1 : 1;
    }
    return left.title.localeCompare(right.title, "ru");
  });

const combatFocusTabs: Array<{ id: CombatFocusTab; label: string }> = [
  { id: "overview", label: "Главное" },
  { id: "stats", label: "Характеристики" },
  { id: "abilities", label: "Способности" },
  { id: "combat", label: "Бой" },
  { id: "rewards", label: "Награды" }
];

export const combatRosterFilters: Array<{ id: CombatRosterFilter; label: string }> = [
  { id: "all", label: "Все" },
  { id: "players", label: "Игроки" },
  { id: "enemies", label: "Враги" }
];

const combatEntryHealthPercent = (entry: CombatEntry) =>
  entry.maxHitPoints > 0 ? clamp((entry.currentHitPoints / entry.maxHitPoints) * 100, 0, 100) : 0;

export const isCombatEntryOut = (entry: CombatEntry) => entry.defeated || entry.currentHitPoints <= 0;

const combatEntryConditionLabel = (entry: CombatEntry) => {
  if (isCombatEntryOut(entry)) {
    return "Выведен";
  }
  if (entry.maxHitPoints <= 0) {
    return "Стабилен";
  }

  const ratio = entry.currentHitPoints / Math.max(entry.maxHitPoints, 1);
  if (ratio <= 0.1) {
    return "На грани";
  }
  if (ratio < 0.5) {
    return "Окровавлен";
  }
  return "Стабилен";
};

const combatEntryConditionTone = (entry: CombatEntry): QuickFactTone => {
  if (isCombatEntryOut(entry)) {
    return "danger";
  }
  if (entry.maxHitPoints <= 0) {
    return "default";
  }

  const ratio = entry.currentHitPoints / Math.max(entry.maxHitPoints, 1);
  if (ratio <= 0.1) {
    return "danger";
  }
  if (ratio < 0.5) {
    return "warning";
  }
  return "success";
};

export const combatVictoryLoserLabel = (entry: CombatEntry) => {
  if (entry.challenge) {
    return `CR ${entry.challenge}`;
  }
  if (entry.role) {
    return entry.role;
  }
  return "Противник";
};

const combatEntryRoleLabel = (entry: CombatEntry) =>
  entry.side === "player" ? "Игрок" : entry.challenge || entry.role || "Противник";

const parseCombatStatRows = (value?: string) =>
  (value ?? "")
    .split(/[;,]\s*/u)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const match = part.match(/^(.+?)\s*([+-]\d+(?:\s*\([^)]*\))?)$/u);
      if (match) {
        return {
          label: match[1].trim(),
          value: match[2].trim()
        };
      }
      return {
        label: part,
        value: "—"
      };
    });

function CombatFactListCard({
  title,
  rows,
  emptyLabel = "Нет данных"
}: {
  title: string;
  rows: Array<{ label: string; value: string }>;
  emptyLabel?: string;
}) {
  return (
    <section className="card mini combat-focus-list-card">
      <div className="stack compact">
        <small>{title}</small>
        {rows.length ? (
          rows.map((row) => (
            <div key={`${title}-${row.label}-${row.value}`} className="combat-focus-list-row">
              <span>{row.label}</span>
              <strong>{row.value}</strong>
            </div>
          ))
        ) : (
          <p className="copy">{emptyLabel}</p>
        )}
      </div>
    </section>
  );
}

function StatEntriesSection({
  title,
  hint,
  entries
}: {
  title: string;
  hint: string;
  entries: StatBlockEntry[];
}) {
  if (!entries.length) {
    return null;
  }

  return (
    <CollapsibleSection
      className="npc-section"
      defaultCollapsed
      hint={hint}
      summary={<p className="copy">{entries.length} записей в сокращённом виде.</p>}
      title={title}
    >
      <div className="entry-list">
        {entries.map((entry) => {
          const meta: ReactNode[] = [];

          if (entry.subtitle) {
            meta.push(
              <span key={`${entry.name}-subtitle`} className="entry-chip">
                {entry.subtitle}
              </span>
            );
          }

          if (entry.toHit) {
            meta.push(
              <span key={`${entry.name}-tohit`} className="entry-chip">
                Попадание: {entry.toHit}
              </span>
            );
          }

          if (entry.damage) {
            meta.push(
              <span key={`${entry.name}-damage`} className="entry-chip">
                Урон: {entry.damage}
              </span>
            );
          }

          if (entry.saveDc) {
            meta.push(
              <span key={`${entry.name}-save`} className="entry-chip">
                {entry.saveDc}
              </span>
            );
          }

          return (
            <article key={entry.name} className="entry-card">
              <div className="entry-header">
                <h3>{entry.name}</h3>
                {meta.length ? <div className="entry-meta">{meta}</div> : null}
              </div>
              <p className="copy">{entry.description}</p>
            </article>
          );
        })}
      </div>
    </CollapsibleSection>
  );
}

export function CombatEntityStatSheet({ entity }: { entity: CombatProfileEntity }) {
  if (!entity.statBlock) {
    return null;
  }

  const { statBlock } = entity;
  const headerLabel = entity.kind === "monster" ? "Боевой профиль" : "Статы и способности";
  const detailRows = [
    { label: "Спасброски", value: statBlock.savingThrows },
    { label: "Навыки", value: statBlock.skills },
    { label: "Чувства", value: statBlock.senses },
    { label: "Языки", value: statBlock.languages },
    { label: "Сопротивления", value: statBlock.resistances },
    { label: "Иммунитеты", value: statBlock.immunities },
    { label: "Иммунитеты к состояниям", value: statBlock.conditionImmunities }
  ].filter((row): row is { label: string; value: string } => Boolean(row.value));

  return (
    <CollapsibleSection
      className="npc-sheet"
      defaultCollapsed
      hint={entity.kind === "monster" ? "Полный боевой профиль угрозы" : "Полный боевой и ролевой профиль"}
      summary={
        <div className="preview-stat-grid">
          <article className="card preview-stat-card">
            <small>КБ</small>
            <strong>{statBlock.armorClass}</strong>
          </article>
          <article className="card preview-stat-card">
            <small>ХП</small>
            <strong>{statBlock.hitPoints}</strong>
          </article>
          <article className="card preview-stat-card">
            <small>CR</small>
            <strong>{statBlock.challenge ?? "—"}</strong>
          </article>
        </div>
      }
      title={headerLabel}
    >
      <div className="npc-top">
        <figure className="npc-portrait-frame">
          <img alt={entity.art?.alt ?? entity.title} className="npc-portrait" src={createPortraitSource(entity)} />
          <figcaption>{entity.art?.caption ?? "Добавь art.url, чтобы заменить заглушку реальным артом."}</figcaption>
        </figure>

        <div className="npc-overview">
          <div className="stack">
            <div>
              <p className="eyebrow">Профиль</p>
              <h2>{entity.title}</h2>
              <p className="npc-type-line">
                {statBlock.size} {statBlock.creatureType}, {statBlock.alignment}
              </p>
            </div>

            <div className="npc-core-grid">
              <article className="card npc-core-card">
                <small>КБ</small>
                <strong>{statBlock.armorClass}</strong>
              </article>
              <article className="card npc-core-card">
                <small>ХП</small>
                <strong>{statBlock.hitPoints}</strong>
              </article>
              <article className="card npc-core-card">
                <small>Скорость</small>
                <strong>{statBlock.speed}</strong>
              </article>
              <article className="card npc-core-card">
                <small>Бонус мастерства</small>
                <strong>{statBlock.proficiencyBonus ?? "—"}</strong>
              </article>
              <article className="card npc-core-card">
                <small>CR / Опасность</small>
                <strong>{statBlock.challenge ?? "—"}</strong>
              </article>
            </div>
          </div>

          {detailRows.length ? (
            <div className="npc-detail-list">
              {detailRows.map((row) => (
                <div key={row.label} className="npc-detail-row">
                  <span>{row.label}</span>
                  <strong>{row.value}</strong>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      <div className="npc-ability-grid">
        {abilityLabels.map(({ key, label }) => {
          const score = statBlock.abilityScores[key];

          return (
            <article key={key} className="card ability-card">
              <small>{label}</small>
              <strong>{score}</strong>
              <span>{formatModifier(score)}</span>
            </article>
          );
        })}
      </div>

      {statBlock.spellcasting ? (
        <CollapsibleSection
          className="npc-section"
          defaultCollapsed
          hint="Магия, СЛ спасброска и подготовленные заклинания"
          summary={
            <p className="copy">
              {statBlock.spellcasting.title} • {statBlock.spellcasting.spells.length} заклинаний
            </p>
          }
          title={statBlock.spellcasting.title}
        >
          <div className="spell-grid">
            <article className="card npc-core-card">
              <small>Базовая характеристика</small>
              <strong>{statBlock.spellcasting.ability}</strong>
            </article>
            <article className="card npc-core-card">
              <small>СЛ спасброска</small>
              <strong>{statBlock.spellcasting.saveDc}</strong>
            </article>
            <article className="card npc-core-card">
              <small>Модификатор атаки</small>
              <strong>{statBlock.spellcasting.attackBonus}</strong>
            </article>
          </div>

          {statBlock.spellcasting.slots?.length ? (
            <div className="spell-slots">
              {statBlock.spellcasting.slots.map((slot) => (
                <span key={slot.level} className="entry-chip">
                  {slot.level}: {slot.slots}
                </span>
              ))}
            </div>
          ) : null}

          <div className="stack">
            {statBlock.spellcasting.description ? <p className="copy">{statBlock.spellcasting.description}</p> : null}
            <div className="spell-list">
              {statBlock.spellcasting.spells.map((spell) => (
                <span key={spell} className="spell-pill">
                  {spell}
                </span>
              ))}
            </div>
          </div>
        </CollapsibleSection>
      ) : null}

      <StatEntriesSection entries={statBlock.traits} hint="Пассивные особенности" title="Способности" />
      <StatEntriesSection entries={statBlock.actions} hint="Действия и атаки" title="Действия" />
      <StatEntriesSection entries={statBlock.bonusActions ?? []} hint="Дополнительные действия" title="Бонусные действия" />
      <StatEntriesSection entries={statBlock.reactions ?? []} hint="Реакции" title="Реакции" />
    </CollapsibleSection>
  );
}

export function StatEntryEditorSection({
  title,
  hint,
  entries,
  onChange,
  onAdd,
  onRemove
}: {
  title: string;
  hint: string;
  entries: StatBlockEntry[];
  onChange: (index: number, patch: Partial<StatBlockEntry>) => void;
  onAdd: () => void;
  onRemove: (index: number) => void;
}) {
  return (
    <section className="card npc-section form-subsection">
      <div className="row muted">
        <div className="stack compact">
          <span>{title}</span>
          <small>{hint}</small>
        </div>
        <button className="ghost" onClick={onAdd} type="button">
          Добавить
        </button>
      </div>

      <div className="entry-editor-list">
        {entries.length ? (
          entries.map((entry, index) => (
            <article key={`${title}-${index}`} className="entry-editor">
              <div className="row">
                <strong>{title} #{index + 1}</strong>
                <button className="ghost danger-action" onClick={() => onRemove(index)} type="button">
                  Удалить
                </button>
              </div>

              <div className="form-grid">
                <label className="field">
                  <span>Название</span>
                  <input className="input" onChange={(event) => onChange(index, { name: event.target.value })} value={entry.name} />
                </label>
                <label className="field">
                  <span>Подпись</span>
                  <input className="input" onChange={(event) => onChange(index, { subtitle: event.target.value })} value={entry.subtitle ?? ""} />
                </label>
                <label className="field">
                  <span>Попадание</span>
                  <input
                    className="input"
                    onChange={(event) => onChange(index, { toHit: event.target.value })}
                    placeholder="+5 к попаданию"
                    value={entry.toHit ?? ""}
                  />
                </label>
                <label className="field">
                  <span>Урон</span>
                  <input
                    className="input"
                    onChange={(event) => onChange(index, { damage: event.target.value })}
                    placeholder="2d6 + 3 рубящего"
                    value={entry.damage ?? ""}
                  />
                </label>
                <label className="field field-full">
                  <span>СЛ / спасбросок</span>
                  <input
                    className="input"
                    onChange={(event) => onChange(index, { saveDc: event.target.value })}
                    placeholder="СЛ 13 Ловкости"
                    value={entry.saveDc ?? ""}
                  />
                </label>
                <label className="field field-full">
                  <span>Описание</span>
                  <textarea className="input textarea" onChange={(event) => onChange(index, { description: event.target.value })} value={entry.description} />
                </label>
              </div>
            </article>
          ))
        ) : (
          <p className="copy">Секция пока пустая.</p>
        )}
      </div>
    </section>
  );
}

export function CombatEntityPreviewSummary({ entity }: { entity: CombatProfileEntity }) {
  if (!entity.statBlock) {
    return null;
  }

  return (
    <div className="stack">
      <div className="preview-stat-grid">
        <article className="card preview-stat-card">
          <small>КБ</small>
          <strong>{entity.statBlock.armorClass}</strong>
        </article>
        <article className="card preview-stat-card">
          <small>ХП</small>
          <strong>{entity.statBlock.hitPoints}</strong>
        </article>
        <article className="card preview-stat-card">
          <small>Скорость</small>
          <strong>{entity.statBlock.speed}</strong>
        </article>
      </div>

      <div className="stack">
        {entity.statBlock.actions.slice(0, 2).map((action) => (
          <article key={action.name} className="card mini preview-entry">
            <strong>{action.name}</strong>
            <p className="copy">
              {[action.toHit, action.damage].filter(Boolean).join(" • ") || action.description}
            </p>
          </article>
        ))}
      </div>
    </div>
  );
}

export function RewardSection({
  rewardProfile,
  compact = false,
  kind = "monster"
}: {
  rewardProfile?: MonsterRewardProfile;
  compact?: boolean;
  kind?: EntityKind;
}) {
  if (!rewardProfile || (!rewardProfile.summary && !rewardProfile.loot.length)) {
    return null;
  }

  const visibleLoot = compact ? rewardProfile.loot.slice(0, 2) : rewardProfile.loot;
  const sectionMeta = rewardSectionLabel(kind);

  return (
    <CollapsibleSection
      className="npc-section monster-reward-section"
      defaultCollapsed={compact}
      hint={compact ? "Короткая сводка" : sectionMeta.hint}
      summary={<p className="copy">{rewardSummaryText(rewardProfile) || `${rewardProfile.loot.length} записей.`}</p>}
      title={sectionMeta.title}
    >
      {rewardProfile.summary ? <p className="copy">{rewardProfile.summary}</p> : null}

      <div className="loot-grid">
        {visibleLoot.map((item, index) => (
          <article key={`${item.name}-${index}`} className="entry-card loot-card">
            <div className="entry-header">
              <h3>{item.name}</h3>
              <div className="entry-meta">
                <span className="entry-chip">{item.category}</span>
                <span className="entry-chip">{item.quantity}</span>
              </div>
            </div>
            <p className="copy">
              Проверка: {item.check}
              {item.dc ? ` • ${item.dc}` : ""}
            </p>
            {item.details ? <p className="copy">{item.details}</p> : null}
          </article>
        ))}
      </div>

      {compact && rewardProfile.loot.length > visibleLoot.length ? (
        <small>Ещё {rewardProfile.loot.length - visibleLoot.length} записей в полной карточке.</small>
      ) : null}
    </CollapsibleSection>
  );
}

export function CombatEntryCard({
  entry,
  linkedEntity,
  currentTurnEntryId,
  busy,
  onChangeHitPoints,
  onChangeInitiative,
  onSetCurrentTurn,
  onNextTurn
}: {
  entry: CombatEntry;
  linkedEntity: KnowledgeEntity | null;
  currentTurnEntryId?: string;
  busy: boolean;
  onChangeHitPoints: (entry: CombatEntry, nextHp: number) => void;
  onChangeInitiative: (entry: CombatEntry, nextInitiative: number) => void;
  onSetCurrentTurn: (entryId: string) => void;
  onNextTurn: () => void;
}) {
  const kindLabel = entry.entityKind === "monster" ? "Монстр" : entry.entityKind === "player" ? "Игрок" : "НПС";
  const tone: QuickFactTone = entry.entityKind === "monster" ? "danger" : entry.entityKind === "player" ? "success" : "accent";
  const [activeTab, setActiveTab] = useState<CombatFocusTab>("overview");
  const [initiativeDraft, setInitiativeDraft] = useState(() => String(combatEntryInitiative(entry)));
  const [hitPointsDraft, setHitPointsDraft] = useState(() => String(entry.currentHitPoints));
  const parsedHitPointsDraft = Number.parseInt(hitPointsDraft, 10);
  const effectiveDraftHitPoints = Number.isFinite(parsedHitPointsDraft)
    ? clamp(parsedHitPointsDraft, 0, Math.max(entry.maxHitPoints, 0))
    : entry.currentHitPoints;
  const isCurrentTurn = currentTurnEntryId === entry.id;
  const portraitSource = linkedEntity
    ? createPortraitSource(linkedEntity)
    : createPortraitSource({
        kind: entry.entityKind === "monster" ? "monster" : entry.entityKind === "player" ? "player" : "npc",
        title: entry.title
      });
  const savingThrowRows = parseCombatStatRows(entry.statBlock?.savingThrows);
  const skillRows = parseCombatStatRows(entry.statBlock?.skills);
  const detailRows = [
    { label: "Размер", value: entry.statBlock?.size || "—" },
    { label: "Тип", value: entry.statBlock?.creatureType || kindLabel },
    { label: "Мировоззрение", value: entry.statBlock?.alignment || "—" },
    { label: "Скорость", value: entry.statBlock?.speed || "—" },
    { label: "Чувства", value: entry.statBlock?.senses || "—" },
    { label: "Языки", value: entry.statBlock?.languages || "—" },
    { label: "Сопротивления", value: entry.statBlock?.resistances || "—" },
    { label: "Иммунитеты", value: entry.statBlock?.immunities || "—" }
  ].filter((row) => row.value && row.value !== "—");
  const quickFactsRows = (linkedEntity?.quickFacts ?? []).map((fact) => ({
    label: fact.label,
    value: fact.value
  }));
  const visibleTraits = entry.statBlock?.traits ?? [];
  const visibleActions = entry.statBlock?.actions ?? [];
  const visibleBonusActions = entry.statBlock?.bonusActions ?? [];
  const visibleReactions = entry.statBlock?.reactions ?? [];

  useEffect(() => {
    setInitiativeDraft(String(combatEntryInitiative(entry)));
  }, [entry.id, entry.initiative]);

  useEffect(() => {
    setHitPointsDraft(String(entry.currentHitPoints));
  }, [entry.id, entry.currentHitPoints]);

  useEffect(() => {
    setActiveTab("overview");
  }, [entry.id]);

  const commitInitiativeDraft = () => {
    const nextValue = Number.parseInt(initiativeDraft, 10);
    onChangeInitiative(entry, Number.isFinite(nextValue) ? nextValue : 0);
  };

  const commitHitPointsDraft = () => {
    onChangeHitPoints(entry, effectiveDraftHitPoints);
  };

  const applyHitPointsDelta = (nextValue: number) => {
    const clampedValue = clamp(nextValue, 0, Math.max(entry.maxHitPoints, 0));
    setHitPointsDraft(String(clampedValue));
    onChangeHitPoints(entry, clampedValue);
  };

  const renderStatEntries = (entries: StatBlockEntry[], emptyLabel: string) =>
    entries.length ? (
      <div className="entry-list compact-entry-list combat-focus-entry-grid">
        {entries.map((action) => (
          <article key={action.name} className="entry-card combat-focus-entry-card">
            <div className="entry-header">
              <h3>{action.name}</h3>
              <div className="entry-meta">
                {action.toHit ? <span className="entry-chip">{action.toHit}</span> : null}
                {action.damage ? <span className="entry-chip">{action.damage}</span> : null}
                {action.saveDc ? <span className="entry-chip">{action.saveDc}</span> : null}
              </div>
            </div>
            {action.subtitle ? <small>{action.subtitle}</small> : null}
            <p className="copy">{action.description}</p>
          </article>
        ))}
      </div>
    ) : (
      <p className="copy">{emptyLabel}</p>
    );

  return (
    <article className={`card combat-focus-card ${entry.defeated ? "defeated" : ""}`}>
      <header className="combat-focus-hero">
        <div className="combat-focus-portrait-shell">
          <img alt={linkedEntity?.art?.alt ?? entry.title} className="combat-focus-portrait" loading="lazy" src={portraitSource} />
        </div>

        <div className="combat-focus-hero-copy">
          <div className="row combat-focus-topline">
            <div className="actions">
              <span className={badge(entry.defeated ? "danger" : tone)}>{kindLabel}</span>
              {entry.challenge ? <span className={badge()}>{entry.challenge}</span> : null}
              {entry.experience > 0 ? <span className={badge("accent")}>{entry.experience} XP</span> : null}
              <span className={badge(combatEntryConditionTone(entry))}>{combatEntryConditionLabel(entry)}</span>
            </div>
            {isCurrentTurn ? <span className={badge("accent")}>Текущий ход</span> : null}
          </div>

          <div className="stack compact">
            <h3>{entry.title}</h3>
            <p className="combat-focus-subtitle">
              {entry.role || combatEntryRoleLabel(entry)}
              {entry.statBlock?.challenge ? ` • ${entry.statBlock.challenge}` : ""}
            </p>
            <p className="copy">{entry.summary}</p>
          </div>

          <div className="combat-focus-hero-metrics">
            <span className="combat-focus-hero-pill">КД {entry.armorClass}</span>
            <span className="combat-focus-hero-pill">Инициатива +{combatEntryInitiative(entry)}</span>
            <span className="combat-focus-hero-pill">Скорость {entry.statBlock?.speed || "—"}</span>
            <span className="combat-focus-hero-pill">
              {entry.maxHitPoints > 0 ? `${entry.currentHitPoints}/${entry.maxHitPoints} HP` : "HP не отслеживается"}
            </span>
          </div>
        </div>

        <div className="combat-focus-hero-actions">
          <button className="ghost" disabled={busy || isCurrentTurn} onClick={() => onSetCurrentTurn(entry.id)} type="button">
            {isCurrentTurn ? "Ход активен" : "Сделать текущим"}
          </button>
          <button className="primary" disabled={busy} onClick={onNextTurn} type="button">
            {busy ? "Переключаю..." : "Следующий ход"}
          </button>
        </div>
      </header>

      <nav className="combat-focus-tabs" aria-label="Вкладки участника">
        {combatFocusTabs.map((tab) => (
          <button
            key={`${entry.id}-${tab.id}`}
            className={`combat-focus-tab ${activeTab === tab.id ? "active" : ""}`}
            onClick={() => setActiveTab(tab.id)}
            type="button"
          >
            {tab.label}
          </button>
        ))}
      </nav>

      {activeTab === "overview" ? (
        <div className="combat-focus-body">
          <div className="combat-focus-overview-grid">
            <section className="card mini combat-focus-health-card">
              <small>Здоровье</small>
              <strong>{entry.maxHitPoints > 0 ? `${entry.currentHitPoints} / ${entry.maxHitPoints}` : "Не отслеживается"}</strong>
              {entry.maxHitPoints > 0 ? (
                <>
                  <div className="combat-focus-health-bar">
                    <span style={{ width: `${combatEntryHealthPercent(entry)}%` }} />
                  </div>
                  <div className="combat-focus-health-adjust">
                    <button className="ghost" onClick={() => applyHitPointsDelta(Math.max(0, effectiveDraftHitPoints - 5))} type="button">
                      -5
                    </button>
                    <button className="ghost" onClick={() => applyHitPointsDelta(Math.max(0, effectiveDraftHitPoints - 1))} type="button">
                      -1
                    </button>
                    <button className="ghost" onClick={() => applyHitPointsDelta(Math.min(entry.maxHitPoints, effectiveDraftHitPoints + 1))} type="button">
                      +1
                    </button>
                    <button className="ghost" onClick={() => applyHitPointsDelta(Math.min(entry.maxHitPoints, effectiveDraftHitPoints + 5))} type="button">
                      +5
                    </button>
                    <button className="ghost" onClick={() => applyHitPointsDelta(entry.maxHitPoints)} type="button">
                      / Max
                    </button>
                  </div>
                  <div className="combat-focus-health-form">
                    <input
                      className="input combatant-health-input"
                      max={entry.maxHitPoints}
                      min={0}
                      onBlur={commitHitPointsDraft}
                      onChange={(event) => setHitPointsDraft(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          commitHitPointsDraft();
                        }
                      }}
                      type="number"
                      value={hitPointsDraft}
                    />
                    <button className="ghost" onClick={() => applyHitPointsDelta(0)} type="button">
                      Вывести
                    </button>
                    <button className="primary" onClick={commitHitPointsDraft} type="button">
                      Сохранить
                    </button>
                  </div>
                </>
              ) : (
                <p className="copy">Для этого участника ХП не заведены.</p>
              )}
            </section>

            <section className="card mini combat-focus-kpi-card">
              <small>Класс брони</small>
              <strong>{entry.armorClass}</strong>
              <span>{entry.statBlock?.armorClass ? `Базовый КД: ${entry.statBlock.armorClass}` : "Из карточки боя"}</span>
              <div className="combat-focus-inline-metrics">
                <span>Init {combatEntryInitiative(entry)}</span>
                <span>{entry.statBlock?.proficiencyBonus ? `ПМ ${entry.statBlock.proficiencyBonus}` : "Без ПМ"}</span>
              </div>
            </section>

            <CombatFactListCard emptyLabel="Спасброски не заполнены" rows={savingThrowRows} title="Спасброски" />
            <CombatFactListCard emptyLabel="Навыки не заполнены" rows={skillRows} title="Навыки" />
          </div>

          <section className="card mini combat-focus-section">
            <div className="row muted">
              <span>Атаки</span>
              <span>{visibleActions.length ? `${visibleActions.length} записей` : "Пока пусто"}</span>
            </div>
            {renderStatEntries(visibleActions.slice(0, 4), "Атаки ещё не заполнены.")}
          </section>

          <section className="card mini combat-focus-section">
            <div className="row muted">
              <span>Особенности</span>
              <span>{visibleTraits.length ? `${visibleTraits.length} записей` : "Пока пусто"}</span>
            </div>
            {renderStatEntries(visibleTraits.slice(0, 4), "Особенности ещё не заполнены.")}
          </section>
        </div>
      ) : null}

      {activeTab === "stats" ? (
        <div className="combat-focus-body">
          {entry.statBlock ? (
            <div className="combatant-ability-grid">
              {abilityLabels.map(({ key, label }) => {
                const score = entry.statBlock?.abilityScores[key] ?? 10;

                return (
                  <article key={key} className="card ability-card">
                    <small>{label}</small>
                    <strong>{score}</strong>
                    <span>{formatModifier(score)}</span>
                  </article>
                );
              })}
            </div>
          ) : null}

          <div className="combat-focus-overview-grid">
            <CombatFactListCard emptyLabel="Профиль не заполнен" rows={detailRows} title="Профиль" />
            <CombatFactListCard emptyLabel="Быстрые факты не заполнены" rows={quickFactsRows} title="Быстрые факты" />
          </div>
        </div>
      ) : null}

      {activeTab === "abilities" ? (
        <div className="combat-focus-body">
          <section className="card mini combat-focus-section">
            <div className="row muted">
              <span>Способности</span>
              <span>{visibleTraits.length} записей</span>
            </div>
            {renderStatEntries(visibleTraits, "Способности ещё не заполнены.")}
          </section>

          {entry.statBlock?.spellcasting ? (
            <section className="card mini combat-focus-section">
              <div className="row muted">
                <span>{entry.statBlock.spellcasting.title}</span>
                <span>{entry.statBlock.spellcasting.spells.length} заклинаний</span>
              </div>
              <div className="combat-focus-overview-grid">
                <CombatFactListCard
                  rows={[
                    { label: "Базовая характеристика", value: entry.statBlock.spellcasting.ability },
                    { label: "СЛ", value: entry.statBlock.spellcasting.saveDc },
                    { label: "Атака", value: entry.statBlock.spellcasting.attackBonus }
                  ]}
                  title="Магия"
                />
                <section className="card mini combat-focus-list-card">
                  <div className="stack compact">
                    <small>Заклинания</small>
                    <div className="entry-meta combat-focus-spell-list">
                      {entry.statBlock.spellcasting.spells.map((spell) => (
                        <span key={`${entry.id}-${spell}`} className="entry-chip">
                          {spell}
                        </span>
                      ))}
                    </div>
                    {entry.statBlock.spellcasting.description ? <p className="copy">{entry.statBlock.spellcasting.description}</p> : null}
                  </div>
                </section>
              </div>
            </section>
          ) : null}
        </div>
      ) : null}

      {activeTab === "combat" ? (
        <div className="combat-focus-body">
          <section className="card mini combat-focus-section">
            <div className="row muted">
              <span>Действия и атаки</span>
              <span>{visibleActions.length} записей</span>
            </div>
            {renderStatEntries(visibleActions, "Боевые действия ещё не заполнены.")}
          </section>

          {visibleBonusActions.length ? (
            <section className="card mini combat-focus-section">
              <div className="row muted">
                <span>Бонусные действия</span>
                <span>{visibleBonusActions.length} записей</span>
              </div>
              {renderStatEntries(visibleBonusActions, "Бонусные действия ещё не заполнены.")}
            </section>
          ) : null}

          {visibleReactions.length ? (
            <section className="card mini combat-focus-section">
              <div className="row muted">
                <span>Реакции</span>
                <span>{visibleReactions.length} записей</span>
              </div>
              {renderStatEntries(visibleReactions, "Реакции ещё не заполнены.")}
            </section>
          ) : null}

          <section className="card mini combatant-init-editor">
            <div className="row muted">
              <span>Инициатива участника</span>
              <span>Изменение сразу влияет на боевой порядок</span>
            </div>
            <div className="combatant-inline-controls">
              <label className="field combat-inline-field">
                <span>Инициатива</span>
                <input
                  className="input combatant-init-input"
                  onBlur={commitInitiativeDraft}
                  onChange={(event) => setInitiativeDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      commitInitiativeDraft();
                    }
                  }}
                  type="number"
                  value={initiativeDraft}
                />
              </label>
              <button className="ghost" onClick={commitInitiativeDraft} type="button">
                Сохранить
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {activeTab === "rewards" ? (
        <div className="combat-focus-body">
          {isRewardableEntity(linkedEntity) ? (
            <RewardSection kind={linkedEntity.kind} rewardProfile={linkedEntity.rewardProfile} />
          ) : (
            <section className="card mini combat-focus-section">
              <div className="row muted">
                <span>Награды</span>
                <span>Пока пусто</span>
              </div>
              <p className="copy">Для этой цели награды ещё не заданы. Можно добавить их в карточке сущности.</p>
            </section>
          )}
        </div>
      ) : null}
    </article>
  );
}

export function CombatEntryTile({
  entry,
  linkedEntity,
  selected,
  currentTurn,
  onSelect
}: {
  entry: CombatEntry;
  linkedEntity: KnowledgeEntity | null;
  selected: boolean;
  currentTurn: boolean;
  onSelect: () => void;
}) {
  const portraitSource = linkedEntity
    ? createPortraitSource(linkedEntity)
    : createPortraitSource({
        kind: entry.entityKind === "monster" ? "monster" : entry.entityKind === "player" ? "player" : "npc",
        title: entry.title
      });

  return (
    <button
      aria-pressed={selected}
      className={`combat-roster-tile ${selected ? "selected" : ""} ${currentTurn ? "current" : ""} ${entry.defeated ? "defeated" : ""}`}
      onClick={onSelect}
      type="button"
    >
      <span className={`combat-roster-initiative ${entry.side === "player" ? "player" : "enemy"}`}>{combatEntryInitiative(entry)}</span>
      <div className="combat-roster-portrait-shell">
        <img alt={linkedEntity?.art?.alt ?? entry.title} className="combat-roster-portrait" loading="lazy" src={portraitSource} />
      </div>
      <div className="combat-roster-copy">
        <div className="combat-roster-topline">
          <strong title={entry.title}>{entry.title}</strong>
          {currentTurn ? <span className={`${badge("accent")} combat-roster-turn-badge`}>Ход</span> : null}
        </div>
        <small className="combat-roster-secondary">
          <span>{combatEntryRoleLabel(entry)}</span>
          <span>КД {entry.armorClass}</span>
        </small>
        <small>{entry.maxHitPoints > 0 ? `${entry.currentHitPoints}/${entry.maxHitPoints} HP` : "HP не отслеживается"}</small>
        {entry.maxHitPoints > 0 ? (
          <div className="combat-roster-health-bar">
            <span style={{ width: `${combatEntryHealthPercent(entry)}%` }} />
          </div>
        ) : null}
      </div>
    </button>
  );
}

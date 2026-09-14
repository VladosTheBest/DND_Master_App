import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  ABILITIES,
  ABILITY_LABELS,
  BACKGROUNDS,
  CLASSES,
  SKILLS,
  SPECIES,
  SPELLS,
  createDefaultDraft,
  deriveCharacter,
  getLevelOptions,
  recommendLevelChoices,
  validateDraft,
  wizardAlwaysPreparedSpellIds,
  type Ability,
  type CharacterDraft,
  type Edition,
  type LevelChoice,
  type SpellOption,
} from "./rules";
import { CharacterSheet, formatSpellFact } from "./CharacterSheet";
import type { PublicCharacterInvite } from "./characters.api";
import "./characters.css";
import { adjustAbility } from "./ability-controls";
import { ABILITY_HELP, SKILL_HELP, SUBCLASS_HELP } from "./choice-help";
import { RulesHelp } from "./RulesHelp";

const mod = (value: number) => `${value >= 0 ? "+" : ""}${value}`;
const emptyBonuses = () =>
  Object.fromEntries(ABILITIES.map((id) => [id, 0])) as Record<Ability, number>;
const emptyLevel = (level: number): LevelChoice => ({
  level,
  spellIds: [],
  cantripIds: [],
});
const standardArray = [15, 14, 13, 12, 10, 8];
const pointCost = (value: number) =>
  ({ 8: 0, 9: 1, 10: 2, 11: 3, 12: 4, 13: 5, 14: 7, 15: 9 })[value] ?? 0;

export function isUsableDraft(value: unknown): value is CharacterDraft {
  if (!value || typeof value !== "object") return false;
  const draft = value as CharacterDraft;
  if (
    !["2014", "2024"].includes(draft.edition) ||
    !["standard", "point-buy"].includes(draft.abilityMethod)
  )
    return false;
  if (
    ![
      draft.name,
      draft.playerName,
      draft.notes,
      draft.classId,
      draft.speciesId,
      draft.backgroundId,
    ].every((item) => typeof item === "string")
  )
    return false;
  if (
    !Number.isInteger(draft.targetLevel) ||
    draft.targetLevel < 1 ||
    draft.targetLevel > 20
  )
    return false;
  if (
    !draft.abilities ||
    !draft.abilityBonuses ||
    !ABILITIES.every(
      (id) =>
        Number.isInteger(draft.abilities[id]) &&
        Number.isInteger(draft.abilityBonuses[id]),
    )
  )
    return false;
  if (
    !Array.isArray(draft.skillIds) ||
    !draft.skillIds.every((id) => typeof id === "string") ||
    !Array.isArray(draft.levels)
  )
    return false;
  return draft.levels.every(
    (level) =>
      level &&
      Number.isInteger(level.level) &&
      level.level >= 1 &&
      level.level <= draft.targetLevel &&
      (level.subclassId === undefined ||
        typeof level.subclassId === "string") &&
      (level.featId === undefined || typeof level.featId === "string") &&
      Array.isArray(level.spellIds) &&
      level.spellIds.every((id) => typeof id === "string") &&
      Array.isArray(level.cantripIds) &&
      level.cantripIds.every((id) => typeof id === "string") &&
      (level.preparedSpellIds === undefined ||
        (Array.isArray(level.preparedSpellIds) &&
          level.preparedSpellIds.every((id) => typeof id === "string"))) &&
      (level.asi === undefined ||
        (level.asi !== null &&
          typeof level.asi === "object" &&
          Object.entries(level.asi).every(
            ([id, amount]) =>
              ABILITIES.includes(id as Ability) && Number.isInteger(amount),
          ))) &&
      (level.featureChoices === undefined ||
        (level.featureChoices !== null &&
          typeof level.featureChoices === "object" &&
          Object.values(level.featureChoices).every(
            (ids) =>
              Array.isArray(ids) && ids.every((id) => typeof id === "string"),
          ))),
  );
}

function loadDraft(key: string): CharacterDraft | null {
  try {
    const data = JSON.parse(localStorage.getItem(key) || "null") as {
      version: number;
      draft: unknown;
    } | null;
    return data?.version === 1 && isUsableDraft(data.draft) ? data.draft : null;
  } catch {
    return null;
  }
}

function resumeStep(draft: CharacterDraft, requested: number): number {
  const step = Math.max(
    0,
    Math.min(
      Number.isInteger(requested) ? requested : 0,
      draft.targetLevel + 4,
    ),
  );
  const issues = validateDraft(draft, {
    throughLevel: Math.max(1, Math.min(step - 3, draft.targetLevel)),
    requireComplete: true,
  });
  const issueStep = { identity: 0, origin: 1, abilities: 2, skills: 3 };
  return issues.reduce(
    (next, issue) =>
      Math.min(
        next,
        issue.step === "level" ? (issue.level || 1) + 3 : issueStep[issue.step],
      ),
    step,
  );
}

function loadDraftStep(key: string, draft: CharacterDraft | null): number {
  if (!draft) return 0;
  try {
    return resumeStep(
      draft,
      JSON.parse(localStorage.getItem(key) || "null")?.step ?? 0,
    );
  } catch {
    return 0;
  }
}

export function DiceMark({ small = false }: { small?: boolean }) {
  return (
    <svg
      aria-hidden="true"
      className={small ? "ch-dice ch-dice-small" : "ch-dice"}
      viewBox="0 0 200 220"
      fill="none"
    >
      <path d="M100 7 187 57 187 159 100 210 13 159 13 57Z" />
      <path d="M100 7 54 83 13 57M100 7 146 83 187 57M13 159 54 83 146 83 187 159M13 159 100 157 187 159M54 83 100 157 146 83M100 157V210" />
      <text
        x="100"
        y="121"
        textAnchor="middle"
        fill="currentColor"
        stroke="none"
      >
        20
      </text>
    </svg>
  );
}

function NumberStepper({
  label,
  value,
  onChange,
  min = 0,
  max = 2,
  disabled = false,
  canDecrease = true,
  canIncrease = true,
  bonus = false,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  disabled?: boolean;
  canDecrease?: boolean;
  canIncrease?: boolean;
  bonus?: boolean;
}) {
  return (
    <div className="ch-stepper" role="group" aria-label={label}>
      <button
        type="button"
        aria-label={`Уменьшить: ${label}`}
        disabled={disabled || value <= min || !canDecrease}
        onClick={() => onChange(value - 1)}
      >
        −
      </button>
      <output aria-label={label} aria-live="polite">
        {bonus ? `+${value}` : value}
      </output>
      <button
        type="button"
        aria-label={`Увеличить: ${label}`}
        disabled={disabled || value >= max || !canIncrease}
        onClick={() => onChange(value + 1)}
      >
        +
      </button>
    </div>
  );
}

function ChoiceCard({
  name,
  description,
  selected,
  onClick,
  children,
  icon,
  disabled,
}: {
  name: string;
  description: string;
  selected: boolean;
  onClick: () => void;
  children?: ReactNode;
  icon?: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      className={`ch-choice ${selected ? "is-selected" : ""}`}
      aria-pressed={selected}
      disabled={disabled}
      onClick={onClick}
    >
      {icon && (
        <span className="ch-choice-icon" aria-hidden="true">
          {icon}
        </span>
      )}
      <span className="ch-choice-title">
        {name}
        <span className="ch-choice-check" aria-hidden="true">
          {selected ? "✓" : "+"}
        </span>
      </span>
      <span className="ch-choice-copy">{description}</span>
      {children}
    </button>
  );
}

function SpellPicker({
  title,
  help,
  items,
  selected,
  limit,
  onChange,
  locked = [],
}: {
  title: string;
  help?: string;
  items: SpellOption[];
  selected: string[];
  limit: number;
  onChange: (ids: string[]) => void;
  locked?: string[];
}) {
  const [query, setQuery] = useState("");
  const [rank, setRank] = useState("all");
  const [filter, setFilter] = useState("all");
  const filtered = useMemo(
    () =>
      items.filter(
        (spell) =>
          `${spell.name} ${spell.summary || ""} ${spell.description} ${spell.school}`
            .toLocaleLowerCase("ru")
            .includes(query.toLocaleLowerCase("ru")) &&
          (rank === "all" || spell.level === Number(rank)) &&
          (filter === "all" ||
            (filter === "selected" && selected.includes(spell.id)) ||
            (filter === "ritual" && spell.ritual) ||
            (filter === "no-concentration" && !spell.concentration)),
      ),
    [items, query, rank, filter, selected],
  );
  if (limit === 0 && !selected.length) return null;
  return (
    <section className="ch-spell-picker">
      <div className="ch-section-heading">
        <div>
          <h3>{title}</h3>
          {help && <p>{help}</p>}
        </div>
        <span
          className={`ch-selection-count ${selected.length === limit ? "is-complete" : ""}`}
          aria-live="polite"
        >
          {selected.length} / {limit}
        </span>
      </div>
      <div className="ch-spell-filters">
        <label className="ch-search">
          <span aria-hidden="true">⌕</span>
          <input
            type="search"
            aria-label={`Поиск: ${title}`}
            placeholder="Название, эффект или школа…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <select
          aria-label={`Уровень: ${title}`}
          value={rank}
          onChange={(event) => setRank(event.target.value)}
        >
          <option value="all">Все круги</option>
          {[...new Set(items.map((spell) => spell.level))]
            .sort((a, b) => a - b)
            .map((value) => (
              <option key={value} value={value}>
                {value === 0 ? "Заговоры" : `${value} круг`}
              </option>
            ))}
        </select>
        <select
          aria-label={`Фильтр: ${title}`}
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
        >
          <option value="all">Все заклинания</option>
          <option value="selected">Выбранные</option>
          <option value="ritual">Ритуалы</option>
          <option value="no-concentration">Без концентрации</option>
        </select>
      </div>
      <div className="ch-spell-list">
        {filtered.map((spell) => {
          const active = selected.includes(spell.id);
          const isLocked = locked.includes(spell.id);
          return (
            <article
              className={`ch-spell ${active ? "is-selected" : ""}`}
              key={spell.id}
            >
              <div className="ch-spell-main">
                <span className="ch-spell-rank" aria-hidden="true">
                  {spell.level || "✧"}
                </span>
                <div>
                  <strong>{spell.name}</strong>
                  <div className="ch-spell-tags">
                    <span>{spell.school}</span>
                    <span>{formatSpellFact(spell.castingTime)}</span>
                    {spell.concentration && <span>Концентрация</span>}
                    {spell.ritual && <span>Ритуал</span>}
                  </div>
                </div>
                <button
                  type="button"
                  className="ch-spell-select"
                  aria-label={`${active ? "Убрать" : "Выбрать"} ${spell.name}`}
                  aria-pressed={active}
                  disabled={
                    isLocked ||
                    (!active && selected.length >= limit && limit !== 1)
                  }
                  onClick={() =>
                    onChange(
                      active
                        ? selected.filter((id) => id !== spell.id)
                        : limit === 1
                          ? [spell.id]
                          : [...selected, spell.id],
                    )
                  }
                >
                  {isLocked ? "Изучено" : active ? "✓ Выбрано" : "+ Выбрать"}
                </button>
              </div>
              <p className="ch-spell-preview">
                {spell.summary || spell.description}
              </p>
              <details>
                <summary>
                  Точные правила заклинания · {spell.editions[0]} (English)
                </summary>
                <p>{spell.description}</p>
                <div className="ch-spell-tags">
                  <span>Дистанция: {formatSpellFact(spell.range)}</span>
                  <span>Длительность: {formatSpellFact(spell.duration)}</span>
                </div>
              </details>
            </article>
          );
        })}
        {!filtered.length && (
          <div className="ch-empty">
            Ничего не найдено. Попробуйте другое название или сбросьте фильтры.
          </div>
        )}
      </div>
    </section>
  );
}

export function CharacterBuilder({
  initialDraft,
  invite,
  storageKey,
  onComplete,
  busy,
  submitError,
  onCancel,
}: {
  initialDraft?: CharacterDraft;
  invite?: PublicCharacterInvite;
  storageKey: string;
  onComplete: (draft: CharacterDraft) => void;
  busy?: boolean;
  submitError?: string;
  onCancel?: () => void;
}) {
  const [cached] = useState(() =>
    initialDraft ? null : loadDraft(storageKey),
  );
  const [cachedStep] = useState(() => loadDraftStep(storageKey, cached));
  const [draft, setDraft] = useState<CharacterDraft>(
    () =>
      initialDraft ||
      createDefaultDraft(invite?.edition === "2014" ? "2014" : "2024"),
  );
  const [started, setStarted] = useState(Boolean(initialDraft));
  const [editionChosen, setEditionChosen] = useState(
    Boolean(initialDraft || (invite && invite.edition !== "any")),
  );
  const [step, setStep] = useState(() =>
    initialDraft ? resumeStep(initialDraft, initialDraft.targetLevel + 4) : 0,
  );
  const [errors, setErrors] = useState<string[]>([]);
  const [storageNotice, setStorageNotice] = useState("");
  const headingRef = useRef<HTMLHeadingElement>(null);
  const currentLevel = step >= 4 ? Math.min(step - 3, draft.targetLevel) : 1;
  const reviewStep = 4 + draft.targetLevel;
  const derived = deriveCharacter(draft, currentLevel);
  const classOption = CLASSES.find((item) => item.id === draft.classId);
  const background = BACKGROUNDS.find((item) => item.id === draft.backgroundId);
  const species = SPECIES.find((item) => item.id === draft.speciesId);
  const levelOptions = getLevelOptions(draft, currentLevel);
  const levelChoice =
    draft.levels.find((item) => item.level === currentLevel) ||
    emptyLevel(currentLevel);
  const previousChoice = draft.levels.find(
    (item) => item.level === currentLevel - 1,
  );
  const selectedFeat = levelOptions.feats.find(
    (feat) => feat.id === levelChoice.featId,
  );
  const featBonusAbilities =
    draft.edition === "2024" ? selectedFeat?.ability || [] : [];
  const extraBookIds = new Set(
    draft.levels
      .filter((choice) => choice.level <= currentLevel)
      .flatMap((choice) => choice.featureChoices?.["evocation-savant"] || []),
  );
  const preparationOptions = SPELLS.filter(
    (spell) =>
      spell.editions.includes(draft.edition) &&
      !wizardAlwaysPreparedSpellIds(draft, currentLevel).includes(spell.id) &&
      (levelChoice.spellIds.includes(spell.id) || extraBookIds.has(spell.id)),
  );
  const spent = ABILITIES.reduce(
    (sum, id) => sum + pointCost(draft.abilities[id]),
    0,
  );

  useEffect(() => {
    if (invite)
      setDraft((value) => ({
        ...value,
        edition: invite.edition === "any" ? value.edition : invite.edition,
        targetLevel: invite.level,
      }));
  }, [invite]);
  useEffect(() => {
    if (!started) return;
    try {
      localStorage.setItem(
        storageKey,
        JSON.stringify({ version: 1, draft, step }),
      );
      setStorageNotice("Черновик сохранён на этом устройстве");
    } catch {
      setStorageNotice(
        "Автосохранение недоступно в этом браузере. Сохраните готовый лист в файл.",
      );
    }
  }, [draft, step, started, storageKey]);
  useEffect(() => {
    if (!started) return;
    headingRef.current?.focus({ preventScroll: true });
    headingRef.current?.scrollIntoView({ block: "start", behavior: "smooth" });
  }, [step, started]);

  function patchBase(patch: Partial<CharacterDraft>) {
    setDraft((value) => ({ ...value, ...patch, levels: [] }));
    setErrors([]);
  }
  function patchLevel(patch: Partial<LevelChoice>) {
    setDraft((value) => {
      const choice = {
        ...(value.levels.find((item) => item.level === currentLevel) ||
          emptyLevel(currentLevel)),
        ...patch,
        level: currentLevel,
      };
      const next = {
        ...value,
        levels: [
          ...value.levels.filter((item) => item.level < currentLevel),
          choice,
        ],
      };
      // A changed parent choice can remove dependent selectors, such as Magic Initiate spells.
      for (let pass = 0; pass < 3; pass++) {
        const groups = getLevelOptions(next, currentLevel).featureChoiceOptions;
        choice.featureChoices = Object.fromEntries(
          Object.entries(choice.featureChoices || {}).flatMap(([key, ids]) => {
            const group = groups.find((group) => group.id === key);
            return group
              ? [
                  [
                    key,
                    ids.filter((id) =>
                      group.options.some((option) => option.id === id),
                    ),
                  ],
                ]
              : [];
          }),
        );
      }
      if (next.classId === "wizard") {
        const book = new Set([
          ...choice.spellIds,
          ...next.levels.flatMap(
            (level) => level.featureChoices?.["evocation-savant"] || [],
          ),
        ]);
        choice.preparedSpellIds = choice.preparedSpellIds?.filter(
          (id) =>
            book.has(id) &&
            !wizardAlwaysPreparedSpellIds(next, currentLevel).includes(id),
        );
      }
      return next;
    });
    setErrors([]);
  }
  function initializeLevel(level: number) {
    setDraft((value) => {
      if (value.levels.some((item) => item.level === level)) return value;
      const previous = value.levels.find((item) => item.level === level - 1);
      return {
        ...value,
        levels: [
          ...value.levels,
          {
            ...emptyLevel(level),
            subclassId: previous?.subclassId,
            spellIds: [...(previous?.spellIds || [])],
            cantripIds: [...(previous?.cantripIds || [])],
            preparedSpellIds: [...(previous?.preparedSpellIds || [])],
          },
        ],
      };
    });
  }
  function advance() {
    const issues = validateDraft(draft, {
      throughLevel: currentLevel,
      requireComplete: step === reviewStep,
    });
    const relevant = issues.filter(
      (issue) =>
        step === reviewStep ||
        (step === 0 && issue.step === "identity") ||
        (step === 1 && issue.step === "origin") ||
        (step === 2 && issue.step === "abilities") ||
        (step === 3 && issue.step === "skills") ||
        (step >= 4 &&
          issue.step === "level" &&
          (issue.level || 1) <= currentLevel),
    );
    if (relevant.length) {
      setErrors(relevant.map((issue) => issue.message));
      return;
    }
    if (step === reviewStep) {
      onComplete(draft);
      return;
    }
    const next = step + 1;
    if (next >= 4 && next < reviewStep) initializeLevel(next - 3);
    setStep(next);
    setErrors([]);
  }
  function recommendAbilities() {
    const priority = [
      ...new Set([
        ...(classOption?.primaryAbilities || []),
        "con" as Ability,
        "dex" as Ability,
        ...ABILITIES,
      ]),
    ];
    patchBase({
      abilities: Object.fromEntries(
        priority.map((id, index) => [
          id,
          (draft.abilityMethod === "point-buy"
            ? [15, 14, 14, 10, 10, 8]
            : standardArray)[index],
        ]),
      ) as Record<Ability, number>,
    });
  }
  function chooseEdition(edition: Edition) {
    const next = createDefaultDraft(edition);
    setDraft({ ...next, targetLevel: invite?.level || draft.targetLevel });
    setEditionChosen(true);
  }

  const stepLabels = [
    "Класс и имя",
    "Происхождение",
    "Характеристики",
    "Навыки",
    ...Array.from(
      { length: draft.targetLevel },
      (_, index) => `${index + 1} уровень`,
    ),
    "Готовый лист",
  ];
  if (!started)
    return (
      <div className="ch-welcome">
        <div className="ch-welcome-art" aria-hidden="true">
          <div className="ch-orbit" />
          <DiceMark />
        </div>
        <div className="ch-welcome-copy">
          <span className="ch-kicker">Shadow Edge · Мастерская персонажа</span>
          <h1>
            У каждой легенды
            <br />
            есть <em>начало.</em>
          </h1>
          <p className="ch-lead">
            Создайте своего героя. Выбирайте способности, изучайте заклинания и
            пройдите путь от первого уровня до начала вашей истории.
          </p>
          {invite && (
            <div className="ch-campaign-badge">
              <span aria-hidden="true">⚑</span>
              <div>
                <small>Приглашение в кампанию</small>
                <strong>{invite.campaignName}</strong>
              </div>
              <span>{invite.level} ур.</span>
            </div>
          )}
          <div className="ch-section-heading">
            <h2>Сначала выберите правила</h2>
            <span>01 / Начало</span>
          </div>
          <div className="ch-editions">
            {(["2014", "2024"] as Edition[]).map((edition) => (
              <button
                type="button"
                key={edition}
                aria-pressed={editionChosen && draft.edition === edition}
                disabled={
                  !!invite &&
                  invite.edition !== "any" &&
                  invite.edition !== edition
                }
                className={`ch-edition ${editionChosen && draft.edition === edition ? "is-selected" : ""}`}
                onClick={() => chooseEdition(edition)}
              >
                <span className="ch-edition-eyebrow">Dungeons & Dragons</span>
                <strong>{edition}</strong>
                <span>
                  {edition === "2014"
                    ? "Классическая пятая редакция"
                    : "Обновлённая пятая редакция"}
                </span>
                <small>
                  {edition === "2014"
                    ? "Бонусы характеристик от расы · свои уровни подклассов"
                    : "Бонусы и черта от предыстории · подкласс с 3 уровня"}
                </small>
                <span className="ch-edition-check" aria-hidden="true">
                  {editionChosen && draft.edition === edition ? "✓" : "+"}
                </span>
              </button>
            ))}
          </div>
          <div className="ch-start-level">
            <label htmlFor="ch-target-level">
              На каком уровне начинается приключение?
              <small>
                Даже на 5-м уровне вы сделаете выбор на каждом из пяти шагов.
              </small>
            </label>
            <select
              id="ch-target-level"
              value={draft.targetLevel}
              disabled={!!invite}
              onChange={(event) =>
                setDraft((value) => ({
                  ...value,
                  targetLevel: Number(event.target.value),
                }))
              }
            >
              {Array.from({ length: 20 }, (_, index) => (
                <option key={index} value={index + 1}>
                  {index + 1} уровень
                </option>
              ))}
            </select>
          </div>
          <button
            type="button"
            className="ch-button ch-primary ch-start-button"
            disabled={!editionChosen}
            onClick={() => setStarted(true)}
          >
            Создать своего героя <span aria-hidden="true">→</span>
          </button>
          {cached &&
            (!invite ||
              ((invite.edition === "any" ||
                cached.edition === invite.edition) &&
                cached.targetLevel === invite.level)) && (
              <button
                type="button"
                className="ch-resume"
                onClick={() => {
                  setDraft(cached);
                  setStep(cachedStep);
                  setEditionChosen(true);
                  setStarted(true);
                }}
              >
                ↻ Продолжить черновик: {cached.name || "Новый герой"} ·{" "}
                {cached.edition} · {cached.targetLevel} ур.
              </button>
            )}
          <p className="ch-source-note">
            Открытые правила SRD 5.1 / 5.2.1. Встроен отобранный каталог
            вариантов. Мультикласс и дополнительные книги не включены.
          </p>
        </div>
      </div>
    );

  return (
    <div className="ch-builder">
      <aside className="ch-journey">
        <a href="#characters" className="ch-journey-brand">
          <DiceMark small />
          <span>
            Мастерская
            <br />
            <strong>персонажа</strong>
          </span>
        </a>
        <div className="ch-journey-edition">
          D&D {draft.edition}
          <span>{draft.targetLevel} ур.</span>
        </div>
        <nav aria-label="Шаги создания персонажа">
          {stepLabels.map((label, index) => (
            <button
              type="button"
              key={label}
              className={`ch-step ${index === step ? "is-current" : ""} ${index < step ? "is-done" : ""}`}
              aria-label={`Шаг ${index + 1}: ${label}`}
              aria-current={index === step ? "step" : undefined}
              disabled={index > step}
              onClick={() => {
                setStep(index);
                setErrors([]);
              }}
            >
              <span className="ch-step-dot">
                {index < step
                  ? "✓"
                  : index < 4
                    ? `0${index + 1}`
                    : index === reviewStep
                      ? "✦"
                      : index - 3}
              </span>
              <span>{label}</span>
              {index === step && <span aria-hidden="true">›</span>}
            </button>
          ))}
        </nav>
        <p className="ch-journey-note">
          Ваши решения формируют героя. К предыдущим шагам всегда можно
          вернуться.
        </p>
      </aside>
      <div className="ch-builder-main">
        <div className="ch-topline">
          <span>{invite?.campaignName || "Новая история"}</span>
          <span>
            Шаг {step + 1} из {stepLabels.length}
          </span>
        </div>
        <div
          className="ch-progress-track"
          role="progressbar"
          aria-label="Прогресс создания"
          aria-valuenow={step + 1}
          aria-valuemin={0}
          aria-valuemax={stepLabels.length}
        >
          <span
            style={{ width: `${((step + 1) / stepLabels.length) * 100}%` }}
          />
        </div>
        <div className="ch-step-content" key={step}>
          <span className="ch-kicker">
            {step < 4
              ? "Основа вашей легенды"
              : step === reviewStep
                ? "Готов к приключению"
                : "Новая ступень силы"}
          </span>
          <h1 tabIndex={-1} ref={headingRef}>
            {step === 0
              ? "Кем вы войдёте в историю?"
              : step === 1
                ? "Откуда начинается ваш путь?"
                : step === 2
                  ? "В чём ваша сила?"
                  : step === 3
                    ? "Что вы умеете лучше других?"
                    : step === reviewStep
                      ? "Ваша легенда готова."
                      : `${currentLevel} уровень`}
          </h1>
          {step !== reviewStep && <RulesHelp />}
          {step === 0 && (
            <>
              <p className="ch-step-intro">
                Магия, сталь или хитрость — выберите свой способ менять мир.
              </p>
              <div className="ch-inline-fields ch-identity">
                <label>
                  Имя персонажа
                  <input
                    maxLength={100}
                    autoComplete="off"
                    placeholder="Например, Элира Лунная Тень"
                    value={draft.name}
                    onChange={(event) =>
                      setDraft((value) => ({
                        ...value,
                        name: event.target.value,
                      }))
                    }
                  />
                </label>
                <label>
                  Имя игрока
                  <input
                    required
                    maxLength={100}
                    autoComplete="given-name"
                    placeholder="Как к вам обращаться"
                    value={draft.playerName}
                    onChange={(event) =>
                      setDraft((value) => ({
                        ...value,
                        playerName: event.target.value,
                      }))
                    }
                  />
                </label>
              </div>
              <div className="ch-section-heading">
                <h2>Выберите класс</h2>
                <span>{CLASSES.length} путей</span>
              </div>
              <div className="ch-choices ch-classes">
                {CLASSES.filter((item) =>
                  item.editions.includes(draft.edition),
                ).map((item) => (
                  <ChoiceCard
                    key={item.id}
                    name={item.name}
                    description={item.description}
                    icon={item.icon}
                    selected={draft.classId === item.id}
                    onClick={() =>
                      patchBase({ classId: item.id, skillIds: [] })
                    }
                  >
                    <span className="ch-choice-meta">
                      d{item.hitDie} здоровья ·{" "}
                      {item.primaryAbilities
                        .map((id) => ABILITY_LABELS[id])
                        .join(" / ")}
                    </span>
                  </ChoiceCard>
                ))}
              </div>
            </>
          )}
          {step === 1 && (
            <>
              <p className="ch-step-intro">
                {draft.edition === "2014"
                  ? "Раса определяет врождённые особенности и бонусы характеристик. Предыстория добавляет навыки."
                  : "Вид определяет врождённые особенности. Предыстория даёт навыки, бонусы характеристик и начальную черту."}
              </p>
              <h2>{draft.edition === "2014" ? "Раса" : "Вид"}</h2>
              <div className="ch-choices">
                {SPECIES.filter((item) =>
                  item.editions.includes(draft.edition),
                ).map((item) => (
                  <ChoiceCard
                    key={item.id}
                    name={item.name}
                    description={item.description}
                    selected={draft.speciesId === item.id}
                    onClick={() =>
                      patchBase({
                        speciesId: item.id,
                        abilityBonuses:
                          draft.edition === "2014"
                            ? { ...emptyBonuses(), ...item.bonuses2014 }
                            : emptyBonuses(),
                      })
                    }
                  >
                    <span className="ch-choice-meta">
                      Скорость{" "}
                      {draft.edition === "2024" &&
                      ["lightfoot-halfling", "rock-gnome"].includes(item.id)
                        ? 30
                        : item.speed}{" "}
                      фт.
                    </span>
                  </ChoiceCard>
                ))}
              </div>
              {species && (
                <div className="ch-rule-callout">
                  <strong>Особенности: {species.name}</strong>
                  <ul>
                    {species.traits
                      .filter((trait) =>
                        draft.edition === "2014"
                          ? !/^(2024:|В редакции 2024)/.test(trait)
                          : !trait.startsWith("2014:"),
                      )
                      .map((trait) => (
                        <li key={trait}>
                          {trait.replace(/^(2014|2024):\s*/, "")}
                        </li>
                      ))}
                  </ul>
                </div>
              )}
              <h2>Предыстория</h2>
              <div className="ch-choices">
                {BACKGROUNDS.filter((item) =>
                  item.editions.includes(draft.edition),
                ).map((item) => (
                  <ChoiceCard
                    key={item.id}
                    name={item.name}
                    description={item.description}
                    selected={draft.backgroundId === item.id}
                    onClick={() =>
                      patchBase({
                        backgroundId: item.id,
                        skillIds: [],
                        abilityBonuses:
                          draft.edition === "2014"
                            ? draft.abilityBonuses
                            : emptyBonuses(),
                      })
                    }
                  >
                    <span className="ch-choice-meta">
                      {item.skillIds
                        .map(
                          (id) => SKILLS.find((skill) => skill.id === id)?.name,
                        )
                        .join(" · ")}
                    </span>
                  </ChoiceCard>
                ))}
              </div>
            </>
          )}
          {step === 2 && (
            <>
              <p className="ch-step-intro">
                Распределите характеристики. Модификаторы, здоровье и заклинания
                пересчитываются сразу.
              </p>
              <div className="ch-section-heading">
                <div className="ch-segmented">
                  <button
                    type="button"
                    aria-pressed={draft.abilityMethod === "standard"}
                    className={
                      draft.abilityMethod === "standard" ? "is-selected" : ""
                    }
                    onClick={() =>
                      patchBase({
                        abilityMethod: "standard",
                        abilities: Object.fromEntries(
                          ABILITIES.map((id, index) => [
                            id,
                            standardArray[index],
                          ]),
                        ) as Record<Ability, number>,
                      })
                    }
                  >
                    Стандартный набор
                  </button>
                  <button
                    type="button"
                    aria-pressed={draft.abilityMethod === "point-buy"}
                    className={
                      draft.abilityMethod === "point-buy" ? "is-selected" : ""
                    }
                    onClick={() =>
                      patchBase({
                        abilityMethod: "point-buy",
                        abilities: Object.fromEntries(
                          ABILITIES.map((id) => [id, 8]),
                        ) as Record<Ability, number>,
                      })
                    }
                  >
                    27 очков
                  </button>
                </div>
                <button
                  type="button"
                  className="ch-text-button"
                  onClick={recommendAbilities}
                >
                  ✦ Распределить для класса
                </button>
              </div>
              <p className="ch-rule-callout">
                {draft.abilityMethod === "standard"
                  ? "Распределите 15, 14, 13, 12, 10 и 8. Кнопки меняют значение на соседнее в наборе, автоматически переставляя его с другой характеристикой."
                  : `Использовано ${spent} из 27 очков. Значения 14 и 15 стоят по 2 дополнительных очка.`}
              </p>
              <div className="ch-ability-grid">
                {ABILITIES.map((id) => (
                  <div className="ch-ability-card" key={id}>
                    <span>{ABILITY_LABELS[id]}</span>
                    <strong>{derived.abilities[id]}</strong>
                    <span className="ch-ability-mod">
                      {mod(derived.modifiers[id])}
                    </span>
                    <p className="ch-ability-help">{ABILITY_HELP[id]}</p>
                    <span className="ch-field-caption">Базовое значение</span>
                    <NumberStepper
                      label={`Базовое значение: ${ABILITY_LABELS[id]}`}
                      value={draft.abilities[id]}
                      min={8}
                      max={15}
                      canDecrease={!!adjustAbility(draft, id, -1)}
                      canIncrease={!!adjustAbility(draft, id, 1)}
                      onChange={(value) => {
                        const abilities = adjustAbility(
                          draft,
                          id,
                          value > draft.abilities[id] ? 1 : -1,
                        );
                        if (abilities) patchBase({ abilities });
                      }}
                    />
                    <small className="ch-score-breakdown">
                      База {draft.abilities[id]} · происхождение +
                      {draft.abilityBonuses[id]}
                      {draft.abilityMethod === "point-buy"
                        ? ` · цена ${pointCost(draft.abilities[id])}`
                        : ""}
                    </small>
                  </div>
                ))}
              </div>
              {draft.edition === "2024" ? (
                <div className="ch-bonus-section">
                  <h2>Бонусы предыстории</h2>
                  <p>
                    Выберите +2 и +1 к разным характеристикам или +1 к каждой из
                    трёх. Доступны характеристики предыстории «
                    {background?.name}».
                  </p>
                  <div className="ch-inline-fields">
                    {(background?.abilities2024 || []).map((id) => (
                      <label key={id}>
                        {ABILITY_LABELS[id]}
                        <NumberStepper
                          label={`Бонус: ${ABILITY_LABELS[id]}`}
                          value={draft.abilityBonuses[id]}
                          bonus
                          canIncrease={
                            ABILITIES.reduce(
                              (sum, ability) =>
                                sum + draft.abilityBonuses[ability],
                              0,
                            ) < 3
                          }
                          onChange={(value) =>
                            patchBase({
                              abilityBonuses: {
                                ...draft.abilityBonuses,
                                [id]: value,
                              },
                            })
                          }
                        />
                      </label>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="ch-bonus-section">
                  <h2>Бонусы расы</h2>
                  <p>
                    {Object.entries(species?.bonuses2014 || {})
                      .map(
                        ([id, value]) =>
                          `${ABILITY_LABELS[id as Ability]} +${value}`,
                      )
                      .join(" · ") || "Нет фиксированных бонусов"}
                    . Они уже учтены в итоговых значениях.
                  </p>
                  {!!species?.flexibleBonuses2014 && (
                    <>
                      <p>
                        Добавьте +1 к {species.flexibleBonuses2014} разным
                        характеристикам, кроме Харизмы.
                      </p>
                      <div className="ch-inline-fields">
                        {ABILITIES.filter((id) => id !== "cha").map((id) => (
                          <label key={id}>
                            {ABILITY_LABELS[id]}
                            <NumberStepper
                              label={`Бонус расы: ${ABILITY_LABELS[id]}`}
                              value={draft.abilityBonuses[id]}
                              max={1}
                              bonus
                              canIncrease={
                                ABILITIES.filter(
                                  (ability) => ability !== "cha",
                                ).reduce(
                                  (sum, ability) =>
                                    sum + draft.abilityBonuses[ability],
                                  0,
                                ) < (species.flexibleBonuses2014 || 0)
                              }
                              onChange={(value) =>
                                patchBase({
                                  abilityBonuses: {
                                    ...draft.abilityBonuses,
                                    [id]: value,
                                  },
                                })
                              }
                            />
                          </label>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )}
            </>
          )}
          {step === 3 && (
            <>
              <p className="ch-step-intro">
                {background?.skillIds.length
                  ? `Предыстория даёт ${background.skillIds.map((id) => SKILLS.find((item) => item.id === id)?.name).join(" и ")}.`
                  : "Навыки своей предыстории вы выберете на первом уровне."}{" "}
                Дополните их навыками вашего класса.
              </p>
              <div className="ch-section-heading">
                <h2>Навыки класса</h2>
                <span className="ch-selection-count">
                  {draft.skillIds.length} / {classOption?.skillCount || 0}
                </span>
              </div>
              <div className="ch-skills-grid">
                {SKILLS.map((skill) => {
                  const inheritedSpecies =
                    (draft.speciesId === "half-orc" &&
                      skill.id === "intimidation") ||
                    (draft.edition === "2014" &&
                      draft.speciesId === "high-elf" &&
                      skill.id === "perception");
                  const inherited =
                    background?.skillIds.includes(skill.id) || inheritedSpecies;
                  const selected = draft.skillIds.includes(skill.id);
                  const available =
                    classOption?.skillIds.includes(skill.id) && !inherited;
                  return (
                    <button
                      className={`ch-skill ${selected || inherited ? "is-selected" : ""}`}
                      type="button"
                      key={skill.id}
                      aria-pressed={selected || inherited}
                      disabled={
                        (!available && !selected) ||
                        (!selected &&
                          draft.skillIds.length >=
                            (classOption?.skillCount || 0))
                      }
                      onClick={() =>
                        patchBase({
                          skillIds: selected
                            ? draft.skillIds.filter((id) => id !== skill.id)
                            : [...draft.skillIds, skill.id],
                        })
                      }
                    >
                      <span className="ch-checkbox" aria-hidden="true">
                        {selected || inherited ? "✓" : ""}
                      </span>
                      <span>
                        <strong>{skill.name}</strong>
                        <span className="ch-skill-help">
                          {SKILL_HELP[skill.id]}
                        </span>
                        <small>
                          {inheritedSpecies
                            ? "От происхождения"
                            : inherited
                              ? "От предыстории"
                              : ABILITY_LABELS[skill.ability]}
                        </small>
                      </span>
                      <b>
                        {mod(
                          derived.skills.find((item) => item.id === skill.id)
                            ?.bonus || 0,
                        )}
                      </b>
                    </button>
                  );
                })}
              </div>
            </>
          )}
          {step >= 4 && step < reviewStep && (
            <>
              <p className="ch-step-intro">
                {currentLevel === 1
                  ? "Первые способности и заклинания вашего героя."
                  : "Сделайте выбор этого уровня, затем перейдите к следующему."}{" "}
                Выборы на следующих уровнях пересобираются при изменении
                предыдущих.
              </p>
              <div className="ch-level-summary">
                <div>
                  <small>Класс</small>
                  <strong>{classOption?.name}</strong>
                </div>
                <div>
                  <small>Здоровье</small>
                  <strong>
                    {derived.maxHp} <span>HP</span>
                  </strong>
                </div>
                <div>
                  <small>Бонус мастерства</small>
                  <strong>+{derived.proficiencyBonus}</strong>
                </div>
                <div>
                  <small>Кость хитов</small>
                  <strong>d{classOption?.hitDie}</strong>
                </div>
              </div>
              <div className="ch-inline-actions">
                <button
                  type="button"
                  className="ch-button"
                  disabled={busy}
                  onClick={() =>
                    patchLevel(recommendLevelChoices(draft, currentLevel))
                  }
                >
                  ✦ Подобрать доступные варианты
                </button>
              </div>
              {levelOptions.features.length > 0 && (
                <section className="ch-feature-gains">
                  <h2>На этом уровне</h2>
                  {levelOptions.features.map((feature) => (
                    <details
                      key={feature.id}
                      open={levelOptions.features.length < 4}
                    >
                      <summary>
                        <span aria-hidden="true">✦</span> {feature.name}
                      </summary>
                      <p className="ch-rule-text">{feature.description}</p>
                      {feature.originalDescription && (
                        <details>
                          <summary>
                            Текст правил этой редакции (English)
                          </summary>
                          <p className="ch-rule-text">
                            {feature.originalDescription}
                          </p>
                        </details>
                      )}
                    </details>
                  ))}
                </section>
              )}
              {levelOptions.subclassRequired && (
                <>
                  <div className="ch-section-heading">
                    <h2>Ваш подкласс</h2>
                    <span>Выберите путь</span>
                  </div>
                  <div className="ch-choices">
                    {levelOptions.subclasses.map((item) => (
                      <ChoiceCard
                        key={item.id}
                        name={item.name}
                        description={SUBCLASS_HELP[item.id] || item.description}
                        selected={levelChoice.subclassId === item.id}
                        onClick={() => patchLevel({ subclassId: item.id })}
                      />
                    ))}
                  </div>
                </>
              )}
              {(levelOptions.asiAvailable ||
                levelOptions.epicBoonAvailable) && (
                <section className="ch-bonus-section">
                  <h2>
                    {levelOptions.epicBoonAvailable
                      ? "Эпический дар"
                      : "Улучшение характеристик или черта"}
                  </h2>
                  {(levelOptions.asiAvailable ||
                    levelOptions.epicBoonAvailable) && (
                    <>
                      <p>
                        Добавьте +2 к одной характеристике или +1 к двум.
                        Максимум — 20.
                      </p>
                      <div className="ch-asi-grid">
                        {ABILITIES.map((id) => (
                          <label key={id}>
                            {ABILITY_LABELS[id]}
                            <NumberStepper
                              label={`Улучшение: ${ABILITY_LABELS[id]}`}
                              value={levelChoice.asi?.[id] || 0}
                              bonus
                              disabled={!!levelChoice.featId}
                              canIncrease={
                                derived.abilities[id] < 20 &&
                                ABILITIES.reduce(
                                  (sum, ability) =>
                                    sum + (levelChoice.asi?.[ability] || 0),
                                  0,
                                ) < 2
                              }
                              onChange={(value) =>
                                patchLevel({
                                  asi: { ...levelChoice.asi, [id]: value },
                                  featId: undefined,
                                })
                              }
                            />
                          </label>
                        ))}
                      </div>
                    </>
                  )}
                  {levelOptions.feats.length > 0 && (
                    <div className="ch-choices">
                      {levelOptions.feats.map((feat) => (
                        <ChoiceCard
                          key={feat.id}
                          name={feat.name}
                          description={feat.description}
                          selected={levelChoice.featId === feat.id}
                          onClick={() =>
                            patchLevel({
                              featId:
                                levelChoice.featId === feat.id
                                  ? undefined
                                  : feat.id,
                              asi: undefined,
                            })
                          }
                        />
                      ))}
                    </div>
                  )}
                </section>
              )}
              {selectedFeat && featBonusAbilities.length > 0 && (
                <section className="ch-bonus-section">
                  <h2>Бонус черты: {selectedFeat.name}</h2>
                  <p>
                    Добавьте +1 к одной характеристике. Максимум —{" "}
                    {selectedFeat.category === "epic" ? 30 : 20}.
                  </p>
                  <div className="ch-inline-fields">
                    {featBonusAbilities.map((id) => (
                      <div className="ch-feat-ability" key={id}>
                        <span>{ABILITY_LABELS[id]}</span>
                        <NumberStepper
                          label={`Бонус черты: ${ABILITY_LABELS[id]}`}
                          value={levelChoice.asi?.[id] || 0}
                          max={1}
                          bonus
                          canIncrease={
                            derived.abilities[id] <
                            (selectedFeat.category === "epic" ? 30 : 20)
                          }
                          onChange={(value) =>
                            patchLevel({ asi: value ? { [id]: 1 } : undefined })
                          }
                        />
                      </div>
                    ))}
                  </div>
                </section>
              )}
              <LevelFeatureChoices
                options={levelOptions}
                choice={levelChoice}
                onChange={patchLevel}
              />
              {(levelOptions.spellSlots.some(Boolean) ||
                levelOptions.pactSlots > 0) && (
                <div className="ch-slot-summary">
                  <span>Ячейки заклинаний</span>
                  {levelOptions.pactSlots > 0 ? (
                    <strong>
                      {levelOptions.pactSlots} × {levelOptions.pactSlotLevel}{" "}
                      круг · магия договора
                    </strong>
                  ) : (
                    levelOptions.spellSlots.map(
                      (count, index) =>
                        count > 0 && (
                          <span className="ch-slot-chip" key={index}>
                            {index + 1} круг <b>{count}</b>
                          </span>
                        ),
                    )
                  )}
                </div>
              )}
              <SpellPicker
                key={`cantrips-${currentLevel}`}
                title="Заговоры"
                help={
                  draft.edition === "2024" && currentLevel > 1
                    ? "Заговоры не расходуют ячейки. Можно заменить заговор в пределах правил вашего класса."
                    : "Их можно применять без расходования ячеек."
                }
                items={levelOptions.cantrips}
                selected={levelChoice.cantripIds}
                limit={levelOptions.cantripCount}
                locked={
                  draft.edition === "2014"
                    ? previousChoice?.cantripIds || []
                    : []
                }
                onChange={(cantripIds) => patchLevel({ cantripIds })}
              />
              <SpellPicker
                key={`spells-${currentLevel}`}
                title={
                  levelOptions.spellMode === "spellbook"
                    ? "Книга заклинаний"
                    : levelOptions.spellMode === "prepared"
                      ? "Подготовленные заклинания"
                      : "Известные заклинания"
                }
                help={
                  levelOptions.spellMode === "spellbook"
                    ? "Шесть заклинаний на первом уровне, затем два новых на каждом уровне волшебника."
                    : levelOptions.spellMode === "prepared"
                      ? "Выберите заклинания, с которыми начнёте приключение. Их можно менять по правилам подготовки."
                      : "Список доступен с учётом класса, редакции и текущего уровня."
                }
                items={levelOptions.spells}
                selected={levelChoice.spellIds}
                limit={levelOptions.spellCount}
                locked={
                  levelOptions.spellMode === "spellbook"
                    ? previousChoice?.spellIds || []
                    : []
                }
                onChange={(spellIds) =>
                  patchLevel({
                    spellIds,
                    preparedSpellIds: levelChoice.preparedSpellIds?.filter(
                      (id) => spellIds.includes(id) || extraBookIds.has(id),
                    ),
                  })
                }
              />
              {levelOptions.spellMode === "spellbook" && (
                <SpellPicker
                  key={`prepared-${currentLevel}`}
                  title="Подготовка из книги"
                  help="Эти заклинания будут готовы к применению. Всегда подготовленные заклинания от особенностей добавляются автоматически. Ритуалы из книги можно читать без подготовки."
                  items={preparationOptions}
                  selected={levelChoice.preparedSpellIds || []}
                  limit={levelOptions.preparedCount}
                  onChange={(preparedSpellIds) =>
                    patchLevel({ preparedSpellIds })
                  }
                />
              )}
              {levelOptions.spellMode === "none" && (
                <div className="ch-rule-callout">
                  На этом уровне нет заклинаний класса. Врождённая магия и
                  заклинания от черт выбираются в особенностях выше.
                </div>
              )}
            </>
          )}
          {step === reviewStep && (
            <>
              <p className="ch-step-intro">
                Проверьте лист перед{" "}
                {invite ? "отправкой в кампанию" : "завершением"}. Вернитесь к
                любому предыдущему шагу, если захотите изменить выбор.
              </p>
              <label className="ch-notes-field">
                История, внешность и заметки
                <textarea
                  maxLength={10000}
                  rows={4}
                  value={draft.notes}
                  placeholder="Что привело вашего героя к приключениям?"
                  onChange={(event) =>
                    setDraft((value) => ({
                      ...value,
                      notes: event.target.value,
                    }))
                  }
                />
              </label>
              <CharacterSheet draft={draft} />
            </>
          )}
        </div>
        {(errors.length > 0 || submitError) && (
          <div className="ch-error" role="alert">
            <strong>Осталось уточнить</strong>
            <ul>
              {errors.map((error, index) => (
                <li key={index}>{error}</li>
              ))}
              {submitError && <li>{submitError}</li>}
            </ul>
          </div>
        )}
        <footer className="ch-builder-footer">
          <button
            className="ch-button"
            type="button"
            disabled={busy}
            onClick={() => {
              if (step === 0) {
                if (onCancel) onCancel();
                else setStarted(false);
              } else setStep(step - 1);
              setErrors([]);
            }}
          >
            ← {step === 0 ? "К началу" : "Назад"}
          </button>
          <span role="status" className="ch-save-status">
            {storageNotice}
          </span>
          <button
            className="ch-button ch-primary"
            type="button"
            disabled={busy}
            onClick={advance}
          >
            {busy
              ? "Сохраняем…"
              : step === reviewStep
                ? invite
                  ? "Сохранить в кампанию"
                  : initialDraft
                    ? "Сохранить изменения"
                    : "Завершить создание"
                : step === reviewStep - 1
                  ? "Посмотреть лист"
                  : step >= 4
                    ? `Перейти на ${currentLevel + 1} уровень`
                    : "Продолжить"}{" "}
            <span aria-hidden="true">→</span>
          </button>
        </footer>
      </div>
      {step !== reviewStep && (
        <aside className="ch-live-sheet">
          <span className="ch-kicker">Ваш персонаж</span>
          <div className="ch-portrait">
            <DiceMark />
          </div>
          <h2>{draft.name || "Новый герой"}</h2>
          <p>
            {classOption?.name || "Выберите класс"} ·{" "}
            {species?.name || "Выберите происхождение"}
          </p>
          <span className="ch-live-level">
            {currentLevel} уровень <span>/ {draft.targetLevel}</span>
          </span>
          <div className="ch-live-stats">
            <div>
              <small>Здоровье</small>
              <strong>{derived.maxHp}</strong>
            </div>
            <div>
              <small>Класс доспеха</small>
              <strong>{derived.armorClass}</strong>
            </div>
            <div>
              <small>Инициатива</small>
              <strong>{mod(derived.initiative)}</strong>
            </div>
          </div>
          <div className="ch-mini-abilities">
            {ABILITIES.map((id) => (
              <div key={id}>
                <span>{ABILITY_LABELS[id]}</span>
                <b>{derived.abilities[id]}</b>
                <small>{mod(derived.modifiers[id])}</small>
              </div>
            ))}
          </div>
          <p className="ch-live-note">
            КД без доспехов. Здоровье — фиксированный прирост по правилам
            класса. Экипировка выбирается с мастером.
          </p>
          {derived.spellSaveDc !== null && (
            <div className="ch-live-magic">
              <span>Сложность спасброска</span>
              <strong>{derived.spellSaveDc}</strong>
              <span>Атака заклинанием</span>
              <strong>{mod(derived.spellAttackBonus || 0)}</strong>
            </div>
          )}
        </aside>
      )}
    </div>
  );
}

function LevelFeatureChoices({
  options,
  choice,
  onChange,
}: {
  options: ReturnType<typeof getLevelOptions>;
  choice: LevelChoice;
  onChange: (patch: Partial<LevelChoice>) => void;
}) {
  return (
    <>
      {options.featureChoiceOptions.map((group) => (
        <FeatureChoiceGroup
          key={group.id}
          group={group}
          choice={choice}
          onChange={onChange}
        />
      ))}
    </>
  );
}

function FeatureChoiceGroup({
  group,
  choice,
  onChange,
}: {
  group: ReturnType<typeof getLevelOptions>["featureChoiceOptions"][number];
  choice: LevelChoice;
  onChange: (patch: Partial<LevelChoice>) => void;
}) {
  const [query, setQuery] = useState("");
  const selected = choice.featureChoices?.[group.id] || [];
  const spellOptions = useMemo(() => {
    const catalog = new Map(SPELLS.map((spell) => [spell.id, spell]));
    return group.options
      .map((option) => catalog.get(option.id))
      .filter((spell): spell is SpellOption => !!spell);
  }, [group.options]);
  if (spellOptions.length > 0 && spellOptions.length === group.options.length)
    return (
      <SpellPicker
        title={group.name}
        help={group.description}
        items={spellOptions}
        selected={selected}
        limit={group.count}
        onChange={(ids) =>
          onChange({
            featureChoices: { ...choice.featureChoices, [group.id]: ids },
          })
        }
      />
    );
  const filtered = group.options.filter((option) =>
    `${option.name} ${option.description}`
      .toLocaleLowerCase("ru")
      .includes(query.toLocaleLowerCase("ru").trim()),
  );
  return (
    <section className="ch-feature-choice">
      <div className="ch-section-heading">
        <div>
          <h2>{group.name}</h2>
          <p>{group.description}</p>
        </div>
        <span className="ch-selection-count" aria-live="polite">
          {selected.length} / {group.count}
        </span>
      </div>
      {group.options.length > 12 && (
        <label className="ch-search">
          <span aria-hidden="true">⌕</span>
          <input
            type="search"
            aria-label={`Поиск: ${group.name}`}
            placeholder="Найти по названию или описанию…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
      )}
      <div className="ch-choices">
        {filtered.map((option) => (
          <ChoiceCard
            key={option.id}
            name={option.name}
            description={option.description}
            selected={selected.includes(option.id)}
            disabled={
              group.count !== 1 &&
              !selected.includes(option.id) &&
              selected.length >= group.count
            }
            onClick={() =>
              onChange({
                featureChoices: {
                  ...choice.featureChoices,
                  [group.id]: selected.includes(option.id)
                    ? selected.filter((id) => id !== option.id)
                    : group.count === 1
                      ? [option.id]
                      : [...selected, option.id],
                },
              })
            }
          />
        ))}
      </div>
      {query && !filtered.length && (
        <div className="ch-empty">
          Ничего не найдено.{" "}
          <button
            type="button"
            className="ch-text-button"
            onClick={() => setQuery("")}
          >
            Сбросить поиск
          </button>
        </div>
      )}
    </section>
  );
}

import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  ABILITIES,
  ABILITY_LABELS,
  SPELLS,
  deriveCharacter,
  type Ability,
  type CharacterDraft,
  type DerivedCharacter,
  type SpellOption,
} from "./rules";
import "./character-sheet.css";

export interface CharacterSheetProps {
  draft: CharacterDraft;
  onEdit?: () => void;
  onNew?: () => void;
  savedLabel?: string;
}

type IconName =
  | "d20"
  | "heart"
  | "shield"
  | "sparkles"
  | "book"
  | "download"
  | "print"
  | "edit"
  | "arrow"
  | "search"
  | "feather"
  | "boots"
  | "eye"
  | "star"
  | "plus";

function SheetIcon({ name, size = 16 }: { name: IconName; size?: number }) {
  const paths: Record<IconName, ReactNode> = {
    d20: (
      <>
        <path d="m12 2 9 6v9l-9 5-9-5V8l9-6Z" />
        <path d="m12 2-5 9 5 11 5-11-5-9ZM3 8l4 3-4 6m18-9-4 3 4 6M7 11h10M3 17l9-2 9 2" />
      </>
    ),
    heart: (
      <path d="M20.2 4.9a5.5 5.5 0 0 0-7.8 0L12 5.3l-.4-.4a5.5 5.5 0 0 0-7.8 7.8L12 21l8.2-8.3a5.5 5.5 0 0 0 0-7.8Z" />
    ),
    shield: (
      <>
        <path d="m12 2 8 3v6c0 5-3.5 8.5-8 11-4.5-2.5-8-6-8-11V5l8-3Z" />
        <path d="M12 6v11m-4-7h8" />
      </>
    ),
    sparkles: (
      <>
        <path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5L12 3Z" />
        <path d="M20 2v4m-2-2h4M3 19v3m-1.5-1.5h3" />
      </>
    ),
    book: (
      <>
        <path d="M12 5C9 3 5 3 2 4v15c4-1 7-1 10 1 3-2 6-2 10-1V4c-3-1-7-1-10 1Zm0 0v15" />
        <path d="M5 8h3m-3 4h3m8-4h3m-3 4h3" />
      </>
    ),
    download: (
      <>
        <path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5" />
      </>
    ),
    print: (
      <>
        <path d="M7 8V3h10v5M7 16H3V8h18v8h-4M7 13h10v8H7zM17 11h1" />
      </>
    ),
    edit: (
      <>
        <path d="m15 4 5 5M3 21l5-1L21 7a2 2 0 0 0-5-5L3 15v6Z" />
      </>
    ),
    arrow: <path d="m9 5 7 7-7 7" />,
    search: (
      <>
        <circle cx="10.5" cy="10.5" r="6.5" />
        <path d="m16 16 5 5" />
      </>
    ),
    feather: (
      <>
        <path d="M20 3c-9-3-17 4-14 12l-3 6 6-3c8 2 14-5 11-15Z" />
        <path d="M5 19 17 7m-8 8h6m-2-4V6" />
      </>
    ),
    boots: (
      <>
        <path d="m7 3 9 1-1 10 5 3v4H5v-7l2-11Z" />
        <path d="M7 7h8M5 17h7m0-5 4 1" />
      </>
    ),
    eye: (
      <>
        <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
        <circle cx="12" cy="12" r="3" />
      </>
    ),
    star: <path d="m12 2 3 6.5 7 1-5 5 1 7-6-3.5L6 21l1-6.5-5-5 7-1L12 2Z" />,
    plus: <path d="M12 5v14M5 12h14" />,
  };
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  );
}

const ABILITY_SHORT: Record<Ability, string> = {
  str: "СИЛ",
  dex: "ЛОВ",
  con: "ТЕЛ",
  int: "ИНТ",
  wis: "МДР",
  cha: "ХАР",
};
const signed = (value: number) =>
  value >= 0 ? `+${value}` : `−${Math.abs(value)}`;
type SpellcastingSource = DerivedCharacter["spellcastingSources"][number];

/** Localize common SRD metadata while preserving any unrecognized rule text. */
export function formatSpellFact(value: string): string {
  const exact: Record<string, string> = {
    action: "Действие",
    "1 action": "Действие",
    "action or ritual": "Действие или ритуал",
    "bonus action": "Бонусное действие",
    "1 bonus action": "Бонусное действие",
    reaction: "Реакция",
    "1 reaction": "Реакция",
    instantaneous: "Мгновенно",
    "until dispelled": "Пока не рассеяно",
    "until dispelled or triggered": "До рассеивания или срабатывания",
    self: "На себя",
    touch: "Касание",
    sight: "В пределах видимости",
    unlimited: "Не ограничена",
    special: "Особая",
  };
  return (
    exact[value.toLocaleLowerCase("en").trim()] ??
    value
      .replace(/^Concentration,?\s*/i, "Концентрация, ")
      .replace(/^Up to\s+/i, "До ")
      .replace(/\bup to\s+/gi, "до ")
      .replace(/\b(\d+)\s+feet\b/gi, "$1 фт.")
      .replace(/\b(\d+)\s+minutes?\b/gi, "$1 мин.")
      .replace(/\b(\d+)\s+hours?\b/gi, "$1 ч.")
      .replace(/\b(\d+)\s+days?\b/gi, "$1 дн.")
      .replace(/\b(\d+)\s+rounds?\b/gi, "$1 раунд.")
  );
}

function SpellCard({
  spell,
  prepared,
  hidden,
  sources,
}: {
  spell: SpellOption;
  prepared: boolean;
  hidden?: boolean;
  sources: SpellcastingSource[];
}) {
  return (
    <details className="chsheet-spell" hidden={hidden}>
      <summary>
        <span className="chsheet-spell-icon">
          <SheetIcon name={spell.level === 0 ? "sparkles" : "book"} />
        </span>
        <span className="chsheet-spell-name">
          <strong>{spell.name}</strong>
          <small>
            {spell.school} · {formatSpellFact(spell.castingTime)}
          </small>
        </span>
        <span className="chsheet-spell-tags">
          {prepared && <span className="chsheet-tag">Подготовлено</span>}
          {spell.concentration && (
            <span className="chsheet-tag">Концентрация</span>
          )}
          {spell.ritual && <span className="chsheet-tag">Ритуал</span>}
        </span>
        <span className="chsheet-spell-chevron">
          <SheetIcon name="arrow" size={13} />
        </span>
      </summary>
      <div className="chsheet-spell-details">
        <dl className="chsheet-spell-facts">
          <div>
            <dt>Время накладывания</dt>
            <dd>{formatSpellFact(spell.castingTime)}</dd>
          </div>
          <div>
            <dt>Дистанция</dt>
            <dd>{formatSpellFact(spell.range)}</dd>
          </div>
          <div>
            <dt>Длительность</dt>
            <dd>{formatSpellFact(spell.duration)}</dd>
          </div>
          <div>
            <dt>Уровень заклинания</dt>
            <dd>{spell.level === 0 ? "Заговор" : spell.level}</dd>
          </div>
        </dl>
        {sources.length > 0 && (
          <div
            className="chsheet-spell-sources"
            aria-label={`Источники магии: ${spell.name}`}
          >
            <p className="chsheet-source-label">
              {sources.length > 1
                ? "Доступные источники магии"
                : "Источник магии"}
            </p>
            {sources.map((source) => (
              <div className="chsheet-spell-source" key={source.id}>
                <strong>{source.name}</strong>
                <span>
                  {ABILITY_LABELS[source.ability]} · Сл источника{" "}
                  <b>{source.saveDc}</b> · атака{" "}
                  <b>{signed(source.attackBonus)}</b>
                </span>
              </div>
            ))}
            <p className="chsheet-source-help">
              Используйте эти показатели, когда описание заклинания требует
              атаку или спасбросок.
            </p>
          </div>
        )}
        <p className="chsheet-spell-description">{spell.summary}</p>
        <details className="chsheet-rule-original">
          <summary>Точные правила · {spell.editions[0]} (English)</summary>
          <p className="chsheet-spell-description">{spell.description}</p>
        </details>
      </div>
    </details>
  );
}

/** A portable, read-only sheet. Character creation and campaign persistence belong to its parent. */
export function CharacterSheet({
  draft,
  onEdit,
  onNew,
  savedLabel,
}: CharacterSheetProps) {
  const character: DerivedCharacter = useMemo(
    () => deriveCharacter(draft),
    [draft],
  );
  const [activePane, setActivePane] = useState<
    "features" | "spells" | "progression"
  >("features");
  const [spellQuery, setSpellQuery] = useState("");
  const sheetRef = useRef<HTMLElement>(null);
  const sheetId = useId();
  const characterName = draft.name.trim() || "Безымянный герой";
  const spellcastingSources = character.spellcastingSources;
  const spells = useMemo(
    () =>
      Array.from(
        new Map(
          [
            ...character.selectedCantrips,
            ...character.selectedSpells,
            ...character.preparedSpells,
          ].map((spell) => [spell.id, spell]),
        ).values(),
      ).sort((a, b) => a.level - b.level || a.name.localeCompare(b.name, "ru")),
    [character],
  );
  const preparedIds = useMemo(
    () => new Set(character.preparedSpells.map((spell) => spell.id)),
    [character],
  );
  const filteredSpells = useMemo(() => {
    const query = spellQuery.toLocaleLowerCase("ru").trim();
    return spells.filter((spell) =>
      `${spell.name} ${spell.school} ${spell.summary || ""} ${spell.description}`
        .toLocaleLowerCase("ru")
        .includes(query),
    );
  }, [spells, spellQuery]);
  const filteredSpellIds = new Set(filteredSpells.map((spell) => spell.id));
  const spellLevels = Array.from(new Set(spells.map((spell) => spell.level)));
  const featuresByLevel = useMemo(
    () =>
      Array.from({ length: character.level }, (_, index) => {
        const level = index + 1;
        return {
          level,
          features: character.features.filter(
            (feature) => feature.level === level,
          ),
          choice: draft.levels.find((choice) => choice.level === level),
        };
      }),
    [character, draft.levels],
  );
  const spellCatalog = useMemo(
    () => new Map(SPELLS.map((spell) => [spell.id, spell])),
    [],
  );
  const knownFeats = character.feats.filter(
    (feat) => feat.id !== character.background?.featId,
  );

  function downloadCharacter() {
    const data = {
      format: "shadow-edge-character",
      version: 1,
      exportedAt: new Date().toISOString(),
      attribution: {
        source: draft.edition === "2014" ? "SRD 5.1" : "SRD 5.2.1",
        author: "Wizards of the Coast LLC",
        url: "https://www.dndbeyond.com/srd",
        license: "https://creativecommons.org/licenses/by/4.0/",
        changes:
          "Russian display names, character creation choices and calculated sheet format by Shadow Edge GM.",
      },
      character: draft,
      sheet: character,
    };
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(data, null, 2)], {
        type: "application/json;charset=utf-8",
      }),
    );
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${characterName.replace(/[<>:"/\\|?*\u0000-\u001F]/g, "").slice(0, 80) || "character"}-dnd-${draft.edition}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  const [pdfBusy, setPdfBusy] = useState(false);
  const [pdfError, setPdfError] = useState("");
  const [pdfFile, setPdfFile] = useState<{
    url: string;
    filename: string;
  } | null>(null);
  useEffect(
    () => () => {
      if (pdfFile) URL.revokeObjectURL(pdfFile.url);
    },
    [pdfFile],
  );
  useEffect(() => {
    setPdfFile(null);
  }, [draft]);
  const pdfInFlight = useRef(false);
  async function downloadPdf() {
    if (pdfInFlight.current) return;
    pdfInFlight.current = true;
    setPdfBusy(true);
    setPdfError("");
    try {
      const { downloadCharacterPdf } = await import("./character-pdf");
      setPdfFile(await downloadCharacterPdf(draft));
    } catch (error) {
      setPdfError(
        error instanceof Error
          ? error.message
          : "Не удалось создать PDF. Попробуйте ещё раз.",
      );
    } finally {
      pdfInFlight.current = false;
      setPdfBusy(false);
    }
  }

  function printCharacter() {
    const closedDetails = Array.from(
      sheetRef.current?.querySelectorAll<HTMLDetailsElement>(
        "details:not([open])",
      ) ?? [],
    );
    closedDetails.forEach((detail) => {
      detail.open = true;
    });
    window.addEventListener(
      "afterprint",
      () =>
        closedDetails.forEach((detail) => {
          detail.open = false;
        }),
      { once: true },
    );
    window.print();
  }

  return (
    <article
      className="chsheet"
      ref={sheetRef}
      aria-label={`Лист персонажа: ${characterName}`}
    >
      <div className="chsheet-topline">
        <span className="chsheet-kicker">Хроники приключений</span>
        {savedLabel && (
          <span className="chsheet-status" role="status">
            {savedLabel}
          </span>
        )}
      </div>

      <header className="chsheet-header">
        <div className="chsheet-sigil">
          <SheetIcon name="d20" />
        </div>
        <div className="chsheet-identity">
          <div className="chsheet-edition">
            Лист персонажа · D&D {draft.edition}
          </div>
          <h1 className="chsheet-name">{characterName}</h1>
          <div className="chsheet-identity-line">
            <span>{character.class?.name || "Класс не выбран"}</span>
            <span className="chsheet-separator" aria-hidden="true">
              ·
            </span>
            <span>{character.species?.name || "Происхождение не выбрано"}</span>
            {character.background && (
              <>
                <span className="chsheet-separator" aria-hidden="true">
                  ·
                </span>
                <span>{character.background.name}</span>
              </>
            )}
          </div>
          {character.subclass && (
            <p className="chsheet-subclass">{character.subclass.name}</p>
          )}
        </div>
        <div className="chsheet-level">
          <span>Уровень</span>
          <strong>{character.level}</strong>
        </div>
      </header>

      <div className="chsheet-toolbar" aria-label="Действия с листом персонажа">
        <button
          type="button"
          className="chsheet-button"
          onClick={downloadCharacter}
        >
          <SheetIcon name="download" size={14} />
          Скачать JSON
        </button>
        <button
          type="button"
          className="chsheet-button"
          onClick={downloadPdf}
          disabled={pdfBusy}
        >
          <SheetIcon name="print" size={14} />
          {pdfBusy ? "Создаём PDF…" : "Скачать PDF"}
        </button>
        <button
          type="button"
          className="chsheet-button"
          onClick={printCharacter}
        >
          Печать
        </button>
        {onEdit && (
          <button type="button" className="chsheet-button" onClick={onEdit}>
            <SheetIcon name="edit" size={14} />
            Изменить
          </button>
        )}
        {onNew && (
          <button
            type="button"
            className="chsheet-button chsheet-button--gold"
            onClick={onNew}
          >
            <SheetIcon name="plus" size={14} />
            Новый герой
          </button>
        )}
      </div>

      {pdfError && (
        <p role="alert" className="chsheet-pdf-error">
          {pdfError}
        </p>
      )}
      {pdfFile && (
        <p className="chsheet-pdf-ready" role="status">
          PDF готов. Если скачивание не началось:{" "}
          <a href={pdfFile.url} download={pdfFile.filename}>
            сохранить файл
          </a>{" "}
          ·{" "}
          <a href={pdfFile.url} target="_blank" rel="noopener noreferrer">
            открыть PDF
          </a>
        </p>
      )}
      <section
        className="chsheet-stats"
        aria-label="Характеристики и модификаторы"
      >
        {ABILITIES.map((ability) => (
          <div className="chsheet-stat" key={ability}>
            <span>{ABILITY_LABELS[ability]}</span>
            <strong
              aria-label={`Модификатор: ${signed(character.modifiers[ability])}`}
            >
              {signed(character.modifiers[ability])}
            </strong>
            <small aria-label={`Значение: ${character.abilities[ability]}`}>
              {character.abilities[ability]}
            </small>
          </div>
        ))}
      </section>

      <section className="chsheet-metrics" aria-label="Боевые показатели">
        <div className="chsheet-metric chsheet-metric--hp">
          <SheetIcon name="heart" />
          <div>
            <strong>{character.maxHp}</strong>
            <small>Максимум хитов</small>
          </div>
        </div>
        <div
          className="chsheet-metric"
          title="Класс доспеха без снаряжения; выбранный доспех и щит учитываются отдельно"
        >
          <SheetIcon name="shield" />
          <div>
            <strong>{character.armorClass}</strong>
            <small>КД без доспеха</small>
          </div>
        </div>
        <div className="chsheet-metric">
          <SheetIcon name="sparkles" />
          <div>
            <strong>{signed(character.initiative)}</strong>
            <small>Инициатива</small>
          </div>
        </div>
        <div className="chsheet-metric">
          <SheetIcon name="boots" />
          <div>
            <strong>
              {character.speed}
              <span
                style={{ font: '11px "Segoe UI", sans-serif', marginLeft: 4 }}
              >
                фт
              </span>
            </strong>
            <small>Скорость</small>
          </div>
        </div>
        <div className="chsheet-metric">
          <SheetIcon name="d20" />
          <div>
            <strong>{signed(character.proficiencyBonus)}</strong>
            <small>Бонус мастерства</small>
          </div>
        </div>
      </section>

      <div className="chsheet-body">
        <aside className="chsheet-sidebar" aria-label="Спасброски и навыки">
          <section className="chsheet-panel">
            <h2 className="chsheet-section-title">
              <SheetIcon name="shield" />
              Спасброски
            </h2>
            <dl className="chsheet-skill-list">
              {character.savingThrows.map((save) => (
                <div
                  key={save.ability}
                  className={`chsheet-skill-row${save.proficient ? " chsheet-skill-row--proficient" : ""}`}
                >
                  <dt>
                    <span
                      className="chsheet-proficiency-dot"
                      aria-label={
                        save.proficient ? "Есть владение" : "Без владения"
                      }
                    />
                    {save.name}
                  </dt>
                  <dd>{signed(save.bonus)}</dd>
                </div>
              ))}
            </dl>
            <div className="chsheet-legend">
              <i aria-hidden="true" />
              Есть владение
            </div>
            <div className="chsheet-passive">
              <span>Кости хитов</span>
              <strong>{character.hitDice}</strong>
            </div>
          </section>
          <section className="chsheet-panel">
            <h2 className="chsheet-section-title">
              <SheetIcon name="feather" />
              Навыки
            </h2>
            <dl className="chsheet-skill-list">
              {character.skills.map((skill) => (
                <div
                  key={skill.id}
                  className={`chsheet-skill-row${skill.proficient ? " chsheet-skill-row--proficient" : ""}`}
                >
                  <dt>
                    <span
                      className="chsheet-proficiency-dot"
                      aria-label={
                        skill.proficient ? "Есть владение" : "Без владения"
                      }
                    />
                    {skill.name}
                    <small>{ABILITY_SHORT[skill.ability]}</small>
                  </dt>
                  <dd>{signed(skill.bonus)}</dd>
                </div>
              ))}
            </dl>
            <div className="chsheet-passive">
              <span>Пассивная внимательность</span>
              <strong>{character.passivePerception}</strong>
            </div>
          </section>
        </aside>

        <div className="chsheet-main">
          <nav className="chsheet-tabs" aria-label="Разделы листа персонажа">
            <button
              type="button"
              className="chsheet-tab"
              aria-pressed={activePane === "features"}
              aria-controls={`${sheetId}-features`}
              onClick={() => setActivePane("features")}
            >
              <SheetIcon name="star" />
              Особенности
            </button>
            <button
              type="button"
              className="chsheet-tab"
              aria-pressed={activePane === "spells"}
              aria-controls={`${sheetId}-spells`}
              onClick={() => setActivePane("spells")}
            >
              <SheetIcon name="book" />
              Заклинания
              <span className="chsheet-tab-count">{spells.length}</span>
            </button>
            <button
              type="button"
              className="chsheet-tab"
              aria-pressed={activePane === "progression"}
              aria-controls={`${sheetId}-progression`}
              onClick={() => setActivePane("progression")}
            >
              <SheetIcon name="feather" />
              Развитие
            </button>
          </nav>

          <section
            className="chsheet-pane"
            id={`${sheetId}-features`}
            hidden={activePane !== "features"}
            aria-label="Особенности персонажа"
          >
            <div className="chsheet-pane-heading">
              <h2>То, что делает вас героем</h2>
              <span>{character.class?.name}</span>
            </div>
            <p className="chsheet-note">
              Способности класса, наследие и черты вашего персонажа.
            </p>
            <div className="chsheet-feature-grid">
              {character.traits.map((trait, index) => (
                <div className="chsheet-feature" key={`${index}-${trait}`}>
                  <div className="chsheet-feature-heading">
                    <SheetIcon name="feather" />
                    <h3>{trait}</h3>
                    <small>{character.species?.name}</small>
                  </div>
                </div>
              ))}
              {character.feats.map((feat) => (
                <div
                  className="chsheet-feature chsheet-feature--feat"
                  key={feat.id}
                >
                  <div className="chsheet-feature-heading">
                    <SheetIcon name="star" />
                    <h3>{feat.name}</h3>
                    <small>
                      {feat.category === "origin"
                        ? "Черта происхождения"
                        : feat.category === "epic"
                          ? "Эпический дар"
                          : "Черта"}
                    </small>
                  </div>
                  <p>{feat.description}</p>
                </div>
              ))}
              {character.features.map((feature) => (
                <div
                  className="chsheet-feature"
                  key={`${feature.level}-${feature.id}`}
                >
                  <div className="chsheet-feature-heading">
                    <SheetIcon name="sparkles" />
                    <h3>{feature.name}</h3>
                    <small>{feature.level} ур.</small>
                  </div>
                  <p>{feature.description}</p>
                  {feature.originalDescription && (
                    <details className="chsheet-rule-original">
                      <summary>Текст правил этой редакции (English)</summary>
                      <p>{feature.originalDescription}</p>
                    </details>
                  )}
                </div>
              ))}
            </div>
            {draft.notes.trim() && (
              <section className="chsheet-panel" style={{ marginTop: 20 }}>
                <h3 className="chsheet-section-title">
                  <SheetIcon name="feather" />
                  История и заметки
                </h3>
                <p className="chsheet-note" style={{ whiteSpace: "pre-wrap" }}>
                  {draft.notes}
                </p>
              </section>
            )}
            {character.warnings.length > 0 && (
              <section className="chsheet-panel" style={{ marginTop: 20 }}>
                <h3 className="chsheet-section-title">
                  <SheetIcon name="book" />
                  Для игры за столом
                </h3>
                {character.warnings.map((warning, index) => (
                  <p
                    className="chsheet-note"
                    key={index}
                    style={{ marginTop: index ? 7 : 0 }}
                  >
                    {warning}
                  </p>
                ))}
              </section>
            )}
          </section>

          <section
            className="chsheet-pane"
            id={`${sheetId}-spells`}
            hidden={activePane !== "spells"}
            aria-label="Книга заклинаний"
          >
            <h2 className="chsheet-print-title">Книга заклинаний</h2>
            {spellcastingSources.length > 0 ? (
              <section
                className="chsheet-magic-sources"
                aria-label="Источники магии и их характеристики"
              >
                <div className="chsheet-pane-heading">
                  <h2>Источники вашей магии</h2>
                  <span>{spellcastingSources.length}</span>
                </div>
                <p className="chsheet-note">
                  Класс, происхождение и черты могут использовать разные
                  характеристики. В описании заклинания указаны его источники.
                </p>
                <div className="chsheet-source-grid">
                  {spellcastingSources.map((source) => (
                    <div className="chsheet-source-card" key={source.id}>
                      <h3>
                        <SheetIcon name="sparkles" size={15} />
                        {source.name}
                      </h3>
                      <dl>
                        <div>
                          <dt>Характеристика</dt>
                          <dd title={ABILITY_LABELS[source.ability]}>
                            {ABILITY_SHORT[source.ability]}
                          </dd>
                        </div>
                        <div>
                          <dt>Сл спасброска</dt>
                          <dd>{source.saveDc}</dd>
                        </div>
                        <div>
                          <dt>Атака магией</dt>
                          <dd>{signed(source.attackBonus)}</dd>
                        </div>
                      </dl>
                    </div>
                  ))}
                </div>
              </section>
            ) : (
              character.spellSaveDc !== null && (
                <div
                  className="chsheet-spell-stats"
                  aria-label={`Показатели заклинаний класса: ${character.class?.name || ""}`}
                >
                  <div className="chsheet-spell-stat">
                    <strong>
                      {character.class?.spellAbility
                        ? ABILITY_SHORT[character.class.spellAbility]
                        : "—"}
                    </strong>
                    <span>Базовая характеристика</span>
                  </div>
                  <div className="chsheet-spell-stat">
                    <strong>{character.spellSaveDc}</strong>
                    <span>Сложность спасброска</span>
                  </div>
                  <div className="chsheet-spell-stat">
                    <strong>
                      {character.spellAttackBonus !== null
                        ? signed(character.spellAttackBonus)
                        : "—"}
                    </strong>
                    <span>Атака заклинанием</span>
                  </div>
                </div>
              )
            )}
            {(character.spellSlots.some(Boolean) ||
              character.pactSlots > 0) && (
              <div
                className="chsheet-slots"
                aria-label="Доступные ячейки заклинаний"
              >
                {character.spellSlots.map((count, index) =>
                  count > 0 ? (
                    <div key={index} className="chsheet-slot">
                      <span>
                        {index + 1} круг · {count} яч.
                      </span>
                      <div
                        className="chsheet-slot-dots"
                        aria-label={`${count} ячеек ${index + 1} уровня`}
                      >
                        {Array.from({ length: count }, (_, dot) => (
                          <i key={dot} aria-hidden="true" />
                        ))}
                      </div>
                    </div>
                  ) : null,
                )}
                {character.pactSlots > 0 && (
                  <div className="chsheet-slot">
                    <span>
                      Магия договора · {character.pactSlotLevel} круг ·{" "}
                      {character.pactSlots} яч.
                    </span>
                    <div
                      className="chsheet-slot-dots"
                      aria-label={`${character.pactSlots} ячеек магии договора`}
                    >
                      {Array.from({ length: character.pactSlots }, (_, dot) => (
                        <i key={dot} aria-hidden="true" />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
            {spells.length > 0 ? (
              <>
                <label className="chsheet-search">
                  <SheetIcon name="search" />
                  <input
                    type="search"
                    value={spellQuery}
                    onChange={(event) => setSpellQuery(event.target.value)}
                    placeholder="Название, школа или эффект…"
                    aria-label="Найти заклинание в листе персонажа"
                  />
                </label>
                {spellLevels.map((level) => (
                  <div
                    className="chsheet-spell-group"
                    key={level}
                    hidden={
                      !filteredSpells.some((spell) => spell.level === level)
                    }
                  >
                    <h3 className="chsheet-spell-group-title">
                      {level === 0
                        ? "Заговоры · без расхода ячеек"
                        : `Заклинания ${level} уровня`}
                    </h3>
                    {spells
                      .filter((spell) => spell.level === level)
                      .map((spell) => (
                        <SpellCard
                          key={spell.id}
                          spell={spell}
                          prepared={preparedIds.has(spell.id)}
                          hidden={!filteredSpellIds.has(spell.id)}
                          sources={spellcastingSources.filter((source) =>
                            source.spellIds.includes(spell.id),
                          )}
                        />
                      ))}
                  </div>
                ))}
                {filteredSpells.length === 0 && (
                  <div
                    className="chsheet-empty chsheet-search-empty"
                    role="status"
                  >
                    <SheetIcon name="search" />
                    <strong>Заклинания не найдены</strong>
                    <p>Попробуйте другое название, школу магии или эффект.</p>
                    <button
                      type="button"
                      className="chsheet-button"
                      onClick={() => setSpellQuery("")}
                    >
                      Сбросить поиск
                    </button>
                  </div>
                )}
              </>
            ) : (
              <div className="chsheet-empty">
                <SheetIcon name="book" />
                <strong>
                  {character.spellSaveDc === null
                    ? "Ваша сила — в другом"
                    : "Книга ещё не заполнена"}
                </strong>
                <p>
                  {character.spellSaveDc === null
                    ? "У этого персонажа пока нет заклинаний. Его способности и приёмы собраны в разделе «Особенности»."
                    : "Вернитесь к развитию по уровням, чтобы выбрать доступные заклинания и заговоры."}
                </p>
                {onEdit && character.spellSaveDc !== null && (
                  <button
                    type="button"
                    className="chsheet-button"
                    onClick={onEdit}
                  >
                    Выбрать заклинания
                  </button>
                )}
              </div>
            )}
          </section>

          <section
            className="chsheet-pane"
            id={`${sheetId}-progression`}
            hidden={activePane !== "progression"}
            aria-label="Развитие по уровням"
          >
            <div className="chsheet-pane-heading">
              <h2>Путь вашего героя</h2>
              <span>1 — {character.level} уровень</span>
            </div>
            <p className="chsheet-note">
              Каждый уровень сохраняет сделанные выборы. Так проще вспомнить,
              откуда появилась новая способность.
            </p>
            <div className="chsheet-timeline">
              {featuresByLevel.map(({ level, features, choice }) => {
                const previous = draft.levels.find(
                  (item) => item.level === level - 1,
                );
                const previousSpells = new Set([
                  ...(previous?.spellIds ?? []),
                  ...(previous?.cantripIds ?? []),
                ]);
                const learnedSpells = [
                  ...(choice?.spellIds ?? []),
                  ...(choice?.cantripIds ?? []),
                ]
                  .filter((id) => !previousSpells.has(id))
                  .map((id) => spellCatalog.get(id))
                  .filter((spell): spell is SpellOption => !!spell);
                const feat = knownFeats.find(
                  (option) => option.id === choice?.featId,
                );
                const increases = ABILITIES.filter(
                  (ability) => (choice?.asi?.[ability] ?? 0) > 0,
                );
                return (
                  <div className="chsheet-timeline-step" key={level}>
                    <div className="chsheet-timeline-level" aria-hidden="true">
                      {level}
                    </div>
                    <div className="chsheet-timeline-copy">
                      <h3>
                        {level === 1
                          ? "Начало приключения"
                          : `${level} уровень`}
                      </h3>
                      {level === 1 && (
                        <p>
                          {character.species?.name} ·{" "}
                          {character.background?.name} · {character.class?.name}
                        </p>
                      )}
                      {features.map((feature) => (
                        <p key={feature.id}>
                          <strong>{feature.name}.</strong> {feature.description}
                        </p>
                      ))}
                      {choice?.subclassId && character.subclass && (
                        <p>
                          Подкласс: <strong>{character.subclass.name}</strong>
                        </p>
                      )}
                      {feat && (
                        <p>
                          Новая черта: <strong>{feat.name}</strong>
                        </p>
                      )}
                      {increases.length > 0 && (
                        <p>
                          Улучшение характеристик:{" "}
                          {increases
                            .map(
                              (ability) =>
                                `${ABILITY_LABELS[ability]} +${choice?.asi?.[ability]}`,
                            )
                            .join(", ")}
                          .
                        </p>
                      )}
                      {learnedSpells.length > 0 && (
                        <div className="chsheet-timeline-tags">
                          {learnedSpells.map((spell) => (
                            <span className="chsheet-tag" key={spell.id}>
                              {spell.name}
                            </span>
                          ))}
                        </div>
                      )}
                      {level > 1 &&
                        features.length === 0 &&
                        !feat &&
                        !choice?.subclassId &&
                        increases.length === 0 &&
                        learnedSpells.length === 0 && (
                          <p>
                            Увеличение запаса хитов и развитие возможностей
                            класса.
                          </p>
                        )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      </div>

      <footer className="chsheet-footer">
        <SheetIcon name="d20" />
        <span>
          D&D {draft.edition} ·{" "}
          {draft.edition === "2014" ? "SRD 5.1" : "SRD 5.2.1"}
          {draft.playerName.trim() ? ` · Игрок: ${draft.playerName}` : ""}
          <br />
          КД указан без снаряжения. Хиты: максимум кости на 1-м уровне, затем
          фиксированный прирост класса.
          <br />
          Материалы{" "}
          <a
            href="https://www.dndbeyond.com/srd"
            target="_blank"
            rel="noreferrer"
          >
            SRD от Wizards of the Coast LLC
          </a>{" "}
          ·{" "}
          <a
            href="https://creativecommons.org/licenses/by/4.0/"
            target="_blank"
            rel="noreferrer"
          >
            CC BY 4.0
          </a>
          . Русские названия и формат листа адаптированы.
        </span>
        <SheetIcon name="d20" />
      </footer>
    </article>
  );
}

export default CharacterSheet;

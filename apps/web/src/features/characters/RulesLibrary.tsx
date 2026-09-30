import { RULE_ITEMS } from "./rule-items";
import { useMemo, useState } from "react";
import { SPELLS, type Edition } from "./rules-data";
import { RULE_CREATURES } from "./rule-creatures";
import { SpellReference, CreatureReference, ItemReference } from "./RuleReference";
import { ConditionReference } from "./ConditionReference";
import type { RuleLanguage } from "./random-effect-tables";

/** Read-only local reference; no API, campaign storage, or remote page fetches. */
export function RulesLibrary({ edition }: { edition: Edition }) {
  const [language, setLanguage] = useState<RuleLanguage>("ru");
  const [query, setQuery] = useState("");
  const [limit, setLimit] = useState(20);
  const spells = useMemo(() => {
    const q = query.trim().toLocaleLowerCase();
    return SPELLS.filter(
      (s) =>
        s.editions.includes(edition) &&
        (!q ||
          `${s.name} ${s.school} ${s.descriptionRu ?? ""} ${s.description}`
            .toLocaleLowerCase()
            .includes(q)),
    );
  }, [edition, query]);
  const creatures = RULE_CREATURES.filter(
    (c) =>
      c.edition === edition &&
      (!query.trim() ||
        `${c.name.ru} ${c.name.en}`
          .toLocaleLowerCase()
          .includes(query.trim().toLocaleLowerCase())),
  );
  const items = RULE_ITEMS.filter((item) => item.edition === edition && (!query.trim() || `${item.name.ru} ${item.name.en} ${item.rules.ru} ${item.rules.en}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())));
  return (
    <details className="ch-rule-reference">
      <summary>
        {language === "ru" ? "Библиотека правил" : "Rules library"} · {edition}
      </summary>
      <label>
        {language === "ru" ? "Язык библиотеки" : "Library language"}{" "}
        <select
          value={language}
          onChange={(e) => setLanguage(e.target.value as RuleLanguage)}
        >
          <option value="ru">Русский</option>
          <option value="en">English</option>
        </select>
      </label>
      <ConditionReference edition={edition} language={language} />
      <label>
        {language === "ru"
          ? "Поиск заклинаний, существ и предметов"
          : "Search spells, creatures, and items"}{" "}
        <input
          type="search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setLimit(20);
          }}
        />
      </label>
      <p>
        {language === "ru" ? "Заклинания" : "Spells"}: {spells.length}
      </p>
      {spells.slice(0, limit).map((s) => (
        <SpellReference key={s.id} id={s.id} language={language} />
      ))}
      {limit < spells.length && (
        <button type="button" onClick={() => setLimit((n) => n + 20)}>
          {language === "ru" ? "Показать ещё 20" : "Show 20 more"}
        </button>
      )}
      <p>
        {language === "ru"
          ? "Встроенные существа и формы"
          : "Embedded creatures and forms"}
        : {creatures.length}
      </p>
      {creatures.map((c) => (
        <CreatureReference key={c.id} id={c.id} language={language} />
      ))}
      <p>{language === "ru" ? "Встроенные предметы" : "Embedded items"}: {items.length}</p>
      {items.slice(0, limit).map((item) => <ItemReference key={item.id} id={item.id} language={language} />)}
      {limit < items.length && <button type="button" onClick={() => setLimit((n) => n + 20)}>{language === "ru" ? "Ещё 20 предметов" : "Show 20 more items"}</button>}
    </details>
  );
}

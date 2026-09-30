import { useState } from "react";
import { conditionsForEdition, CONDITION_SOURCES } from "./rule-conditions";
import type { RuleLanguage } from "./random-effect-tables";

export function ConditionReference({
  edition,
  language: inherited,
}: {
  edition: "2014" | "2024";
  language?: RuleLanguage;
}) {
  const [selected, setSelected] = useState<RuleLanguage>("ru");
  const language = inherited ?? selected;
  return (
    <details className="ch-rule-reference">
      <summary>
        {language === "ru" ? "Справочник состояний" : "Condition reference"} ·{" "}
        {edition}
      </summary>
      {!inherited && (
        <label>
          {language === "ru" ? "Язык справочника" : "Reference language"}{" "}
          <select
            value={language}
            onChange={(e) => setSelected(e.target.value as RuleLanguage)}
          >
            <option value="ru">Русский</option>
            <option value="en">English</option>
          </select>
        </label>
      )}
      <p>
        {language === "ru"
          ? "Состояние длится до завершения указанного эффекта или устранения его причины. Несколько одинаковых состояний не усиливают друг друга, кроме истощения; длительность каждого эффекта учитывается отдельно."
          : "A condition lasts until its effect ends or it is countered. Identical conditions do not become stronger, except Exhaustion; each effect retains its own duration."}
      </p>
      {conditionsForEdition(edition).map((c) => (
        <details key={c.id}>
          <summary>{c.name[language]}</summary>
          <p>{c.rules[language]}</p>
        </details>
      ))}
      <p>
        <a href={CONDITION_SOURCES[edition]} target="_blank" rel="noreferrer">
          SRD {edition === "2014" ? "5.1" : "5.2.1"} · CC BY 4.0
        </a>{" "}
        ·{" "}
        {language === "ru"
          ? "Неофициальное изложение правил"
          : "Unofficial rules reference"}
      </p>
    </details>
  );
}

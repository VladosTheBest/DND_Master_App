import { useState } from "react";
import { ConditionReference } from "./ConditionReference";
import { SpellReference, CreatureReference, ItemReference } from "./RuleReference";
import {
  randomEffectTable,
  type RandomEffectTable as TableData,
  type RuleLanguage,
} from "./random-effect-tables";

function TableRows({
  table,
  language,
}: {
  table: TableData;
  language: RuleLanguage;
}) {
  return (
    <>
      {table.note && <p>{table.note[language]}</p>}
      <table className="ch-random-table">
        <thead>
          <tr>
            <th scope="col">{table.dieLabel?.[language] ?? `d${table.die}`}</th>
            <th scope="col">{language === "ru" ? "Эффект" : "Effect"}</th>
          </tr>
        </thead>
        <tbody>
          {table.rows.map((row) => (
            <tr key={row.from}>
              <th scope="row">
                {row.from === row.to ? row.from : `${row.from}–${row.to}`}
              </th>
              <td>
                <p>{row.text[language]}</p>
                {row.subtable && (
                  <details>
                    <summary>
                      {row.subtable.name[language]} · d{row.subtable.die}
                    </summary>
                    <TableRows table={row.subtable} language={language} />
                  </details>
                )}
                {row.spellIds?.map((id) => (
                  <SpellReference key={id} id={id} language={language} />
                ))}
                {row.creatureIds?.map((id) => (
                  <CreatureReference key={id} id={id} language={language} />
                ))}
                {row.itemIds?.map((id) => (
                  <ItemReference key={id} id={id} language={language} />
                ))}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

/** Catalogue data is bundled; expanding a rule never requests a third-party page. */
export function RandomEffectTable({ id, language: selectedLanguage }: { id: string | undefined; language?: RuleLanguage }) {
  const [localLanguage, setLanguage] = useState<RuleLanguage>("ru");
  const language = selectedLanguage ?? localLanguage;
  const table = randomEffectTable(id);
  if (!table) return null;
  return (
    <details className="ch-rule-original">
      <summary>
        {table.name[language]} · {table.edition} ·{" "}
        {table.dieLabel?.[language] ?? `d${table.die}`}
      </summary>
      {!selectedLanguage && <label>
        {language === "ru" ? "Язык таблицы" : "Table language"}{" "}
        <select
          value={language}
          onChange={(e) => setLanguage(e.target.value as RuleLanguage)}
        >
          <option value="ru">Русский</option>
          <option value="en">English</option>
        </select>
      </label>}
      <TableRows table={table} language={language} />
      <ConditionReference edition={table.edition} language={language} />
      <p>
        <a href={table.sourceUrl} target="_blank" rel="noreferrer">
          {language === "ru" ? "Источник" : "Source"}
        </a>{" "}
        · {table.checkedAt}
      </p>
    </details>
  );
}

import { ruleItem } from "./rule-items";
import { RandomEffectTable } from "./RandomEffectTable";
import { SPELLS } from "./rules-data";
import { spellMetadata } from "./spell-metadata";
import { useState } from "react";
import { ruleCreature } from "./rule-creatures";
import type { RuleLanguage } from "./random-effect-tables";

export function FeatureReferences({
  feature,
}: {
  feature: { spellReferenceIds?: string[]; creatureReferenceIds?: string[]; itemReferenceIds?: string[] };
}) {
  const [language, setLanguage] = useState<RuleLanguage>("ru");
  if (
    !feature.spellReferenceIds?.length &&
    !feature.creatureReferenceIds?.length &&
    !feature.itemReferenceIds?.length
  )
    return null;
  return (
    <details className="ch-rule-reference">
      <summary>
        {language === "ru" ? "Связанные правила" : "Related rules"}
      </summary>
      <label>
        {language === "ru" ? "Язык связанных правил" : "Related rules language"}{" "}
        <select
          value={language}
          onChange={(e) => setLanguage(e.target.value as RuleLanguage)}
        >
          <option value="ru">Русский</option>
          <option value="en">English</option>
        </select>
      </label>
      {feature.spellReferenceIds?.map((id) => (
        <SpellReference key={id} id={id} language={language} />
      ))}
      {feature.itemReferenceIds?.map((id) => <ItemReference key={id} id={id} language={language} />)}
      {feature.creatureReferenceIds?.map((id) => (
        <CreatureReference key={id} id={id} language={language} />
      ))}
    </details>
  );
}

export function SpellReference({
  id,
  language,
}: {
  id: string;
  language: RuleLanguage;
}) {
  const spell = SPELLS.find((s) => s.id === id);
  if (!spell) return null;
  const metadata = spellMetadata(spell, language);
  return (
    <details className="ch-rule-reference">
      <summary>
        {language === "en"
          ? spell.name.split(" · ").at(-1)
          : spell.name.split(" · ")[0]}{" "}
        ·{" "}
        {spell.level
          ? `${spell.level}`
          : language === "ru"
            ? "заговор"
            : "cantrip"}
      </summary>
      <p>
        {metadata.castingTime} · {metadata.range} · {metadata.duration}
        {metadata.components ? ` · ${metadata.components}` : ""}
      </p>
      <p>
        {language === "ru"
          ? (spell.descriptionRu ?? spell.description)
          : spell.description}
      </p>
      {language === "ru" && (
        <small>
          {spell.descriptionRu
            ? "Неофициальное русское изложение правил."
            : "Полный русский текст ещё не проверен; показан оригинал на английском."}
        </small>
      )}
      {spell.sourceUrl && <p><a href={spell.sourceUrl} target="_blank" rel="noreferrer">{spell.source ?? (language === "ru" ? "Источник" : "Source")}</a></p>}
      <RandomEffectTable id={spell.randomTableId} language={language} />
      {spell.spellReferenceIds?.map((id) => <SpellReference key={id} id={id} language={language} />)}
      {spell.randomTableIds?.map((id) => <RandomEffectTable key={id} id={id} language={language} />)}
      {spell.itemReferenceIds?.map((id) => <ItemReference key={id} id={id} language={language} />)}
      {spell.creatureReferenceIds?.map((id) => (
        <CreatureReference key={id} id={id} language={language} />
      ))}
    </details>
  );
}
export function CreatureReference({
  id,
  language,
}: {
  id: string;
  language: RuleLanguage;
}) {
  const creature = ruleCreature(id);
  if (!creature) return null;
  const labels =
    language === "ru"
      ? ["СИЛ", "ЛОВ", "ТЕЛ", "ИНТ", "МДР", "ХАР"]
      : ["STR", "DEX", "CON", "INT", "WIS", "CHA"];
  return (
    <details className="ch-rule-reference">
      <summary>
        {creature.name[language]} · {creature.edition}
      </summary>
      <p>{creature.profile[language]}</p>
      <p>
        {language === "ru" ? "КД" : "AC"}{" "}
        {creature.armorClassFormula?.[language] ?? creature.armorClass} ·{" "}
        {language === "ru" ? "Хиты" : "HP"}{" "}
        {creature.hpFormula?.[language] ?? creature.hp} ({creature.hitDice}) ·{" "}
        {language === "ru" ? "ПО" : "CR"} {creature.challenge} ·{" "}
        {language === "ru" ? "БМ" : "PB"}{" "}
        {creature.proficiencyFormula?.[language] ?? `+${creature.proficiency}`}
        {creature.initiative !== undefined
          ? ` · ${language === "ru" ? "Инициатива" : "Initiative"} ${creature.initiative >= 0 ? "+" : ""}${creature.initiative}`
          : ""}
      </p>
      <p>
        {creature.abilities
          .map(
            (score, i) =>
              `${labels[i]} ${score} (${Math.floor((score - 10) / 2) >= 0 ? "+" : ""}${Math.floor((score - 10) / 2)})`,
          )
          .join(" · ")}
      </p>
      {creature.rules.map((rule, i) => (
        <p key={i}>{rule[language]}</p>
      ))}
      {creature.spellIds?.map((spell) => (
        <SpellReference key={spell} id={spell} language={language} />
      ))}
      {creature.creatureIds?.map((id) => <CreatureReference key={id} id={id} language={language} />)}
      <p>
        <a href={creature.sourceUrl} target="_blank" rel="noreferrer">
          {language === "ru" ? "Источник" : "Source"}
        </a>
      </p>
    </details>
  );
}

export function ItemReference({ id, language }: { id: string; language: RuleLanguage }) {
 const item = ruleItem(id);
 if (!item) return null;
 const rarity = language === "en" ? item.rarity.replaceAll("-", " ") : ({common:"обычный",uncommon:"необычный",rare:"редкий","very-rare":"очень редкий",legendary:"легендарный","class-feature":"классовый объект"})[item.rarity];
 return <details className="ch-rule-reference">
  <summary>{item.name[language]} · {item.edition} · {rarity}</summary>
  {item.activation && <p>{item.activation[language]}</p>}
  <p>{item.rules[language]}</p>
  {item.table && <table className="ch-random-table"><thead><tr>{item.table.columns.map((column,i)=><th scope="col" key={i}>{column[language]}</th>)}</tr></thead><tbody>{item.table.rows.map((row,i)=><tr key={i}>{row.map((cell,j)=><td key={j}>{cell[language]}</td>)}</tr>)}</tbody></table>}
  <RandomEffectTable id={item.randomTableId} language={language} />
  {item.creatureIds?.map((creatureId) => <CreatureReference key={creatureId} id={creatureId} language={language} />)}
  {item.spellIds?.map((spellId) => <SpellReference key={spellId} id={spellId} language={language} />)}
  <small>{language === "ru" ? "Неофициальное русское изложение механики. " : "Rules reference. "}<a href={item.sourceUrl} target="_blank" rel="noreferrer">{language === "ru" ? "Источник" : "Source"}</a></small>
 </details>;
}

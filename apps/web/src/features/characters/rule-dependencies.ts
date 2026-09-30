import { SPELLS } from "./rules-data";
import { ruleCreature } from "./rule-creatures";
import { ruleItem } from "./rule-items";
import { randomEffectTable, type RandomEffectTable } from "./random-effect-tables";

export interface RuleReferences {
  spellReferenceIds?: string[];
  creatureReferenceIds?: string[];
  itemReferenceIds?: string[];
  randomTableId?: string;
}

/** Resolve the entire graph before rendering any section; references may point backwards. */
export function collectRuleDependencies(references: RuleReferences[]) {
  const spellIds = new Set<string>();
  const creatureIds = new Set<string>();
  const itemIds = new Set<string>();
  const tableIds = new Set<string>();
  const visitTable = (table?: RandomEffectTable) => {
    if (!table || tableIds.has(table.id)) return;
    tableIds.add(table.id);
    for (const row of table.rows) {
      row.spellIds?.forEach(visitSpell);
      row.creatureIds?.forEach(visitCreature);
      row.itemIds?.forEach(visitItem);
      visitTable(row.subtable);
    }
  };
  const visitSpell = (id: string) => {
    if (spellIds.has(id)) return;
    spellIds.add(id);
    const spell = SPELLS.find((spell) => spell.id === id);
    spell?.spellReferenceIds?.forEach(visitSpell);
    spell?.creatureReferenceIds?.forEach(visitCreature);
    spell?.itemReferenceIds?.forEach(visitItem);
    visitTable(randomEffectTable(spell?.randomTableId));
    spell?.randomTableIds?.forEach((id) => visitTable(randomEffectTable(id)));
  };
  const visitCreature = (id: string) => {
    if (creatureIds.has(id)) return;
    creatureIds.add(id);
    ruleCreature(id)?.spellIds?.forEach(visitSpell);
    ruleCreature(id)?.creatureIds?.forEach(visitCreature);
  };
  const visitItem = (id: string) => {
    if (itemIds.has(id)) return;
    itemIds.add(id);
    const item = ruleItem(id);
    item?.spellIds?.forEach(visitSpell);
    item?.creatureIds?.forEach(visitCreature);
    visitTable(randomEffectTable(item?.randomTableId));
  };
  for (const reference of references) {
    reference.spellReferenceIds?.forEach(visitSpell);
    reference.creatureReferenceIds?.forEach(visitCreature);
    reference.itemReferenceIds?.forEach(visitItem);
    visitTable(randomEffectTable(reference.randomTableId));
  }
  return { spellIds, creatureIds, itemIds, tableIds };
}

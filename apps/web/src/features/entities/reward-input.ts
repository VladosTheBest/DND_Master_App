import type { MonsterRewardProfile } from "@shadow-edge/shared-types";

/** Empty editor rows are scaffolding, not loot. An explicit empty document
 * also lets a full editor clear existing rewards through the PATCH contract. */
export function sanitizeMonsterRewardProfile(profile?: MonsterRewardProfile): MonsterRewardProfile | undefined {
  if (!profile) return undefined;
  const optional=(value?:string)=>value?.trim()||undefined;
  return {
    summary:profile.summary.trim(),
    loot:profile.loot.map(entry=>({name:entry.name.trim(),category:entry.category.trim(),quantity:entry.quantity.trim(),check:entry.check.trim(),dc:optional(entry.dc),details:optional(entry.details)}))
      .filter(entry=>entry.name||(entry.category&&entry.category!=="Лут")||entry.quantity||entry.check||entry.dc||entry.details)
      .map(entry=>({...entry,name:entry.name||"Безымянная добыча",category:entry.category||"Лут",quantity:entry.quantity||"1",check:entry.check||"Без проверки"}))
  };
}

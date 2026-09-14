import { ABILITIES, type Ability } from "./rules-data";

export const STANDARD_SCORES = [8, 10, 12, 13, 14, 15];
export const abilityCost = (score: number): number =>
  ({ 8: 0, 9: 1, 10: 2, 11: 3, 12: 4, 13: 5, 14: 7, 15: 9 })[score] ?? Infinity;

export function adjustAbility(
  draft: Pick<CharacterDraftLike, "abilityMethod" | "abilities">,
  ability: Ability,
  direction: -1 | 1,
): Record<Ability, number> | null {
  const current = draft.abilities[ability];
  const next =
    draft.abilityMethod === "standard"
      ? STANDARD_SCORES[STANDARD_SCORES.indexOf(current) + direction]
      : current + direction;
  if (next === undefined || next < 8 || next > 15) return null;
  const abilities = { ...draft.abilities };
  if (draft.abilityMethod === "standard") {
    const other = ABILITIES.find(
      (id) => id !== ability && abilities[id] === next,
    );
    if (!other) return null;
    abilities[other] = current;
  }
  abilities[ability] = next;
  if (
    draft.abilityMethod === "point-buy" &&
    ABILITIES.reduce((sum, id) => sum + abilityCost(abilities[id]), 0) > 27
  )
    return null;
  return abilities;
}

interface CharacterDraftLike {
  abilityMethod: "standard" | "point-buy";
  abilities: Record<Ability, number>;
}

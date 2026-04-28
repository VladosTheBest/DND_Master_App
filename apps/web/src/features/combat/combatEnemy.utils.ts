import type { BestiaryMonsterSummary } from "@shadow-edge/shared-types";
import type { CombatProfileEntity, CombatSearchItem } from "./combat.types";
import { combatSelectionBestiaryKey, combatSelectionEntityKey, getEntityChallenge } from "./combat.utils";

export const isCombatSelectionEntityKey = (value: string) => value.startsWith("entity:");
export const isCombatSelectionBestiaryKey = (value: string) => value.startsWith("bestiary:");

export const unwrapCombatSelectionKey = (value: string) => {
  const separator = value.indexOf(":");
  return separator >= 0 ? value.slice(separator + 1) : value;
};

const normalizeCombatSearchQuery = (value: string) => value.trim().toLowerCase();

export const matchesCombatEnemySearch = (entity: CombatProfileEntity, query: string, challenge: string) => {
  const normalizedQuery = normalizeCombatSearchQuery(query);
  const matchesSearch =
    !normalizedQuery ||
    [entity.title, entity.subtitle, entity.summary, entity.role ?? "", entity.tags.join(" "), entity.statBlock?.creatureType ?? ""]
      .join(" ")
      .toLowerCase()
      .includes(normalizedQuery);
  const matchesChallenge = !challenge || getEntityChallenge(entity) === challenge;
  return matchesSearch && matchesChallenge;
};

export const mapCombatEntityToSearchItem = (entity: CombatProfileEntity): CombatSearchItem => ({
  key: combatSelectionEntityKey(entity.id),
  source: "entity",
  id: entity.id,
  kind: entity.kind === "monster" ? "monster" : "npc",
  title: entity.title,
  subtitle: entity.subtitle,
  summary: entity.summary,
  challenge: entity.statBlock?.challenge ?? "",
  entity
});

export const mapBestiaryMonsterToSearchItem = (item: BestiaryMonsterSummary): CombatSearchItem => ({
  key: combatSelectionBestiaryKey(item.id),
  source: "bestiary",
  id: item.id,
  kind: "monster",
  title: item.title,
  subtitle: item.subtitle,
  summary: item.summary,
  challenge: item.challenge,
  bestiary: item
});

export const normalizeCombatQuantity = (value: number) => (Number.isFinite(value) ? Math.max(1, Math.floor(value)) : 1);
export const normalizeCombatInitiative = (value: number) => (Number.isFinite(value) ? Math.floor(value) : 0);

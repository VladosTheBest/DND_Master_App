import type {
  BestiaryMonsterSummary,
  ModuleId,
  MonsterEntity
} from "@shadow-edge/shared-types";
import { getEntityChallenge } from "../combat/combat.utils";

export const isBestiaryBrowseTab = (moduleId: ModuleId, tab: string) => moduleId === "monsters" && tab !== "Imported";

export const bestiaryBrowseTabLabel = (tab: string) => {
  if (tab === "Catalog") {
    return "Каталог dnd.su";
  }
  if (tab === "Named NPC") {
    return "Именные NPC из бестиария";
  }
  return "Карточки с пометкой «Классика»";
};

export const splitBestiaryContent = (value: string) =>
  value
    .split(/\n+/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);

export const filterImportedMonsters = (monsters: MonsterEntity[], search: string, challenge: string) => {
  const normalizedSearch = search.trim().toLowerCase();

  return monsters.filter((monster) => {
    const matchesSearch =
      !normalizedSearch ||
      [monster.title, monster.subtitle, monster.summary, monster.role ?? "", monster.tags.join(" "), monster.statBlock?.creatureType ?? ""]
        .join(" ")
        .toLowerCase()
        .includes(normalizedSearch);
    const matchesChallenge = !challenge || getEntityChallenge(monster) === challenge;
    return matchesSearch && matchesChallenge;
  });
};

export const findBestiarySummary = (items: BestiaryMonsterSummary[] = [], monsterId: string) =>
  items.find((item) => item.id === monsterId) ?? null;

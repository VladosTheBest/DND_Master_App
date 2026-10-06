import type { NpcStatBlock } from "@shadow-edge/shared-types";

export type AdventureSection = {
  title: string;
  kind: "gm" | "read_aloud" | "rules" | "loot";
  text: string;
  pages: number[];
  topic?: string;
  sourceKind?: "quote" | "excerpt";
};
export type AdventurePlayerCard = { title: string; text: string; pages: number[]; sourceKind: "quote" | "excerpt" };
export type AdventureMaterial = {
  title: string;
  summary: string;
  sourcePages: number[];
  sections: AdventureSection[];
  chapterIds?: number[];
  chapterNotes?: { chapterId: number; pages: number[]; text: string }[];
  locationIds?: string[];
  locationLinks?: { locationId: string; pages: number[]; reason: string; relation?: "encounter" | "mention" | "unplaced" }[];
  playerCards?: AdventurePlayerCard[];
  statProfiles?: { title: string; basis: string; pages: number[]; notes?: string; sourceTitle?: string; sourceURL?: string; statBlock: NpcStatBlock }[];
};
export type AdventureChapter = { id: number; title: string; pages: number[]; levelMin: number; levelMax: number | null; levelLabel: string; levelNote: string; levelPages: number[] };
export type AdventureNode = {
  id: string;
  entityId: string;
  title: string;
  kind: "adventure" | "region" | "city" | "site" | "area" | "landmark" | "npc" | "group";
  parentId?: string | null;
  chapterIds: number[];
  navigationGroup?: boolean;
  pages?: number[];
  reason?: string;
  relation?: "encounter" | "mention" | "unplaced";
};
export type AdventurePresentation = { templateId: string; version: number; items: Record<string, AdventureMaterial>; rootId?: string; nodes?: AdventureNode[]; chapters?: AdventureChapter[] };
export const adventureSourceId = (id: string) => id.slice(id.lastIndexOf("frost-"));
export const adventureKindLabels: Record<AdventureNode["kind"], string> = {
  adventure: "Приключение", region: "Регион", city: "Город", site: "Место приключения", area: "Область карты", landmark: "Место в городе", npc: "НПС", group: "Персонажи приключения"
};

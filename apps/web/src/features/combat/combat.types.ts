import type {
  BestiaryMonsterSummary,
  CombatDifficulty,
  KnowledgeEntity,
  MonsterEntity,
  NpcEntity,
  PlayerEntity
} from "@shadow-edge/shared-types";

export type EncounterDifficultyId = Exclude<CombatDifficulty, "custom">;

export type CombatProfileEntity = PlayerEntity | NpcEntity | MonsterEntity;
export type PreparedCombatHostEntity = Extract<KnowledgeEntity, { kind: "location" | "quest" }>;

export type CombatSearchItem = {
  key: string;
  source: "entity" | "bestiary";
  id: string;
  kind: "npc" | "monster";
  title: string;
  subtitle: string;
  summary: string;
  challenge: string;
  entity?: CombatProfileEntity;
  bestiary?: BestiaryMonsterSummary;
};

export type CombatCatalogOption = {
  value: string;
  label: string;
};

export type CombatResolvedNpc = {
  entity: NpcEntity | MonsterEntity;
  quantity: number;
};

import type {
  MonsterEntity,
  NpcEntity,
  PlayerEntity
} from "@shadow-edge/shared-types";

export type EntityModalMode = "create" | "edit";
export type StatEntrySectionKey = "traits" | "actions" | "bonusActions" | "reactions";
export type CombatProfileEntity = PlayerEntity | NpcEntity | MonsterEntity;
export type EntityTextField = "content" | "playerContent";
export type LinkableTextField = EntityTextField | "noteContent";

export type EntityLinkSelection = {
  mode: "editor" | "entity" | "noteEditor";
  field: LinkableTextField;
  start: number;
  end: number;
  text: string;
  x: number;
  y: number;
  entityId?: string;
};

export type EntityActionMenuState = {
  entityId: string;
  x: number;
  y: number;
};

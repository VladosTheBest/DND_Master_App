import type {
  BestiaryBrowseResult,
  BestiaryMonsterDetail,
  BestiaryMonsterSummary,
  ModuleId,
  MonsterEntity
} from "@shadow-edge/shared-types";

export type BestiaryBrowseTab = "Catalog" | "Named NPC" | "Classic";
export type BestiaryViewMode = "browse" | "imported";

export type ImportedMonsterFilters = {
  search: string;
  challenge: string;
};

export type BestiaryControllerArgs = {
  activeCampaignId: string;
  activeModule: ModuleId;
  activeTab: string;
  campaignMonsters: MonsterEntity[];
  onImportSuccess: (monsterId: string) => Promise<void>;
  setBootError: (value: string) => void;
};

export type BestiaryBrowseState = {
  result: BestiaryBrowseResult | null;
  selectedId: string;
  selectedMonster: BestiaryMonsterDetail | null;
  loading: boolean;
  detailLoading: boolean;
  importing: boolean;
};

export type ImportedMonsterState = {
  filters: ImportedMonsterFilters;
  monsters: MonsterEntity[];
};

export type BestiaryCardItem =
  | {
      variant: "browse";
      item: BestiaryMonsterSummary;
    }
  | {
      variant: "imported";
      item: MonsterEntity;
    };

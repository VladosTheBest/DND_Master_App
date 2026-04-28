import type {
  BestiaryBrowseResult,
  BestiaryMonsterDetail,
  CampaignData,
  CampaignPreparedCombat,
  KnowledgeEntity,
  MonsterEntity,
  NpcEntity,
  PlayerEntity
} from "@shadow-edge/shared-types";
import type { CombatCatalogOption, CombatProfileEntity, CombatSearchItem, PreparedCombatHostEntity } from "./combat.types";

export type UseCombatEnemySearchArgs = {
  combatRoster: CombatProfileEntity[];
  combatSetupOpen: boolean;
  hasActiveCombatEntries: boolean;
  preparedCombatModalOpen: boolean;
  setBootError: (value: string) => void;
};

export type UseCombatDraftControllerArgs = {
  activeCampaignId: string;
  campaignTitle: string;
  entityMap: Map<string, KnowledgeEntity>;
  hydrateCampaign: (campaign: CampaignData, preferredEntityId?: string) => void;
  onSelectCombatEntity: (entityId: string) => void;
  selectedCombatSearchItem: CombatSearchItem | null;
  combatSelectionQuantity: number;
  setBootError: (value: string) => void;
  setPreviewEntityId: (value: string) => void;
  setSaving: (value: boolean) => void;
};

export type CombatDraftResolvedItem = {
  entity: NpcEntity | MonsterEntity;
  quantity: number;
};

export type CombatDraftControllerState = {
  campaignPreparedCombatDraft: CampaignPreparedCombat;
  campaignPreparedCombatNotice: string;
  preparedCombatPlayerInitiatives: Record<string, number>;
  preparedCombatAllyInitiatives: Record<string, number>;
  preparedCombatEnemyInitiatives: Record<string, number>;
  draftPreparedCombatPlayers: PlayerEntity[];
  draftPreparedCombatPlayerLevels: number[];
  draftPreparedCombatAllies: CombatDraftResolvedItem[];
  draftPreparedCombatAllyIds: Set<string>;
  draftPreparedCombatEnemies: CombatDraftResolvedItem[];
  draftPreparedCombatAllyCount: number;
  campaignPreparedCombatDraftEnemyCount: number;
  draftPreparedCombatPartyCount: number;
  draftEnemyExperienceTotal: number;
  canStartPreparedCombatDraft: boolean;
};

export type CombatDraftControllerActions = {
  replaceCampaignPreparedCombatDraft: (draft?: CampaignPreparedCombat | null) => void;
  setCampaignPreparedCombatNotice: (value: string) => void;
  toggleCampaignPreparedCombatPlayer: (playerId: string) => void;
  toggleCampaignPreparedCombatAlly: (entityId: string) => void;
  addCampaignPreparedCombatDraftItem: (pickedItem?: CombatSearchItem) => Promise<void>;
  updateCampaignPreparedCombatDraftItem: (entityId: string, patch: { quantity?: number; initiative?: number }) => void;
  removeCampaignPreparedCombatDraftItem: (entityId: string) => void;
  removeCampaignPreparedCombatDraftAlly: (entityId: string) => void;
  setPreparedCombatPlayerInitiative: (playerId: string, value: number) => void;
  setPreparedCombatAllyInitiative: (entityId: string, value: number) => void;
  setPreparedCombatEnemyInitiative: (entityId: string, value: number) => void;
  clearPreparedCombatDraft: (options?: { fallbackTitle?: string; onAfterClear?: () => void }) => void;
};

export type CombatEnemySearchControllerState = {
  combatBestiary: BestiaryBrowseResult | null;
  combatBestiaryLoading: boolean;
  combatEnemyTypeFilter: string;
  combatEnemyTypeOptions: CombatCatalogOption[];
  combatSearchChallenge: string;
  combatSearchItems: CombatSearchItem[];
  combatSearchQuery: string;
  combatSelectedBestiaryMonster: BestiaryMonsterDetail | null;
  combatSelectionId: string;
  combatSelectionInitiative: number;
  combatSelectionQuantity: number;
  filteredCombatCatalogItems: CombatSearchItem[];
  preparedCombatBestiaryLoading: boolean;
  preparedCombatChallenge: string;
  preparedCombatQuantity: number;
  preparedCombatSearchItems: CombatSearchItem[];
  preparedCombatSearchQuery: string;
  preparedCombatSelectionId: string;
  selectedCombatSearchItem: CombatSearchItem | null;
  selectedCombatSearchProfile: CombatProfileEntity | null;
  selectedPreparedCombatSearchItem: CombatSearchItem | null;
};

export type CombatEnemySearchControllerActions = {
  resetCombatEnemySearch: () => void;
  resetPreparedCombatEnemySearch: () => void;
  selectCombatEntity: (entityId: string) => void;
  selectPreparedCombatEntity: (entityId: string) => void;
  setCombatEnemyTypeFilter: (value: string) => void;
  setCombatSearchChallenge: (value: string) => void;
  setCombatSearchQuery: (value: string) => void;
  setCombatSelectionId: (value: string) => void;
  setCombatSelectionInitiative: (value: number) => void;
  setCombatSelectionQuantity: (value: number) => void;
  setPreparedCombatChallenge: (value: string) => void;
  setPreparedCombatQuantity: (value: number) => void;
  setPreparedCombatSearchQuery: (value: string) => void;
  setPreparedCombatSelectionId: (value: string) => void;
};

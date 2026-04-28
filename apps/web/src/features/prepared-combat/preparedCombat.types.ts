import type {
  ActiveCombat,
  CampaignData,
  CampaignPreparedCombat,
  CombatDifficulty,
  CombatResult,
  CombatThresholds,
  CreateEntityInput,
  GenerateCombatResult,
  KnowledgeEntity,
  PreparedCombatItem,
  PreparedCombatPlan,
  QuestEntity
} from "@shadow-edge/shared-types";
import type { CombatSearchItem, PreparedCombatHostEntity } from "../combat/combat.types";

export type PreparedCombatResolvedEntry = {
  entity: Extract<KnowledgeEntity, { kind: "player" | "npc" | "monster" }>;
  quantity: number;
};

export type PreparedCombatCardView = {
  title: string;
  playersText: string;
  enemiesText: string;
  xpText: string;
  startDisabled?: boolean;
  startLabel?: string;
};

export type EntityCombatSetupState = {
  entityId: string;
  planIndex: number;
  isNew: boolean;
};

export type UsePreparedCombatControllerArgs = {
  activeCampaignId: string;
  activeCombat: ActiveCombat | null;
  campaign: CampaignData | null;
  campaignPreparedCombat: CampaignPreparedCombat | null;
  campaignPreparedCombatDraft: CampaignPreparedCombat;
  combatCustomAdjustedXp: number;
  combatDifficulty: CombatDifficulty;
  combatMonsterCount: number;
  combatPrompt: string;
  combatSetupOpen: boolean;
  combatTitle: string;
  effectiveCombatThresholds: CombatThresholds;
  effectivePartyLevels: number[];
  effectivePartySize: number;
  entityCombatSetupState: EntityCombatSetupState | null;
  entityCombatSetupTarget: KnowledgeEntity | null;
  entityMap: Map<string, KnowledgeEntity>;
  hasExplicitPartyLevels: boolean;
  hydrateCampaign: (campaign: CampaignData, preferredEntityId?: string) => void;
  onApplyCombatPayload: (result: CombatResult | GenerateCombatResult) => void;
  onCloseCombatSetupModal: () => void;
  onEntityToForm: (entity: KnowledgeEntity) => CreateEntityInput;
  onHandleProtectedActionError: (error: unknown, fallbackMessage: string) => void;
  onOpenCombatScreen: () => void;
  onOpenEntityPreparedCombatSetup: (
    entity: PreparedCombatHostEntity,
    plan: PreparedCombatPlan | undefined,
    planIndex: number,
    isNew?: boolean
  ) => void;
  onOpenQuestFocus: (questId: string) => void;
  onPeekEntity: (entityId: string) => void;
  onRequestModalClose: (title: string, onConfirm: () => void, description?: string, confirmLabel?: string) => void;
  onResetCombatPartyLevelsText: () => void;
  onSerializeEntityForm: (form: CreateEntityInput) => CreateEntityInput;
  persistedCombatPartyLevel?: number;
  preparedCombatModalOpen: boolean;
  preparedCombatAllyInitiatives: Record<string, number>;
  preparedCombatEnemyInitiatives: Record<string, number>;
  preparedCombatPlayerInitiatives: Record<string, number>;
  preparedCombatQuantity: number;
  replaceCampaignPreparedCombatDraft: (draft?: CampaignPreparedCombat | null) => void;
  resetPreparedCombatEnemySearch: () => void;
  selectPreparedCombatEntity: (entityId: string) => void;
  selectedPreparedCombatSearchItem: CombatSearchItem | null;
  setBootError: (value: string) => void;
  setCampaignPreparedCombatNotice: (value: string) => void;
  setEntityCombatSetupState: (value: EntityCombatSetupState | null) => void;
  setGenerating: (value: boolean) => void;
  setPreparedCombatModalOpen: (value: boolean) => void;
  setPreviewEntityId: (value: string) => void;
  setSaving: (value: boolean) => void;
};

export type PreparedCombatController = {
  preparedCombatDraft: PreparedCombatPlan;
  preparedCombatModalOpen: boolean;
  preparedCombatNotice: string;
  preparedCombatQuest: QuestEntity | null;
  preparedCombatQuestId: string;
  addPreparedCombatDraftItem: () => Promise<void>;
  closePreparedCombatModal: () => void;
  deletePreparedCombatCard: (entity: PreparedCombatHostEntity, cardIndex: number) => Promise<void>;
  generateCombatEncounter: () => Promise<void>;
  handleQuestCombatAction: (quest: QuestEntity) => void;
  openPreparedCombatModal: (quest: QuestEntity) => void;
  removePreparedCombatDraftItem: (entityId: string) => void;
  requestPreparedCombatCardDeletion: (entity: PreparedCombatHostEntity, card: PreparedCombatCardView, cardIndex: number) => void;
  saveCampaignPreparedCombatDraft: () => Promise<void>;
  saveEntityPreparedCombatDraft: () => Promise<void>;
  savePreparedCombatDraft: () => Promise<void>;
  startConfiguredCombat: () => Promise<void>;
  startEntityPreparedCombat: (
    entity: PreparedCombatHostEntity,
    plan: PreparedCombatPlan | undefined,
    planIndex: number
  ) => Promise<void>;
  startPreparedQuestCombat: (quest: QuestEntity) => Promise<void>;
  updatePreparedCombatDraftItem: (entityId: string, patch: Partial<PreparedCombatItem>) => void;
  updatePreparedCombatTitle: (value: string) => void;
};

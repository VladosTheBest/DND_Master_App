import type {
  CampaignData,
  EntityKind,
  KnowledgeEntity
} from "@shadow-edge/shared-types";
import type { MouseEvent as ReactMouseEvent } from "react";

export type EntityActionMenuState = {
  entityId: string;
  x: number;
  y: number;
};

export type UseEntityActionsControllerArgs = {
  activeCampaignId: string;
  editingEntityId: string;
  entityGalleryTargetId?: string;
  entityMap: Map<string, KnowledgeEntity>;
  entityPlaylistTargetId?: string;
  galleryViewerOwnerId?: string;
  playerFacingEntityId?: string;
  preparedCombatQuestId: string;
  setBootError: (value: string) => void;
  setSaving: (value: boolean) => void;
  onCloseEntityGalleryModal: () => void;
  onCloseEntityModal: () => void;
  onCloseEntityPlaylistModal: () => void;
  onCloseGalleryViewer: () => void;
  onClosePlayerFacingView: () => void;
  onClosePreparedCombatModal: () => void;
  onCloseEntityLinkContextMenu: () => void;
  onHydrateCampaign: (campaign: CampaignData) => void;
  onOpenEntityModule: (kind: EntityKind) => void;
  onRemovePinnedEntity: (entityId: string) => void;
};

export type OpenEntityActionMenu = (entity: KnowledgeEntity, event: ReactMouseEvent<HTMLElement>) => void;

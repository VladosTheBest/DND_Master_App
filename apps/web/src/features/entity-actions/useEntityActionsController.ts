import type {
  KnowledgeEntity
} from "@shadow-edge/shared-types";
import {
  useEffect,
  useMemo,
  useState,
  type MouseEvent as ReactMouseEvent
} from "react";
import { api } from "../../app/api";
import type { UseEntityActionsControllerArgs } from "./entityActions.types";
import { createEntityActionMenuState } from "./entityActions.utils";

export function useEntityActionsController({
  activeCampaignId,
  editingEntityId,
  entityGalleryTargetId,
  entityMap,
  entityPlaylistTargetId,
  galleryViewerOwnerId,
  playerFacingEntityId,
  preparedCombatQuestId,
  setBootError,
  setSaving,
  onCloseEntityGalleryModal,
  onCloseEntityModal,
  onCloseEntityPlaylistModal,
  onCloseGalleryViewer,
  onClosePlayerFacingView,
  onClosePreparedCombatModal,
  onCloseEntityLinkContextMenu,
  onHydrateCampaign,
  onOpenEntityModule,
  onRemovePinnedEntity,
}: UseEntityActionsControllerArgs) {
  const [entityActionMenu, setEntityActionMenu] = useState<ReturnType<typeof createEntityActionMenuState> | null>(null);
  const [pendingDeleteEntityId, setPendingDeleteEntityId] = useState("");

  const entityActionMenuTarget = useMemo(
    () => (entityActionMenu && entityMap.has(entityActionMenu.entityId) ? entityMap.get(entityActionMenu.entityId) ?? null : null),
    [entityActionMenu, entityMap]
  );
  const pendingDeleteEntity = useMemo(
    () => (pendingDeleteEntityId && entityMap.has(pendingDeleteEntityId) ? entityMap.get(pendingDeleteEntityId) ?? null : null),
    [entityMap, pendingDeleteEntityId]
  );

  useEffect(() => {
    if (!entityActionMenu) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setEntityActionMenu(null);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [entityActionMenu]);

  const closeEntityActionMenu = () => {
    setEntityActionMenu(null);
  };

  const openEntityActionMenu = (entity: KnowledgeEntity, event: ReactMouseEvent<HTMLElement>) => {
    event.preventDefault();
    onCloseEntityLinkContextMenu();
    setEntityActionMenu(createEntityActionMenuState(entity.id, event.clientX, event.clientY));
  };

  const requestEntityDeletion = (entity: KnowledgeEntity) => {
    setEntityActionMenu(null);
    setPendingDeleteEntityId(entity.id);
  };

  const cancelEntityDeletion = () => {
    setPendingDeleteEntityId("");
  };

  const confirmEntityDeletion = async (entity: KnowledgeEntity) => {
    if (!activeCampaignId) {
      return;
    }

    try {
      setSaving(true);
      const result = await api.deleteEntity(activeCampaignId, entity.id);
      onRemovePinnedEntity(result.entityId);
      onHydrateCampaign(result.campaign);
      onOpenEntityModule(result.kind);

      if (editingEntityId === entity.id) {
        onCloseEntityModal();
      }
      if (entityPlaylistTargetId === entity.id) {
        onCloseEntityPlaylistModal();
      }
      if (entityGalleryTargetId === entity.id) {
        onCloseEntityGalleryModal();
      }
      if (preparedCombatQuestId === entity.id) {
        onClosePreparedCombatModal();
      }
      if (playerFacingEntityId === entity.id) {
        onClosePlayerFacingView();
      }
      if (galleryViewerOwnerId === entity.id) {
        onCloseGalleryViewer();
      }

      setPendingDeleteEntityId("");
      setBootError("");
    } catch (error) {
      setBootError(error instanceof Error ? error.message : "Не удалось удалить сущность.");
    } finally {
      setSaving(false);
    }
  };

  return {
    cancelEntityDeletion,
    closeEntityActionMenu,
    confirmEntityDeletion,
    entityActionMenu,
    entityActionMenuTarget,
    openEntityActionMenu,
    pendingDeleteEntity,
    requestEntityDeletion
  };
}

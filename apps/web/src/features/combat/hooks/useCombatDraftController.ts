import { useEffect, useMemo, useState } from "react";
import { api } from "../../../app/api";
import type {
  CombatDraftControllerActions,
  CombatDraftControllerState,
  UseCombatDraftControllerArgs
} from "../combatEnemy.types";
import { normalizeCombatQuantity } from "../combatEnemy.utils";
import {
  cloneCampaignPreparedCombat,
  countPreparedCombatItems,
  createEmptyCampaignPreparedCombat,
  parseChallengeXp,
  sanitizePartyLevel
} from "../combat.utils";

const buildInitiativeMap = <T extends { id: string }>(
  current: Record<string, number>,
  items: T[]
) => {
  const next = items.reduce<Record<string, number>>((accumulator, item) => {
    accumulator[item.id] = Number.isFinite(current[item.id]) ? current[item.id] : 0;
    return accumulator;
  }, {});
  const nextKeys = Object.keys(next);
  const currentKeys = Object.keys(current);
  if (nextKeys.length === currentKeys.length && nextKeys.every((key) => current[key] === next[key])) {
    return current;
  }
  return next;
};

export function useCombatDraftController({
  activeCampaignId,
  campaignTitle,
  entityMap,
  hydrateCampaign,
  onSelectCombatEntity,
  selectedCombatSearchItem,
  combatSelectionQuantity,
  setBootError,
  setPreviewEntityId,
  setSaving
}: UseCombatDraftControllerArgs): CombatDraftControllerState & CombatDraftControllerActions {
  const [campaignPreparedCombatDraft, setCampaignPreparedCombatDraftState] = useState(createEmptyCampaignPreparedCombat);
  const [campaignPreparedCombatNotice, setCampaignPreparedCombatNoticeState] = useState("");
  const [preparedCombatPlayerInitiatives, setPreparedCombatPlayerInitiatives] = useState<Record<string, number>>({});
  const [preparedCombatAllyInitiatives, setPreparedCombatAllyInitiatives] = useState<Record<string, number>>({});
  const [preparedCombatEnemyInitiatives, setPreparedCombatEnemyInitiatives] = useState<Record<string, number>>({});

  const draftPreparedCombatPlayers = useMemo(
    () =>
      campaignPreparedCombatDraft.playerIds
        .map((playerId) => entityMap.get(playerId))
        .filter((entity): entity is CombatDraftControllerState["draftPreparedCombatPlayers"][number] => entity?.kind === "player"),
    [campaignPreparedCombatDraft.playerIds, entityMap]
  );

  const draftPreparedCombatPlayerLevels = useMemo(
    () =>
      draftPreparedCombatPlayers
        .map((player) => sanitizePartyLevel(player.level))
        .filter((level): level is number => Number.isFinite(level)),
    [draftPreparedCombatPlayers]
  );

  const draftPreparedCombatAllies = useMemo(
    () =>
      (campaignPreparedCombatDraft.allies ?? [])
        .map((item) => {
          const entity = entityMap.get(item.entityId);
          return entity?.kind === "npc" || entity?.kind === "monster"
            ? {
                entity,
                quantity: normalizeCombatQuantity(item.quantity)
              }
            : null;
        })
        .filter((item): item is CombatDraftControllerState["draftPreparedCombatAllies"][number] => Boolean(item)),
    [campaignPreparedCombatDraft.allies, entityMap]
  );

  const draftPreparedCombatAllyIds = useMemo(
    () => new Set((campaignPreparedCombatDraft.allies ?? []).map((item) => item.entityId)),
    [campaignPreparedCombatDraft.allies]
  );

  const draftPreparedCombatEnemies = useMemo(
    () =>
      campaignPreparedCombatDraft.items
        .map((item) => {
          if (draftPreparedCombatAllyIds.has(item.entityId)) {
            return null;
          }
          const entity = entityMap.get(item.entityId);
          return entity?.kind === "npc" || entity?.kind === "monster"
            ? {
                entity,
                quantity: normalizeCombatQuantity(item.quantity)
              }
            : null;
        })
        .filter((item): item is CombatDraftControllerState["draftPreparedCombatEnemies"][number] => Boolean(item)),
    [campaignPreparedCombatDraft.items, draftPreparedCombatAllyIds, entityMap]
  );

  const draftPreparedCombatAllyCount = countPreparedCombatItems(campaignPreparedCombatDraft.allies ?? []);
  const campaignPreparedCombatDraftEnemyCount = draftPreparedCombatEnemies.reduce((sum, item) => sum + item.quantity, 0);
  const draftPreparedCombatPartyCount = draftPreparedCombatPlayers.length + draftPreparedCombatAllyCount;
  const draftEnemyExperienceTotal = draftPreparedCombatEnemies.reduce(
    (sum, item) => sum + parseChallengeXp(item.entity.statBlock?.challenge ?? "") * item.quantity,
    0
  );
  const canStartPreparedCombatDraft =
    draftPreparedCombatPlayers.length > 0 && campaignPreparedCombatDraftEnemyCount > 0;

  useEffect(() => {
    setPreparedCombatPlayerInitiatives((current) => buildInitiativeMap(current, draftPreparedCombatPlayers));
  }, [draftPreparedCombatPlayers]);

  useEffect(() => {
    setPreparedCombatEnemyInitiatives((current) =>
      buildInitiativeMap(
        current,
        draftPreparedCombatEnemies.map((item) => item.entity)
      )
    );
  }, [draftPreparedCombatEnemies]);

  useEffect(() => {
    setPreparedCombatAllyInitiatives((current) =>
      buildInitiativeMap(
        current,
        draftPreparedCombatAllies.map((item) => item.entity)
      )
    );
  }, [draftPreparedCombatAllies]);

  const updateCampaignPreparedCombatDraft = (
    updater: (current: CombatDraftControllerState["campaignPreparedCombatDraft"]) => CombatDraftControllerState["campaignPreparedCombatDraft"]
  ) => {
    setCampaignPreparedCombatNoticeState("");
    setCampaignPreparedCombatDraftState((current) => updater(current));
  };

  const replaceCampaignPreparedCombatDraft = (draft?: typeof campaignPreparedCombatDraft | null) => {
    setCampaignPreparedCombatNoticeState("");
    setCampaignPreparedCombatDraftState(cloneCampaignPreparedCombat(draft));
  };

  const setCampaignPreparedCombatNotice = (value: string) => {
    setCampaignPreparedCombatNoticeState(value);
  };

  const toggleCampaignPreparedCombatPlayer = (playerId: string) => {
    updateCampaignPreparedCombatDraft((current) => {
      const selected = current.playerIds.includes(playerId);
      return {
        ...current,
        playerIds: selected ? current.playerIds.filter((id) => id !== playerId) : [...current.playerIds, playerId]
      };
    });
  };

  const toggleCampaignPreparedCombatAlly = (entityId: string) => {
    updateCampaignPreparedCombatDraft((current) => {
      const selected = (current.allies ?? []).some((item) => item.entityId === entityId);
      const nextAllies = selected
        ? (current.allies ?? []).filter((item) => item.entityId !== entityId)
        : [...(current.allies ?? []), { entityId, quantity: 1 }];
      return {
        ...current,
        allies: nextAllies,
        items: selected ? current.items : current.items.filter((item) => item.entityId !== entityId)
      };
    });
  };

  const addCampaignPreparedCombatDraftItem = async (pickedItem?: typeof selectedCombatSearchItem) => {
    if (!activeCampaignId) {
      return;
    }

    const selected = pickedItem ?? selectedCombatSearchItem;
    if (!selected) {
      setBootError("Сначала выбери противника, которого нужно добавить в заготовленный бой.");
      return;
    }

    try {
      setSaving(true);
      setBootError("");
      let entityId = selected.id;

      if (selected.source === "bestiary") {
        const imported = await api.importBestiaryMonster(activeCampaignId, selected.id);
        if (!imported.entity?.id) {
          throw new Error("Backend не вернул импортированного монстра из dnd.su.");
        }
        hydrateCampaign(imported.campaign);
        entityId = imported.entity.id;
        setPreviewEntityId(imported.entity.id);
      }

      onSelectCombatEntity(entityId);

      updateCampaignPreparedCombatDraft((current) => {
        const existingIndex = current.items.findIndex((item) => item.entityId === entityId);
        if (existingIndex >= 0) {
          return {
            ...current,
            allies: (current.allies ?? []).filter((item) => item.entityId !== entityId),
            items: current.items.map((item, index) =>
              index === existingIndex
                ? { ...item, quantity: item.quantity + normalizeCombatQuantity(combatSelectionQuantity) }
                : item
            )
          };
        }

        return {
          ...current,
          title: current.title?.trim() ? current.title : campaignTitle ? `${campaignTitle}: бой` : current.title,
          allies: (current.allies ?? []).filter((item) => item.entityId !== entityId),
          items: [
            ...current.items,
            {
              entityId,
              quantity: normalizeCombatQuantity(combatSelectionQuantity)
            }
          ]
        };
      });
    } catch (error) {
      setBootError(error instanceof Error ? error.message : "Не удалось добавить противника в заготовленный бой.");
    } finally {
      setSaving(false);
    }
  };

  const updateCampaignPreparedCombatDraftItem = (entityId: string, patch: { quantity?: number; initiative?: number }) => {
    updateCampaignPreparedCombatDraft((current) => ({
      ...current,
      items: current.items.map((item) =>
        item.entityId === entityId
          ? {
              ...item,
              ...patch,
              quantity:
                patch.quantity !== undefined ? normalizeCombatQuantity(patch.quantity) : item.quantity
            }
          : item
      )
    }));
  };

  const removeCampaignPreparedCombatDraftItem = (entityId: string) => {
    updateCampaignPreparedCombatDraft((current) => ({
      ...current,
      items: current.items.filter((item) => item.entityId !== entityId)
    }));
  };

  const removeCampaignPreparedCombatDraftAlly = (entityId: string) => {
    updateCampaignPreparedCombatDraft((current) => ({
      ...current,
      allies: (current.allies ?? []).filter((item) => item.entityId !== entityId)
    }));
  };

  const setPreparedCombatPlayerInitiative = (playerId: string, value: number) => {
    setPreparedCombatPlayerInitiatives((current) => ({
      ...current,
      [playerId]: Number.isFinite(value) ? value : 0
    }));
  };

  const setPreparedCombatAllyInitiative = (entityId: string, value: number) => {
    setPreparedCombatAllyInitiatives((current) => ({
      ...current,
      [entityId]: Number.isFinite(value) ? value : 0
    }));
  };

  const setPreparedCombatEnemyInitiative = (entityId: string, value: number) => {
    setPreparedCombatEnemyInitiatives((current) => ({
      ...current,
      [entityId]: Number.isFinite(value) ? value : 0
    }));
  };

  const clearPreparedCombatDraft = (options?: { fallbackTitle?: string; onAfterClear?: () => void }) => {
    if (!window.confirm("Очистить текущую сцену боя: игроков, противников, инициативу и общий уровень партии?")) {
      return;
    }

    setBootError("");
    setCampaignPreparedCombatNoticeState("");
    setPreparedCombatPlayerInitiatives({});
    setPreparedCombatAllyInitiatives({});
    setPreparedCombatEnemyInitiatives({});
    options?.onAfterClear?.();

    setCampaignPreparedCombatDraftState((current) => ({
      ...current,
      title: current.title?.trim() ? current.title : options?.fallbackTitle ?? current.title,
      partyLevel: undefined,
      playerIds: [],
      allies: [],
      items: []
    }));
  };

  return {
    addCampaignPreparedCombatDraftItem,
    campaignPreparedCombatDraft,
    campaignPreparedCombatDraftEnemyCount,
    campaignPreparedCombatNotice,
    canStartPreparedCombatDraft,
    clearPreparedCombatDraft,
    draftEnemyExperienceTotal,
    draftPreparedCombatAllyCount,
    draftPreparedCombatAllyIds,
    draftPreparedCombatAllies,
    draftPreparedCombatEnemies,
    draftPreparedCombatPartyCount,
    draftPreparedCombatPlayerLevels,
    draftPreparedCombatPlayers,
    preparedCombatAllyInitiatives,
    preparedCombatEnemyInitiatives,
    preparedCombatPlayerInitiatives,
    removeCampaignPreparedCombatDraftAlly,
    removeCampaignPreparedCombatDraftItem,
    replaceCampaignPreparedCombatDraft,
    setCampaignPreparedCombatNotice,
    setPreparedCombatAllyInitiative,
    setPreparedCombatEnemyInitiative,
    setPreparedCombatPlayerInitiative,
    toggleCampaignPreparedCombatAlly,
    toggleCampaignPreparedCombatPlayer,
    updateCampaignPreparedCombatDraftItem
  };
}

import { useMemo, useState } from "react";
import { api } from "../../app/api";
import type { QuestEntity } from "@shadow-edge/shared-types";
import type { PreparedCombatHostEntity } from "../combat/combat.types";
import {
  cloneCampaignPreparedCombat,
  clonePreparedCombatPlan,
  countPreparedCombatItems,
  createEmptyCampaignPreparedCombat,
  defaultPreparedCombatTitle,
  formatAllyCountLabel,
  formatEnemyCountLabel,
  formatPartyCountLabel,
  isPreparedCombatHostEntity,
  resolveEntityPreparedCombats,
  sanitizeCampaignPreparedCombat,
  sanitizePartyLevel,
  sanitizePreparedCombatPlan
} from "../combat/combat.utils";
import type {
  PreparedCombatController,
  PreparedCombatCardView,
  UsePreparedCombatControllerArgs
} from "./preparedCombat.types";
import {
  createPreparedCombatDraft,
  createQuestPreparedCombatDraft,
  resolvePreparedCombatEnemies,
  resolvePreparedCombatPlayers
} from "./preparedCombat.utils";

const createPreparedCombatStartTitle = (title: string, fallback: string) => title.trim() || fallback;

export function usePreparedCombatController({
  activeCampaignId,
  activeCombat,
  campaign,
  campaignPreparedCombat,
  campaignPreparedCombatDraft,
  combatCustomAdjustedXp,
  combatDifficulty,
  combatMonsterCount,
  combatPrompt,
  combatSetupOpen,
  combatTitle,
  effectiveCombatThresholds,
  effectivePartyLevels,
  effectivePartySize,
  entityCombatSetupState,
  entityCombatSetupTarget,
  entityMap,
  hasExplicitPartyLevels,
  hydrateCampaign,
  onApplyCombatPayload,
  onCloseCombatSetupModal,
  onEntityToForm,
  onHandleProtectedActionError,
  onRememberCombatReturnTarget,
  onOpenCombatScreen,
  onOpenEntityPreparedCombatSetup,
  onOpenQuestFocus,
  onPeekEntity,
  onRequestModalClose,
  onResetCombatPartyLevelsText,
  onSerializeEntityForm,
  persistedCombatPartyLevel,
  preparedCombatModalOpen,
  preparedCombatAllyInitiatives,
  preparedCombatEnemyInitiatives,
  preparedCombatPlayerInitiatives,
  preparedCombatQuantity,
  replaceCampaignPreparedCombatDraft,
  resetPreparedCombatEnemySearch,
  selectPreparedCombatEntity,
  selectedPreparedCombatSearchItem,
  setBootError,
  setCampaignPreparedCombatNotice,
  setEntityCombatSetupState,
  setGenerating,
  setPreparedCombatModalOpen,
  setPreviewEntityId,
  setSaving
}: UsePreparedCombatControllerArgs): PreparedCombatController {
  const [preparedCombatQuestId, setPreparedCombatQuestId] = useState("");
  const [preparedCombatDraft, setPreparedCombatDraft] = useState(createPreparedCombatDraft);
  const [preparedCombatNotice, setPreparedCombatNotice] = useState("");

  const preparedCombatQuest = useMemo(() => {
    if (!preparedCombatModalOpen || !preparedCombatQuestId) {
      return null;
    }
    const entity = entityMap.get(preparedCombatQuestId);
    return entity?.kind === "quest" ? entity : null;
  }, [entityMap, preparedCombatModalOpen, preparedCombatQuestId]);

  const closePreparedCombatModal = () => {
    setPreparedCombatModalOpen(false);
    setPreparedCombatQuestId("");
    setPreparedCombatDraft(createPreparedCombatDraft());
    setPreparedCombatNotice("");
    resetPreparedCombatEnemySearch();
  };

  const openPreparedCombatModal = (quest: { id: string; title: string; preparedCombat?: typeof preparedCombatDraft }) => {
    setPreparedCombatQuestId(quest.id);
    setPreparedCombatDraft(clonePreparedCombatPlan(quest.preparedCombat) ?? createQuestPreparedCombatDraft(quest.title));
    setPreparedCombatNotice("");
    setBootError("");
    resetPreparedCombatEnemySearch();
    setPreparedCombatModalOpen(true);
  };

  const updatePreparedCombatDraft = (updater: (current: typeof preparedCombatDraft) => typeof preparedCombatDraft) => {
    setPreparedCombatNotice("");
    setPreparedCombatDraft((current) => updater(current));
  };

  const updatePreparedCombatTitle = (value: string) => {
    updatePreparedCombatDraft((current) => ({
      ...current,
      title: value
    }));
  };

  const addPreparedCombatDraftItem = async () => {
    if (!activeCampaignId) {
      return;
    }

    const selected = selectedPreparedCombatSearchItem;
    if (!selected) {
      setBootError("Сначала выбери НПС или монстра, которого нужно добавить в заготовленный бой.");
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
        selectPreparedCombatEntity(entityId);
        onPeekEntity(imported.entity.id);
      }

      updatePreparedCombatDraft((current) => {
        const existingIndex = current.items.findIndex((item) => item.entityId === entityId);
        if (existingIndex >= 0) {
          return {
            ...current,
            items: current.items.map((item, index) =>
              index === existingIndex ? { ...item, quantity: item.quantity + Math.max(1, preparedCombatQuantity) } : item
            )
          };
        }

        return {
          ...current,
          title: current.title?.trim() ? current.title : preparedCombatQuest?.title ? `${preparedCombatQuest.title}: бой` : current.title,
          items: [
            ...current.items,
            {
              entityId,
              quantity: Math.max(1, preparedCombatQuantity)
            }
          ]
        };
      });
    } catch (error) {
      setBootError(error instanceof Error ? error.message : "Не удалось добавить существо в заготовленный бой.");
    } finally {
      setSaving(false);
    }
  };

  const updatePreparedCombatDraftItem = (entityId: string, patch: Partial<typeof preparedCombatDraft.items[number]>) => {
    updatePreparedCombatDraft((current) => ({
      ...current,
      items: current.items.map((item) =>
        item.entityId === entityId
          ? {
              ...item,
              ...patch,
              quantity: Math.max(1, Number.isFinite(patch.quantity) ? Math.floor(patch.quantity as number) : item.quantity)
            }
          : item
      )
    }));
  };

  const removePreparedCombatDraftItem = (entityId: string) => {
    updatePreparedCombatDraft((current) => ({
      ...current,
      items: current.items.filter((item) => item.entityId !== entityId)
    }));
  };

  const savePreparedCombatDraft = async () => {
    if (!activeCampaignId || !preparedCombatQuestId) {
      return;
    }

    try {
      setSaving(true);
      setBootError("");
      const questForSave =
        (entityMap.get(preparedCombatQuestId) ?? campaign?.quests.find((item) => item.id === preparedCombatQuestId) ?? null);
      if (!questForSave || questForSave.kind !== "quest") {
        throw new Error("Квест для сохранения заготовленного боя не найден. Попробуй заново открыть настройку боя.");
      }
      const normalizedDraft = sanitizePreparedCombatPlan(preparedCombatDraft);
      const payload = onSerializeEntityForm({
        ...onEntityToForm(questForSave),
        preparedCombat: normalizedDraft
      });
      const result = await api.updateEntity(activeCampaignId, questForSave.id, payload);
      hydrateCampaign(result.campaign, result.entity.id);
      setPreviewEntityId(result.entity.id);
      if (result.entity.kind === "quest") {
        setPreparedCombatDraft(clonePreparedCombatPlan(result.entity.preparedCombat) ?? createQuestPreparedCombatDraft(result.entity.title));
        const totalCreatures = (result.entity.preparedCombat?.items ?? []).reduce(
          (sum, item) => sum + Math.max(1, item.quantity),
          0
        );
        setPreparedCombatNotice(
          totalCreatures
            ? `Бой сохранён. В заготовке сейчас ${totalCreatures} ${totalCreatures === 1 ? "противник" : totalCreatures < 5 ? "противника" : "противников"}.`
            : "Бой сохранён."
        );
      } else {
        setPreparedCombatNotice("Бой сохранён.");
      }
    } catch (error) {
      setBootError(error instanceof Error ? error.message : "Не удалось сохранить заготовленный бой.");
    } finally {
      setSaving(false);
    }
  };

  const deletePreparedCombatCard = async (entity: PreparedCombatHostEntity, cardIndex: number) => {
    if (!activeCampaignId) {
      return;
    }

    try {
      setSaving(true);
      setBootError("");

      const nextForm = onEntityToForm(entity);
      const currentPlans = resolveEntityPreparedCombats(entity);
      nextForm.preparedCombats = currentPlans.filter((_, index) => index !== cardIndex);
      nextForm.preparedCombat = nextForm.preparedCombats[0];

      const result = await api.updateEntity(activeCampaignId, entity.id, onSerializeEntityForm(nextForm));
      hydrateCampaign(result.campaign, result.entity.id);
      setPreviewEntityId(result.entity.id);

      if (entityCombatSetupState?.entityId === entity.id) {
        onCloseCombatSetupModal();
      }
    } catch (error) {
      onHandleProtectedActionError(error, "Не удалось удалить карточку заготовленного боя.");
    } finally {
      setSaving(false);
    }
  };

  const requestPreparedCombatCardDeletion = (
    entity: PreparedCombatHostEntity,
    card: PreparedCombatCardView,
    cardIndex: number
  ) => {
    onRequestModalClose(
      `Удалить карточку боя «${card.title}»?`,
      () => {
        void deletePreparedCombatCard(entity, cardIndex);
      },
      "Карточка боя исчезнет из сущности сразу после подтверждения.",
      "Удалить"
    );
  };

  const startEntityPreparedCombat = async (
    entity: PreparedCombatHostEntity,
    plan: typeof preparedCombatDraft | undefined,
    planIndex: number
  ) => {
    if (!activeCampaignId) {
      return;
    }
    if (activeCombat?.entries.length) {
      setBootError("Сначала заверши текущий активный бой или вернись в него, чтобы не смешивать две сцены.");
      onOpenCombatScreen();
      return;
    }

    const players = resolvePreparedCombatPlayers(entityMap, plan);
    const enemies = resolvePreparedCombatEnemies(entityMap, plan);

    if (!players.length || !enemies.length) {
      setBootError("Для старта нужен хотя бы один игрок и хотя бы один противник. Открою подготовку боя, чтобы можно было быстро добрать состав.");
      onOpenEntityPreparedCombatSetup(entity, plan, planIndex, false);
      return;
    }

    try {
      setSaving(true);
      setBootError("");
      const result = await api.startCombat(activeCampaignId, {
        title: createPreparedCombatStartTitle(plan?.title?.trim() ?? "", `${entity.title}: бой`),
        partySize: effectivePartySize,
        thresholds: effectiveCombatThresholds,
        items: [
          ...players.map((player) => ({
            entityId: player.id,
            quantity: 1,
            initiative: 0
          })),
          ...enemies.map(({ entity: combatEntity, quantity }) => ({
            entityId: combatEntity.id,
            quantity,
            initiative: 0
          }))
        ]
      });
      const startedCombatId = result.combat?.id ?? result.campaign.activeCombat?.id ?? "";
      if (startedCombatId) {
        onRememberCombatReturnTarget(startedCombatId, entity.kind === "quest" ? entity.id : undefined);
      }
      onApplyCombatPayload(result);
      onOpenCombatScreen();
    } catch (error) {
      setBootError(error instanceof Error ? error.message : "Не удалось запустить заготовленный бой.");
    } finally {
      setSaving(false);
    }
  };

  const startPreparedQuestCombat = async (quest: QuestEntity) => {
    const plans = resolveEntityPreparedCombats(quest);
    await startEntityPreparedCombat(quest, plans[0], 0);
  };

  const handleQuestCombatAction = (quest: QuestEntity) => {
    if (activeCombat?.entries.length) {
      onOpenCombatScreen();
      return;
    }

    const plans = resolveEntityPreparedCombats(quest);
    if (plans.length > 1) {
      setBootError("У этого квеста несколько карточек боя. Открой квест и выбери нужную сцену прямо из списка карточек.");
      onOpenQuestFocus(quest.id);
      return;
    }

    if (plans[0]) {
      void startEntityPreparedCombat(quest, plans[0], 0);
      return;
    }

    onOpenEntityPreparedCombatSetup(quest, undefined, 0, true);
  };

  const saveCampaignPreparedCombatDraft = async () => {
    if (!activeCampaignId) {
      return;
    }

    try {
      setSaving(true);
      setBootError("");
      const normalizedAllies = (campaignPreparedCombatDraft.allies ?? []).filter((item) => {
        const entity = entityMap.get(item.entityId);
        return entity?.kind === "npc" || entity?.kind === "monster";
      });
      const allyIds = new Set(normalizedAllies.map((item) => item.entityId));
      const normalizedDraft = sanitizeCampaignPreparedCombat({
        ...campaignPreparedCombatDraft,
        partyLevel: persistedCombatPartyLevel,
        playerIds: campaignPreparedCombatDraft.playerIds.filter((playerId) => entityMap.get(playerId)?.kind === "player"),
        allies: normalizedAllies,
        items: campaignPreparedCombatDraft.items.filter((item) => {
          const entity = entityMap.get(item.entityId);
          return (entity?.kind === "npc" || entity?.kind === "monster") && !allyIds.has(item.entityId);
        })
      });
      const updated = await api.updateCampaign(activeCampaignId, {
        preparedCombat: normalizedDraft,
        updatePreparedCombat: true
      });
      hydrateCampaign(updated);
      const prepared = updated.preparedCombat;
      if (!prepared) {
        replaceCampaignPreparedCombatDraft(createEmptyCampaignPreparedCombat());
        onResetCombatPartyLevelsText();
        setCampaignPreparedCombatNotice("Заготовка боя очищена.");
        return;
      }

      const totalAllies = countPreparedCombatItems(prepared.allies ?? []);
      const totalEnemies = prepared.items.reduce((sum, item) => sum + Math.max(1, item.quantity), 0);
      replaceCampaignPreparedCombatDraft(cloneCampaignPreparedCombat(prepared));
      onResetCombatPartyLevelsText();
      setCampaignPreparedCombatNotice(
        `Состав сохранён: ${prepared.playerIds.length} ${formatPartyCountLabel(prepared.playerIds.length)}${
          totalAllies > 0 ? `, ${totalAllies} ${formatAllyCountLabel(totalAllies)}` : ""
        } и ${totalEnemies} ${formatEnemyCountLabel(totalEnemies)}.`
      );
    } catch (error) {
      setBootError(error instanceof Error ? error.message : "Не удалось сохранить заготовленный бой.");
    } finally {
      setSaving(false);
    }
  };

  const saveEntityPreparedCombatDraft = async () => {
    if (!activeCampaignId || !entityCombatSetupState || !entityCombatSetupTarget || !isPreparedCombatHostEntity(entityCombatSetupTarget)) {
      return;
    }

    const normalizedAllies = (campaignPreparedCombatDraft.allies ?? []).filter((item) => {
      const entity = entityMap.get(item.entityId);
      return entity?.kind === "npc" || entity?.kind === "monster";
    });
    const allyIds = new Set(normalizedAllies.map((item) => item.entityId));
    const nextPlan = sanitizePreparedCombatPlan({
      title: campaignPreparedCombatDraft.title,
      partyLevel: persistedCombatPartyLevel,
      playerIds: campaignPreparedCombatDraft.playerIds.filter((playerId) => entityMap.get(playerId)?.kind === "player"),
      allies: normalizedAllies,
      items: campaignPreparedCombatDraft.items.filter((item) => {
        const entity = entityMap.get(item.entityId);
        return (entity?.kind === "npc" || entity?.kind === "monster") && !allyIds.has(item.entityId);
      })
    });
    if (!nextPlan) {
      setBootError("Добавь в карточку хотя бы название, игроков, союзников или противников, а потом сохраняй её.");
      return;
    }

    try {
      setSaving(true);
      setBootError("");
      const existingPlans = resolveEntityPreparedCombats(entityCombatSetupTarget);
      const nextPlans = [...existingPlans];
      const normalizedPlan = {
        ...nextPlan,
        title: nextPlan.title || defaultPreparedCombatTitle(entityCombatSetupState.planIndex)
      };

      if (entityCombatSetupState.planIndex >= nextPlans.length) {
        nextPlans.push(normalizedPlan);
      } else {
        nextPlans[entityCombatSetupState.planIndex] = normalizedPlan;
      }

      const nextForm = onEntityToForm(entityCombatSetupTarget);
      nextForm.preparedCombats = nextPlans;
      nextForm.preparedCombat = nextPlans[0];

      const result = await api.updateEntity(activeCampaignId, entityCombatSetupTarget.id, onSerializeEntityForm(nextForm));
      hydrateCampaign(result.campaign, result.entity.id);
      setPreviewEntityId(result.entity.id);

      const updatedEntity = result.entity;
      const updatedPlans =
        isPreparedCombatHostEntity(updatedEntity) ? resolveEntityPreparedCombats(updatedEntity) : [];
      const resolvedIndex = Math.min(entityCombatSetupState.planIndex, Math.max(updatedPlans.length - 1, 0));
      const savedPlan = updatedPlans[resolvedIndex];

      if (!savedPlan) {
        onCloseCombatSetupModal();
        return;
      }

      setEntityCombatSetupState({
        entityId: updatedEntity.id,
        planIndex: resolvedIndex,
        isNew: false
      });
      replaceCampaignPreparedCombatDraft({
        title: savedPlan.title,
        partyLevel: sanitizePartyLevel(savedPlan.partyLevel),
        playerIds: [...(savedPlan.playerIds ?? [])],
        allies: (savedPlan.allies ?? []).map((item) => ({ ...item })),
        items: savedPlan.items.map((item) => ({ ...item }))
      });
      onResetCombatPartyLevelsText();

      const playerCount = savedPlan.playerIds?.length ?? 0;
      const allyCount = countPreparedCombatItems(savedPlan.allies ?? []);
      const enemyCount = savedPlan.items.reduce((sum, item) => sum + Math.max(1, item.quantity), 0);
      setCampaignPreparedCombatNotice(
        `Карточка боя сохранена: ${playerCount} ${formatPartyCountLabel(playerCount)}${
          allyCount > 0 ? `, ${allyCount} ${formatAllyCountLabel(allyCount)}` : ""
        } и ${enemyCount} ${formatEnemyCountLabel(enemyCount)}.`
      );
    } catch (error) {
      setBootError(error instanceof Error ? error.message : "Не удалось сохранить карточку боя.");
    } finally {
      setSaving(false);
    }
  };

  const startConfiguredCombat = async () => {
    if (!activeCampaignId) {
      return;
    }

    const planSource =
      combatSetupOpen && !(activeCombat?.entries.length)
        ? {
            ...campaignPreparedCombatDraft,
            partyLevel: persistedCombatPartyLevel
          }
        : campaignPreparedCombat;
    const normalizedAllies = (planSource?.allies ?? []).filter((item) => {
      const entity = entityMap.get(item.entityId);
      return entity?.kind === "npc" || entity?.kind === "monster";
    });
    const allyIds = new Set(normalizedAllies.map((item) => item.entityId));
    const plan = sanitizeCampaignPreparedCombat(
      planSource
        ? {
            ...planSource,
            playerIds: (planSource.playerIds ?? []).filter((playerId) => entityMap.get(playerId)?.kind === "player"),
            allies: normalizedAllies,
            items: (planSource.items ?? []).filter((item) => {
              const entity = entityMap.get(item.entityId);
              return (entity?.kind === "npc" || entity?.kind === "monster") && !allyIds.has(item.entityId);
            })
          }
        : null
    );
    if (!plan) {
      setBootError("Сначала настрой состав боя, а потом уже запускай сцену.");
      return;
    }
    if (!plan.playerIds.length) {
      setBootError("Сначала добавь хотя бы одного игрока в заготовленный бой.");
      return;
    }
    if (!plan.items.length) {
      setBootError("Сначала добавь хотя бы одного противника в заготовленный бой.");
      return;
    }

    const startItems = [
      ...plan.playerIds
        .map((playerId) => {
          const entity = entityMap.get(playerId);
          if (entity?.kind !== "player") {
            return null;
          }
          return {
            entityId: entity.id,
            quantity: 1,
            initiative: preparedCombatPlayerInitiatives[entity.id] ?? 0,
            side: "player" as const
          };
        })
        .filter((item): item is { entityId: string; quantity: number; initiative: number; side: "player" } => Boolean(item)),
      ...(plan.allies ?? [])
        .map((item) => {
          const entity = entityMap.get(item.entityId);
          if (entity?.kind !== "npc" && entity?.kind !== "monster") {
            return null;
          }
          return {
            entityId: entity.id,
            quantity: Math.max(1, item.quantity),
            initiative: preparedCombatAllyInitiatives[entity.id] ?? 0,
            side: "player" as const
          };
        })
        .filter((item): item is { entityId: string; quantity: number; initiative: number; side: "player" } => Boolean(item)),
      ...plan.items
        .map((item) => {
          const entity = entityMap.get(item.entityId);
          if (entity?.kind !== "npc" && entity?.kind !== "monster") {
            return null;
          }
          return {
            entityId: entity.id,
            quantity: Math.max(1, item.quantity),
            initiative: preparedCombatEnemyInitiatives[entity.id] ?? 0,
            side: "enemy" as const
          };
        })
        .filter((item): item is { entityId: string; quantity: number; initiative: number; side: "enemy" } => Boolean(item))
    ];

    if (!startItems.length) {
      setBootError("Не удалось собрать участников боя из текущей подготовки.");
      return;
    }

    try {
      setSaving(true);
      setBootError("");
      const result = await api.startCombat(activeCampaignId, {
        title: plan.title?.trim() || combatTitle.trim() || "Активный бой",
        partySize: effectivePartySize,
        thresholds: effectiveCombatThresholds,
        items: startItems
      });
      const startedCombatId = result.combat?.id ?? result.campaign.activeCombat?.id ?? "";
      if (startedCombatId) {
        onRememberCombatReturnTarget(
          startedCombatId,
          entityCombatSetupTarget?.kind === "quest" && isPreparedCombatHostEntity(entityCombatSetupTarget)
            ? entityCombatSetupTarget.id
            : undefined
        );
      }
      onApplyCombatPayload(result);
      onCloseCombatSetupModal();
      onOpenCombatScreen();
    } catch (error) {
      setBootError(error instanceof Error ? error.message : "Не удалось запустить подготовленный бой.");
    } finally {
      setSaving(false);
    }
  };

  const generateCombatEncounter = async () => {
    if (!activeCampaignId) {
      return;
    }
    if (!hasExplicitPartyLevels) {
      setBootError("Укажи общий уровень партии, чтобы генерация попала в нужную сложность.");
      return;
    }

    try {
      setGenerating(true);
      const result = await api.generateCombat(activeCampaignId, {
        title: combatTitle.trim() || "Активный бой",
        prompt: combatPrompt.trim(),
        monsterCount: combatMonsterCount,
        difficulty: combatDifficulty,
        partySize: effectivePartySize,
        partyLevels: effectivePartyLevels,
        thresholds: effectiveCombatThresholds,
        customAdjustedXp: combatDifficulty === "custom" ? Math.max(0, combatCustomAdjustedXp) : undefined
      });
      const startedCombatId = result.combat?.id ?? result.campaign.activeCombat?.id ?? "";
      if (startedCombatId) {
        onRememberCombatReturnTarget(
          startedCombatId,
          entityCombatSetupTarget?.kind === "quest" && isPreparedCombatHostEntity(entityCombatSetupTarget)
            ? entityCombatSetupTarget.id
            : undefined
        );
      }
      onApplyCombatPayload(result);
      onCloseCombatSetupModal();
      const firstCreated = result.createdEntities[0]?.id;
      if (firstCreated) {
        setPreviewEntityId(firstCreated);
      }
    } catch (error) {
      setBootError(error instanceof Error ? error.message : "Не удалось сгенерировать бой.");
    } finally {
      setGenerating(false);
    }
  };

  return {
    preparedCombatDraft,
    preparedCombatModalOpen,
    preparedCombatNotice,
    preparedCombatQuest,
    preparedCombatQuestId,
    addPreparedCombatDraftItem,
    closePreparedCombatModal,
    deletePreparedCombatCard,
    generateCombatEncounter,
    handleQuestCombatAction,
    openPreparedCombatModal,
    removePreparedCombatDraftItem,
    requestPreparedCombatCardDeletion,
    saveCampaignPreparedCombatDraft,
    saveEntityPreparedCombatDraft,
    savePreparedCombatDraft,
    startConfiguredCombat,
    startEntityPreparedCombat,
    startPreparedQuestCombat,
    updatePreparedCombatDraftItem,
    updatePreparedCombatTitle
  };
}

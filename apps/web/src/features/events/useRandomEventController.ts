import type {
  AIProposal,
  CampaignData,
  KnowledgeEntity
} from "@shadow-edge/shared-types";
import { useState } from "react";
import { api } from "../../app/api";

type UseRandomEventControllerArgs = {
  activeCampaignId: string;
  activeEntity: KnowledgeEntity | null;
  campaign: CampaignData | null;
  setBootError: (value: string) => void;
  onProposalCreated: (proposal: AIProposal) => void;
};

const buildSceneBrief = (locationLabel: string, extraPrompt: string) =>
  [
    "Сгенерируй одну подробную сцену для зачитки игрокам в D&D.",
    locationLabel
      ? `Партия находится здесь или рядом: "${locationLabel}".`
      : "Существующая локация не выбрана, поэтому ориентируйся на описание мастера.",
    extraPrompt.trim()
      ? `Описание мастера: ${extraPrompt.trim()}`
      : "Описание мастера: придумай самостоятельную дорожную или городскую сцену, которую легко продолжить.",
    "Текст должен звучать как готовая зачитка: что заметили персонажи, кого встретили, что прямо сейчас происходит, почему сцена цепляет, какие детали поведения и маленькая история видны игрокам.",
    "Не пиши скрытые заметки мастера, статы, СЛ проверок или полноценный квест. Мастер сам продолжит сцену после зачитки."
  ].join("\n");

const buildEntityScenePrompt = (entity: KnowledgeEntity, locationLabel: string, extraPrompt: string) =>
  [
    buildSceneBrief(locationLabel, extraPrompt),
    `Обнови существующую запись «${entity.title}» (${entity.kind}).`,
    "Сохрани все существующие поля, изображения, связи, подготовленные бои и карточки игроков.",
    "Добавь ровно одну новую карточку в конец массива playerCards: короткое выразительное название и полный текст зачитки в content.",
    "Не удаляй и не переписывай существующие playerCards. Не меняй остальные поля без необходимости."
  ].join("\n");

const buildWorldEventPrompt = (locationLabel: string, extraPrompt: string) =>
  [
    buildSceneBrief(locationLabel, extraPrompt),
    "Создай событие кампании с коротким названием, ёмким summary и полным текстом зачитки в sceneText.",
    "Используй тип social и теги read-aloud и scene, если описание мастера не требует другого.",
    "Оставь dialogueBranches и loot пустыми массивами, если мастер явно не попросил их добавить."
  ].join("\n");

export function useRandomEventController({
  activeCampaignId,
  activeEntity,
  campaign,
  setBootError,
  onProposalCreated
}: UseRandomEventControllerArgs) {
  const [randomEventModalOpen, setRandomEventModalOpen] = useState(false);
  const [randomEventDestinationId, setRandomEventDestinationId] = useState("");
  const [randomEventPrompt, setRandomEventPrompt] = useState("");
  const [randomEventNotes, setRandomEventNotes] = useState<string[]>([]);
  const [randomEventGenerating, setRandomEventGenerating] = useState(false);

  const openRandomEventModal = (suggestions?: { locationId?: string; destinationId?: string }) => {
    const suggestedDestinationId =
      suggestions?.destinationId ??
      suggestions?.locationId ??
      (activeEntity?.kind === "location" || activeEntity?.kind === "quest"
        ? activeEntity.id
        : activeEntity?.kind === "npc" || activeEntity?.kind === "monster"
          ? activeEntity.locationId ?? ""
          : "") ??
      "";

    setRandomEventDestinationId(suggestedDestinationId);
    setRandomEventPrompt("");
    setRandomEventNotes([]);
    setRandomEventModalOpen(true);
  };

  const closeRandomEventModal = () => {
    setRandomEventModalOpen(false);
    setRandomEventNotes([]);
    setRandomEventPrompt("");
    setRandomEventDestinationId("");
    setRandomEventGenerating(false);
  };

  const generateRandomEvent = async () => {
    if (!activeCampaignId) {
      return;
    }

    try {
      setRandomEventGenerating(true);
      setBootError("");

      const selectedDestination =
        campaign && randomEventDestinationId
          ? [...campaign.quests, ...campaign.locations].find((entity) => entity.id === randomEventDestinationId) ?? null
          : null;
      const selectedLocation =
        selectedDestination?.kind === "location"
          ? selectedDestination
          : selectedDestination?.kind === "quest" && selectedDestination.locationId
            ? campaign?.locations.find((location) => location.id === selectedDestination.locationId) ?? null
            : null;
      const selectedLocationLabel = selectedLocation?.title ?? "";
      const proposal = selectedDestination?.kind === "location" || selectedDestination?.kind === "quest"
        ? await api.proposeEntity(activeCampaignId, {
            mode: "update",
            kind: selectedDestination.kind,
            entityId: selectedDestination.id,
            prompt: buildEntityScenePrompt(selectedDestination, selectedLocationLabel, randomEventPrompt),
            source: { type: "website_ai" }
          })
        : await api.proposeWorldEvent(activeCampaignId, {
            mode: "create",
            prompt: buildWorldEventPrompt(selectedLocationLabel, randomEventPrompt),
            source: { type: "website_ai" }
          });

      closeRandomEventModal();
      onProposalCreated(proposal);
    } catch (error) {
      setBootError(error instanceof Error ? error.message : "Не удалось подготовить сцену для проверки.");
    } finally {
      setRandomEventGenerating(false);
    }
  };

  return {
    closeRandomEventModal,
    generateRandomEvent,
    openRandomEventModal,
    randomEventGenerating,
    randomEventDestinationId,
    randomEventModalOpen,
    randomEventNotes,
    randomEventPrompt,
    setRandomEventDestinationId,
    setRandomEventPrompt
  };
}

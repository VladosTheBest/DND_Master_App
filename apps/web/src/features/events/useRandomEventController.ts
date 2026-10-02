import type {
  AIProposal,
  CampaignData,
  WorldEventType,
  KnowledgeEntity
} from "@shadow-edge/shared-types";
import { useRef, useState } from "react";
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

const buildGMEventPrompt = (locationLabel: string, extraPrompt: string, type: WorldEventType) => [
  "Придумай одно короткое случайное событие для мастера D&D, не полноценный квест и не длинную зачитку.",
  `Тип события: ${type}. Место действия: ${locationLabel || "подходящее место в кампании"}.`,
  `Описание мастера: ${extraPrompt.trim() || "Придумай неожиданную ситуацию самостоятельно."}`,
  "В sceneText дай краткий экскурс (150–250 слов): Что происходит; Скрытая причина и мотивы; Что заметят игроки; Проверки и подсказки (1–2 проверки с СЛ и результатами, только если уместны); Если пройти мимо.",
  "В dialogueBranches дай 2–3 возможных действия игроков: title — действие, lines — как провести, outcome — последствие. Не предрешай выбор игроков.",
  "В loot дай 2–3 возможные находки или награды с условиями получения: информация, союзник, услуга или умеренная добыча. Это возможности, а не уже выданные награды.",
  "Учитывай канон, выбранную локацию, доступных NPC и тон кампании. Не выдумывай существующие ID. Теги: gm-event, random-event."
].join("\n");

const buildWorldEventPrompt = (locationLabel: string, extraPrompt: string, type: WorldEventType) =>
  [
    buildSceneBrief(locationLabel, extraPrompt),
    "Создай событие кампании с коротким названием, ёмким summary и полным текстом зачитки в sceneText.",
    `Используй тип ${type} и теги read-aloud и scene, если описание мастера не требует другого.`,
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
  const [randomEventLocationId, setRandomEventLocationId] = useState("");
  const [randomEventType, setRandomEventType] = useState<WorldEventType>("social");
  const [randomEventMode, setRandomEventMode] = useState<"read_aloud" | "gm_event">("read_aloud");
  const running = useRef(false);
  const modalVisible = useRef(false);

  const openRandomEventModal = (suggestions?: { locationId?: string; destinationId?: string; type?: WorldEventType; newEvent?: boolean; generationMode?: "read_aloud" | "gm_event" }) => {
    if (running.current) { modalVisible.current = true; setRandomEventModalOpen(true); return; }
    const suggestedDestinationId =
      suggestions?.destinationId ??
      suggestions?.locationId ??
      (activeEntity?.kind === "location" || activeEntity?.kind === "quest"
        ? activeEntity.id
        : activeEntity?.kind === "npc" || activeEntity?.kind === "monster"
          ? activeEntity.locationId ?? ""
          : "") ??
      "";

    setRandomEventMode(suggestions?.generationMode || "read_aloud");
    setRandomEventDestinationId(suggestions?.newEvent || suggestions?.generationMode === "gm_event" ? "" : suggestedDestinationId);
    setRandomEventLocationId(suggestions?.locationId || "");
    setRandomEventType(suggestions?.type || "social");
    modalVisible.current = true;
    setRandomEventPrompt("");
    setRandomEventNotes([]);
    setRandomEventModalOpen(true);
  };

  const closeRandomEventModal = () => {
    modalVisible.current = false;
    setRandomEventModalOpen(false);
    setRandomEventNotes([]);
  };

  const generateRandomEvent = async () => {
    if (!activeCampaignId || running.current) {
      return;
    }

    try {
      running.current = true;
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
            : campaign?.locations.find((location) => location.id === randomEventLocationId) ?? null;
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
            prompt: randomEventMode === "gm_event" ? buildGMEventPrompt(selectedLocationLabel, randomEventPrompt, randomEventType) : buildWorldEventPrompt(selectedLocationLabel, randomEventPrompt, randomEventType),
            generationMode: randomEventMode,
            locationId: selectedLocation?.id,
            type: randomEventType,
            source: { type: "website_ai" }
          });

      if (modalVisible.current) { closeRandomEventModal(); onProposalCreated(proposal); }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Не удалось подготовить сцену для проверки.";
      setRandomEventNotes([message]);
      if (!modalVisible.current) setBootError(message);
    } finally {
      running.current = false;
      setRandomEventGenerating(false);
    }
  };

  return {
    closeRandomEventModal,
    generateRandomEvent,
    openRandomEventModal,
    randomEventGenerating,
    randomEventDestinationId,
    randomEventLocationId,
    randomEventType,
    randomEventMode,
    setRandomEventLocationId,
    setRandomEventType,
    randomEventModalOpen,
    randomEventNotes,
    randomEventPrompt,
    setRandomEventDestinationId,
    setRandomEventPrompt
  };
}

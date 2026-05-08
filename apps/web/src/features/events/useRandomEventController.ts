import type {
  CampaignData,
  CreateEntityInput,
  KnowledgeEntity,
  ModuleId,
  PlayerFacingCard
} from "@shadow-edge/shared-types";
import { useState } from "react";
import { api } from "../../app/api";
import { sanitizeSinglePlayerFacingCard } from "../player-facing/usePlayerFacingCards";

type UseRandomEventControllerArgs = {
  activeCampaignId: string;
  activeEntity: KnowledgeEntity | null;
  campaign: CampaignData | null;
  entityToForm: (entity: KnowledgeEntity) => CreateEntityInput;
  serializeEntityForm: (input: CreateEntityInput) => CreateEntityInput;
  setActiveEntityId: (value: string) => void;
  setActiveModule: (value: ModuleId) => void;
  setActiveRailAlias: (value: null) => void;
  setActiveTab: (value: string) => void;
  setBootError: (value: string) => void;
  setPreviewEntityId: (value: string) => void;
  setSelectedWorldEventId: (value: string) => void;
  onHydrateCampaign: (campaign: CampaignData, preferredEntityId?: string) => void;
};

const truncateText = (value: string, maxLength: number) => {
  const trimmed = value.trim();
  if (trimmed.length <= maxLength) {
    return trimmed;
  }
  return `${trimmed.slice(0, maxLength).trimEnd()}...`;
};

const buildRandomEventPrompt = (locationLabel: string, extraPrompt: string) =>
  [
    "Сгенерируй одну подробную сцену для зачитки игрокам в D&D.",
    locationLabel
      ? `Партия находится здесь или рядом: "${locationLabel}".`
      : "Существующая локация не выбрана, поэтому ориентируйся на описание мастера.",
    extraPrompt.trim()
      ? `Описание мастера: ${extraPrompt.trim()}`
      : "Описание мастера: придумай самостоятельную дорожную или городскую сцену, которую легко продолжить.",
    "Нужно придумать короткое название события и большой player-facing текст для поля sceneText.",
    "sceneText должен звучать как готовая зачитка: что заметили персонажи, кого встретили, что прямо сейчас происходит, почему сцена цепляет, какие детали поведения и маленькая история видны игрокам.",
    "Не пиши скрытые заметки мастера, статы, СЛ проверок или полноценный квест. Мастер сам продолжит сцену после зачитки.",
    "Если схема требует dialogueBranches и loot, оставь их пустыми массивами, если мастер явно не просил обратного."
  ].join("\n");

const buildSceneCard = (draftTitle: string, draftSceneText: string, fallbackPrompt: string): PlayerFacingCard => {
  const content =
    draftSceneText.trim() ||
    fallbackPrompt.trim() ||
    "Партия натыкается на короткую, странную и достаточно живую сцену, которую мастер может сразу продолжить за столом.";

  return {
    title: truncateText(draftTitle, 80) || "Сцена для зачитки",
    content,
    contentHtml: ""
  };
};

const buildLoreScenePayload = (card: PlayerFacingCard, selectedLocationLabel: string): CreateEntityInput => ({
  kind: "lore",
  title: card.title,
  subtitle: selectedLocationLabel ? `Зачитка рядом с ${selectedLocationLabel}` : "Карточка сцены для зачитки",
  summary: truncateText(card.content, 180),
  content: card.content,
  playerContent: card.content,
  playerCards: [card],
  tags: ["scene", "read-aloud", "event"],
  quickFacts: [
    {
      label: "Формат",
      value: "Зачитка",
      tone: "accent"
    }
  ],
  related: [],
  category: "Rumor",
  visibility: "player_safe"
});

export function useRandomEventController({
  activeCampaignId,
  activeEntity,
  campaign,
  entityToForm,
  serializeEntityForm,
  setActiveEntityId,
  setActiveModule,
  setActiveRailAlias,
  setActiveTab,
  setBootError,
  setPreviewEntityId,
  setSelectedWorldEventId,
  onHydrateCampaign
}: UseRandomEventControllerArgs) {
  const [randomEventModalOpen, setRandomEventModalOpen] = useState(false);
  const [randomEventLocationId, setRandomEventLocationId] = useState("");
  const [randomEventPrompt, setRandomEventPrompt] = useState("");
  const [randomEventNotes, setRandomEventNotes] = useState<string[]>([]);
  const [randomEventGenerating, setRandomEventGenerating] = useState(false);

  const openRandomEventModal = (suggestions?: { locationId?: string }) => {
    const suggestedLocationId =
      suggestions?.locationId ??
      (activeEntity?.kind === "location"
        ? activeEntity.id
        : activeEntity?.kind === "npc" || activeEntity?.kind === "monster" || activeEntity?.kind === "quest"
          ? activeEntity.locationId ?? ""
          : "") ??
      "";

    setRandomEventLocationId(suggestedLocationId);
    setRandomEventPrompt("");
    setRandomEventNotes([]);
    setRandomEventModalOpen(true);
  };

  const closeRandomEventModal = () => {
    setRandomEventModalOpen(false);
    setRandomEventNotes([]);
    setRandomEventPrompt("");
    setRandomEventLocationId("");
    setRandomEventGenerating(false);
  };

  const generateRandomEvent = async () => {
    if (!activeCampaignId) {
      return;
    }

    try {
      setRandomEventGenerating(true);
      setBootError("");

      const selectedLocation =
        campaign?.locations.find((location) => location.id === randomEventLocationId) ?? null;
      const selectedLocationLabel = selectedLocation?.title ?? "";
      const prompt = buildRandomEventPrompt(selectedLocationLabel, randomEventPrompt);
      const draft = await api.generateWorldEvent(activeCampaignId, {
        locationId: randomEventLocationId || undefined,
        type: "social",
        prompt,
        current: {
          title: "",
          date: "",
          summary: "",
          type: "social",
          locationId: randomEventLocationId || "",
          locationLabel: selectedLocationLabel,
          sceneText: "",
          dialogueBranches: [],
          loot: [],
          tags: ["read-aloud", "scene"],
          origin: "ai"
        }
      });

      const sceneText = draft.event.sceneText || draft.event.summary || randomEventPrompt;
      const card = buildSceneCard(draft.event.title, sceneText, randomEventPrompt);

      if (selectedLocation) {
        const nextForm = entityToForm(selectedLocation);
        const nextCard =
          sanitizeSinglePlayerFacingCard(selectedLocation.kind, card, nextForm.playerCards?.length ?? 0) ?? card;
        nextForm.playerCards = [...(nextForm.playerCards ?? []), nextCard];
        nextForm.playerContent = nextForm.playerCards[0]?.content ?? nextCard.content;

        const result = await api.updateEntity(activeCampaignId, selectedLocation.id, serializeEntityForm(nextForm));
        setRandomEventNotes(draft.notes);
        onHydrateCampaign(result.campaign, result.entity.id);
        setActiveModule("locations");
        setActiveRailAlias(null);
        setActiveTab("All");
        setActiveEntityId(result.entity.id);
        setPreviewEntityId(result.entity.id);
        setSelectedWorldEventId("");
        closeRandomEventModal();
        return;
      }

      const payload = serializeEntityForm(buildLoreScenePayload(card, selectedLocationLabel));
      const result = await api.createEntity(activeCampaignId, payload);

      setRandomEventNotes(draft.notes);
      onHydrateCampaign(result.campaign, result.entity.id);
      setActiveModule("lore");
      setActiveRailAlias(null);
      setActiveTab("All");
      setActiveEntityId(result.entity.id);
      setPreviewEntityId(result.entity.id);
      setSelectedWorldEventId("");
      closeRandomEventModal();
    } catch (error) {
      setBootError(error instanceof Error ? error.message : "Не удалось сгенерировать сцену для зачитки.");
    } finally {
      setRandomEventGenerating(false);
    }
  };

  return {
    closeRandomEventModal,
    generateRandomEvent,
    openRandomEventModal,
    randomEventGenerating,
    randomEventLocationId,
    randomEventModalOpen,
    randomEventNotes,
    randomEventPrompt,
    setRandomEventLocationId,
    setRandomEventPrompt
  };
}

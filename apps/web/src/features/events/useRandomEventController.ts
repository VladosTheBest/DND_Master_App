import type {
  CampaignData,
  KnowledgeEntity,
  ModuleId,
  WorldEvent,
  WorldEventInput,
  WorldEventType
} from "@shadow-edge/shared-types";
import { useState } from "react";
import { NEW_WORLD_EVENT_ID, worldEventTypeLabels } from "../../app-shared";
import { api } from "../../app/api";

type UseRandomEventControllerArgs = {
  activeCampaignId: string;
  activeEntity: KnowledgeEntity | null;
  activeWorldEvent: WorldEvent | null;
  campaign: CampaignData | null;
  emptyWorldEventInput: () => WorldEventInput;
  serializeWorldEventInput: (input: WorldEventInput) => WorldEventInput;
  setActiveEntityId: (value: string) => void;
  setActiveModule: (value: ModuleId) => void;
  setActiveRailAlias: (value: "events") => void;
  setActiveTab: (value: string) => void;
  setBootError: (value: string) => void;
  setPreviewEntityId: (value: string) => void;
  setSelectedWorldEventId: (value: string) => void;
  onHydrateCampaign: (campaign: CampaignData) => void;
};

const buildRandomEventPrompt = (eventType: WorldEventType, locationLabel: string, extraPrompt: string) =>
  [
    `Нужна небольшая сценка типа "${worldEventTypeLabels[eventType]}"${locationLabel ? ` для локации "${locationLabel}"` : ""}.`,
    "Это не квест, а короткий table-ready эпизод для живой сессии.",
    "Нужны смешные, напряженные или боевые детали, внятные реплики и короткий конкретный лут."
  ]
    .concat(extraPrompt.trim() ? [`Пожелание мастера: ${extraPrompt.trim()}`] : [])
    .join("\n");

export function useRandomEventController({
  activeCampaignId,
  activeEntity,
  activeWorldEvent,
  campaign,
  emptyWorldEventInput,
  serializeWorldEventInput,
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
  const [randomEventType, setRandomEventType] = useState<WorldEventType>("social");
  const [randomEventPrompt, setRandomEventPrompt] = useState("");
  const [randomEventNotes, setRandomEventNotes] = useState<string[]>([]);
  const [randomEventGenerating, setRandomEventGenerating] = useState(false);

  const openRandomEventModal = (suggestions?: { locationId?: string; type?: WorldEventType }) => {
    const suggestedLocationId =
      suggestions?.locationId ??
      activeWorldEvent?.locationId ??
      (activeEntity?.kind === "location"
        ? activeEntity.id
        : activeEntity?.kind === "npc" || activeEntity?.kind === "monster" || activeEntity?.kind === "quest"
          ? activeEntity.locationId ?? ""
          : "") ??
      "";

    setRandomEventLocationId(suggestedLocationId);
    setRandomEventType(suggestions?.type ?? activeWorldEvent?.type ?? "social");
    setRandomEventPrompt("");
    setRandomEventNotes([]);
    setRandomEventModalOpen(true);
  };

  const closeRandomEventModal = () => {
    setRandomEventModalOpen(false);
    setRandomEventNotes([]);
    setRandomEventPrompt("");
    setRandomEventLocationId("");
    setRandomEventType("social");
    setRandomEventGenerating(false);
  };

  const generateRandomEvent = async () => {
    if (!activeCampaignId) {
      return;
    }

    try {
      setRandomEventGenerating(true);
      setBootError("");

      const selectedLocationLabel =
        campaign?.locations.find((location) => location.id === randomEventLocationId)?.title ?? "";
      const prompt = buildRandomEventPrompt(randomEventType, selectedLocationLabel, randomEventPrompt);
      const draft = await api.generateWorldEvent(activeCampaignId, {
        locationId: randomEventLocationId || undefined,
        type: randomEventType,
        prompt,
        current: {
          ...emptyWorldEventInput(),
          type: randomEventType,
          locationId: randomEventLocationId || "",
          locationLabel: selectedLocationLabel,
          origin: "ai"
        }
      });

      const payload = serializeWorldEventInput({
        ...emptyWorldEventInput(),
        ...draft.event,
        type: draft.event.type ?? randomEventType,
        locationId: draft.event.locationId ?? randomEventLocationId,
        locationLabel: draft.event.locationLabel ?? selectedLocationLabel,
        tags: [...new Set([...(draft.event.tags ?? []), "event", randomEventType])],
        origin: "ai"
      });
      const result = await api.createWorldEvent(activeCampaignId, payload);

      setRandomEventNotes(draft.notes);
      onHydrateCampaign(result.campaign);
      setActiveModule("quests");
      setActiveRailAlias("events");
      setActiveTab("All");
      setActiveEntityId("");
      setSelectedWorldEventId(result.event.id || NEW_WORLD_EVENT_ID);
      setPreviewEntityId(payload.locationId || "");
      closeRandomEventModal();
    } catch (error) {
      setBootError(error instanceof Error ? error.message : "Не удалось сгенерировать случайное событие.");
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
    randomEventType,
    setRandomEventLocationId,
    setRandomEventPrompt,
    setRandomEventType
  };
}

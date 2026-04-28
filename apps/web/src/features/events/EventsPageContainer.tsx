import { useEffect, useState } from "react";
import type {
  CampaignData,
  LocationEntity,
  WorldEvent,
  WorldEventDialogueBranch,
  WorldEventInput
} from "@shadow-edge/shared-types";
import { NEW_WORLD_EVENT_ID } from "../../app-shared";
import { EventsWorkspace } from "../../notes-events";
import { api } from "../../app/api";

export function EventsPageContainer({
  activeCampaignId,
  campaign,
  createEmptyWorldEventDialogueBranch,
  emptyWorldEventInput,
  hydrateCampaign,
  initialEventId,
  onActiveEventChange,
  onOpenGenerator,
  onOpenLocation,
  normalizeWorldEventForClient,
  serializeWorldEventInput,
  worldEventToForm
}: {
  activeCampaignId: string;
  campaign: CampaignData;
  createEmptyWorldEventDialogueBranch: () => WorldEventDialogueBranch;
  emptyWorldEventInput: () => WorldEventInput;
  hydrateCampaign: (campaign: CampaignData, focusEntityId?: string) => void;
  initialEventId?: string;
  onActiveEventChange?: (eventId: string) => void;
  onOpenGenerator: (suggestions?: { locationId?: string; type?: WorldEventInput["type"] }) => void;
  onOpenLocation: (locationId: string) => void;
  normalizeWorldEventForClient: (event: WorldEvent, locations?: LocationEntity[]) => WorldEvent;
  serializeWorldEventInput: (input: WorldEventInput) => WorldEventInput;
  worldEventToForm: (event: WorldEvent) => WorldEventInput;
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [eventEditorId, setEventEditorId] = useState("");
  const [eventEditorDraft, setEventEditorDraft] = useState<WorldEventInput>(emptyWorldEventInput);
  const [eventEditorDirty, setEventEditorDirty] = useState(false);
  const [eventEditorNotice, setEventEditorNotice] = useState("");

  const activeWorldEvent =
    eventEditorId && eventEditorId !== NEW_WORLD_EVENT_ID
      ? campaign.events.find((event) => event.id === eventEditorId) ?? null
      : null;

  useEffect(() => {
    const nextId = initialEventId || campaign.events[0]?.id || NEW_WORLD_EVENT_ID;

    if (!eventEditorId) {
      if (nextId === NEW_WORLD_EVENT_ID) {
        setEventEditorId(NEW_WORLD_EVENT_ID);
        setEventEditorDraft(emptyWorldEventInput());
        setEventEditorDirty(false);
        return;
      }

      const nextEvent = campaign.events.find((event) => event.id === nextId) ?? null;
      if (nextEvent) {
        setEventEditorId(nextEvent.id);
        setEventEditorDraft(worldEventToForm(nextEvent));
        setEventEditorDirty(false);
      }
    }
  }, [campaign.events, emptyWorldEventInput, eventEditorId, initialEventId, worldEventToForm]);

  useEffect(() => {
    if (!activeWorldEvent || eventEditorDirty) {
      return;
    }

    setEventEditorDraft(worldEventToForm(activeWorldEvent));
  }, [activeWorldEvent, eventEditorDirty, worldEventToForm]);

  useEffect(() => {
    onActiveEventChange?.(eventEditorId === NEW_WORLD_EVENT_ID ? "" : eventEditorId);
  }, [eventEditorId, onActiveEventChange]);

  const updateWorldEventDraft = (updater: (current: WorldEventInput) => WorldEventInput) => {
    setEventEditorDraft((current) => updater(current));
    setEventEditorDirty(true);
    setEventEditorNotice("");
  };

  const requestWorldEventSwitch = (nextEventId: string) => {
    if (!nextEventId || nextEventId === eventEditorId) {
      return;
    }

    if (eventEditorDirty && !window.confirm("Есть несохранённые изменения в событии. Переключиться без сохранения?")) {
      return;
    }

    const nextEvent = campaign.events.find((event) => event.id === nextEventId) ?? null;
    if (!nextEvent) {
      return;
    }

    setEventEditorId(nextEvent.id);
    setEventEditorDraft(worldEventToForm(nextEvent));
    setEventEditorDirty(false);
    setEventEditorNotice("");
    setError("");
  };

  const startNewWorldEvent = () => {
    if (eventEditorDirty && !window.confirm("Есть несохранённые изменения в событии. Открыть новый черновик без сохранения?")) {
      return;
    }

    setEventEditorId(NEW_WORLD_EVENT_ID);
    setEventEditorDraft({
      ...emptyWorldEventInput(),
      date: campaign.inWorldDate ?? "",
      locationId: "",
      locationLabel: "",
      origin: "manual"
    });
    setEventEditorDirty(false);
    setEventEditorNotice("");
    setError("");
  };

  const saveWorldEvent = async () => {
    if (!activeCampaignId) {
      return;
    }

    const locationLabel =
      campaign.locations.find((location) => location.id === eventEditorDraft.locationId)?.title ??
      eventEditorDraft.locationLabel ??
      "";
    const payload = serializeWorldEventInput({
      ...eventEditorDraft,
      locationLabel,
      date: eventEditorDraft.date || campaign.inWorldDate || "",
      origin: eventEditorDraft.origin === "ai" ? "ai" : "manual"
    });

    if (!payload.summary.trim() && !payload.sceneText.trim()) {
      setEventEditorNotice("Сначала добавь хотя бы короткое описание или текст сцены.");
      return;
    }

    try {
      setSaving(true);
      setError("");
      setEventEditorNotice("");
      const result =
        activeWorldEvent && eventEditorId !== NEW_WORLD_EVENT_ID
          ? await api.updateWorldEvent(activeCampaignId, activeWorldEvent.id, payload)
          : await api.createWorldEvent(activeCampaignId, payload);
      hydrateCampaign(result.campaign);
      const nextEvent = normalizeWorldEventForClient(result.event, result.campaign.locations ?? []);
      setEventEditorId(nextEvent.id);
      setEventEditorDraft(worldEventToForm(nextEvent));
      setEventEditorDirty(false);
      setEventEditorNotice(activeWorldEvent ? "Событие сохранено." : "Событие создано.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Не удалось сохранить событие.");
    } finally {
      setSaving(false);
    }
  };

  const removeWorldEvent = async () => {
    if (!activeCampaignId || !activeWorldEvent) {
      return;
    }
    if (!window.confirm("Удалить это событие из кампании?")) {
      return;
    }

    try {
      setSaving(true);
      setError("");
      const result = await api.deleteWorldEvent(activeCampaignId, activeWorldEvent.id);
      hydrateCampaign(result.campaign);
      const nextEvent = result.campaign.events[0] ? normalizeWorldEventForClient(result.campaign.events[0], result.campaign.locations ?? []) : null;
      if (nextEvent) {
        setEventEditorId(nextEvent.id);
        setEventEditorDraft(worldEventToForm(nextEvent));
      } else {
        setEventEditorId(NEW_WORLD_EVENT_ID);
        setEventEditorDraft({
          ...emptyWorldEventInput(),
          date: result.campaign.inWorldDate ?? "",
          origin: "manual"
        });
      }
      setEventEditorDirty(false);
      setEventEditorNotice("Событие удалено.");
    } catch (removeError) {
      setError(removeError instanceof Error ? removeError.message : "Не удалось удалить событие.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <EventsWorkspace
      draft={eventEditorDraft}
      draftId={eventEditorId}
      error={error}
      events={campaign.events}
      generating={false}
      locations={campaign.locations}
      notice={eventEditorNotice}
      onAddBranch={() =>
        updateWorldEventDraft((current) => ({
          ...current,
          dialogueBranches: [...(current.dialogueBranches ?? []), createEmptyWorldEventDialogueBranch()]
        }))
      }
      onAddLoot={() =>
        updateWorldEventDraft((current) => ({
          ...current,
          loot: [...(current.loot ?? []), ""]
        }))
      }
      onBranchChange={(index, updater) =>
        updateWorldEventDraft((current) => ({
          ...current,
          dialogueBranches: (current.dialogueBranches ?? []).map((branch, branchIndex) =>
            branchIndex === index ? updater(branch) : branch
          )
        }))
      }
      onCreateEvent={startNewWorldEvent}
      onDelete={() => void removeWorldEvent()}
      onDraftChange={updateWorldEventDraft}
      onLootChange={(index, value) =>
        updateWorldEventDraft((current) => ({
          ...current,
          loot: (current.loot ?? []).map((item, lootIndex) => (lootIndex === index ? value : item))
        }))
      }
      onOpenGenerator={() =>
        onOpenGenerator({
          locationId: eventEditorDraft.locationId || undefined,
          type: eventEditorDraft.type
        })
      }
      onOpenLocation={onOpenLocation}
      onRemoveBranch={(index) =>
        updateWorldEventDraft((current) => ({
          ...current,
          dialogueBranches: (current.dialogueBranches ?? []).filter((_, branchIndex) => branchIndex !== index)
        }))
      }
      onRemoveLoot={(index) =>
        updateWorldEventDraft((current) => ({
          ...current,
          loot: (current.loot ?? []).length <= 1 ? [""] : (current.loot ?? []).filter((_, lootIndex) => lootIndex !== index)
        }))
      }
      onSave={() => void saveWorldEvent()}
      onSearchChange={setSearchQuery}
      onSelectEvent={requestWorldEventSwitch}
      saving={saving}
      searchQuery={searchQuery}
      selectedEventId={activeWorldEvent?.id ?? ""}
    />
  );
}

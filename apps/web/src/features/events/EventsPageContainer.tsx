import { isApiError } from "@shadow-edge/api-client";
import { useDeviceDraft } from "../../app/hooks/useDeviceDraft";
import { DeviceDraftControls } from "../../app/DeviceDraftControls";
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
  ownerId,
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
  ownerId: string;
  activeCampaignId: string;
  campaign: CampaignData;
  createEmptyWorldEventDialogueBranch: () => WorldEventDialogueBranch;
  emptyWorldEventInput: () => WorldEventInput;
  hydrateCampaign: (campaign: CampaignData, focusEntityId?: string) => void;
  initialEventId?: string;
  onActiveEventChange?: (eventId: string) => void;
  onOpenGenerator: (suggestions?: { locationId?: string; type?: WorldEventInput["type"]; newEvent?: boolean; generationMode?: "read_aloud" | "gm_event" }) => void;
  onOpenLocation: (locationId: string) => void;
  normalizeWorldEventForClient: (event: WorldEvent, locations?: LocationEntity[]) => WorldEvent;
  serializeWorldEventInput: (input: WorldEventInput) => WorldEventInput;
  worldEventToForm: (event: WorldEvent) => WorldEventInput;
}) {
  const [legacyDraft]=useState<{id:string;draft:WorldEventInput}|null>(()=>{try{const raw=JSON.parse(sessionStorage.getItem(`event-draft:${activeCampaignId}`)||"null");return raw?.id&&typeof raw.draft?.sceneText==="string"?raw:null;}catch{return null;}});
  const [searchQuery, setSearchQuery] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [eventEditorId, setEventEditorId] = useState("");
  const [eventEditorDraft, setEventEditorDraft] = useState<WorldEventInput>(emptyWorldEventInput);
  const [eventEditorDirty, setEventEditorDirty] = useState(false);
  const [eventEditorNotice, setEventEditorNotice] = useState("");

  const [eventBase,setEventBase]=useState<WorldEventInput>(emptyWorldEventInput);
  const [conflict,setConflict]=useState<WorldEvent|null>(null);
  const deviceDraft=useDeviceDraft({ownerId,campaignId:activeCampaignId,target:`event:${eventEditorId}`,revision:Math.max(0,eventEditorDraft.expectedRevision??0),enabled:Boolean(eventEditorId)&&!campaign.readyCampaign,
    value:{id:eventEditorId,draft:eventEditorDraft,base:eventBase},dirty:eventEditorDirty,
    restore:({value})=>{if(typeof value.draft?.title!=="string"||typeof value.draft.sceneText!=="string")return false;setEventEditorDraft(value.draft);setEventBase(value.base||emptyWorldEventInput());setEventEditorDirty(true);}
  });
  const prepareMerge=()=>{
    if(!conflict)return;const current=worldEventToForm(conflict),merged={...current};
    for(const key of Object.keys(eventEditorDraft) as (keyof WorldEventInput)[])if(key!=="expectedRevision"&&JSON.stringify(eventEditorDraft[key])!==JSON.stringify(eventBase[key]))Object.assign(merged,{[key]:eventEditorDraft[key]});
    setEventBase(current);setEventEditorDraft(merged);setConflict(null);setError("");
  };
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
        setEventEditorDraft(worldEventToForm(nextEvent)); setEventBase(worldEventToForm(nextEvent)); setConflict(null);
        setEventEditorDirty(false);
      }
    }
  }, [campaign.events, emptyWorldEventInput, eventEditorId, initialEventId, worldEventToForm]);

  useEffect(() => {
    if (!activeWorldEvent || eventEditorDirty) {
      return;
    }

    setEventEditorDraft(worldEventToForm(activeWorldEvent));setEventBase(worldEventToForm(activeWorldEvent));
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
    setEventEditorDraft(worldEventToForm(nextEvent)); setEventBase(worldEventToForm(nextEvent)); setConflict(null);
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

    if(deviceDraft.candidate||conflict){setError("Сначала разберите найденный черновик или конфликт версий.");return;}
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
      deviceDraft.clear();
      hydrateCampaign(result.campaign);
      const nextEvent = normalizeWorldEventForClient(result.event, result.campaign.locations ?? []);
      setEventEditorId(nextEvent.id);
      setEventEditorDraft(worldEventToForm(nextEvent)); setEventBase(worldEventToForm(nextEvent)); setConflict(null);
      setEventEditorDirty(false);
      setEventEditorNotice(activeWorldEvent ? "Событие сохранено." : "Событие создано.");
    } catch (saveError) {
      if(isApiError(saveError)&&saveError.status===409&&saveError.current)setConflict(saveError.current as WorldEvent);
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
      const result = await api.deleteWorldEvent(activeCampaignId, activeWorldEvent.id, eventEditorDraft.expectedRevision ?? 0);
      hydrateCampaign(result.campaign);
      const nextEvent = result.campaign.events[0] ? normalizeWorldEventForClient(result.campaign.events[0], result.campaign.locations ?? []) : null;
      if (nextEvent) {
        setEventEditorId(nextEvent.id);
        setEventEditorDraft(worldEventToForm(nextEvent)); setEventBase(worldEventToForm(nextEvent)); setConflict(null);
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
    <>
    {!campaign.readyCampaign&&<DeviceDraftControls draft={deviceDraft} label="черновик события"/>}
    {legacyDraft&&!campaign.readyCampaign&&<div className="card mini"><p>Найдена прежняя копия события в этой вкладке. Исходная копия останется; версия будет сверена сервером перед записью.</p><button className="ghost" onClick={()=>{setEventEditorId(legacyDraft.id);setEventBase(emptyWorldEventInput());setEventEditorDraft({...legacyDraft.draft,expectedRevision:legacyDraft.draft.expectedRevision??-1});setEventEditorDirty(true);}}>Открыть прежний черновик события</button></div>}
    {conflict&&<section className="card mini"><h3>Конфликт версий события</h3><details><summary>Актуальная версия</summary><pre style={{whiteSpace:"pre-wrap",overflowWrap:"anywhere"}}>{JSON.stringify(conflict,null,2)}</pre></details><p>Проверьте поля: ваши изменённые поля заменят соответствующие поля сервера, остальные сохранятся. После подготовки потребуется отдельное сохранение.</p><button className="ghost" onClick={prepareMerge}>Подготовить объединение события</button></section>}
    <EventsWorkspace
      dirty={eventEditorDirty}
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
      campaignId={activeCampaignId}
      onCreateEvent={startNewWorldEvent}
      onDelete={() => void removeWorldEvent()}
      onDraftChange={updateWorldEventDraft}
      onLootChange={(index, value) =>
        updateWorldEventDraft((current) => ({
          ...current,
          loot: (current.loot ?? []).map((item, lootIndex) => (lootIndex === index ? value : item))
        }))
      }
      onOpenGenerator={(generationMode) =>
        onOpenGenerator({
          locationId: eventEditorDraft.locationId || undefined,
          type: eventEditorDraft.type,
          newEvent: true,
          generationMode
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
    </>
  );
}

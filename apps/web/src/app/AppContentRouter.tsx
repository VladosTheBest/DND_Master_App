import {lazy,Suspense} from "react";
import type {
  CampaignData,
  CreateEntityInput,
  KnowledgeEntity,
  LocationEntity,
  QuestEntity,
  WorldEvent,
  WorldEventDialogueBranch,
  WorldEventInput
} from "@shadow-edge/shared-types";
import type {
  MouseEvent as ReactMouseEvent,
  ReactNode,
  RefObject
} from "react";
const ItemsPage=lazy(()=>import("../features/items/ItemsPage").then(module=>({default:module.ItemsPage})));
const ShopsPage=lazy(()=>import("../features/shops/ShopsPage").then(module=>({default:module.ShopsPage})));
const EventsPageContainer=lazy(()=>import("../features/events/EventsPageContainer").then(module=>({default:module.EventsPageContainer})));
const NotesPageContainer=lazy(()=>import("../features/notes/NotesPageContainer").then(module=>({default:module.NotesPageContainer})));
const QuestPageContainer=lazy(()=>import("../features/quests/QuestPageContainer").then(module=>({default:module.QuestPageContainer})));
const RulesPage=lazy(()=>import("../features/rules/RulesPage").then(module=>({default:module.RulesPage})));
import type { PlayerFacingCardsController } from "../features/player-facing/usePlayerFacingCards";

type RailAlias = "items" | "events" | "notes" | "shops" | "sessions";
type ModuleId = "dashboard" | "combat" | "locations" | "players" | "npcs" | "monsters" | "quests" | "lore" | "rules";

function ContentRouter({
  ownerId,
  activeEntity,
  activeModule,
  activeRailAlias,
  bestiaryContent,
  campaign,
  combatContent,
  createEmptyWorldEventDialogueBranch,
  currentPlaybackTrackLabel,
  editorRef,
  emptyWorldEventInput,
  entityMap,
  entityToForm,
  hydrateCampaign,
  initialEventId,
  focusedShopId,
  isEntityPlaylistActive,
  legacyContent,
  normalizeWorldEventForClient,
  notesContentContextMenu,
  onActiveEventChange,
  onEditEntity,
  onEditWithAI,
  onOpenDirectory,
  onOpenEntity,
  onOpenEntityImage,
  onOpenEventGenerator,
  onOpenGallery,
  onOpenGalleryViewer,
  onOpenPlaylist,
  onOpenPreview,
  onOpenQuest,
  onPlayNextPlaylistTrack,
  onPlayPlaylist,
  onCopyImageLink,
  onTogglePin,
  pinned,
  playerFacing,
  preparedCombatSection,
  questScopeEntities,
  resolveLinkedEntity,
  rulesInitialQuery,
  rulesInitialRuleId,
  rulesSelectionKey,
  serializeEntityForm,
  serializeWorldEventInput,
  worldEventToForm
}: {
  ownerId: string;
  activeEntity: KnowledgeEntity | null;
  activeModule: ModuleId;
  activeRailAlias: RailAlias | null;
  bestiaryContent: ReactNode;
  campaign: CampaignData;
  combatContent: ReactNode;
  createEmptyWorldEventDialogueBranch: () => WorldEventDialogueBranch;
  currentPlaybackTrackLabel: string;
  editorRef: RefObject<HTMLTextAreaElement | null>;
  emptyWorldEventInput: () => WorldEventInput;
  entityMap: Map<string, KnowledgeEntity>;
  entityToForm: (entity: KnowledgeEntity) => CreateEntityInput;
  hydrateCampaign: (campaign: CampaignData, focusEntityId?: string) => void;
  initialEventId?: string;
  focusedShopId?: string;
  isEntityPlaylistActive: (entityId?: string) => boolean;
  legacyContent: ReactNode;
  normalizeWorldEventForClient: (event: WorldEvent, locations?: LocationEntity[]) => WorldEvent;
  notesContentContextMenu: (noteId: string, event: ReactMouseEvent<HTMLTextAreaElement>) => void;
  onActiveEventChange?: (eventId: string) => void;
  onEditEntity: (entityId: string) => void;
  onEditWithAI: (entity: KnowledgeEntity) => void;
  onOpenDirectory: () => void;
  onOpenEntity: (entityId: string) => void;
  onOpenEntityImage?: (entity: KnowledgeEntity, displayUrl?: string) => void;
  onOpenEventGenerator: (suggestions?: { locationId?: string; type?: WorldEventInput["type"]; newEvent?: boolean; generationMode?: "read_aloud" | "gm_event" }) => void;
  onOpenGallery: (quest: QuestEntity) => void;
  onOpenGalleryViewer: (quest: QuestEntity, index: number) => void;
  onOpenPlaylist: (quest: QuestEntity) => void;
  onOpenPreview: (entityId: string) => void;
  onOpenQuest: (questId: string) => void;
  onPlayNextPlaylistTrack: () => void;
  onPlayPlaylist: (quest: QuestEntity) => void;
  onCopyImageLink: (url: string) => Promise<void>;
  onTogglePin: (entityId: string) => void;
  pinned: boolean;
  playerFacing: PlayerFacingCardsController;
  preparedCombatSection: ReactNode;
  questScopeEntities: QuestEntity[];
  resolveLinkedEntity: (item: { id: string; label: string }) => KnowledgeEntity | null;
  rulesInitialQuery?: string;
  rulesInitialRuleId?: string;
  rulesSelectionKey: number;
  serializeEntityForm: (form: CreateEntityInput) => CreateEntityInput;
  serializeWorldEventInput: (input: WorldEventInput) => WorldEventInput;
  worldEventToForm: (event: WorldEvent) => WorldEventInput;
}) {
  if (activeModule === "combat") {
    return <>{combatContent}</>;
  }

  if (activeModule === "monsters") {
    return <>{bestiaryContent}</>;
  }

  if (activeModule === "rules") {
    return <RulesPage initialQuery={rulesInitialQuery} initialRuleId={rulesInitialRuleId} />;
  }

  if (activeRailAlias === "items") {
    return <ItemsPage onCampaignChanged={hydrateCampaign} key={campaign.id} ownerId={ownerId} campaignId={campaign.id} />;
  }

  if (activeRailAlias === "shops") {
    return <ShopsPage ownerId={ownerId} key={campaign.id} campaign={campaign} focusedShopId={focusedShopId} hydrateCampaign={hydrateCampaign} />;
  }

  if (activeRailAlias === "events") {
    return (
      <EventsPageContainer
        ownerId={ownerId}
        key={campaign.id}
        activeCampaignId={campaign.id}
        campaign={campaign}
        createEmptyWorldEventDialogueBranch={createEmptyWorldEventDialogueBranch}
        emptyWorldEventInput={emptyWorldEventInput}
        hydrateCampaign={hydrateCampaign}
        initialEventId={initialEventId}
        normalizeWorldEventForClient={normalizeWorldEventForClient}
        onActiveEventChange={onActiveEventChange}
        onOpenGenerator={onOpenEventGenerator}
        onOpenLocation={onOpenEntity}
        serializeWorldEventInput={serializeWorldEventInput}
        worldEventToForm={worldEventToForm}
      />
    );
  }

  if (activeModule === "lore") {
    return (
      <NotesPageContainer
        ownerId={ownerId}
        activeCampaignId={campaign.id}
        campaign={campaign}
        editorRef={editorRef}
        entityMap={entityMap}
        entityToForm={entityToForm}
        hydrateCampaign={hydrateCampaign}
        initialNoteId={activeEntity?.kind === "lore" ? activeEntity.id : undefined}
        onContentContextMenu={notesContentContextMenu}
        onEditWithAI={onEditWithAI}
        onOpenEntityImage={onOpenEntityImage}
        onOpenPreview={onOpenPreview}
        serializeEntityForm={serializeEntityForm}
      />
    );
  }

  if (activeEntity?.kind === "quest" && activeModule === "quests") {
    return (
      <QuestPageContainer
        campaignQuests={campaign.quests}
        currentPlaybackTrackLabel={currentPlaybackTrackLabel}
        entityMap={entityMap}
        isEntityPlaylistActive={isEntityPlaylistActive}
        onCopyImageLink={onCopyImageLink}
        onEditEntity={onEditEntity}
        onEditWithAI={onEditWithAI}
        onOpenDirectory={onOpenDirectory}
        onOpenEntity={onOpenPreview}
        onOpenEntityImage={onOpenEntityImage}
        onOpenGallery={onOpenGallery}
        onOpenGalleryViewer={onOpenGalleryViewer}
        onOpenPlaylist={onOpenPlaylist}
        onOpenQuest={onOpenQuest}
        onPlayNextPlaylistTrack={onPlayNextPlaylistTrack}
        onPlayPlaylist={onPlayPlaylist}
        onTogglePin={onTogglePin}
        pinned={pinned}
        playerFacing={playerFacing}
        preparedCombatSection={preparedCombatSection}
        quest={activeEntity}
        questScopeEntities={questScopeEntities}
        resolveLinkedEntity={resolveLinkedEntity}
      />
    );
  }

  return <>{legacyContent}</>;
}

export function AppContentRouter(props:Parameters<typeof ContentRouter>[0]){return <Suspense fallback={<p role="status">Загружаю раздел…</p>}><ContentRouter {...props}/></Suspense>;}

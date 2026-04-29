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
import { ItemsPage } from "../features/items/ItemsPage";
import { EventsPageContainer } from "../features/events/EventsPageContainer";
import { NotesPageContainer } from "../features/notes/NotesPageContainer";
import { QuestPageContainer } from "../features/quests/QuestPageContainer";
import { RulesPage } from "../features/rules/RulesPage";
import type { PlayerFacingCardsController } from "../features/player-facing/usePlayerFacingCards";

type RailAlias = "items" | "events" | "notes";
type ModuleId = "dashboard" | "combat" | "locations" | "players" | "npcs" | "monsters" | "quests" | "lore" | "rules";

export function AppContentRouter({
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
  isEntityPlaylistActive,
  legacyContent,
  normalizeWorldEventForClient,
  notesContentContextMenu,
  onActiveEventChange,
  onEditEntity,
  onOpenDirectory,
  onOpenEntity,
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
  isEntityPlaylistActive: (entityId?: string) => boolean;
  legacyContent: ReactNode;
  normalizeWorldEventForClient: (event: WorldEvent, locations?: LocationEntity[]) => WorldEvent;
  notesContentContextMenu: (noteId: string, event: ReactMouseEvent<HTMLTextAreaElement>) => void;
  onActiveEventChange?: (eventId: string) => void;
  onEditEntity: (entityId: string) => void;
  onOpenDirectory: () => void;
  onOpenEntity: (entityId: string) => void;
  onOpenEventGenerator: (suggestions?: { locationId?: string; type?: WorldEventInput["type"] }) => void;
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
    return <RulesPage key={`rules-${rulesSelectionKey}`} initialQuery={rulesInitialQuery} initialRuleId={rulesInitialRuleId} />;
  }

  if (activeRailAlias === "items") {
    return <ItemsPage campaignId={campaign.id} />;
  }

  if (activeRailAlias === "events") {
    return (
      <EventsPageContainer
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
        activeCampaignId={campaign.id}
        campaign={campaign}
        editorRef={editorRef}
        entityMap={entityMap}
        entityToForm={entityToForm}
        hydrateCampaign={hydrateCampaign}
        initialNoteId={activeEntity?.kind === "lore" ? activeEntity.id : undefined}
        onContentContextMenu={notesContentContextMenu}
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
        onOpenDirectory={onOpenDirectory}
        onOpenEntity={onOpenPreview}
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

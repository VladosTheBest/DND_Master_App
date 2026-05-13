import "@shadow-edge/design-tokens/theme.css";
import {
  CollapsibleSection,
  NEW_LORE_NOTE_ID,
  NEW_WORLD_EVENT_ID,
  badge,
  clamp,
  createBestiaryPortraitSource,
  createPortraitSource,
  createHeroPanelStyle,
  formatModifier,
  gradients,
  hasVisibleArt,
  isRewardableEntity,
  kindTitle,
  matchesEntityDirectorySearch,
  playlistTrackHost,
  playlistTrackTitle,
  rewardSummaryText,
  sigil,
  toneClass,
  truncateInlineText,
  worldEventExcerpt,
  worldEventTypeLabels,
  worldEventTypeOptions,
  worldEventTypeTones
} from "./app-shared";
import {
  buildInitiativeHash,
  parseAppRoute,
  type AppRouteState
} from "./app-route";
import {
  DndGenerationProgress,
  LoginScreen
} from "./auth-ui";
import { api } from "./app/api";
import { AppContentRouter } from "./app/AppContentRouter";
import { CampaignCreateModal } from "./app/CampaignCreateModal";
import { CloseConfirmDialog } from "./app/CloseConfirmDialog";
import { AppHeader } from "./app/AppHeader";
import { AppPreviewContent } from "./app/AppPreviewContent";
import { AppPreviewPanel } from "./app/AppPreviewPanel";
import { AppSidebar } from "./app/AppSidebar";
import { EntityDirectoryScreen } from "./app/EntityDirectoryScreen";
import { useCampaignCreationController } from "./app/hooks/useCampaignCreationController";
import { useModalController } from "./app/hooks/useModalController";
import { FloatingPlaylistPlayer } from "./floating-player";
import { InitiativeTrackerScreen } from "./initiative-screen";
import {
  CombatEntityPreviewSummary,
  CombatEntityStatSheet,
  combatEntryInitiative,
  combatEntrySelectionKey,
  combatRosterFilters,
  combatVictoryLoserLabel,
  CombatEntryCard,
  CombatEntryTile,
  isCombatEntryOut,
  RewardSection,
  sortCombatEntriesByInitiative,
  type CombatRosterFilter
} from "./combat-ui";
import {
  GallerySection,
  PlaylistEditorSection,
  type GalleryViewerState,
  PlaylistSection
} from "./media";
import {
  PlayerFacingCardStrip,
  collectQuestSectionLines,
  parseQuestTextSections,
  splitQuestNarrative,
  type QuestCombatEntrySummary,
  type QuestLinkedEntity,
  QuestPreviewPanel,
  resolveQuestSceneArtwork,
  questStatusTone
} from "./quests";
import {
  RichParagraphs
} from "./rich-text";
import {
  type RailIconName
} from "./rail-icon";
import {
  formatPlaybackTime,
  pickRandomTrackIndex,
  resolvePlaylistSource
} from "./playback";
import { CombatPage } from "./features/combat/CombatPage";
import { CombatPrepPage } from "./features/combat/CombatPrepPage";
import "./features/combat/combat.css";
import { BestiaryPageContainer } from "./features/bestiary/BestiaryPageContainer";
import { BestiaryPreviewPanel } from "./features/bestiary/BestiaryPreviewPanel";
import { useBestiaryController } from "./features/bestiary/useBestiaryController";
import { isBestiaryBrowseTab } from "./features/bestiary/bestiary.utils";
import { useCombatDifficulty } from "./features/combat/hooks/useCombatDifficulty";
import { useCombatDraftController } from "./features/combat/hooks/useCombatDraftController";
import { useCombatEnemySearch } from "./features/combat/hooks/useCombatEnemySearch";
import {
  challengeFilterOptions,
  cloneCampaignPreparedCombat,
  clonePreparedCombatPlan,
  combatDifficultyLabel,
  computeEncounterThresholds,
  countPreparedCombatItems,
  createEmptyCampaignPreparedCombat,
  createDefaultCombatThresholds,
  defaultPreparedCombatTitle,
  deriveEncounterDifficulty,
  derivePartyLevels,
  encounterMultiplier,
  extractChallengeToken,
  formatAllyCountLabel,
  formatCombatSetupTypeLabel,
  formatEnemyCountLabel,
  formatParticipantCountLabel,
  formatPartyCountLabel,
  formatPartyLevelText,
  formatPartyLevelsText,
  getEntityChallenge,
  isPreparedCombatHostEntity,
  normalizeCombatSetupTypeKey,
  normalizePreparedCombatPlansForClient,
  parseChallengeXp,
  resolveCombatSearchItemType,
  resolveCombatSearchItemTypeLabel,
  resolveEntityPreparedCombats,
  sanitizeCampaignPreparedCombat,
  sanitizePartyLevel,
  sanitizePreparedCombatPlan,
  sanitizePreparedCombatPlans,
  targetThresholdValue
} from "./features/combat/combat.utils";
import { EntityEditorModal } from "./features/entities/EntityEditorModal";
import { EntityDetailsPage } from "./features/entities/EntityDetailsPage";
import "./features/entities/entities.css";
import { EntityActionMenu } from "./features/entity-actions/EntityActionMenu";
import { EntityDeleteDialog } from "./features/entity-actions/EntityDeleteDialog";
import { EntityGalleryModal } from "./features/entities/EntityGalleryModal";
import { EntityGalleryViewer } from "./features/entities/EntityGalleryViewer";
import { EntityPlaylistModal } from "./features/entities/EntityPlaylistModal";
import { useEntityActionsController } from "./features/entity-actions/useEntityActionsController";
import { EntityLinkContextMenu } from "./features/entity-links/EntityLinkContextMenu";
import { EntityLinkPickerModal } from "./features/entity-links/EntityLinkPickerModal";
import { useEntityLinkController } from "./features/entity-links/useEntityLinkController";
import type { PreparedCombatHostEntity } from "./features/combat/combat.types";
import type {
  CombatProfileEntity,
  EntityModalMode,
  StatEntrySectionKey
} from "./features/entities/entity.types";
import {
  acceptedImageUploadTypes,
  acceptedPlayerFacingHtmlUploadTypes,
  cloneGalleryImages,
  clonePlaylistTracks,
  createEmptyGalleryImage,
  createEmptyMonsterLootEntry,
  createEmptyMonsterRewardProfile,
  createEmptyNpcStatBlock,
  createEmptyPlaylistTrack,
  createEmptyPreparedCombatPlan,
  createEmptySpellSlot,
  createEmptySpellcasting,
  createEmptyStatEntry,
  composeVisibleQuickFacts,
  emptyEntityForm,
  filterEntities,
  isCombatProfileEntity,
  imageTitleFromFileName
} from "./features/entities/entity.utils";
import { useEntityEditorController } from "./features/entities/useEntityEditorController";
import { useEntityMediaController } from "./features/entities/useEntityMediaController";
import { RandomEventModal } from "./features/events/RandomEventModal";
import { useRandomEventController } from "./features/events/useRandomEventController";
import { GlobalSearchModal } from "./features/global-search/GlobalSearchModal";
import { useGlobalSearchController } from "./features/global-search/useGlobalSearchController";
import { PlayerFacingController } from "./features/player-facing/PlayerFacingController";
import {
  createEmptyPlayerFacingCard,
  defaultPlayerFacingCardTitle,
  normalizePlayerFacingCardsForClient,
  sanitizePlayerFacingCards,
  sanitizeSinglePlayerFacingCard,
  usePlayerFacingCards
} from "./features/player-facing/usePlayerFacingCards";
import { PreparedCombatList } from "./features/prepared-combat/PreparedCombatList";
import { PreparedCombatModal } from "./features/prepared-combat/PreparedCombatModal";
import { usePreparedCombatController } from "./features/prepared-combat/usePreparedCombatController";
import { resolvePreparedCombatAllies, resolvePreparedCombatEntriesForPlans } from "./features/prepared-combat/preparedCombat.utils";
import type {
  ActiveCombat,
  AbilityKey,
  AbilityScores,
  AuthSessionResult,
  CampaignData,
  CampaignPreparedCombat,
  CampaignSummary,
  CombatDifficulty,
  CombatEntry,
  CombatResult,
  CombatThresholds,
  CreateEntityInput,
  CreateEntityResult,
  EntityKind,
  FinishCombatResult,
  GalleryImage,
  GenerateCombatResult,
  HeroArt,
  KnowledgeEntity,
  LastCombatSummary,
  LocationEntity,
  ModuleId,
  MonsterLootEntry,
  MonsterRewardProfile,
  MonsterEntity,
  NpcEntity,
  NpcStatBlock,
  PlayerEntity,
  PlayerFacingCard,
  PlaylistTrack,
  PreparedCombatItem,
  PreparedCombatPlan,
  QuestEntity,
  QuickFactTone,
  RelatedEntity,
  SpellSlotSummary,
  SpellcastingBlock,
  StatBlockEntry,
  WorldEvent,
  WorldEventDialogueBranch,
  WorldEventInput,
  WorldEventType
} from "@shadow-edge/shared-types";
import {
  startTransition,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type FormEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode
} from "react";

const tabs: Record<ModuleId, string[]> = {
  dashboard: ["Сводка", "Подготовка"],
  combat: ["Сцена"],
  locations: ["Все", "Города", "Регионы", "Подземелья", "Точки"],
  players: ["Все", "Активные", "Резерв", "Гости"],
  npcs: ["Все", "Важные", "Союзники", "Угрозы"],
  monsters: ["Каталог", "Импорт", "Именные НПС", "Классика"],
  quests: ["Все", "Активные", "Пауза", "Завершены"],
  lore: ["Все", "Только GM", "Для игроков", "Угрозы"],
  rules: ["SRD 5.2.1"]
};

const questStatusTabLabel = (status: QuestEntity["status"]) => {
  if (status === "active") return "Активные";
  if (status === "paused") return "Пауза";
  if (status === "completed") return "Завершены";
  return "Все";
};

const moduleByKind: Record<EntityKind, ModuleId> = {
  location: "locations",
  player: "players",
  npc: "npcs",
  monster: "monsters",
  quest: "quests",
  lore: "lore"
};

const entityGenerationSteps = ["Собираю контекст кампании", "Зову оракула", "Заполняю черновик и форму"];
const combatGenerationSteps = ["Считаю силу партии", "Подбираю противников", "Собираю бой для стола"];
const randomEventGenerationSteps = ["Читаю, где находится партия", "Придумываю встречу и поворот", "Собираю текст для зачитки"];

const emptyWorldEventInput = (): WorldEventInput => ({
  title: "",
  date: "",
  summary: "",
  type: "social",
  locationId: "",
  locationLabel: "",
  sceneText: "",
  dialogueBranches: [
    {
      title: "Если заговорить",
      lines: [""],
      outcome: ""
    }
  ],
  loot: [""],
  tags: [],
  origin: "manual"
});


type ResizeKey = "rail" | "list" | "preview";
type RailAlias = "items" | "events" | "notes" | "shops";
type RailNavKey = "dashboard" | "locations" | "players" | "npcs" | "monsters" | "quests" | "rules" | RailAlias;

type PlayerFacingViewState = {
  entityId: string;
  title?: string;
  content: string;
  contentHtml?: string;
  cardIndex?: number;
  editMode?: boolean;
  isNew?: boolean;
};
type LoreNoteEntity = Extract<KnowledgeEntity, { kind: "lore" }>;
type PlaylistOwnerScope = "entity" | "combat";
type ActivePlaylistPlayback = {
  scope: PlaylistOwnerScope;
  ownerId: string;
  ownerTitle: string;
  tracks: PlaylistTrack[];
  currentIndex: number;
  token: number;
};
type EntityCombatSetupState = {
  entityId: string;
  planIndex: number;
  isNew: boolean;
};
type CombatReturnTarget = {
  campaignId: string;
  questId?: string;
  startedAt: number;
};
type CombatPrepIconName = "players" | "enemy" | "initiative" | "round" | "conditions" | "notes" | "swords";

const combatReturnTargetsStorageKey = "shadow-edge:combat-return-targets";

const isCombatReturnTarget = (value: unknown): value is CombatReturnTarget => {
  if (!value || typeof value !== "object") {
    return false;
  }

  const target = value as Partial<CombatReturnTarget>;
  return (
    typeof target.campaignId === "string" &&
    typeof target.startedAt === "number" &&
    (target.questId === undefined || typeof target.questId === "string")
  );
};

const readCombatReturnTargets = (): Record<string, CombatReturnTarget> => {
  if (typeof window === "undefined") {
    return {};
  }

  try {
    const parsed = JSON.parse(window.localStorage.getItem(combatReturnTargetsStorageKey) ?? "{}") as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }

    return Object.entries(parsed).reduce<Record<string, CombatReturnTarget>>((accumulator, [combatId, value]) => {
      if (combatId && isCombatReturnTarget(value)) {
        accumulator[combatId] = value;
      }
      return accumulator;
    }, {});
  } catch {
    return {};
  }
};

const writeCombatReturnTargets = (targets: Record<string, CombatReturnTarget>) => {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(combatReturnTargetsStorageKey, JSON.stringify(targets));
  } catch {
    // Navigation still works in the current session even if localStorage is unavailable.
  }
};

function CombatPrepIcon({ name }: { name: CombatPrepIconName }) {
  const common = {
    fill: "none",
    stroke: "currentColor",
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    strokeWidth: 1.7
  };

  switch (name) {
    case "players":
      return (
        <svg aria-hidden="true" className="combat-prep-icon-svg" viewBox="0 0 20 20">
          <circle {...common} cx="7" cy="7" r="2.3" />
          <circle {...common} cx="13.2" cy="8.1" r="1.8" />
          <path {...common} d="M3.8 15c.9-2.1 2.5-3.2 4.9-3.2 2.1 0 3.8 1.1 4.7 3.2" />
          <path {...common} d="M11.8 14.8c.4-1.2 1.3-1.9 2.6-1.9 1.1 0 1.9.4 2.5 1.3" />
        </svg>
      );
    case "enemy":
      return (
        <svg aria-hidden="true" className="combat-prep-icon-svg" viewBox="0 0 20 20">
          <path {...common} d="M6.2 6.5 4.7 4.8M13.8 6.5l1.5-1.7M5.4 12c0-3.1 2-5.3 4.6-5.3s4.6 2.2 4.6 5.3" />
          <path {...common} d="M6.1 14c1 .8 2.3 1.2 3.9 1.2s2.9-.4 3.9-1.2" />
          <circle cx="8" cy="10.1" fill="currentColor" r=".9" />
          <circle cx="12" cy="10.1" fill="currentColor" r=".9" />
        </svg>
      );
    case "initiative":
      return (
        <svg aria-hidden="true" className="combat-prep-icon-svg" viewBox="0 0 20 20">
          <circle {...common} cx="10" cy="10" r="6.6" />
          <path {...common} d="M10 6.3v4.1l2.8 1.8" />
        </svg>
      );
    case "round":
      return (
        <svg aria-hidden="true" className="combat-prep-icon-svg" viewBox="0 0 20 20">
          <path {...common} d="M15.4 7.3A6.2 6.2 0 1 0 16 10" />
          <path {...common} d="M12.6 4.5h3.5V8" />
        </svg>
      );
    case "conditions":
      return (
        <svg aria-hidden="true" className="combat-prep-icon-svg" viewBox="0 0 20 20">
          <path {...common} d="M10 3.4 15.8 6.8v6.4L10 16.6l-5.8-3.4V6.8L10 3.4Z" />
          <path {...common} d="M7.2 10.1 9 11.9l3.8-3.8" />
        </svg>
      );
    case "notes":
      return (
        <svg aria-hidden="true" className="combat-prep-icon-svg" viewBox="0 0 20 20">
          <path {...common} d="M6 3.6h6l3 3v9a1.8 1.8 0 0 1-1.8 1.8H6.8A1.8 1.8 0 0 1 5 15.6V5.4A1.8 1.8 0 0 1 6.8 3.6Z" />
          <path {...common} d="M12 3.6v3h3" />
          <path {...common} d="M7.5 9.9h5M7.5 12.6h4.2" />
        </svg>
      );
    case "swords":
      return (
        <svg aria-hidden="true" className="combat-prep-icon-svg" viewBox="0 0 20 20">
          <path {...common} d="M6.4 4.8 10 8.4l-4.4 4.4-1.8.6.6-1.8L8.8 7.2" />
          <path {...common} d="m13.6 4.8-3.6 3.6 4.4 4.4 1.8.6-.6-1.8-4.4-4.4" />
        </svg>
      );
    default:
      return null;
  }
}


const createEmptyWorldEventDialogueBranch = (): WorldEventDialogueBranch => ({
  title: "",
  lines: [""],
  outcome: ""
});

const cloneStatEntries = (entries: StatBlockEntry[] = []) => entries.map((entry) => ({ ...entry }));

const cloneMonsterRewardProfile = (profile?: MonsterRewardProfile): MonsterRewardProfile | undefined =>
  profile
    ? {
        ...profile,
        loot: profile.loot.map((entry) => ({ ...entry }))
      }
    : undefined;


const clonePlayerFacingCards = (cards?: PlayerFacingCard[]): PlayerFacingCard[] | undefined =>
  cards ? cards.map((card) => ({ ...card })) : undefined;

const summarizePlayerFacingContent = (value?: string, maxItems = 4) => {
  const sections = parseQuestTextSections(value);
  const primarySection = sections.find((section) => section.body.length);
  const sectionLines = collectQuestSectionLines(primarySection, maxItems);
  return sectionLines.length ? sectionLines : splitQuestNarrative(value ?? "", maxItems);
};

const normalizeRewardProfileForClient = (profile?: MonsterRewardProfile): MonsterRewardProfile | undefined =>
  profile
    ? {
        ...profile,
        loot: profile.loot ?? []
      }
    : undefined;

const normalizeCombatEntryForClient = (entry: CombatEntry): CombatEntry => ({
  ...entry,
  entityKind: entry.entityKind ?? "monster",
  side: entry.side ?? (entry.entityKind === "player" ? "player" : "enemy"),
  initiative: Number.isFinite(entry.initiative) ? entry.initiative : 0,
  armorClass: entry.armorClass || (entry.entityKind === "player" ? "—" : "10")
});

const normalizeEntityForClient = <T extends KnowledgeEntity>(entity: T): T => {
  const preparedCombats = normalizePreparedCombatPlansForClient(entity.preparedCombats, entity.preparedCombat);

  return {
    ...entity,
    ...(("level" in entity
      ? {
          level: sanitizePartyLevel(entity.level)
        }
      : {}) as Partial<T>),
    tags: entity.tags ?? [],
    quickFacts: entity.quickFacts ?? [],
    related: entity.related ?? [],
    playerCards: normalizePlayerFacingCardsForClient(entity.kind, entity.playerCards, entity.playerContent),
    playlist: entity.playlist ?? [],
    gallery: entity.gallery ?? [],
    preparedCombat: preparedCombats[0] ? clonePreparedCombatPlan(preparedCombats[0]) : undefined,
    preparedCombats,
    ...(("rewardProfile" in entity
      ? {
          rewardProfile: normalizeRewardProfileForClient(entity.rewardProfile)
        }
      : {}) as Partial<T>)
  };
};

const normalizeWorldEventDialogueBranchForClient = (branch: WorldEventDialogueBranch): WorldEventDialogueBranch => ({
  title: branch.title?.trim() || "Ветка",
  lines: (branch.lines ?? []).map((line) => line.trim()).filter(Boolean),
  outcome: branch.outcome?.trim() || undefined
});

const normalizeWorldEventForClient = (event: WorldEvent, locations: LocationEntity[] = []): WorldEvent => {
  const type = worldEventTypeOptions.includes(event.type as WorldEventType) ? (event.type as WorldEventType) : "social";
  const locationLabel =
    event.locationLabel?.trim() ||
    locations.find((location) => location.id === event.locationId)?.title ||
    "";
  const sceneText = event.sceneText?.trim() || event.summary?.trim() || event.title?.trim() || "Небольшая сценка для стола.";
  const summary =
    event.summary?.trim() ||
    sceneText
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 18)
      .join(" ");

  return {
    ...event,
    title: event.title?.trim() || "Случайное событие",
    date: event.date?.trim() || "",
    summary,
    type,
    locationId: event.locationId?.trim() || undefined,
    locationLabel: locationLabel || undefined,
    sceneText,
    dialogueBranches: (event.dialogueBranches ?? []).map(normalizeWorldEventDialogueBranchForClient),
    loot: (event.loot ?? []).map((item) => item.trim()).filter(Boolean),
    tags: [...new Set((event.tags ?? []).map((tag) => tag.trim()).filter(Boolean))],
    origin: event.origin === "ai" ? "ai" : "manual"
  };
};

const worldEventToForm = (event: WorldEvent): WorldEventInput => ({
  title: event.title,
  date: event.date,
  summary: event.summary,
  type: event.type,
  locationId: event.locationId ?? "",
  locationLabel: event.locationLabel ?? "",
  sceneText: event.sceneText,
  dialogueBranches: event.dialogueBranches.length
    ? event.dialogueBranches.map((branch) => ({
        title: branch.title,
        lines: branch.lines.length ? [...branch.lines] : [""],
        outcome: branch.outcome ?? ""
      }))
    : [createEmptyWorldEventDialogueBranch()],
  loot: event.loot.length ? [...event.loot] : [""],
  tags: [...event.tags],
  origin: event.origin
});

const serializeWorldEventInput = (input: WorldEventInput): WorldEventInput => {
  const type = worldEventTypeOptions.includes(input.type) ? input.type : "social";
  const sceneText = input.sceneText?.trim() || input.summary?.trim() || "";
  return {
    title: input.title.trim() || "Случайное событие",
    date: input.date?.trim() || "",
    summary: input.summary?.trim() || truncateInlineText(sceneText, 150),
    type,
    locationId: input.locationId?.trim() || "",
    locationLabel: input.locationLabel?.trim() || "",
    sceneText,
    dialogueBranches: (input.dialogueBranches ?? [])
      .map((branch) => ({
        title: branch.title.trim() || "Ветка",
        lines: (branch.lines ?? []).map((line) => line.trim()).filter(Boolean),
        outcome: branch.outcome?.trim() || undefined
      }))
      .filter((branch) => branch.title || branch.lines.length || branch.outcome),
    loot: (input.loot ?? []).map((item) => item.trim()).filter(Boolean),
    tags: [...new Set((input.tags ?? []).map((tag) => tag.trim()).filter(Boolean))],
    origin: input.origin === "ai" ? "ai" : "manual"
  };
};

const normalizeCampaignForClient = (data: CampaignData): CampaignData => ({
  ...data,
  locations: (data.locations ?? []).map((entity) => normalizeEntityForClient(entity)),
  players: (data.players ?? []).map((entity) => normalizeEntityForClient(entity)),
  npcs: (data.npcs ?? []).map((entity) => normalizeEntityForClient(entity)),
  monsters: (data.monsters ?? []).map((entity) => normalizeEntityForClient(entity)),
  quests: (data.quests ?? []).map((entity) => normalizeEntityForClient(entity)),
  lore: (data.lore ?? []).map((entity) => normalizeEntityForClient(entity)),
  events: (data.events ?? []).map((event) => normalizeWorldEventForClient(event, data.locations ?? [])),
  combatPlaylist: data.combatPlaylist ?? [],
  preparedCombat: data.preparedCombat ? cloneCampaignPreparedCombat(data.preparedCombat) : data.preparedCombat ?? null,
  lastCombatSummary: data.lastCombatSummary
    ? {
        ...data.lastCombatSummary,
        round: data.lastCombatSummary.round && data.lastCombatSummary.round > 0 ? data.lastCombatSummary.round : 1,
        entries: (data.lastCombatSummary.entries ?? []).map((entry) => normalizeCombatEntryForClient(entry)),
        playerRewards: data.lastCombatSummary.playerRewards ?? []
      }
    : data.lastCombatSummary ?? null,
  activeCombat: data.activeCombat
    ? {
        ...data.activeCombat,
        round: data.activeCombat.round && data.activeCombat.round > 0 ? data.activeCombat.round : 1,
        currentTurnEntryId: data.activeCombat.currentTurnEntryId ?? "",
        entries: (data.activeCombat.entries ?? []).map((entry) => normalizeCombatEntryForClient(entry))
      }
    : data.activeCombat ?? null
});

const cloneNpcStatBlock = (statBlock?: NpcStatBlock): NpcStatBlock | undefined =>
  statBlock
    ? {
        ...statBlock,
        abilityScores: { ...statBlock.abilityScores },
        traits: cloneStatEntries(statBlock.traits),
        actions: cloneStatEntries(statBlock.actions),
        bonusActions: cloneStatEntries(statBlock.bonusActions ?? []),
        reactions: cloneStatEntries(statBlock.reactions ?? []),
        spellcasting: statBlock.spellcasting
          ? {
              ...statBlock.spellcasting,
              slots: (statBlock.spellcasting.slots ?? []).map((slot) => ({ ...slot })),
              spells: [...statBlock.spellcasting.spells]
            }
          : null
      }
    : undefined;

const entityToForm = (entity: KnowledgeEntity): CreateEntityInput => {
  const preparedCombats = normalizePreparedCombatPlansForClient(entity.preparedCombats, entity.preparedCombat).map(
    (plan) => clonePreparedCombatPlan(plan) ?? createEmptyPreparedCombatPlan()
  );

  return {
    kind: entity.kind,
    title: entity.title,
    subtitle: entity.subtitle,
    summary: entity.summary,
    content: entity.content,
    playerContent: entity.playerContent,
    playerCards: clonePlayerFacingCards(normalizePlayerFacingCardsForClient(entity.kind, entity.playerCards, entity.playerContent)) ?? [],
    tags: [...(entity.tags ?? [])],
    playlist: clonePlaylistTracks(entity.playlist) ?? [],
    gallery: cloneGalleryImages(entity.gallery) ?? [],
    related: (entity.related ?? []).map((item) => ({ ...item })),
    art: entity.art ? { ...entity.art } : undefined,
    category: "category" in entity ? entity.category : undefined,
    region: "region" in entity ? entity.region : undefined,
    danger: "danger" in entity ? entity.danger : undefined,
    parentId: "parentId" in entity ? entity.parentId : undefined,
    role: "role" in entity ? entity.role : undefined,
    status: "status" in entity ? entity.status : undefined,
    level: "level" in entity ? sanitizePartyLevel(entity.level) : undefined,
    importance: "importance" in entity ? entity.importance : undefined,
    locationId: "locationId" in entity ? entity.locationId : undefined,
    statBlock:
      entity.kind === "player" || entity.kind === "npc" || entity.kind === "monster"
        ? cloneNpcStatBlock(entity.statBlock) ?? createEmptyNpcStatBlock()
        : undefined,
    rewardProfile:
      entity.kind === "npc" || entity.kind === "monster" || entity.kind === "quest"
        ? cloneMonsterRewardProfile(normalizeRewardProfileForClient(entity.rewardProfile)) ?? createEmptyMonsterRewardProfile()
        : undefined,
    urgency: "urgency" in entity ? entity.urgency : undefined,
    issuerId: "issuerId" in entity ? entity.issuerId : undefined,
    preparedCombat: preparedCombats[0] ? clonePreparedCombatPlan(preparedCombats[0]) : undefined,
    preparedCombats,
    visibility: "visibility" in entity ? entity.visibility : undefined
  };
};

const sanitizeOptionalText = (value?: string) => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
};

const sanitizeTags = (tags: string[]) => {
  const seen = new Set<string>();
  return tags
    .map((tag) => tag.trim())
    .filter((tag) => {
      if (!tag) return false;
      const key = tag.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
};

const sanitizePlaylistTracks = (tracks: PlaylistTrack[] = []) =>
  tracks
    .map((track) => ({
      title: track.title.trim(),
      url: track.url.trim()
    }))
    .filter((track) => track.url)
    .map((track, index) => ({
      title: track.title || `Трек ${index + 1}`,
      url: track.url
    }));

const sanitizeGalleryImages = (items: GalleryImage[] = []) =>
  items
    .map((item) => ({
      title: item.title.trim(),
      url: item.url.trim(),
      caption: sanitizeOptionalText(item.caption)
    }))
    .filter((item) => item.url)
    .map((item, index) => ({
      title: item.title || `Изображение ${index + 1}`,
      url: item.url,
      caption: item.caption
    }));

const sanitizeStatEntries = (entries: StatBlockEntry[] = []) =>
  entries
    .map((entry) => ({
      name: entry.name.trim(),
      subtitle: sanitizeOptionalText(entry.subtitle),
      toHit: sanitizeOptionalText(entry.toHit),
      damage: sanitizeOptionalText(entry.damage),
      saveDc: sanitizeOptionalText(entry.saveDc),
      description: entry.description.trim()
    }))
    .filter((entry) => entry.name || entry.description || entry.toHit || entry.damage || entry.saveDc || entry.subtitle)
    .map((entry) => ({
      name: entry.name || "Unnamed Entry",
      subtitle: entry.subtitle,
      toHit: entry.toHit,
      damage: entry.damage,
      saveDc: entry.saveDc,
      description: entry.description || "Description pending."
    }));

const sanitizeSpellcasting = (spellcasting?: SpellcastingBlock | null): SpellcastingBlock | null => {
  if (!spellcasting) {
    return null;
  }

  const slots = (spellcasting.slots ?? [])
    .map((slot) => ({
      level: slot.level.trim(),
      slots: slot.slots.trim()
    }))
    .filter((slot) => slot.level || slot.slots);

  const spells = spellcasting.spells.map((spell) => spell.trim()).filter(Boolean);
  const title = spellcasting.title.trim();
  const ability = spellcasting.ability.trim();
  const saveDc = spellcasting.saveDc.trim();
  const attackBonus = spellcasting.attackBonus.trim();
  const description = sanitizeOptionalText(spellcasting.description);

  if (!title && !ability && !saveDc && !attackBonus && !description && !slots.length && !spells.length) {
    return null;
  }

  return {
    title: title || "Spellcasting",
    ability: ability || "INT",
    saveDc: saveDc || "13",
    attackBonus: attackBonus || "+5",
    slots,
    spells,
    description
  };
};

const sanitizeMonsterRewardProfile = (profile?: MonsterRewardProfile): MonsterRewardProfile | undefined => {
  if (!profile) {
    return undefined;
  }

  const summary = profile.summary.trim();
  const loot = profile.loot
    .map((entry) => ({
      name: entry.name.trim(),
      category: entry.category.trim(),
      quantity: entry.quantity.trim(),
      check: entry.check.trim(),
      dc: sanitizeOptionalText(entry.dc),
      details: sanitizeOptionalText(entry.details)
    }))
    .filter((entry) => entry.name || entry.category || entry.quantity || entry.check || entry.dc || entry.details)
    .map((entry) => ({
      name: entry.name || "Безымянная добыча",
      category: entry.category || "Лут",
      quantity: entry.quantity || "1",
      check: entry.check || "Без проверки",
      dc: entry.dc,
      details: entry.details
    }));

  if (!summary && !loot.length) {
    return undefined;
  }

  return {
    summary,
    loot
  };
};

const sanitizeNpcStatBlock = (statBlock?: NpcStatBlock): NpcStatBlock | undefined => {
  if (!statBlock) {
    return undefined;
  }

  return {
    size: statBlock.size.trim() || "Medium",
    creatureType: statBlock.creatureType.trim() || "humanoid",
    alignment: statBlock.alignment.trim() || "neutral",
    armorClass: statBlock.armorClass.trim() || "10",
    hitPoints: statBlock.hitPoints.trim() || "1",
    speed: statBlock.speed.trim() || "30 ft.",
    proficiencyBonus: sanitizeOptionalText(statBlock.proficiencyBonus),
    challenge: sanitizeOptionalText(statBlock.challenge),
    senses: sanitizeOptionalText(statBlock.senses),
    languages: sanitizeOptionalText(statBlock.languages),
    savingThrows: sanitizeOptionalText(statBlock.savingThrows),
    skills: sanitizeOptionalText(statBlock.skills),
    resistances: sanitizeOptionalText(statBlock.resistances),
    immunities: sanitizeOptionalText(statBlock.immunities),
    conditionImmunities: sanitizeOptionalText(statBlock.conditionImmunities),
    abilityScores: {
      str: Number.isFinite(statBlock.abilityScores.str) ? statBlock.abilityScores.str : 10,
      dex: Number.isFinite(statBlock.abilityScores.dex) ? statBlock.abilityScores.dex : 10,
      con: Number.isFinite(statBlock.abilityScores.con) ? statBlock.abilityScores.con : 10,
      int: Number.isFinite(statBlock.abilityScores.int) ? statBlock.abilityScores.int : 10,
      wis: Number.isFinite(statBlock.abilityScores.wis) ? statBlock.abilityScores.wis : 10,
      cha: Number.isFinite(statBlock.abilityScores.cha) ? statBlock.abilityScores.cha : 10
    },
    traits: sanitizeStatEntries(statBlock.traits),
    actions: sanitizeStatEntries(statBlock.actions),
    bonusActions: sanitizeStatEntries(statBlock.bonusActions ?? []),
    reactions: sanitizeStatEntries(statBlock.reactions ?? []),
    spellcasting: sanitizeSpellcasting(statBlock.spellcasting)
  };
};

const serializeEntityForm = (form: CreateEntityInput): CreateEntityInput => {
  const playerCards = sanitizePlayerFacingCards(form.kind, form.playerCards ?? [], form.playerContent);
  const playerContent = playerCards.length ? playerCards[0].content : sanitizeOptionalText(form.playerContent);
  const preparedCombats = sanitizePreparedCombatPlans(form.preparedCombats ?? [], form.preparedCombat);
  const primaryPreparedCombat = preparedCombats[0];
  const common = {
    kind: form.kind,
    title: form.title.trim(),
    subtitle: form.subtitle.trim(),
    summary: form.summary.trim(),
    content: form.content.trim(),
    playerContent,
    playerCards,
    tags: sanitizeTags(form.tags ?? []),
    playlist: sanitizePlaylistTracks(form.playlist ?? []),
    gallery: sanitizeGalleryImages(form.gallery ?? []),
    related: form.related?.map((item) => ({ ...item })) ?? [],
    art:
      form.art && (form.art.url?.trim() || form.art.alt?.trim() || form.art.caption?.trim())
        ? {
            url: sanitizeOptionalText(form.art.url),
            alt: sanitizeOptionalText(form.art.alt),
            caption: sanitizeOptionalText(form.art.caption)
          }
        : undefined
  };

  switch (form.kind) {
    case "location":
      return {
        ...common,
        kind: "location",
        category: form.category as CreateEntityInput["category"],
        region: form.region?.trim() ?? "",
        danger: form.danger as CreateEntityInput["danger"],
        parentId: sanitizeOptionalText(form.parentId),
        preparedCombat: primaryPreparedCombat,
        preparedCombats
      };
    case "player":
      return {
        ...common,
        kind: "player",
        role: form.role?.trim() ?? "",
        status: form.status as CreateEntityInput["status"],
        level: sanitizePartyLevel(form.level),
        statBlock: sanitizeNpcStatBlock(form.statBlock ?? createEmptyNpcStatBlock())
      };
    case "npc":
    case "monster":
      return {
        ...common,
        kind: form.kind,
        role: form.role?.trim() ?? "",
        status: form.status as CreateEntityInput["status"],
        importance: form.importance as CreateEntityInput["importance"],
        locationId: sanitizeOptionalText(form.locationId),
        statBlock: sanitizeNpcStatBlock(form.statBlock ?? createEmptyNpcStatBlock()),
        rewardProfile: sanitizeMonsterRewardProfile(form.rewardProfile)
      };
    case "quest":
      return {
        ...common,
        kind: "quest",
        status: form.status as CreateEntityInput["status"],
        urgency: form.urgency as CreateEntityInput["urgency"],
        issuerId: sanitizeOptionalText(form.issuerId),
        locationId: sanitizeOptionalText(form.locationId),
        rewardProfile: sanitizeMonsterRewardProfile(form.rewardProfile),
        preparedCombat: primaryPreparedCombat,
        preparedCombats
      };
    case "lore":
      return {
        ...common,
        kind: "lore",
        category: form.category as CreateEntityInput["category"],
        visibility: form.visibility as CreateEntityInput["visibility"]
      };
    default:
      return common;
  }
};

const getModuleTitle = (campaign: CampaignData, moduleId: ModuleId) =>
  moduleId === "rules" ? "Правила" : campaign.modules.find((module) => module.id === moduleId)?.label ?? moduleId;

const railAliasTitle: Partial<Record<RailAlias, string>> = {
  items: "Предметы",
  events: "События",
  notes: "Заметки"
};

const railNavKeyFromView = (moduleId: ModuleId, alias: RailAlias | null): RailNavKey => {
  if (alias) {
    return alias;
  }
  if (moduleId === "lore") {
    return "notes";
  }
  if (moduleId === "combat") {
    return "dashboard";
  }
  return moduleId as Exclude<RailNavKey, RailAlias>;
};

const preserveRailAliasForModule = (current: RailAlias | null, moduleId: ModuleId) => {
  if (moduleId === "lore" && current === "notes") {
    return current;
  }
  return null;
};

const railSectionTitle = (campaign: CampaignData, moduleId: ModuleId, alias: RailAlias | null) =>
  alias ? railAliasTitle[alias] ?? alias : moduleId === "lore" ? railAliasTitle.notes ?? "Notes" : getModuleTitle(campaign, moduleId);

const formatDateTime = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    day: "2-digit",
    month: "2-digit"
  });
};

const copyTextToClipboard = async (value: string) => {
  const text = value.trim();
  if (!text) {
    throw new Error("Нечего копировать.");
  }

  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "true");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  textarea.style.pointerEvents = "none";
  document.body.appendChild(textarea);
  textarea.select();
  const copied = document.execCommand("copy");
  document.body.removeChild(textarea);
  if (!copied) {
    throw new Error("Браузер не дал скопировать ссылку.");
  }
};


function CombatWorkbench({
  campaign,
  activeCombat,
  entityMap,
  selectedEntry,
  selectedEntity,
  combatPortraitNotice,
  initiativePublishNotice,
  bootError,
  isCombatPlaylistActive,
  currentPlaybackTrackLabel,
  initiativeShareBusy,
  combatStateBusy,
  saving,
  combatPlayerEntityId,
  combatPlayerInitiative,
  onCombatPlayerEntityIdChange,
  onCombatPlayerInitiativeChange,
  onAddManualPlayer,
  onPlayCombatPlaylist,
  onPlayNextRandomTrack,
  onOpenCombatPlaylistModal,
  onOpenPublicTracker,
  onCopyPublicTracker,
  onSyncCombatPortraits,
  onOpenCombatSetupModal,
  onOpenRandomEventModal,
  onSelectEntry,
  onChangeHitPoints,
  onChangeInitiative,
  onSetTurn,
  onNextTurn,
  onDeclarePlayersVictory,
  onFinishCombat
}: {
  campaign: CampaignData;
  activeCombat: ActiveCombat;
  entityMap: Map<string, KnowledgeEntity>;
  selectedEntry: CombatEntry | null;
  selectedEntity: KnowledgeEntity | null;
  combatPortraitNotice: string;
  initiativePublishNotice: string;
  bootError: string;
  isCombatPlaylistActive: boolean;
  currentPlaybackTrackLabel: string;
  initiativeShareBusy: boolean;
  combatStateBusy: boolean;
  saving: boolean;
  combatPlayerEntityId: string;
  combatPlayerInitiative: number;
  onCombatPlayerEntityIdChange: (value: string) => void;
  onCombatPlayerInitiativeChange: (value: number) => void;
  onAddManualPlayer: () => void;
  onPlayCombatPlaylist: () => void;
  onPlayNextRandomTrack: () => void;
  onOpenCombatPlaylistModal: () => void;
  onOpenPublicTracker: () => void;
  onCopyPublicTracker: () => void;
  onSyncCombatPortraits: () => void;
  onOpenCombatSetupModal: () => void;
  onOpenRandomEventModal: () => void;
  onSelectEntry: (entryId: string) => void;
  onChangeHitPoints: (entry: CombatEntry, nextHp: number) => void;
  onChangeInitiative: (entry: CombatEntry, nextInitiative: number) => void;
  onSetTurn: (entryId: string) => void;
  onNextTurn: () => void;
  onDeclarePlayersVictory: () => void;
  onFinishCombat: () => void;
}) {
  const [rosterFilter, setRosterFilter] = useState<CombatRosterFilter>("all");
  const [checklistOverrides, setChecklistOverrides] = useState<Record<string, boolean>>({});
  const [clockNow, setClockNow] = useState(() => Date.now());
  const combatStartedAtRef = useRef<{ id: string; startedAt: number } | null>(null);
  const orderedEntries = useMemo(() => sortCombatEntriesByInitiative(activeCombat.entries), [activeCombat.entries]);
  const currentTurnEntry =
    (activeCombat.currentTurnEntryId ? orderedEntries.find((entry) => entry.id === activeCombat.currentTurnEntryId) ?? null : null) ??
    orderedEntries[0] ??
    null;
  const selectedEntryResolved = selectedEntry ?? orderedEntries[0] ?? null;
  const selectedEntityResolved =
    selectedEntryResolved && selectedEntryResolved.id === selectedEntry?.id
      ? selectedEntity
      : selectedEntryResolved
        ? entityMap.get(selectedEntryResolved.entityId) ?? null
        : null;
  const playerCount = activeCombat.entries.filter((entry) => entry.side === "player").length;
  const enemyCount = activeCombat.entries.filter((entry) => entry.side === "enemy").length;
  const livingEnemyCount = activeCombat.entries.filter((entry) => entry.side === "enemy" && !isCombatEntryOut(entry)).length;
  const defeatedCount = activeCombat.entries.filter((entry) => isCombatEntryOut(entry)).length;
  const revealEnemyRewards = enemyCount > 0 && livingEnemyCount === 0;
  const resolvedEnemyExperienceTotal = activeCombat.entries.reduce(
    (sum, entry) => sum + (entry.side === "enemy" && isCombatEntryOut(entry) ? entry.experience : 0),
    0
  );
  const currentTurnIndex = currentTurnEntry ? orderedEntries.findIndex((entry) => entry.id === currentTurnEntry.id) : -1;
  const turnProgressPercent = orderedEntries.length ? ((Math.max(currentTurnIndex, 0) + 1) / orderedEntries.length) * 100 : 0;
  const selectedCombatPlayer =
    combatPlayerEntityId && campaign.players.find((player) => player.id === combatPlayerEntityId) ? campaign.players.find((player) => player.id === combatPlayerEntityId) ?? null : null;
  const selectedCombatPlayerAlreadyInFight = Boolean(
    combatPlayerEntityId && activeCombat.entries.some((entry) => entry.entityId === combatPlayerEntityId && entry.side === "player")
  );
  const portraitsReady = activeCombat.entries.every((entry) => {
    const entity = entityMap.get(entry.entityId);
    return entity ? hasVisibleArt(entity.art) : false;
  });
  const actualExperiencePerPlayer = activeCombat.partySize
    ? Math.floor(resolvedEnemyExperienceTotal / Math.max(activeCombat.partySize, 1))
    : resolvedEnemyExperienceTotal;
  const sceneTags = Array.from(
    new Set(
      [
        activeCombat.difficulty ? combatDifficultyLabel[activeCombat.difficulty] : "",
        `Раунд ${Math.max(1, activeCombat.round || 1)}`,
        livingEnemyCount ? `${livingEnemyCount} врага в строю` : "Все враги выведены",
        ...(selectedEntityResolved?.tags ?? []).slice(0, 2)
      ].filter(Boolean)
    )
  ).slice(0, 4);
  const masterNotes = [
    currentTurnEntry ? `Сейчас темп сцены держит ${currentTurnEntry.title}.` : "",
    selectedEntryResolved?.summary ? truncateInlineText(selectedEntryResolved.summary, 148) : "",
    activeCombat.difficulty ? `Сложность: ${combatDifficultyLabel[activeCombat.difficulty]}.` : "",
    livingEnemyCount ? `На ногах осталось ${livingEnemyCount} противников.` : "Все противники уже выведены из сцены."
  ]
    .filter(Boolean)
    .slice(0, 4);
  const checklistItems = [
    { id: "portraits", label: "Портреты участников готовы", done: portraitsReady },
    { id: "public", label: "Публичная ссылка подготовлена", done: Boolean(initiativePublishNotice) },
    { id: "turn", label: "Текущий ход выбран", done: Boolean(currentTurnEntry) },
    { id: "pressure", label: "На сцене ещё есть активные враги", done: livingEnemyCount > 0 }
  ];
  const visibleRosterEntries = orderedEntries.filter((entry) => {
    if (rosterFilter === "players") {
      return entry.side === "player";
    }
    if (rosterFilter === "enemies") {
      return entry.side === "enemy";
    }
    return true;
  });

  useEffect(() => {
    if (combatStartedAtRef.current?.id !== activeCombat.id) {
      combatStartedAtRef.current = {
        id: activeCombat.id,
        startedAt: Date.now() - Math.max(activeCombat.round - 1, 0) * 45_000
      };
      setChecklistOverrides({});
    }
  }, [activeCombat.id, activeCombat.round]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    const timer = window.setInterval(() => {
      setClockNow(Date.now());
    }, 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, []);

  const combatDurationLabel = formatPlaybackTime(
    Math.max(0, (clockNow - (combatStartedAtRef.current?.startedAt ?? clockNow)) / 1000)
  );

  return (
    <div className="combat-studio">
      {(combatPortraitNotice || initiativePublishNotice || bootError) ? (
        <div className="combat-notice-grid">
          {combatPortraitNotice ? (
            <div className="card mini form-success" role="status">
              <strong>Портреты обновлены</strong>
              <p>{combatPortraitNotice}</p>
            </div>
          ) : null}
          {initiativePublishNotice ? (
            <div className="card mini form-success" role="status">
              <strong>Публичный трекер</strong>
              <p>{initiativePublishNotice}</p>
            </div>
          ) : null}
          {bootError ? (
            <div className="card mini form-error" role="status">
              <strong>Проблема в бою</strong>
              <p>{bootError}</p>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="combat-summary-grid">
        <section className="card combat-summary-card">
          <div className="row muted">
            <span>Общая боевая инициатива</span>
            <span>{orderedEntries.length} участников</span>
          </div>
          <strong>{currentTurnEntry ? `Следующий ход: ${currentTurnEntry.title}` : "Порядок готов"}</strong>
          <div className="combat-summary-progress">
            <span style={{ width: `${turnProgressPercent}%` }} />
          </div>
        </section>

        <section className="card combat-summary-card">
          <div className="row muted">
            <span>Плейлист треков</span>
            <span>{isCombatPlaylistActive ? "Играет" : "Готов"}</span>
          </div>
          <strong>{currentPlaybackTrackLabel || "Бой — Напряжение"}</strong>
          <div className="combat-summary-actions">
            <button className="ghost" disabled={!(campaign.combatPlaylist ?? []).length} onClick={onPlayCombatPlaylist} type="button">
              {isCombatPlaylistActive ? "Следующий трек" : "Запустить"}
            </button>
            <button className="ghost" disabled={!(campaign.combatPlaylist ?? []).length} onClick={onPlayNextRandomTrack} type="button">
              Рандом
            </button>
            <button className="ghost" onClick={onOpenCombatPlaylistModal} type="button">
              Плейлист
            </button>
          </div>
        </section>

        <section className="card combat-summary-card">
          <div className="row muted">
            <span>Условия сцены</span>
            <span>{sceneTags.length} метки</span>
          </div>
          <div className="combat-tag-list">
            {sceneTags.map((tag) => (
              <span key={`${activeCombat.id}-${tag}`} className="combat-tag-pill">
                {tag}
              </span>
            ))}
          </div>
        </section>

        <section className="card combat-summary-card">
          <div className="row muted">
            <span>Быстрые действия</span>
            <span>{initiativeShareBusy ? "Готовлю ссылку" : "На стол"}</span>
          </div>
          <div className="combat-summary-action-grid">
            <button className="ghost" disabled={saving} onClick={onSyncCombatPortraits} type="button">
              Подтянуть фотки
            </button>
            <button className="ghost" onClick={onOpenCombatSetupModal} type="button">
              Добавить врага
            </button>
            <button className="ghost" disabled={initiativeShareBusy} onClick={onOpenPublicTracker} type="button">
              {initiativeShareBusy ? "Готовлю..." : "Публичный трекер"}
            </button>
            <button className="ghost" disabled={initiativeShareBusy} onClick={onCopyPublicTracker} type="button">
              Копировать ссылку
            </button>
            <button className="ghost" onClick={onOpenRandomEventModal} type="button">
              Сцена для зачитки
            </button>
            <button className="ghost" disabled={combatStateBusy || saving} onClick={onDeclarePlayersVictory} type="button">
              Победа игроков
            </button>
            <button className="danger-action ghost" disabled={saving} onClick={onFinishCombat} type="button">
              Завершить бой
            </button>
          </div>
        </section>
      </div>

      <div className="combat-studio-grid">
        <aside className="card combat-roster-panel">
          <div className="row muted">
            <strong>Порядок инициативы</strong>
            <div className="combat-roster-filter">
              {combatRosterFilters.map((filter) => (
                <button
                  key={`${activeCombat.id}-${filter.id}`}
                  className={`combat-roster-filter-btn ${rosterFilter === filter.id ? "active" : ""}`}
                  onClick={() => setRosterFilter(filter.id)}
                  type="button"
                >
                  {filter.label}
                </button>
              ))}
            </div>
          </div>

          <div className="combat-roster-list">
            {visibleRosterEntries.map((entry) => (
              <CombatEntryTile
                key={`roster-${entry.id}`}
                currentTurn={currentTurnEntry?.id === entry.id}
                entry={entry}
                linkedEntity={entityMap.get(entry.entityId) ?? null}
                onSelect={() => onSelectEntry(entry.id)}
                revealEnemyMeta={revealEnemyRewards}
                selected={selectedEntryResolved?.id === entry.id}
              />
            ))}
          </div>

          <button className="ghost fill" onClick={onOpenCombatSetupModal} type="button">
            + Добавить участника
          </button>
        </aside>

        <section className="combat-stage-panel">
          {selectedEntryResolved ? (
            <CombatEntryCard
              busy={combatStateBusy}
              currentTurnEntryId={currentTurnEntry?.id}
              entry={selectedEntryResolved}
              linkedEntity={selectedEntityResolved}
              onChangeHitPoints={onChangeHitPoints}
              onChangeInitiative={onChangeInitiative}
              onNextTurn={onNextTurn}
              onSetCurrentTurn={onSetTurn}
              revealEnemyMeta={revealEnemyRewards}
            />
          ) : (
            <section className="card combat-focus-card">
              <p className="copy">Выбери участника слева, чтобы открыть его профиль боя.</p>
            </section>
          )}
        </section>

        <aside className="combat-side-panel">
          <section className="card mini combat-side-card">
            <div className="row muted">
              <strong>Детали боя</strong>
              <span>{currentTurnEntry ? `Ходит ${currentTurnEntry.title}` : "Без активного хода"}</span>
            </div>
            <div className="combat-side-detail-grid">
              <div className="combat-side-detail-row">
                <span>Тип боя</span>
                <strong>Боевой</strong>
              </div>
              <div className="combat-side-detail-row">
                <span>Сложность</span>
                <strong>
                  {revealEnemyRewards
                    ? activeCombat.difficulty
                      ? `${combatDifficultyLabel[activeCombat.difficulty]} (${activeCombat.actualAdjustedXp} XP)`
                      : `${activeCombat.actualAdjustedXp} XP`
                    : activeCombat.difficulty
                      ? combatDifficultyLabel[activeCombat.difficulty]
                      : "Откроется после финала"}
                </strong>
              </div>
              <div className="combat-side-detail-row">
                <span>Опыт за победу</span>
                <strong>{revealEnemyRewards ? `${actualExperiencePerPlayer} XP / игрока` : "Откроется после победы"}</strong>
              </div>
              <div className="combat-side-detail-row">
                <span>Раунд</span>
                <strong>{Math.max(1, activeCombat.round || 1)}</strong>
              </div>
              <div className="combat-side-detail-row">
                <span>Время боя</span>
                <strong>{combatDurationLabel}</strong>
              </div>
            </div>
          </section>

          <section className="card mini combat-side-card">
            <div className="row muted">
              <strong>Участники боя</strong>
              <span>
                {playerCount} игрока • {enemyCount} врага
              </span>
            </div>
            <div className="combat-side-participants-bar">
              <span className="players" style={{ width: `${(playerCount / Math.max(playerCount + enemyCount, 1)) * 100}%` }} />
              <span className="enemies" style={{ width: `${(enemyCount / Math.max(playerCount + enemyCount, 1)) * 100}%` }} />
            </div>
            <p className="copy">
              В строю: {playerCount - activeCombat.entries.filter((entry) => entry.side === "player" && entry.defeated).length} игроков • {livingEnemyCount} врагов
            </p>
          </section>

          <section className="card mini combat-side-card combat-player-panel">
            <div className="row muted">
              <strong>Добавить участника</strong>
              <span>Из вкладки Игроки</span>
            </div>
            <div className="combat-player-form">
              <label className="field">
                <span>Игрок</span>
                <select
                  className="input"
                  onChange={(event) => onCombatPlayerEntityIdChange(event.target.value)}
                  value={combatPlayerEntityId}
                >
                  <option value="">Выбери игрока</option>
                  {campaign.players.map((player) => {
                    const alreadyInFight = activeCombat.entries.some((entry) => entry.entityId === player.id && entry.side === "player");
                    return (
                      <option key={player.id} value={player.id}>
                        {alreadyInFight ? `${player.title} • уже в бою` : player.title}
                      </option>
                    );
                  })}
                </select>
              </label>
              <label className="field combat-start-initiative-field">
                <span>Init</span>
                <input
                  className="input"
                  onChange={(event) => onCombatPlayerInitiativeChange(Number.parseInt(event.target.value, 10) || 0)}
                  type="number"
                  value={combatPlayerInitiative}
                />
              </label>
            </div>
            {selectedCombatPlayer ? (
              <p className="copy">
                {selectedCombatPlayerAlreadyInFight
                  ? `${selectedCombatPlayer.title} уже участвует в текущем бою.`
                  : selectedCombatPlayer.summary || `${selectedCombatPlayer.title} можно сразу добавить в инициативу.`}
              </p>
            ) : null}
            <button
              className="ghost fill"
              disabled={saving || !combatPlayerEntityId || selectedCombatPlayerAlreadyInFight}
              onClick={onAddManualPlayer}
              type="button"
            >
              Добавить игрока
            </button>
          </section>

          <section className="card mini combat-side-card">
            <div className="row muted">
              <strong>Заметки для мастера</strong>
              <span>{defeatedCount} выведено</span>
            </div>
            <div className="combat-side-notes">
              {masterNotes.map((note, index) => (
                <p key={`${activeCombat.id}-note-${index}`}>{note}</p>
              ))}
            </div>
          </section>

          <section className="card mini combat-side-card">
            <div className="row muted">
              <strong>Чек-лист мастера</strong>
              <span>{checklistItems.filter((item) => checklistOverrides[item.id] ?? item.done).length}/{checklistItems.length}</span>
            </div>
            <div className="combat-side-checklist">
              {checklistItems.map((item) => {
                const checked = checklistOverrides[item.id] ?? item.done;
                return (
                  <label key={`${activeCombat.id}-${item.id}`} className={`combat-side-checklist-item ${checked ? "done" : ""}`}>
                    <input
                      checked={checked}
                      onChange={() =>
                        setChecklistOverrides((current) => ({
                          ...current,
                          [item.id]: !(current[item.id] ?? item.done)
                        }))
                      }
                      type="checkbox"
                    />
                    <span>{item.label}</span>
                  </label>
                );
              })}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}

export default function App() {
  const [appRoute, setAppRoute] = useState<AppRouteState>(() =>
    typeof window === "undefined" ? { mode: "app" } : parseAppRoute(window.location.hash)
  );
  const [authState, setAuthState] = useState<"checking" | "authenticated" | "unauthenticated">("checking");
  const [authUsername, setAuthUsername] = useState("");
  const [loginUsername, setLoginUsername] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [registerPasswordConfirm, setRegisterPasswordConfirm] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState("");
  const [campaigns, setCampaigns] = useState<CampaignSummary[]>([]);
  const [campaign, setCampaign] = useState<CampaignData | null>(null);
  const [activeCampaignId, setActiveCampaignId] = useState("");
  const [activeModule, setActiveModule] = useState<ModuleId>("dashboard");
  const [activeRailAlias, setActiveRailAlias] = useState<RailAlias | null>(null);
  const [activeTab, setActiveTab] = useState("Snapshot");
  const [activeEntityId, setActiveEntityId] = useState("");
  const [previewEntityId, setPreviewEntityId] = useState("");
  const [focusedShopId, setFocusedShopId] = useState("");
  const [pinnedIds, setPinnedIds] = useState<string[]>([]);
  const [combatPlaylistModalOpen, setCombatPlaylistModalOpen] = useState(false);
  const [entityCombatSetupState, setEntityCombatSetupState] = useState<EntityCombatSetupState | null>(null);
  const [preparedCombatModalOpen, setPreparedCombatModalOpen] = useState(false);
  const [combatPlaylistDraft, setCombatPlaylistDraft] = useState<PlaylistTrack[]>([]);
  const [galleryViewer, setGalleryViewer] = useState<GalleryViewerState | null>(null);
  const [activePlayback, setActivePlayback] = useState<ActivePlaylistPlayback | null>(null);
  const [selectedWorldEventId, setSelectedWorldEventId] = useState("");
  const [rulesNavigationState, setRulesNavigationState] = useState({
    query: "",
    requestId: 0,
    ruleId: ""
  });
  const [bootError, setBootError] = useState("");
  const [booting, setBooting] = useState(true);
  const [saving, setSaving] = useState(false);
  const [initiativeShareBusy, setInitiativeShareBusy] = useState(false);
  const [playerDisplayBusy, setPlayerDisplayBusy] = useState(false);
  const [combatStateBusy, setCombatStateBusy] = useState(false);
  const [initiativePublishNotice, setInitiativePublishNotice] = useState("");
  const [generating, setGenerating] = useState(false);
  const [combatTitle, setCombatTitle] = useState("Активный бой");
  const [combatPartySize, setCombatPartySize] = useState(4);
  const [combatPartyLevelsText, setCombatPartyLevelsText] = useState("");
  const [combatThresholds, setCombatThresholds] = useState<CombatThresholds>(createDefaultCombatThresholds);
  const [combatPlayerSearchQuery, setCombatPlayerSearchQuery] = useState("");
  const [combatAllySearchQuery, setCombatAllySearchQuery] = useState("");
  const [combatPrompt, setCombatPrompt] = useState("");
  const [combatMonsterCount, setCombatMonsterCount] = useState(1);
  const [combatDifficulty, setCombatDifficulty] = useState<CombatDifficulty>("medium");
  const [combatCustomAdjustedXp, setCombatCustomAdjustedXp] = useState(0);
  const [selectedCombatEntryKey, setSelectedCombatEntryKey] = useState("");
  const [combatSetupOpen, setCombatSetupOpen] = useState(false);
  const [combatPlayerManagerOpen, setCombatPlayerManagerOpen] = useState(true);
  const [combatEnemyCatalogOpen, setCombatEnemyCatalogOpen] = useState(true);
  const [combatDifficultyDetailsOpen, setCombatDifficultyDetailsOpen] = useState(true);
  const [combatPlayerEntityId, setCombatPlayerEntityId] = useState("");
  const [combatPlayerInitiative, setCombatPlayerInitiative] = useState(0);
  const [combatPortraitNotice, setCombatPortraitNotice] = useState("");
  const [combatReport, setCombatReport] = useState<FinishCombatResult | null>(null);
  const [moduleEntitySearch, setModuleEntitySearch] = useState("");
  const [railWidth, setRailWidth] = useState(220);
  const [listWidth, setListWidth] = useState(284);
  const [previewWidth, setPreviewWidth] = useState(330);
  const deferredCombatPlayerSearchQuery = useDeferredValue(combatPlayerSearchQuery);
  const deferredCombatAllySearchQuery = useDeferredValue(combatAllySearchQuery);
  const contentRef = useRef<HTMLElement | null>(null);
  const resizeRef = useRef<{ key: ResizeKey; startX: number; startWidth: number } | null>(null);
  const lastAppViewRef = useRef<{ module: ModuleId; tab: string }>({ module: "dashboard", tab: "Snapshot" });
  const combatPatchQueueRef = useRef(new Map<string, Promise<void>>());
  const allEntities = useMemo(
    () => (campaign ? [...campaign.locations, ...campaign.players, ...campaign.npcs, ...campaign.monsters, ...campaign.quests, ...campaign.lore] : []),
    [campaign]
  );
  const entityMap = useMemo(() => new Map(allEntities.map((entity) => [entity.id, entity])), [allEntities]);
  const defaultCreateKind: EntityKind =
      activeModule === "locations"
      ? "location"
      : activeModule === "players"
        ? "player"
      : activeModule === "npcs"
        ? "npc"
        : activeModule === "monsters" || activeModule === "combat"
          ? "monster"
        : activeModule === "quests"
          ? "quest"
        : activeModule === "lore"
          ? "lore"
          : "location";

  const entityEditor = useEntityEditorController({
    activeCampaignId,
    applyCreatedEntity: (result) => applyCreatedEntity(result),
    defaultCreateKind,
    entityMap,
    entityToForm,
    onEntityDeleted: (result) => {
      setPinnedIds((current) => current.filter((id) => id !== result.entityId));
      hydrateCampaign(result.campaign);
      setActiveModule(moduleByKind[result.kind]);
    },
    persistEntityPayload: (args) => persistEntityPayload(args),
    resetEntityLinkState: () => entityLinkController.resetEntityLinkState(),
    serializeEntityForm,
    setBootError,
    setGenerating,
    setSaving,
    uploadCampaignImage: (file) => uploadCampaignImage(file)
  });

  const entityMedia = useEntityMediaController({
    activeCampaignId,
    entityMap,
    entityToForm,
    galleryUploadKey: entityEditor.galleryUploadKey,
    hydrateCampaign,
    sanitizeGalleryImages,
    sanitizePlaylistTracks,
    serializeEntityForm,
    setBootError,
    setGalleryUploadKey: entityEditor.setGalleryUploadKey,
    setSaving,
    uploadCampaignImage: (file) => uploadCampaignImage(file)
  });

  const campaignCreation = useCampaignCreationController({
    onCampaignCreated: (nextCampaign) => hydrateCampaign(nextCampaign),
    setBootError,
    setCampaigns,
    setSaving
  });

  const globalSearchController = useGlobalSearchController({
    activeCampaignId,
    campaign,
    entityMap,
    pinnedIds
  });

  const entityLinkController = useEntityLinkController({
    activeCampaignId,
    allEntities,
    editingEntityId: entityEditor.editingEntityId,
    entityContentRef: entityEditor.entityContentRef,
    entityForm: entityEditor.entityForm,
    entityMap,
    entityPlayerContentRef: entityEditor.entityPlayerContentRef,
    entityToForm,
    onApplyCreatedEntity: (result) => applyCreatedEntity(result),
    onCloseEntityActionMenu: () => entityActionsController.closeEntityActionMenu(),
    onSerializeEntityForm: serializeEntityForm,
    onSetBootError: setBootError,
    onSetEntityForm: entityEditor.setEntityForm,
    onSetPreviewEntityId: setPreviewEntityId,
    onSetSaving: setSaving
  });

  const modalController = useModalController({
    closeCombatPlaylistModal: () => closeCombatPlaylistModal(),
    closeCombatSetupModal: () => closeCombatSetupModal(),
    closeEntityGalleryModal: () => entityMedia.closeEntityGalleryModal(),
    closeEntityLinkModal: () => entityLinkController.closeEntityLinkModal(),
    closeEntityModal: () => entityEditor.closeEntityModal(),
    closeEntityPlaylistModal: () => entityMedia.closeEntityPlaylistModal(),
    closeGalleryViewer: () => closeGalleryViewer(),
    closePlayerFacingView: () => playerFacing.closePlayerFacingView(),
    closePreparedCombatModal: () => closePreparedCombatModal(),
    closeRandomEventModal: () => closeRandomEventModal(),
    openEntityModal: (kind) => entityEditor.openEntityModal(kind),
    setCampaignModalOpen: (value) => campaignCreation.setCampaignModalOpen(value),
    setPaletteOpen: (value) => globalSearchController.setPaletteOpen(value)
  });

  const playerFacing = usePlayerFacingCards({
    activeCampaignId,
    entityMap,
    entityToForm,
    hydrateCampaign: (nextCampaign, focusEntityId) => hydrateCampaign(nextCampaign, focusEntityId),
    requestModalClose: modalController.requestModalClose,
    serializeEntityForm,
    setBootError,
    setSaving,
    setPreviewEntityId
  });

  async function handleBestiaryImportSuccess(monsterId: string) {
    if (!activeCampaignId) {
      return;
    }

    const result = await api.importBestiaryMonster(activeCampaignId, monsterId);
    applyCreatedEntity(result);
    setPreviewEntityId(result.entity.id);
  }

  const bestiaryController = useBestiaryController({
    activeCampaignId,
    activeModule,
    activeTab,
    campaignMonsters: campaign?.monsters ?? [],
    onImportSuccess: handleBestiaryImportSuccess,
    setBootError
  });

  const {
    cancelModalCloseRequest,
    closeConfirmState,
    confirmModalCloseRequest,
    requestCampaignModalClose,
    requestCombatPlaylistModalClose,
    requestCombatSetupModalClose,
    requestCombatSetupSwapToEntity,
    requestEntityGalleryModalClose,
    requestEntityLinkModalClose,
    requestEntityModalClose,
    requestEntityPlaylistModalClose,
    requestGalleryViewerClose,
    requestModalClose,
    requestPaletteClose,
    requestPlayerFacingViewClose,
    requestPreparedCombatModalClose,
    requestRandomEventModalClose
  } = modalController;

  const {
    addEntityGalleryItem,
    addEntityPlayerCard,
    addEntityPlaylistTrack,
    addMonsterLootEntry,
    addNpcStatEntry,
    addSpellSlot,
    autoFormatEntityPlayerCard,
    clearEntityPlayerCardHtml,
    closeEntityModal,
    deleteEntity,
    draftNotes,
    draftPrompt,
    editingEntityId,
    entityArtUploading,
    entityContentRef,
    entityForm,
    entityFormImageUploading,
    entityModalDescription,
    entityModalMode,
    entityModalOpen,
    entityModalSourceNpcId,
    entityModalTitle,
    entityPlayerContentRef,
    entitySubmitLabel,
    galleryUploadKey,
    generateDraft,
    generatedQuestIssuerDraft,
    generatedQuestIssuerNote,
    handleEntityPlayerCardHtmlImport,
    isEditingEntity,
    openEntityEditor,
    openEntityModal,
    openEntityPlayerCardHtmlImport,
    openNpcQuestModal,
    pasteEntityPlayerCardHtmlFromClipboard,
    playerCardFormattingIndex,
    playerCardImportInputRefs,
    removeEntityGalleryItem,
    removeEntityPlayerCard,
    removeEntityPlaylistTrack,
    removeMonsterLootEntry,
    removeNpcStatEntry,
    removeSpellSlot,
    setDraftPrompt,
    setEntityForm,
    setGalleryUploadKey,
    setGeneratedQuestIssuerDraft,
    setGeneratedQuestIssuerNote,
    setSpellcastingEnabled,
    submitEntity,
    updateEntityForm,
    updateEntityGalleryItem,
    updateEntityPlayerCard,
    updateEntityPlaylistTrack,
    updateEntityRewardProfile,
    updateMonsterLootEntry,
    updateNpcAbilityScore,
    updateNpcSpellcasting,
    updateNpcStatBlock,
    updateNpcStatEntry,
    updateSpellSlot,
    uploadEntityArtFile,
    uploadEntityGalleryFile
  } = entityEditor;

  const {
    addProjectImagesToEntityGalleryDraft,
    addEntityGalleryDraftItem,
    addEntityPlaylistDraftTrack,
    closeEntityGalleryModal,
    closeEntityPlaylistModal,
    entityGalleryDraft,
    entityGalleryModalOpen,
    entityGalleryModalUploading,
    entityGalleryTarget,
    projectGalleryImages,
    entityPlaylistDraft,
    entityPlaylistModalOpen,
    entityPlaylistTarget,
    openEntityGalleryModal,
    openEntityPlaylistModal,
    removeEntityGalleryDraftItem,
    removeEntityPlaylistDraftTrack,
    saveEntityGallery,
    saveEntityPlaylist,
    updateEntityGalleryDraftItem,
    updateEntityPlaylistDraftTrack,
    uploadEntityGalleryDraftFile
  } = entityMedia;

  const {
    closePlayerFacingView,
    openNewPlayerFacingEditor,
    openPlayerFacingEditor,
    openPlayerFacingView,
    playerFacingView,
    requestPlayerFacingCardDeletion,
  } = playerFacing;

  function hydrateCampaign(data: CampaignData, preferredEntityId?: string) {
    const normalized = normalizeCampaignForClient(data);
    const allEntities = [...normalized.locations, ...normalized.players, ...normalized.npcs, ...normalized.monsters, ...normalized.quests, ...normalized.lore];
    const preparedPartySize =
      (normalized.preparedCombat?.playerIds?.length ?? 0) + countPreparedCombatItems(normalized.preparedCombat?.allies ?? []);
    const preferredId =
      preferredEntityId && allEntities.some((entity) => entity.id === preferredEntityId) ? preferredEntityId : undefined;
    const currentActiveId = activeEntityId && allEntities.some((entity) => entity.id === activeEntityId) ? activeEntityId : "";
    const currentPreviewId =
      previewEntityId && allEntities.some((entity) => entity.id === previewEntityId) ? previewEntityId : "";
    const currentCombatEntryKey =
      selectedCombatEntryKey &&
      normalized.activeCombat?.entries.some(
        (entry, index) => combatEntrySelectionKey(entry, index) === selectedCombatEntryKey
      )
        ? selectedCombatEntryKey
        : "";

    setCampaign(normalized);
    setActiveCampaignId(normalized.id);
    setActiveEntityId(preferredId ?? currentActiveId ?? "");
    setPreviewEntityId(preferredId ?? currentPreviewId ?? "");
    setCombatTitle(normalized.activeCombat?.title ?? normalized.preparedCombat?.title ?? "Активный бой");
    setCombatPartySize(normalized.activeCombat?.partySize ?? (preparedPartySize > 0 ? preparedPartySize : 4));
    setCombatThresholds(normalized.activeCombat?.thresholds ?? createDefaultCombatThresholds());
    setCombatCustomAdjustedXp(normalized.activeCombat?.targetAdjustedXp ?? 0);
    replaceCampaignPreparedCombatDraft(cloneCampaignPreparedCombat(normalized.preparedCombat));
    if (!combatSetupOpen) {
      setCombatPartyLevelsText("");
    }
    setCombatPlayerEntityId((current) =>
      current && normalized.players.some((player) => player.id === current) ? current : normalized.players[0]?.id ?? ""
    );
    setSelectedCombatEntryKey(
      currentCombatEntryKey ||
        (normalized.activeCombat?.entries[0] ? combatEntrySelectionKey(normalized.activeCombat.entries[0], 0) : "")
    );
  }

  const loadCampaign = async (campaignId: string) => {
    const data = await api.getCampaign(campaignId);
    hydrateCampaign(data);
    return data;
  };

  const resetCampaignState = () => {
    setCampaigns([]);
    setCampaign(null);
    setActiveCampaignId("");
    setActiveEntityId("");
    setPreviewEntityId("");
    setSelectedWorldEventId("");
    setPinnedIds([]);
    resetPalette();
    setBootError("");
  };

  const isUnauthorizedError = (error: unknown) =>
    typeof error === "object" && error !== null && "status" in error && (error as { status?: number }).status === 401;

  const handleProtectedActionError = (error: unknown, fallbackMessage: string) => {
    if (isUnauthorizedError(error)) {
      setAuthError("Сессия истекла или вход не подтверждён. Войди снова.");
      setAuthError("Сессия истекла или вход не подтвержден. Войди снова.");
      setAuthState("unauthenticated");
      setAuthUsername("");
      setLoginPassword("");
      setRegisterPasswordConfirm("");
      setBooting(false);
      resetCampaignState();
      return;
    }

    setBootError(error instanceof Error ? error.message : fallbackMessage);
  };

  const applyAuthSession = (session: AuthSessionResult) => {
    if (session.authenticated) {
      setAuthState("authenticated");
      setAuthUsername(session.username ?? loginUsername.trim());
      setAuthError("");
      return;
    }

    setAuthState("unauthenticated");
    setAuthUsername("");
    setLoginPassword("");
    setRegisterPasswordConfirm("");
    resetCampaignState();
  };

  const submitAuth = async (event: FormEvent<HTMLFormElement>, mode: "login" | "register") => {
    event.preventDefault();

    if (mode === "register" && loginPassword !== registerPasswordConfirm) {
      setAuthError("Пароли не совпадают.");
      return;
    }

    try {
      setAuthBusy(true);
      setAuthError("");
      setBooting(true);
      const credentials = {
        username: loginUsername.trim(),
        password: loginPassword
      };
      const session = mode === "register" ? await api.register(credentials) : await api.login(credentials);
      applyAuthSession(session);
      setLoginPassword("");
      setRegisterPasswordConfirm("");
    } catch (error) {
      setAuthState("unauthenticated");
      setBooting(false);
      setAuthError(error instanceof Error ? error.message : mode === "register" ? "Не удалось зарегистрироваться." : "Не удалось выполнить вход.");
    } finally {
      setAuthBusy(false);
    }
  };

  const logout = async () => {
    try {
      setAuthBusy(true);
      await api.logout();
    } catch {
      // Even if the backend is already gone, we still clear the local shell state.
    } finally {
      setAuthBusy(false);
      setAuthState("unauthenticated");
      setAuthUsername("");
      setLoginPassword("");
      setRegisterPasswordConfirm("");
      resetCampaignState();
      setBooting(false);
    }
  };

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    const handleHashChange = () => setAppRoute(parseAppRoute(window.location.hash));
    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  useEffect(() => {
    let cancelled = false;

    const checkSession = async () => {
      try {
        const session = await api.getSession();
        if (cancelled) {
          return;
        }
        applyAuthSession(session);
      } catch (error) {
        if (cancelled) {
          return;
        }
        setAuthState("unauthenticated");
        setAuthUsername("");
        setBooting(false);
        setAuthError(error instanceof Error ? error.message : "Не удалось связаться с backend.");
      }
    };

    void checkSession();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (authState !== "authenticated") {
      return;
    }

    let cancelled = false;

    const keepSessionAlive = async () => {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") {
        return;
      }

      try {
        const session = await api.getSession();
        if (cancelled || !session.authenticated) {
          return;
        }
        applyAuthSession(session);
      } catch {
        // Ignore transient heartbeat failures. Real protected actions still report auth issues.
      }
    };

    const intervalId = window.setInterval(() => {
      void keepSessionAlive();
    }, 2 * 60 * 1000);

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void keepSessionAlive();
      }
    };

    const handleWindowFocus = () => {
      void keepSessionAlive();
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("focus", handleWindowFocus);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", handleWindowFocus);
    };
  }, [authState]);

  useEffect(() => {
    if (authState !== "authenticated") {
      if (authState === "unauthenticated") {
        setBooting(false);
      }
      return;
    }

    let cancelled = false;

    const boot = async () => {
      setBooting(true);
      setBootError("");

      try {
        const list = await api.listCampaigns();
        if (cancelled) return;

        setCampaigns(list);
        if (!list.length) {
          setCampaign(null);
          setActiveCampaignId("");
          return;
        }

        const initialId =
          appRoute.mode === "initiative" && list.some((item) => item.id === appRoute.campaignId) ? appRoute.campaignId : list[0].id;
        const data = await api.getCampaign(initialId);
        if (cancelled) return;

        hydrateCampaign(data);
      } catch (error) {
        if (cancelled) return;
        setBootError(error instanceof Error ? error.message : "Не удалось подключиться к backend.");
      } finally {
        if (!cancelled) {
          setBooting(false);
        }
      }
    };

    void boot();

    return () => {
      cancelled = true;
    };
  }, [appRoute, authState]);

  useEffect(() => {
    if (authState !== "authenticated") {
      return undefined;
    }

    if (appRoute.mode !== "initiative" || !appRoute.campaignId) {
      return undefined;
    }

    if (activeCampaignId && activeCampaignId !== appRoute.campaignId) {
      void loadCampaign(appRoute.campaignId).catch(() => {
        // bootError is handled by polling / boot flow
      });
    }

    const timer = window.setInterval(() => {
      api
        .getCampaign(appRoute.campaignId)
        .then((data) => hydrateCampaign(data))
        .catch((error) => {
          setBootError(error instanceof Error ? error.message : "Не удалось обновить трекер инициативы.");
        });
    }, 2500);

    return () => window.clearInterval(timer);
  }, [activeCampaignId, appRoute]);

  const campaignPreparedCombat = campaign?.preparedCombat ?? null;
  const entityByTitle = useMemo(() => new Map(allEntities.map((entity) => [entity.title, entity])), [allEntities]);
  const entityByTitleKey = useMemo(
    () =>
      new Map(
        allEntities
          .map((entity) => [entity.title.trim().toLowerCase(), entity] as const)
          .filter(([title]) => Boolean(title))
      ),
    [allEntities]
  );
  const scopedEntities = useMemo(
    () => filterEntities(campaign, activeModule, activeTab),
    [activeModule, activeTab, campaign]
  );
  const moduleDirectoryEntities = useMemo(
    () => scopedEntities.filter((entity) => matchesEntityDirectorySearch(entity, moduleEntitySearch)),
    [moduleEntitySearch, scopedEntities]
  );
  const visibleModuleEntities =
    activeModule === "monsters" && activeTab === "Импорт" ? bestiaryController.filteredImportedMonsters : scopedEntities;

  useEffect(() => {
    if (!campaign || activeModule === "dashboard" || activeModule === "combat" || isBestiaryBrowseTab(activeModule, activeTab)) {
      return;
    }

    if (activeEntityId && !visibleModuleEntities.some((entity) => entity.id === activeEntityId)) {
      setActiveEntityId("");
    }
  }, [activeEntityId, activeModule, activeTab, campaign, visibleModuleEntities]);

  useEffect(() => {
    if (activeModule !== "combat") {
      lastAppViewRef.current = { module: activeModule, tab: activeTab };
    }
  }, [activeModule, activeTab]);

  useEffect(() => {
    if (combatSetupOpen) {
      setBootError("");
    }
  }, [combatSetupOpen]);

  useEffect(() => {
    if (!campaign?.activeCombat?.entries.length) {
      if (selectedCombatEntryKey) {
        setSelectedCombatEntryKey("");
      }
      return;
    }

    if (
      !campaign.activeCombat.entries.some(
        (entry, index) => combatEntrySelectionKey(entry, index) === selectedCombatEntryKey
      )
    ) {
      setSelectedCombatEntryKey(
        campaign.activeCombat.entries[0] ? combatEntrySelectionKey(campaign.activeCombat.entries[0], 0) : ""
      );
    }
  }, [campaign, selectedCombatEntryKey]);

  useEffect(() => {
    if (!activePlayback) {
      return;
    }

    const currentTrackUrl = activePlayback.tracks[activePlayback.currentIndex]?.url ?? "";

    if (activePlayback.scope === "combat") {
      if (!campaign || activePlayback.ownerId !== campaign.id) {
        setActivePlayback(null);
        return;
      }

      const tracks = sanitizePlaylistTracks(campaign.combatPlaylist ?? []);
      if (!tracks.length) {
        setActivePlayback(null);
        return;
      }

      const nextIndex = tracks.findIndex((track) => track.url === currentTrackUrl);
      if (nextIndex === activePlayback.currentIndex && tracks.length === activePlayback.tracks.length) {
        return;
      }

      setActivePlayback((current) =>
        current
          ? {
              ...current,
              ownerTitle: `${campaign.title} • Боевой плейлист`,
              tracks,
              currentIndex: nextIndex >= 0 ? nextIndex : 0
            }
          : current
      );
      return;
    }

    const owner = entityMap.get(activePlayback.ownerId);
    if (!owner) {
      setActivePlayback(null);
      return;
    }

    const tracks = sanitizePlaylistTracks(owner.playlist ?? []);
    if (!tracks.length) {
      setActivePlayback(null);
      return;
    }

    const nextIndex = tracks.findIndex((track) => track.url === currentTrackUrl);
    if (
      owner.title === activePlayback.ownerTitle &&
      nextIndex === activePlayback.currentIndex &&
      tracks.length === activePlayback.tracks.length
    ) {
      return;
    }

    setActivePlayback((current) =>
      current
        ? {
            ...current,
            ownerTitle: owner.title,
            tracks,
            currentIndex: nextIndex >= 0 ? nextIndex : 0
          }
        : current
    );
  }, [activePlayback, campaign, entityMap]);

  useEffect(() => {
    const onPointerMove = (event: PointerEvent) => {
      const resize = resizeRef.current;
      if (!resize) {
        return;
      }

      const delta = event.clientX - resize.startX;

      if (resize.key === "rail") {
        setRailWidth(clamp(resize.startWidth + delta, 220, 420));
      }

      if (resize.key === "list") {
        setListWidth(clamp(resize.startWidth + delta, 240, 480));
      }

      if (resize.key === "preview") {
        setPreviewWidth(clamp(resize.startWidth - delta, 280, 560));
      }
    };

    const stopResize = () => {
      if (!resizeRef.current) {
        return;
      }

      resizeRef.current = null;
      document.body.style.removeProperty("cursor");
      document.body.style.removeProperty("user-select");
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", stopResize);

    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", stopResize);
    };
  }, []);

  const shellStyle = useMemo(
    () =>
      ({
        "--rail-width": `${railWidth}px`,
        "--list-width": `${listWidth}px`,
        "--preview-width": `${previewWidth}px`
      }) as CSSProperties,
    [listWidth, previewWidth, railWidth]
  );

  const activeEntity =
    activeModule === "dashboard" || activeModule === "combat" || isBestiaryBrowseTab(activeModule, activeTab)
      ? null
      : entityMap.get(activeEntityId) ?? null;
  const activeWorldEvent =
    campaign && selectedWorldEventId && selectedWorldEventId !== NEW_WORLD_EVENT_ID
      ? campaign.events.find((event) => event.id === selectedWorldEventId) ?? null
      : null;
  const activeNpcQuests = useMemo(
    () =>
      activeEntity?.kind === "npc"
        ? campaign?.quests.filter(
            (quest) => quest.issuerId === activeEntity.id || quest.related.some((item) => item.id === activeEntity.id)
          ) ?? []
        : [],
    [activeEntity, campaign?.quests]
  );
  const previewEntity = entityMap.get(previewEntityId) ?? null;
  const randomEventController = useRandomEventController({
    activeCampaignId,
    activeEntity,
    campaign,
    entityToForm,
    onHydrateCampaign: (nextCampaign, preferredEntityId) => hydrateCampaign(nextCampaign, preferredEntityId),
    serializeEntityForm,
    setActiveEntityId,
    setActiveModule,
    setActiveRailAlias: (value) => setActiveRailAlias(value),
    setActiveTab,
    setBootError,
    setPreviewEntityId,
    setSelectedWorldEventId
  });

  const entityCombatSetupTarget =
    entityCombatSetupState?.entityId && entityMap.has(entityCombatSetupState.entityId)
      ? entityMap.get(entityCombatSetupState.entityId) ?? null
      : null;
  const currentPlaybackTrack = activePlayback ? activePlayback.tracks[activePlayback.currentIndex] ?? null : null;
  const currentPlaybackTrackUrl = currentPlaybackTrack?.url ?? "";
  const currentPlaybackTrackLabel =
    currentPlaybackTrack && activePlayback
      ? playlistTrackTitle(currentPlaybackTrack, activePlayback.currentIndex)
      : "";
  const currentPlaybackSource = useMemo(
    () => (currentPlaybackTrack ? resolvePlaylistSource(currentPlaybackTrack.url) : null),
    [currentPlaybackTrack?.url]
  );
  const isEntityPlaylistActive = (entityId?: string) =>
    Boolean(entityId && activePlayback?.scope === "entity" && activePlayback.ownerId === entityId);
  const isCombatPlaylistActive = Boolean(campaign && activePlayback?.scope === "combat" && activePlayback.ownerId === campaign.id);
  const resolveLinkedEntity = (item: Pick<RelatedEntity, "id" | "label">) => {
    const id = item.id.trim();
    if (id && entityMap.has(id)) {
      return entityMap.get(id) ?? null;
    }

    const labelKey = item.label.trim().toLowerCase();
    if (labelKey) {
      return entityByTitleKey.get(labelKey) ?? null;
    }

    return null;
  };
  const combatRoster = useMemo(
    () => (campaign ? [...campaign.monsters, ...campaign.npcs].filter(isCombatProfileEntity) : []),
    [campaign]
  );
  const activeCombat = campaign?.activeCombat ?? null;
  const {
    combatBestiaryLoading,
    combatEnemyTypeFilter,
    combatEnemyTypeOptions,
    combatSearchChallenge,
    combatSearchItems,
    combatSearchQuery,
    combatSelectedBestiaryMonster,
    combatSelectionId,
    combatSelectionInitiative,
    combatSelectionQuantity,
    filteredCombatCatalogItems,
    preparedCombatBestiaryLoading,
    preparedCombatChallenge,
    preparedCombatQuantity,
    preparedCombatSearchItems,
    preparedCombatSearchQuery,
    preparedCombatSelectionId,
    resetCombatEnemySearch,
    resetPreparedCombatEnemySearch,
    selectCombatEntity,
    selectPreparedCombatEntity,
    selectedCombatSearchItem,
    selectedCombatSearchProfile,
    selectedPreparedCombatSearchItem,
    setCombatEnemyTypeFilter,
    setCombatSearchChallenge,
    setCombatSearchQuery,
    setCombatSelectionId,
    setCombatSelectionInitiative,
    setCombatSelectionQuantity,
    setPreparedCombatChallenge,
    setPreparedCombatQuantity,
    setPreparedCombatSearchQuery,
    setPreparedCombatSelectionId
  } = useCombatEnemySearch({
    combatRoster,
    combatSetupOpen,
    hasActiveCombatEntries: Boolean(activeCombat?.entries.length),
    preparedCombatModalOpen,
    setBootError
  });
  const combatDraftController = useCombatDraftController({
    activeCampaignId,
    campaignTitle: campaign?.title ?? "",
    combatSelectionQuantity,
    entityMap,
    hydrateCampaign,
    onSelectCombatEntity: selectCombatEntity,
    selectedCombatSearchItem,
    setBootError,
    setPreviewEntityId,
    setSaving
  });
  const configuredCombatPlayers = useMemo(
    () =>
      (campaignPreparedCombat?.playerIds ?? [])
        .map((playerId) => {
          const entity = entityMap.get(playerId);
          return entity?.kind === "player" ? entity : null;
        })
        .filter((entity): entity is PlayerEntity => Boolean(entity)),
    [campaignPreparedCombat?.playerIds, entityMap]
  );
  const configuredCombatAllies = useMemo(
    () => resolvePreparedCombatAllies(entityMap, campaignPreparedCombat),
    [campaignPreparedCombat?.allies, entityMap]
  );
  const configuredCombatAllyIds = useMemo(
    () => new Set((campaignPreparedCombat?.allies ?? []).map((item) => item.entityId)),
    [campaignPreparedCombat?.allies]
  );
  const configuredCombatEnemies = useMemo(
    () =>
      (campaignPreparedCombat?.items ?? [])
        .map((item) => {
          if (configuredCombatAllyIds.has(item.entityId)) {
            return null;
          }
          const entity = entityMap.get(item.entityId);
          return entity && (entity.kind === "npc" || entity.kind === "monster")
            ? {
                entity,
                quantity: Math.max(1, item.quantity)
              }
            : null;
        })
        .filter((item): item is { entity: NpcEntity | MonsterEntity; quantity: number } => Boolean(item)),
    [campaignPreparedCombat?.items, configuredCombatAllyIds, entityMap]
  );
  const configuredCombatAllyCount = countPreparedCombatItems(campaignPreparedCombat?.allies ?? []);
  const configuredCombatEnemyCount = configuredCombatEnemies.reduce((sum, item) => sum + item.quantity, 0);
  const hasConfiguredCombat = configuredCombatPlayers.length > 0 || configuredCombatAllyCount > 0 || configuredCombatEnemies.length > 0;
  const canStartConfiguredCombat = configuredCombatPlayers.length > 0 && configuredCombatEnemyCount > 0;
  const {
    addCampaignPreparedCombatDraftItem,
    campaignPreparedCombatDraft,
    campaignPreparedCombatDraftEnemyCount,
    campaignPreparedCombatNotice,
    canStartPreparedCombatDraft,
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
  } = combatDraftController;
  const combatPlayerCatalogItems = useMemo(
    () =>
      (campaign?.players ?? []).filter((player) =>
        [player.title, player.subtitle, player.summary, player.role ?? "", player.tags.join(" ")]
          .join(" ")
          .toLowerCase()
          .includes(deferredCombatPlayerSearchQuery.trim().toLowerCase())
      ),
    [campaign?.players, deferredCombatPlayerSearchQuery]
  );
  const combatAllyCatalogItems = useMemo(
    () =>
      (campaign ? [...campaign.monsters, ...campaign.npcs].filter(isCombatProfileEntity) : []).filter((entity) =>
        [entity.title, entity.subtitle, entity.summary, entity.role ?? "", entity.tags.join(" "), entity.statBlock?.creatureType ?? ""]
          .join(" ")
          .toLowerCase()
          .includes(deferredCombatAllySearchQuery.trim().toLowerCase())
      ),
    [campaign, deferredCombatAllySearchQuery]
  );
  const activeEntityPlayerCards = useMemo(
    () => (activeEntity ? normalizePlayerFacingCardsForClient(activeEntity.kind, activeEntity.playerCards, activeEntity.playerContent) : []),
    [activeEntity]
  );

  const resolveQuestLocation = (quest: QuestEntity | null) => {
    if (!quest?.locationId) {
      return null;
    }

    const entity = entityMap.get(quest.locationId);
    return entity?.kind === "location" ? entity : null;
  };
  const resolveQuestIssuer = (quest: QuestEntity | null) => {
    if (!quest?.issuerId) {
      return null;
    }

    const entity = entityMap.get(quest.issuerId);
    return entity?.kind === "npc" ? entity : null;
  };
  const resolveQuestPreparedCombatEntries = (quest: QuestEntity | null): QuestCombatEntrySummary[] =>
    resolvePreparedCombatEntriesForPlans(entityMap, resolveEntityPreparedCombats(quest ?? undefined)) as QuestCombatEntrySummary[];
  const buildQuestLinkedEntities = (quest: QuestEntity | null): QuestLinkedEntity[] => {
    if (!quest) {
      return [];
    }

    const seen = new Set<string>();
    const items: QuestLinkedEntity[] = [];
    const pushItem = (item: QuestLinkedEntity | null) => {
      if (!item || seen.has(item.entity.id)) {
        return;
      }
      seen.add(item.entity.id);
      items.push(item);
    };

    const location = resolveQuestLocation(quest);
    if (location) {
      pushItem({
        entity: location,
        label: "Локация",
        tone: "accent",
        note: location.summary
      });
    }

    const issuer = resolveQuestIssuer(quest);
    if (issuer) {
      pushItem({
        entity: issuer,
        label: "Квестодатель",
        tone: "warning",
        note: issuer.summary
      });
    }

    quest.related.forEach((item) => {
      const entity = resolveLinkedEntity(item);
      if (!entity) {
        return;
      }
      pushItem({
        entity,
        label: kindTitle[entity.kind],
        tone:
          entity.kind === "monster"
            ? "danger"
            : entity.kind === "npc"
              ? "accent"
              : entity.kind === "location"
                ? "success"
                : "default",
        note: item.reason
      });
    });

    return items;
  };
  const findRelatedQuests = (quest: QuestEntity | null) =>
    quest && campaign
      ? campaign.quests.filter(
          (item) =>
            item.id !== quest.id &&
            (Boolean(quest.locationId && item.locationId === quest.locationId) ||
              Boolean(quest.issuerId && item.issuerId === quest.issuerId) ||
              item.related.some((related) => related.id === quest.id))
        )
      : [];
  const questScopeEntities =
    activeModule === "quests" ? scopedEntities.filter((entity): entity is QuestEntity => entity.kind === "quest") : [];
  const previewQuest = previewEntity?.kind === "quest" ? previewEntity : null;
  const previewQuestLocation = previewQuest ? resolveQuestLocation(previewQuest) : null;
  const previewQuestIssuer = previewQuest ? resolveQuestIssuer(previewQuest) : null;
  const previewQuestPreparedCombatEntries = previewQuest ? resolveQuestPreparedCombatEntries(previewQuest) : [];
  const previewQuestLinkedEntities = previewQuest ? buildQuestLinkedEntities(previewQuest) : [];
  const previewQuestRelatedQuests = previewQuest ? findRelatedQuests(previewQuest).slice(0, 3) : [];
  const pinnedEntities = pinnedIds
    .map((id) => entityMap.get(id))
    .filter((entity): entity is KnowledgeEntity => Boolean(entity));
  const dashboardLocationId = campaign?.locations[0]?.id ?? campaign?.npcs[0]?.id ?? campaign?.monsters[0]?.id ?? "";
  const dashboardQuestId = campaign?.quests[0]?.id ?? campaign?.lore[0]?.id ?? campaign?.monsters[0]?.id ?? "";

  const playPlaylist = ({
    scope,
    ownerId,
    ownerTitle,
    tracks,
    index,
    random = false
  }: {
    scope: PlaylistOwnerScope;
    ownerId: string;
    ownerTitle: string;
    tracks: PlaylistTrack[];
    index?: number;
    random?: boolean;
  }) => {
    const usableTracks = sanitizePlaylistTracks(tracks);
    if (!usableTracks.length) {
      return;
    }

    const sameContext = activePlayback?.scope === scope && activePlayback.ownerId === ownerId;
    const nextIndex = random
      ? pickRandomTrackIndex(usableTracks, sameContext ? activePlayback.currentIndex : undefined)
      : clamp(index ?? 0, 0, usableTracks.length - 1);

    if (nextIndex < 0) {
      return;
    }

    setActivePlayback({
      scope,
      ownerId,
      ownerTitle,
      tracks: usableTracks,
      currentIndex: nextIndex,
      token: Date.now()
    });
  };

  const playEntityPlaylist = (entity: KnowledgeEntity, index?: number, random = true) => {
    playPlaylist({
      scope: "entity",
      ownerId: entity.id,
      ownerTitle: entity.title,
      tracks: entity.playlist ?? [],
      index,
      random
    });
  };

  const playCombatPlaylist = (index?: number, random = true) => {
    if (!campaign) {
      return;
    }

    playPlaylist({
      scope: "combat",
      ownerId: campaign.id,
      ownerTitle: `${campaign.title} • Боевой плейлист`,
      tracks: campaign.combatPlaylist ?? [],
      index,
      random
    });
  };

  const playNextRandomTrack = () => {
    if (!activePlayback) {
      return;
    }

    playPlaylist({
      scope: activePlayback.scope,
      ownerId: activePlayback.ownerId,
      ownerTitle: activePlayback.ownerTitle,
      tracks: activePlayback.tracks,
      random: true
    });
  };

  const playPlaybackIndex = (nextIndex: number) => {
    if (!activePlayback || !activePlayback.tracks.length) {
      return;
    }

    const normalizedIndex = ((nextIndex % activePlayback.tracks.length) + activePlayback.tracks.length) % activePlayback.tracks.length;
    setActivePlayback({
      ...activePlayback,
      currentIndex: normalizedIndex,
      token: Date.now()
    });
  };

  const playPreviousTrack = () => {
    if (!activePlayback) {
      return;
    }

    playPlaybackIndex(activePlayback.currentIndex - 1);
  };

  const playNextTrack = () => {
    if (!activePlayback) {
      return;
    }

    playPlaybackIndex(activePlayback.currentIndex + 1);
  };

  const stopPlayback = () => {
    setActivePlayback(null);
  };

  const openGalleryViewer = (ownerId: string, ownerTitle: string, items: GalleryImage[], index = 0) => {
    const sanitized = sanitizeGalleryImages(items);
    if (!sanitized.length) {
      return;
    }

    setGalleryViewer({
      ownerId,
      ownerTitle,
      items: sanitized,
      currentIndex: clamp(index, 0, sanitized.length - 1)
    });
  };

  const openEntityGalleryViewer = (entity: KnowledgeEntity, index = 0) => {
    openGalleryViewer(entity.id, entity.title, entity.gallery ?? [], index);
  };

  const closeGalleryViewer = () => {
    setGalleryViewer(null);
  };

  const selectGalleryViewerIndex = (index: number) => {
    setGalleryViewer((current) => {
      if (!current?.items.length) {
        return current;
      }
      const normalized = ((index % current.items.length) + current.items.length) % current.items.length;
      return {
        ...current,
        currentIndex: normalized
      };
    });
  };

  const handleCopyImageLink = async (url: string) => {
    try {
      await copyTextToClipboard(url);
    } catch (error) {
      setBootError(error instanceof Error ? error.message : "Не удалось скопировать ссылку на изображение.");
      throw error;
    }
  };

  const showGalleryImageToPlayers = async (item: GalleryImage) => {
    if (!activeCampaignId || typeof window === "undefined") {
      return;
    }

    const popup = window.open("", "shadow-edge-player-display");
    setPlayerDisplayBusy(true);
    try {
      const share = await api.showPlayerDisplayImage(activeCampaignId, {
        alt: item.caption?.trim() || item.title.trim() || "Изображение для игроков",
        caption: item.caption?.trim() || undefined,
        title: item.title.trim() || undefined,
        url: item.url
      });

      if (popup && !popup.closed) {
        popup.location.href = share.url;
        popup.focus();
      } else {
        window.open(share.url, "shadow-edge-player-display");
      }

      setBootError("");
    } catch (error) {
      if (popup && !popup.closed) {
        popup.close();
      }
      setBootError(error instanceof Error ? error.message : "Не удалось показать изображение игрокам.");
    } finally {
      setPlayerDisplayBusy(false);
    }
  };

  const scrollContentToTop = () => {
    contentRef.current?.scrollTo({ top: 0, behavior: "auto" });
  };

  const openModuleDirectory = (moduleId: ModuleId = activeModule, tabId?: string) => {
    if (moduleId === "dashboard" || moduleId === "combat" || moduleId === "rules") {
      return;
    }

    const nextTab =
      tabId && tabs[moduleId].includes(tabId)
        ? tabId
        : moduleId === activeModule && tabs[moduleId].includes(activeTab)
          ? activeTab
          : tabs[moduleId][0];

    setActiveModule(moduleId);
    setActiveRailAlias((current) => preserveRailAliasForModule(current, moduleId));
    setActiveTab(nextTab);
    setActiveEntityId("");
    setPreviewEntityId("");
    setModuleEntitySearch("");
    if (moduleId === "monsters") {
      bestiaryController.resetBrowseSelection();
    }
    requestAnimationFrame(scrollContentToTop);
  };

  const openEntity = (id: string) => {
    const entity = entityMap.get(id);
    if (!entity) {
      return;
    }

    const targetModule = moduleByKind[entity.kind];
    const defaultTab = entity.kind === "monster" ? "Импорт" : "Все";
    const isVisibleInCurrentTab =
      entity.kind === "monster"
        ? activeModule === targetModule &&
          activeTab === "Импорт" &&
          bestiaryController.filteredImportedMonsters.some((candidate) => candidate.id === entity.id)
        : activeModule === targetModule && scopedEntities.some((candidate) => candidate.id === entity.id);
    const nextTab =
      isVisibleInCurrentTab ? activeTab : defaultTab;

    startTransition(() => {
      setActiveModule(targetModule);
      setActiveRailAlias((current) => preserveRailAliasForModule(current, targetModule));
      setActiveTab(nextTab);
      setActiveEntityId(id);
    });
    setPreviewEntityId(id);

    requestAnimationFrame(scrollContentToTop);
  };

  const openPreview = (id: string) => {
    if (!entityMap.has(id)) {
      return;
    }

    setPreviewEntityId(id);
  };

  const openWorldEvent = (eventId: string) => {
    const event = campaign?.events.find((item) => item.id === eventId) ?? null;
    if (!event) {
      return;
    }

    setActiveModule("quests");
    setActiveRailAlias("events");
    setActiveTab("Все");
    setActiveEntityId("");
    setSelectedWorldEventId(event.id);
    setPreviewEntityId(event.locationId ?? "");
    requestAnimationFrame(scrollContentToTop);
  };

  const peekEntity = (id: string) => {
    openPreview(id);
  };

  const openQuestFocus = (id: string) => {
    const entity = entityMap.get(id);
    if (!entity || entity.kind !== "quest") {
      return;
    }

    const nextTab =
      activeModule === "quests" && (activeTab === "Все" || activeTab === questStatusTabLabel(entity.status)) ? activeTab : "Все";

    startTransition(() => {
      setActiveModule("quests");
      setActiveRailAlias((current) => preserveRailAliasForModule(current, "quests"));
      setActiveTab(nextTab);
      setActiveEntityId(id);
    });

    setPreviewEntityId(id);
    requestAnimationFrame(scrollContentToTop);
  };

  const openRelatedEntity = (item: RelatedEntity) => {
    const linked = resolveLinkedEntity(item);
    if (!linked) {
      setBootError(`Связанная сущность "${item.label}" не найдена в кампании. Возможно, её удалили или ссылка устарела.`);
      return;
    }

    peekEntity(linked.id);
  };

  const focusCombatModule = () => {
    setActiveModule("combat");
    setActiveRailAlias(null);
    setActiveTab("Encounter");
  };

  const openCombatScreen = () => {
    focusCombatModule();
    setCombatSetupOpen(false);
  };

  const selectCombatEntryById = (entryId: string) => {
    if (!campaign?.activeCombat?.entries.length) {
      return;
    }

    const index = campaign.activeCombat.entries.findIndex((entry) => entry.id === entryId);
    if (index < 0) {
      return;
    }

    setSelectedCombatEntryKey(combatEntrySelectionKey(campaign.activeCombat.entries[index], index));
  };

  const openInitiativeTracker = () => {
    if (!activeCampaignId || typeof window === "undefined") {
      return;
    }

    const trackerUrl = new URL(window.location.href);
    trackerUrl.hash = buildInitiativeHash(activeCampaignId);
    const opened = window.open(trackerUrl.toString(), "_blank", "noopener,noreferrer");
    if (!opened) {
      setBootError("Браузер заблокировал новую вкладку с трекером. Разреши pop-up для сайта и попробуй еще раз.");
      return;
    }
    setBootError("");
  };

  const preparePublicInitiativeTrackerLink = async () => {
    if (!activeCampaignId) {
      throw new Error("Кампания не выбрана.");
    }

    setInitiativeShareBusy(true);
    try {
      const share = await api.createInitiativeShare(activeCampaignId);
      setBootError("");
      setInitiativePublishNotice(
        hasActiveCombat
          ? share.publishedAt
            ? `Публичная ссылка готова. Игроки увидят обычный живой трекер. Последнее обновление: ${formatDateTime(share.publishedAt)}.`
            : "Публичная ссылка готова. Игроки увидят обычный живой трекер."
          : "Публичная ссылка готова. Пока бой не начат, по ней будет экран ожидания. Трекер появится автоматически после старта боя."
      );
      return share.url;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Не удалось подготовить публичную ссылку на трекер инициативы.";
      setBootError(message);
      throw error;
    } finally {
      setInitiativeShareBusy(false);
    }
  };

  const openPublicInitiativeTracker = () => {
    if (!activeCampaignId || typeof window === "undefined") {
      return;
    }

    const popup = window.open("", "shadow-edge-player-display");
    if (!popup) {
      setBootError("Браузер заблокировал новую вкладку. Разреши pop-up для сайта или используй кнопку копирования ссылки.");
      return;
    }

    popup.document.write("<title>Shadow Edge GM</title><p>Подготавливаю публичный трекер...</p>");
    popup.document.close();

    void preparePublicInitiativeTrackerLink()
      .then((target) => {
        popup.location.replace(target);
      })
      .catch(() => {
        popup.close();
      });
  };

  const copyPublicInitiativeTrackerLink = async () => {
    if (!activeCampaignId || typeof window === "undefined") {
      return;
    }

    try {
      const target = await preparePublicInitiativeTrackerLink();
      await copyTextToClipboard(target);
      setBootError("");
    } catch (error) {
      setBootError(error instanceof Error ? error.message : "Не удалось скопировать ссылку на трекер инициативы.");
    }
  };

  const switchModule = (moduleId: ModuleId) => {
    setModuleEntitySearch("");
    setActiveModule(moduleId);
    setActiveRailAlias(null);
    setActiveTab(tabs[moduleId][0]);

    if (!campaign || moduleId === "dashboard" || moduleId === "combat") {
      requestAnimationFrame(scrollContentToTop);
      return;
    }

    if (moduleId === "monsters") {
      setActiveEntityId("");
      setPreviewEntityId("");
      bestiaryController.resetBrowseSelection();
      requestAnimationFrame(scrollContentToTop);
      return;
    }

    setActiveEntityId("");
    setPreviewEntityId("");
    requestAnimationFrame(scrollContentToTop);
  };

  const openRulesCompendium = (options?: { ruleId?: string; query?: string }) => {
    setModuleEntitySearch("");
    setActiveRailAlias(null);
    setActiveModule("rules");
    setActiveTab(tabs.rules[0]);
    setActiveEntityId("");
    setPreviewEntityId("");
    bestiaryController.resetBrowseSelection();
    setRulesNavigationState((current) => ({
      query: options?.query ?? current.query,
      requestId: current.requestId + 1,
      ruleId: options?.ruleId ?? current.ruleId
    }));
    requestAnimationFrame(scrollContentToTop);
  };

  const returnToApp = () => {
    if (typeof window !== "undefined" && appRoute.mode === "initiative") {
      window.location.hash = "";
      setAppRoute({ mode: "app" });
    }
    const fallbackTab = tabs[lastAppViewRef.current.module][0];
    const nextTab = tabs[lastAppViewRef.current.module].includes(lastAppViewRef.current.tab)
      ? lastAppViewRef.current.tab
      : fallbackTab;
    setActiveModule(lastAppViewRef.current.module);
    setActiveRailAlias(null);
    setActiveTab(nextTab);
  };

  const openRailAlias = (alias: RailAlias) => {
    const targetModule: ModuleId = alias === "events" ? "quests" : "lore";
    setModuleEntitySearch("");
    setActiveRailAlias(alias);
    setActiveModule(targetModule);
    setActiveTab("Все");
    setActiveEntityId("");
    setPreviewEntityId("");
    bestiaryController.resetBrowseSelection();
    requestAnimationFrame(scrollContentToTop);
  };

  const openShopFromLocation = (shopId: string) => {
    setFocusedShopId(shopId);
    openRailAlias("shops");
  };

  const togglePin = (id: string) => {
    setPinnedIds((current) =>
      current.includes(id) ? current.filter((currentId) => currentId !== id) : [id, ...current]
    );
  };

  const startResize = (key: ResizeKey, event: ReactPointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    resizeRef.current = {
      key,
      startX: event.clientX,
      startWidth: key === "rail" ? railWidth : key === "list" ? listWidth : previewWidth
    };
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  };

  const openCombatPlaylistModal = () => {
    setCombatPlaylistDraft(clonePlaylistTracks(campaign?.combatPlaylist) ?? []);
    setCombatPlaylistModalOpen(true);
  };

  const openCombatSetupModal = (preparedCombatOverride?: CampaignPreparedCombat | null) => {
    const nextDraft = cloneCampaignPreparedCombat(preparedCombatOverride ?? campaignPreparedCombat);
    focusCombatModule();
    setBootError("");
    setEntityCombatSetupState(null);
    replaceCampaignPreparedCombatDraft(nextDraft);
    setCombatPartyLevelsText("");
    setCombatPlayerSearchQuery("");
    setCombatAllySearchQuery("");
    resetCombatEnemySearch();
    setCombatPlayerManagerOpen(nextDraft.playerIds.length === 0);
    setCombatEnemyCatalogOpen(nextDraft.items.length === 0);
    setCombatDifficultyDetailsOpen(true);
    setCombatSetupOpen(true);
  };

  const openEntityPreparedCombatSetup = (
    entity: PreparedCombatHostEntity,
    plan: PreparedCombatPlan | undefined,
    planIndex: number,
    isNew = false
  ) => {
    const nextDraft =
      cloneCampaignPreparedCombat(
        plan
          ? {
              title: plan.title,
              partyLevel: plan.partyLevel,
              playerIds: plan.playerIds ?? [],
              allies: plan.allies ?? [],
              items: plan.items
            }
          : null
      ) || {
        title: defaultPreparedCombatTitle(planIndex),
        partyLevel: undefined,
        playerIds: [],
        allies: [],
        items: []
      };
    focusCombatModule();
    setBootError("");
    setEntityCombatSetupState({
      entityId: entity.id,
      planIndex,
      isNew
    });
    replaceCampaignPreparedCombatDraft(nextDraft);
    setCombatPartyLevelsText("");
    setCombatPlayerSearchQuery("");
    setCombatAllySearchQuery("");
    resetCombatEnemySearch();
    setCombatPlayerManagerOpen(nextDraft.playerIds.length === 0);
    setCombatEnemyCatalogOpen(nextDraft.items.length === 0);
    setCombatDifficultyDetailsOpen(true);
    setCombatSetupOpen(true);
  };

  const openNewEntityPreparedCombatSetup = (entity: PreparedCombatHostEntity) => {
    const existingPlans = resolveEntityPreparedCombats(entity);
    const nextIndex = existingPlans.length;
    openEntityPreparedCombatSetup(
      entity,
      createEmptyPreparedCombatPlan(defaultPreparedCombatTitle(nextIndex)),
      nextIndex,
      true
    );
  };
  const closeCombatPlaylistModal = () => {
    setCombatPlaylistModalOpen(false);
    setCombatPlaylistDraft([]);
  };

  const closeCombatSetupModal = () => {
    setCombatSetupOpen(false);
    setEntityCombatSetupState(null);
    setCampaignPreparedCombatNotice("");
    setCombatPlayerSearchQuery("");
    setCombatAllySearchQuery("");
    resetCombatEnemySearch();
  };

  const uploadCampaignImage = async (file: File) => {
    if (!activeCampaignId) {
      throw new Error("Сначала открой кампанию, а потом уже загружай изображения.");
    }

    return api.uploadImage(activeCampaignId, file);
  };

  const updateCombatPlaylistTrack = (index: number, patch: Partial<PlaylistTrack>) => {
    setCombatPlaylistDraft((current) => current.map((track, trackIndex) => (trackIndex === index ? { ...track, ...patch } : track)));
  };

  const addCombatPlaylistTrack = () => {
    setCombatPlaylistDraft((current) => [...current, createEmptyPlaylistTrack()]);
  };

  const removeCombatPlaylistTrack = (index: number) => {
    setCombatPlaylistDraft((current) => current.filter((_, trackIndex) => trackIndex !== index));
  };

  const handleCampaignSelect = async (campaignId: string) => {
    try {
      setBootError("");
      await loadCampaign(campaignId);
    } catch (error) {
      setBootError(error instanceof Error ? error.message : "Не удалось открыть кампанию.");
    }
  };

  const saveCombatPlaylist = async () => {
    if (!activeCampaignId) {
      return;
    }

    try {
      setSaving(true);
      const sanitized = sanitizePlaylistTracks(combatPlaylistDraft);
      const updated = await api.updateCampaign(activeCampaignId, {
        combatPlaylist: sanitized
      });
      hydrateCampaign(updated);
      if (activePlayback?.scope === "combat" && activePlayback.ownerId === activeCampaignId) {
        if (sanitized.length) {
          const currentUrl = currentPlaybackTrackUrl;
          const nextIndex = sanitized.findIndex((track) => track.url === currentUrl);
          setActivePlayback({
            scope: "combat",
            ownerId: activeCampaignId,
            ownerTitle: `${updated.title} • Боевой плейлист`,
            tracks: sanitized,
            currentIndex: nextIndex >= 0 ? nextIndex : 0,
            token: activePlayback.token
          });
        } else {
          stopPlayback();
        }
      }
      closeCombatPlaylistModal();
    } catch (error) {
      setBootError(error instanceof Error ? error.message : "Не удалось сохранить боевой плейлист.");
    } finally {
      setSaving(false);
    }
  };


  const applyCreatedEntity = (result: CreateEntityResult) => {
    hydrateCampaign(result.campaign, result.entity.id);
    setActiveModule(moduleByKind[result.entity.kind]);
    setActiveRailAlias((current) => preserveRailAliasForModule(current, moduleByKind[result.entity.kind]));
    setActiveTab(result.entity.kind === "monster" ? "Импорт" : "Все");
    contentRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  };

  const enrichQuestPayload = (payload: CreateEntityInput): CreateEntityInput => {
    if (payload.kind !== "quest") {
      return payload;
    }

    const issuerId = payload.issuerId || entityModalSourceNpcId || undefined;
    const related = [...(payload.related ?? [])];

    if (issuerId) {
      const issuer = entityMap.get(issuerId);
      if (issuer?.kind === "npc" && !related.some((item) => item.id === issuer.id)) {
        related.push({
          id: issuer.id,
          kind: "npc",
          label: issuer.title,
          reason: "Этот НПС выдаёт, сопровождает или продвигает квест."
        });
      }
    }

    if (payload.locationId) {
      const linkedLocation = entityMap.get(payload.locationId);
      if (linkedLocation?.kind === "location" && !related.some((item) => item.id === linkedLocation.id)) {
        related.push({
          id: linkedLocation.id,
          kind: "location",
          label: linkedLocation.title,
          reason: "Квест напрямую привязан к этой локации."
        });
      }
    }

    return {
      ...payload,
      issuerId,
      related
    };
  };

  const syncQuestIssuerBacklink = async (
    result: CreateEntityResult,
    payload: CreateEntityInput
  ): Promise<CreateEntityResult> => {
    if (!activeCampaignId || payload.kind !== "quest" || !payload.issuerId) {
      return result;
    }

    const issuer =
      result.campaign.npcs.find((item) => item.id === payload.issuerId) ??
      (entityMap.get(payload.issuerId)?.kind === "npc" ? (entityMap.get(payload.issuerId) as NpcEntity) : null);
    if (!issuer) {
      return result;
    }

    const issuerForm = entityToForm(issuer);
    const existingRelated = issuerForm.related ?? [];
    if (existingRelated.some((item) => item.id === result.entity.id)) {
      return result;
    }

    issuerForm.related = [
      ...existingRelated,
      {
        id: result.entity.id,
        kind: "quest",
        label: result.entity.title,
        reason: "Связанный квест, созданный прямо из профиля этого НПС."
      }
    ];

    const updatedIssuer = await api.updateEntity(activeCampaignId, issuer.id, serializeEntityForm(issuerForm));
    return {
      campaign: updatedIssuer.campaign,
      entity: updatedIssuer.campaign.quests.find((item) => item.id === result.entity.id) ?? result.entity
    };
  };

  const persistEntityPayload = async ({
    payload,
    mode,
    editingId,
    linkedIssuerDraft
  }: {
    payload: CreateEntityInput;
    mode: EntityModalMode;
    editingId?: string;
    linkedIssuerDraft?: CreateEntityInput | null;
  }): Promise<CreateEntityResult> => {
    if (!activeCampaignId) {
      throw new Error("Кампания не выбрана.");
    }

    let autoCreatedIssuerId = "";
    try {
      let nextPayload = enrichQuestPayload(payload);
      if (
        mode === "create" &&
        nextPayload.kind === "quest" &&
        !nextPayload.issuerId &&
        linkedIssuerDraft?.kind === "npc"
      ) {
        const issuerPayload = serializeEntityForm({
          ...emptyEntityForm("npc"),
          ...linkedIssuerDraft,
          kind: "npc"
        });
        const issuerResult = await api.createEntity(activeCampaignId, issuerPayload);
        if (issuerResult.entity.kind === "npc") {
          autoCreatedIssuerId = issuerResult.entity.id;
          nextPayload = {
            ...nextPayload,
            issuerId: issuerResult.entity.id,
            related: [
              ...(nextPayload.related ?? []),
              ...(nextPayload.related ?? []).some((item) => item.id === issuerResult.entity.id)
                ? []
                : [
                    {
                      id: issuerResult.entity.id,
                      kind: "npc" as const,
                      label: issuerResult.entity.title,
                      reason: "Этот НПС был автоматически создан как квестодатель для данного квеста."
                    }
                  ]
            ]
          };
        }
      }

      let result =
        mode === "edit" && editingId
          ? await api.updateEntity(activeCampaignId, editingId, nextPayload)
          : await api.createEntity(activeCampaignId, nextPayload);
      result = await syncQuestIssuerBacklink(result, nextPayload);
      return result;
    } catch (error) {
      if (autoCreatedIssuerId) {
        try {
          await api.deleteEntity(activeCampaignId, autoCreatedIssuerId);
        } catch {
          // Best-effort cleanup for a quest issuer created in the same submit flow.
        }
      }
      throw error;
    }
  };

  const campaignPreparedCombatPlayerCount = campaignPreparedCombat?.playerIds.length ?? 0;
  const campaignPreparedCombatPartyCount = campaignPreparedCombatPlayerCount + configuredCombatAllyCount;
  const draftEncounterMonsterCount = campaignPreparedCombatDraftEnemyCount;
  const draftEncounterBaseXp = draftEnemyExperienceTotal;
  const {
    combatThresholdPartySize,
    fallbackCombatPartyLevelsText,
    resolvedCombatPartyLevelsText,
    persistedCombatPartyLevel,
    enteredPartyLevel,
    hasMultipleEnteredPartyLevels,
    effectivePartyLevels,
    hasExplicitPartyLevels,
    effectivePartySize,
    effectiveCombatThresholds,
    combatLevelDisplayText,
    combatThresholdSummary,
    combatPartySummary,
    draftEncounterMultiplier,
    draftEncounterAdjustedXp,
    draftEncounterDifficulty,
    draftEncounterDifficultyThreshold,
    partyCompositionText
  } = useCombatDifficulty({
    campaignPreparedCombatPartyCount,
    campaignPreparedCombatPartyLevel: campaignPreparedCombatDraft.partyLevel,
    combatPartyLevelsText,
    combatPartySize,
    combatSetupOpen,
    combatThresholds,
    draftEncounterBaseXp,
    draftEncounterMonsterCount,
    draftPreparedCombatAllyCount,
    draftPreparedCombatPartyCount,
    draftPreparedCombatPlayerLevels,
    draftPreparedCombatPlayersCount: draftPreparedCombatPlayers.length,
    hasActiveCombatEntries: Boolean(activeCombat?.entries.length)
  });
  const selectedCombatEntryIndex = activeCombat?.entries.findIndex(
    (entry, index) => combatEntrySelectionKey(entry, index) === selectedCombatEntryKey
  );
  const normalizedSelectedCombatEntryIndex =
    selectedCombatEntryIndex !== undefined && selectedCombatEntryIndex >= 0 ? selectedCombatEntryIndex : 0;
  const selectedCombatEntry = activeCombat?.entries[normalizedSelectedCombatEntryIndex] ?? null;
  const selectedCombatEntity = selectedCombatEntry ? entityMap.get(selectedCombatEntry.entityId) ?? null : null;

  const focusCombatTurnFromState = (combat: ActiveCombat | null | undefined) => {
    if (!combat?.entries.length) {
      setSelectedCombatEntryKey("");
      return;
    }

    const focusedIndex = combat.currentTurnEntryId
      ? combat.entries.findIndex((entry) => entry.id === combat.currentTurnEntryId)
      : -1;
    const nextIndex = focusedIndex >= 0 ? focusedIndex : 0;
    setSelectedCombatEntryKey(combatEntrySelectionKey(combat.entries[nextIndex], nextIndex));
  };

  const applyCombatPayload = (result: CombatResult | GenerateCombatResult) => {
    setBootError("");
    setCombatPortraitNotice("");
    setInitiativePublishNotice("");
    hydrateCampaign(result.campaign);
    setActiveModule("combat");
    setActiveTab("Encounter");
    setCombatReport(null);
    focusCombatTurnFromState(result.combat);
  };

  const rememberCombatReturnTarget = (combatId: string, questId?: string) => {
    if (!activeCampaignId || !combatId) {
      return;
    }

    const now = Date.now();
    const recentTargets = Object.entries(readCombatReturnTargets()).reduce<Record<string, CombatReturnTarget>>(
      (accumulator, [storedCombatId, target]) => {
        if (now - target.startedAt < 30 * 24 * 60 * 60 * 1000) {
          accumulator[storedCombatId] = target;
        }
        return accumulator;
      },
      {}
    );

    recentTargets[combatId] = {
      campaignId: activeCampaignId,
      questId,
      startedAt: now
    };
    writeCombatReturnTargets(recentTargets);
  };

  const consumeCombatReturnTarget = (combatId: string) => {
    const targets = readCombatReturnTargets();
    const target = targets[combatId];
    if (target) {
      delete targets[combatId];
      writeCombatReturnTargets(targets);
    }
    return target;
  };

  const openQuestList = () => {
    startTransition(() => {
      setActiveModule("quests");
      setActiveRailAlias(null);
      setActiveTab("Все");
      setActiveEntityId("");
    });
    setSelectedWorldEventId("");
    setPreviewEntityId("");
    requestAnimationFrame(scrollContentToTop);
  };

  const navigateAfterCombatFinish = (nextCampaign: CampaignData, target?: CombatReturnTarget) => {
    const questId = target?.campaignId === nextCampaign.id ? target.questId : undefined;
    const quest = questId ? nextCampaign.quests.find((item) => item.id === questId) ?? null : null;

    if (!quest) {
      openQuestList();
      return;
    }

    startTransition(() => {
      setActiveModule("quests");
      setActiveRailAlias(null);
      setActiveTab("Все");
      setActiveEntityId(quest.id);
    });
    setSelectedWorldEventId("");
    setPreviewEntityId(quest.id);
    requestAnimationFrame(scrollContentToTop);
  };

  const preparedCombatController = usePreparedCombatController({
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
    onApplyCombatPayload: applyCombatPayload,
    onCloseCombatSetupModal: closeCombatSetupModal,
    onEntityToForm: entityToForm,
    onHandleProtectedActionError: handleProtectedActionError,
    onRememberCombatReturnTarget: rememberCombatReturnTarget,
    onOpenCombatScreen: openCombatScreen,
    onOpenEntityPreparedCombatSetup: openEntityPreparedCombatSetup,
    onOpenQuestFocus: openQuestFocus,
    onPeekEntity: peekEntity,
    onRequestModalClose: requestModalClose,
    onResetCombatPartyLevelsText: () => setCombatPartyLevelsText(""),
    onSerializeEntityForm: serializeEntityForm,
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
  });
  const {
    addPreparedCombatDraftItem,
    closePreparedCombatModal,
    generateCombatEncounter,
    handleQuestCombatAction,
    openPreparedCombatModal,
    preparedCombatDraft,
    preparedCombatNotice,
    preparedCombatQuest,
    preparedCombatQuestId,
    requestPreparedCombatCardDeletion,
    removePreparedCombatDraftItem,
    saveCampaignPreparedCombatDraft,
    saveEntityPreparedCombatDraft,
    savePreparedCombatDraft,
    startConfiguredCombat,
    startEntityPreparedCombat,
    startPreparedQuestCombat,
    updatePreparedCombatDraftItem,
    updatePreparedCombatTitle
  } = preparedCombatController;
  const {
    campaignForm,
    campaignModalOpen,
    openCampaignModal,
    submitCampaign,
    updateCampaignForm
  } = campaignCreation;
  const {
    closePalette,
    displayResults,
    openPalette,
    paletteOpen,
    query,
    resetPalette,
    setQuery
  } = globalSearchController;
  const {
    closeRandomEventModal,
    generateRandomEvent,
    openRandomEventModal,
    randomEventDestinationId,
    randomEventGenerating,
    randomEventModalOpen,
    randomEventNotes,
    randomEventPrompt,
    setRandomEventDestinationId,
    setRandomEventPrompt
  } = randomEventController;
  const entityActionsController = useEntityActionsController({
    activeCampaignId,
    editingEntityId,
    entityGalleryTargetId: entityGalleryTarget?.id,
    entityMap,
    entityPlaylistTargetId: entityPlaylistTarget?.id,
    galleryViewerOwnerId: galleryViewer?.ownerId,
    onCloseEntityGalleryModal: () => closeEntityGalleryModal(),
    onCloseEntityLinkContextMenu: () => entityLinkController.closeEntityLinkContextMenu(),
    onCloseEntityModal: () => closeEntityModal(),
    onCloseEntityPlaylistModal: () => closeEntityPlaylistModal(),
    onCloseGalleryViewer: () => closeGalleryViewer(),
    onClosePlayerFacingView: () => closePlayerFacingView(),
    onClosePreparedCombatModal: () => closePreparedCombatModal(),
    onHydrateCampaign: (nextCampaign) => hydrateCampaign(nextCampaign),
    onOpenEntityModule: (kind) => setActiveModule(moduleByKind[kind]),
    onRemovePinnedEntity: (entityId) => {
      setPinnedIds((current) => current.filter((id) => id !== entityId));
    },
    playerFacingEntityId: playerFacingView?.entityId,
    preparedCombatQuestId,
    setBootError,
    setSaving
  });
  const {
    cancelEntityDeletion,
    closeEntityActionMenu,
    confirmEntityDeletion,
    entityActionMenu,
    entityActionMenuTarget,
    openEntityActionMenu,
    pendingDeleteEntity,
    requestEntityDeletion
  } = entityActionsController;

  const syncCombatPortraits = async () => {
    if (!activeCampaignId || !campaign) {
      return;
    }

    const sourceEntities = activeCombat?.entries.length
      ? activeCombat.entries
          .map((entry) => entityMap.get(entry.entityId))
          .filter((entity): entity is KnowledgeEntity => Boolean(entity))
      : [
          ...configuredCombatPlayers,
          ...configuredCombatAllies.map((item) => item.entity),
          ...configuredCombatEnemies.map((item) => item.entity)
        ];

    const uniqueEntities = Array.from(
      new Map(
        sourceEntities
          .filter((entity): entity is CombatProfileEntity => isCombatProfileEntity(entity))
          .map((entity) => [entity.id, entity])
      ).values()
    );

    if (!uniqueEntities.length) {
      setCombatPortraitNotice("Сначала собери бой или запусти сцену, чтобы было кому подтягивать портреты.");
      return;
    }

    const missingArtEntities = uniqueEntities.filter((entity) => !hasVisibleArt(entity.art));
    if (!missingArtEntities.length) {
      setCombatPortraitNotice("У всех участников уже есть изображения.");
      return;
    }

    try {
      setSaving(true);
      setBootError("");
      setCombatPortraitNotice("");
      let latestCampaign: CampaignData | null = null;
      for (const entity of missingArtEntities) {
        const nextForm = entityToForm(entity);
        nextForm.art = {
          ...(nextForm.art ?? {}),
          url: createPortraitSource(entity),
          alt: entity.title,
          caption: nextForm.art?.caption ?? "Автопортрет для инициативного трекера"
        };
        const result = await api.updateEntity(activeCampaignId, entity.id, serializeEntityForm(nextForm));
        latestCampaign = result.campaign;
      }

      if (latestCampaign) {
        hydrateCampaign(latestCampaign);
      }
      setCombatPortraitNotice(
        `Подтянул портреты для ${missingArtEntities.length} ${
          missingArtEntities.length === 1 ? "участника" : missingArtEntities.length < 5 ? "участников" : "участников"
        }.`
      );
    } catch (error) {
      setBootError(error instanceof Error ? error.message : "Не удалось подтянуть портреты для участников боя.");
    } finally {
      setSaving(false);
    }
  };

  const addExistingCombatants = async () => {
    if (!activeCampaignId || !combatSelectionId || !selectedCombatSearchItem) {
      return;
    }

    try {
      setSaving(true);
      setBootError("");
      let entityId = selectedCombatSearchItem.id;
      if (selectedCombatSearchItem.source === "bestiary") {
        const imported = await api.importBestiaryMonster(activeCampaignId, selectedCombatSearchItem.id);
        if (!imported.entity?.id) {
          throw new Error("Backend не вернул импортированного монстра для добавления в бой.");
        }
        entityId = imported.entity.id;
        setPreviewEntityId(imported.entity.id);
      }
      const result = await api.startCombat(activeCampaignId, {
        title: combatTitle.trim() || "Активный бой",
        partySize: effectivePartySize,
        thresholds: effectiveCombatThresholds,
        targetAdjustedXp:
          combatDifficulty === "custom" && combatCustomAdjustedXp > 0
            ? combatCustomAdjustedXp
            : activeCombat?.targetAdjustedXp,
        targetBaseXp: activeCombat?.targetBaseXp,
        items: [{ entityId, quantity: combatSelectionQuantity, initiative: combatSelectionInitiative }]
      });
      applyCombatPayload(result);
      selectCombatEntity(entityId);
      closeCombatSetupModal();
    } catch (error) {
      setBootError(error instanceof Error ? error.message : "Не удалось добавить участника в бой.");
    } finally {
      setSaving(false);
    }
  };

  const updateCombatPartyLevelText = (value: string) => {
    setCombatPartyLevelsText(value.replace(/[^\d,;\s]/g, "").slice(0, 24));
  };

  const clearPreparedCombatDraft = () => {
    combatDraftController.clearPreparedCombatDraft({
      fallbackTitle: combatSetupHostEntity ? defaultPreparedCombatTitle(entityCombatSetupState?.planIndex ?? 0) : undefined,
      onAfterClear: () => {
        setCombatPartyLevelsText("");
        setCombatPlayerManagerOpen(true);
        setCombatEnemyCatalogOpen(true);
      }
    });
  };

  const patchCombatEntry = async (entry: CombatEntry, patch: { currentHitPoints?: number; defeated?: boolean; initiative?: number }) => {
    if (!activeCampaignId) {
      return;
    }

    const queuedPatch = async () => {
      try {
        const result = await api.updateCombatEntry(activeCampaignId, entry.id, {
          currentHitPoints:
            patch.currentHitPoints !== undefined ? clamp(patch.currentHitPoints, 0, Math.max(entry.maxHitPoints, 0)) : undefined,
          defeated:
            patch.defeated !== undefined
              ? patch.defeated
              : patch.currentHitPoints !== undefined && entry.maxHitPoints > 0
                ? patch.currentHitPoints <= 0
                : undefined,
          initiative: patch.initiative,
          entityId: entry.entityId,
          title: entry.title
        });
        setBootError("");
        hydrateCampaign(result.campaign);
      } catch (error) {
        handleProtectedActionError(error, "Не удалось обновить данные участника боя.");
      }
    };

    const previousPatch = combatPatchQueueRef.current.get(entry.id) ?? Promise.resolve();
    const nextPatch = previousPatch.catch(() => undefined).then(queuedPatch);
    combatPatchQueueRef.current.set(entry.id, nextPatch);
    await nextPatch.finally(() => {
      if (combatPatchQueueRef.current.get(entry.id) === nextPatch) {
        combatPatchQueueRef.current.delete(entry.id);
      }
    });
  };

  const updateCombatHitPoints = async (entry: CombatEntry, nextHp: number) => {
    await patchCombatEntry(entry, {
      currentHitPoints: nextHp
    });
  };

  const updateCombatInitiative = async (entry: CombatEntry, nextInitiative: number) => {
    await patchCombatEntry(entry, {
      initiative: nextInitiative
    });
  };

  const addManualPlayerToCombat = async () => {
    if (!activeCampaignId || !combatPlayerEntityId) {
      setBootError("Сначала выбери игрока из списка партии.");
      return;
    }

    try {
      setSaving(true);
      setBootError("");
      const result = await api.startCombat(activeCampaignId, {
        title: activeCombat?.title || combatTitle.trim() || "Активный бой",
        partySize: effectivePartySize,
        thresholds: effectiveCombatThresholds,
        targetAdjustedXp: activeCombat?.targetAdjustedXp,
        targetBaseXp: activeCombat?.targetBaseXp,
        items: [{ entityId: combatPlayerEntityId, quantity: 1, initiative: combatPlayerInitiative }]
      });
      applyCombatPayload(result);
      setCombatPlayerInitiative(0);
    } catch (error) {
      setBootError(error instanceof Error ? error.message : "Не удалось добавить игрока в инициативу.");
    } finally {
      setSaving(false);
    }
  };

  const setCombatTurn = async (entryId: string) => {
    if (!activeCampaignId || combatStateBusy) {
      return;
    }

    try {
      setCombatStateBusy(true);
      const result = await api.updateCombatState(activeCampaignId, {
        currentTurnEntryId: entryId
      });
      setBootError("");
      hydrateCampaign(result.campaign);
      focusCombatTurnFromState(result.combat ?? result.campaign.activeCombat);
    } catch (error) {
      handleProtectedActionError(error, "Не удалось выбрать текущий ход.");
    } finally {
      setCombatStateBusy(false);
    }
  };

  const nextCombatTurn = async () => {
    if (!activeCampaignId || combatStateBusy) {
      return;
    }

    try {
      setCombatStateBusy(true);
      const result = await api.updateCombatState(activeCampaignId, {
        nextTurn: true
      });
      setBootError("");
      hydrateCampaign(result.campaign);
      focusCombatTurnFromState(result.combat ?? result.campaign.activeCombat);
    } catch (error) {
      handleProtectedActionError(error, "Не удалось переключить ход.");
    } finally {
      setCombatStateBusy(false);
    }
  };

  const declarePlayersVictory = async () => {
    if (!activeCampaignId || combatStateBusy || !activeCombat) {
      return;
    }

    if (!window.confirm("Показать игрокам экран победы и пометить врагов побеждёнными?")) {
      return;
    }

    try {
      setCombatStateBusy(true);
      const result = await api.updateCombatState(activeCampaignId, {
        playersVictory: true
      });
      setBootError("");
      hydrateCampaign(result.campaign);
    } catch (error) {
      handleProtectedActionError(error, "Не удалось отметить победу игроков.");
    } finally {
      setCombatStateBusy(false);
    }
  };

  const finishCombat = async () => {
    if (!activeCampaignId || !activeCombat) {
      return;
    }

    if (!window.confirm("Завершить бой, очистить активную сцену и посчитать опыт за всех врагов, которые уже выведены или имеют 0 HP?")) {
      return;
    }

    try {
      const finishedCombatId = activeCombat.id;
      setSaving(true);
      const result = await api.finishCombat(activeCampaignId);
      setCombatReport(result);
      hydrateCampaign(result.campaign);
      closeCombatSetupModal();
      navigateAfterCombatFinish(result.campaign, consumeCombatReturnTarget(finishedCombatId));
    } catch (error) {
      setBootError(error instanceof Error ? error.message : "Не удалось завершить бой.");
    } finally {
      setSaving(false);
    }
  };

  const previewPinned = previewEntity ? pinnedIds.includes(previewEntity.id) : false;
  const activeEntityPinned = activeEntity ? pinnedIds.includes(activeEntity.id) : false;
  const isCombatScreen = activeModule === "combat";
  const isCombatPrepScreen = isCombatScreen && combatSetupOpen && !activeCombat?.entries.length;
  const isItemsRail = activeRailAlias === "items";
  const isShopsRail = activeRailAlias === "shops";
  const hasFeatureOwnedDetailsPanel = isItemsRail || isShopsRail || activeModule === "rules";
  const latestCombatSummary =
    campaign?.lastCombatSummary ??
    (combatReport
      ? {
          combatId: combatReport.combatId,
          title: "Последний бой",
          outcome: "victory" as const,
          defeatedCount: combatReport.defeatedCount,
          totalExperience: combatReport.totalExperience,
          experiencePerPlayer: combatReport.experiencePerPlayer
        }
      : null);
  const hasActiveCombat = Boolean(activeCombat?.entries.length);
  const activeRailKey = railNavKeyFromView(activeModule, activeRailAlias);
  const activeSectionLabel = campaign ? railSectionTitle(campaign, activeModule, activeRailAlias) : "";
  const railNavItems: Array<{ key: RailNavKey; label: string; icon: RailIconName; onClick: () => void }> = [
    { key: "dashboard", label: "Главная", icon: "home", onClick: () => switchModule("dashboard") },
    { key: "quests", label: "Квесты", icon: "quest", onClick: () => switchModule("quests") },
    { key: "locations", label: "Локации", icon: "location", onClick: () => switchModule("locations") },
    { key: "players", label: "Игроки", icon: "player", onClick: () => switchModule("players") },
    { key: "npcs", label: "НПС", icon: "npc", onClick: () => switchModule("npcs") },
    { key: "monsters", label: "Монстры", icon: "monster", onClick: () => switchModule("monsters") },
    { key: "rules", label: "Правила", icon: "rule", onClick: () => openRulesCompendium() },
    { key: "items", label: railAliasTitle.items ?? "Items", icon: "item", onClick: () => openRailAlias("items") },
    { key: "shops", label: "Магазин", icon: "shop", onClick: () => openRailAlias("shops") },
    { key: "events", label: railAliasTitle.events ?? "Events", icon: "event", onClick: () => openRailAlias("events") },
    { key: "notes", label: railAliasTitle.notes ?? "Notes", icon: "note", onClick: () => openRailAlias("notes") }
  ];
  const combatSetupHostEntity =
    entityCombatSetupTarget && isPreparedCombatHostEntity(entityCombatSetupTarget) ? entityCombatSetupTarget : null;

  const renderPreparedCombatSection = (entity: PreparedCombatHostEntity): ReactNode => {
    return (
      <PreparedCombatList
        entity={entity}
        entityMap={entityMap}
        hasActiveCombatEntries={Boolean(activeCombat?.entries.length)}
        onCreateCard={() => openNewEntityPreparedCombatSetup(entity)}
        onDeleteCard={(_, index, title) =>
          requestPreparedCombatCardDeletion(
            entity,
            {
              title,
              playersText: "",
              enemiesText: "",
              xpText: ""
            },
            index
          )
        }
        onOpenCard={(plan, index) => openEntityPreparedCombatSetup(entity, plan, index, false)}
        onStartCard={(plan, index) => {
          void startEntityPreparedCombat(entity, plan, index);
        }}
      />
    );
  };

  const combatDifficultyToneClass = draftEncounterDifficulty ? `difficulty-${draftEncounterDifficulty}` : "difficulty-empty";
  const combatDangerText = draftEncounterDifficulty ? combatDifficultyLabel[draftEncounterDifficulty] : "Не рассчитана";
  const combatDangerThresholdText = draftEncounterDifficulty ? `${draftEncounterDifficultyThreshold} XP` : "—";
  const combatDangerDetailText =
    draftEncounterAdjustedXp > 0
      ? draftEncounterDifficulty
        ? `${draftEncounterAdjustedXp} XP с учётом множителя против порога ${combatDangerThresholdText}.`
        : `${draftEncounterAdjustedXp} XP с учётом множителя. Заполни уровни игроков, чтобы оценить сложность.`
      : "Добавь противников справа, чтобы увидеть итоговый XP с учётом множителя.";
  const combatEnemyMetricHint =
    draftEncounterMonsterCount > 0 ? `${draftEncounterMonsterCount} ${formatEnemyCountLabel(draftEncounterMonsterCount)}` : "Противников пока нет";
  const preparedCombatLevelMetricHint = draftPreparedCombatPlayerLevels.length
    ? `Из карточек игроков • Пороги: ${combatThresholdSummary}`
    : hasExplicitPartyLevels
      ? `Из сохранённого состава • Пороги: ${combatThresholdSummary}`
      : "Заполни уровни в карточках игроков";
  const combatMasterRecommendation =
    draftEncounterDifficulty === "deadly"
      ? "Сцена смертельно опасна. Снизь число врагов, добавь союзника или подготовь запасной план, если бой должен остаться честным."
      : draftEncounterDifficulty === "hard"
        ? "Сцена жёсткая. Хорошо подходит для кульминации или боя, где у партии есть тактическое преимущество."
        : draftEncounterDifficulty === "medium"
          ? "Нормальная боевая нагрузка. Бой должен ощущаться напряжённым, но без перегиба по риску."
          : draftEncounterDifficulty === "easy"
            ? "Лёгкая сцена. Подойдёт для разогрева, знакомства с врагом или короткой стычки без серьёзного риска."
            : "Выбери игроков и добавь противников, чтобы получить точную оценку опасности.";

  const combatPrepPage =
    campaign ? (
      <CombatPrepPage
        battlefieldPanelProps={{
          campaignPreparedCombatDraftEnemyCount,
          draftPreparedCombatAllyCount,
          draftPreparedCombatAllies,
          draftPreparedCombatEnemies,
          draftPreparedCombatPlayers,
          onAllyInitiativeChange: setPreparedCombatAllyInitiative,
          onEnemyInitiativeChange: setPreparedCombatEnemyInitiative,
          onEnemyQuantityChange: (entityId, quantity) => {
            updateCampaignPreparedCombatDraftItem(entityId, { quantity });
          },
          onPlayerInitiativeChange: setPreparedCombatPlayerInitiative,
          onRemoveAlly: removeCampaignPreparedCombatDraftAlly,
          onRemoveEnemy: removeCampaignPreparedCombatDraftItem,
          onTogglePlayer: toggleCampaignPreparedCombatPlayer,
          preparedCombatAllyInitiatives,
          preparedCombatEnemyInitiatives,
          preparedCombatPlayerInitiatives
        }}
        bestiaryPanelProps={{
          combatEnemyTypeFilter,
          combatEnemyTypeOptions,
          combatSearchQuery,
          combatSelectionId,
          filteredCombatCatalogItems,
          onAddEnemy: (item) => {
            void addCampaignPreparedCombatDraftItem(item);
          },
          onCombatEnemyTypeFilterChange: setCombatEnemyTypeFilter,
          onCombatSearchQueryChange: setCombatSearchQuery,
          onSelectCatalogItem: setCombatSelectionId
        }}
        bootError={bootError}
        canStartPreparedCombatDraft={canStartPreparedCombatDraft}
        campaignPreparedCombatNotice={campaignPreparedCombatNotice}
        campaignTitle={campaign.title}
        dangerProps={{
          combatDangerDetailText,
          combatDangerText,
          combatDangerThresholdText,
          combatDifficultyToneClass,
          combatEnemyMetricHint,
          combatLevelDisplayText,
          combatMasterRecommendation,
          draftEncounterAdjustedXp,
          draftEncounterBaseXp,
          draftEncounterDifficulty,
          effectiveCombatThresholds,
          preparedCombatLevelMetricHint
        }}
        enteredPartyLevel={enteredPartyLevel}
        hasExplicitPartyLevels={hasExplicitPartyLevels}
        hasHostEntity={Boolean(combatSetupHostEntity)}
        onBack={requestCombatSetupModalClose}
        onClear={clearPreparedCombatDraft}
        onSave={() => {
          void (combatSetupHostEntity ? saveEntityPreparedCombatDraft() : saveCampaignPreparedCombatDraft());
        }}
        onStart={() => {
          void startConfiguredCombat();
        }}
        partyCompositionText={partyCompositionText}
        partyPanelProps={{
          combatAllyCatalogItems,
          combatAllySearchQuery,
          combatPlayerCatalogItems,
          combatPlayerSearchQuery,
          draftPreparedCombatAllyCount,
          draftPreparedCombatPartyCount,
          draftPreparedCombatPlayers,
          onCombatAllySearchQueryChange: setCombatAllySearchQuery,
          onCombatPlayerSearchQueryChange: setCombatPlayerSearchQuery,
          onRequestSwapToEntity: (kind) => requestCombatSetupSwapToEntity(kind),
          onToggleAlly: toggleCampaignPreparedCombatAlly,
          onTogglePlayer: toggleCampaignPreparedCombatPlayer,
          selectedAllyIds: draftPreparedCombatAllyIds,
          selectedPlayerIds: campaignPreparedCombatDraft.playerIds
        }}
        saving={saving}
        sceneTitle={campaignPreparedCombatDraft.title?.trim() || "Грань Тени: бой"}
      />
    ) : null;

  if (authState === "checking") {
    return (
      <div className="boot">
        <div className="panel boot-card">
          <p className="eyebrow">Shadow Edge Ward</p>
          <h1>Проверяю ключ от мастерской</h1>
          <p>Поднимаю сессию и убеждаюсь, что кабинет можно открыть безопасно.</p>
        </div>
      </div>
    );
  }

  if (authState !== "authenticated") {
    return (
      <LoginScreen
        busy={authBusy}
        error={authError}
        onPasswordChange={setLoginPassword}
        onPasswordConfirmChange={setRegisterPasswordConfirm}
        onSubmit={submitAuth}
        onUsernameChange={setLoginUsername}
        password={loginPassword}
        passwordConfirm={registerPasswordConfirm}
        username={loginUsername}
      />
    );
  }

  if (booting) {
    return (
      <div className="boot">
        <div className="panel boot-card">
          <p className="eyebrow">Phase 1 Foundation</p>
          <h1>Собираем кабинет мастера</h1>
          <p>Загружаю кампанию, связи и рабочий shell для мастера.</p>
        </div>
      </div>
    );
  }

  if (!campaign) {
    return (
      <>
        <div className="boot">
          <div className="panel boot-card stack">
            <p className="eyebrow">Backend Connection</p>
            <h1>Сервер не отдал активную кампанию</h1>
            <p className="copy">
              Убедись, что backend запущен и доступен на текущем домене. Для локальной разработки это обычно `http://localhost:8080`. Текущая ошибка: {bootError || "кампании не найдены"}.
            </p>
            <div className="actions">
              <button className="primary" onClick={openCampaignModal} type="button">
                Создать кампанию
              </button>
            </div>
          </div>
        </div>
        <CampaignCreateModal
          form={campaignForm}
          onChange={updateCampaignForm}
          onClose={requestCampaignModalClose}
          onSubmit={() => {
            void submitCampaign();
          }}
          open={campaignModalOpen}
          saving={saving}
        />
      </>
    );
  }

  if (appRoute.mode === "initiative") {
    return (
        <InitiativeTrackerScreen
          activeCombat={campaign.activeCombat ?? null}
          lastCombatSummary={campaign.lastCombatSummary ?? null}
          busy={combatStateBusy}
          error={bootError}
          entityMap={entityMap}
        onNextTurn={() => void nextCombatTurn()}
        onSelectTurn={(entryId) => void setCombatTurn(entryId)}
      />
    );
  }

  return (
    <>
      <div
        className={`shell ${isCombatScreen ? "combat-layout" : ""} ${isCombatPrepScreen ? "combat-prep-shell" : ""} ${isItemsRail || isShopsRail ? "items-shell" : ""} ${isShopsRail ? "shops-shell" : ""} ${hasFeatureOwnedDetailsPanel ? "feature-owned-details-shell" : ""}`.trim()}
        style={shellStyle}
      >
        {!isCombatScreen ? (
          <AppSidebar
            activeCampaignId={activeCampaignId}
            activeRailKey={activeRailKey}
            authBusy={authBusy}
            authUsername={authUsername}
            campaigns={campaigns}
            inWorldDate={campaign.inWorldDate}
            items={railNavItems}
            onCampaignSelect={(campaignId) => {
              void handleCampaignSelect(campaignId);
            }}
            onCreateCampaign={openCampaignModal}
            onLogout={() => {
              void logout();
            }}
            pinnedCount={pinnedEntities.length}
            settingName={campaign.settingName}
          />
        ) : null}

        <main className={`center ${isCombatScreen ? "combat-center" : ""}`}>
          {isCombatScreen ? (
            <AppHeader
              activeCombatCount={activeCombat?.entries.length ?? 0}
              authBusy={authBusy}
              campaignTitle={campaign.title}
              combatTitle={activeCombat?.title ?? combatTitle}
              hasActiveCombat={hasActiveCombat}
              inWorldDate={campaign.inWorldDate}
              initiativeShareBusy={initiativeShareBusy}
              isCombatPlaylistActive={isCombatPlaylistActive}
              onCopyPublicInitiativeTracker={() => {
                void copyPublicInitiativeTrackerLink();
              }}
              onFinishCombat={() => {
                void finishCombat();
              }}
              onLogout={() => {
                void logout();
              }}
              onOpenCombatPlaylistModal={openCombatPlaylistModal}
              onOpenCombatSetupModal={() => openCombatSetupModal()}
              onOpenInitiativeTracker={openInitiativeTracker}
              onOpenPublicInitiativeTracker={openPublicInitiativeTracker}
              onPlayCombatPlaylist={() => playCombatPlaylist()}
              onReturnToApp={returnToApp}
              onSyncCombatPortraits={() => {
                void syncCombatPortraits();
              }}
              saving={saving}
              variant="combat"
            />
          ) : (
            <>
                <AppHeader
                  activeModule={activeModule}
                  authBusy={authBusy}
                  campaignTitle={campaign.title}
                  canOpenDirectory={
                    !isCombatScreen &&
                    activeModule !== "dashboard" &&
                    Boolean(activeEntity || (bestiaryController.isBrowseMode && bestiaryController.selectedBestiaryMonster))
                  }
                hasActiveCombat={hasActiveCombat}
                inWorldDate={campaign.inWorldDate}
                isCombatScreen={isCombatScreen}
                isItemsRail={hasFeatureOwnedDetailsPanel}
                onCreateEntity={() => openEntityModal()}
                onLogout={() => {
                  void logout();
                }}
                onOpenCombat={() => {
                  if (activeCombat?.entries.length) {
                    openCombatScreen();
                    return;
                  }
                  openCombatSetupModal();
                }}
                onOpenDirectory={() => openModuleDirectory(activeModule)}
                onOpenPinnedEntity={peekEntity}
                onOpenRandomEvent={openRandomEventModal}
                onOpenSearch={openPalette}
                pinnedEntities={pinnedEntities}
                variant="default"
              />

              {!hasFeatureOwnedDetailsPanel ? (
                <div className="panel tabs">
                  {tabs[activeModule].map((tab) => (
                    <button
                      key={tab}
                      className={`tab ${activeTab === tab ? "active" : ""}`}
                      onClick={() => {
                        setModuleEntitySearch("");
                        setActiveTab(tab);
                        if (activeModule !== "dashboard") {
                          setActiveEntityId("");
                          setPreviewEntityId("");
                        }
                        if (activeModule === "monsters") {
                          bestiaryController.resetBrowseSelection();
                        }
                        requestAnimationFrame(scrollContentToTop);
                      }}
                      type="button"
                    >
                      {tab}
                    </button>
                  ))}
                </div>
              ) : null}
            </>
          )}

          <section className={`panel content ${isCombatScreen ? "combat-content" : ""}`} ref={contentRef}>
            {activeModule === "dashboard" ? (
              <div className="stack wide">
                <section className="card hero">
                  <div className="hero-copy-block">
                    <p className="eyebrow">GM Cockpit</p>
                    <h1>{campaign.title}</h1>
                    <p className="copy">
                      Один кабинет для мира, квестов и живой сессии. Сущности открываются в центре без прыжков страницы,
                      а справа можно держать быстрый preview и закреплённые карточки.
                    </p>
                  </div>

                  <div className="actions">
                    <button className="primary" onClick={() => openEntity(dashboardLocationId)} type="button">
                      Открыть первую сущность
                    </button>
                    <button className="ghost" onClick={() => openPreview(dashboardQuestId)} type="button">
                      Preview квеста
                    </button>
                  </div>
                </section>

                <section className="stats">
                  {campaign.dashboardCards.map((card) => (
                    <article key={card.label} className="card stat">
                      <span className={badge(card.tone)}>{card.label}</span>
                      <strong>{card.value}</strong>
                      <p>{card.detail}</p>
                    </article>
                  ))}
                </section>

                <section className="split">
                  <article className="card section-card">
                    <div className="row muted">
                      <span>События</span>
                      <span>{campaign.events.length}</span>
                    </div>
                    <div className="stack">
                      {campaign.events.map((event) => (
                        <button key={event.id} className="card mini ghost fill" onClick={() => openWorldEvent(event.id)} type="button">
                          <div className="row">
                            <strong>{event.title}</strong>
                            <span className={badge(worldEventTypeTones[event.type])}>{worldEventTypeLabels[event.type]}</span>
                          </div>
                          <small>{event.locationLabel ? `${event.locationLabel} • ` : ""}{event.date}</small>
                          <p>{event.summary}</p>
                        </button>
                      ))}
                    </div>
                  </article>

                  <article className="card section-card">
                    <div className="row muted">
                      <span>Hot Entities</span>
                      <span>Быстрый переход</span>
                    </div>
                    <div className="stack">
                      {[...campaign.locations, ...campaign.npcs, ...campaign.monsters, ...campaign.quests, ...campaign.lore]
                        .slice(0, 4)
                        .map((entity) => (
                          <button key={entity.id} className="ghost fill" onClick={() => peekEntity(entity.id)} type="button">
                            {entity.title}
                          </button>
                        ))}
                    </div>
                  </article>
                </section>
              </div>
            ) : activeModule === "combat" ? (
              <CombatPage
                activeCombat={activeCombat}
                bootError={bootError}
                campaign={campaign}
                campaignPreparedCombat={campaignPreparedCombat}
                combatPartySummary={combatPartySummary}
                combatPortraitNotice={combatPortraitNotice}
                combatSetupOpen={combatSetupOpen}
                configuredCombatEnemies={configuredCombatEnemies}
                configuredCombatEnemyCount={configuredCombatEnemyCount}
                configuredCombatPlayers={configuredCombatPlayers}
                currentPlaybackTrackLabel={currentPlaybackTrackLabel}
                currentPlaybackTrackUrl={currentPlaybackTrackUrl}
                hasConfiguredCombat={hasConfiguredCombat}
                canStartConfiguredCombat={canStartConfiguredCombat}
                initiativePublishNotice={initiativePublishNotice}
                isCombatPlaylistActive={isCombatPlaylistActive}
                latestCombatSummary={latestCombatSummary}
                onCombatPartyLevelsChange={updateCombatPartyLevelText}
                onOpenCombatPlaylistModal={openCombatPlaylistModal}
                onOpenCombatSetupModal={() => openCombatSetupModal()}
                onOpenEntityPreview={peekEntity}
                onPlayCombatPlaylist={() => playCombatPlaylist()}
                onPlayCombatTrack={(index) => playCombatPlaylist(index, false)}
                onPlayNextRandomTrack={playNextRandomTrack}
                onStopPlayback={stopPlayback}
                prepContent={combatPrepPage}
                resolvedCombatPartyLevelsText={resolvedCombatPartyLevelsText}
                trackerProps={{
                  activeCombat,
                  bootError,
                  campaign,
                  combatPlayerEntityId,
                  combatPlayerInitiative,
                  combatPortraitNotice,
                  combatStateBusy,
                  currentPlaybackTrackLabel,
                  entityMap,
                  initiativePublishNotice,
                  initiativeShareBusy,
                  isCombatPlaylistActive,
                  onAddManualPlayer: () => void addManualPlayerToCombat(),
                  onChangeHitPoints: updateCombatHitPoints,
                  onChangeInitiative: updateCombatInitiative,
                  onCombatPlayerEntityIdChange: setCombatPlayerEntityId,
                  onCombatPlayerInitiativeChange: setCombatPlayerInitiative,
                  onCopyPublicTracker: () => void copyPublicInitiativeTrackerLink(),
                  onDeclarePlayersVictory: () => void declarePlayersVictory(),
                  onFinishCombat: () => void finishCombat(),
                  onNextTurn: () => void nextCombatTurn(),
                  onOpenCombatPlaylistModal: openCombatPlaylistModal,
                  onOpenCombatSetupModal: openCombatSetupModal,
                  onOpenPublicTracker: openPublicInitiativeTracker,
                  onOpenRandomEventModal: openRandomEventModal,
                  onPlayCombatPlaylist: () => playCombatPlaylist(),
                  onPlayNextRandomTrack: playNextRandomTrack,
                  onSelectEntry: selectCombatEntryById,
                  onSetTurn: (entryId) => void setCombatTurn(entryId),
                  onSyncCombatPortraits: () => void syncCombatPortraits(),
                  saving,
                  selectedEntity: selectedCombatEntity,
                  selectedEntry: selectedCombatEntry
                }}
              />
            ) : activeModule === "monsters" ||
              activeModule === "rules" ||
              activeRailAlias === "items" ||
              activeRailAlias === "shops" ||
              activeRailAlias === "events" ||
              activeModule === "lore" ||
              (activeEntity?.kind === "quest" && activeModule === "quests") ? (
              <AppContentRouter
                activeEntity={activeEntity}
                activeModule={activeModule}
                activeRailAlias={activeRailAlias}
                bestiaryContent={
                  <BestiaryPageContainer
                    activeMonster={activeEntity?.kind === "monster" ? activeEntity : null}
                    activeMonsterPinned={activeEntity?.kind === "monster" ? activeEntityPinned : false}
                    activeTab={activeTab}
                    composeVisibleQuickFacts={composeVisibleQuickFacts}
                    controller={bestiaryController}
                    currentPlaybackTrackLabel={currentPlaybackTrackLabel}
                    currentPlaybackTrackUrl={currentPlaybackTrackUrl}
                    entityByTitle={entityByTitle}
                    isEntityPlaylistActive={isEntityPlaylistActive}
                    onContentContextMenu={(entity, event) => entityLinkController.handleActiveEntityContentContextMenu(entity, "content", event)}
                    onCopyImageLink={handleCopyImageLink}
                    onEditEntity={openEntityEditor}
                    onOpenDirectory={() => openModuleDirectory("monsters", "Импорт")}
                    onOpenEntity={openEntity}
                    onOpenEntityActionMenu={openEntityActionMenu}
                    onOpenGallery={openEntityGalleryModal}
                    onOpenGalleryAlbum={openGalleryViewer}
                    onOpenGalleryViewer={openEntityGalleryViewer}
                    onOpenPlaylist={openEntityPlaylistModal}
                    onOpenPreview={openPreview}
                    onOpenRelatedEntity={openRelatedEntity}
                    onPlayNextPlaylistTrack={playNextRandomTrack}
                    onPlayPlaylist={playEntityPlaylist}
                    onResolveRelatedEntity={resolveLinkedEntity}
                    onStopPlayback={stopPlayback}
                    onTogglePin={togglePin}
                    playerFacing={playerFacing}
                  />
                }
                campaign={campaign}
                combatContent={null}
                createEmptyWorldEventDialogueBranch={createEmptyWorldEventDialogueBranch}
                currentPlaybackTrackLabel={currentPlaybackTrackLabel}
                editorRef={entityLinkController.noteEditorContentRef}
                emptyWorldEventInput={emptyWorldEventInput}
                entityMap={entityMap}
                entityToForm={entityToForm}
                hydrateCampaign={hydrateCampaign}
                focusedShopId={focusedShopId}
                initialEventId={selectedWorldEventId || undefined}
                isEntityPlaylistActive={isEntityPlaylistActive}
                legacyContent={null}
                normalizeWorldEventForClient={normalizeWorldEventForClient}
                notesContentContextMenu={entityLinkController.handleNoteContentContextMenu}
                onActiveEventChange={setSelectedWorldEventId}
                onEditEntity={openEntityEditor}
                onOpenDirectory={() => openModuleDirectory("quests")}
                onOpenEntity={openEntity}
                onOpenEventGenerator={openRandomEventModal}
                onOpenGallery={openEntityGalleryModal}
                onOpenGalleryViewer={openEntityGalleryViewer}
                onOpenPlaylist={openEntityPlaylistModal}
                onOpenPreview={openPreview}
                onOpenQuest={openQuestFocus}
                onPlayNextPlaylistTrack={playNextRandomTrack}
                onPlayPlaylist={playEntityPlaylist}
                onCopyImageLink={handleCopyImageLink}
                onTogglePin={togglePin}
                pinned={activeEntityPinned}
                playerFacing={playerFacing}
                preparedCombatSection={activeEntity?.kind === "quest" ? renderPreparedCombatSection(activeEntity) : null}
                questScopeEntities={questScopeEntities}
                resolveLinkedEntity={resolveLinkedEntity}
                rulesInitialQuery={rulesNavigationState.query || undefined}
                rulesInitialRuleId={rulesNavigationState.ruleId || undefined}
                rulesSelectionKey={rulesNavigationState.requestId}
                serializeEntityForm={serializeEntityForm}
                serializeWorldEventInput={serializeWorldEventInput}
                worldEventToForm={worldEventToForm}
              />
            ) : activeEntity ? (
              <EntityDetailsPage
                activeEntity={activeEntity}
                activeEntityPinned={activeEntityPinned}
                activeEntityPlayerCards={activeEntityPlayerCards}
                activeNpcQuests={activeNpcQuests}
                composeVisibleQuickFacts={composeVisibleQuickFacts}
                currentPlaybackTrackLabel={currentPlaybackTrackLabel}
                currentPlaybackTrackUrl={currentPlaybackTrackUrl}
                entityByTitle={entityByTitle}
                isEntityPlaylistActive={isEntityPlaylistActive}
                locationShops={activeEntity.kind === "location" ? campaign.shops.filter((shop) => shop.locationId === activeEntity.id) : []}
                onCopyImageLink={handleCopyImageLink}
                onContentContextMenu={(event) => entityLinkController.handleActiveEntityContentContextMenu(activeEntity, "content", event)}
                onCreatePlayerFacingCard={() => openNewPlayerFacingEditor(activeEntity)}
                onDeletePlayerFacingCard={(card, index) => requestPlayerFacingCardDeletion(activeEntity, card, index)}
                onEditEntity={() => openEntityEditor(activeEntity.id)}
                onEditPlayerFacingCard={(card, index) => openPlayerFacingEditor(activeEntity, card, index)}
                onOpenEntityActionMenu={(event) => openEntityActionMenu(activeEntity, event)}
                onOpenGallery={() => openEntityGalleryModal(activeEntity)}
                onOpenGalleryAlbum={openGalleryViewer}
                onOpenGalleryViewer={(index) => openEntityGalleryViewer(activeEntity, index)}
                onOpenNpcQuestModal={() => {
                  if (activeEntity.kind === "npc") {
                    openNpcQuestModal(activeEntity);
                  }
                }}
                onOpenPlayerFacingCard={(card, index) => openPlayerFacingView(activeEntity, card, { cardIndex: index })}
                onOpenPlaylistEditor={() => openEntityPlaylistModal(activeEntity)}
                onOpenPreview={() => openPreview(activeEntity.id)}
                onOpenRelatedEntity={openRelatedEntity}
                onOpenShop={openShopFromLocation}
                onPeekQuest={peekEntity}
                onPlayNextPlaylistTrack={playNextRandomTrack}
                onPlayPlaylist={(index, advanceIfActive) => playEntityPlaylist(activeEntity, index, advanceIfActive)}
                onResolveRelatedEntity={resolveLinkedEntity}
                onStopPlayback={stopPlayback}
                onTogglePin={() => togglePin(activeEntity.id)}
                preparedCombatSection={isPreparedCombatHostEntity(activeEntity) ? renderPreparedCombatSection(activeEntity) : null}
              />
            ) : (
              <EntityDirectoryScreen
                activeModule={activeModule}
                activeSectionLabel={activeSectionLabel}
                defaultCreateKind={defaultCreateKind}
                moduleDirectoryEntities={moduleDirectoryEntities}
                moduleEntitySearch={moduleEntitySearch}
                onChangeSearch={setModuleEntitySearch}
                onOpenEntity={openEntity}
                onOpenEntityActionMenu={openEntityActionMenu}
                onOpenEntityModal={openEntityModal}
                onOpenQuestFocus={openQuestFocus}
                onOpenRandomEventModal={openRandomEventModal}
                resolveQuestIssuer={resolveQuestIssuer}
                resolveQuestLocation={resolveQuestLocation}
                resolveQuestPreparedCombatEntries={resolveQuestPreparedCombatEntries}
              />
            )}
          </section>
        </main>

        {!isCombatScreen && !hasFeatureOwnedDetailsPanel ? (
          <AppPreviewPanel onPointerDown={(event) => startResize("preview", event)}>
          {bestiaryController.isBrowseMode ? (
            <BestiaryPreviewPanel controller={bestiaryController} />
          ) : (
            <AppPreviewContent
              combatPartyLevelsText={combatPartyLevelsText}
              combatPartySummary={combatPartySummary}
              composeVisibleQuickFacts={composeVisibleQuickFacts}
              currentPlaybackTrackLabel={currentPlaybackTrackLabel}
              currentPlaybackTrackUrl={currentPlaybackTrackUrl}
              effectiveCombatThresholds={effectiveCombatThresholds}
              hasActiveCombat={hasActiveCombat}
              hasExplicitPartyLevels={hasExplicitPartyLevels}
              isEntityPlaylistActive={isEntityPlaylistActive}
              onCombatPartyLevelsChange={updateCombatPartyLevelText}
              onCopyImageLink={handleCopyImageLink}
              onEdit={openEntityEditor}
              onOpenEntityPage={openEntity}
              onOpenEntityActionMenu={openEntityActionMenu}
              onOpenGallery={openEntityGalleryModal}
              onOpenGalleryViewer={openEntityGalleryViewer}
              onOpenPlayerView={openPlayerFacingView}
              onOpenPreviewEntity={openPreview}
              onOpenPlaylist={openEntityPlaylistModal}
              onOpenQuest={openQuestFocus}
              onOpenRandomEvent={openRandomEventModal}
              onOpenRelatedEntity={openRelatedEntity}
              onPlayNextPlaylistTrack={playNextRandomTrack}
              onPlayPlaylist={playEntityPlaylist}
              onRunCombat={handleQuestCombatAction}
              onStopPlayback={stopPlayback}
              onTogglePin={togglePin}
              previewEntity={previewEntity}
              previewPinned={previewPinned}
              previewQuest={previewQuest}
              previewQuestIssuer={previewQuestIssuer}
              previewQuestLinkedEntities={previewQuestLinkedEntities}
              previewQuestLocation={previewQuestLocation}
              previewQuestPreparedCombatEntries={previewQuestPreparedCombatEntries}
              previewQuestRelatedQuests={previewQuestRelatedQuests}
            />
          )}
          </AppPreviewPanel>
        ) : null}
      </div>

      {activePlayback && currentPlaybackTrack && currentPlaybackSource ? (
        <FloatingPlaylistPlayer
          onNext={playNextTrack}
          onPrevious={playPreviousTrack}
          onSelectTrack={playPlaybackIndex}
          onStop={stopPlayback}
          playback={activePlayback}
          source={currentPlaybackSource}
          track={currentPlaybackTrack}
          trackLabel={currentPlaybackTrackLabel}
        />
      ) : null}

      <EntityGalleryViewer
        onClose={closeGalleryViewer}
        onCopyLink={handleCopyImageLink}
        onSelect={selectGalleryViewerIndex}
        onShowToPlayers={showGalleryImageToPlayers}
        showToPlayersBusy={playerDisplayBusy}
        viewer={galleryViewer}
      />

      <GlobalSearchModal
        entityMap={entityMap}
        onChangeQuery={setQuery}
        onClose={requestPaletteClose}
        onOpenPrimaryResult={(result) => {
          if (result.type === "rule") {
            openRulesCompendium({
              query,
              ruleId: result.id
            });
            resetPalette();
            return;
          }

          openEntity(result.id);
          resetPalette();
        }}
        onOpenSecondaryResult={(result) => {
          if (result.type === "rule") {
            openRulesCompendium({
              query,
              ruleId: result.id
            });
            closePalette();
            return;
          }

          openEntity(result.id);
          openPreview(result.id);
          closePalette();
        }}
        open={paletteOpen}
        query={query}
        results={displayResults}
      />

      <CampaignCreateModal
        form={campaignForm}
        onChange={updateCampaignForm}
        onClose={requestCampaignModalClose}
        onSubmit={() => {
          void submitCampaign();
        }}
        open={campaignModalOpen}
        saving={saving}
      />

      <EntityPlaylistModal
        onAdd={addEntityPlaylistDraftTrack}
        onChange={updateEntityPlaylistDraftTrack}
        onClose={requestEntityPlaylistModalClose}
        onRemove={removeEntityPlaylistDraftTrack}
        onSave={saveEntityPlaylist}
        open={entityPlaylistModalOpen}
        saving={saving}
        target={entityPlaylistTarget}
        tracks={entityPlaylistDraft}
      />

      <EntityGalleryModal
        items={entityGalleryDraft}
        onAdd={addEntityGalleryDraftItem}
        onAddProjectImages={addProjectImagesToEntityGalleryDraft}
        onChange={updateEntityGalleryDraftItem}
        onClose={requestEntityGalleryModalClose}
        onRemove={removeEntityGalleryDraftItem}
        onSave={saveEntityGallery}
        onUpload={uploadEntityGalleryDraftFile}
        open={entityGalleryModalOpen}
        projectImages={projectGalleryImages}
        saving={saving}
        target={entityGalleryTarget}
        uploadDisabled={entityGalleryModalUploading}
        uploadingIndex={entityGalleryModalUploading ? Number.parseInt(galleryUploadKey.split(":")[1] ?? "-1", 10) : null}
      />

      {combatPlaylistModalOpen ? (
        <div className="overlay" role="presentation">
          <div className="panel palette form-modal combat-playlist-modal" onClick={(event) => event.stopPropagation()} role="dialog">
            <div className="row">
              <div>
                <p className="eyebrow">Combat Playlist</p>
                <strong>Один общий плейлист для всех боёв этой кампании</strong>
              </div>
              <button className="ghost" onClick={requestCombatPlaylistModalClose} type="button">
                Esc
              </button>
            </div>

            <PlaylistEditorSection
              hint="Обычно сюда удобно складывать атмосферные боевые YouTube-треки. Любой новый или старый бой будет пользоваться этим списком."
              onAdd={addCombatPlaylistTrack}
              onChange={updateCombatPlaylistTrack}
              onRemove={removeCombatPlaylistTrack}
              title="Боевой плейлист"
              tracks={combatPlaylistDraft}
            />

            <div className="actions">
              <button className="ghost" onClick={requestCombatPlaylistModalClose} type="button">
                Отмена
              </button>
              <button className="primary" disabled={saving} onClick={() => void saveCombatPlaylist()} type="button">
                {saving ? "Сохраняю..." : "Сохранить плейлист"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {combatSetupOpen && hasActiveCombat ? (
        <div className="overlay" role="presentation">
          <div className="panel palette form-modal combat-setup-modal" onClick={(event) => event.stopPropagation()} role="dialog">
            <div className="row">
              <div>
                <p className="eyebrow">Combat Setup</p>
                <strong>Добавь существующих врагов или сгенерируй encounter под нужную сложность</strong>
              </div>
              <div className="actions">
                <button
                  className="ghost"
                  onClick={() => {
                    requestCombatSetupSwapToEntity("monster");
                  }}
                  type="button"
                >
                  Новый монстр
                </button>
                <button className="ghost" onClick={requestCombatSetupModalClose} type="button">
                  Esc
                </button>
              </div>
            </div>

            {bootError ? (
              <div className="card mini form-error" role="status">
                <strong>Проблема при выполнении действия</strong>
                <p>{bootError}</p>
              </div>
            ) : null}

            <section className="card section-card combat-party-card">
              <div className="row muted">
                <span>Партия</span>
                <span>Один источник правды для расчёта сложности и генерации</span>
              </div>

              <div className="form-grid">
                <label className="field field-full">
                  <span>Уровень партии</span>
                  <input
                    className="input"
                    onChange={(event) => updateCombatPartyLevelText(event.target.value)}
                    placeholder="Например: 3"
                    value={resolvedCombatPartyLevelsText}
                  />
                </label>
              </div>

              <p className="copy combat-inline-note">
                {combatPartySummary}
              </p>
            </section>

            <section className="card section-card combat-tool-card">
              <div className="row muted">
                <span>Добавить из сущностей</span>
                <span>Поиск идёт по кампании и dnd.su, фильтр по CR работает для обоих источников</span>
              </div>

              <div className="form-grid">
                <label className="field field-full">
                  <span>Поиск по названию</span>
                  <input
                    className="input"
                    onChange={(event) => setCombatSearchQuery(event.target.value)}
                    placeholder="Ищи по имени: бандит, волк, giant spider, капитан..."
                    value={combatSearchQuery}
                  />
                </label>
                <label className="field">
                  <span>CR</span>
                  <select
                    className="input"
                  onChange={(event) => setCombatSearchChallenge(event.target.value)}
                  value={combatSearchChallenge}
                >
                    <option value="">Все значения</option>
                    {challengeFilterOptions.map((option) => (
                      <option key={option} value={option}>
                        {`CR ${option}`}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span>Количество</span>
                  <input
                    className="input"
                    min={1}
                    onChange={(event) => setCombatSelectionQuantity(Math.max(1, Number.parseInt(event.target.value, 10) || 1))}
                    type="number"
                    value={combatSelectionQuantity}
                  />
                </label>
                <label className="field">
                  <span>Инициатива</span>
                  <input
                    className="input"
                    onChange={(event) => setCombatSelectionInitiative(Number.parseInt(event.target.value, 10) || 0)}
                    type="number"
                    value={combatSelectionInitiative}
                  />
                </label>
                <label className="field field-full">
                  <span>Название боя</span>
                  <input className="input" onChange={(event) => setCombatTitle(event.target.value)} value={combatTitle} />
                </label>
              </div>

              <div className="combat-search-results">
                {combatSearchItems.length ? (
                  combatSearchItems.map((item) => (
                    <button
                      key={item.key}
                      className={`entity-row combat-search-result has-thumb ${combatSelectionId === item.key ? "active" : ""}`}
                      onClick={() => setCombatSelectionId(item.key)}
                      type="button"
                    >
                      <span className="entity-thumb-frame">
                        <img
                          alt={item.title}
                          className="entity-thumb"
                          loading="lazy"
                          src={
                            item.source === "entity" && item.entity
                              ? createPortraitSource(item.entity)
                              : item.bestiary
                                ? createBestiaryPortraitSource(item.bestiary)
                                : createPortraitSource({ kind: item.kind, title: item.title })
                          }
                        />
                      </span>
                      <span className="entity-row-copy">
                        <strong>{item.title}</strong>
                        <small>
                          {[
                            item.source === "bestiary" ? "dnd.su" : item.kind === "monster" ? "Кампания • монстр" : "Кампания • НПС",
                            item.challenge ? `CR ${extractChallengeToken(item.challenge)}` : "CR не задан",
                            item.subtitle || item.summary
                          ]
                            .filter(Boolean)
                            .join(" • ")}
                        </small>
                      </span>
                    </button>
                  ))
                ) : (
                  <p className="copy">
                    Ничего не найдено. Для монстров dnd.su введи название или выбери CR, а локальные НПС и монстры
                    фильтруются сразу.
                  </p>
                )}
              </div>

              {selectedCombatSearchProfile?.statBlock ? (
                <div className="combat-selected-summary">
                    <div className="row">
                      <span className={badge(selectedCombatSearchItem?.source === "bestiary" ? "accent" : "default")}>
                        {selectedCombatSearchItem?.source === "bestiary" ? "dnd.su" : "Кампания"}
                      </span>
                    <span className={badge("accent")}>{selectedCombatSearchProfile.statBlock.challenge ?? "CR не задан"}</span>
                    </div>
                  <strong>{selectedCombatSearchProfile.title}</strong>
                  <small>
                    КБ {selectedCombatSearchProfile.statBlock.armorClass} • ХП {selectedCombatSearchProfile.statBlock.hitPoints}
                  </small>
                  <small>{selectedCombatSearchProfile.summary}</small>
                </div>
              ) : null}

              {combatBestiaryLoading ? <p className="copy">Подтягиваю dnd.su под текущий поиск…</p> : null}

              <div className="actions">
                <button
                  className="primary"
                  disabled={saving || !combatSelectionId || !selectedCombatSearchItem}
                  onClick={() => void addExistingCombatants()}
                  type="button"
                >
                  {saving ? "Добавляю..." : "Добавить в бой"}
                </button>
              </div>
            </section>

            <section className="card section-card combat-tool-card">
              <div className="row muted">
                <span>Автогенерация encounter</span>
                <span>Кампания, мир и параметры партии уходят в генерацию как контекст</span>
              </div>

              <div className="form-grid">
                <label className="field field-full">
                  <span>Что нужно сгенерировать</span>
                  <textarea
                    className="input textarea"
                    onChange={(event) => setCombatPrompt(event.target.value)}
                    placeholder="Например: бандитская засада у тракта, 5 врагов, один лидер"
                    value={combatPrompt}
                  />
                </label>
                <label className="field">
                  <span>Сложность</span>
                  <select
                    className="input"
                    onChange={(event) => setCombatDifficulty(event.target.value as CombatDifficulty)}
                    value={combatDifficulty}
                  >
                    <option value="easy">Легко</option>
                    <option value="medium">Средне</option>
                    <option value="hard">Сложно</option>
                    <option value="deadly">Смертельно</option>
                    <option value="custom">Своя сложность</option>
                  </select>
                </label>
                <label className="field">
                  <span>Монстров</span>
                  <input
                    className="input"
                    max={12}
                    min={1}
                    onChange={(event) => setCombatMonsterCount(clamp(Number.parseInt(event.target.value, 10) || 1, 1, 12))}
                    type="number"
                    value={combatMonsterCount}
                  />
                </label>
                <label className="field">
                  <span>Название боя</span>
                  <input className="input" onChange={(event) => setCombatTitle(event.target.value)} value={combatTitle} />
                </label>
                {combatDifficulty === "custom" ? (
                  <label className="field field-full">
                    <span>Своя сложность: adjusted XP противников</span>
                    <input
                      className="input"
                      min={1}
                      onChange={(event) => setCombatCustomAdjustedXp(Math.max(0, Number.parseInt(event.target.value, 10) || 0))}
                      placeholder="Например: 2000"
                      type="number"
                      value={combatCustomAdjustedXp || ""}
                    />
                  </label>
                ) : null}
              </div>

              <p className="copy combat-inline-note">
                {hasExplicitPartyLevels
                  ? `Для расчёта сейчас используется ${effectivePartySize} ${
                      effectivePartySize === 1 ? "игрок" : effectivePartySize < 5 ? "игрока" : "игроков"
                    }: ${effectivePartyLevels.join(", ")} уровни.`
                  : "Сначала укажи общий уровень партии, затем генерируй encounter."}
              </p>

              <div className="combat-threshold-grid">
                <article className="card mini fact-box">
                  <small>Easy</small>
                  <strong className="fact-value">{effectiveCombatThresholds.easy}</strong>
                </article>
                <article className="card mini fact-box">
                  <small>Medium</small>
                  <strong className="fact-value">{effectiveCombatThresholds.medium}</strong>
                </article>
                <article className="card mini fact-box">
                  <small>Hard</small>
                  <strong className="fact-value">{effectiveCombatThresholds.hard}</strong>
                </article>
                <article className="card mini fact-box">
                  <small>Deadly</small>
                  <strong className="fact-value">{effectiveCombatThresholds.deadly}</strong>
                </article>
              </div>

              <div className="actions">
                <button
                  className="primary"
                  disabled={
                    generating ||
                    !hasExplicitPartyLevels ||
                    (combatDifficulty === "custom" && combatCustomAdjustedXp <= 0)
                  }
                  onClick={() => void generateCombatEncounter()}
                  type="button"
                >
                  {generating ? "Генерирую бой..." : "Сгенерировать бой"}
                </button>
              </div>

              {generating ? (
                <DndGenerationProgress
                  detail="Собираю контекст кампании и отправляю запрос на сборку encounter. Это живой индикатор процесса, не точный процент."
                  steps={combatGenerationSteps}
                  title="Оракул собирает бой"
                />
              ) : null}
            </section>
          </div>
        </div>
      ) : null}

      <EntityEditorModal
        campaign={campaign}
        controller={entityEditor}
        entityGenerationSteps={entityGenerationSteps}
        error={bootError}
        generating={generating}
        onClose={requestEntityModalClose}
        onContentContextMenu={entityLinkController.handleEntityContentContextMenu}
        saving={saving}
      />

      <RandomEventModal
        campaign={campaign}
        generating={randomEventGenerating}
        generationSteps={randomEventGenerationSteps}
        notes={randomEventNotes}
        onChangeDestinationId={setRandomEventDestinationId}
        onChangePrompt={setRandomEventPrompt}
        onClose={requestRandomEventModalClose}
        onGenerate={() => {
          void generateRandomEvent();
        }}
        open={randomEventModalOpen}
        prompt={randomEventPrompt}
        selectedDestinationId={randomEventDestinationId}
      />

      <PlayerFacingController controller={playerFacing} onClose={requestPlayerFacingViewClose} />

      <PreparedCombatModal
        bootError={bootError}
        entityMap={entityMap}
        notice={preparedCombatNotice}
        open={preparedCombatModalOpen}
        preparedCombatBestiaryLoading={preparedCombatBestiaryLoading}
        preparedCombatChallenge={preparedCombatChallenge}
        preparedCombatDraft={preparedCombatDraft}
        preparedCombatQuantity={preparedCombatQuantity}
        preparedCombatSearchItems={preparedCombatSearchItems}
        preparedCombatSearchQuery={preparedCombatSearchQuery}
        questTitle={preparedCombatQuest?.title ?? ""}
        saving={saving}
        selectedPreparedCombatSearchItem={selectedPreparedCombatSearchItem}
        onAddEnemy={() => void addPreparedCombatDraftItem()}
        onChangeChallenge={setPreparedCombatChallenge}
        onChangeQuantity={setPreparedCombatQuantity}
        onChangeSearchQuery={setPreparedCombatSearchQuery}
        onChangeTitle={updatePreparedCombatTitle}
        onClose={requestPreparedCombatModalClose}
        onPeekEntity={peekEntity}
        onRemoveEnemy={removePreparedCombatDraftItem}
        onSave={() => void savePreparedCombatDraft()}
        onSelectItem={setPreparedCombatSelectionId}
        onUpdateEnemyQuantity={(entityId, quantity) => updatePreparedCombatDraftItem(entityId, { quantity })}
      />

      <EntityActionMenu
        menu={entityActionMenu}
        onClose={closeEntityActionMenu}
        onRequestDelete={requestEntityDeletion}
        target={entityActionMenuTarget}
      />
      <EntityDeleteDialog
        entity={pendingDeleteEntity}
        onCancel={cancelEntityDeletion}
        onConfirm={(entity) => {
          void confirmEntityDeletion(entity);
        }}
        saving={saving}
      />

      <EntityLinkContextMenu controller={entityLinkController} />
      <EntityLinkPickerModal controller={entityLinkController} onClose={requestEntityLinkModalClose} />

      <CloseConfirmDialog
        onCancel={cancelModalCloseRequest}
        onConfirm={confirmModalCloseRequest}
        state={closeConfirmState}
      />
    </>
  );
}

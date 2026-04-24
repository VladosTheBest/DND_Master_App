import "@shadow-edge/design-tokens/theme.css";
import loginBgUrl from "./assets/login-bg.jpg";
import victoryBloodOverlayUrl from "./assets/victory-blood-overlay.png";
import { createApiClient } from "@shadow-edge/api-client";
import type {
  ActiveCombat,
  AbilityKey,
  AbilityScores,
  AuthSessionResult,
  BestiaryBrowseResult,
  BestiaryMonsterDetail,
  BestiaryMonsterSummary,
  CampaignData,
  CampaignPreparedCombat,
  CampaignSummary,
  CombatDifficulty,
  CombatEntry,
  CombatResult,
  CombatThresholds,
  CreateCampaignInput,
  CreateEntityInput,
  CreateEntityResult,
  EntityKind,
  FinishCombatResult,
  GalleryImage,
  GenerateEntityDraftResult,
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
  PlaylistTrack,
  PreparedCombatItem,
  PreparedCombatPlan,
  QuestEntity,
  QuickFactTone,
  RelatedEntity,
  SearchResult,
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
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode
} from "react";

declare global {
  interface Window {
    YT?: {
      Player: new (element: string | HTMLElement, options: Record<string, unknown>) => {
        destroy?: () => void;
        loadVideoById?: (options: Record<string, unknown> | string) => void;
        playVideo?: () => void;
        pauseVideo?: () => void;
        seekTo?: (seconds: number, allowSeekAhead?: boolean) => void;
        getCurrentTime?: () => number;
        getDuration?: () => number;
        setVolume?: (volume: number) => void;
      };
      PlayerState: {
        UNSTARTED: number;
        ENDED: number;
        PLAYING: number;
        PAUSED: number;
        BUFFERING: number;
        CUED: number;
      };
    };
    onYouTubeIframeAPIReady?: () => void;
    __shadowEdgeYouTubeApiPromise?: Promise<NonNullable<Window["YT"]>>;
  }
}

const tabs: Record<ModuleId, string[]> = {
  dashboard: ["Snapshot", "Prep"],
  combat: ["Encounter"],
  locations: ["All", "Cities", "Regions", "Dungeons", "POI"],
  players: ["All", "Active", "Reserve", "Guest"],
  npcs: ["All", "Critical", "Allies", "Threats"],
  monsters: ["Catalog", "Imported", "Named NPC", "Classic"],
  quests: ["All", "Active", "Paused", "Completed"],
  lore: ["All", "GM Only", "Player Safe", "Threat Files"]
};

const moduleByKind: Record<EntityKind, ModuleId> = {
  location: "locations",
  player: "players",
  npc: "npcs",
  monster: "monsters",
  quest: "quests",
  lore: "lore"
};

const gradients: Record<EntityKind, string> = {
  location: "linear-gradient(135deg, rgba(124,166,255,.88), rgba(68,93,148,.72))",
  player: "linear-gradient(135deg, rgba(109,221,205,.9), rgba(27,109,129,.74))",
  npc: "linear-gradient(135deg, rgba(126,214,161,.88), rgba(46,119,85,.74))",
  monster: "linear-gradient(135deg, rgba(229,124,98,.92), rgba(127,44,38,.78))",
  quest: "linear-gradient(135deg, rgba(241,192,125,.9), rgba(176,105,38,.76))",
  lore: "linear-gradient(135deg, rgba(192,153,255,.88), rgba(96,73,150,.76))"
};

const kindTitle: Record<EntityKind, string> = {
  location: "Локация",
  player: "Игрок",
  npc: "НПС",
  monster: "Монстр",
  quest: "Квест",
  lore: "Лор"
};

const combatDifficultyLabel: Record<CombatDifficulty, string> = {
  easy: "Легко",
  medium: "Средне",
  hard: "Сложно",
  deadly: "Смертоносно",
  custom: "Своя сложность"
};

const challengeFilterOptions = [
  "0",
  "1/8",
  "1/4",
  "1/2",
  "1",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "10",
  "11",
  "12",
  "13",
  "14",
  "15",
  "16",
  "17",
  "18",
  "19",
  "20",
  "21",
  "22",
  "23",
  "24",
  "25",
  "26",
  "27",
  "28",
  "29",
  "30"
] as const;

const worldEventTypeOptions = ["funny", "combat", "heist", "social", "oddity", "danger"] as const satisfies readonly WorldEventType[];
const worldEventTypeLabels: Record<WorldEventType, string> = {
  funny: "Смешное",
  combat: "Бой",
  heist: "Ограбление",
  social: "Социальное",
  oddity: "Странное",
  danger: "Опасное"
};
const worldEventTypeTones: Record<WorldEventType, QuickFactTone> = {
  funny: "accent",
  combat: "danger",
  heist: "warning",
  social: "success",
  oddity: "accent",
  danger: "warning"
};

const entityGenerationSteps = ["Собираю контекст кампании", "Зову оракула", "Вписываю черновик в форму"];
const combatGenerationSteps = ["Считаю силу партии", "Подбираю противников", "Собираю бой для стола"];
const randomEventGenerationSteps = ["Читаю контекст локации", "Плету маленькую сцену", "Собираю реплики и лут"];

const toneClass: Record<QuickFactTone, string> = {
  default: "tone-default",
  accent: "tone-accent",
  success: "tone-success",
  warning: "tone-warning",
  danger: "tone-danger"
};

const abilityLabels: Array<{ key: AbilityKey; label: string }> = [
  { key: "str", label: "СИЛ" },
  { key: "dex", label: "ЛОВ" },
  { key: "con", label: "ТЕЛ" },
  { key: "int", label: "ИНТ" },
  { key: "wis", label: "МДР" },
  { key: "cha", label: "ХАР" }
];

const emptyCampaignForm = (): CreateCampaignInput => ({
  title: "",
  system: "D&D 5e",
  settingName: "",
  inWorldDate: "",
  summary: ""
});

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

const emptyEntityForm = (kind: EntityKind = "location"): CreateEntityInput => ({
  kind,
  title: "",
  subtitle: "",
  summary: "",
  content: "",
  playerContent: kind === "npc" || kind === "quest" ? "" : undefined,
  tags: [],
  playlist: [],
  gallery: [],
  category: kind === "location" ? "City" : kind === "lore" ? "History" : undefined,
  region: kind === "location" ? "" : undefined,
  danger: kind === "location" ? "Tense" : undefined,
  role: kind === "player" || kind === "npc" || kind === "monster" ? "" : undefined,
  status:
    kind === "player"
      ? "Active"
      : kind === "npc"
      ? "Unknown"
      : kind === "monster"
        ? "Hostile"
        : kind === "quest"
          ? "active"
          : undefined,
  importance:
    kind === "npc" ? "Major" : kind === "monster" ? "Standard" : undefined,
  statBlock: kind === "player" || kind === "npc" || kind === "monster" ? createEmptyNpcStatBlock() : undefined,
  rewardProfile: kind === "npc" || kind === "monster" || kind === "quest" ? createEmptyMonsterRewardProfile() : undefined,
  urgency: kind === "quest" ? "Medium" : undefined,
  preparedCombat: kind === "quest" ? { title: "", items: [] } : undefined,
  visibility: kind === "lore" ? "gm_only" : undefined
});

type ResizeKey = "rail" | "list" | "preview";
type EntityModalMode = "create" | "edit";
type StatEntrySectionKey = "traits" | "actions" | "bonusActions" | "reactions";
type CombatProfileEntity = PlayerEntity | NpcEntity | MonsterEntity;
type RewardableEntity = NpcEntity | MonsterEntity | QuestEntity;
type RailAlias = "items" | "events" | "notes";
type RailNavKey = "dashboard" | "locations" | "players" | "npcs" | "monsters" | "quests" | RailAlias;
type RailIconName = "brand" | "home" | "quest" | "location" | "player" | "npc" | "monster" | "item" | "event" | "note";
type EntityTextField = "content" | "playerContent";
type LinkableTextField = EntityTextField | "noteContent";
type LoreNoteEntity = Extract<KnowledgeEntity, { kind: "lore" }>;
type EntityLinkSelection = {
  mode: "editor" | "entity" | "noteEditor";
  field: LinkableTextField;
  start: number;
  end: number;
  text: string;
  x: number;
  y: number;
  entityId?: string;
};
type CombatSearchItem = {
  key: string;
  source: "entity" | "bestiary";
  id: string;
  kind: "npc" | "monster";
  title: string;
  subtitle: string;
  summary: string;
  challenge: string;
  entity?: CombatProfileEntity;
  bestiary?: BestiaryMonsterSummary;
};
type PreparedCombatStartEntry = {
  key: string;
  entityId: string;
  entityKind: CombatEntry["entityKind"];
  side: CombatEntry["side"];
  title: string;
  initiative: number;
};
type AppRouteState =
  | { mode: "app" }
  | {
      mode: "initiative";
      campaignId: string;
    };
type PortraitEntityLike = {
  kind: EntityKind;
  title: string;
  art?: HeroArt;
};
type GalleryViewerState = {
  ownerId: string;
  ownerTitle: string;
  items: GalleryImage[];
  currentIndex: number;
};
type PlaylistOwnerScope = "entity" | "combat";
type ActivePlaylistPlayback = {
  scope: PlaylistOwnerScope;
  ownerId: string;
  ownerTitle: string;
  tracks: PlaylistTrack[];
  currentIndex: number;
  token: number;
};

const NEW_LORE_NOTE_ID = "__new_lore_note__";
const NEW_WORLD_EVENT_ID = "__new_world_event__";

const resolveApiBaseUrl = () => {
  const configured = import.meta.env.VITE_API_BASE_URL;
  if (configured) {
    return configured;
  }

  return "";
};

const api = createApiClient(resolveApiBaseUrl());

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const isBestiaryBrowseTab = (moduleId: ModuleId, tab: string) => moduleId === "monsters" && tab !== "Imported";
const combatSelectionEntityKey = (id: string) => `entity:${id}`;
const combatSelectionBestiaryKey = (id: string) => `bestiary:${id}`;
const isCombatSelectionEntityKey = (value: string) => value.startsWith("entity:");
const isCombatSelectionBestiaryKey = (value: string) => value.startsWith("bestiary:");
const unwrapCombatSelectionKey = (value: string) => {
  const separator = value.indexOf(":");
  return separator >= 0 ? value.slice(separator + 1) : value;
};

const createEmptyStatEntry = (): StatBlockEntry => ({
  name: "",
  subtitle: "",
  toHit: "",
  damage: "",
  saveDc: "",
  description: ""
});

const createEmptySpellSlot = (): SpellSlotSummary => ({
  level: "1st",
  slots: "2"
});

const createEmptyPlaylistTrack = (): PlaylistTrack => ({
  title: "",
  url: ""
});

const createEmptyGalleryImage = (): GalleryImage => ({
  title: "",
  url: "",
  caption: ""
});

const createEmptySpellcasting = (): SpellcastingBlock => ({
  title: "Spellcasting",
  ability: "INT",
  saveDc: "13",
  attackBonus: "+5",
  slots: [],
  spells: [],
  description: ""
});

const createDefaultAbilityScores = (): AbilityScores => ({
  str: 10,
  dex: 10,
  con: 10,
  int: 10,
  wis: 10,
  cha: 10
});

const createEmptyMonsterLootEntry = (): MonsterLootEntry => ({
  name: "",
  category: "Лут",
  quantity: "",
  check: "",
  dc: "",
  details: ""
});

const createEmptyMonsterRewardProfile = (): MonsterRewardProfile => ({
  summary: "",
  loot: [createEmptyMonsterLootEntry()]
});

const createEmptyWorldEventDialogueBranch = (): WorldEventDialogueBranch => ({
  title: "",
  lines: [""],
  outcome: ""
});

const createEmptyNpcStatBlock = (): NpcStatBlock => ({
  size: "Medium",
  creatureType: "humanoid",
  alignment: "neutral",
  armorClass: "",
  hitPoints: "",
  speed: "30 ft.",
  proficiencyBonus: "+2",
  challenge: "",
  senses: "",
  languages: "",
  savingThrows: "",
  skills: "",
  resistances: "",
  immunities: "",
  conditionImmunities: "",
  abilityScores: createDefaultAbilityScores(),
  traits: [createEmptyStatEntry()],
  actions: [createEmptyStatEntry()],
  bonusActions: [],
  reactions: [],
  spellcasting: null
});

const createDefaultCombatThresholds = (): CombatThresholds => ({
  easy: 100,
  medium: 200,
  hard: 300,
  deadly: 400
});

const extractChallengeToken = (value?: string) => {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) {
    return "";
  }

  const match = trimmed.match(/^([0-9]+(?:\/[0-9]+)?)/);
  return match?.[1] ?? trimmed;
};

const getEntityChallenge = (entity: Pick<CombatProfileEntity, "statBlock">) =>
  extractChallengeToken(entity.statBlock?.challenge);

const partyThresholdTable: Record<number, CombatThresholds> = {
  1: { easy: 25, medium: 50, hard: 75, deadly: 100 },
  2: { easy: 50, medium: 100, hard: 150, deadly: 200 },
  3: { easy: 75, medium: 150, hard: 225, deadly: 400 },
  4: { easy: 125, medium: 250, hard: 375, deadly: 500 },
  5: { easy: 250, medium: 500, hard: 750, deadly: 1100 },
  6: { easy: 300, medium: 600, hard: 900, deadly: 1400 },
  7: { easy: 350, medium: 750, hard: 1100, deadly: 1700 },
  8: { easy: 450, medium: 900, hard: 1400, deadly: 2100 },
  9: { easy: 550, medium: 1100, hard: 1600, deadly: 2400 },
  10: { easy: 600, medium: 1200, hard: 1900, deadly: 2800 },
  11: { easy: 800, medium: 1600, hard: 2400, deadly: 3600 },
  12: { easy: 1000, medium: 2000, hard: 3000, deadly: 4500 },
  13: { easy: 1100, medium: 2200, hard: 3400, deadly: 5100 },
  14: { easy: 1250, medium: 2500, hard: 3800, deadly: 5700 },
  15: { easy: 1400, medium: 2800, hard: 4300, deadly: 6400 },
  16: { easy: 1600, medium: 3200, hard: 4800, deadly: 7200 },
  17: { easy: 2000, medium: 3900, hard: 5900, deadly: 8800 },
  18: { easy: 2100, medium: 4200, hard: 6300, deadly: 9500 },
  19: { easy: 2400, medium: 4900, hard: 7300, deadly: 10900 },
  20: { easy: 2800, medium: 5700, hard: 8500, deadly: 12700 }
};

const clampPartyLevel = (value: number) => clamp(value, 1, 20);

const derivePartyLevels = (raw: string) => {
  const parsed = raw
    .split(/[\s,;]+/)
    .map((part) => Number.parseInt(part.trim(), 10))
    .filter((value) => Number.isFinite(value))
    .map((value) => clampPartyLevel(value));
  return parsed;
};

const computeEncounterThresholds = (levels: number[], fallback: CombatThresholds): CombatThresholds => {
  if (!levels.length) {
    return fallback;
  }

  return levels.reduce<CombatThresholds>(
    (totals, level) => {
      const perCharacter = partyThresholdTable[clampPartyLevel(level)] ?? fallback;
      return {
        easy: totals.easy + perCharacter.easy,
        medium: totals.medium + perCharacter.medium,
        hard: totals.hard + perCharacter.hard,
        deadly: totals.deadly + perCharacter.deadly
      };
    },
    { easy: 0, medium: 0, hard: 0, deadly: 0 }
  );
};

const cloneStatEntries = (entries: StatBlockEntry[] = []) => entries.map((entry) => ({ ...entry }));

const cloneMonsterRewardProfile = (profile?: MonsterRewardProfile): MonsterRewardProfile | undefined =>
  profile
    ? {
        ...profile,
        loot: profile.loot.map((entry) => ({ ...entry }))
      }
    : undefined;

const clonePreparedCombatPlan = (plan?: PreparedCombatPlan): PreparedCombatPlan | undefined =>
  plan
    ? {
        title: plan.title,
        items: (plan.items ?? []).map((item) => ({ ...item }))
      }
    : undefined;

const createEmptyCampaignPreparedCombat = (): CampaignPreparedCombat => ({
  title: "",
  playerIds: [],
  items: []
});

const cloneCampaignPreparedCombat = (plan?: CampaignPreparedCombat | null): CampaignPreparedCombat =>
  plan
    ? {
        title: plan.title,
        playerIds: [...(plan.playerIds ?? [])],
        items: (plan.items ?? []).map((item) => ({ ...item }))
      }
    : createEmptyCampaignPreparedCombat();

const clonePlaylistTracks = (tracks?: PlaylistTrack[]): PlaylistTrack[] | undefined =>
  tracks ? tracks.map((track) => ({ ...track })) : undefined;

const cloneGalleryImages = (items?: GalleryImage[]): GalleryImage[] | undefined =>
  items ? items.map((item) => ({ ...item })) : undefined;

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

const normalizeEntityForClient = <T extends KnowledgeEntity>(entity: T): T => ({
  ...entity,
  tags: entity.tags ?? [],
  quickFacts: entity.quickFacts ?? [],
  related: entity.related ?? [],
  playlist: entity.playlist ?? [],
  gallery: entity.gallery ?? [],
  ...(("rewardProfile" in entity
    ? {
        rewardProfile: normalizeRewardProfileForClient(entity.rewardProfile)
      }
    : {}) as Partial<T>),
  ...(("preparedCombat" in entity
    ? {
        preparedCombat: entity.preparedCombat
          ? {
              title: entity.preparedCombat.title,
              items: entity.preparedCombat.items ?? []
            }
          : undefined
      }
    : {}) as Partial<T>)
});

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

const worldEventExcerpt = (event: Pick<WorldEvent, "summary" | "sceneText">, max = 120) =>
  truncateInlineText(event.summary?.trim() || event.sceneText?.trim() || "Сценка ещё не заполнена.", max);

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

const entityToForm = (entity: KnowledgeEntity): CreateEntityInput => ({
  kind: entity.kind,
  title: entity.title,
  subtitle: entity.subtitle,
  summary: entity.summary,
  content: entity.content,
  playerContent: entity.playerContent,
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
  preparedCombat: entity.kind === "quest" ? clonePreparedCombatPlan(entity.preparedCombat) ?? { title: "", items: [] } : undefined,
  visibility: "visibility" in entity ? entity.visibility : undefined
});

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

const sanitizePreparedCombatPlan = (plan?: PreparedCombatPlan): PreparedCombatPlan | undefined => {
  if (!plan) {
    return undefined;
  }

  const title = sanitizeOptionalText(plan.title);
  const items = plan.items
    .map((item) => ({
      entityId: item.entityId.trim(),
      quantity: Number.isFinite(item.quantity) ? Math.max(1, Math.floor(item.quantity)) : 1
    }))
    .filter((item) => item.entityId);

  if (!title && !items.length) {
    return undefined;
  }

  return {
    title,
    items
  };
};

const sanitizeCampaignPreparedCombat = (plan?: CampaignPreparedCombat | null): CampaignPreparedCombat | null => {
  if (!plan) {
    return null;
  }

  const title = sanitizeOptionalText(plan.title);
  const playerIds = Array.from(
    new Set(
      (plan.playerIds ?? [])
        .map((playerId) => playerId.trim())
        .filter(Boolean)
    )
  );
  const items = (plan.items ?? [])
    .map((item) => ({
      entityId: item.entityId.trim(),
      quantity: Number.isFinite(item.quantity) ? Math.max(1, Math.floor(item.quantity)) : 1
    }))
    .filter((item) => item.entityId);

  if (!title && !playerIds.length && !items.length) {
    return null;
  }

  return {
    title,
    playerIds,
    items
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
  const common = {
    kind: form.kind,
    title: form.title.trim(),
    subtitle: form.subtitle.trim(),
    summary: form.summary.trim(),
    content: form.content.trim(),
    playerContent: sanitizeOptionalText(form.playerContent),
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
        parentId: sanitizeOptionalText(form.parentId)
      };
    case "player":
      return {
        ...common,
        kind: "player",
        role: form.role?.trim() ?? "",
        status: form.status as CreateEntityInput["status"],
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
        preparedCombat: sanitizePreparedCombatPlan(form.preparedCombat)
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

const moduleEntities = (campaign: CampaignData, moduleId: ModuleId) => {
  if (moduleId === "locations") return campaign.locations;
  if (moduleId === "players") return campaign.players;
  if (moduleId === "npcs") return campaign.npcs;
  if (moduleId === "monsters") return campaign.monsters;
  if (moduleId === "quests") return campaign.quests;
  if (moduleId === "lore") return campaign.lore;
  return [];
};

const badge = (tone?: QuickFactTone) => `badge ${toneClass[tone ?? "default"]}`;

const sigil = (title: string) =>
  title
    .split(" ")
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");

const toResult = (entity: KnowledgeEntity): SearchResult => ({
  id: entity.id,
  kind: entity.kind,
  title: entity.title,
  subtitle: entity.subtitle,
  summary: entity.summary,
  tags: entity.tags
});

const getModuleTitle = (campaign: CampaignData, moduleId: ModuleId) =>
  campaign.modules.find((module) => module.id === moduleId)?.label ?? moduleId;

const railAliasTitle: Record<RailAlias, string> = {
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
  if (moduleId === "lore" && (current === "items" || current === "notes")) {
    return current;
  }
  return null;
};

const railSectionTitle = (campaign: CampaignData, moduleId: ModuleId, alias: RailAlias | null) =>
  alias ? railAliasTitle[alias] : moduleId === "lore" ? railAliasTitle.notes : getModuleTitle(campaign, moduleId);

function RailIcon({ name }: { name: RailIconName }) {
  const common = {
    fill: "none",
    stroke: "currentColor",
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    strokeWidth: 1.75
  };

  switch (name) {
    case "brand":
      return (
        <svg aria-hidden="true" className="rail-icon-svg" viewBox="0 0 20 20">
          <path
            d="M10 1.8 14.8 5 18.2 10l-3.4 5-4.8 3.2L5.2 15 1.8 10l3.4-5L10 1.8Z"
            fill="url(#rail-brand-gradient)"
            stroke="rgba(248,240,255,.82)"
            strokeWidth="1"
          />
          <path {...common} d="m10 5.6 1.2 3.2 3.2 1.2-3.2 1.2-1.2 3.2-1.2-3.2-3.2-1.2 3.2-1.2L10 5.6Z" />
          <defs>
            <linearGradient id="rail-brand-gradient" x1="3" x2="17" y1="2" y2="18">
              <stop offset="0" stopColor="#c38dff" />
              <stop offset="1" stopColor="#6a42f4" />
            </linearGradient>
          </defs>
        </svg>
      );
    case "home":
      return (
        <svg aria-hidden="true" className="rail-icon-svg" viewBox="0 0 20 20">
          <path {...common} d="M3.5 9.2 10 4l6.5 5.2" />
          <path {...common} d="M5.6 8.5v7h8.8v-7" />
        </svg>
      );
    case "quest":
      return (
        <svg aria-hidden="true" className="rail-icon-svg" viewBox="0 0 20 20">
          <rect {...common} height="12" rx="2.2" width="12" x="4" y="4" />
          <path {...common} d="M7.2 7.4h5.6M7.2 10h5.6M7.2 12.6h3.4" />
        </svg>
      );
    case "location":
      return (
        <svg aria-hidden="true" className="rail-icon-svg" viewBox="0 0 20 20">
          <path {...common} d="M10 17s4.4-4.7 4.4-8.1A4.4 4.4 0 0 0 10 4.5a4.4 4.4 0 0 0-4.4 4.4C5.6 12.3 10 17 10 17Z" />
          <circle {...common} cx="10" cy="8.9" r="1.6" />
        </svg>
      );
    case "player":
      return (
        <svg aria-hidden="true" className="rail-icon-svg" viewBox="0 0 20 20">
          <circle {...common} cx="10" cy="6.8" r="2.4" />
          <path {...common} d="M5.1 15.4c1-2.2 2.7-3.3 4.9-3.3s3.9 1.1 4.9 3.3" />
          <path {...common} d="M15.4 5.6v3.2M13.8 7.2h3.2" />
        </svg>
      );
    case "npc":
      return (
        <svg aria-hidden="true" className="rail-icon-svg" viewBox="0 0 20 20">
          <circle {...common} cx="8" cy="7.2" r="2.4" />
          <circle {...common} cx="13.1" cy="8.1" r="1.8" />
          <path {...common} d="M4.5 14.8c.8-2 2.3-3 4.4-3 2 0 3.6 1 4.3 3" />
          <path {...common} d="M11.5 14.5c.5-1.3 1.5-2 2.8-2 1.1 0 2 .5 2.7 1.5" />
        </svg>
      );
    case "monster":
      return (
        <svg aria-hidden="true" className="rail-icon-svg" viewBox="0 0 20 20">
          <path {...common} d="M6.2 6.3 4.8 4.6M13.8 6.3l1.4-1.7M6 13.8c1 .8 2.3 1.2 4 1.2 1.7 0 3-.4 4-1.2" />
          <path {...common} d="M5.2 11.6c0-3 2-5.1 4.8-5.1s4.8 2.1 4.8 5.1" />
          <circle cx="8" cy="10.3" fill="currentColor" r="1" />
          <circle cx="12" cy="10.3" fill="currentColor" r="1" />
        </svg>
      );
    case "item":
      return (
        <svg aria-hidden="true" className="rail-icon-svg" viewBox="0 0 20 20">
          <path {...common} d="M4.6 7.1h10.8v8.3H4.6z" />
          <path {...common} d="M7.2 7.1V5.8c0-.9.8-1.7 1.7-1.7h2.2c.9 0 1.7.8 1.7 1.7v1.3" />
          <path {...common} d="M4.6 10.2h10.8" />
        </svg>
      );
    case "event":
      return (
        <svg aria-hidden="true" className="rail-icon-svg" viewBox="0 0 20 20">
          <rect {...common} height="11" rx="2.2" width="12" x="4" y="5" />
          <path {...common} d="M7 3.9v2.4M13 3.9v2.4M4 8.3h12" />
        </svg>
      );
    case "note":
      return (
        <svg aria-hidden="true" className="rail-icon-svg" viewBox="0 0 20 20">
          <path {...common} d="M6 3.8h6l3 3v9.4a1.8 1.8 0 0 1-1.8 1.8H6.8A1.8 1.8 0 0 1 5 16.2V5.6A1.8 1.8 0 0 1 6.8 3.8Z" />
          <path {...common} d="M12 3.8v3.1h3" />
          <path {...common} d="M7.5 10.2h5M7.5 13h4" />
        </svg>
      );
    default:
      return null;
  }
}

const formatModifier = (score: number) => {
  const modifier = Math.floor((score - 10) / 2);
  return modifier >= 0 ? `+${modifier}` : `${modifier}`;
};

const isCombatProfileEntity = (entity: KnowledgeEntity | null): entity is CombatProfileEntity =>
  Boolean(entity && (entity.kind === "player" || entity.kind === "npc" || entity.kind === "monster"));

const isRewardableEntity = (entity: KnowledgeEntity | null): entity is RewardableEntity =>
  Boolean(entity && (entity.kind === "npc" || entity.kind === "monster" || entity.kind === "quest"));

const rewardSectionLabel = (kind: EntityKind) => {
  switch (kind) {
    case "quest":
      return { title: "Награда", hint: "Оплата, артефакты, репутация и условия получения" };
    case "npc":
      return { title: "Награда и лут", hint: "Что НПС может дать, носит с собой или оставить после смерти" };
    case "monster":
    default:
      return { title: "Награды и добыча", hint: "Лут, трофеи, оружие и проверки на разделку" };
  }
};

const rewardSummaryText = (rewardProfile?: MonsterRewardProfile) => {
  if (!rewardProfile) {
    return "";
  }
  if (rewardProfile.summary.trim()) {
    return rewardProfile.summary.trim();
  }
  if (rewardProfile.loot.length) {
    return `${rewardProfile.loot.length} позиций`;
  }
  return "";
};

const truncateInlineText = (value: string, maxLength = 96) =>
  value.length > maxLength ? `${value.slice(0, maxLength - 1).trimEnd()}…` : value;

const loreNoteExcerpt = (
  note: Pick<LoreNoteEntity, "summary" | "content"> | { summary?: string; content: string },
  maxLength = 140
) => {
  const source = (note.summary ?? "").trim() || note.content.replace(/\s+/g, " ").trim();
  return source ? truncateInlineText(source, maxLength) : "Пустая заметка";
};

const resolveLoreNoteTitle = (title: string, content: string) => {
  const explicitTitle = title.trim();
  if (explicitTitle) {
    return truncateInlineText(explicitTitle, 72);
  }

  const firstLine = content
    .split(/\n+/)
    .map((line) => line.trim())
    .find(Boolean);
  return firstLine ? truncateInlineText(firstLine, 72) : "Новая заметка";
};

const matchesEntityDirectorySearch = (entity: KnowledgeEntity, query: string) => {
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    return true;
  }

  return [entity.title, entity.subtitle, entity.summary, entity.tags.join(" ")]
    .join(" ")
    .toLowerCase()
    .includes(normalized);
};

const composeVisibleQuickFacts = (entity: KnowledgeEntity) => {
  const facts = [...(entity.quickFacts ?? [])];
  if (
    (entity.kind === "npc" || entity.kind === "quest") &&
    entity.playerContent?.trim() &&
    !facts.some((fact) => fact.label.toLowerCase().includes("игрок"))
  ) {
    facts.push({
      label: "Игрокам",
      value: "Есть отдельная версия",
      tone: "success"
    });
  }
  if (isRewardableEntity(entity) && entity.rewardProfile) {
    if (
      entity.rewardProfile.summary.trim() &&
      !facts.some((fact) => fact.label.toLowerCase().includes("наград"))
    ) {
      facts.push({
        label: entity.kind === "quest" ? "Награда" : "Награда/лут",
        value: truncateInlineText(entity.rewardProfile.summary.trim()),
        tone: "success"
      });
    }
    if (
      entity.rewardProfile.loot.length &&
      !facts.some((fact) => fact.label.toLowerCase().includes("лут"))
    ) {
      facts.push({
        label: "Лут",
        value: `${entity.rewardProfile.loot.length} позиций`,
        tone: "warning"
      });
    }
  }
  if (
    entity.kind === "quest" &&
    entity.preparedCombat?.items?.length &&
    !facts.some((fact) => fact.label.toLowerCase().includes("бой"))
  ) {
    const count = entity.preparedCombat.items.reduce((sum, item) => sum + Math.max(1, item.quantity), 0);
    facts.push({
      label: "Бой",
      value: `${count} противников`,
      tone: "danger"
    });
  }
  if (entity.gallery?.length && !facts.some((fact) => fact.label.toLowerCase().includes("галер"))) {
    facts.push({
      label: "Галерея",
      value: `${entity.gallery.length} изображений`,
      tone: "accent"
    });
  }
  return facts;
};

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

const createPortraitSource = (entity: PortraitEntityLike) => {
  if (entity.art?.url) {
    return entity.art.url;
  }

  const initials =
    sigil(entity.title) ||
    (entity.kind === "monster" ? "MN" : entity.kind === "player" ? "PL" : "NPC");
  const safeTitle = entity.title
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  const accentA = entity.kind === "monster" ? "#e57c62" : entity.kind === "player" ? "#6dddcf" : "#7ed6a1";
  const accentB = entity.kind === "monster" ? "#4d1914" : entity.kind === "player" ? "#164f63" : "#1e3d32";
  const label =
    entity.kind === "monster" ? "MONSTER DOSSIER" : entity.kind === "player" ? "PLAYER DOSSIER" : "NPC DOSSIER";
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 720 900">
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="${accentA}"/>
          <stop offset="100%" stop-color="${accentB}"/>
        </linearGradient>
        <radialGradient id="glow" cx="50%" cy="30%" r="60%">
          <stop offset="0%" stop-color="rgba(255,255,255,0.2)"/>
          <stop offset="100%" stop-color="rgba(255,255,255,0)"/>
        </radialGradient>
      </defs>
      <rect width="720" height="900" rx="42" fill="url(#bg)"/>
      <rect width="720" height="900" rx="42" fill="url(#glow)"/>
      <circle cx="360" cy="310" r="146" fill="rgba(7, 14, 20, 0.18)"/>
      <path d="M233 620c34-112 107-169 127-182 20-13 40-13 40-13s20 0 40 13c20 13 93 70 127 182" fill="rgba(7, 14, 20, 0.22)"/>
      <text x="64" y="98" fill="rgba(255,255,255,0.92)" font-family="Segoe UI, Arial, sans-serif" font-size="40" letter-spacing="7">${label}</text>
      <text x="64" y="792" fill="rgba(255,255,255,0.96)" font-family="Georgia, serif" font-size="52" font-weight="700">${safeTitle}</text>
      <text x="64" y="852" fill="rgba(255,255,255,0.72)" font-family="Segoe UI, Arial, sans-serif" font-size="28">Портрет-заглушка, пока не задан art.url</text>
      <text x="360" y="352" text-anchor="middle" fill="rgba(255,255,255,0.88)" font-family="Georgia, serif" font-size="126" font-weight="700">${initials}</text>
    </svg>
  `;

  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
};

const createHeroPanelStyle = (gradient: string, imageUrl?: string): CSSProperties => ({
  backgroundImage: imageUrl
    ? `linear-gradient(180deg, rgba(6, 10, 16, 0.24), rgba(6, 10, 16, 0.7)), ${gradient}, url("${imageUrl}")`
    : `linear-gradient(180deg, rgba(6, 10, 16, 0.18), rgba(6, 10, 16, 0.42)), ${gradient}`,
  backgroundSize: imageUrl ? "cover, cover, cover" : undefined,
  backgroundPosition: imageUrl ? "center, center, center" : undefined
});

const createBestiaryPortraitSource = (monster: Pick<BestiaryMonsterSummary, "title" | "imageUrl">) =>
  createPortraitSource({
    kind: "monster",
    title: monster.title,
    art: monster.imageUrl ? { url: monster.imageUrl, alt: monster.title } : undefined
  });

const defaultFloatingPlayerPosition = () => {
  if (typeof window === "undefined") {
    return { x: 16, y: 16 };
  }

  return {
    x: Math.max(16, window.innerWidth - 428),
    y: Math.max(16, window.innerHeight - 232)
  };
};

const playlistTrackTitle = (track: PlaylistTrack, index: number) => track.title.trim() || `Трек ${index + 1}`;
const galleryImageTitle = (item: GalleryImage, index: number) => item.title.trim() || `Изображение ${index + 1}`;

const playlistTrackHost = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "внешняя ссылка";
  }
};

const extractYouTubeVideoId = (value: string) => {
  const url = value.trim();
  if (!url) {
    return "";
  }

  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase().replace(/^www\./, "");

    if (host === "youtu.be") {
      return parsed.pathname.split("/").filter(Boolean)[0] ?? "";
    }

    if (
      host === "youtube.com" ||
      host === "m.youtube.com" ||
      host === "music.youtube.com" ||
      host === "youtube-nocookie.com"
    ) {
      if (parsed.pathname === "/watch") {
        return parsed.searchParams.get("v") ?? "";
      }
      const segments = parsed.pathname.split("/").filter(Boolean);
      if (segments[0] === "embed" || segments[0] === "shorts" || segments[0] === "live") {
        return segments[1] ?? "";
      }
    }
  } catch {
    return "";
  }

  return "";
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

const resolvePlaylistSource = (url: string) => {
  const videoId = extractYouTubeVideoId(url);
  if (videoId) {
    return {
      kind: "youtube" as const,
      videoId,
      embedUrl: `https://www.youtube.com/embed/${videoId}?autoplay=1&controls=0&rel=0&modestbranding=1&playsinline=1`
    };
  }

  return {
    kind: "audio" as const,
    url
  };
};

const pickRandomTrackIndex = (tracks: PlaylistTrack[], excludeIndex?: number) => {
  if (!tracks.length) {
    return -1;
  }
  if (tracks.length === 1) {
    return 0;
  }

  let nextIndex = Math.floor(Math.random() * tracks.length);
  if (excludeIndex === undefined) {
    return nextIndex;
  }

  while (nextIndex === excludeIndex) {
    nextIndex = Math.floor(Math.random() * tracks.length);
  }

  return nextIndex;
};

const formatPlaybackTime = (seconds: number) => {
  const safe = Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds)) : 0;
  const minutes = Math.floor(safe / 60);
  const remainder = safe % 60;
  return `${minutes}:${String(remainder).padStart(2, "0")}`;
};

const loadYouTubeIframeApi = (): Promise<NonNullable<Window["YT"]>> => {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("YouTube API недоступен вне браузера."));
  }

  if (window.YT?.Player) {
    return Promise.resolve(window.YT);
  }

  if (window.__shadowEdgeYouTubeApiPromise) {
    return window.__shadowEdgeYouTubeApiPromise;
  }

  window.__shadowEdgeYouTubeApiPromise = new Promise((resolve, reject) => {
    const existingScript = document.querySelector<HTMLScriptElement>('script[src="https://www.youtube.com/iframe_api"]');
    const previousReady = window.onYouTubeIframeAPIReady;

    window.onYouTubeIframeAPIReady = () => {
      previousReady?.();
      if (window.YT?.Player) {
        resolve(window.YT);
      } else {
        reject(new Error("YouTube API загрузилась некорректно."));
      }
    };

    if (!existingScript) {
      const script = document.createElement("script");
      script.src = "https://www.youtube.com/iframe_api";
      script.async = true;
      script.onerror = () => reject(new Error("Не удалось загрузить YouTube IFrame API."));
      document.head.appendChild(script);
    }
  });

  return window.__shadowEdgeYouTubeApiPromise;
};

const hasVisibleArt = (art?: HeroArt) => Boolean(art?.url?.trim());

function EntityVisual({
  entity,
  variant = "row"
}: {
  entity: Pick<PortraitEntityLike, "kind" | "title" | "art">;
  variant?: "row" | "hero" | "relation";
}) {
  if (!hasVisibleArt(entity.art)) {
    return (
      <span className={`sigil ${variant === "hero" ? "big" : ""}`} style={{ backgroundImage: gradients[entity.kind] }}>
        {sigil(entity.title)}
      </span>
    );
  }

  return (
    <span className={`entity-thumb-frame entity-thumb-${variant}`}>
      <img alt={entity.art?.alt ?? entity.title} className="entity-thumb" loading="lazy" src={createPortraitSource(entity)} />
    </span>
  );
}

const filterEntities = (
  campaign: CampaignData | null,
  activeModule: ModuleId,
  activeTab: string,
  options?: { monsterSearch?: string; monsterChallenge?: string }
) => {
  if (!campaign || activeModule === "dashboard") {
    return [];
  }

  if (activeModule === "monsters" && activeTab !== "Imported") {
    return [];
  }

  return moduleEntities(campaign, activeModule).filter((entity) => {
    if (activeTab === "All") return true;

    if (entity.kind === "location") {
      return (
        (activeTab === "Cities" && entity.category === "City") ||
        (activeTab === "Regions" && entity.category === "Region") ||
        (activeTab === "Dungeons" && entity.category === "Dungeon") ||
        (activeTab === "POI" && entity.category === "POI")
      );
    }

    if (entity.kind === "player") {
      return activeTab === "All" || activeTab === entity.status;
    }

    if (entity.kind === "npc") {
      return (
        (activeTab === "Critical" && entity.importance === "Critical") ||
        (activeTab === "Allies" && entity.status === "Ally") ||
        (activeTab === "Threats" && entity.status === "Threat")
      );
    }

    if (entity.kind === "monster") {
      const matchesSearch =
        activeTab !== "Imported" ||
        !options?.monsterSearch?.trim() ||
        [entity.title, entity.subtitle, entity.summary]
          .join(" ")
          .toLowerCase()
          .includes(options.monsterSearch.trim().toLowerCase());
      const matchesChallenge =
        activeTab !== "Imported" ||
        !options?.monsterChallenge ||
        getEntityChallenge(entity) === options.monsterChallenge;

      return (
        ((activeTab === "Imported") && matchesSearch && matchesChallenge) ||
        (activeTab === "Hostile" && entity.status === "Hostile") ||
        (activeTab === "Elite" && entity.importance === "Elite") ||
        (activeTab === "Bosses" && entity.importance === "Boss") ||
        (activeTab === "Beasts" && entity.statBlock?.creatureType.toLowerCase().includes("beast"))
      );
    }

    if (entity.kind === "quest") {
      return activeTab.toLowerCase() === entity.status;
    }

    if (entity.kind === "lore") {
      return (
        (activeTab === "GM Only" && entity.visibility === "gm_only") ||
        (activeTab === "Player Safe" && entity.visibility === "player_safe") ||
        (activeTab === "Threat Files" && entity.category === "Threat")
      );
    }

    return true;
  });
};

const parseWikiLinkToken = (token: string) => {
  const match = token.match(/^\[\[([^[\]|]+)(?:\|([^[\]]+))?\]\]$/);
  if (!match) {
    return null;
  }

  return {
    targetTitle: match[1].trim(),
    label: (match[2] ?? match[1]).trim()
  };
};

const createWikiLinkMarkup = (targetTitle: string, label: string) => {
  const safeTarget = targetTitle.replace(/\]\]/g, "").trim();
  const safeLabel = label.replace(/\]\]/g, "").replace(/\|/g, " ").trim();
  if (!safeTarget) {
    return label;
  }

  return safeLabel && safeLabel !== safeTarget ? `[[${safeTarget}|${safeLabel}]]` : `[[${safeTarget}]]`;
};

type RichSegment = {
  key: string;
  kind: "text" | "link";
  sourceStart: number;
  sourceEnd: number;
  raw: string;
  visibleText: string;
  targetTitle?: string;
};

type RichParagraph = {
  key: string;
  segments: RichSegment[];
};

const parseRichParagraphs = (content: string): RichParagraph[] => {
  const parts = content.split(/(\n+)/);
  const paragraphs: RichParagraph[] = [];
  let offset = 0;
  let paragraphIndex = 0;

  for (const part of parts) {
    if (!part) {
      continue;
    }

    if (/^\n+$/.test(part)) {
      offset += part.length;
      continue;
    }

    const segments: RichSegment[] = [];
    const tokenPattern = /\[\[[^[\]]+\]\]/g;
    let cursor = 0;
    let match: RegExpExecArray | null;

    while ((match = tokenPattern.exec(part)) !== null) {
      if (match.index > cursor) {
        const rawText = part.slice(cursor, match.index);
        segments.push({
          key: `p${paragraphIndex}-text-${cursor}`,
          kind: "text",
          sourceStart: offset + cursor,
          sourceEnd: offset + match.index,
          raw: rawText,
          visibleText: rawText
        });
      }

      const parsed = parseWikiLinkToken(match[0]);
      const visibleText = parsed?.label ?? match[0];
      segments.push({
        key: `p${paragraphIndex}-link-${match.index}`,
        kind: "link",
        sourceStart: offset + match.index,
        sourceEnd: offset + match.index + match[0].length,
        raw: match[0],
        visibleText,
        targetTitle: parsed?.targetTitle
      });
      cursor = match.index + match[0].length;
    }

    if (cursor < part.length) {
      const rawText = part.slice(cursor);
      segments.push({
        key: `p${paragraphIndex}-tail-${cursor}`,
        kind: "text",
        sourceStart: offset + cursor,
        sourceEnd: offset + part.length,
        raw: rawText,
        visibleText: rawText
      });
    }

    paragraphs.push({
      key: `paragraph-${paragraphIndex}-${offset}`,
      segments
    });
    offset += part.length;
    paragraphIndex += 1;
  }

  return paragraphs;
};

const resolveSelectionOffsetWithinElement = (element: HTMLElement, node: Node, nodeOffset: number) => {
  const range = document.createRange();
  range.selectNodeContents(element);
  try {
    range.setEnd(node, nodeOffset);
  } catch {
    return 0;
  }
  return range.toString().length;
};

const resolveRichSelectionPoint = (node: Node, offset: number) => {
  const element =
    node instanceof HTMLElement
      ? node.closest<HTMLElement>("[data-rich-source-start]")
      : node.parentElement?.closest<HTMLElement>("[data-rich-source-start]") ?? null;

  if (!element || element.dataset.richLink === "true") {
    return null;
  }

  const sourceStart = Number(element.dataset.richSourceStart ?? "");
  const sourceEnd = Number(element.dataset.richSourceEnd ?? "");
  if (!Number.isFinite(sourceStart) || !Number.isFinite(sourceEnd)) {
    return null;
  }

  const localVisibleOffset = clamp(resolveSelectionOffsetWithinElement(element, node, offset), 0, element.textContent?.length ?? 0);
  return clamp(sourceStart + localVisibleOffset, sourceStart, sourceEnd);
};

const resolveRichSelectionFromContainer = (container: HTMLElement) => {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
    return null;
  }

  const range = selection.getRangeAt(0);
  if (!container.contains(range.commonAncestorContainer)) {
    return null;
  }

  const start = resolveRichSelectionPoint(range.startContainer, range.startOffset);
  const end = resolveRichSelectionPoint(range.endContainer, range.endOffset);
  if (start == null || end == null || start === end) {
    return null;
  }

  return {
    start: Math.min(start, end),
    end: Math.max(start, end),
    text: selection.toString()
  };
};

function RichParagraphs({
  content,
  entityByTitle,
  onMentionClick
}: {
  content: string;
  entityByTitle: Map<string, KnowledgeEntity>;
  onMentionClick: (id: string) => void;
}) {
  const paragraphs = useMemo(() => parseRichParagraphs(content), [content]);

  return (
    <div className="rich">
      {paragraphs.map((paragraph) => (
        <p key={paragraph.key}>
          {paragraph.segments.map((segment) => {
            if (segment.kind === "text") {
              return (
                <span
                  key={segment.key}
                  data-rich-link="false"
                  data-rich-source-end={segment.sourceEnd}
                  data-rich-source-start={segment.sourceStart}
                  className="rich-inline-text"
                >
                  {segment.visibleText}
                </span>
              );
            }

            const linked = segment.targetTitle ? entityByTitle.get(segment.targetTitle) : undefined;
            return linked ? (
              <button
                key={segment.key}
                className="mention"
                data-rich-link="true"
                data-rich-source-end={segment.sourceEnd}
                data-rich-source-start={segment.sourceStart}
                onClick={() => onMentionClick(linked.id)}
                type="button"
              >
                {segment.visibleText}
              </button>
            ) : (
              <span
                key={segment.key}
                data-rich-link="true"
                data-rich-source-end={segment.sourceEnd}
                data-rich-source-start={segment.sourceStart}
              >
                {segment.visibleText}
              </span>
            );
          })}
        </p>
      ))}
    </div>
  );
}

function CollapsibleSection({
  title,
  hint,
  summary,
  defaultCollapsed = false,
  action,
  className = "",
  children
}: {
  title: string;
  hint?: string;
  summary?: ReactNode;
  defaultCollapsed?: boolean;
  action?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);

  return (
    <section className={`card section-card collapsible-section ${collapsed ? "collapsed" : ""} ${className}`.trim()}>
      <div className="collapsible-head">
        <button
          aria-expanded={!collapsed}
          className="collapsible-toggle"
          onClick={() => setCollapsed((current) => !current)}
          type="button"
        >
          <span className="collapsible-copy">
            <strong>{title}</strong>
            {hint ? <small>{hint}</small> : null}
          </span>
          <span className={`collapsible-chevron ${collapsed ? "collapsed" : ""}`}>{collapsed ? "Развернуть" : "Свернуть"}</span>
        </button>
        {action ? <div className="collapsible-action">{action}</div> : null}
      </div>

      {collapsed ? (summary ? <div className="collapsible-summary">{summary}</div> : null) : <div className="collapsible-body">{children}</div>}
    </section>
  );
}

function PlaylistSection({
  title,
  hint,
  tracks,
  activeTrackUrl,
  activeTrackLabel,
  isActive,
  compact = false,
  defaultCollapsed = false,
  action,
  onPlayRandom,
  onPlayTrack,
  onNextRandom,
  onStop
}: {
  title: string;
  hint: string;
  tracks: PlaylistTrack[];
  activeTrackUrl?: string;
  activeTrackLabel?: string;
  isActive?: boolean;
  compact?: boolean;
  defaultCollapsed?: boolean;
  action?: ReactNode;
  onPlayRandom: () => void;
  onPlayTrack: (index: number) => void;
  onNextRandom: () => void;
  onStop: () => void;
}) {
  return (
    <CollapsibleSection
      action={action}
      className={`playlist-section ${compact ? "compact" : ""}`}
      defaultCollapsed={defaultCollapsed}
      hint={hint}
      summary={
        <p className="copy">
          {tracks.length
            ? `${tracks.length} треков${isActive && activeTrackLabel ? ` • сейчас играет: ${activeTrackLabel}` : " • готов к случайному запуску"}`
            : "Плейлист пока пуст."}
        </p>
      }
      title={title}
    >
      {tracks.length ? (
        <>
          <div className="actions playlist-runtime-toolbar">
            <button className="primary" onClick={onPlayRandom} type="button">
              {isActive ? "Случайный следующий" : "Случайный трек"}
            </button>
            <button className="ghost" disabled={!isActive} onClick={onNextRandom} type="button">
              Следующий
            </button>
            <button className="ghost" disabled={!isActive} onClick={onStop} type="button">
              Стоп
            </button>
          </div>

          <div className={`playlist-track-list ${compact ? "compact-entry-list" : ""}`}>
            {tracks.map((track, index) => {
              const label = playlistTrackTitle(track, index);
              const active = Boolean(isActive && activeTrackUrl && track.url === activeTrackUrl);
              return (
                <button
                  key={`${track.url}-${index}`}
                  className={`ghost fill playlist-track-row ${active ? "active" : ""}`}
                  onClick={() => onPlayTrack(index)}
                  type="button"
                >
                  <span className="playlist-track-copy">
                    <strong>{label}</strong>
                    <small>{playlistTrackHost(track.url)}</small>
                  </span>
                  {active ? <span className={badge("success")}>Играет</span> : <span className={badge()}>Play</span>}
                </button>
              );
            })}
          </div>
        </>
      ) : (
        <p className="copy">Добавь сюда несколько ссылок на YouTube или прямые аудио URL, чтобы запускать атмосферу одним кликом.</p>
      )}
    </CollapsibleSection>
  );
}

function PlaylistEditorSection({
  title,
  hint,
  tracks,
  onChange,
  onAdd,
  onRemove
}: {
  title: string;
  hint: string;
  tracks: PlaylistTrack[];
  onChange: (index: number, patch: Partial<PlaylistTrack>) => void;
  onAdd: () => void;
  onRemove: (index: number) => void;
}) {
  return (
    <section className="card npc-section form-subsection">
      <div className="row muted">
        <div className="stack compact">
          <span>{title}</span>
          <small>{hint}</small>
        </div>
        <button className="ghost" onClick={onAdd} type="button">
          Добавить трек
        </button>
      </div>

      <div className="playlist-editor-list">
        {tracks.length ? (
          tracks.map((track, index) => (
            <article key={`${track.url}-${index}`} className="entry-editor playlist-track-editor">
              <div className="row">
                <strong>Трек #{index + 1}</strong>
                <button className="ghost danger-action" onClick={() => onRemove(index)} type="button">
                  Удалить
                </button>
              </div>

              <div className="form-grid">
                <label className="field">
                  <span>Название</span>
                  <input
                    className="input"
                    onChange={(event) => onChange(index, { title: event.target.value })}
                    placeholder="Ночной порт"
                    value={track.title}
                  />
                </label>
                <label className="field">
                  <span>Ссылка</span>
                  <input
                    className="input"
                    onChange={(event) => onChange(index, { url: event.target.value })}
                    placeholder="https://youtu.be/... или https://...mp3"
                    value={track.url}
                  />
                </label>
              </div>
            </article>
          ))
        ) : (
          <p className="copy">Пока треков нет. Можно вставлять ссылки на YouTube-видео или прямые аудио URL.</p>
        )}
      </div>
    </section>
  );
}

function GallerySection({
  title,
  hint,
  items,
  compact = false,
  defaultCollapsed = false,
  displayLimit,
  action,
  onOpenFullscreen,
  onCopyLink
}: {
  title: string;
  hint: string;
  items: GalleryImage[];
  compact?: boolean;
  defaultCollapsed?: boolean;
  displayLimit?: number;
  action?: ReactNode;
  onOpenFullscreen: (index: number) => void;
  onCopyLink: (url: string) => Promise<void> | void;
}) {
  const visibleItems = typeof displayLimit === "number" ? items.slice(0, displayLimit) : items;

  return (
    <CollapsibleSection
      action={action}
      className={`gallery-section ${compact ? "compact" : ""}`}
      defaultCollapsed={defaultCollapsed}
      hint={hint}
      summary={
        <p className="copy">
          {items.length
            ? `${items.length} изображений${displayLimit && items.length > visibleItems.length ? ` • показаны первые ${visibleItems.length}` : ""}`
            : "Галерея пока пустая."}
        </p>
      }
      title={title}
    >
      {visibleItems.length ? (
        <div className={`gallery-grid ${compact ? "compact" : ""}`}>
          {visibleItems.map((item, index) => (
            <article key={`${item.url}-${index}`} className="card gallery-card">
              <button className="gallery-image-button" onClick={() => onOpenFullscreen(index)} type="button">
                <img alt={item.caption ?? galleryImageTitle(item, index)} className="gallery-image" loading="lazy" src={item.url} />
              </button>
              <div className="gallery-card-copy">
                <strong>{galleryImageTitle(item, index)}</strong>
                <small>{item.caption?.trim() || "Открывается на весь экран, ссылку можно копировать отдельно."}</small>
              </div>
              <div className="actions gallery-card-actions">
                <button
                  className="ghost"
                  onClick={() => {
                    void onCopyLink(item.url);
                  }}
                  type="button"
                >
                  Скопировать
                </button>
                <button className="ghost" onClick={() => window.open(item.url, "_blank", "noopener,noreferrer")} type="button">
                  Файл
                </button>
                <button className="primary" onClick={() => onOpenFullscreen(index)} type="button">
                  Открыть
                </button>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <p className="copy">Сюда удобно складывать карты, письма, договоры, гербы, handout-арты и любые другие игровые изображения.</p>
      )}
    </CollapsibleSection>
  );
}

function GalleryEditorSection({
  title,
  hint,
  items,
  onChange,
  onAdd,
  onRemove
}: {
  title: string;
  hint: string;
  items: GalleryImage[];
  onChange: (index: number, patch: Partial<GalleryImage>) => void;
  onAdd: () => void;
  onRemove: (index: number) => void;
}) {
  return (
    <section className="card npc-section form-subsection">
      <div className="row muted">
        <div className="stack compact">
          <span>{title}</span>
          <small>{hint}</small>
        </div>
        <button className="ghost" onClick={onAdd} type="button">
          Добавить изображение
        </button>
      </div>

      <div className="playlist-editor-list">
        {items.length ? (
          items.map((item, index) => (
            <article key={`${item.url}-${index}`} className="entry-editor gallery-editor-card">
              <div className="row">
                <strong>{galleryImageTitle(item, index)}</strong>
                <button className="ghost danger-action" onClick={() => onRemove(index)} type="button">
                  Удалить
                </button>
              </div>

              <div className="gallery-editor-grid">
                <label className="field">
                  <span>Название</span>
                  <input
                    className="input"
                    onChange={(event) => onChange(index, { title: event.target.value })}
                    placeholder="Карта Нижнего рынка"
                    value={item.title}
                  />
                </label>
                <label className="field">
                  <span>Ссылка</span>
                  <input
                    className="input"
                    onChange={(event) => onChange(index, { url: event.target.value })}
                    placeholder="https://...png"
                    value={item.url}
                  />
                </label>
                <label className="field field-full">
                  <span>Подпись</span>
                  <input
                    className="input"
                    onChange={(event) => onChange(index, { caption: event.target.value })}
                    placeholder="Что это за handout и когда его показать игрокам"
                    value={item.caption ?? ""}
                  />
                </label>
              </div>

              {item.url.trim() ? (
                <button className="gallery-editor-preview" onClick={() => window.open(item.url, "_blank", "noopener,noreferrer")} type="button">
                  <img alt={item.caption ?? galleryImageTitle(item, index)} className="gallery-image" loading="lazy" src={item.url} />
                </button>
              ) : null}
            </article>
          ))
        ) : (
          <p className="copy">Пока изображений нет. Можно вставлять прямые URL на карты, письма, портреты и любые handout-материалы.</p>
        )}
      </div>
    </section>
  );
}

function GalleryLightbox({
  viewer,
  onClose,
  onSelect,
  onCopyLink
}: {
  viewer: GalleryViewerState;
  onClose: () => void;
  onSelect: (index: number) => void;
  onCopyLink: (url: string) => Promise<void>;
}) {
  const item = viewer.items[viewer.currentIndex];
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setCopied(false);
  }, [viewer.currentIndex, item.url]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
        return;
      }
      if (event.key === "ArrowLeft" && viewer.items.length > 1) {
        onSelect(viewer.currentIndex - 1);
      }
      if (event.key === "ArrowRight" && viewer.items.length > 1) {
        onSelect(viewer.currentIndex + 1);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose, onSelect, viewer.currentIndex, viewer.items.length]);

  return (
    <div className="gallery-lightbox-backdrop" role="presentation">
      <div className="panel gallery-lightbox" onClick={(event) => event.stopPropagation()} role="dialog">
        <div className="row">
          <div className="stack compact">
            <p className="eyebrow">Галерея / Fullscreen</p>
            <strong>{galleryImageTitle(item, viewer.currentIndex)}</strong>
            <small>
              {viewer.ownerTitle} • {viewer.currentIndex + 1}/{viewer.items.length}
            </small>
          </div>
          <div className="actions">
            <button className="ghost" disabled={viewer.items.length < 2} onClick={() => onSelect(viewer.currentIndex - 1)} type="button">
              ←
            </button>
            <button className="ghost" disabled={viewer.items.length < 2} onClick={() => onSelect(viewer.currentIndex + 1)} type="button">
              →
            </button>
            <button
              className="ghost"
              onClick={() => {
                void onCopyLink(item.url)
                  .then(() => setCopied(true))
                  .catch(() => undefined);
              }}
              type="button"
            >
              {copied ? "Скопировано" : "Скопировать ссылку"}
            </button>
            <button className="ghost" onClick={() => window.open(item.url, "_blank", "noopener,noreferrer")} type="button">
              Открыть файл
            </button>
            <button className="ghost" onClick={onClose} type="button">
              Esc
            </button>
          </div>
        </div>

        <div className="gallery-lightbox-image-shell">
          <img alt={item.caption ?? galleryImageTitle(item, viewer.currentIndex)} className="gallery-lightbox-image" src={item.url} />
        </div>

        <div className="stack compact">
          {item.caption?.trim() ? <p className="copy">{item.caption}</p> : null}
          <small>{item.url}</small>
        </div>
      </div>
    </div>
  );
}

function FloatingPlaylistPlayer({
  playback,
  track,
  trackLabel,
  source,
  onSelectTrack,
  onPrevious,
  onNext,
  onStop
}: {
  playback: ActivePlaylistPlayback;
  track: PlaylistTrack;
  trackLabel: string;
  source: ReturnType<typeof resolvePlaylistSource>;
  onSelectTrack: (index: number) => void;
  onPrevious: () => void;
  onNext: () => void;
  onStop: () => void;
}) {
  const panelRef = useRef<HTMLElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const youtubeHostRef = useRef<HTMLDivElement | null>(null);
  const youtubePlayerRef = useRef<{
    destroy?: () => void;
    loadVideoById?: (options: Record<string, unknown> | string) => void;
    playVideo?: () => void;
    pauseVideo?: () => void;
    seekTo?: (seconds: number, allowSeekAhead?: boolean) => void;
    getCurrentTime?: () => number;
    getDuration?: () => number;
    setVolume?: (volume: number) => void;
  } | null>(null);
  const youtubePollRef = useRef<number | null>(null);
  const dragRef = useRef<{ pointerId: number; offsetX: number; offsetY: number } | null>(null);
  const onNextRef = useRef(onNext);
  const volumeRef = useRef(72);
  const [collapsed, setCollapsed] = useState(false);
  const [trackPickerOpen, setTrackPickerOpen] = useState(false);
  const [position, setPosition] = useState(defaultFloatingPlayerPosition);
  const [isPlaying, setIsPlaying] = useState(true);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [bootError, setBootError] = useState("");
  const [volume, setVolume] = useState(() => {
    if (typeof window === "undefined") {
      return 72;
    }
    const stored = Number.parseInt(window.localStorage.getItem("shadow-edge-player-volume") ?? "72", 10);
    return clamp(Number.isFinite(stored) ? stored : 72, 0, 100);
  });
  const sourceKey = source.kind === "youtube" ? source.videoId : source.url;

  useEffect(() => {
    onNextRef.current = onNext;
  }, [onNext]);

  useEffect(() => {
    volumeRef.current = volume;
    if (typeof window !== "undefined") {
      window.localStorage.setItem("shadow-edge-player-volume", String(volume));
    }
    if (audioRef.current) {
      audioRef.current.volume = volume / 100;
    }
    youtubePlayerRef.current?.setVolume?.(volume);
  }, [volume]);

  const clampPosition = (x: number, y: number) => {
    const panelWidth = panelRef.current?.offsetWidth ?? (collapsed ? 320 : 420);
    const panelHeight = panelRef.current?.offsetHeight ?? (collapsed ? 80 : 240);
    return {
      x: clamp(x, 12, Math.max(12, window.innerWidth - panelWidth - 12)),
      y: clamp(y, 12, Math.max(12, window.innerHeight - panelHeight - 12))
    };
  };

  const syncYouTubeMetrics = () => {
    const player = youtubePlayerRef.current;
    if (!player?.getCurrentTime || !player.getDuration) {
      return;
    }

    setCurrentTime(player.getCurrentTime() ?? 0);
    setDuration(player.getDuration() ?? 0);
  };

  const stopYouTubePolling = () => {
    if (youtubePollRef.current !== null) {
      window.clearInterval(youtubePollRef.current);
      youtubePollRef.current = null;
    }
  };

  const startYouTubePolling = () => {
    stopYouTubePolling();
    youtubePollRef.current = window.setInterval(syncYouTubeMetrics, 500);
  };

  useEffect(() => {
    const onResize = () => setPosition((current) => clampPosition(current.x, current.y));
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [collapsed]);

  useEffect(() => {
    const onPointerMove = (event: PointerEvent) => {
      if (!dragRef.current || dragRef.current.pointerId !== event.pointerId) {
        return;
      }

      setPosition(clampPosition(event.clientX - dragRef.current.offsetX, event.clientY - dragRef.current.offsetY));
    };

    const onPointerUp = (event: PointerEvent) => {
      if (!dragRef.current || dragRef.current.pointerId !== event.pointerId) {
        return;
      }

      dragRef.current = null;
      document.body.style.removeProperty("user-select");
      document.body.style.removeProperty("cursor");
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };
  }, [collapsed]);

  useEffect(() => {
    setBootError("");
    setDuration(0);
    setCurrentTime(0);
    setIsPlaying(true);
    setTrackPickerOpen(false);
  }, [playback.token, playback.currentIndex, source.kind, track.url]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) {
      return;
    }

    if (source.kind !== "audio") {
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
      return;
    }

    const handleLoadedMetadata = () => {
      setDuration(audio.duration || 0);
      setCurrentTime(audio.currentTime || 0);
    };
    const handleTimeUpdate = () => setCurrentTime(audio.currentTime || 0);
    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleEnded = () => onNextRef.current();
    const handleError = () => setBootError("Этот аудио-источник не удалось воспроизвести.");

    audio.addEventListener("loadedmetadata", handleLoadedMetadata);
    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("play", handlePlay);
    audio.addEventListener("pause", handlePause);
    audio.addEventListener("ended", handleEnded);
    audio.addEventListener("error", handleError);
    audio.src = source.url;
    audio.volume = volumeRef.current / 100;
    audio.currentTime = 0;
    void audio.play().catch(() => {
      setIsPlaying(false);
      setBootError("Браузер не дал запустить этот аудио-источник автоматически.");
    });

    return () => {
      audio.pause();
      audio.removeEventListener("loadedmetadata", handleLoadedMetadata);
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("play", handlePlay);
      audio.removeEventListener("pause", handlePause);
      audio.removeEventListener("ended", handleEnded);
      audio.removeEventListener("error", handleError);
    };
  }, [source.kind, sourceKey, track.url]);

  useEffect(() => {
    if (source.kind !== "youtube") {
      stopYouTubePolling();
      youtubePlayerRef.current?.pauseVideo?.();
      return;
    }

    let cancelled = false;
    setBootError("");

    void loadYouTubeIframeApi()
      .then((YT) => {
        if (cancelled || !youtubeHostRef.current) {
          return;
        }

        const bindPlayer = () => {
          if (!youtubePlayerRef.current) {
            youtubePlayerRef.current = new YT.Player(youtubeHostRef.current as HTMLElement, {
              width: "1",
              height: "1",
              videoId: source.videoId,
              playerVars: {
                autoplay: 1,
                controls: 0,
                rel: 0,
                playsinline: 1,
                modestbranding: 1,
                origin: window.location.origin
              },
              events: {
                onReady: (event: { target: { playVideo?: () => void; setVolume?: (volume: number) => void } }) => {
                  if (cancelled) {
                    return;
                  }
                  event.target.setVolume?.(volumeRef.current);
                  event.target.playVideo?.();
                  startYouTubePolling();
                  syncYouTubeMetrics();
                },
                onStateChange: (event: { data: number }) => {
                  if (cancelled) {
                    return;
                  }
                  setIsPlaying(event.data === YT.PlayerState.PLAYING || event.data === YT.PlayerState.BUFFERING);
                  if (event.data === YT.PlayerState.ENDED) {
                    onNextRef.current();
                  }
                  syncYouTubeMetrics();
                },
                onError: () => {
                  if (cancelled) {
                    return;
                  }
                  setBootError("YouTube не дал воспроизвести этот трек.");
                }
              }
            });
            return;
          }

          youtubePlayerRef.current.loadVideoById?.({
            videoId: source.videoId,
            startSeconds: 0
          });
          startYouTubePolling();
          syncYouTubeMetrics();
        };

        bindPlayer();
      })
      .catch((error) => {
        if (cancelled) {
          return;
        }
        setBootError(error instanceof Error ? error.message : "Не удалось подключить YouTube player.");
      });

    return () => {
      cancelled = true;
    };
  }, [source.kind, sourceKey]);

  useEffect(() => {
    return () => {
      stopYouTubePolling();
      youtubePlayerRef.current?.destroy?.();
      youtubePlayerRef.current = null;
    };
  }, []);

  const togglePlayback = () => {
    if (source.kind === "audio") {
      const audio = audioRef.current;
      if (!audio) {
        return;
      }
      if (audio.paused) {
        void audio.play().catch(() => {
          setBootError("Браузер не дал продолжить аудио.");
        });
      } else {
        audio.pause();
      }
      return;
    }

    const player = youtubePlayerRef.current;
    if (!player) {
      return;
    }
    if (isPlaying) {
      player.pauseVideo?.();
    } else {
      player.playVideo?.();
    }
  };

  const seekPlayback = (nextValue: number) => {
    const normalized = Number.isFinite(nextValue) ? Math.max(0, nextValue) : 0;
    if (source.kind === "audio") {
      const audio = audioRef.current;
      if (!audio) {
        return;
      }
      audio.currentTime = normalized;
      setCurrentTime(normalized);
      return;
    }

    youtubePlayerRef.current?.seekTo?.(normalized, true);
    setCurrentTime(normalized);
  };

  const beginDrag = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const target = event.currentTarget;
    const rect = panelRef.current?.getBoundingClientRect();
    dragRef.current = {
      pointerId: event.pointerId,
      offsetX: event.clientX - (rect?.left ?? position.x),
      offsetY: event.clientY - (rect?.top ?? position.y)
    };
    target.setPointerCapture(event.pointerId);
    document.body.style.cursor = "grabbing";
    document.body.style.userSelect = "none";
  };

  return (
    <div
      className={`playlist-player-shell ${collapsed ? "collapsed" : ""}`}
      style={{ left: `${position.x}px`, top: `${position.y}px` }}
    >
      <section ref={panelRef} className="panel playlist-player">
        <div className="row playlist-player-topbar">
          <button className="ghost playlist-drag-handle" onPointerDown={beginDrag} type="button">
            Перетащить
          </button>
          <div className="actions">
            <button className="ghost" onClick={() => setCollapsed((current) => !current)} type="button">
              {collapsed ? "Развернуть" : "Свернуть"}
            </button>
            <button className="ghost" onClick={onStop} type="button">
              Закрыть
            </button>
          </div>
        </div>

        <div className="stack compact">
          <p className="eyebrow">Now Playing</p>
          <strong>{trackLabel}</strong>
          <small>{playback.ownerTitle}</small>
          {bootError ? <small>{bootError}</small> : null}
        </div>

        <div className="playlist-inline-controls">
          <button className="ghost" onClick={onPrevious} type="button">
            ←
          </button>
          <button className="primary" onClick={togglePlayback} type="button">
            {isPlaying ? "Пауза" : "Play"}
          </button>
          <button className="ghost" onClick={onNext} type="button">
            →
          </button>
          <button className="ghost" onClick={() => setTrackPickerOpen((current) => !current)} type="button">
            {trackPickerOpen ? "Скрыть треки" : "Выбрать трек"}
          </button>
          <button
            className="ghost"
            onClick={() => window.open(track.url, "_blank", "noopener,noreferrer")}
            type="button"
          >
            Источник
          </button>
        </div>

        {!collapsed ? (
          <>
            <label className="playlist-volume-shell">
              <span>Громкость</span>
              <input
                className="playlist-volume"
                max={100}
                min={0}
                onChange={(event) => setVolume(clamp(Number.parseInt(event.target.value, 10) || 0, 0, 100))}
                step={1}
                type="range"
                value={volume}
              />
              <strong>{volume}%</strong>
            </label>

            <label className="playlist-progress-shell">
              <input
                className="playlist-progress"
                max={Math.max(duration, 0.1)}
                min={0}
                onChange={(event) => seekPlayback(Number.parseFloat(event.target.value) || 0)}
                step={0.1}
                type="range"
                value={Math.min(currentTime, duration || 0)}
              />
            </label>

            <div className="row muted">
              <span>{formatPlaybackTime(currentTime)}</span>
              <span>{source.kind === "youtube" ? "YouTube" : playlistTrackHost(track.url)}</span>
              <span>{formatPlaybackTime(duration)}</span>
            </div>

            {trackPickerOpen ? (
              <div className="playlist-floating-track-list">
                {playback.tracks.map((playlistTrack, index) => {
                  const active = index === playback.currentIndex;
                  return (
                    <button
                      key={`${playlistTrack.url}-${index}`}
                      className={`ghost fill playlist-track-row ${active ? "active" : ""}`}
                      onClick={() => {
                        onSelectTrack(index);
                        setTrackPickerOpen(false);
                      }}
                      type="button"
                    >
                      <span className="playlist-track-copy">
                        <strong>{playlistTrackTitle(playlistTrack, index)}</strong>
                        <small>{playlistTrackHost(playlistTrack.url)}</small>
                      </span>
                      <span className={badge(active ? "success" : "default")}>{active ? "Играет" : "Выбрать"}</span>
                    </button>
                  );
                })}
              </div>
            ) : null}
          </>
        ) : null}

        <audio ref={audioRef} className="playlist-audio-hidden" preload="auto" />
        <div className="playlist-media-shell" aria-hidden="true">
          <div ref={youtubeHostRef} />
        </div>
      </section>
    </div>
  );
}

function StatEntriesSection({
  title,
  hint,
  entries
}: {
  title: string;
  hint: string;
  entries: StatBlockEntry[];
}) {
  if (!entries.length) {
    return null;
  }

  return (
    <CollapsibleSection
      className="npc-section"
      defaultCollapsed
      hint={hint}
      summary={<p className="copy">{entries.length} записей в сокращённом виде.</p>}
      title={title}
    >
      <div className="entry-list">
        {entries.map((entry) => {
          const meta: ReactNode[] = [];

          if (entry.subtitle) {
            meta.push(
              <span key={`${entry.name}-subtitle`} className="entry-chip">
                {entry.subtitle}
              </span>
            );
          }

          if (entry.toHit) {
            meta.push(
              <span key={`${entry.name}-tohit`} className="entry-chip">
                Попадание: {entry.toHit}
              </span>
            );
          }

          if (entry.damage) {
            meta.push(
              <span key={`${entry.name}-damage`} className="entry-chip">
                Урон: {entry.damage}
              </span>
            );
          }

          if (entry.saveDc) {
            meta.push(
              <span key={`${entry.name}-save`} className="entry-chip">
                {entry.saveDc}
              </span>
            );
          }

          return (
            <article key={entry.name} className="entry-card">
              <div className="entry-header">
                <h3>{entry.name}</h3>
                {meta.length ? <div className="entry-meta">{meta}</div> : null}
              </div>
              <p className="copy">{entry.description}</p>
            </article>
          );
        })}
      </div>
    </CollapsibleSection>
  );
}

function CombatEntityStatSheet({ entity }: { entity: CombatProfileEntity }) {
  if (!entity.statBlock) {
    return null;
  }

  const { statBlock } = entity;
  const headerLabel = entity.kind === "monster" ? "Боевой профиль" : "Статы и способности";
  const detailRows = [
    { label: "Спасброски", value: statBlock.savingThrows },
    { label: "Навыки", value: statBlock.skills },
    { label: "Чувства", value: statBlock.senses },
    { label: "Языки", value: statBlock.languages },
    { label: "Сопротивления", value: statBlock.resistances },
    { label: "Иммунитеты", value: statBlock.immunities },
    { label: "Иммунитеты к состояниям", value: statBlock.conditionImmunities }
  ].filter((row): row is { label: string; value: string } => Boolean(row.value));

  return (
    <CollapsibleSection
      className="npc-sheet"
      defaultCollapsed
      hint={entity.kind === "monster" ? "Полный боевой профиль угрозы" : "Полный боевой и ролевой профиль"}
      summary={
        <div className="preview-stat-grid">
          <article className="card preview-stat-card">
            <small>КБ</small>
            <strong>{statBlock.armorClass}</strong>
          </article>
          <article className="card preview-stat-card">
            <small>ХП</small>
            <strong>{statBlock.hitPoints}</strong>
          </article>
          <article className="card preview-stat-card">
            <small>CR</small>
            <strong>{statBlock.challenge ?? "—"}</strong>
          </article>
        </div>
      }
      title={headerLabel}
    >
      <div className="npc-top">
        <figure className="npc-portrait-frame">
          <img
            alt={entity.art?.alt ?? entity.title}
            className="npc-portrait"
            src={createPortraitSource(entity)}
          />
          <figcaption>{entity.art?.caption ?? "Добавь art.url, чтобы заменить заглушку реальным артом."}</figcaption>
        </figure>

        <div className="npc-overview">
          <div className="stack">
            <div>
              <p className="eyebrow">Профиль</p>
              <h2>{entity.title}</h2>
              <p className="npc-type-line">
                {statBlock.size} {statBlock.creatureType}, {statBlock.alignment}
              </p>
            </div>

            <div className="npc-core-grid">
              <article className="card npc-core-card">
                <small>КБ</small>
                <strong>{statBlock.armorClass}</strong>
              </article>
              <article className="card npc-core-card">
                <small>ХП</small>
                <strong>{statBlock.hitPoints}</strong>
              </article>
              <article className="card npc-core-card">
                <small>Скорость</small>
                <strong>{statBlock.speed}</strong>
              </article>
              <article className="card npc-core-card">
                <small>Бонус мастерства</small>
                <strong>{statBlock.proficiencyBonus ?? "—"}</strong>
              </article>
              <article className="card npc-core-card">
              <small>CR / Опасность</small>
              <strong>{statBlock.challenge ?? "—"}</strong>
            </article>
          </div>
          </div>

          {detailRows.length ? (
            <div className="npc-detail-list">
              {detailRows.map((row) => (
                <div key={row.label} className="npc-detail-row">
                  <span>{row.label}</span>
                  <strong>{row.value}</strong>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      <div className="npc-ability-grid">
        {abilityLabels.map(({ key, label }) => {
          const score = statBlock.abilityScores[key];

          return (
            <article key={key} className="card ability-card">
              <small>{label}</small>
              <strong>{score}</strong>
              <span>{formatModifier(score)}</span>
            </article>
          );
        })}
      </div>

      {statBlock.spellcasting ? (
        <CollapsibleSection
          className="npc-section"
          defaultCollapsed
          hint="Магия, СЛ спасброска и подготовленные заклинания"
          summary={
            <p className="copy">
              {statBlock.spellcasting.title} • {statBlock.spellcasting.spells.length} заклинаний
            </p>
          }
          title={statBlock.spellcasting.title}
        >
          <div className="spell-grid">
            <article className="card npc-core-card">
              <small>Базовая характеристика</small>
              <strong>{statBlock.spellcasting.ability}</strong>
            </article>
            <article className="card npc-core-card">
              <small>СЛ спасброска</small>
              <strong>{statBlock.spellcasting.saveDc}</strong>
            </article>
            <article className="card npc-core-card">
              <small>Модификатор атаки</small>
              <strong>{statBlock.spellcasting.attackBonus}</strong>
            </article>
          </div>

          {statBlock.spellcasting.slots?.length ? (
            <div className="spell-slots">
              {statBlock.spellcasting.slots.map((slot) => (
                <span key={slot.level} className="entry-chip">
                  {slot.level}: {slot.slots}
                </span>
              ))}
            </div>
          ) : null}

          <div className="stack">
            {statBlock.spellcasting.description ? <p className="copy">{statBlock.spellcasting.description}</p> : null}
            <div className="spell-list">
              {statBlock.spellcasting.spells.map((spell) => (
                <span key={spell} className="spell-pill">
                  {spell}
                </span>
              ))}
            </div>
          </div>
        </CollapsibleSection>
      ) : null}

      <StatEntriesSection entries={statBlock.traits} hint="Пассивные особенности" title="Способности" />
      <StatEntriesSection entries={statBlock.actions} hint="Действия и атаки" title="Действия" />
      <StatEntriesSection entries={statBlock.bonusActions ?? []} hint="Дополнительные действия" title="Бонусные действия" />
      <StatEntriesSection entries={statBlock.reactions ?? []} hint="Реакции" title="Реакции" />
    </CollapsibleSection>
  );
}

function StatEntryEditorSection({
  title,
  hint,
  entries,
  onChange,
  onAdd,
  onRemove
}: {
  title: string;
  hint: string;
  entries: StatBlockEntry[];
  onChange: (index: number, patch: Partial<StatBlockEntry>) => void;
  onAdd: () => void;
  onRemove: (index: number) => void;
}) {
  return (
    <section className="card npc-section form-subsection">
      <div className="row muted">
        <div className="stack compact">
          <span>{title}</span>
          <small>{hint}</small>
        </div>
        <button className="ghost" onClick={onAdd} type="button">
          Добавить
        </button>
      </div>

      <div className="entry-editor-list">
        {entries.length ? (
          entries.map((entry, index) => (
            <article key={`${title}-${index}`} className="entry-editor">
              <div className="row">
                <strong>{title} #{index + 1}</strong>
                <button className="ghost danger-action" onClick={() => onRemove(index)} type="button">
                  Удалить
                </button>
              </div>

              <div className="form-grid">
                <label className="field">
                  <span>Название</span>
                  <input
                    className="input"
                    onChange={(event) => onChange(index, { name: event.target.value })}
                    value={entry.name}
                  />
                </label>
                <label className="field">
                  <span>Подпись</span>
                  <input
                    className="input"
                    onChange={(event) => onChange(index, { subtitle: event.target.value })}
                    value={entry.subtitle ?? ""}
                  />
                </label>
                <label className="field">
                  <span>Попадание</span>
                  <input
                    className="input"
                    onChange={(event) => onChange(index, { toHit: event.target.value })}
                    placeholder="+5 к попаданию"
                    value={entry.toHit ?? ""}
                  />
                </label>
                <label className="field">
                  <span>Урон</span>
                  <input
                    className="input"
                    onChange={(event) => onChange(index, { damage: event.target.value })}
                    placeholder="2d6 + 3 рубящего"
                    value={entry.damage ?? ""}
                  />
                </label>
                <label className="field field-full">
                  <span>СЛ / спасбросок</span>
                  <input
                    className="input"
                    onChange={(event) => onChange(index, { saveDc: event.target.value })}
                    placeholder="СЛ 13 Ловкости"
                    value={entry.saveDc ?? ""}
                  />
                </label>
                <label className="field field-full">
                  <span>Описание</span>
                  <textarea
                    className="input textarea"
                    onChange={(event) => onChange(index, { description: event.target.value })}
                    value={entry.description}
                  />
                </label>
              </div>
            </article>
          ))
        ) : (
          <p className="copy">Секция пока пустая.</p>
        )}
      </div>
    </section>
  );
}

function CombatEntityPreviewSummary({ entity }: { entity: CombatProfileEntity }) {
  if (!entity.statBlock) {
    return null;
  }

  return (
    <div className="stack">
      <div className="preview-stat-grid">
        <article className="card preview-stat-card">
          <small>КБ</small>
          <strong>{entity.statBlock.armorClass}</strong>
        </article>
        <article className="card preview-stat-card">
          <small>ХП</small>
          <strong>{entity.statBlock.hitPoints}</strong>
        </article>
        <article className="card preview-stat-card">
          <small>Скорость</small>
          <strong>{entity.statBlock.speed}</strong>
        </article>
      </div>

      <div className="stack">
        {entity.statBlock.actions.slice(0, 2).map((action) => (
          <article key={action.name} className="card mini preview-entry">
            <strong>{action.name}</strong>
            <p className="copy">
              {[action.toHit, action.damage].filter(Boolean).join(" • ") || action.description}
            </p>
          </article>
        ))}
      </div>
    </div>
  );
}

function RewardSection({
  rewardProfile,
  compact = false,
  kind = "monster"
}: {
  rewardProfile?: MonsterRewardProfile;
  compact?: boolean;
  kind?: EntityKind;
}) {
  if (!rewardProfile || (!rewardProfile.summary && !rewardProfile.loot.length)) {
    return null;
  }

  const visibleLoot = compact ? rewardProfile.loot.slice(0, 2) : rewardProfile.loot;
  const sectionMeta = rewardSectionLabel(kind);

  return (
    <CollapsibleSection
      className="npc-section monster-reward-section"
      defaultCollapsed={compact}
      hint={compact ? "Короткая сводка" : sectionMeta.hint}
      summary={<p className="copy">{rewardSummaryText(rewardProfile) || `${rewardProfile.loot.length} записей.`}</p>}
      title={sectionMeta.title}
    >
      {rewardProfile.summary ? <p className="copy">{rewardProfile.summary}</p> : null}

      <div className="loot-grid">
        {visibleLoot.map((item, index) => (
          <article key={`${item.name}-${index}`} className="entry-card loot-card">
            <div className="entry-header">
              <h3>{item.name}</h3>
              <div className="entry-meta">
                <span className="entry-chip">{item.category}</span>
                <span className="entry-chip">{item.quantity}</span>
              </div>
            </div>
            <p className="copy">
              Проверка: {item.check}
              {item.dc ? ` • ${item.dc}` : ""}
            </p>
            {item.details ? <p className="copy">{item.details}</p> : null}
          </article>
        ))}
      </div>

      {compact && rewardProfile.loot.length > visibleLoot.length ? (
        <small>Ещё {rewardProfile.loot.length - visibleLoot.length} записей в полной карточке.</small>
      ) : null}
    </CollapsibleSection>
  );
}

type QuestTextSection = {
  title: string;
  body: string[];
};

type QuestActionCard = {
  title: string;
  description: string;
  detail: string;
  tone: QuickFactTone;
};

type QuestChecklistItem = {
  key: string;
  label: string;
  done: boolean;
};

type QuestCombatEntrySummary = {
  entity: CombatProfileEntity;
  quantity: number;
};

type QuestLinkedEntity = {
  entity: KnowledgeEntity;
  label: string;
  tone: QuickFactTone;
  note?: string;
};

const escapeSvgText = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const stripWikiMarkup = (value: string) =>
  value.replace(/\[\[([^[\]|]+)(?:\|([^[\]]+))?\]\]/g, (_, targetTitle: string, label?: string) => label ?? targetTitle);

const normalizeQuestText = (value: string) =>
  stripWikiMarkup(value)
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/__(.*?)__/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/^>\s*/gm, "")
    .trim();

const cleanQuestLine = (value: string) =>
  normalizeQuestText(value)
    .replace(/^\s*[-*+]\s+/, "")
    .replace(/^\s*\d+\.\s+/, "")
    .replace(/\s+/g, " ")
    .trim();

const splitQuestNarrative = (value: string, maxItems = 5) =>
  normalizeQuestText(value)
    .replace(/\r/g, "")
    .split(/\n+/)
    .flatMap((paragraph) => paragraph.split(/(?:[.!?])\s+/u))
    .map((line) => cleanQuestLine(line))
    .filter(Boolean)
    .slice(0, maxItems);

const parseQuestTextSections = (value?: string): QuestTextSection[] => {
  if (!value?.trim()) {
    return [];
  }

  const lines = value.replace(/\r/g, "").split("\n");
  const sections: QuestTextSection[] = [];
  let currentTitle = "";
  let currentBody: string[] = [];

  const pushCurrent = () => {
    const body = currentBody.map((line) => line.trim()).filter(Boolean);
    if (currentTitle || body.length) {
      sections.push({
        title: cleanQuestLine(currentTitle || "Общее"),
        body
      });
    }
  };

  lines.forEach((rawLine) => {
    const line = rawLine.trim();
    if (!line) {
      return;
    }

    if (/^#{1,6}\s+/.test(line)) {
      pushCurrent();
      currentTitle = line.replace(/^#{1,6}\s+/, "");
      currentBody = [];
      return;
    }

    currentBody.push(line);
  });

  pushCurrent();

  return sections;
};

const findQuestTextSection = (sections: QuestTextSection[], keywords: string[]) =>
  sections.find((section) => {
    const title = section.title.toLowerCase();
    return keywords.some((keyword) => title.includes(keyword));
  });

const collectQuestSectionLines = (section?: QuestTextSection | null, maxItems = 5) => {
  if (!section) {
    return [];
  }

  return section.body
    .flatMap((line) =>
      /^\s*[-*+]\s+/.test(line) || /^\s*\d+\.\s+/.test(line) ? [cleanQuestLine(line)] : splitQuestNarrative(line, maxItems)
    )
    .filter(Boolean)
    .slice(0, maxItems);
};

const dedupeQuestLines = (lines: string[], maxItems = 5) => {
  const seen = new Set<string>();
  return lines
    .filter((line) => {
      const key = line.toLowerCase();
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    })
    .slice(0, maxItems);
};

const questStatusTone = (status: QuestEntity["status"]): QuickFactTone => {
  switch (status) {
    case "active":
      return "success";
    case "paused":
      return "warning";
    case "completed":
      return "accent";
    default:
      return "default";
  }
};

const questUrgencyTone = (urgency?: QuestEntity["urgency"]): QuickFactTone => {
  switch (urgency) {
    case "Critical":
      return "danger";
    case "High":
      return "warning";
    case "Medium":
      return "accent";
    case "Low":
      return "success";
    default:
      return "default";
  }
};

const actionToneFromText = (value: string): QuickFactTone => {
  const lower = value.toLowerCase();
  if (/(атак|бой|угроз|силой|оруж|удар)/.test(lower)) {
    return "danger";
  }
  if (/(осмотр|след|улики|проверк|поиск|замет)/.test(lower)) {
    return "accent";
  }
  if (/(скрыт|подкра|тихо|развед|обойти)/.test(lower)) {
    return "warning";
  }
  return "success";
};

const actionDetailFromText = (value: string) => {
  const lower = value.toLowerCase();
  if (/(поговор|спрос|убеж|соц|допрос)/.test(lower)) {
    return "Социально";
  }
  if (/(маг|заклин|чары|ритуал)/.test(lower)) {
    return "Магия";
  }
  if (/(осмотр|след|улики|проверк|воспр|анализ)/.test(lower)) {
    return "Наблюдение";
  }
  if (/(скрыт|подкра|тихо|развед|обойти)/.test(lower)) {
    return "Скрытность";
  }
  if (/(атак|бой|сил|угроз|оруж)/.test(lower)) {
    return "Силовое решение";
  }
  return "Свободный ход";
};

const buildQuestActionCards = ({
  quest,
  playerSections,
  location,
  issuer,
  preparedCombatEntries
}: {
  quest: QuestEntity;
  playerSections: QuestTextSection[];
  location: LocationEntity | null;
  issuer: NpcEntity | null;
  preparedCombatEntries: QuestCombatEntrySummary[];
}): QuestActionCard[] => {
  const actionSection = findQuestTextSection(playerSections, ["что вы можете", "возможные действия", "действия игроков"]);
  const explicitActions = collectQuestSectionLines(actionSection, 6).map((line, index) => {
    const match = line.match(/^([^:.-]{2,48})[:.-]\s*(.+)$/);
    const title = cleanQuestLine(match?.[1] ?? `Ход ${index + 1}`);
    const description = cleanQuestLine(match?.[2] ?? line);
    const source = `${title} ${description}`;

    return {
      title,
      description,
      detail: actionDetailFromText(source),
      tone: actionToneFromText(source)
    };
  });

  if (explicitActions.length) {
    return explicitActions.slice(0, 4);
  }

  const fallback: QuestActionCard[] = [];

  if (issuer) {
    fallback.push({
      title: "Поговорить",
      description: `Расспросить ${issuer.title} о мотивах, маршруте и том, что здесь пошло не так.`,
      detail: "Социально",
      tone: "success"
    });
  }

  if (location) {
    fallback.push({
      title: "Осмотреть место",
      description: `Проверить ${location.title} и собрать улики, пока сцена не успела сменить темп.`,
      detail: "Наблюдение",
      tone: "accent"
    });
  }

  fallback.push({
    title: "Проверить подвох",
    description: "Сверить детали, отследить противоречия и понять, где именно сцена может сорваться.",
    detail: "Проверка",
    tone: "warning"
  });

  if (preparedCombatEntries.length) {
    fallback.push({
      title: "Вступить в бой",
      description: `Если переговоры провалятся, сцена может перейти в столкновение с ${preparedCombatEntries.reduce(
        (sum, item) => sum + item.quantity,
        0
      )} противниками.`,
      detail: "Силовое решение",
      tone: "danger"
    });
  }

  if (quest.rewardProfile?.summary.trim()) {
    fallback.push({
      title: "Торговаться",
      description: truncateInlineText(cleanQuestLine(quest.rewardProfile.summary), 110),
      detail: "Ставка",
      tone: "accent"
    });
  }

  return fallback.slice(0, 4);
};

const buildQuestChecklistItems = ({
  quest,
  location,
  issuer,
  preparedCombatEntries
}: {
  quest: QuestEntity;
  location: LocationEntity | null;
  issuer: NpcEntity | null;
  preparedCombatEntries: QuestCombatEntrySummary[];
}): QuestChecklistItem[] => [
  {
    key: "players",
    label: quest.playerContent?.trim() ? "Версия для игроков подготовлена" : "Подготовить версию для игроков",
    done: Boolean(quest.playerContent?.trim())
  },
  {
    key: "issuer",
    label: issuer ? `Ввести в сцену ${issuer.title}` : "Определить квестодателя",
    done: Boolean(issuer)
  },
  {
    key: "location",
    label: location ? `Собрать сцену в ${location.title}` : "Привязать сцену к локации",
    done: Boolean(location)
  },
  {
    key: "combat",
    label: preparedCombatEntries.length ? "Заготовленный бой готов" : "Собрать возможный бой",
    done: preparedCombatEntries.length > 0
  },
  {
    key: "rewards",
    label: rewardSummaryText(quest.rewardProfile) ? "Награды и последствия описаны" : "Прописать награды и последствия",
    done: Boolean(rewardSummaryText(quest.rewardProfile))
  },
  {
    key: "followup",
    label: quest.related.length ? "Следующие связи сцены отмечены" : "Добавить продолжение и связи",
    done: quest.related.length > 0
  }
];

const buildQuestObjectiveLines = ({
  quest,
  location,
  issuer,
  preparedCombatEntries,
  relatedQuests
}: {
  quest: QuestEntity;
  location: LocationEntity | null;
  issuer: NpcEntity | null;
  preparedCombatEntries: QuestCombatEntrySummary[];
  relatedQuests: QuestEntity[];
}) => {
  const lines = [
    quest.summary.trim(),
    location ? `Локация сцены: ${location.title}.` : "",
    issuer ? `Квест ведёт ${issuer.title}.` : "",
    quest.urgency ? `Срочность: ${quest.urgency}.` : "",
    preparedCombatEntries.length
      ? `В резерве ${preparedCombatEntries.reduce((sum, item) => sum + item.quantity, 0)} противников, если сцена сорвётся в бой.`
      : "Сцена пока не привязана к отдельному бою и может решиться разговором, осмотром или обходным ходом.",
    rewardSummaryText(quest.rewardProfile) ? `Ставка: ${cleanQuestLine(rewardSummaryText(quest.rewardProfile) ?? "")}.` : "",
    relatedQuests.length ? `${relatedQuests.length} соседних квестовых нитей уже связаны с этой сценой.` : ""
  ].filter(Boolean);

  return dedupeQuestLines(lines.map((line) => cleanQuestLine(line)), 5);
};

const createGeneratedQuestSceneBackdrop = (quest: QuestEntity, location: LocationEntity | null) => {
  const accent =
    quest.urgency === "Critical"
      ? "#f0937d"
      : quest.urgency === "High"
        ? "#e6c07d"
        : quest.urgency === "Medium"
          ? "#8ea7ff"
          : "#7ed6a1";
  const safeTitle = escapeSvgText(quest.title);
  const safeLocation = escapeSvgText(location?.title ?? quest.subtitle ?? "Quest dossier");
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 720">
      <defs>
        <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#0e1624"/>
          <stop offset="55%" stop-color="#111c2f"/>
          <stop offset="100%" stop-color="#060a11"/>
        </linearGradient>
        <linearGradient id="ground" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#11161d"/>
          <stop offset="100%" stop-color="#05070b"/>
        </linearGradient>
      </defs>
      <rect width="1600" height="720" fill="url(#sky)"/>
      <circle cx="1180" cy="150" r="120" fill="rgba(146,179,255,0.12)"/>
      <circle cx="1180" cy="150" r="58" fill="rgba(255,255,255,0.14)"/>
      <path d="M0 430 C180 360 340 370 520 420 C660 458 760 430 900 390 C1060 344 1220 336 1600 420 L1600 720 L0 720 Z" fill="rgba(16,20,29,0.88)"/>
      <path d="M0 520 C140 468 280 470 430 520 C600 575 760 560 920 514 C1080 468 1260 462 1600 540 L1600 720 L0 720 Z" fill="url(#ground)"/>
      <path d="M1060 330 L1105 230 L1148 330 Z" fill="rgba(32,39,52,0.82)"/>
      <path d="M1110 330 L1164 190 L1220 330 Z" fill="rgba(26,33,44,0.9)"/>
      <path d="M1180 330 L1230 215 L1280 330 Z" fill="rgba(32,39,52,0.82)"/>
      <rect x="1122" y="330" width="126" height="98" rx="8" fill="rgba(18,22,30,0.92)"/>
      <rect x="1172" y="360" width="28" height="48" rx="4" fill="rgba(255,214,136,0.72)"/>
      <path d="M320 520 C412 436 504 426 604 466 C686 500 744 496 820 462" fill="none" stroke="rgba(184,155,102,0.22)" stroke-width="34" stroke-linecap="round"/>
      <path d="M280 502 C362 422 462 412 560 452" fill="none" stroke="rgba(0,0,0,0.26)" stroke-width="6" stroke-linecap="round"/>
      <g fill="rgba(14,18,24,0.92)">
        <path d="M314 466 l40 -70 l42 70 z"/>
        <path d="M354 470 l48 -86 l52 86 z"/>
        <path d="M402 470 l40 -72 l44 72 z"/>
        <path d="M1240 470 l36 -66 l38 66 z"/>
        <path d="M1270 472 l48 -92 l52 92 z"/>
        <path d="M1322 472 l36 -66 l40 66 z"/>
      </g>
      <rect x="84" y="70" width="340" height="36" rx="18" fill="rgba(18,23,33,0.62)" stroke="rgba(255,255,255,0.06)"/>
      <text x="112" y="95" fill="rgba(235,241,255,0.72)" font-family="Segoe UI, Arial, sans-serif" font-size="20" letter-spacing="3">${safeLocation}</text>
      <text x="84" y="618" fill="rgba(243,246,255,0.95)" font-family="Georgia, serif" font-size="66" font-weight="700">${safeTitle}</text>
      <text x="84" y="664" fill="${accent}" font-family="Segoe UI, Arial, sans-serif" font-size="24">Scene preview</text>
      <rect x="0" y="0" width="1600" height="720" fill="rgba(4,7,12,0.14)"/>
    </svg>
  `;

  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
};

const resolveQuestSceneArtwork = (
  quest: QuestEntity,
  location: LocationEntity | null,
  issuer: NpcEntity | null,
  preparedCombatEntries: QuestCombatEntrySummary[] = []
) =>
  quest.art?.url ||
  location?.art?.url ||
  issuer?.art?.url ||
  preparedCombatEntries.find((item) => item.entity.art?.url)?.entity.art?.url ||
  createGeneratedQuestSceneBackdrop(quest, location);

function QuestMetaPill({
  label,
  value,
  tone = "default"
}: {
  label: string;
  value: string;
  tone?: QuickFactTone;
}) {
  return (
    <div className={`quest-meta-pill quest-tone-${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function QuestEntityChip({
  entity,
  label,
  tone = "default",
  onOpen
}: {
  entity: KnowledgeEntity;
  label: string;
  tone?: QuickFactTone;
  onOpen: (id: string) => void;
}) {
  return (
    <button className={`quest-entity-chip quest-tone-${tone}`} onClick={() => onOpen(entity.id)} type="button">
      <small>{label}</small>
      <strong>{entity.title}</strong>
    </button>
  );
}

function QuestPreviewActionButton({
  label,
  hint,
  tone = "default",
  disabled = false,
  onClick
}: {
  label: string;
  hint: string;
  tone?: QuickFactTone;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button className={`quest-preview-action quest-tone-${tone}`} disabled={disabled} onClick={onClick} type="button">
      <strong>{label}</strong>
      <span>{hint}</span>
    </button>
  );
}

function QuestPreviewEntityCard({
  item,
  onOpen
}: {
  item: QuestLinkedEntity;
  onOpen: (id: string) => void;
}) {
  return (
    <button className="quest-preview-entity" onClick={() => onOpen(item.entity.id)} type="button">
      <EntityVisual entity={item.entity} />
      <span className="quest-preview-entity-copy">
        <small>{item.label}</small>
        <strong>{item.entity.title}</strong>
        <span>{item.note || item.entity.subtitle || item.entity.summary}</span>
      </span>
    </button>
  );
}

function QuestWorkspace({
  quest,
  location,
  issuer,
  linkedEntities,
  relatedQuests,
  preparedCombatEntries,
  previousQuest,
  nextQuest,
  pinned,
  onEdit,
  onTogglePin,
  onOpenDirectory,
  onOpenPlayerView,
  onOpenEntity,
  onOpenQuest
}: {
  quest: QuestEntity;
  location: LocationEntity | null;
  issuer: NpcEntity | null;
  linkedEntities: QuestLinkedEntity[];
  relatedQuests: QuestEntity[];
  preparedCombatEntries: QuestCombatEntrySummary[];
  previousQuest: QuestEntity | null;
  nextQuest: QuestEntity | null;
  pinned: boolean;
  onEdit: (id: string) => void;
  onTogglePin: (id: string) => void;
  onOpenDirectory: () => void;
  onOpenPlayerView: (quest: QuestEntity) => void;
  onOpenEntity: (id: string) => void;
  onOpenQuest: (id: string) => void;
}) {
  const playerSections = useMemo(() => parseQuestTextSections(quest.playerContent), [quest.playerContent]);
  const gmSections = useMemo(() => parseQuestTextSections(quest.content), [quest.content]);
  const sceneImage = useMemo(
    () => resolveQuestSceneArtwork(quest, location, issuer, preparedCombatEntries),
    [issuer, location, preparedCombatEntries, quest]
  );
  const visibleHighlights = useMemo(
    () =>
      dedupeQuestLines(
        [
          ...collectQuestSectionLines(findQuestTextSection(playerSections, ["что видят", "видят сразу", "общее впечатление"]), 3),
          ...collectQuestSectionLines(findQuestTextSection(playerSections, ["можно заметить", "вниматель", "странности"]), 3),
          ...collectQuestSectionLines(findQuestTextSection(playerSections, ["кто первым", "кто заговорит"]), 2)
        ],
        5
      ),
    [playerSections]
  );
  const hiddenHighlights = useMemo(() => {
    const prioritized = [
      ...collectQuestSectionLines(findQuestTextSection(gmSections, ["на самом деле", "что происходит", "скрыто", "правда"]), 5),
      ...collectQuestSectionLines(findQuestTextSection(gmSections, ["опасность", "угроза", "засада"]), 3)
    ];
    return prioritized.length ? dedupeQuestLines(prioritized, 5) : splitQuestNarrative(quest.content, 5);
  }, [gmSections, quest.content]);
  const objectiveLines = useMemo(
    () =>
      buildQuestObjectiveLines({
        quest,
        location,
        issuer,
        preparedCombatEntries,
        relatedQuests
      }),
    [issuer, location, preparedCombatEntries, quest, relatedQuests]
  );
  const actionCards = useMemo(
    () =>
      buildQuestActionCards({
        quest,
        playerSections,
        location,
        issuer,
        preparedCombatEntries
      }),
    [issuer, location, playerSections, preparedCombatEntries, quest]
  );
  const checklistItems = useMemo(
    () =>
      buildQuestChecklistItems({
        quest,
        location,
        issuer,
        preparedCombatEntries
      }),
    [issuer, location, preparedCombatEntries, quest]
  );
  const rewardItems = quest.rewardProfile?.loot ?? [];
  const playerVisible = Boolean(quest.playerContent?.trim());
  const preparedCombatCount = preparedCombatEntries.reduce((sum, item) => sum + item.quantity, 0);
  const heroLinkedEntities = linkedEntities.slice(0, 4);
  const sceneLead =
    collectQuestSectionLines(findQuestTextSection(playerSections, ["что происходит", "суть", "контекст"]), 1)[0] ??
    quest.summary;

  return (
    <div className="quest-shell">
      <section className="card quest-hero-panel">
        <div className="quest-hero-top">
          <div className="quest-breadcrumbs">
            <button className="quest-breadcrumb-btn" onClick={onOpenDirectory} type="button">
              Квесты
            </button>
            <span>/</span>
            <strong>{quest.title}</strong>
          </div>

          <div className="quest-nav-buttons">
            <button className="ghost quest-nav-btn" disabled={!previousQuest} onClick={() => previousQuest && onOpenQuest(previousQuest.id)} type="button">
              Предыдущий
            </button>
            <button className="ghost quest-nav-btn" disabled={!nextQuest} onClick={() => nextQuest && onOpenQuest(nextQuest.id)} type="button">
              Следующий
            </button>
          </div>
        </div>

        <div className="quest-hero-main">
          <div className="quest-hero-copy">
            <div className="quest-title-row">
              <h1>{quest.title}</h1>
              <span className={badge("warning")}>Квест</span>
            </div>
            <p className="quest-hero-summary">{quest.summary}</p>
            <p className="quest-hero-subtitle">{quest.subtitle}</p>

            {heroLinkedEntities.length ? (
              <div className="quest-anchor-row">
                {heroLinkedEntities.map((item) => (
                  <QuestEntityChip key={`${quest.id}-hero-link-${item.entity.id}`} entity={item.entity} label={item.label} onOpen={onOpenEntity} tone={item.tone} />
                ))}
              </div>
            ) : null}
          </div>

          <div className="quest-hero-actions">
            <button className="ghost" onClick={() => onEdit(quest.id)} type="button">
              Редактировать
            </button>
            <button className="ghost" disabled={!playerVisible} onClick={() => onOpenPlayerView(quest)} type="button">
              Показать игрокам
            </button>
            <button className={pinned ? "primary" : "ghost"} onClick={() => onTogglePin(quest.id)} type="button">
              {pinned ? "Закреплено" : "Закрепить"}
            </button>
          </div>
        </div>

        <div className="quest-status-grid">
          <QuestMetaPill label="Статус" tone={questStatusTone(quest.status)} value={quest.status} />
          <QuestMetaPill label="Срочность" tone={questUrgencyTone(quest.urgency)} value={quest.urgency} />
          <QuestMetaPill label="Игроки" tone={playerVisible ? "success" : "warning"} value={playerVisible ? "Есть версия" : "Не заполнено"} />
          <QuestMetaPill label="Бой" tone={preparedCombatCount ? "danger" : "default"} value={preparedCombatCount ? `${preparedCombatCount} в сцене` : "Не настроен"} />
          <QuestMetaPill
            label="Награда"
            tone={rewardSummaryText(quest.rewardProfile) ? "success" : "default"}
            value={rewardSummaryText(quest.rewardProfile) || "Не заполнена"}
          />
        </div>
      </section>

      <section className="card quest-scene-spotlight">
        <div className="quest-scene-copy">
          <span className="quest-scene-label">Суть сцены</span>
          <strong>{findQuestTextSection(playerSections, ["что происходит", "суть"])?.title || "Фокус текущего эпизода"}</strong>
          <p>{sceneLead}</p>
          <div className="quest-scene-inline-meta">
            {location ? <span>{location.title}</span> : null}
            {issuer ? <span>{issuer.title}</span> : null}
            {preparedCombatCount ? <span>{preparedCombatCount} противников в резерве</span> : null}
          </div>
        </div>

        <div className="quest-scene-visual">
          <img alt={quest.title} className="quest-scene-image" loading="lazy" src={sceneImage} />
        </div>
      </section>

      <div className="quest-story-grid">
        <article className="card quest-story-card quest-story-card-players">
          <div className="quest-story-head">
            <strong>Игроки видят</strong>
            <span className={badge("success")}>{playerVisible ? "Player-safe" : "Черновик нужен"}</span>
          </div>

          {visibleHighlights.length ? (
            <ul className="quest-bullet-list">
              {visibleHighlights.map((line) => (
                <li key={`${quest.id}-visible-${line}`}>{line}</li>
              ))}
            </ul>
          ) : (
            <p className="copy">Пока нет отдельного player-facing описания. Его можно заполнить через редактор квеста.</p>
          )}

          <button className="ghost fill" disabled={!playerVisible} onClick={() => onOpenPlayerView(quest)} type="button">
            Показать игрокам
          </button>
        </article>

        <article className="card quest-story-card quest-story-card-hidden">
          <div className="quest-story-head">
            <strong>Скрыто от игроков</strong>
            <span className={badge("warning")}>GM only</span>
          </div>

          {hiddenHighlights.length ? (
            <ul className="quest-bullet-list">
              {hiddenHighlights.map((line) => (
                <li key={`${quest.id}-hidden-${line}`}>{line}</li>
              ))}
            </ul>
          ) : (
            <p className="copy">GM-заметки пока не заполнены.</p>
          )}
        </article>

        <article className="card quest-story-card quest-story-card-goal">
          <div className="quest-story-head">
            <strong>Цель сцены</strong>
            <span className={badge("accent")}>Фокус мастера</span>
          </div>

          <ul className="quest-bullet-list">
            {objectiveLines.map((line) => (
              <li key={`${quest.id}-goal-${line}`}>{line}</li>
            ))}
          </ul>

          {relatedQuests.length ? (
            <div className="quest-inline-links">
              {relatedQuests.slice(0, 2).map((item) => (
                <button key={`${quest.id}-inline-related-${item.id}`} className="ghost" onClick={() => onOpenQuest(item.id)} type="button">
                  {item.title}
                </button>
              ))}
            </div>
          ) : null}
        </article>
      </div>

      <section className="card quest-action-section">
        <div className="row">
          <strong>Возможные действия игроков</strong>
          <small>{actionCards.length} направления сцены</small>
        </div>

        <div className="quest-action-grid">
          {actionCards.map((action) => (
            <article key={`${quest.id}-${action.title}`} className={`quest-action-card quest-tone-${action.tone}`}>
              <span>{action.detail}</span>
              <strong>{action.title}</strong>
              <p>{action.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="card quest-checklist-section">
        <div className="row">
          <strong>Чек-лист мастера</strong>
          <small>
            {checklistItems.filter((item) => item.done).length}/{checklistItems.length} готово
          </small>
        </div>

        <div className="quest-checklist-grid">
          {checklistItems.map((item) => (
            <label key={`${quest.id}-${item.key}`} className={`quest-checklist-item ${item.done ? "done" : ""}`}>
              <input defaultChecked={item.done} type="checkbox" />
              <span>{item.label}</span>
            </label>
          ))}
        </div>
      </section>

      <section className="card quest-reward-section">
        <div className="row">
          <strong>Награды и ставка</strong>
          <small>{rewardItems.length ? `${rewardItems.length} позиций` : "Награды пока не заданы"}</small>
        </div>

        {quest.rewardProfile?.summary.trim() ? <p className="copy quest-reward-summary">{quest.rewardProfile.summary.trim()}</p> : null}

        {rewardItems.length ? (
          <div className="quest-reward-grid">
            {rewardItems.slice(0, 4).map((item, index) => (
              <article key={`${quest.id}-reward-${item.name}-${index}`} className="quest-reward-card">
                <span>{item.category}</span>
                <strong>{item.name}</strong>
                <p>{item.quantity}</p>
                <small>
                  {item.check}
                  {item.dc ? ` • ${item.dc}` : ""}
                </small>
              </article>
            ))}
          </div>
        ) : (
          <p className="quest-empty-state">
            Здесь пока пусто. Когда заполнишь награды в редакторе, они появятся в этом компактном блоке.
          </p>
        )}
      </section>
    </div>
  );
}

function QuestPreviewPanel({
  quest,
  location,
  issuer,
  linkedEntities,
  relatedQuests,
  preparedCombatEntries,
  pinned,
  hasActiveCombat,
  combatPartyLevelsText,
  combatPartySummary,
  hasExplicitPartyLevels,
  effectiveCombatThresholds,
  onTogglePin,
  onRunCombat,
  onOpenRandomEvent,
  onOpenPlayerView,
  onEdit,
  onOpenEntity,
  onOpenQuest,
  onOpenPlaylist,
  onOpenGallery,
  onCombatPartyLevelsChange
}: {
  quest: QuestEntity;
  location: LocationEntity | null;
  issuer: NpcEntity | null;
  linkedEntities: QuestLinkedEntity[];
  relatedQuests: QuestEntity[];
  preparedCombatEntries: QuestCombatEntrySummary[];
  pinned: boolean;
  hasActiveCombat: boolean;
  combatPartyLevelsText: string;
  combatPartySummary: string;
  hasExplicitPartyLevels: boolean;
  effectiveCombatThresholds: CombatThresholds;
  onTogglePin: (id: string) => void;
  onRunCombat: (quest: QuestEntity) => void;
  onOpenRandomEvent: () => void;
  onOpenPlayerView: (quest: QuestEntity) => void;
  onEdit: (id: string) => void;
  onOpenEntity: (id: string) => void;
  onOpenQuest: (id: string) => void;
  onOpenPlaylist: (quest: QuestEntity) => void;
  onOpenGallery: (quest: QuestEntity) => void;
  onCombatPartyLevelsChange: (value: string) => void;
}) {
  const sceneImage = useMemo(
    () => resolveQuestSceneArtwork(quest, location, issuer, preparedCombatEntries),
    [issuer, location, preparedCombatEntries, quest]
  );
  const preparedCombatCount = preparedCombatEntries.reduce((sum, item) => sum + item.quantity, 0);
  const participants = useMemo(() => {
    const nextItems: Array<{ key: string; title: string; note: string; tone: QuickFactTone; quantity?: number; id: string }> = [];

    if (issuer) {
      nextItems.push({
        key: `issuer-${issuer.id}`,
        id: issuer.id,
        title: issuer.title,
        note: issuer.role || "Квестодатель",
        tone: "accent"
      });
    }

    preparedCombatEntries.forEach((item) => {
      nextItems.push({
        key: `combat-${item.entity.id}`,
        id: item.entity.id,
        title: item.entity.title,
        note: item.entity.kind === "monster" ? "Противник" : "Участник сцены",
        tone: item.entity.kind === "monster" ? "danger" : "warning",
        quantity: item.quantity
      });
    });

    if (!nextItems.length) {
      linkedEntities
        .filter((item) => item.entity.kind === "npc" || item.entity.kind === "monster")
        .slice(0, 4)
        .forEach((item) => {
          nextItems.push({
            key: `linked-${item.entity.id}`,
            id: item.entity.id,
            title: item.entity.title,
            note: item.note || item.label,
            tone: item.tone
          });
        });
    }

    return nextItems.slice(0, 6);
  }, [issuer, linkedEntities, preparedCombatEntries]);
  const hasPlayerFacingVersion = Boolean(quest.playerContent?.trim());
  const combatPrimaryLabel = hasActiveCombat ? "Открыть бой" : preparedCombatCount ? "Начать бой" : "Настроить бой";
  const combatPrimaryHint = hasActiveCombat
    ? "Сейчас уже идёт активная сцена"
    : preparedCombatCount
      ? `${preparedCombatCount} противников готовы`
      : "Собрать сцену перед запуском";

  return (
    <div className="quest-preview-shell">
      <div className="row">
        <p className="eyebrow">Peek / Preview</p>
        <button className={`quest-pin-toggle ${pinned ? "active" : ""}`} onClick={() => onTogglePin(quest.id)} type="button">
          {pinned ? "Pinned" : "Pin"}
        </button>
      </div>

      <section className="quest-preview-hero" style={createHeroPanelStyle(gradients.quest, sceneImage)}>
        <span>Квест</span>
        <strong>{quest.title}</strong>
        <small>{quest.summary}</small>
      </section>

      {linkedEntities.length ? (
        <section className="quest-preview-section">
          <div className="row">
            <strong>Закреплённые сущности</strong>
            <small>{linkedEntities.length}</small>
          </div>
          <div className="quest-preview-entity-grid">
            {linkedEntities.slice(0, 4).map((item) => (
              <QuestPreviewEntityCard key={`${quest.id}-preview-link-${item.entity.id}`} item={item} onOpen={onOpenEntity} />
            ))}
          </div>
        </section>
      ) : null}

      <section className="quest-preview-section">
        <div className="row">
          <strong>Быстрые действия</strong>
          <small>{preparedCombatCount ? "Сцена готова к запуску" : "Можно добрать настройку"}</small>
        </div>

        <div className="quest-preview-action-grid">
          <QuestPreviewActionButton hint={combatPrimaryHint} label={combatPrimaryLabel} onClick={() => onRunCombat(quest)} tone="danger" />
          <QuestPreviewActionButton hint="Подбросить поворот прямо в текущую сцену" label="Случайное событие" onClick={onOpenRandomEvent} tone="warning" />
          <QuestPreviewActionButton
            disabled={!hasPlayerFacingVersion}
            hint={hasPlayerFacingVersion ? "Открыть версию для игроков" : "Отдельная версия не заполнена"}
            label="Показать игрокам"
            onClick={() => onOpenPlayerView(quest)}
            tone="accent"
          />
          <QuestPreviewActionButton hint="Исправить текст, связи и награды" label="Редактировать" onClick={() => onEdit(quest.id)} tone="success" />
        </div>

        {preparedCombatCount ? (
          <div className="quest-preview-combat-settings">
            <label className="field">
              <span>Уровни группы</span>
              <input
                className="input"
                onChange={(event) => onCombatPartyLevelsChange(event.target.value)}
                placeholder="4,4,4,4"
                value={combatPartyLevelsText}
              />
            </label>
            <p className="copy quest-preview-note">{combatPartySummary}</p>
            {!hasExplicitPartyLevels ? (
              <p className="copy quest-preview-note">
                Пороги: Easy {effectiveCombatThresholds.easy} • Medium {effectiveCombatThresholds.medium} • Hard{" "}
                {effectiveCombatThresholds.hard} • Deadly {effectiveCombatThresholds.deadly}
              </p>
            ) : null}
          </div>
        ) : null}
      </section>

      <section className="quest-preview-section">
        <div className="row">
          <strong>Участники сцены</strong>
          <small>{participants.length}</small>
        </div>

        {participants.length ? (
          <div className="quest-preview-list">
            {participants.map((item) => (
              <button key={item.key} className={`quest-preview-list-item quest-tone-${item.tone}`} onClick={() => onOpenEntity(item.id)} type="button">
                <span className="quest-preview-list-copy">
                  <strong>{item.title}</strong>
                  <small>{item.note}</small>
                </span>
                {item.quantity ? <span className="quest-preview-list-badge">x{item.quantity}</span> : null}
              </button>
            ))}
          </div>
        ) : (
          <p className="quest-empty-state">Пока отдельные участники сцены не отмечены.</p>
        )}
      </section>

      {location ? (
        <section className="quest-preview-section">
          <div className="row">
            <strong>Связанная локация</strong>
            <small>1</small>
          </div>
          <QuestPreviewEntityCard
            item={{
              entity: location,
              label: "Локация",
              tone: "accent",
              note: location.summary
            }}
            onOpen={onOpenEntity}
          />
        </section>
      ) : null}

      {relatedQuests.length ? (
        <section className="quest-preview-section">
          <div className="row">
            <strong>Связанные квесты</strong>
            <small>{relatedQuests.length}</small>
          </div>
          <div className="quest-preview-list">
            {relatedQuests.slice(0, 3).map((item) => (
              <button key={`${quest.id}-related-preview-${item.id}`} className="quest-preview-list-item quest-tone-warning" onClick={() => onOpenQuest(item.id)} type="button">
                <span className="quest-preview-list-copy">
                  <strong>{item.title}</strong>
                  <small>{item.summary}</small>
                </span>
              </button>
            ))}
          </div>
        </section>
      ) : null}

      {quest.tags.length ? (
        <section className="quest-preview-section">
          <strong>Метки</strong>
          <div className="quest-tag-list">
            {quest.tags.map((tag) => (
              <span key={`${quest.id}-tag-${tag}`} className="quest-tag">
                {tag}
              </span>
            ))}
          </div>
        </section>
      ) : null}

      <div className="quest-preview-footer">
        {quest.playlist?.length ? (
          <button className="ghost" onClick={() => onOpenPlaylist(quest)} type="button">
            Плейлист
          </button>
        ) : null}
        {quest.gallery?.length ? (
          <button className="ghost" onClick={() => onOpenGallery(quest)} type="button">
            Галерея
          </button>
        ) : null}
        <button className="primary" onClick={() => onOpenQuest(quest.id)} type="button">
          Открыть полностью
        </button>
      </div>
    </div>
  );
}

function PlayerFacingEntityModal({
  entity,
  onClose
}: {
  entity: QuestEntity | NpcEntity;
  onClose: () => void;
}) {
  const sections = useMemo(() => parseQuestTextSections(entity.playerContent), [entity.playerContent]);
  const fallbackLines = useMemo(() => splitQuestNarrative(entity.playerContent ?? "", 8), [entity.playerContent]);

  return (
    <div className="overlay" role="presentation">
      <div className="panel palette player-facing-modal" onClick={(event) => event.stopPropagation()} role="dialog">
        <div className="stack wide">
          <div className="row">
            <div>
              <p className="eyebrow">Player View</p>
              <h2>{entity.title}</h2>
              <p className="copy">{entity.subtitle}</p>
            </div>
            <button className="ghost" onClick={onClose} type="button">
              Закрыть
            </button>
          </div>

          <section className="card section-card player-facing-card">
            {sections.length ? (
              <div className="player-facing-sections">
                {sections.map((section, index) => {
                  const lines = collectQuestSectionLines(section, 12);
                  return (
                    <article key={`${entity.id}-player-section-${section.title}-${index}`} className="player-facing-section">
                      <strong>{section.title}</strong>
                      {lines.length > 1 ? (
                        <ul className="quest-bullet-list">
                          {lines.map((line) => (
                            <li key={`${entity.id}-player-line-${line}`}>{line}</li>
                          ))}
                        </ul>
                      ) : lines[0] ? (
                        <p>{lines[0]}</p>
                      ) : null}
                    </article>
                  );
                })}
              </div>
            ) : fallbackLines.length ? (
              <ul className="quest-bullet-list">
                {fallbackLines.map((line) => (
                  <li key={`${entity.id}-player-fallback-${line}`}>{line}</li>
                ))}
              </ul>
            ) : (
              <p className="copy">Отдельная версия для игроков пока не заполнена.</p>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

function EventsWorkspace({
  events,
  locations,
  searchQuery,
  selectedEventId,
  draftId,
  draft,
  saving,
  generating,
  notice,
  error,
  onSearchChange,
  onSelectEvent,
  onCreateEvent,
  onOpenGenerator,
  onSave,
  onDelete,
  onOpenLocation,
  onDraftChange,
  onBranchChange,
  onAddBranch,
  onRemoveBranch,
  onLootChange,
  onAddLoot,
  onRemoveLoot
}: {
  events: WorldEvent[];
  locations: LocationEntity[];
  searchQuery: string;
  selectedEventId: string;
  draftId: string;
  draft: WorldEventInput;
  saving: boolean;
  generating: boolean;
  notice: string;
  error: string;
  onSearchChange: (value: string) => void;
  onSelectEvent: (eventId: string) => void;
  onCreateEvent: () => void;
  onOpenGenerator: () => void;
  onSave: () => void;
  onDelete: () => void;
  onOpenLocation: (locationId: string) => void;
  onDraftChange: (updater: (current: WorldEventInput) => WorldEventInput) => void;
  onBranchChange: (index: number, updater: (current: WorldEventDialogueBranch) => WorldEventDialogueBranch) => void;
  onAddBranch: () => void;
  onRemoveBranch: (index: number) => void;
  onLootChange: (index: number, value: string) => void;
  onAddLoot: () => void;
  onRemoveLoot: (index: number) => void;
}) {
  const normalizedQuery = searchQuery.trim().toLowerCase();
  const filteredEvents = useMemo(
    () =>
      events.filter((event) =>
        !normalizedQuery
          ? true
          : [
              event.title,
              event.summary,
              event.sceneText,
              event.locationLabel ?? "",
              worldEventTypeLabels[event.type],
              event.loot.join(" "),
              event.tags.join(" ")
            ]
              .join(" ")
              .toLowerCase()
              .includes(normalizedQuery)
      ),
    [events, normalizedQuery]
  );
  const selectedLocation = draft.locationId ? locations.find((location) => location.id === draft.locationId) ?? null : null;
  const resolvedLoot = (draft.loot ?? []).filter((item) => item.trim());
  const isDraft = draftId === NEW_WORLD_EVENT_ID;

  return (
    <div className="notes-workspace events-workspace">
      <section className="card notes-workspace-head">
        <div className="notes-workspace-copy">
          <p className="eyebrow">События</p>
          <h1>Маленькие сценки для стола</h1>
          <p className="notes-workspace-copy">
            Здесь живут короткие смешные, тревожные или боевые эпизоды. Они не тянут на полноценный квест, зато
            отлично оживляют сессию и дают мгновенную сцену с репликами, лутом и быстрым выбором.
          </p>
        </div>
        <div className="actions">
          <button className="ghost" onClick={onCreateEvent} type="button">
            Новое событие
          </button>
          <button className="ghost" onClick={onOpenGenerator} type="button">
            Сгенерировать ИИ
          </button>
          <button className="primary" disabled={saving || generating} onClick={onSave} type="button">
            {saving ? "Сохраняю..." : "Сохранить"}
          </button>
        </div>
      </section>

      <div className="notes-workspace-grid events-workspace-grid">
        <aside className="card notes-directory-panel">
          <div className="row">
            <strong>Все события</strong>
            <small>{filteredEvents.length}</small>
          </div>

          <label className="field">
            <span>Поиск</span>
            <input
              className="input"
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder="Искать сценку, лут или тип..."
              value={searchQuery}
            />
          </label>

          <div className="notes-list">
            <button
              className={`notes-list-item ${isDraft ? "selected unsaved" : ""}`}
              onClick={onCreateEvent}
              type="button"
            >
              <span className="notes-list-item-copy">
                <strong>Новый черновик</strong>
                <small>Ручная сценка</small>
                <p>Пустой лист для короткого события без квестовой формы.</p>
              </span>
            </button>

            {filteredEvents.length ? (
              filteredEvents.map((event) => (
                <button
                  key={event.id}
                  className={`notes-list-item ${selectedEventId === event.id ? "selected" : ""}`}
                  onClick={() => onSelectEvent(event.id)}
                  type="button"
                >
                  <span className="notes-list-item-copy">
                    <div className="row">
                      <strong>{event.title}</strong>
                      <span className={badge(worldEventTypeTones[event.type])}>{worldEventTypeLabels[event.type]}</span>
                    </div>
                    <small>
                      {event.locationLabel ? `${event.locationLabel} • ` : ""}
                      {event.date || (event.origin === "ai" ? "AI" : "Ручное")}
                    </small>
                    <p>{worldEventExcerpt(event, 110)}</p>
                  </span>
                </button>
              ))
            ) : (
              <div className="notes-empty-state">
                <strong>Пока пусто</strong>
                <span>Создай сценку вручную или попроси ИИ подбросить что-то живое.</span>
              </div>
            )}
          </div>
        </aside>

        <section className="card notes-editor-panel events-editor-panel">
          <div className="notes-editor-head">
            <div className="stack tight">
              <div className="row">
                <strong>{draft.title.trim() || "Новое событие"}</strong>
                <span className={badge(worldEventTypeTones[draft.type])}>{worldEventTypeLabels[draft.type]}</span>
                <span className={badge(draft.origin === "ai" ? "accent" : "default")}>{draft.origin === "ai" ? "AI" : "Ручное"}</span>
              </div>
              <small className="copy">
                {selectedLocation ? `Привязано к локации ${selectedLocation.title}.` : "Можно оставить без привязки к локации."}
              </small>
            </div>
            {!isDraft ? (
              <button className="ghost danger-action" disabled={saving} onClick={onDelete} type="button">
                Удалить
              </button>
            ) : null}
          </div>

          {notice ? <div className="notes-status notes-status-success">{notice}</div> : null}
          {error ? <div className="notes-status notes-status-error">{error}</div> : null}

          <div className="form-grid">
            <label className="field">
              <span>Название</span>
              <input
                className="input notes-title-input"
                onChange={(event) => onDraftChange((current) => ({ ...current, title: event.target.value }))}
                placeholder="Например: Торговец-сквернослов"
                value={draft.title}
              />
            </label>

            <label className="field">
              <span>Дата в мире</span>
              <input
                className="input"
                onChange={(event) => onDraftChange((current) => ({ ...current, date: event.target.value }))}
                placeholder="17 Nightal, 1492 DR"
                value={draft.date ?? ""}
              />
            </label>

            <label className="field">
              <span>Локация</span>
              <select
                className="input"
                onChange={(event) =>
                  onDraftChange((current) => ({
                    ...current,
                    locationId: event.target.value,
                    locationLabel: locations.find((location) => location.id === event.target.value)?.title ?? ""
                  }))
                }
                value={draft.locationId ?? ""}
              >
                <option value="">Без привязки</option>
                {locations.map((location) => (
                  <option key={location.id} value={location.id}>
                    {location.title}
                  </option>
                ))}
              </select>
            </label>

            <label className="field">
              <span>Тип</span>
              <select
                className="input"
                onChange={(event) => onDraftChange((current) => ({ ...current, type: event.target.value as WorldEventType }))}
                value={draft.type}
              >
                {worldEventTypeOptions.map((type) => (
                  <option key={type} value={type}>
                    {worldEventTypeLabels[type]}
                  </option>
                ))}
              </select>
            </label>

            <label className="field field-full">
              <span>Коротко о сцене</span>
              <textarea
                className="input textarea"
                onChange={(event) => onDraftChange((current) => ({ ...current, summary: event.target.value }))}
                placeholder="Один короткий абзац: что это за сценка и почему партии не всё равно."
                value={draft.summary}
              />
            </label>
          </div>

          <section className="card mini event-editor-block">
            <div className="row">
              <strong>Что можно получить</strong>
              <small>{resolvedLoot.length}</small>
            </div>
            <div className="stack tight">
              {(draft.loot ?? []).map((item, index) => (
                <div key={`loot-${index}`} className="event-loot-row">
                  <input
                    className="input"
                    onChange={(event) => onLootChange(index, event.target.value)}
                    placeholder={index === 0 ? "15 зм" : "Кинжал, пропуск, 2 какашки бабуина"}
                    value={item}
                  />
                  <button className="ghost" onClick={() => onRemoveLoot(index)} type="button">
                    Убрать
                  </button>
                </div>
              ))}
            </div>
            <div className="actions">
              <button className="ghost" onClick={onAddLoot} type="button">
                Добавить лут
              </button>
            </div>
          </section>

          <label className="field notes-editor-field">
            <span>Текст сцены</span>
            <textarea
              className="input textarea notes-editor-textarea event-scene-textarea"
              onChange={(event) => onDraftChange((current) => ({ ...current, sceneText: event.target.value }))}
              placeholder="Что происходит прямо сейчас, кто начинает сцену, чем она цепляет игроков и куда может качнуться."
              value={draft.sceneText}
            />
          </label>

          <section className="stack event-branch-list">
            <div className="row">
              <strong>Ветки диалога</strong>
              <button className="ghost" onClick={onAddBranch} type="button">
                Добавить ветку
              </button>
            </div>

            {(draft.dialogueBranches ?? []).map((branch, index) => (
              <article key={`branch-${index}`} className="card mini event-branch-card">
                <div className="row">
                  <span className={badge("accent")}>Ветка {index + 1}</span>
                  <button className="ghost" onClick={() => onRemoveBranch(index)} type="button">
                    Убрать
                  </button>
                </div>

                <div className="form-grid">
                  <label className="field">
                    <span>Заголовок</span>
                    <input
                      className="input"
                      onChange={(event) => onBranchChange(index, (current) => ({ ...current, title: event.target.value }))}
                      placeholder="Если ответить шуткой"
                      value={branch.title}
                    />
                  </label>

                  <label className="field">
                    <span>Чем кончается</span>
                    <input
                      className="input"
                      onChange={(event) => onBranchChange(index, (current) => ({ ...current, outcome: event.target.value }))}
                      placeholder="Торговец смягчается и сдаёт слух"
                      value={branch.outcome ?? ""}
                    />
                  </label>

                  <label className="field field-full">
                    <span>Реплики и ходы</span>
                    <textarea
                      className="input textarea"
                      onChange={(event) =>
                        onBranchChange(index, (current) => ({
                          ...current,
                          lines: event.target.value.split("\n")
                        }))
                      }
                      placeholder="Каждая строка отдельной репликой или реакцией."
                      value={(branch.lines ?? []).join("\n")}
                    />
                  </label>
                </div>
              </article>
            ))}
          </section>

          {selectedLocation ? (
            <div className="actions">
              <button className="ghost" onClick={() => onOpenLocation(selectedLocation.id)} type="button">
                Открыть локацию
              </button>
            </div>
          ) : null}
        </section>
      </div>
    </div>
  );
}

function NotesWorkspace({
  notes,
  searchQuery,
  selectedNoteId,
  draftId,
  draftTitle,
  draftContent,
  saving,
  notice,
  error,
  onSearchChange,
  onSelectNote,
  onCreateNote,
  onSave,
  onOpenPreview,
  onTitleChange,
  onContentChange,
  onContentContextMenu,
  editorRef
}: {
  notes: LoreNoteEntity[];
  searchQuery: string;
  selectedNoteId: string;
  draftId: string;
  draftTitle: string;
  draftContent: string;
  saving: boolean;
  notice: string;
  error: string;
  onSearchChange: (value: string) => void;
  onSelectNote: (noteId: string) => void;
  onCreateNote: () => void;
  onSave: () => void;
  onOpenPreview: (noteId: string) => void;
  onTitleChange: (value: string) => void;
  onContentChange: (value: string) => void;
  onContentContextMenu: (event: ReactMouseEvent<HTMLTextAreaElement>) => void;
  editorRef: { current: HTMLTextAreaElement | null };
}) {
  const filteredNotes = useMemo(
    () => notes.filter((note) => matchesEntityDirectorySearch(note, searchQuery)),
    [notes, searchQuery]
  );
  const editingNewNote = draftId === NEW_LORE_NOTE_ID;
  const selectedNote = notes.find((note) => note.id === selectedNoteId) ?? null;
  const editorTitle = resolveLoreNoteTitle(draftTitle, draftContent);
  const canSave = Boolean(draftTitle.trim() || draftContent.trim());

  return (
    <div className="notes-workspace">
      <section className="card notes-workspace-head">
        <div className="notes-workspace-copy">
          <div className="quest-breadcrumbs">
            <span className="quest-breadcrumb-btn">Главная</span>
            <span>/</span>
            <strong>Заметки</strong>
          </div>
          <h1>Заметки мастера</h1>
          <p className="copy">
            Только рабочий текст и быстрые записи. Здесь новая заметка создаётся без общей формы сущности и без лишних полей.
          </p>
        </div>

        <div className="actions">
          <button className="ghost" onClick={onCreateNote} type="button">
            Новая заметка
          </button>
          <button className="primary" disabled={saving || !canSave} onClick={onSave} type="button">
            {saving ? "Сохраняю..." : "Сохранить"}
          </button>
        </div>
      </section>

      <div className="notes-workspace-grid">
        <aside className="card notes-directory-panel">
          <div className="row muted">
            <strong>Все заметки</strong>
            <span className={badge("accent")}>{filteredNotes.length}</span>
          </div>

          <label className="field field-full">
            <span>Поиск заметки</span>
            <input
              className="input"
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder="Поиск заметок..."
              value={searchQuery}
            />
          </label>

          <div className="notes-list">
            {editingNewNote ? (
              <button aria-pressed className="notes-list-item selected unsaved" onClick={onCreateNote} type="button">
                <span className="notes-list-item-copy">
                  <strong>{editorTitle}</strong>
                  <small>Черновик</small>
                  <p>{draftContent.trim() ? truncateInlineText(draftContent.replace(/\s+/g, " ").trim(), 90) : "Новая пустая заметка."}</p>
                </span>
              </button>
            ) : null}

            {filteredNotes.length ? (
              filteredNotes.map((note) => (
                <button
                  key={note.id}
                  aria-pressed={!editingNewNote && selectedNoteId === note.id}
                  className={`notes-list-item ${!editingNewNote && selectedNoteId === note.id ? "selected" : ""}`}
                  onClick={() => onSelectNote(note.id)}
                  type="button"
                >
                  <span className="notes-list-item-copy">
                    <strong>{note.title}</strong>
                    <small>{note.visibility === "gm_only" ? "GM only" : "Player safe"}</small>
                    <p>{loreNoteExcerpt(note, 90)}</p>
                  </span>
                </button>
              ))
            ) : (
              <div className="notes-empty-state">
                <strong>Ничего не найдено</strong>
                <p className="copy">Либо заметок пока нет, либо текущий поиск ничего не дал.</p>
              </div>
            )}
          </div>
        </aside>

        <section className="card notes-editor-panel">
          <div className="notes-editor-head">
            <div className="stack compact">
              <p className="eyebrow">Editor</p>
              <strong>{editorTitle}</strong>
              <p className="copy">
                {draftContent.trim()
                  ? truncateInlineText(draftContent.replace(/\s+/g, " ").trim(), 180)
                  : "Здесь можно вести сценовые заметки, планы сессии, скрытые мотивы, подсказки или просто быстрые GM-записи."}
              </p>
            </div>
            {selectedNote && !editingNewNote ? (
              <button className="ghost" onClick={() => onOpenPreview(selectedNote.id)} type="button">
                Открыть в preview
              </button>
            ) : null}
          </div>

          {notice ? (
            <div className="notes-status notes-status-success" role="status">
              {notice}
            </div>
          ) : null}
          {error ? (
            <div className="notes-status notes-status-error" role="status">
              {error}
            </div>
          ) : null}

          <label className="field field-full">
            <span>Название</span>
            <input
              className="input notes-title-input"
              onChange={(event) => onTitleChange(event.target.value)}
              placeholder="Например: Засада у тракта"
              value={draftTitle}
            />
          </label>

          <label className="field field-full notes-editor-field">
            <span>Текст заметки</span>
            <textarea
              className="input textarea notes-editor-textarea"
              onContextMenu={onContentContextMenu}
              onChange={(event) => onContentChange(event.target.value)}
              placeholder="Пиши заметку как есть: ход сцены, реплики, скрытые мотивы, проверку, последствия, слух или рабочий план на сессию."
              ref={editorRef}
              value={draftContent}
            />
          </label>
        </section>
      </div>
    </div>
  );
}

const combatDifficultyTone = (difficulty?: string): QuickFactTone => {
  switch (difficulty) {
    case "deadly":
      return "danger";
    case "hard":
      return "warning";
    case "medium":
      return "accent";
    case "easy":
      return "success";
    default:
      return "default";
  }
};

const combatEntryHealthPercent = (entry: CombatEntry) =>
  entry.maxHitPoints > 0 ? clamp((entry.currentHitPoints / entry.maxHitPoints) * 100, 0, 100) : 0;

const isCombatEntryOut = (entry: CombatEntry) => entry.defeated || entry.currentHitPoints <= 0;

const combatEntrySelectionKey = (entry: CombatEntry, index: number) => `${entry.id}:${entry.entityId}:${index}`;

const combatEntryInitiative = (entry: CombatEntry) => (Number.isFinite(entry.initiative) ? entry.initiative : 0);

const sortCombatEntriesByInitiative = (entries: CombatEntry[]) =>
  [...entries].sort((left, right) => {
    const initiativeDelta = combatEntryInitiative(right) - combatEntryInitiative(left);
    if (initiativeDelta !== 0) {
      return initiativeDelta;
    }
    if (left.side !== right.side) {
      return left.side === "player" ? -1 : 1;
    }
    return left.title.localeCompare(right.title, "ru");
  });

type CombatFocusTab = "overview" | "stats" | "abilities" | "combat" | "rewards";
type CombatRosterFilter = "all" | "players" | "enemies";

const combatFocusTabs: Array<{ id: CombatFocusTab; label: string }> = [
  { id: "overview", label: "Главное" },
  { id: "stats", label: "Характеристики" },
  { id: "abilities", label: "Способности" },
  { id: "combat", label: "Бой" },
  { id: "rewards", label: "Награды" }
];

const combatRosterFilters: Array<{ id: CombatRosterFilter; label: string }> = [
  { id: "all", label: "Все" },
  { id: "players", label: "Игроки" },
  { id: "enemies", label: "Враги" }
];

const combatEntryConditionLabel = (entry: CombatEntry) => {
  if (isCombatEntryOut(entry)) {
    return "Выведен";
  }
  if (entry.maxHitPoints <= 0) {
    return "Стабилен";
  }

  const ratio = entry.currentHitPoints / Math.max(entry.maxHitPoints, 1);
  if (ratio <= 0.1) {
    return "На грани";
  }
  if (ratio < 0.5) {
    return "Окровавлен";
  }
  return "Стабилен";
};

const combatEntryConditionTone = (entry: CombatEntry): QuickFactTone => {
  if (isCombatEntryOut(entry)) {
    return "danger";
  }
  if (entry.maxHitPoints <= 0) {
    return "default";
  }

  const ratio = entry.currentHitPoints / Math.max(entry.maxHitPoints, 1);
  if (ratio <= 0.1) {
    return "danger";
  }
  if (ratio < 0.5) {
    return "warning";
  }
  return "success";
};

const combatVictoryLoserLabel = (entry: CombatEntry) => {
  if (entry.challenge) {
    return `CR ${entry.challenge}`;
  }
  if (entry.role) {
    return entry.role;
  }
  return "Противник";
};

const combatEntryRoleLabel = (entry: CombatEntry) =>
  entry.side === "player" ? "Игрок" : entry.challenge || entry.role || "Противник";

const parseCombatStatRows = (value?: string) =>
  (value ?? "")
    .split(/[;,]\s*/u)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const match = part.match(/^(.+?)\s*([+-]\d+(?:\s*\([^)]*\))?)$/u);
      if (match) {
        return {
          label: match[1].trim(),
          value: match[2].trim()
        };
      }
      return {
        label: part,
        value: "—"
      };
    });

const parseAppRoute = (hash: string): AppRouteState => {
  const normalized = hash.replace(/^#/, "").trim();
  if (normalized.toLowerCase().startsWith("initiative/")) {
    const campaignId = decodeURIComponent(normalized.slice("initiative/".length)).trim();
    if (campaignId) {
      return {
        mode: "initiative",
        campaignId
      };
    }
  }
  return { mode: "app" };
};

const buildInitiativeHash = (campaignId: string) => `#initiative/${encodeURIComponent(campaignId)}`;

function CombatFactListCard({
  title,
  rows,
  emptyLabel = "Нет данных"
}: {
  title: string;
  rows: Array<{ label: string; value: string }>;
  emptyLabel?: string;
}) {
  return (
    <section className="card mini combat-focus-list-card">
      <div className="stack compact">
        <small>{title}</small>
        {rows.length ? (
          rows.map((row) => (
            <div key={`${title}-${row.label}-${row.value}`} className="combat-focus-list-row">
              <span>{row.label}</span>
              <strong>{row.value}</strong>
            </div>
          ))
        ) : (
          <p className="copy">{emptyLabel}</p>
        )}
      </div>
    </section>
  );
}

function CombatEntryCard({
  entry,
  linkedEntity,
  currentTurnEntryId,
  busy,
  onChangeHitPoints,
  onChangeInitiative,
  onSetCurrentTurn,
  onNextTurn
}: {
  entry: CombatEntry;
  linkedEntity: KnowledgeEntity | null;
  currentTurnEntryId?: string;
  busy: boolean;
  onChangeHitPoints: (entry: CombatEntry, nextHp: number) => void;
  onChangeInitiative: (entry: CombatEntry, nextInitiative: number) => void;
  onSetCurrentTurn: (entryId: string) => void;
  onNextTurn: () => void;
}) {
  const kindLabel = entry.entityKind === "monster" ? "Монстр" : entry.entityKind === "player" ? "Игрок" : "НПС";
  const tone: QuickFactTone = entry.entityKind === "monster" ? "danger" : entry.entityKind === "player" ? "success" : "accent";
  const [activeTab, setActiveTab] = useState<CombatFocusTab>("overview");
  const [initiativeDraft, setInitiativeDraft] = useState(() => String(combatEntryInitiative(entry)));
  const [hitPointsDraft, setHitPointsDraft] = useState(() => String(entry.currentHitPoints));
  const parsedHitPointsDraft = Number.parseInt(hitPointsDraft, 10);
  const effectiveDraftHitPoints = Number.isFinite(parsedHitPointsDraft)
    ? clamp(parsedHitPointsDraft, 0, Math.max(entry.maxHitPoints, 0))
    : entry.currentHitPoints;
  const isCurrentTurn = currentTurnEntryId === entry.id;
  const portraitSource = linkedEntity
    ? createPortraitSource(linkedEntity)
    : createPortraitSource({
        kind: entry.entityKind === "monster" ? "monster" : entry.entityKind === "player" ? "player" : "npc",
        title: entry.title
      });
  const savingThrowRows = parseCombatStatRows(entry.statBlock?.savingThrows);
  const skillRows = parseCombatStatRows(entry.statBlock?.skills);
  const detailRows = [
    { label: "Размер", value: entry.statBlock?.size || "—" },
    { label: "Тип", value: entry.statBlock?.creatureType || kindLabel },
    { label: "Мировоззрение", value: entry.statBlock?.alignment || "—" },
    { label: "Скорость", value: entry.statBlock?.speed || "—" },
    { label: "Чувства", value: entry.statBlock?.senses || "—" },
    { label: "Языки", value: entry.statBlock?.languages || "—" },
    { label: "Сопротивления", value: entry.statBlock?.resistances || "—" },
    { label: "Иммунитеты", value: entry.statBlock?.immunities || "—" }
  ].filter((row) => row.value && row.value !== "—");
  const quickFactsRows = (linkedEntity?.quickFacts ?? []).map((fact) => ({
    label: fact.label,
    value: fact.value
  }));
  const visibleTraits = entry.statBlock?.traits ?? [];
  const visibleActions = entry.statBlock?.actions ?? [];
  const visibleBonusActions = entry.statBlock?.bonusActions ?? [];
  const visibleReactions = entry.statBlock?.reactions ?? [];

  useEffect(() => {
    setInitiativeDraft(String(combatEntryInitiative(entry)));
  }, [entry.id, entry.initiative]);

  useEffect(() => {
    setHitPointsDraft(String(entry.currentHitPoints));
  }, [entry.id, entry.currentHitPoints]);

  useEffect(() => {
    setActiveTab("overview");
  }, [entry.id]);

  const commitInitiativeDraft = () => {
    const nextValue = Number.parseInt(initiativeDraft, 10);
    onChangeInitiative(entry, Number.isFinite(nextValue) ? nextValue : 0);
  };

  const commitHitPointsDraft = () => {
    onChangeHitPoints(entry, effectiveDraftHitPoints);
  };

  const applyHitPointsDelta = (nextValue: number) => {
    const clampedValue = clamp(nextValue, 0, Math.max(entry.maxHitPoints, 0));
    setHitPointsDraft(String(clampedValue));
    onChangeHitPoints(entry, clampedValue);
  };

  const renderStatEntries = (entries: StatBlockEntry[], emptyLabel: string) =>
    entries.length ? (
      <div className="entry-list compact-entry-list combat-focus-entry-grid">
        {entries.map((action) => (
          <article key={action.name} className="entry-card combat-focus-entry-card">
            <div className="entry-header">
              <h3>{action.name}</h3>
              <div className="entry-meta">
                {action.toHit ? <span className="entry-chip">{action.toHit}</span> : null}
                {action.damage ? <span className="entry-chip">{action.damage}</span> : null}
                {action.saveDc ? <span className="entry-chip">{action.saveDc}</span> : null}
              </div>
            </div>
            {action.subtitle ? <small>{action.subtitle}</small> : null}
            <p className="copy">{action.description}</p>
          </article>
        ))}
      </div>
    ) : (
      <p className="copy">{emptyLabel}</p>
    );

  return (
    <article className={`card combat-focus-card ${entry.defeated ? "defeated" : ""}`}>
      <header className="combat-focus-hero">
        <div className="combat-focus-portrait-shell">
          <img alt={linkedEntity?.art?.alt ?? entry.title} className="combat-focus-portrait" loading="lazy" src={portraitSource} />
        </div>

        <div className="combat-focus-hero-copy">
          <div className="row combat-focus-topline">
            <div className="actions">
              <span className={badge(entry.defeated ? "danger" : tone)}>{kindLabel}</span>
              {entry.challenge ? <span className={badge()}>{entry.challenge}</span> : null}
              {entry.experience > 0 ? <span className={badge("accent")}>{entry.experience} XP</span> : null}
              <span className={badge(combatEntryConditionTone(entry))}>{combatEntryConditionLabel(entry)}</span>
            </div>
            {isCurrentTurn ? <span className={badge("accent")}>Текущий ход</span> : null}
          </div>

          <div className="stack compact">
            <h3>{entry.title}</h3>
            <p className="combat-focus-subtitle">
              {entry.role || combatEntryRoleLabel(entry)}
              {entry.statBlock?.challenge ? ` • ${entry.statBlock.challenge}` : ""}
            </p>
            <p className="copy">{entry.summary}</p>
          </div>

          <div className="combat-focus-hero-metrics">
            <span className="combat-focus-hero-pill">КД {entry.armorClass}</span>
            <span className="combat-focus-hero-pill">Инициатива +{combatEntryInitiative(entry)}</span>
            <span className="combat-focus-hero-pill">Скорость {entry.statBlock?.speed || "—"}</span>
            <span className="combat-focus-hero-pill">
              {entry.maxHitPoints > 0 ? `${entry.currentHitPoints}/${entry.maxHitPoints} HP` : "HP не отслеживается"}
            </span>
          </div>
        </div>

        <div className="combat-focus-hero-actions">
          <button className="ghost" disabled={busy || isCurrentTurn} onClick={() => onSetCurrentTurn(entry.id)} type="button">
            {isCurrentTurn ? "Ход активен" : "Сделать текущим"}
          </button>
          <button className="primary" disabled={busy} onClick={onNextTurn} type="button">
            {busy ? "Переключаю..." : "Следующий ход"}
          </button>
        </div>
      </header>

      <nav className="combat-focus-tabs" aria-label="Вкладки участника">
        {combatFocusTabs.map((tab) => (
          <button
            key={`${entry.id}-${tab.id}`}
            className={`combat-focus-tab ${activeTab === tab.id ? "active" : ""}`}
            onClick={() => setActiveTab(tab.id)}
            type="button"
          >
            {tab.label}
          </button>
        ))}
      </nav>

      {activeTab === "overview" ? (
        <div className="combat-focus-body">
          <div className="combat-focus-overview-grid">
            <section className="card mini combat-focus-health-card">
              <small>Здоровье</small>
              <strong>{entry.maxHitPoints > 0 ? `${entry.currentHitPoints} / ${entry.maxHitPoints}` : "Не отслеживается"}</strong>
              {entry.maxHitPoints > 0 ? (
                <>
                  <div className="combat-focus-health-bar">
                    <span style={{ width: `${combatEntryHealthPercent(entry)}%` }} />
                  </div>
                  <div className="combat-focus-health-adjust">
                    <button className="ghost" onClick={() => applyHitPointsDelta(Math.max(0, effectiveDraftHitPoints - 5))} type="button">
                      -5
                    </button>
                    <button className="ghost" onClick={() => applyHitPointsDelta(Math.max(0, effectiveDraftHitPoints - 1))} type="button">
                      -1
                    </button>
                    <button className="ghost" onClick={() => applyHitPointsDelta(Math.min(entry.maxHitPoints, effectiveDraftHitPoints + 1))} type="button">
                      +1
                    </button>
                    <button className="ghost" onClick={() => applyHitPointsDelta(Math.min(entry.maxHitPoints, effectiveDraftHitPoints + 5))} type="button">
                      +5
                    </button>
                    <button className="ghost" onClick={() => applyHitPointsDelta(entry.maxHitPoints)} type="button">
                      / Max
                    </button>
                  </div>
                  <div className="combat-focus-health-form">
                    <input
                      className="input combatant-health-input"
                      max={entry.maxHitPoints}
                      min={0}
                      onBlur={commitHitPointsDraft}
                      onChange={(event) => setHitPointsDraft(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          commitHitPointsDraft();
                        }
                      }}
                      type="number"
                      value={hitPointsDraft}
                    />
                    <button className="ghost" onClick={() => applyHitPointsDelta(0)} type="button">
                      Вывести
                    </button>
                    <button className="primary" onClick={commitHitPointsDraft} type="button">
                      Сохранить
                    </button>
                  </div>
                </>
              ) : (
                <p className="copy">Для этого участника ХП не заведены.</p>
              )}
            </section>

            <section className="card mini combat-focus-kpi-card">
              <small>Класс брони</small>
              <strong>{entry.armorClass}</strong>
              <span>{entry.statBlock?.armorClass ? `Базовый КД: ${entry.statBlock.armorClass}` : "Из карточки боя"}</span>
              <div className="combat-focus-inline-metrics">
                <span>Init {combatEntryInitiative(entry)}</span>
                <span>{entry.statBlock?.proficiencyBonus ? `ПМ ${entry.statBlock.proficiencyBonus}` : "Без ПМ"}</span>
              </div>
            </section>

            <CombatFactListCard emptyLabel="Спасброски не заполнены" rows={savingThrowRows} title="Спасброски" />
            <CombatFactListCard emptyLabel="Навыки не заполнены" rows={skillRows} title="Навыки" />
          </div>

          <section className="card mini combat-focus-section">
            <div className="row muted">
              <span>Атаки</span>
              <span>{visibleActions.length ? `${visibleActions.length} записей` : "Пока пусто"}</span>
            </div>
            {renderStatEntries(visibleActions.slice(0, 4), "Атаки ещё не заполнены.")}
          </section>

          <section className="card mini combat-focus-section">
            <div className="row muted">
              <span>Особенности</span>
              <span>{visibleTraits.length ? `${visibleTraits.length} записей` : "Пока пусто"}</span>
            </div>
            {renderStatEntries(visibleTraits.slice(0, 4), "Особенности ещё не заполнены.")}
          </section>
        </div>
      ) : null}

      {activeTab === "stats" ? (
        <div className="combat-focus-body">
          {entry.statBlock ? (
            <div className="combatant-ability-grid">
              {abilityLabels.map(({ key, label }) => {
                const score = entry.statBlock?.abilityScores[key] ?? 10;

                return (
                  <article key={key} className="card ability-card">
                    <small>{label}</small>
                    <strong>{score}</strong>
                    <span>{formatModifier(score)}</span>
                  </article>
                );
              })}
            </div>
          ) : null}

          <div className="combat-focus-overview-grid">
            <CombatFactListCard emptyLabel="Профиль не заполнен" rows={detailRows} title="Профиль" />
            <CombatFactListCard emptyLabel="Быстрые факты не заполнены" rows={quickFactsRows} title="Быстрые факты" />
          </div>
        </div>
      ) : null}

      {activeTab === "abilities" ? (
        <div className="combat-focus-body">
          <section className="card mini combat-focus-section">
            <div className="row muted">
              <span>Способности</span>
              <span>{visibleTraits.length} записей</span>
            </div>
            {renderStatEntries(visibleTraits, "Способности ещё не заполнены.")}
          </section>

          {entry.statBlock?.spellcasting ? (
            <section className="card mini combat-focus-section">
              <div className="row muted">
                <span>{entry.statBlock.spellcasting.title}</span>
                <span>{entry.statBlock.spellcasting.spells.length} заклинаний</span>
              </div>
              <div className="combat-focus-overview-grid">
                <CombatFactListCard
                  rows={[
                    { label: "Базовая характеристика", value: entry.statBlock.spellcasting.ability },
                    { label: "СЛ", value: entry.statBlock.spellcasting.saveDc },
                    { label: "Атака", value: entry.statBlock.spellcasting.attackBonus }
                  ]}
                  title="Магия"
                />
                <section className="card mini combat-focus-list-card">
                  <div className="stack compact">
                    <small>Заклинания</small>
                    <div className="entry-meta combat-focus-spell-list">
                      {entry.statBlock.spellcasting.spells.map((spell) => (
                        <span key={`${entry.id}-${spell}`} className="entry-chip">
                          {spell}
                        </span>
                      ))}
                    </div>
                    {entry.statBlock.spellcasting.description ? <p className="copy">{entry.statBlock.spellcasting.description}</p> : null}
                  </div>
                </section>
              </div>
            </section>
          ) : null}
        </div>
      ) : null}

      {activeTab === "combat" ? (
        <div className="combat-focus-body">
          <section className="card mini combat-focus-section">
            <div className="row muted">
              <span>Действия и атаки</span>
              <span>{visibleActions.length} записей</span>
            </div>
            {renderStatEntries(visibleActions, "Боевые действия ещё не заполнены.")}
          </section>

          {visibleBonusActions.length ? (
            <section className="card mini combat-focus-section">
              <div className="row muted">
                <span>Бонусные действия</span>
                <span>{visibleBonusActions.length} записей</span>
              </div>
              {renderStatEntries(visibleBonusActions, "Бонусные действия ещё не заполнены.")}
            </section>
          ) : null}

          {visibleReactions.length ? (
            <section className="card mini combat-focus-section">
              <div className="row muted">
                <span>Реакции</span>
                <span>{visibleReactions.length} записей</span>
              </div>
              {renderStatEntries(visibleReactions, "Реакции ещё не заполнены.")}
            </section>
          ) : null}

          <section className="card mini combatant-init-editor">
            <div className="row muted">
              <span>Инициатива участника</span>
              <span>Изменение сразу влияет на боевой порядок</span>
            </div>
            <div className="combatant-inline-controls">
              <label className="field combat-inline-field">
                <span>Инициатива</span>
                <input
                  className="input combatant-init-input"
                  onBlur={commitInitiativeDraft}
                  onChange={(event) => setInitiativeDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      commitInitiativeDraft();
                    }
                  }}
                  type="number"
                  value={initiativeDraft}
                />
              </label>
              <button className="ghost" onClick={commitInitiativeDraft} type="button">
                Сохранить
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {activeTab === "rewards" ? (
        <div className="combat-focus-body">
          {isRewardableEntity(linkedEntity) ? (
            <RewardSection kind={linkedEntity.kind} rewardProfile={linkedEntity.rewardProfile} />
          ) : (
            <section className="card mini combat-focus-section">
              <div className="row muted">
                <span>Награды</span>
                <span>Пока пусто</span>
              </div>
              <p className="copy">Для этой цели награды ещё не заданы. Можно добавить их в карточке сущности.</p>
            </section>
          )}
        </div>
      ) : null}
    </article>
  );
}

function CombatEntryTile({
  entry,
  linkedEntity,
  selected,
  currentTurn,
  onSelect
}: {
  entry: CombatEntry;
  linkedEntity: KnowledgeEntity | null;
  selected: boolean;
  currentTurn: boolean;
  onSelect: () => void;
}) {
  const portraitSource = linkedEntity
    ? createPortraitSource(linkedEntity)
    : createPortraitSource({
        kind: entry.entityKind === "monster" ? "monster" : entry.entityKind === "player" ? "player" : "npc",
        title: entry.title
      });

  return (
    <button
      aria-pressed={selected}
      className={`combat-roster-tile ${selected ? "selected" : ""} ${currentTurn ? "current" : ""} ${entry.defeated ? "defeated" : ""}`}
      onClick={onSelect}
      type="button"
    >
      <span className={`combat-roster-initiative ${entry.side === "player" ? "player" : "enemy"}`}>{combatEntryInitiative(entry)}</span>
      <div className="combat-roster-portrait-shell">
        <img alt={linkedEntity?.art?.alt ?? entry.title} className="combat-roster-portrait" loading="lazy" src={portraitSource} />
      </div>
      <div className="combat-roster-copy">
        <div className="combat-roster-topline">
          <strong title={entry.title}>{entry.title}</strong>
          {currentTurn ? <span className={`${badge("accent")} combat-roster-turn-badge`}>Ход</span> : null}
        </div>
        <small className="combat-roster-secondary">
          <span>{combatEntryRoleLabel(entry)}</span>
          <span>КД {entry.armorClass}</span>
        </small>
        <small>{entry.maxHitPoints > 0 ? `${entry.currentHitPoints}/${entry.maxHitPoints} HP` : "HP не отслеживается"}</small>
        {entry.maxHitPoints > 0 ? (
          <div className="combat-roster-health-bar">
            <span style={{ width: `${combatEntryHealthPercent(entry)}%` }} />
          </div>
        ) : null}
      </div>
    </button>
  );
}

function InitiativeRibbon({
  entries,
  selectedEntryId,
  onSelect
}: {
  entries: CombatEntry[];
  selectedEntryId?: string;
  onSelect?: (entryId: string) => void;
}) {
  const ordered = sortCombatEntriesByInitiative(entries);

  return (
    <div className="initiative-ribbon">
      {ordered.map((entry) => {
        const active = entry.id === selectedEntryId;
        const initiativeValue = combatEntryInitiative(entry);
        return (
          <button
            key={`initiative-${entry.id}`}
            className={`initiative-chip ${active ? "active" : ""} ${entry.defeated ? "defeated" : ""}`}
            onClick={() => onSelect?.(entry.id)}
            type="button"
          >
            <span className={`initiative-chip-badge ${entry.side === "player" ? "player" : "enemy"}`}>{initiativeValue}</span>
            <span className="initiative-chip-copy">
              <strong>{entry.title}</strong>
              <small>{entry.side === "player" ? "Игрок" : entry.challenge || entry.role || "Враг"}</small>
            </span>
          </button>
        );
      })}
    </div>
  );
}

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
    ? Math.round(activeCombat.actualBaseXp / Math.max(activeCombat.partySize, 1))
    : activeCombat.actualBaseXp;
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
    activeCombat.difficulty ? `Сложность: ${combatDifficultyLabel[activeCombat.difficulty]} • ${activeCombat.actualAdjustedXp} adjusted XP.` : "",
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
              Случайное событие
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
                <strong>{activeCombat.difficulty ? `${combatDifficultyLabel[activeCombat.difficulty]} (${activeCombat.actualAdjustedXp} XP)` : `${activeCombat.actualAdjustedXp} XP`}</strong>
              </div>
              <div className="combat-side-detail-row">
                <span>Опыт за победу</span>
                <strong>{actualExperiencePerPlayer} XP / игрока</strong>
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

function InitiativeTrackerScreen({
  activeCombat,
  lastCombatSummary,
  entityMap,
  busy,
  error,
  onNextTurn,
  onSelectTurn
}: {
  activeCombat: ActiveCombat | null;
  lastCombatSummary: LastCombatSummary | null;
  entityMap: Map<string, KnowledgeEntity>;
  busy: boolean;
  error: string;
  onNextTurn: () => void;
  onSelectTurn: (entryId: string) => void;
}) {
  const orderedEntries = activeCombat ? sortCombatEntriesByInitiative(activeCombat.entries) : [];
  const enemyEntries = activeCombat?.entries.filter((entry) => entry.side === "enemy") ?? [];
  const showActiveCombatVictory = Boolean(activeCombat && enemyEntries.length && enemyEntries.every((entry) => isCombatEntryOut(entry)));
  const activeVictoryPlayerEntries = orderedEntries.filter((entry) => entry.side === "player");
  const victoryEntries = showActiveCombatVictory
    ? orderedEntries
    : lastCombatSummary?.entries
      ? sortCombatEntriesByInitiative(lastCombatSummary.entries)
      : [];
  const victoryTotalExperience = showActiveCombatVictory
    ? enemyEntries.reduce((sum, entry) => sum + (isCombatEntryOut(entry) ? entry.experience : 0), 0)
    : lastCombatSummary?.totalExperience ?? 0;
  const activeVictoryExperiencePerPlayer = activeVictoryPlayerEntries.length
    ? Math.round(victoryTotalExperience / activeVictoryPlayerEntries.length)
    : 0;
  const victoryPlayerRewards = showActiveCombatVictory
    ? activeVictoryPlayerEntries.map((entry) => ({
          title: entry.title,
          experience: activeVictoryExperiencePerPlayer
        }))
    : lastCombatSummary?.playerRewards ?? [];
  const victoryRound = showActiveCombatVictory ? Math.max(1, activeCombat?.round || 1) : Math.max(1, lastCombatSummary?.round || 1);
  const victoryPerPlayerExperience = showActiveCombatVictory
    ? activeVictoryExperiencePerPlayer
    : lastCombatSummary?.experiencePerPlayer ?? victoryPlayerRewards[0]?.experience ?? 0;
  const victoryRewardByTitle = new Map(victoryPlayerRewards.map((reward) => [reward.title, reward.experience]));
  const victoryWinnerEntries = victoryEntries.filter((entry) => entry.side === "player");
  const victoryLoserEntries = victoryEntries.filter((entry) => entry.side === "enemy");
  const trackViewportRef = useRef<HTMLDivElement | null>(null);
  const cardRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const currentTurnEntry =
    (activeCombat?.currentTurnEntryId ? orderedEntries.find((entry) => entry.id === activeCombat.currentTurnEntryId) ?? null : null) ??
    orderedEntries[0] ??
    null;

  useEffect(() => {
    if (!currentTurnEntry?.id) {
      return;
    }

    const viewport = trackViewportRef.current;
    const card = cardRefs.current[currentTurnEntry.id];
    if (!viewport || !card) {
      return;
    }

    const viewportRect = viewport.getBoundingClientRect();
    const cardRect = card.getBoundingClientRect();
    const nextLeft =
      viewport.scrollLeft +
      (cardRect.left - viewportRect.left) -
      Math.max(0, viewportRect.width / 2 - cardRect.width / 2);

    viewport.scrollTo({
      left: Math.max(0, nextLeft),
      behavior: "smooth"
    });
  }, [currentTurnEntry?.id, orderedEntries.length]);

  return (
    <div className="initiative-display-screen">
      {activeCombat && orderedEntries.length && !showActiveCombatVictory ? (
        <div className="initiative-display-shell">
          <div className="initiative-round-banner">
            <span className="initiative-ornament-line" />
            <h1>{`Раунд ${Math.max(1, activeCombat.round || 1)}`}</h1>
            <span className="initiative-ornament-line" />
          </div>

          <div className="initiative-display-viewport" ref={trackViewportRef}>
            <div className="initiative-display-track">
              {orderedEntries.map((entry, index) => {
                const linkedEntity = entityMap.get(entry.entityId) ?? null;
                const isCurrent = currentTurnEntry?.id === entry.id;
                const visualSource = linkedEntity
                  ? createPortraitSource(linkedEntity)
                  : createPortraitSource({
                      kind: entry.entityKind === "monster" ? "monster" : "npc",
                      title: entry.title
                    });

                return (
                  <button
                    key={`initiative-card-${entry.id}`}
                    className={`initiative-display-card ${isCurrent ? "current" : ""} ${entry.defeated ? "defeated" : ""}`}
                    onClick={() => onSelectTurn(entry.id)}
                    ref={(node) => {
                      cardRefs.current[entry.id] = node;
                    }}
                    type="button"
                  >
                    <span className="initiative-order-badge">{index + 1}</span>
                    <div className="initiative-card-frame">
                      {isCurrent ? <span aria-hidden="true" className="initiative-current-chevron" /> : null}
                      <div className="initiative-card-image-shell">
                        <img alt={entry.title} className="initiative-card-image" loading="lazy" src={visualSource} />
                      </div>
                      <div className="initiative-card-copy">
                        <strong>{entry.title}</strong>
                        <span>{combatEntryInitiative(entry)}</span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="initiative-progress-rail">
            <span className="initiative-progress-line" />
            {orderedEntries.map((entry, index) => (
              <span
                key={`initiative-dot-${entry.id}`}
                className={`initiative-progress-dot ${currentTurnEntry?.id === entry.id ? "current" : ""} ${entry.defeated ? "defeated" : ""}`}
                style={{ animationDelay: `${index * 90}ms` }}
              />
            ))}
          </div>

          <div className="initiative-display-actions">
            <button className="initiative-next-turn" disabled={busy} onClick={onNextTurn} type="button">
              {busy ? "Переключаю..." : "Следующий ход"}
            </button>
          </div>

          {error ? <p className="initiative-display-error">{error}</p> : null}
        </div>
      ) : showActiveCombatVictory || lastCombatSummary ? (
        <div className="initiative-display-shell">
          <div className="initiative-round-banner">
            <span className="initiative-ornament-line" />
            <h1>Победа</h1>
            <span className="initiative-ornament-line" />
          </div>

          <div className="initiative-victory-display">
            <p className="initiative-victory-kicker">{showActiveCombatVictory ? activeCombat?.title || "Активный бой" : lastCombatSummary?.title || "Последний бой"}</p>
            <h2>Победа</h2>
            <p className="initiative-victory-copy">{`Раунд ${victoryRound}. Бой завершён, и игроки забирают награду.`}</p>

            {victoryWinnerEntries.length ? (
              <section className="initiative-victory-section">
                <p className="initiative-victory-section-label">Победители</p>
                <div className="initiative-victory-grid">
                  {victoryWinnerEntries.map((entry) => {
                    const linkedEntity = entityMap.get(entry.entityId) ?? null;
                    const visualSource = linkedEntity
                      ? createPortraitSource(linkedEntity)
                      : createPortraitSource({
                          kind: entry.entityKind === "monster" ? "monster" : entry.entityKind === "player" ? "player" : "npc",
                          title: entry.title
                        });
                    const rewardExperience = victoryRewardByTitle.get(entry.title) ?? victoryPerPlayerExperience;

                    return (
                      <article key={`victory-winner-${entry.id}`} className="initiative-victory-panel initiative-victory-panel-winner">
                        <div className="initiative-victory-avatar-shell">
                          <img alt={entry.title} className="initiative-victory-avatar" loading="lazy" src={visualSource} />
                        </div>
                        <strong className="initiative-victory-name">{entry.title}</strong>
                        <span className="initiative-victory-value">{`${rewardExperience} XP`}</span>
                      </article>
                    );
                  })}
                </div>
              </section>
            ) : null}

            <section className="initiative-victory-total">
              <small>Общий опыт</small>
              <strong>{`${victoryTotalExperience} XP`}</strong>
              <span>{`${victoryPerPlayerExperience} XP на игрока`}</span>
            </section>

            {victoryLoserEntries.length ? (
              <section className="initiative-victory-section initiative-victory-section-defeated">
                <p className="initiative-victory-section-label defeated">Проигравшие</p>
                <div className="initiative-victory-grid initiative-victory-grid-defeated">
                  {victoryLoserEntries.map((entry) => {
                    const linkedEntity = entityMap.get(entry.entityId) ?? null;
                    const visualSource = linkedEntity
                      ? createPortraitSource(linkedEntity)
                      : createPortraitSource({
                          kind: entry.entityKind === "monster" ? "monster" : entry.entityKind === "player" ? "player" : "npc",
                          title: entry.title
                        });

                    return (
                      <article key={`victory-loser-${entry.id}`} className="initiative-victory-panel initiative-victory-panel-loser">
                        <div className="initiative-victory-avatar-shell initiative-victory-avatar-shell-loser">
                          <img alt={entry.title} className="initiative-victory-avatar" loading="lazy" src={visualSource} />
                          <img
                            alt=""
                            aria-hidden="true"
                            className="initiative-victory-blood-overlay"
                            loading="lazy"
                            src={victoryBloodOverlayUrl}
                          />
                        </div>
                        <strong className="initiative-victory-name">{entry.title}</strong>
                        <span className="initiative-victory-loser-meta">{combatVictoryLoserLabel(entry)}</span>
                      </article>
                    );
                  })}
                </div>
              </section>
            ) : null}
          </div>

          {error ? <p className="initiative-display-error">{error}</p> : null}
        </div>
      ) : (
        <div className="initiative-empty-display">
          <h1>Инициатива ждёт бой</h1>
        </div>
      )}
    </div>
  );
}

function DndGenerationProgress({
  title,
  detail,
  steps
}: {
  title: string;
  detail: string;
  steps: string[];
}) {
  const normalizedSteps = steps.length ? steps : ["Идёт генерация"];
  const [elapsedMs, setElapsedMs] = useState(0);

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    const startedAt = Date.now();
    const tick = window.setInterval(() => {
      setElapsedMs(Date.now() - startedAt);
    }, 250);

    return () => {
      window.clearInterval(tick);
    };
  }, []);

  const completedStepIndex = Math.min(normalizedSteps.length - 1, Math.floor(elapsedMs / 2200));
  const runePulseIndex = Math.floor(elapsedMs / 900) % normalizedSteps.length;
  const elapsedLabel = formatPlaybackTime(elapsedMs / 1000);

  return (
    <section aria-live="polite" className="dnd-progress-panel">
      <div className="dnd-progress-head">
        <div className="stack compact">
          <p className="eyebrow">AI Generation</p>
          <strong>{title}</strong>
        </div>
        <span className="dnd-progress-time">{elapsedLabel}</span>
      </div>

      <p className="copy dnd-progress-copy">{detail}</p>

      <div aria-valuetext={`Идёт генерация: ${normalizedSteps[completedStepIndex]}`} className="dnd-progress-bar" role="progressbar">
        <span aria-hidden="true" className="dnd-progress-bar-fill" />
      </div>

      <div className="dnd-progress-steps">
        {normalizedSteps.map((step, index) => (
          <div
            key={`${title}-${step}`}
            className={`dnd-progress-step ${index <= completedStepIndex ? "active" : ""} ${index === runePulseIndex ? "pulse" : ""}`}
          >
            <span className="dnd-progress-step-rune">{index + 1}</span>
            <span>{step}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function LoginFieldGlyph({ kind }: { kind: "user" | "lock" | "eye" | "eye-off" | "spark" }) {
  const common = {
    fill: "none",
    stroke: "currentColor",
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    strokeWidth: 1.7
  };

  switch (kind) {
    case "user":
      return (
        <svg aria-hidden="true" className="login-glyph" viewBox="0 0 20 20">
          <circle {...common} cx="10" cy="6.7" r="2.7" />
          <path {...common} d="M4.8 15.2c1.1-2.4 2.9-3.6 5.2-3.6s4.1 1.2 5.2 3.6" />
        </svg>
      );
    case "lock":
      return (
        <svg aria-hidden="true" className="login-glyph" viewBox="0 0 20 20">
          <rect {...common} height="8.2" rx="2" width="10.2" x="4.9" y="8.1" />
          <path {...common} d="M6.8 8.1V6.7A3.2 3.2 0 0 1 10 3.5a3.2 3.2 0 0 1 3.2 3.2v1.4" />
        </svg>
      );
    case "eye":
      return (
        <svg aria-hidden="true" className="login-glyph" viewBox="0 0 20 20">
          <path {...common} d="M2.4 10s2.6-4.3 7.6-4.3 7.6 4.3 7.6 4.3-2.6 4.3-7.6 4.3S2.4 10 2.4 10Z" />
          <circle {...common} cx="10" cy="10" r="2.1" />
        </svg>
      );
    case "eye-off":
      return (
        <svg aria-hidden="true" className="login-glyph" viewBox="0 0 20 20">
          <path {...common} d="M2.8 2.8 17.2 17.2" />
          <path {...common} d="M7.8 6A8.6 8.6 0 0 1 10 5.7c5 0 7.6 4.3 7.6 4.3a14 14 0 0 1-2.9 3.1" />
          <path {...common} d="M5.3 7.2A13.4 13.4 0 0 0 2.4 10s2.6 4.3 7.6 4.3c.8 0 1.5-.1 2.2-.3" />
        </svg>
      );
    default:
      return (
        <svg aria-hidden="true" className="login-glyph" viewBox="0 0 20 20">
          <path {...common} d="m10 2.8 1.2 4 4 1.2-4 1.2-1.2 4-1.2-4-4-1.2 4-1.2 1.2-4Z" />
          <path {...common} d="m15 12.8.6 2 .2.6.6.2 2 .6-2 .6-.6.2-.2.6-.6 2-.6-2-.2-.6-.6-.2-2-.6 2-.6.6-.2.2-.6.6-2Z" />
        </svg>
      );
  }
}

function LoginScreen({
  username,
  password,
  onUsernameChange,
  onPasswordChange,
  onSubmit,
  busy,
  error
}: {
  username: string;
  password: string;
  onUsernameChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  busy: boolean;
  error: string;
}) {
  const [rememberMe, setRememberMe] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [ritualMode, setRitualMode] = useState(false);
  const loginFeatures: Array<{ title: string; detail: string; icon: RailIconName }> = [
    { title: "Квесты", detail: "Веди истории и кампании", icon: "quest" },
    { title: "Инициатива", detail: "Удобные боевые сцены", icon: "player" },
    { title: "Карты", detail: "Локации и регионы", icon: "location" },
    { title: "Заметки", detail: "Твои записи и идеи", icon: "note" }
  ];

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const storedUsername = window.localStorage.getItem("shadow_edge_login_username");
    if (storedUsername && !username.trim()) {
      onUsernameChange(storedUsername);
    }
  }, []);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    if (typeof window !== "undefined") {
      if (rememberMe && username.trim()) {
        window.localStorage.setItem("shadow_edge_login_username", username.trim());
      } else {
        window.localStorage.removeItem("shadow_edge_login_username");
      }
    }
    onSubmit(event);
  };

  return (
    <div className="login-screen">
      <div className={`login-scene ${ritualMode ? "ritual-mode" : ""}`} style={{ backgroundImage: `url(${loginBgUrl})` }}>
        <div className="login-scene-glow" aria-hidden="true" />
        <div className="login-frame">
          <header className="login-topbar">
            <div className="login-brand">
              <span className="login-brand-mark" aria-hidden="true">
                <RailIcon name="brand" />
              </span>
              <div className="login-brand-copy">
                <p className="eyebrow">Shadow Edge GM</p>
                <strong>Shadow Edge GM</strong>
              </div>
            </div>

            <button
              aria-label={ritualMode ? "Переключить на лунный тон" : "Переключить на ритуальный тон"}
              className="login-theme-toggle"
              onClick={() => setRitualMode((current) => !current)}
              type="button"
            >
              <span className={`login-theme-icon ${!ritualMode ? "active" : ""}`}>
                <LoginFieldGlyph kind="spark" />
              </span>
              <span className={`login-theme-icon ${ritualMode ? "active" : ""}`}>
                <LoginFieldGlyph kind="eye" />
              </span>
            </button>
          </header>

          <div className="login-shell">
            <section className="login-copy">
              <div className="login-copy-inner">
                <div className="login-kicker">
                  <span className="login-kicker-line" aria-hidden="true" />
                  <span className="eyebrow">Врата мастерской</span>
                  <span className="login-kicker-gem" aria-hidden="true">
                    <RailIcon name="brand" />
                  </span>
                  <span className="login-kicker-line" aria-hidden="true" />
                </div>

                <h1>
                  <span>Только</span>
                  <span>
                    для <em>мастера</em>
                  </span>
                </h1>
                <p className="copy">
                  Карты, квесты, заметки и боевые сцены теперь открываются только после входа.
                </p>
              </div>

              <div className="login-feature-grid">
                {loginFeatures.map((feature) => (
                  <article key={feature.title} className="login-feature-card">
                    <span className="login-feature-icon" aria-hidden="true">
                      <RailIcon name={feature.icon} />
                    </span>
                    <strong>{feature.title}</strong>
                    <small>{feature.detail}</small>
                  </article>
                ))}
              </div>

              <blockquote className="login-quote-card">
                <p>Мир ждёт твоей истории. Готов ли ты её написать?</p>
                <span className="login-quote-mark" aria-hidden="true">
                  <RailIcon name="brand" />
                </span>
              </blockquote>
            </section>

            <form className="panel login-card" onSubmit={handleSubmit}>
              <div className="login-card-ornament" aria-hidden="true">
                <span />
                <i />
                <span />
              </div>

              <h2>Войти в Shadow Edge</h2>
              <p className="copy">
                Один логин открывает кабинет мастера, а публичный трекер инициативы остаётся отдельной ссылкой для игроков.
              </p>

              <label className="field login-field">
                <span>Логин</span>
                <div className="login-input-shell">
                  <span className="login-input-icon" aria-hidden="true">
                    <LoginFieldGlyph kind="user" />
                  </span>
                  <input
                    autoComplete="username"
                    className="input login-input"
                    onChange={(event) => onUsernameChange(event.target.value)}
                    placeholder="vladyur4ik"
                    value={username}
                  />
                  {username ? (
                    <button className="login-input-action" onClick={() => onUsernameChange("")} type="button">
                      ×
                    </button>
                  ) : null}
                </div>
              </label>

              <label className="field login-field">
                <span>Пароль</span>
                <div className="login-input-shell">
                  <span className="login-input-icon" aria-hidden="true">
                    <LoginFieldGlyph kind="lock" />
                  </span>
                  <input
                    autoComplete="current-password"
                    className="input login-input"
                    onChange={(event) => onPasswordChange(event.target.value)}
                    placeholder="Введите пароль"
                    type={showPassword ? "text" : "password"}
                    value={password}
                  />
                  <button className="login-input-action" onClick={() => setShowPassword((current) => !current)} type="button">
                    <LoginFieldGlyph kind={showPassword ? "eye-off" : "eye"} />
                  </button>
                </div>
              </label>

              <div className="login-meta-row">
                <label className="login-remember">
                  <input checked={rememberMe} onChange={(event) => setRememberMe(event.target.checked)} type="checkbox" />
                  <span className="login-checkbox" aria-hidden="true" />
                  <span>Запомнить меня</span>
                </label>
                <button className="login-link" onClick={() => onPasswordChange("")} type="button">
                  Забыли пароль?
                </button>
              </div>

              {error ? <p className="login-error">{error}</p> : null}

              <button className="primary login-submit" disabled={busy} type="submit">
                <span>{busy ? "Открываю кабинет..." : "Войти в кабинет"}</span>
                <span aria-hidden="true">→</span>
              </button>

              <div className="login-divider" aria-hidden="true">
                <span />
                <small>или</small>
                <span />
              </div>

              <div className="login-public-note">
                <div className="ghost login-secondary login-secondary-static" role="note">
                  <span>Публичный трекер для игроков открывается из боя</span>
                  <span aria-hidden="true">↗</span>
                </div>
              </div>
            </form>
          </div>

          <footer className="login-footer">© 2026 Shadow Edge GM. Все права защищены.</footer>
        </div>
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
  const [loginUsername, setLoginUsername] = useState("vladyur4ik");
  const [loginPassword, setLoginPassword] = useState("");
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
  const [pinnedIds, setPinnedIds] = useState<string[]>([]);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [campaignModalOpen, setCampaignModalOpen] = useState(false);
  const [entityModalOpen, setEntityModalOpen] = useState(false);
  const [randomEventModalOpen, setRandomEventModalOpen] = useState(false);
  const [combatPlaylistModalOpen, setCombatPlaylistModalOpen] = useState(false);
  const [entityPlaylistModalOpen, setEntityPlaylistModalOpen] = useState(false);
  const [entityGalleryModalOpen, setEntityGalleryModalOpen] = useState(false);
  const [playerFacingEntityId, setPlayerFacingEntityId] = useState("");
  const [entityModalMode, setEntityModalMode] = useState<EntityModalMode>("create");
  const [editingEntityId, setEditingEntityId] = useState("");
  const [entityModalSourceNpcId, setEntityModalSourceNpcId] = useState("");
  const [generatedQuestIssuerDraft, setGeneratedQuestIssuerDraft] = useState<CreateEntityInput | null>(null);
  const [generatedQuestIssuerNote, setGeneratedQuestIssuerNote] = useState("");
  const [preparedCombatModalOpen, setPreparedCombatModalOpen] = useState(false);
  const [preparedCombatQuestId, setPreparedCombatQuestId] = useState("");
  const [preparedCombatDraft, setPreparedCombatDraft] = useState<PreparedCombatPlan>({ title: "", items: [] });
  const [preparedCombatNotice, setPreparedCombatNotice] = useState("");
  const [preparedCombatSearchQuery, setPreparedCombatSearchQuery] = useState("");
  const [preparedCombatChallenge, setPreparedCombatChallenge] = useState("");
  const [preparedCombatSelectionId, setPreparedCombatSelectionId] = useState("");
  const [preparedCombatQuantity, setPreparedCombatQuantity] = useState(1);
  const [preparedCombatBestiary, setPreparedCombatBestiary] = useState<BestiaryBrowseResult | null>(null);
  const [preparedCombatBestiaryLoading, setPreparedCombatBestiaryLoading] = useState(false);
  const [combatPlaylistDraft, setCombatPlaylistDraft] = useState<PlaylistTrack[]>([]);
  const [entityPlaylistEntityId, setEntityPlaylistEntityId] = useState("");
  const [entityPlaylistDraft, setEntityPlaylistDraft] = useState<PlaylistTrack[]>([]);
  const [entityGalleryEntityId, setEntityGalleryEntityId] = useState("");
  const [entityGalleryDraft, setEntityGalleryDraft] = useState<GalleryImage[]>([]);
  const [galleryViewer, setGalleryViewer] = useState<GalleryViewerState | null>(null);
  const [activePlayback, setActivePlayback] = useState<ActivePlaylistPlayback | null>(null);
  const [entityLinkSelection, setEntityLinkSelection] = useState<EntityLinkSelection | null>(null);
  const [entityLinkMenuOpen, setEntityLinkMenuOpen] = useState(false);
  const [entityLinkModalOpen, setEntityLinkModalOpen] = useState(false);
  const [entityLinkQuery, setEntityLinkQuery] = useState("");
  const [entityLinkTargetId, setEntityLinkTargetId] = useState("");
  const [noteEditorEntityId, setNoteEditorEntityId] = useState("");
  const [noteEditorTitle, setNoteEditorTitle] = useState("");
  const [noteEditorContent, setNoteEditorContent] = useState("");
  const [noteEditorDirty, setNoteEditorDirty] = useState(false);
  const [noteEditorNotice, setNoteEditorNotice] = useState("");
  const [eventEditorId, setEventEditorId] = useState("");
  const [eventEditorDraft, setEventEditorDraft] = useState<WorldEventInput>(emptyWorldEventInput);
  const [eventEditorDirty, setEventEditorDirty] = useState(false);
  const [eventEditorNotice, setEventEditorNotice] = useState("");
  const [campaignForm, setCampaignForm] = useState<CreateCampaignInput>(emptyCampaignForm);
  const [entityForm, setEntityForm] = useState<CreateEntityInput>(emptyEntityForm);
  const [draftPrompt, setDraftPrompt] = useState("");
  const [draftNotes, setDraftNotes] = useState<string[]>([]);
  const [randomEventLocationId, setRandomEventLocationId] = useState("");
  const [randomEventType, setRandomEventType] = useState<WorldEventType>("social");
  const [randomEventPrompt, setRandomEventPrompt] = useState("");
  const [randomEventNotes, setRandomEventNotes] = useState<string[]>([]);
  const [randomEventGenerating, setRandomEventGenerating] = useState(false);
  const [bootError, setBootError] = useState("");
  const [booting, setBooting] = useState(true);
  const [saving, setSaving] = useState(false);
  const [initiativeShareBusy, setInitiativeShareBusy] = useState(false);
  const [combatStateBusy, setCombatStateBusy] = useState(false);
  const [initiativePublishNotice, setInitiativePublishNotice] = useState("");
  const [generating, setGenerating] = useState(false);
  const [combatTitle, setCombatTitle] = useState("Активный бой");
  const [combatPartySize, setCombatPartySize] = useState(4);
  const [combatPartyLevelsText, setCombatPartyLevelsText] = useState("");
  const [combatThresholds, setCombatThresholds] = useState<CombatThresholds>(createDefaultCombatThresholds);
  const [combatSelectionId, setCombatSelectionId] = useState("");
  const [combatSelectionQuantity, setCombatSelectionQuantity] = useState(1);
  const [combatSelectionInitiative, setCombatSelectionInitiative] = useState(0);
  const [combatSearchQuery, setCombatSearchQuery] = useState("");
  const [combatSearchChallenge, setCombatSearchChallenge] = useState("");
  const [combatBestiary, setCombatBestiary] = useState<BestiaryBrowseResult | null>(null);
  const [combatBestiaryLoading, setCombatBestiaryLoading] = useState(false);
  const [combatSelectedBestiaryMonster, setCombatSelectedBestiaryMonster] = useState<BestiaryMonsterDetail | null>(null);
  const [combatPrompt, setCombatPrompt] = useState("");
  const [combatMonsterCount, setCombatMonsterCount] = useState(1);
  const [combatDifficulty, setCombatDifficulty] = useState<CombatDifficulty>("medium");
  const [combatCustomAdjustedXp, setCombatCustomAdjustedXp] = useState(0);
  const [selectedCombatEntryKey, setSelectedCombatEntryKey] = useState("");
  const [combatSetupOpen, setCombatSetupOpen] = useState(false);
  const [campaignPreparedCombatDraft, setCampaignPreparedCombatDraft] = useState<CampaignPreparedCombat>(createEmptyCampaignPreparedCombat);
  const [campaignPreparedCombatNotice, setCampaignPreparedCombatNotice] = useState("");
  const [preparedCombatStartModalOpen, setPreparedCombatStartModalOpen] = useState(false);
  const [preparedCombatStartEntries, setPreparedCombatStartEntries] = useState<PreparedCombatStartEntry[]>([]);
  const [combatPlayerEntityId, setCombatPlayerEntityId] = useState("");
  const [combatPlayerInitiative, setCombatPlayerInitiative] = useState(0);
  const [combatPortraitNotice, setCombatPortraitNotice] = useState("");
  const [combatReport, setCombatReport] = useState<FinishCombatResult | null>(null);
  const [closeConfirmState, setCloseConfirmState] = useState<{
    title: string;
    description: string;
    confirmLabel: string;
  } | null>(null);
  const [moduleEntitySearch, setModuleEntitySearch] = useState("");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [bestiary, setBestiary] = useState<BestiaryBrowseResult | null>(null);
  const [bestiarySearch, setBestiarySearch] = useState("");
  const [bestiaryChallenge, setBestiaryChallenge] = useState("");
  const [bestiaryType, setBestiaryType] = useState("");
  const [selectedBestiaryId, setSelectedBestiaryId] = useState("");
  const [selectedBestiaryMonster, setSelectedBestiaryMonster] = useState<BestiaryMonsterDetail | null>(null);
  const [bestiaryLoading, setBestiaryLoading] = useState(false);
  const [bestiaryDetailLoading, setBestiaryDetailLoading] = useState(false);
  const [importingBestiary, setImportingBestiary] = useState(false);
  const [importedMonsterSearch, setImportedMonsterSearch] = useState("");
  const [importedMonsterChallenge, setImportedMonsterChallenge] = useState("");
  const [railWidth, setRailWidth] = useState(220);
  const [listWidth, setListWidth] = useState(284);
  const [previewWidth, setPreviewWidth] = useState(330);
  const pendingModalCloseRef = useRef<(() => void) | null>(null);
  const deferredQuery = useDeferredValue(query);
  const deferredBestiarySearch = useDeferredValue(bestiarySearch);
  const deferredCombatSearchQuery = useDeferredValue(combatSearchQuery);
  const deferredPreparedCombatSearchQuery = useDeferredValue(preparedCombatSearchQuery);
  const contentRef = useRef<HTMLElement | null>(null);
  const entityContentRef = useRef<HTMLTextAreaElement | null>(null);
  const entityPlayerContentRef = useRef<HTMLTextAreaElement | null>(null);
  const noteEditorContentRef = useRef<HTMLTextAreaElement | null>(null);
  const resizeRef = useRef<{ key: ResizeKey; startX: number; startWidth: number } | null>(null);
  const lastAppViewRef = useRef<{ module: ModuleId; tab: string }>({ module: "dashboard", tab: "Snapshot" });
  const combatPatchQueueRef = useRef(new Map<string, Promise<void>>());

  const hydrateCampaign = (data: CampaignData, preferredEntityId?: string) => {
    const normalized = normalizeCampaignForClient(data);
    const allEntities = [...normalized.locations, ...normalized.players, ...normalized.npcs, ...normalized.monsters, ...normalized.quests, ...normalized.lore];
    const preparedPartySize = normalized.preparedCombat?.playerIds?.length ?? 0;
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
    setCampaignPreparedCombatDraft(cloneCampaignPreparedCombat(normalized.preparedCombat));
    setCombatPlayerEntityId((current) =>
      current && normalized.players.some((player) => player.id === current) ? current : normalized.players[0]?.id ?? ""
    );
    setCombatSelectionId((current) => {
      const fallbackCombatEntityId = normalized.monsters[0]?.id ?? normalized.npcs[0]?.id ?? "";

      if (isCombatSelectionBestiaryKey(current)) {
        return current;
      }

      if (isCombatSelectionEntityKey(current)) {
        const currentEntityId = unwrapCombatSelectionKey(current);
        return allEntities.some((entity) => entity.id === currentEntityId)
          ? current
          : fallbackCombatEntityId
            ? combatSelectionEntityKey(fallbackCombatEntityId)
            : "";
      }

      return current && allEntities.some((entity) => entity.id === current)
        ? combatSelectionEntityKey(current)
        : fallbackCombatEntityId
          ? combatSelectionEntityKey(fallbackCombatEntityId)
          : "";
    });
    setSelectedCombatEntryKey(
      currentCombatEntryKey ||
        (normalized.activeCombat?.entries[0] ? combatEntrySelectionKey(normalized.activeCombat.entries[0], 0) : "")
    );
  };

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
    setEventEditorId("");
    setEventEditorDraft(emptyWorldEventInput());
    setEventEditorDirty(false);
    setEventEditorNotice("");
    setPinnedIds([]);
    setResults([]);
    setBootError("");
  };

  const isUnauthorizedError = (error: unknown) =>
    typeof error === "object" && error !== null && "status" in error && (error as { status?: number }).status === 401;

  const handleProtectedActionError = (error: unknown, fallbackMessage: string) => {
    if (isUnauthorizedError(error)) {
      setAuthError("Сессия истекла или вход не подтверждён. Войди снова.");
      setAuthState("unauthenticated");
      setAuthUsername("");
      setLoginPassword("");
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
    resetCampaignState();
  };

  const submitLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    try {
      setAuthBusy(true);
      setAuthError("");
      setBooting(true);
      const session = await api.login({
        username: loginUsername.trim(),
        password: loginPassword
      });
      applyAuthSession(session);
      setLoginPassword("");
    } catch (error) {
      setAuthState("unauthenticated");
      setBooting(false);
      setAuthError(error instanceof Error ? error.message : "Не удалось выполнить вход.");
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

  useEffect(() => {
    let cancelled = false;

    const shouldLoadBestiary = activeModule === "monsters";
    if (!shouldLoadBestiary) {
      return () => {
        cancelled = true;
      };
    }

    const loadBestiary = async () => {
      try {
        setBestiaryLoading(true);
        const result = await api.browseBestiary({
          q: deferredBestiarySearch.trim(),
          challenge: bestiaryChallenge,
          type: bestiaryType,
          namedNpc: activeTab === "Named NPC",
          classic: activeTab === "Classic"
        });
        if (cancelled) return;
        setBestiary(result);
        setSelectedBestiaryId((current) => (result.items.some((item) => item.id === current) ? current : ""));
      } catch (error) {
        if (cancelled) return;
        setBootError(error instanceof Error ? error.message : "Не удалось загрузить каталог dnd.su.");
        setBestiary(null);
      } finally {
        if (!cancelled) {
          setBestiaryLoading(false);
        }
      }
    };

    void loadBestiary();
    return () => {
      cancelled = true;
    };
  }, [activeModule, activeTab, bestiaryChallenge, bestiaryType, deferredBestiarySearch]);

  useEffect(() => {
    let cancelled = false;

    if (!selectedBestiaryId || activeModule !== "monsters" || activeTab === "Imported") {
      return () => {
        cancelled = true;
      };
    }

    const loadBestiaryMonster = async () => {
      try {
        setBestiaryDetailLoading(true);
        const result = await api.getBestiaryMonster(selectedBestiaryId);
        if (cancelled) return;
        setSelectedBestiaryMonster(result);
      } catch (error) {
        if (cancelled) return;
        setBootError(error instanceof Error ? error.message : "Не удалось открыть монстра из dnd.su.");
        setSelectedBestiaryMonster(null);
      } finally {
        if (!cancelled) {
          setBestiaryDetailLoading(false);
        }
      }
    };

    void loadBestiaryMonster();
    return () => {
      cancelled = true;
    };
  }, [activeModule, activeTab, selectedBestiaryId]);

  useEffect(() => {
    if (activeModule !== "monsters" || bestiary?.status.state !== "syncing") {
      return;
    }

    const timer = window.setInterval(() => {
      api
        .browseBestiary({
          q: deferredBestiarySearch.trim(),
          challenge: bestiaryChallenge,
          type: bestiaryType,
          namedNpc: activeTab === "Named NPC",
          classic: activeTab === "Classic"
        })
        .then((result) => {
          setBestiary(result);
          setSelectedBestiaryId((current) => (result.items.some((item) => item.id === current) ? current : ""));
        })
        .catch(() => undefined);
    }, 5000);

    return () => window.clearInterval(timer);
  }, [activeModule, activeTab, bestiary?.status.state, bestiaryChallenge, bestiaryType, deferredBestiarySearch]);

  const allEntities = useMemo(
    () => (campaign ? [...campaign.locations, ...campaign.players, ...campaign.npcs, ...campaign.monsters, ...campaign.quests, ...campaign.lore] : []),
    [campaign]
  );

  const entityMap = useMemo(() => new Map(allEntities.map((entity) => [entity.id, entity])), [allEntities]);
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
  const linkableEntities = useMemo(
    () =>
      allEntities.filter((entity) =>
        entity.id !== editingEntityId &&
        entity.id !== entityLinkSelection?.entityId &&
        [entity.title, entity.subtitle, entity.summary, entity.tags.join(" ")]
          .join(" ")
          .toLowerCase()
          .includes(entityLinkQuery.trim().toLowerCase())
      ),
    [allEntities, editingEntityId, entityLinkQuery, entityLinkSelection?.entityId]
  );
  const scopedEntities = useMemo(
    () =>
      filterEntities(campaign, activeModule, activeTab, {
        monsterSearch: importedMonsterSearch,
        monsterChallenge: importedMonsterChallenge
      }),
    [activeModule, activeTab, campaign, importedMonsterChallenge, importedMonsterSearch]
  );
  const moduleDirectoryEntities = useMemo(
    () =>
      scopedEntities.filter((entity) =>
        activeModule === "monsters" && activeTab === "Imported" ? true : matchesEntityDirectorySearch(entity, moduleEntitySearch)
      ),
    [activeModule, activeTab, moduleEntitySearch, scopedEntities]
  );

  useEffect(() => {
    let cancelled = false;

    if (!combatSetupOpen) {
      setCombatBestiary(null);
      setCombatBestiaryLoading(false);
      return () => {
        cancelled = true;
      };
    }

    if (!deferredCombatSearchQuery.trim() && !combatSearchChallenge) {
      setCombatBestiary(null);
      setCombatBestiaryLoading(false);
      return () => {
        cancelled = true;
      };
    }

    const loadCombatBestiary = async () => {
      try {
        setCombatBestiaryLoading(true);
        const result = await api.browseBestiary({
          q: deferredCombatSearchQuery.trim(),
          challenge: combatSearchChallenge
        });
        if (cancelled) return;
        setCombatBestiary(result);
      } catch (error) {
        if (cancelled) return;
        setBootError(error instanceof Error ? error.message : "Не удалось загрузить монстров из dnd.su для боя.");
        setCombatBestiary(null);
      } finally {
        if (!cancelled) {
          setCombatBestiaryLoading(false);
        }
      }
    };

    void loadCombatBestiary();
    return () => {
      cancelled = true;
    };
  }, [combatSearchChallenge, combatSetupOpen, deferredCombatSearchQuery]);

  useEffect(() => {
    let cancelled = false;

    if (!combatSetupOpen || !isCombatSelectionBestiaryKey(combatSelectionId)) {
      setCombatSelectedBestiaryMonster(null);
      return () => {
        cancelled = true;
      };
    }

    const loadCombatSelectedBestiary = async () => {
      try {
        const result = await api.getBestiaryMonster(unwrapCombatSelectionKey(combatSelectionId));
        if (cancelled) return;
        setCombatSelectedBestiaryMonster(result);
      } catch (error) {
        if (cancelled) return;
        setBootError(error instanceof Error ? error.message : "Не удалось открыть карточку монстра из dnd.su.");
        setCombatSelectedBestiaryMonster(null);
      }
    };

    void loadCombatSelectedBestiary();
    return () => {
      cancelled = true;
    };
  }, [combatSelectionId, combatSetupOpen]);

  useEffect(() => {
    if (!campaign || activeModule === "dashboard" || activeModule === "combat" || isBestiaryBrowseTab(activeModule, activeTab)) {
      return;
    }

    if (activeEntityId && !scopedEntities.some((entity) => entity.id === activeEntityId)) {
      setActiveEntityId("");
    }
  }, [activeEntityId, activeModule, activeTab, campaign, scopedEntities]);

  useEffect(() => {
    if (activeModule !== "lore") {
      return;
    }

    if (!activeEntityId) {
      if (noteEditorEntityId === NEW_LORE_NOTE_ID) {
        return;
      }

      if (campaign?.lore[0]) {
        setActiveEntityId(campaign.lore[0].id);
        setPreviewEntityId((current) => current || campaign.lore[0]?.id || "");
      } else {
        setNoteEditorEntityId(NEW_LORE_NOTE_ID);
        setNoteEditorTitle("");
        setNoteEditorContent("");
        setNoteEditorDirty(false);
      }
      return;
    }

    const nextNote = entityMap.get(activeEntityId);
    if (nextNote?.kind !== "lore") {
      return;
    }

    setNoteEditorEntityId(nextNote.id);
    setNoteEditorTitle(nextNote.title);
    setNoteEditorContent(nextNote.content);
    setNoteEditorDirty(false);
  }, [activeModule, activeEntityId, campaign?.lore, entityMap, noteEditorEntityId]);

  useEffect(() => {
    if (activeRailAlias !== "events") {
      return;
    }

    if (!eventEditorId) {
      if (campaign?.events[0]) {
        setEventEditorId(campaign.events[0].id);
        setEventEditorDraft(worldEventToForm(campaign.events[0]));
        setEventEditorDirty(false);
      } else {
        setEventEditorId(NEW_WORLD_EVENT_ID);
        setEventEditorDraft(emptyWorldEventInput());
        setEventEditorDirty(false);
      }
      return;
    }

    if (eventEditorId === NEW_WORLD_EVENT_ID) {
      return;
    }

    const nextEvent = campaign?.events.find((event) => event.id === eventEditorId) ?? null;
    if (!nextEvent) {
      setEventEditorId(campaign?.events[0]?.id ?? NEW_WORLD_EVENT_ID);
      setEventEditorDraft(campaign?.events[0] ? worldEventToForm(campaign.events[0]) : emptyWorldEventInput());
      setEventEditorDirty(false);
      return;
    }

    setEventEditorDraft(worldEventToForm(nextEvent));
    setEventEditorDirty(false);
  }, [activeRailAlias, campaign?.events, eventEditorId]);

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
    if (!campaign || !activeCampaignId) {
      return;
    }

    if (!deferredQuery.trim()) {
      const fallback = [
        ...pinnedIds
          .map((id) => entityMap.get(id))
          .filter((entity): entity is KnowledgeEntity => Boolean(entity))
          .map(toResult),
        ...campaign.quests.slice(0, 3).map(toResult),
        ...campaign.locations.slice(0, 3).map(toResult),
        ...campaign.npcs.slice(0, 2).map(toResult),
        ...campaign.monsters.slice(0, 2).map(toResult)
      ];
      setResults(fallback.slice(0, 10));
      return;
    }

    api.search(activeCampaignId, deferredQuery).then(setResults).catch(() => setResults([]));
  }, [activeCampaignId, campaign, deferredQuery, entityMap, pinnedIds]);

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
    if (!entityLinkModalOpen) {
      return;
    }

    if (!linkableEntities.some((entity) => entity.id === entityLinkTargetId)) {
      setEntityLinkTargetId(linkableEntities[0]?.id ?? "");
    }
  }, [entityLinkModalOpen, entityLinkTargetId, linkableEntities]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPaletteOpen(true);
      }

      if (event.key === "Escape") {
        setPaletteOpen(false);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

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
  const activeLoreNote = activeEntity?.kind === "lore" ? activeEntity : null;
  const activeWorldEvent =
    campaign && eventEditorId && eventEditorId !== NEW_WORLD_EVENT_ID
      ? campaign.events.find((event) => event.id === eventEditorId) ?? null
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
  const activeQuestIssuer = useMemo(
    () =>
      activeEntity?.kind === "quest" && activeEntity.issuerId ? entityMap.get(activeEntity.issuerId) ?? null : null,
    [activeEntity, entityMap]
  );
  const previewEntity = entityMap.get(previewEntityId) ?? null;
  const entityPlaylistTarget =
    entityPlaylistEntityId && entityMap.has(entityPlaylistEntityId) ? entityMap.get(entityPlaylistEntityId) ?? null : null;
  const entityGalleryTarget =
    entityGalleryEntityId && entityMap.has(entityGalleryEntityId) ? entityMap.get(entityGalleryEntityId) ?? null : null;
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
  const activeQuestPreparedCombatEntries = useMemo(
    () =>
      activeEntity?.kind === "quest"
        ? (activeEntity.preparedCombat?.items ?? [])
            .map((item) => {
              const entity = entityMap.get(item.entityId);
              if (!entity || !isCombatProfileEntity(entity)) {
                return null;
              }
              return {
                entity,
                quantity: Math.max(1, item.quantity)
              };
            })
            .filter((item): item is { entity: CombatProfileEntity; quantity: number } => Boolean(item))
        : [],
    [activeEntity, entityMap]
  );
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
  const configuredCombatEnemies = useMemo(
    () =>
      (campaignPreparedCombat?.items ?? [])
        .map((item) => {
          const entity = entityMap.get(item.entityId);
          return entity && (entity.kind === "npc" || entity.kind === "monster")
            ? {
                entity,
                quantity: Math.max(1, item.quantity)
              }
            : null;
        })
        .filter((item): item is { entity: NpcEntity | MonsterEntity; quantity: number } => Boolean(item)),
    [campaignPreparedCombat?.items, entityMap]
  );
  const configuredCombatEnemyCount = configuredCombatEnemies.reduce((sum, item) => sum + item.quantity, 0);
  const hasConfiguredCombat = configuredCombatPlayers.length > 0 || configuredCombatEnemies.length > 0;
  const canStartConfiguredCombat = configuredCombatPlayers.length > 0 && configuredCombatEnemyCount > 0;
  const playerFacingEntity =
    playerFacingEntityId && entityMap.has(playerFacingEntityId) ? entityMap.get(playerFacingEntityId) ?? null : null;
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
    quest
      ? (quest.preparedCombat?.items ?? [])
          .map((item) => {
            const entity = entityMap.get(item.entityId);
            if (!entity || !isCombatProfileEntity(entity)) {
              return null;
            }
            return {
              entity,
              quantity: Math.max(1, item.quantity)
            };
          })
          .filter((item): item is QuestCombatEntrySummary => Boolean(item))
      : [];
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
  const activeQuestLocation = activeEntity?.kind === "quest" ? resolveQuestLocation(activeEntity) : null;
  const activeQuestLinkedEntities = activeEntity?.kind === "quest" ? buildQuestLinkedEntities(activeEntity) : [];
  const activeQuestRelatedQuests = activeEntity?.kind === "quest" ? findRelatedQuests(activeEntity).slice(0, 3) : [];
  const questScopeEntities =
    activeModule === "quests" ? scopedEntities.filter((entity): entity is QuestEntity => entity.kind === "quest") : [];
  const activeQuestIndex = activeEntity?.kind === "quest" ? questScopeEntities.findIndex((quest) => quest.id === activeEntity.id) : -1;
  const previousQuest = activeQuestIndex > 0 ? questScopeEntities[activeQuestIndex - 1] : null;
  const nextQuest =
    activeQuestIndex >= 0 && activeQuestIndex < questScopeEntities.length - 1 ? questScopeEntities[activeQuestIndex + 1] : null;
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

  const scrollContentToTop = () => {
    contentRef.current?.scrollTo({ top: 0, behavior: "auto" });
  };

  const openModuleDirectory = (moduleId: ModuleId = activeModule, tabId?: string) => {
    if (moduleId === "dashboard" || moduleId === "combat") {
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
      setSelectedBestiaryId("");
      setSelectedBestiaryMonster(null);
    }
    requestAnimationFrame(scrollContentToTop);
  };

  const openEntity = (id: string) => {
    const entity = entityMap.get(id);
    if (!entity) {
      return;
    }

    const targetModule = moduleByKind[entity.kind];
    const defaultTab = entity.kind === "monster" ? "Imported" : "All";
    const nextTab =
      activeModule === targetModule && scopedEntities.some((candidate) => candidate.id === entity.id) ? activeTab : defaultTab;

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

  const requestLoreNoteSwitch = (noteId: string) => {
    if (!noteId || (noteEditorEntityId !== NEW_LORE_NOTE_ID && activeEntityId === noteId)) {
      return;
    }

    if (noteEditorDirty && !window.confirm("Есть несохранённые изменения в заметке. Переключиться без сохранения?")) {
      return;
    }

    setNoteEditorNotice("");
    setBootError("");
    openEntity(noteId);
  };

  const startNewLoreNote = () => {
    if (noteEditorDirty && !window.confirm("Есть несохранённые изменения в заметке. Открыть новый черновик без сохранения?")) {
      return;
    }

    setActiveEntityId("");
    setPreviewEntityId("");
    setNoteEditorEntityId(NEW_LORE_NOTE_ID);
    setNoteEditorTitle("");
    setNoteEditorContent("");
    setNoteEditorDirty(false);
    setNoteEditorNotice("");
    setBootError("");
  };

  const saveLoreNote = async () => {
    if (!activeCampaignId) {
      return;
    }

    const resolvedTitle = resolveLoreNoteTitle(noteEditorTitle, noteEditorContent);
    const resolvedContent = noteEditorContent.trim();

    if (!resolvedTitle.trim() && !resolvedContent) {
      setNoteEditorNotice("Сначала добавь текст заметки.");
      return;
    }

    const currentNote = noteEditorEntityId && noteEditorEntityId !== NEW_LORE_NOTE_ID ? entityMap.get(noteEditorEntityId) : null;
    const baseForm = currentNote?.kind === "lore" ? entityToForm(currentNote) : emptyEntityForm("lore");
    const payload = serializeEntityForm({
      ...baseForm,
      kind: "lore",
      title: resolvedTitle,
      summary: loreNoteExcerpt({ summary: "", content: resolvedContent || resolvedTitle }, 150),
      content: noteEditorContent,
      category: baseForm.category ?? "History",
      visibility: baseForm.visibility ?? "gm_only"
    });

    try {
      setSaving(true);
      setBootError("");
      setNoteEditorNotice("");
      const result = await persistEntityPayload({
        payload,
        mode: currentNote?.kind === "lore" ? "edit" : "create",
        editingId: currentNote?.kind === "lore" ? currentNote.id : undefined
      });
      applyCreatedEntity(result);
      setNoteEditorEntityId(result.entity.id);
      setNoteEditorTitle(result.entity.title);
      setNoteEditorContent(result.entity.content);
      setNoteEditorDirty(false);
      setNoteEditorNotice(currentNote?.kind === "lore" ? "Заметка сохранена." : "Заметка создана.");
    } catch (error) {
      setBootError(error instanceof Error ? error.message : "Не удалось сохранить заметку.");
    } finally {
      setSaving(false);
    }
  };

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

    const nextEvent = campaign?.events.find((event) => event.id === nextEventId) ?? null;
    if (!nextEvent) {
      return;
    }

    setEventEditorId(nextEvent.id);
    setEventEditorDraft(worldEventToForm(nextEvent));
    setEventEditorDirty(false);
    setEventEditorNotice("");
    setBootError("");
  };

  const startNewWorldEvent = () => {
    if (eventEditorDirty && !window.confirm("Есть несохранённые изменения в событии. Открыть новый черновик без сохранения?")) {
      return;
    }

    setActiveEntityId("");
    setPreviewEntityId("");
    setEventEditorId(NEW_WORLD_EVENT_ID);
    setEventEditorDraft({
      ...emptyWorldEventInput(),
      date: campaign?.inWorldDate ?? "",
      locationId: "",
      locationLabel: "",
      origin: "manual"
    });
    setEventEditorDirty(false);
    setEventEditorNotice("");
    setBootError("");
  };

  const saveWorldEvent = async () => {
    if (!activeCampaignId) {
      return;
    }

    const locationLabel =
      campaign?.locations.find((location) => location.id === eventEditorDraft.locationId)?.title ??
      eventEditorDraft.locationLabel ??
      "";
    const payload = serializeWorldEventInput({
      ...eventEditorDraft,
      locationLabel,
      date: eventEditorDraft.date || campaign?.inWorldDate || "",
      origin: eventEditorDraft.origin === "ai" ? "ai" : "manual"
    });

    if (!payload.summary.trim() && !payload.sceneText.trim()) {
      setEventEditorNotice("Сначала добавь хотя бы короткое описание или текст сцены.");
      return;
    }

    try {
      setSaving(true);
      setBootError("");
      setEventEditorNotice("");
      const result =
        activeWorldEvent && eventEditorId !== NEW_WORLD_EVENT_ID
          ? await api.updateWorldEvent(activeCampaignId, activeWorldEvent.id, payload)
          : await api.createWorldEvent(activeCampaignId, payload);
      hydrateCampaign(result.campaign);
      const nextEvent = normalizeWorldEventForClient(
        result.event,
        (result.campaign.locations ?? []).map((location) => normalizeEntityForClient(location))
      );
      setEventEditorId(nextEvent.id);
      setEventEditorDraft(worldEventToForm(nextEvent));
      setEventEditorDirty(false);
      setEventEditorNotice(activeWorldEvent ? "Событие сохранено." : "Событие создано.");
      setActiveRailAlias("events");
      setActiveModule("quests");
      setActiveTab("All");
    } catch (error) {
      setBootError(error instanceof Error ? error.message : "Не удалось сохранить событие.");
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
      setBootError("");
      const result = await api.deleteWorldEvent(activeCampaignId, activeWorldEvent.id);
      const normalizedCampaign = normalizeCampaignForClient(result.campaign);
      hydrateCampaign(result.campaign);
      if (normalizedCampaign.events[0]) {
        setEventEditorId(normalizedCampaign.events[0].id);
        setEventEditorDraft(worldEventToForm(normalizedCampaign.events[0]));
      } else {
        setEventEditorId(NEW_WORLD_EVENT_ID);
        setEventEditorDraft({
          ...emptyWorldEventInput(),
          date: normalizedCampaign.inWorldDate ?? "",
          origin: "manual"
        });
      }
      setEventEditorDirty(false);
      setEventEditorNotice("Событие удалено.");
    } catch (error) {
      setBootError(error instanceof Error ? error.message : "Не удалось удалить событие.");
    } finally {
      setSaving(false);
    }
  };

  const openWorldEvent = (eventId: string) => {
    const event = campaign?.events.find((item) => item.id === eventId) ?? null;
    if (!event) {
      return;
    }
    if (eventEditorDirty && activeRailAlias === "events" && !window.confirm("Есть несохранённые изменения в событии. Переключиться без сохранения?")) {
      return;
    }

    setActiveModule("quests");
    setActiveRailAlias("events");
    setActiveTab("All");
    setActiveEntityId("");
    setEventEditorId(event.id);
    setEventEditorDraft(worldEventToForm(event));
    setEventEditorDirty(false);
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
      activeModule === "quests" && (activeTab === "All" || activeTab.toLowerCase() === entity.status) ? activeTab : "All";

    startTransition(() => {
      setActiveModule("quests");
      setActiveRailAlias((current) => preserveRailAliasForModule(current, "quests"));
      setActiveTab(nextTab);
      setActiveEntityId(id);
    });

    setPreviewEntityId(id);
    requestAnimationFrame(scrollContentToTop);
  };

  const openPlayerFacingView = (entity: QuestEntity | NpcEntity) => {
    if (!entity.playerContent?.trim()) {
      setBootError("Для этой сущности пока не заполнена отдельная версия для игроков.");
      return;
    }

    setPlayerFacingEntityId(entity.id);
  };

  const closePlayerFacingView = () => {
    setPlayerFacingEntityId("");
  };

  const openRelatedEntity = (item: RelatedEntity) => {
    const linked = resolveLinkedEntity(item);
    if (!linked) {
      setBootError(`Связанная сущность "${item.label}" не найдена в кампании. Возможно, её удалили или ссылка устарела.`);
      return;
    }

    peekEntity(linked.id);
  };

  const openCombatScreen = () => {
    setActiveModule("combat");
    setActiveRailAlias(null);
    setActiveTab("Encounter");
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
      setBootError("Браузер заблокировал новую вкладку с трекером. Разреши pop-up для сайта и попробуй ещё раз.");
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

    const popup = window.open("", "_blank");
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
      setSelectedBestiaryId("");
      setSelectedBestiaryMonster(null);
      requestAnimationFrame(scrollContentToTop);
      return;
    }

    setActiveEntityId("");
    setPreviewEntityId("");
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
    setActiveTab("All");
    setActiveEntityId("");
    setPreviewEntityId("");
    setSelectedBestiaryId("");
    setSelectedBestiaryMonster(null);
    requestAnimationFrame(scrollContentToTop);
  };

  const openFromSearch = (id: string) => {
    openEntity(id);
    setPaletteOpen(false);
    setQuery("");
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

  const requestModalClose = (title: string, onConfirm: () => void, description?: string, confirmLabel = "Закрыть") => {
    pendingModalCloseRef.current = onConfirm;
    setCloseConfirmState({
      title,
      description: description ?? "Несохранённые изменения в этом окне могут пропасть. Точно закрыть его сейчас?",
      confirmLabel
    });
  };

  const cancelModalCloseRequest = () => {
    pendingModalCloseRef.current = null;
    setCloseConfirmState(null);
  };

  const confirmModalCloseRequest = () => {
    const action = pendingModalCloseRef.current;
    pendingModalCloseRef.current = null;
    setCloseConfirmState(null);
    action?.();
  };

  const openCampaignModal = () => {
    setCampaignForm(emptyCampaignForm());
    setCampaignModalOpen(true);
  };

  const openRandomEventModal = () => {
    const suggestedLocationId =
      activeWorldEvent?.locationId ??
      (activeEntity?.kind === "location"
        ? activeEntity.id
        : activeEntity?.kind === "npc" || activeEntity?.kind === "monster" || activeEntity?.kind === "quest"
          ? activeEntity.locationId ?? ""
          : "") ??
      "";
    setRandomEventLocationId(suggestedLocationId);
    setRandomEventType(activeWorldEvent?.type ?? "social");
    setRandomEventPrompt("");
    setRandomEventNotes([]);
    setRandomEventModalOpen(true);
  };

  const openCombatPlaylistModal = () => {
    setCombatPlaylistDraft(clonePlaylistTracks(campaign?.combatPlaylist) ?? []);
    setCombatPlaylistModalOpen(true);
  };

  const openCombatSetupModal = () => {
    setBootError("");
    setCampaignPreparedCombatNotice("");
    setCampaignPreparedCombatDraft(cloneCampaignPreparedCombat(campaignPreparedCombat));
    setCombatSelectionQuantity(1);
    setCombatSelectionInitiative(0);
    setCombatSetupOpen(true);
  };

  const openEntityPlaylistModal = (entity: KnowledgeEntity) => {
    setEntityPlaylistEntityId(entity.id);
    setEntityPlaylistDraft(clonePlaylistTracks(entity.playlist) ?? []);
    setEntityPlaylistModalOpen(true);
  };

  const openEntityGalleryModal = (entity: KnowledgeEntity) => {
    setEntityGalleryEntityId(entity.id);
    setEntityGalleryDraft(cloneGalleryImages(entity.gallery) ?? []);
    setEntityGalleryModalOpen(true);
  };

  const openEntityModal = (kind: EntityKind = defaultCreateKind) => {
    setEntityModalMode("create");
    setEditingEntityId("");
    setEntityModalSourceNpcId("");
    setGeneratedQuestIssuerDraft(null);
    setGeneratedQuestIssuerNote("");
    setDraftPrompt("");
    setDraftNotes([]);
    setEntityLinkSelection(null);
    setEntityLinkMenuOpen(false);
    setEntityLinkModalOpen(false);
    setEntityLinkQuery("");
    setEntityLinkTargetId("");
    setEntityForm(emptyEntityForm(kind));
    setEntityModalOpen(true);
  };

  const openEntityEditor = (entityId: string) => {
    const entity = entityMap.get(entityId);
    if (!entity) {
      return;
    }

    setEntityModalMode("edit");
    setEditingEntityId(entityId);
    setEntityModalSourceNpcId("");
    setGeneratedQuestIssuerDraft(null);
    setGeneratedQuestIssuerNote("");
    setDraftPrompt("");
    setDraftNotes([]);
    setEntityLinkSelection(null);
    setEntityLinkMenuOpen(false);
    setEntityLinkModalOpen(false);
    setEntityLinkQuery("");
    setEntityLinkTargetId("");
    setEntityForm(entityToForm(entity));
    setEntityModalOpen(true);
  };

  const openNpcQuestModal = (npc: NpcEntity) => {
    setEntityModalMode("create");
    setEditingEntityId("");
    setEntityModalSourceNpcId(npc.id);
    setGeneratedQuestIssuerDraft(null);
    setGeneratedQuestIssuerNote("");
    setDraftPrompt(`Создай квест для НПС ${npc.title}. Контекст НПС: ${npc.summary}`);
    setDraftNotes([]);
    setEntityLinkSelection(null);
    setEntityLinkMenuOpen(false);
    setEntityLinkModalOpen(false);
    setEntityLinkQuery("");
    setEntityLinkTargetId("");
    setEntityForm({
      ...emptyEntityForm("quest"),
      subtitle: npc.title ? `Квест от ${npc.title}` : "",
      issuerId: npc.id,
      related: [
        {
          id: npc.id,
          kind: "npc",
          label: npc.title,
          reason: "Этот НПС выдаёт, сопровождает или двигает этот квест."
        }
      ]
    });
    setEntityModalOpen(true);
  };

  const closeEntityModal = () => {
    setEntityModalOpen(false);
    setEntityModalMode("create");
    setEditingEntityId("");
    setEntityModalSourceNpcId("");
    setGeneratedQuestIssuerDraft(null);
    setGeneratedQuestIssuerNote("");
    setDraftPrompt("");
    setDraftNotes([]);
    setEntityLinkSelection(null);
    setEntityLinkMenuOpen(false);
    setEntityLinkModalOpen(false);
    setEntityLinkQuery("");
    setEntityLinkTargetId("");
  };

  const closeRandomEventModal = () => {
    setRandomEventModalOpen(false);
    setRandomEventNotes([]);
    setRandomEventPrompt("");
    setRandomEventLocationId("");
    setRandomEventType("social");
    setRandomEventGenerating(false);
  };

  const closeCombatPlaylistModal = () => {
    setCombatPlaylistModalOpen(false);
    setCombatPlaylistDraft([]);
  };

  const closeCombatSetupModal = () => {
    setCombatSetupOpen(false);
    setCampaignPreparedCombatNotice("");
  };

  const closePreparedCombatStartModal = () => {
    setPreparedCombatStartModalOpen(false);
    setPreparedCombatStartEntries([]);
  };

  const closeEntityPlaylistModal = () => {
    setEntityPlaylistModalOpen(false);
    setEntityPlaylistEntityId("");
    setEntityPlaylistDraft([]);
  };

  const closeEntityGalleryModal = () => {
    setEntityGalleryModalOpen(false);
    setEntityGalleryEntityId("");
    setEntityGalleryDraft([]);
  };

  const closeEntityLinkContextMenu = () => {
    setEntityLinkMenuOpen(false);
  };

  const closeEntityLinkModal = () => {
    setEntityLinkModalOpen(false);
    setEntityLinkSelection(null);
    setEntityLinkMenuOpen(false);
    setEntityLinkQuery("");
    setEntityLinkTargetId("");
  };

  const handleEntityContentContextMenu = (field: EntityTextField, event: ReactMouseEvent<HTMLTextAreaElement>) => {
    const textarea = event.currentTarget;
    const start = textarea.selectionStart ?? 0;
    const end = textarea.selectionEnd ?? 0;
    const selectedText = textarea.value.slice(start, end).trim();

    if (!selectedText || start === end) {
      setEntityLinkSelection(null);
      closeEntityLinkContextMenu();
      return;
    }

    event.preventDefault();
    setEntityLinkSelection({
      mode: "editor",
      field,
      start,
      end,
      text: textarea.value.slice(start, end),
      x: clamp(event.clientX, 12, window.innerWidth - 240),
      y: clamp(event.clientY, 12, window.innerHeight - 80),
      entityId: editingEntityId || undefined
    });
    setEntityLinkMenuOpen(true);
  };

  const handleNoteContentContextMenu = (event: ReactMouseEvent<HTMLTextAreaElement>) => {
    const textarea = event.currentTarget;
    const start = textarea.selectionStart ?? 0;
    const end = textarea.selectionEnd ?? 0;
    const selectedText = textarea.value.slice(start, end).trim();

    if (!selectedText || start === end) {
      setEntityLinkSelection(null);
      closeEntityLinkContextMenu();
      return;
    }

    event.preventDefault();
    setEntityLinkSelection({
      mode: "noteEditor",
      field: "noteContent",
      start,
      end,
      text: textarea.value.slice(start, end),
      x: clamp(event.clientX, 12, window.innerWidth - 240),
      y: clamp(event.clientY, 12, window.innerHeight - 80),
      entityId: noteEditorEntityId && noteEditorEntityId !== NEW_LORE_NOTE_ID ? noteEditorEntityId : undefined
    });
    setEntityLinkMenuOpen(true);
  };

  const handleActiveEntityContentContextMenu = (
    entity: KnowledgeEntity,
    field: EntityTextField,
    event: ReactMouseEvent<HTMLElement>
  ) => {
    const selection = resolveRichSelectionFromContainer(event.currentTarget);
    if (!selection || !selection.text.trim()) {
      setEntityLinkSelection(null);
      closeEntityLinkContextMenu();
      return;
    }

    event.preventDefault();
    setEntityLinkSelection({
      mode: "entity",
      field,
      start: selection.start,
      end: selection.end,
      text: selection.text,
      x: clamp(event.clientX, 12, window.innerWidth - 240),
      y: clamp(event.clientY, 12, window.innerHeight - 80),
      entityId: entity.id
    });
    setEntityLinkMenuOpen(true);
  };

  const openEntityLinkModal = () => {
    if (!entityLinkSelection) {
      return;
    }

    const normalizedSelection = entityLinkSelection.text.trim();
    setEntityLinkQuery(normalizedSelection);
    const exactMatch = allEntities.find(
      (entity) =>
        entity.id !== editingEntityId &&
        entity.id !== entityLinkSelection.entityId &&
        entity.title.trim().toLowerCase() === normalizedSelection.toLowerCase()
    );
    setEntityLinkTargetId(exactMatch?.id ?? "");
    setEntityLinkMenuOpen(false);
    setEntityLinkModalOpen(true);
  };

  const insertEntityLinkIntoContent = () => {
    if (!entityLinkSelection || !entityLinkTargetId) {
      return;
    }

    const target = entityMap.get(entityLinkTargetId);
    if (!target) {
      return;
    }

    const sourceField = entityLinkSelection.field;
    const currentValue =
      sourceField === "noteContent"
        ? noteEditorContent
        : sourceField === "playerContent"
          ? entityForm.playerContent ?? ""
          : entityForm.content;
    const nextValue =
      currentValue.slice(0, entityLinkSelection.start) +
      createWikiLinkMarkup(target.title, entityLinkSelection.text) +
      currentValue.slice(entityLinkSelection.end);

    if (entityLinkSelection.mode === "noteEditor" || sourceField === "noteContent") {
      setNoteEditorContent(nextValue);
      setNoteEditorDirty(true);
      setNoteEditorNotice("");
      closeEntityLinkModal();

      requestAnimationFrame(() => {
        noteEditorContentRef.current?.focus();
      });
      return;
    }

    if (entityLinkSelection.mode === "editor") {
      setEntityForm((current) => ({
        ...current,
        [sourceField]: nextValue
      }));
      closeEntityLinkModal();

      requestAnimationFrame(() => {
        if (sourceField === "playerContent") {
          entityPlayerContentRef.current?.focus();
          return;
        }
        entityContentRef.current?.focus();
      });
      return;
    }

    const sourceEntity = entityLinkSelection.entityId ? entityMap.get(entityLinkSelection.entityId) ?? null : null;
    if (!sourceEntity || !activeCampaignId) {
      closeEntityLinkModal();
      return;
    }

    void (async () => {
      try {
        setSaving(true);
        const form = entityToForm(sourceEntity);
        const sourceValue = sourceField === "playerContent" ? sourceEntity.playerContent ?? "" : sourceEntity.content;
        const nextEntityValue =
          sourceValue.slice(0, entityLinkSelection.start) +
          createWikiLinkMarkup(target.title, entityLinkSelection.text) +
          sourceValue.slice(entityLinkSelection.end);
        form[sourceField] = nextEntityValue;
        const result = await api.updateEntity(activeCampaignId, sourceEntity.id, serializeEntityForm(form));
        applyCreatedEntity(result);
        closeEntityLinkModal();
        setPreviewEntityId(target.id);
      } catch (error) {
        setBootError(error instanceof Error ? error.message : "Не удалось сохранить ссылку в сущности.");
      } finally {
        setSaving(false);
      }
    })();
  };

  const updateEntityForm = (updater: (current: CreateEntityInput) => CreateEntityInput) => {
    setEntityForm((current) => updater(current));
  };

  const updateEntityPlaylistTrack = (index: number, patch: Partial<PlaylistTrack>) => {
    updateEntityForm((current) => ({
      ...current,
      playlist: (current.playlist ?? []).map((track, trackIndex) => (trackIndex === index ? { ...track, ...patch } : track))
    }));
  };

  const addEntityPlaylistTrack = () => {
    updateEntityForm((current) => ({
      ...current,
      playlist: [...(current.playlist ?? []), createEmptyPlaylistTrack()]
    }));
  };

  const removeEntityPlaylistTrack = (index: number) => {
    updateEntityForm((current) => ({
      ...current,
      playlist: (current.playlist ?? []).filter((_, trackIndex) => trackIndex !== index)
    }));
  };

  const updateEntityGalleryItem = (index: number, patch: Partial<GalleryImage>) => {
    updateEntityForm((current) => ({
      ...current,
      gallery: (current.gallery ?? []).map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item))
    }));
  };

  const addEntityGalleryItem = () => {
    updateEntityForm((current) => ({
      ...current,
      gallery: [...(current.gallery ?? []), createEmptyGalleryImage()]
    }));
  };

  const removeEntityGalleryItem = (index: number) => {
    updateEntityForm((current) => ({
      ...current,
      gallery: (current.gallery ?? []).filter((_, itemIndex) => itemIndex !== index)
    }));
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

  const updateEntityPlaylistDraftTrack = (index: number, patch: Partial<PlaylistTrack>) => {
    setEntityPlaylistDraft((current) => current.map((track, trackIndex) => (trackIndex === index ? { ...track, ...patch } : track)));
  };

  const addEntityPlaylistDraftTrack = () => {
    setEntityPlaylistDraft((current) => [...current, createEmptyPlaylistTrack()]);
  };

  const removeEntityPlaylistDraftTrack = (index: number) => {
    setEntityPlaylistDraft((current) => current.filter((_, trackIndex) => trackIndex !== index));
  };

  const updateEntityGalleryDraftItem = (index: number, patch: Partial<GalleryImage>) => {
    setEntityGalleryDraft((current) => current.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)));
  };

  const addEntityGalleryDraftItem = () => {
    setEntityGalleryDraft((current) => [...current, createEmptyGalleryImage()]);
  };

  const removeEntityGalleryDraftItem = (index: number) => {
    setEntityGalleryDraft((current) => current.filter((_, itemIndex) => itemIndex !== index));
  };

  const updateNpcStatBlock = (updater: (current: NpcStatBlock) => NpcStatBlock) => {
    updateEntityForm((current) => {
      if (current.kind !== "npc" && current.kind !== "monster") {
        return current;
      }

      return {
        ...current,
        statBlock: updater(current.statBlock ?? createEmptyNpcStatBlock())
      };
    });
  };

  const updateNpcAbilityScore = (key: AbilityKey, value: string) => {
    updateNpcStatBlock((current) => ({
      ...current,
      abilityScores: {
        ...current.abilityScores,
        [key]: Number.parseInt(value, 10) || 0
      }
    }));
  };

  const updateNpcStatEntry = (section: StatEntrySectionKey, index: number, patch: Partial<StatBlockEntry>) => {
    updateNpcStatBlock((current) => {
      const entries = [...(current[section] ?? [])];
      entries[index] = {
        ...entries[index],
        ...patch
      };
      return {
        ...current,
        [section]: entries
      };
    });
  };

  const addNpcStatEntry = (section: StatEntrySectionKey) => {
    updateNpcStatBlock((current) => ({
      ...current,
      [section]: [...(current[section] ?? []), createEmptyStatEntry()]
    }));
  };

  const removeNpcStatEntry = (section: StatEntrySectionKey, index: number) => {
    updateNpcStatBlock((current) => ({
      ...current,
      [section]: (current[section] ?? []).filter((_, currentIndex) => currentIndex !== index)
    }));
  };

  const setSpellcastingEnabled = (enabled: boolean) => {
    updateNpcStatBlock((current) => ({
      ...current,
      spellcasting: enabled ? current.spellcasting ?? createEmptySpellcasting() : null
    }));
  };

  const updateNpcSpellcasting = (updater: (current: SpellcastingBlock) => SpellcastingBlock) => {
    updateNpcStatBlock((current) => ({
      ...current,
      spellcasting: updater(current.spellcasting ?? createEmptySpellcasting())
    }));
  };

  const addSpellSlot = () => {
    updateNpcSpellcasting((current) => ({
      ...current,
      slots: [...(current.slots ?? []), createEmptySpellSlot()]
    }));
  };

  const updateSpellSlot = (index: number, patch: Partial<SpellSlotSummary>) => {
    updateNpcSpellcasting((current) => ({
      ...current,
      slots: (current.slots ?? []).map((slot, slotIndex) => (slotIndex === index ? { ...slot, ...patch } : slot))
    }));
  };

  const removeSpellSlot = (index: number) => {
    updateNpcSpellcasting((current) => ({
      ...current,
      slots: (current.slots ?? []).filter((_, slotIndex) => slotIndex !== index)
    }));
  };

  const updateEntityRewardProfile = (updater: (current: MonsterRewardProfile) => MonsterRewardProfile) => {
    updateEntityForm((current) => {
      if (current.kind !== "npc" && current.kind !== "monster" && current.kind !== "quest") {
        return current;
      }

      return {
        ...current,
        rewardProfile: updater(current.rewardProfile ?? createEmptyMonsterRewardProfile())
      };
    });
  };

  const updateMonsterLootEntry = (index: number, patch: Partial<MonsterLootEntry>) => {
    updateEntityRewardProfile((current) => ({
      ...current,
      loot: current.loot.map((entry, entryIndex) => (entryIndex === index ? { ...entry, ...patch } : entry))
    }));
  };

  const addMonsterLootEntry = () => {
    updateEntityRewardProfile((current) => ({
      ...current,
      loot: [...current.loot, createEmptyMonsterLootEntry()]
    }));
  };

  const removeMonsterLootEntry = (index: number) => {
    updateEntityRewardProfile((current) => ({
      ...current,
      loot:
        current.loot.length > 1
          ? current.loot.filter((_, entryIndex) => entryIndex !== index)
          : [createEmptyMonsterLootEntry()]
    }));
  };

  const openPreparedCombatModal = (quest: QuestEntity) => {
    setPreparedCombatQuestId(quest.id);
    setPreparedCombatDraft(clonePreparedCombatPlan(quest.preparedCombat) ?? { title: `${quest.title}: бой`, items: [] });
    setPreparedCombatNotice("");
    setBootError("");
    setPreparedCombatSearchQuery("");
    setPreparedCombatChallenge("");
    setPreparedCombatSelectionId("");
    setPreparedCombatQuantity(1);
    setPreparedCombatModalOpen(true);
  };

  const closePreparedCombatModal = () => {
    setPreparedCombatModalOpen(false);
    setPreparedCombatQuestId("");
    setPreparedCombatDraft({ title: "", items: [] });
    setPreparedCombatNotice("");
    setPreparedCombatSearchQuery("");
    setPreparedCombatChallenge("");
    setPreparedCombatSelectionId("");
    setPreparedCombatQuantity(1);
  };

  const requestCampaignModalClose = () => {
    requestModalClose("Закрыть создание кампании?", () => setCampaignModalOpen(false), "Название, дата и описание кампании останутся несохранёнными.");
  };

  const requestPaletteClose = () => {
    requestModalClose("Закрыть глобальный поиск?", () => setPaletteOpen(false), "Текущий поиск закроется. Если ещё не открыл нужную сущность, его придётся набрать заново.", "Закрыть поиск");
  };

  const requestEntityModalClose = () => {
    requestModalClose("Закрыть редактор сущности?", closeEntityModal, "Поля, черновик AI и несохранённые правки в редакторе могут потеряться.");
  };

  const requestRandomEventModalClose = () => {
    requestModalClose(
      "Закрыть генератор случайного события?",
      closeRandomEventModal,
      "Описание сцены и текущий результат генерации могут пропасть, если окно закрыть сейчас."
    );
  };

  const requestCombatPlaylistModalClose = () => {
    requestModalClose("Закрыть плейлист боя?", closeCombatPlaylistModal, "Несохранённые треки и правки боевого плейлиста будут потеряны.");
  };

  const requestCombatSetupModalClose = () => {
    requestModalClose("Закрыть настройку боя?", closeCombatSetupModal, "Подбор врагов и текущие настройки старта боя не сохранятся автоматически.");
  };

  const requestCombatSetupSwapToEntity = (kind: "player" | "monster") => {
    requestModalClose(
      kind === "player" ? "Открыть создание игрока?" : "Открыть создание монстра?",
      () => {
        closeCombatSetupModal();
        openEntityModal(kind);
      },
      "Текущая настройка боя закроется. Если что-то ещё не сохранено, эти правки пропадут.",
      kind === "player" ? "К игроку" : "К монстру"
    );
  };

  const requestPreparedCombatStartModalClose = () => {
    requestModalClose("Закрыть запуск боя?", closePreparedCombatStartModal, "Введённая инициатива участников пропадёт, и её придётся вводить заново.");
  };

  const requestEntityPlaylistModalClose = () => {
    requestModalClose("Закрыть редактор плейлиста?", closeEntityPlaylistModal, "Добавленные треки и правки плейлиста этой сущности будут потеряны.");
  };

  const requestEntityGalleryModalClose = () => {
    requestModalClose("Закрыть редактор галереи?", closeEntityGalleryModal, "Несохранённые изображения и подписи в галерее будут потеряны.");
  };

  const requestPreparedCombatModalClose = () => {
    requestModalClose("Закрыть заготовленный бой?", closePreparedCombatModal, "Текущий состав врагов и правки заготовки не сохранятся автоматически.");
  };

  const requestEntityLinkModalClose = () => {
    requestModalClose("Закрыть вставку ссылки?", closeEntityLinkModal, "Выбранная текстовая привязка и найденная цель будут сброшены.");
  };

  const requestGalleryViewerClose = () => {
    requestModalClose("Закрыть просмотр галереи?", closeGalleryViewer, "Окно полноэкранного просмотра закроется.", "Закрыть просмотр");
  };

  const requestPlayerFacingViewClose = () => {
    requestModalClose("Закрыть окно для игроков?", closePlayerFacingView, "Текущий player-facing просмотр закроется.", "Закрыть окно");
  };

  const updatePreparedCombatDraft = (updater: (current: PreparedCombatPlan) => PreparedCombatPlan) => {
    setPreparedCombatNotice("");
    setPreparedCombatDraft((current) => updater(current));
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
        setPreparedCombatSelectionId(combatSelectionEntityKey(entityId));
        peekEntity(imported.entity.id);
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

  const updatePreparedCombatDraftItem = (entityId: string, patch: Partial<PreparedCombatItem>) => {
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
      const payload = serializeEntityForm({
        ...entityToForm(questForSave),
        preparedCombat: normalizedDraft
      });
      const result = await api.updateEntity(activeCampaignId, questForSave.id, payload);
      hydrateCampaign(result.campaign, result.entity.id);
      setPreviewEntityId(result.entity.id);
      if (result.entity.kind === "quest") {
        setPreparedCombatDraft(clonePreparedCombatPlan(result.entity.preparedCombat) ?? { title: `${result.entity.title}: бой`, items: [] });
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

  const startPreparedQuestCombat = async (quest: QuestEntity) => {
    if (!activeCampaignId) {
      return;
    }
    if (activeCombat?.entries.length) {
      setBootError("Сначала заверши текущий активный бой или вернись в него, чтобы не смешивать две сцены.");
      openCombatScreen();
      return;
    }

    const items =
      quest.preparedCombat?.items
        ?.filter((item) => item.entityId && item.quantity > 0)
        .filter((item) => {
          const entity = entityMap.get(item.entityId);
          return Boolean(entity && isCombatProfileEntity(entity));
        })
        .map((item) => ({ entityId: item.entityId, quantity: Math.max(1, item.quantity) })) ?? [];

    if (!items.length) {
      setBootError("В этом квесте пока нет доступных противников для старта боя.");
      return;
    }

    try {
      setSaving(true);
      setBootError("");
      const result = await api.startCombat(activeCampaignId, {
        title: quest.preparedCombat?.title?.trim() || `${quest.title}: бой`,
        partySize: effectivePartySize,
        thresholds: effectiveCombatThresholds,
        items
      });
      applyCombatPayload(result);
      openCombatScreen();
    } catch (error) {
      setBootError(error instanceof Error ? error.message : "Не удалось запустить заготовленный бой для квеста.");
    } finally {
      setSaving(false);
    }
  };

  const handleQuestCombatAction = (quest: QuestEntity) => {
    if (activeCombat?.entries.length) {
      openCombatScreen();
      return;
    }

    if (resolveQuestPreparedCombatEntries(quest).length) {
      void startPreparedQuestCombat(quest);
      return;
    }

    openPreparedCombatModal(quest);
  };

  const handleCampaignSelect = async (campaignId: string) => {
    try {
      setBootError("");
      await loadCampaign(campaignId);
    } catch (error) {
      setBootError(error instanceof Error ? error.message : "Не удалось открыть кампанию.");
    }
  };

  const submitCampaign = async () => {
    try {
      setSaving(true);
      const created = await api.createCampaign(campaignForm);
      const list = await api.listCampaigns();
      setCampaigns(list);
      hydrateCampaign(created);
      setCampaignModalOpen(false);
    } catch (error) {
      setBootError(error instanceof Error ? error.message : "Не удалось создать кампанию.");
    } finally {
      setSaving(false);
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

  const saveEntityPlaylist = async () => {
    if (!activeCampaignId || !entityPlaylistTarget) {
      return;
    }

    try {
      setSaving(true);
      const nextForm = entityToForm(entityPlaylistTarget);
      nextForm.playlist = sanitizePlaylistTracks(entityPlaylistDraft);
      const result = await api.updateEntity(activeCampaignId, entityPlaylistTarget.id, serializeEntityForm(nextForm));
      hydrateCampaign(result.campaign);
      closeEntityPlaylistModal();
    } catch (error) {
      setBootError(error instanceof Error ? error.message : "Не удалось сохранить плейлист сущности.");
    } finally {
      setSaving(false);
    }
  };

  const saveEntityGallery = async () => {
    if (!activeCampaignId || !entityGalleryTarget) {
      return;
    }

    try {
      setSaving(true);
      const nextForm = entityToForm(entityGalleryTarget);
      nextForm.gallery = sanitizeGalleryImages(entityGalleryDraft);
      const result = await api.updateEntity(activeCampaignId, entityGalleryTarget.id, serializeEntityForm(nextForm));
      hydrateCampaign(result.campaign);
      closeEntityGalleryModal();
    } catch (error) {
      setBootError(error instanceof Error ? error.message : "Не удалось сохранить галерею сущности.");
    } finally {
      setSaving(false);
    }
  };

  const applyCreatedEntity = (result: CreateEntityResult) => {
    hydrateCampaign(result.campaign, result.entity.id);
    setActiveModule(moduleByKind[result.entity.kind]);
    setActiveRailAlias((current) => preserveRailAliasForModule(current, moduleByKind[result.entity.kind]));
    setActiveTab(result.entity.kind === "monster" ? "Imported" : "All");
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

  const buildRandomEventPrompt = (eventType: WorldEventType, locationLabel: string, extraPrompt: string) =>
    [
      `Нужна небольшая сценка типа "${worldEventTypeLabels[eventType]}"${locationLabel ? ` для локации "${locationLabel}"` : ""}.`,
      "Это не квест, а короткий table-ready эпизод для живой сессии.",
      "Нужны смешные, напряжённые или боевые детали, внятные реплики и короткий конкретный лут."
    ]
      .concat(extraPrompt.trim() ? [`Пожелание мастера: ${extraPrompt.trim()}`] : [])
      .join("\n");

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
      hydrateCampaign(result.campaign);
      const nextEvent = normalizeWorldEventForClient(
        result.event,
        (result.campaign.locations ?? []).map((location) => normalizeEntityForClient(location))
      );
      setActiveModule("quests");
      setActiveRailAlias("events");
      setActiveTab("All");
      setActiveEntityId("");
      setPreviewEntityId(payload.locationId || "");
      setEventEditorId(nextEvent.id);
      setEventEditorDraft(worldEventToForm(nextEvent));
      setEventEditorDirty(false);
      setEventEditorNotice("Событие создано и готово к правке.");
      closeRandomEventModal();
    } catch (error) {
      setBootError(error instanceof Error ? error.message : "Не удалось сгенерировать случайное событие.");
    } finally {
      setRandomEventGenerating(false);
    }
  };

  const submitEntity = async () => {
    if (!activeCampaignId) return;

    try {
      setSaving(true);
      const result = await persistEntityPayload({
        payload: serializeEntityForm(entityForm),
        mode: entityModalMode,
        editingId: editingEntityId,
        linkedIssuerDraft: generatedQuestIssuerDraft
      });
      applyCreatedEntity(result);
      closeEntityModal();
    } catch (error) {
      setBootError(
        error instanceof Error
          ? error.message
          : entityModalMode === "edit"
            ? "Не удалось сохранить сущность."
            : "Не удалось создать сущность."
      );
    } finally {
      setSaving(false);
    }
  };

  const generateDraft = async () => {
    if (!activeCampaignId || !draftPrompt.trim()) return;

    try {
      setGenerating(true);
      const result: GenerateEntityDraftResult = await api.generateEntityDraft(activeCampaignId, {
        kind: entityForm.kind,
        prompt: draftPrompt,
        current: entityForm
      });
      const generatedIssuer = result.linkedDrafts?.find((item) => item.role === "issuer" && item.entity.kind === "npc");
      setEntityForm({
        ...emptyEntityForm(result.entity.kind),
        ...result.entity,
        related: result.entity.related ?? [],
        tags: result.entity.tags ?? []
      });
      setDraftNotes(result.notes);
      setGeneratedQuestIssuerDraft(generatedIssuer?.entity ?? null);
      setGeneratedQuestIssuerNote(generatedIssuer?.note ?? "");
    } catch (error) {
      setBootError(error instanceof Error ? error.message : "Не удалось сгенерировать AI-черновик.");
    } finally {
      setGenerating(false);
    }
  };

  const deleteEntity = async () => {
    if (!activeCampaignId || !editingEntityId) return;
    if (!window.confirm("Удалить эту сущность из кампании?")) {
      return;
    }

    try {
      setSaving(true);
      const result = await api.deleteEntity(activeCampaignId, editingEntityId);
      setPinnedIds((current) => current.filter((id) => id !== result.entityId));
      hydrateCampaign(result.campaign);
      setActiveModule(moduleByKind[result.kind]);
      closeEntityModal();
    } catch (error) {
      setBootError(error instanceof Error ? error.message : "Не удалось удалить сущность.");
    } finally {
      setSaving(false);
    }
  };

  const importSelectedBestiaryMonster = async () => {
    if (!activeCampaignId || !selectedBestiaryId) {
      return;
    }

    try {
      setImportingBestiary(true);
      const result = await api.importBestiaryMonster(activeCampaignId, selectedBestiaryId);
      applyCreatedEntity(result);
      setPreviewEntityId(result.entity.id);
    } catch (error) {
      setBootError(error instanceof Error ? error.message : "Не удалось импортировать монстра из dnd.su.");
    } finally {
      setImportingBestiary(false);
    }
  };

  const combatRoster = useMemo(
    () => (campaign ? [...campaign.monsters, ...campaign.npcs].filter(isCombatProfileEntity) : []),
    [campaign]
  );
  const preparedCombatQuest =
    preparedCombatModalOpen && preparedCombatQuestId
      ? (() => {
          const entity = entityMap.get(preparedCombatQuestId);
          return entity?.kind === "quest" ? entity : null;
        })()
      : null;
  const preparedCombatEntityItems = useMemo(
    () =>
      combatRoster.filter((entity) => {
        const matchesSearch =
          !deferredPreparedCombatSearchQuery.trim() ||
          [entity.title, entity.subtitle, entity.summary, entity.tags.join(" ")]
            .join(" ")
            .toLowerCase()
            .includes(deferredPreparedCombatSearchQuery.trim().toLowerCase());
        const matchesChallenge = !preparedCombatChallenge || getEntityChallenge(entity) === preparedCombatChallenge;
        return matchesSearch && matchesChallenge;
      }),
    [combatRoster, deferredPreparedCombatSearchQuery, preparedCombatChallenge]
  );
  const preparedCombatBestiaryItems = useMemo(
    () =>
      (preparedCombatBestiary?.items ?? []).map(
        (item): CombatSearchItem => ({
          key: combatSelectionBestiaryKey(item.id),
          source: "bestiary",
          id: item.id,
          kind: "monster",
          title: item.title,
          subtitle: item.subtitle,
          summary: item.summary,
          challenge: item.challenge,
          bestiary: item
        })
      ),
    [preparedCombatBestiary]
  );
  const preparedCombatSearchItems = useMemo(
    () => [
      ...preparedCombatEntityItems.map(
        (entity): CombatSearchItem => ({
          key: combatSelectionEntityKey(entity.id),
          source: "entity",
          id: entity.id,
          kind: entity.kind,
          title: entity.title,
          subtitle: entity.subtitle,
          summary: entity.summary,
          challenge: entity.statBlock?.challenge ?? "",
          entity
        })
      ),
      ...preparedCombatBestiaryItems
    ],
    [preparedCombatBestiaryItems, preparedCombatEntityItems]
  );
  const selectedPreparedCombatSearchItem =
    preparedCombatSearchItems.find((item) => item.key === preparedCombatSelectionId) ?? preparedCombatSearchItems[0] ?? null;
  const combatEntitySearchItems = useMemo(
    () =>
      combatRoster
        .filter((entity) => {
          const matchesSearch =
            !deferredCombatSearchQuery.trim() ||
            [entity.title, entity.subtitle, entity.summary, entity.tags.join(" ")]
              .join(" ")
              .toLowerCase()
              .includes(deferredCombatSearchQuery.trim().toLowerCase());
          const matchesChallenge = !combatSearchChallenge || getEntityChallenge(entity) === combatSearchChallenge;
          return matchesSearch && matchesChallenge;
        })
        .map(
          (entity): CombatSearchItem => ({
            key: combatSelectionEntityKey(entity.id),
            source: "entity",
            id: entity.id,
            kind: entity.kind,
            title: entity.title,
            subtitle: entity.subtitle,
            summary: entity.summary,
            challenge: entity.statBlock?.challenge ?? "",
            entity
          })
        ),
    [combatRoster, combatSearchChallenge, deferredCombatSearchQuery]
  );
  const combatBestiarySearchItems = useMemo(
    () =>
      (combatBestiary?.items ?? []).map(
        (item): CombatSearchItem => ({
          key: combatSelectionBestiaryKey(item.id),
          source: "bestiary",
          id: item.id,
          kind: "monster",
          title: item.title,
          subtitle: item.subtitle,
          summary: item.summary,
          challenge: item.challenge,
          bestiary: item
        })
      ),
    [combatBestiary]
  );
  const combatSearchItems = useMemo(
    () => [...combatEntitySearchItems.slice(0, 18), ...combatBestiarySearchItems.slice(0, 24)],
    [combatBestiarySearchItems, combatEntitySearchItems]
  );
  useEffect(() => {
    if (!preparedCombatModalOpen) {
      return;
    }

    if (!preparedCombatSearchItems.some((item) => item.key === preparedCombatSelectionId)) {
      setPreparedCombatSelectionId(preparedCombatSearchItems[0]?.key ?? "");
    }
  }, [preparedCombatModalOpen, preparedCombatSearchItems, preparedCombatSelectionId]);
  useEffect(() => {
    let cancelled = false;

    if (!preparedCombatModalOpen) {
      setPreparedCombatBestiary(null);
      setPreparedCombatBestiaryLoading(false);
      return () => {
        cancelled = true;
      };
    }

    const loadPreparedCombatBestiary = async () => {
      try {
        setPreparedCombatBestiaryLoading(true);
        const result = await api.browseBestiary({
          q: deferredPreparedCombatSearchQuery.trim(),
          challenge: preparedCombatChallenge
        });
        if (cancelled) return;
        setPreparedCombatBestiary(result);
      } catch (error) {
        if (cancelled) return;
        setBootError(error instanceof Error ? error.message : "Не удалось загрузить бестиарий для заготовки боя.");
        setPreparedCombatBestiary(null);
      } finally {
        if (!cancelled) {
          setPreparedCombatBestiaryLoading(false);
        }
      }
    };

    void loadPreparedCombatBestiary();
    return () => {
      cancelled = true;
    };
  }, [deferredPreparedCombatSearchQuery, preparedCombatChallenge, preparedCombatModalOpen]);

  const activeCombat = campaign?.activeCombat ?? null;
  const campaignPreparedCombatPlayerCount = campaignPreparedCombat?.playerIds.length ?? 0;
  const effectivePartyLevels = useMemo(() => derivePartyLevels(combatPartyLevelsText), [combatPartyLevelsText]);
  const hasExplicitPartyLevels = effectivePartyLevels.length > 0;
  const effectivePartySize = hasExplicitPartyLevels
    ? effectivePartyLevels.length
    : campaignPreparedCombatPlayerCount > 0
      ? campaignPreparedCombatPlayerCount
      : combatPartySize;
  const effectiveCombatThresholds = useMemo(
    () => (hasExplicitPartyLevels ? computeEncounterThresholds(effectivePartyLevels, combatThresholds) : combatThresholds),
    [combatThresholds, effectivePartyLevels]
  );
  const combatThresholdSummary = `${effectiveCombatThresholds.easy} / ${effectiveCombatThresholds.medium} / ${effectiveCombatThresholds.hard} / ${effectiveCombatThresholds.deadly}`;
  const combatPartySummary = hasExplicitPartyLevels
    ? `Сейчас считается партия из ${effectivePartySize} ${
        effectivePartySize === 1 ? "игрока" : "игроков"
      }: ${effectivePartyLevels.join(", ")} уровни.`
    : `Уровни партии не указаны, поэтому бой будет использовать текущие пороги сложности ${combatThresholdSummary} для ${effectivePartySize} ${
        effectivePartySize === 1 ? "игрока" : "игроков"
      }.`;
  const selectedCombatSearchItem = combatSearchItems.find((item) => item.key === combatSelectionId) ?? null;
  const selectedCombatSearchProfile =
    selectedCombatSearchItem?.source === "entity"
      ? selectedCombatSearchItem.entity ?? null
      : combatSelectedBestiaryMonster?.monster ?? null;
  useEffect(() => {
    if (!combatSetupOpen) {
      return;
    }

    if (!combatSearchItems.some((item) => item.key === combatSelectionId)) {
      setCombatSelectionId(combatSearchItems[0]?.key ?? "");
    }
  }, [combatSearchItems, combatSelectionId, combatSetupOpen]);
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
      setCombatSelectionId(combatSelectionEntityKey(entityId));
      closeCombatSetupModal();
    } catch (error) {
      setBootError(error instanceof Error ? error.message : "Не удалось добавить участника в бой.");
    } finally {
      setSaving(false);
    }
  };

  const updateCampaignPreparedCombatDraft = (
    updater: (current: CampaignPreparedCombat) => CampaignPreparedCombat
  ) => {
    setCampaignPreparedCombatNotice("");
    setCampaignPreparedCombatDraft((current) => updater(current));
  };

  const toggleCampaignPreparedCombatPlayer = (playerId: string) => {
    updateCampaignPreparedCombatDraft((current) => {
      const selected = current.playerIds.includes(playerId);
      return {
        ...current,
        playerIds: selected ? current.playerIds.filter((id) => id !== playerId) : [...current.playerIds, playerId]
      };
    });
  };

  const addCampaignPreparedCombatDraftItem = async () => {
    if (!activeCampaignId) {
      return;
    }

    const selected = selectedCombatSearchItem;
    if (!selected) {
      setBootError("Сначала выбери противника, которого нужно добавить в заготовленный бой.");
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
        setCombatSelectionId(combatSelectionEntityKey(entityId));
        setPreviewEntityId(imported.entity.id);
      }

      updateCampaignPreparedCombatDraft((current) => {
        const existingIndex = current.items.findIndex((item) => item.entityId === entityId);
        if (existingIndex >= 0) {
          return {
            ...current,
            items: current.items.map((item, index) =>
              index === existingIndex ? { ...item, quantity: item.quantity + Math.max(1, combatSelectionQuantity) } : item
            )
          };
        }

        return {
          ...current,
          title: current.title?.trim() ? current.title : campaign?.title ? `${campaign.title}: бой` : current.title,
          items: [
            ...current.items,
            {
              entityId,
              quantity: Math.max(1, combatSelectionQuantity)
            }
          ]
        };
      });
    } catch (error) {
      setBootError(error instanceof Error ? error.message : "Не удалось добавить противника в заготовленный бой.");
    } finally {
      setSaving(false);
    }
  };

  const updateCampaignPreparedCombatDraftItem = (entityId: string, patch: Partial<PreparedCombatItem>) => {
    updateCampaignPreparedCombatDraft((current) => ({
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

  const removeCampaignPreparedCombatDraftItem = (entityId: string) => {
    updateCampaignPreparedCombatDraft((current) => ({
      ...current,
      items: current.items.filter((item) => item.entityId !== entityId)
    }));
  };

  const saveCampaignPreparedCombatDraft = async () => {
    if (!activeCampaignId) {
      return;
    }

    try {
      setSaving(true);
      setBootError("");
      const normalizedDraft = sanitizeCampaignPreparedCombat({
        ...campaignPreparedCombatDraft,
        playerIds: campaignPreparedCombatDraft.playerIds.filter((playerId) => entityMap.get(playerId)?.kind === "player"),
        items: campaignPreparedCombatDraft.items.filter((item) => {
          const entity = entityMap.get(item.entityId);
          return entity?.kind === "npc" || entity?.kind === "monster";
        })
      });
      const updated = await api.updateCampaign(activeCampaignId, {
        preparedCombat: normalizedDraft,
        updatePreparedCombat: true
      });
      hydrateCampaign(updated);
      const prepared = updated.preparedCombat;
      if (!prepared) {
        setCampaignPreparedCombatDraft(createEmptyCampaignPreparedCombat());
        setCampaignPreparedCombatNotice("Заготовка боя очищена.");
        return;
      }

      const totalEnemies = prepared.items.reduce((sum, item) => sum + Math.max(1, item.quantity), 0);
      setCampaignPreparedCombatDraft(cloneCampaignPreparedCombat(prepared));
      setCampaignPreparedCombatNotice(
        `Состав сохранён: ${prepared.playerIds.length} ${
          prepared.playerIds.length === 1 ? "игрок" : prepared.playerIds.length < 5 ? "игрока" : "игроков"
        } и ${totalEnemies} ${totalEnemies === 1 ? "противник" : totalEnemies < 5 ? "противника" : "противников"}.`
      );
    } catch (error) {
      setBootError(error instanceof Error ? error.message : "Не удалось сохранить заготовленный бой.");
    } finally {
      setSaving(false);
    }
  };

  const openPreparedCombatStart = () => {
    if (activeCombat?.entries.length) {
      openCombatScreen();
      return;
    }

    const plan = sanitizeCampaignPreparedCombat(campaignPreparedCombat);
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

    const entries: PreparedCombatStartEntry[] = [];
    const counts = new Map<string, number>();
    const pushEntry = (entityId: string, entityKind: CombatEntry["entityKind"], side: CombatEntry["side"], fallbackTitle: string) => {
      counts.set(entityId, (counts.get(entityId) ?? 0) + 1);
      const sequence = counts.get(entityId) ?? 1;
      entries.push({
        key: `${entityId}-${sequence}-${entries.length}`,
        entityId,
        entityKind,
        side,
        title: sequence > 1 ? `${fallbackTitle} #${sequence}` : fallbackTitle,
        initiative: 0
      });
    };

    plan.playerIds.forEach((playerId) => {
      const entity = entityMap.get(playerId);
      if (entity?.kind === "player") {
        pushEntry(entity.id, "player", "player", entity.title);
      }
    });

    plan.items.forEach((item) => {
      const entity = entityMap.get(item.entityId);
      if (entity?.kind === "npc" || entity?.kind === "monster") {
        for (let index = 0; index < Math.max(1, item.quantity); index += 1) {
          pushEntry(entity.id, entity.kind, "enemy", entity.title);
        }
      }
    });

    if (!entries.length) {
      setBootError("Не удалось собрать участников боя из сохранённой заготовки.");
      return;
    }

    setBootError("");
    setPreparedCombatStartEntries(entries);
    setPreparedCombatStartModalOpen(true);
  };

  const updatePreparedCombatStartEntry = (key: string, initiative: number) => {
    setPreparedCombatStartEntries((current) =>
      current.map((entry) => (entry.key === key ? { ...entry, initiative } : entry))
    );
  };

  const startConfiguredCombat = async () => {
    if (!activeCampaignId || !preparedCombatStartEntries.length) {
      return;
    }

    try {
      setSaving(true);
      setBootError("");
      const result = await api.startCombat(activeCampaignId, {
        title: campaignPreparedCombat?.title?.trim() || combatTitle.trim() || "Активный бой",
        partySize: effectivePartySize,
        thresholds: effectiveCombatThresholds,
        items: preparedCombatStartEntries.map((entry) => ({
          entityId: entry.entityId,
          quantity: 1,
          initiative: entry.initiative
        }))
      });
      applyCombatPayload(result);
      closePreparedCombatStartModal();
      closeCombatSetupModal();
      openCombatScreen();
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
      setBootError("Укажи уровни партии через запятую, чтобы генерация попала в нужную сложность.");
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
      applyCombatPayload(result);
      closeCombatSetupModal();
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

    if (!window.confirm("Завершить бой, очистить активную сцену и посчитать опыт по убитым целям?")) {
      return;
    }

    try {
      setSaving(true);
      const result = await api.finishCombat(activeCampaignId);
      setCombatReport(result);
      hydrateCampaign(result.campaign);
      setActiveModule("combat");
      setActiveTab("Encounter");
    } catch (error) {
      setBootError(error instanceof Error ? error.message : "Не удалось завершить бой.");
    } finally {
      setSaving(false);
    }
  };

  const previewPinned = previewEntity ? pinnedIds.includes(previewEntity.id) : false;
  const activeEntityPinned = activeEntity ? pinnedIds.includes(activeEntity.id) : false;
  const isCombatScreen = activeModule === "combat";
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
  const isBestiaryScreen = activeModule === "monsters" && activeTab !== "Imported";
  const hasActiveCombat = Boolean(activeCombat?.entries.length);
  const activeRailKey = railNavKeyFromView(activeModule, activeRailAlias);
  const activeSectionLabel = campaign ? railSectionTitle(campaign, activeModule, activeRailAlias) : "";
  const railNavItems: Array<{ key: RailNavKey; label: string; icon: RailIconName; onClick: () => void }> = [
    { key: "dashboard", label: "Главная", icon: "home", onClick: () => switchModule("dashboard") },
    { key: "quests", label: "Квесты", icon: "quest", onClick: () => switchModule("quests") },
    { key: "locations", label: "Локации", icon: "location", onClick: () => switchModule("locations") },
    { key: "players", label: "Игроки", icon: "player", onClick: () => switchModule("players") },
    { key: "npcs", label: "NPC", icon: "npc", onClick: () => switchModule("npcs") },
    { key: "monsters", label: "Монстры", icon: "monster", onClick: () => switchModule("monsters") },
    { key: "items", label: railAliasTitle.items, icon: "item", onClick: () => openRailAlias("items") },
    { key: "events", label: railAliasTitle.events, icon: "event", onClick: () => openRailAlias("events") },
    { key: "notes", label: railAliasTitle.notes, icon: "note", onClick: () => openRailAlias("notes") }
  ];
  const selectedEntityLinkTarget = entityLinkTargetId ? entityMap.get(entityLinkTargetId) ?? null : null;
  const selectedBestiarySummary = bestiary?.items.find((item) => item.id === selectedBestiaryId) ?? null;
  const importedMonsterTitles = useMemo(
    () => new Set((campaign?.monsters ?? []).map((monster) => monster.title.trim().toLowerCase())),
    [campaign?.monsters]
  );
  const selectedBestiaryImported =
    selectedBestiaryMonster?.monster.title
      ? importedMonsterTitles.has(selectedBestiaryMonster.monster.title.trim().toLowerCase())
      : false;
  const isEditingEntity = entityModalMode === "edit";
  const entityModalTitle = isEditingEntity ? "Edit Entity" : "Create Entity";
  const entityModalDescription = isEditingEntity
    ? "Измени поля, статблок и затем сохрани сущность на backend"
    : "Сгенерируй черновик, отредактируй поля и потом создай сущность в кампании";
  const entitySubmitLabel = isEditingEntity ? "Сохранить изменения" : "Создать";
  const campaignPreparedCombatDraftEnemyCount = campaignPreparedCombatDraft.items.reduce((sum, item) => sum + item.quantity, 0);
  const campaignCombatSetupView =
    campaign ? (
      <div className="combat-preparation-page">
        <section className="card section-card combat-preparation-hero">
          <div className="combat-preparation-hero-head">
            <div className="stack compact">
              <div className="row muted">
                <span>Подготовка боя</span>
                <span>Отдельный экран настройки сцены</span>
              </div>
              <h2>Собери сцену до старта</h2>
              <p className="copy">
                Выбери игроков, подбери врагов из кампании или dnd.su и сохрани заготовку. Инициативу мы спросим уже в момент
                запуска, чтобы бой стартовал быстро и без хаоса.
              </p>
            </div>

            <div className="combat-preparation-hero-actions">
              <button className="ghost" onClick={requestCombatSetupModalClose} type="button">
                К обзору боя
              </button>
              <button
                className="ghost"
                onClick={() => {
                  requestCombatSetupSwapToEntity("player");
                }}
                type="button"
              >
                Новый игрок
              </button>
              <button
                className="ghost"
                onClick={() => {
                  requestCombatSetupSwapToEntity("monster");
                }}
                type="button"
              >
                Новый монстр
              </button>
            </div>
          </div>

          <div className="combat-preparation-summary-grid">
            <article className="card mini fact-box">
              <small>Игроки в сцене</small>
              <strong className="fact-value">{campaignPreparedCombatDraft.playerIds.length}</strong>
            </article>
            <article className="card mini fact-box">
              <small>Противники в сцене</small>
              <strong className="fact-value">{campaignPreparedCombatDraftEnemyCount}</strong>
            </article>
            <article className="card mini fact-box">
              <small>Сохранённая сцена</small>
              <strong className="fact-value">{hasConfiguredCombat ? "Готова" : "Ещё нет"}</strong>
            </article>
            <article className="card mini fact-box">
              <small>Партия</small>
              <strong className="fact-value">{effectivePartySize}</strong>
            </article>
          </div>
        </section>

        {bootError ? (
          <div className="card mini form-error" role="status">
            <strong>Проблема при выполнении действия</strong>
            <p>{bootError}</p>
          </div>
        ) : null}

        {campaignPreparedCombatNotice ? (
          <div className="card mini form-success" role="status">
            <strong>Сохранено</strong>
            <p>{campaignPreparedCombatNotice}</p>
          </div>
        ) : null}

        <div className="combat-preparation-shell">
          <div className="combat-preparation-main">
            <section className="card section-card combat-party-card">
              <div className="row muted">
                <span>Сцена и партия</span>
                <span>Название сцены и уровни нужны для аккуратного старта и расчёта сложности</span>
              </div>
              <div className="form-grid">
                <label className="field field-full">
                  <span>Название боя</span>
                  <input
                    className="input"
                    onChange={(event) =>
                      updateCampaignPreparedCombatDraft((current) => ({
                        ...current,
                        title: event.target.value
                      }))
                    }
                    placeholder="Например: Засада на тракте"
                    value={campaignPreparedCombatDraft.title ?? ""}
                  />
                </label>
                <label className="field field-full">
                  <span>Уровни партии через запятую</span>
                  <input
                    className="input"
                    onChange={(event) => setCombatPartyLevelsText(event.target.value)}
                    placeholder="Например: 5, 5, 5, 5"
                    value={combatPartyLevelsText}
                  />
                </label>
              </div>
              <p className="copy combat-inline-note">{combatPartySummary}</p>
            </section>

            <section className="card section-card combat-tool-card">
              <div className="row muted">
                <span>Игроки партии</span>
                <span>Выбранные персонажи попадут в трекер инициативы со своими портретами</span>
              </div>
              {campaign.players.length ? (
                <div className="combat-player-selector-grid">
                  {campaign.players.map((player) => {
                    const selected = campaignPreparedCombatDraft.playerIds.includes(player.id);
                    return (
                      <button
                        key={`prepared-player-${player.id}`}
                        className={`card mini fill relation-card relation-card-with-visual combat-player-selector ${
                          selected ? "selected" : ""
                        }`}
                        onClick={() => toggleCampaignPreparedCombatPlayer(player.id)}
                        type="button"
                      >
                        <EntityVisual entity={player} variant="relation" />
                        <span className={badge(selected ? "success" : "default")}>{selected ? "В бою" : "Не выбран"}</span>
                        <strong>{player.title}</strong>
                        <p>{player.role || player.summary || "Персонаж партии"}</p>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <p className="copy">
                  Пока нет игроков. Создай их во вкладке `Игроки`, и потом здесь можно будет быстро включать их в бой.
                </p>
              )}
            </section>

            <section className="card section-card combat-tool-card prepared-combat-card">
              <div className="row muted">
                <span>Противники сцены</span>
                <span>Поиск идёт по кампании и dnd.su, а инициативу ты введёшь уже при старте</span>
              </div>
              <div className="form-grid combat-preparation-form-grid">
                <label className="field field-full">
                  <span>Поиск по названию</span>
                  <input
                    className="input"
                    onChange={(event) => setCombatSearchQuery(event.target.value)}
                    placeholder="Бандит, волк, giant spider, капитан..."
                    value={combatSearchQuery}
                  />
                </label>
                <label className="field">
                  <span>CR</span>
                  <select className="input" onChange={(event) => setCombatSearchChallenge(event.target.value)} value={combatSearchChallenge}>
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
              </div>

              <div className="combat-preparation-search-layout">
                <div className="stack">
                  <div className="row muted">
                    <span>НПС кампании + бестиарий dnd.su</span>
                    <span>{combatSearchItems.length} результатов</span>
                  </div>
                  <div className="combat-search-results prepared-combat-results combat-preparation-results">
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
                      <p className="copy">По текущему запросу ничего не найдено.</p>
                    )}
                  </div>
                  {combatBestiaryLoading ? <p className="copy">Подтягиваю dnd.su под текущий поиск…</p> : null}
                </div>

                <div className="stack combat-preparation-selection">
                  {selectedCombatSearchItem ? (
                    <div className="combat-selected-summary combat-preparation-selected-card">
                      <div className="row">
                        <span className={badge(selectedCombatSearchItem.source === "bestiary" ? "accent" : "default")}>
                          {selectedCombatSearchItem.source === "bestiary" ? "dnd.su" : "Кампания"}
                        </span>
                        <span className={badge("accent")}>
                          {selectedCombatSearchItem.challenge ? `CR ${extractChallengeToken(selectedCombatSearchItem.challenge)}` : "CR не указан"}
                        </span>
                      </div>
                      <strong>{selectedCombatSearchItem.title}</strong>
                      <small>
                        {selectedCombatSearchItem.source === "entity" && selectedCombatSearchItem.entity?.statBlock
                          ? `КБ ${selectedCombatSearchItem.entity.statBlock.armorClass ?? "—"} • ХП ${selectedCombatSearchItem.entity.statBlock.hitPoints ?? "—"}`
                          : selectedCombatSearchItem.subtitle || "Монстр будет импортирован в кампанию при добавлении в сцену."}
                      </small>
                      <small>{selectedCombatSearchItem.summary || "Готовый боевой профиль."}</small>
                      <button
                        className="primary"
                        disabled={saving || !combatSelectionId || !selectedCombatSearchItem}
                        onClick={() => void addCampaignPreparedCombatDraftItem()}
                        type="button"
                      >
                        {saving ? "Добавляю..." : "Добавить в сцену"}
                      </button>
                    </div>
                  ) : (
                    <div className="card mini fact-box combat-preparation-placeholder">
                      <small>Выбери цель</small>
                      <strong className="fact-value">Готово</strong>
                      <p className="copy">Нажми на противника слева, и здесь появится его сводка с кнопкой добавления.</p>
                    </div>
                  )}
                </div>
              </div>
            </section>
          </div>

          <aside className="combat-preparation-side">
            <section className="card section-card combat-preparation-side-card">
              <div className="row muted">
                <span>Текущий состав сцены</span>
                <span>
                  {campaignPreparedCombatDraft.playerIds.length} игроков • {campaignPreparedCombatDraftEnemyCount} противников
                </span>
              </div>

              {campaignPreparedCombatDraft.items.length ? (
                <div className="entry-editor-list prepared-combat-entry-list combat-preparation-entry-list">
                  {campaignPreparedCombatDraft.items.map((item) => {
                    const linked = entityMap.get(item.entityId);
                    const linkedEntity = linked && (linked.kind === "npc" || linked.kind === "monster") ? linked : null;
                    return (
                      <article key={`campaign-prepared-combat-${item.entityId}`} className="entry-editor">
                        <div className="row">
                          <strong>{linkedEntity?.title ?? "Сущность не найдена"}</strong>
                          <button className="ghost danger-action" onClick={() => removeCampaignPreparedCombatDraftItem(item.entityId)} type="button">
                            Удалить
                          </button>
                        </div>
                        <div className="form-grid combat-preparation-entry-grid">
                          <label className="field">
                            <span>Количество</span>
                            <input
                              className="input"
                              min={1}
                              onChange={(event) =>
                                updateCampaignPreparedCombatDraftItem(item.entityId, {
                                  quantity: Math.max(1, Number.parseInt(event.target.value, 10) || 1)
                                })
                              }
                              type="number"
                              value={item.quantity}
                            />
                          </label>
                          <div className="field field-full">
                            <span>Профиль</span>
                            <div className="combat-selected-summary">
                              <strong>{linkedEntity ? `${kindTitle[linkedEntity.kind]} • ${linkedEntity.title}` : item.entityId}</strong>
                              <small>
                                {linkedEntity
                                  ? `${getEntityChallenge(linkedEntity) || "CR не указан"} • ${linkedEntity.summary || linkedEntity.subtitle || "Готов к бою"}`
                                  : "Эта запись больше не найдена в кампании и будет пропущена при старте боя."}
                              </small>
                            </div>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              ) : (
                <p className="copy">Пока враги не добавлены. Выбери их слева и собери сцену так, как она должна стартовать.</p>
              )}

              <div className="combat-preparation-side-actions">
                <button className="ghost fill" onClick={requestCombatSetupModalClose} type="button">
                  Вернуться к обзору
                </button>
                <button className="primary" disabled={saving} onClick={() => void saveCampaignPreparedCombatDraft()} type="button">
                  {saving ? "Сохраняю..." : "Сохранить заготовку"}
                </button>
              </div>
            </section>
          </aside>
        </div>
      </div>
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
        onSubmit={submitLogin}
        onUsernameChange={setLoginUsername}
        password={loginPassword}
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

        {campaignModalOpen ? (
          <div className="overlay" role="presentation">
            <div className="panel palette form-modal" onClick={(event) => event.stopPropagation()} role="dialog">
              <div className="row">
                <div>
                  <p className="eyebrow">Create Campaign</p>
                  <strong>Новая кампания сохраняется сразу на localhost backend</strong>
                </div>
                <button className="ghost" onClick={requestCampaignModalClose} type="button">
                  Esc
                </button>
              </div>

              <div className="form-grid">
                <label className="field">
                  <span>Название</span>
                  <input
                    className="input"
                    onChange={(event) => setCampaignForm((current) => ({ ...current, title: event.target.value }))}
                    value={campaignForm.title}
                  />
                </label>
                <label className="field">
                  <span>Система</span>
                  <input
                    className="input"
                    onChange={(event) => setCampaignForm((current) => ({ ...current, system: event.target.value }))}
                    value={campaignForm.system}
                  />
                </label>
                <label className="field">
                  <span>Сеттинг</span>
                  <input
                    className="input"
                    onChange={(event) => setCampaignForm((current) => ({ ...current, settingName: event.target.value }))}
                    value={campaignForm.settingName}
                  />
                </label>
                <label className="field">
                  <span>Игровая дата</span>
                  <input
                    className="input"
                    onChange={(event) => setCampaignForm((current) => ({ ...current, inWorldDate: event.target.value }))}
                    value={campaignForm.inWorldDate}
                  />
                </label>
                <label className="field field-full">
                  <span>Краткое описание</span>
                  <textarea
                    className="input textarea"
                    onChange={(event) => setCampaignForm((current) => ({ ...current, summary: event.target.value }))}
                    value={campaignForm.summary}
                  />
                </label>
              </div>

              <div className="actions">
                <button className="primary" disabled={saving} onClick={() => void submitCampaign()} type="button">
                  {saving ? "Сохраняю..." : "Создать кампанию"}
                </button>
              </div>
            </div>
          </div>
        ) : null}
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
      <div className={`shell ${isCombatScreen ? "combat-layout" : ""}`} style={shellStyle}>
        {!isCombatScreen ? (
          <>
            <aside className="panel rail">
              <div className="rail-shell">
                <div className="rail-brand">
                  <span className="rail-brand-mark">
                    <RailIcon name="brand" />
                  </span>
                  <div className="rail-brand-copy">
                    <strong>Shadow Edge GM</strong>
                    <small>{authUsername}</small>
                  </div>
                </div>

                <section className="rail-group">
                  <div className="rail-group-head">
                    <p className="eyebrow">Кампания</p>
                    <button className="rail-plus-btn" onClick={openCampaignModal} title="Новая кампания" type="button">
                      +
                    </button>
                  </div>

                  <div className="rail-select-shell">
                    <select
                      className="rail-select"
                      onChange={(event) => void handleCampaignSelect(event.target.value)}
                      value={activeCampaignId}
                    >
                      {campaigns.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.title}
                        </option>
                      ))}
                    </select>
                    <span className="rail-select-chevron" aria-hidden="true">
                      <svg className="rail-icon-svg" viewBox="0 0 20 20">
                        <path d="m6 8 4 4 4-4" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
                      </svg>
                    </span>
                  </div>
                </section>

                <section className="rail-group rail-group-nav">
                  <p className="eyebrow">Навигация</p>
                  <nav className="rail-nav" aria-label="Основная навигация">
                    {railNavItems.map((item) => (
                      <button
                        key={item.key}
                        className={`rail-nav-item ${activeRailKey === item.key ? "active" : ""}`}
                        onClick={item.onClick}
                        type="button"
                      >
                        <span className="rail-nav-icon">
                          <RailIcon name={item.icon} />
                        </span>
                        <span className="rail-nav-label">{item.label}</span>
                      </button>
                    ))}
                  </nav>
                </section>

                <div className="meta rail-meta">
                  <div className="rail-meta-row">
                    <span>Мир</span>
                    <strong>{campaign.settingName}</strong>
                  </div>
                  <div className="rail-meta-row">
                    <span>Дата</span>
                    <strong>{campaign.inWorldDate}</strong>
                  </div>
                  <div className="rail-meta-row">
                    <span>Пины</span>
                    <strong>{pinnedEntities.length}</strong>
                  </div>
                  <button className="ghost rail-logout" disabled={authBusy} onClick={() => void logout()} type="button">
                    {authBusy ? "Выходим..." : "Выйти"}
                  </button>
                </div>
              </div>
            </aside>
          </>
        ) : null}

        <main className={`center ${isCombatScreen ? "combat-center" : ""}`}>
          {isCombatScreen ? (
            <header className="panel topbar combat-topbar">
              <div className="actions combat-topbar-left">
                <button className="ghost" onClick={returnToApp} type="button">
                  Вернуться в приложение
                </button>
                <div className="topbar-campaign">
                  <p className="eyebrow">Campaign</p>
                  <strong>{campaign.title}</strong>
                  <small>{campaign.inWorldDate}</small>
                </div>
              </div>

              <div className="combat-screen-title">
                <p className="eyebrow">Combat Screen</p>
                <strong>{activeCombat?.title ?? combatTitle}</strong>
                <small>
                  {hasActiveCombat
                    ? `${activeCombat?.entries.length ?? 0} участников в сцене`
                    : "Подготовка новой сцены боя"}
                </small>
              </div>

              <div className="chips">
                {hasActiveCombat ? (
                  <span className="chip active-combat-indicator">
                    Активный бой • {activeCombat?.entries.length ?? 0}
                  </span>
                ) : null}
                <button
                  className="ghost"
                  disabled={!(campaign.combatPlaylist ?? []).length}
                  onClick={() => playCombatPlaylist()}
                  type="button"
                >
                  {isCombatPlaylistActive ? "Следующий трек боя" : "Случайный трек боя"}
                </button>
                <button className="ghost" onClick={openCombatPlaylistModal} type="button">
                  Плейлист боя
                </button>
                <button className="ghost" disabled={!activeCombat?.entries.length} onClick={openInitiativeTracker} type="button">
                  Трекер
                </button>
                <button
                  className="ghost"
                  disabled={initiativeShareBusy}
                  onClick={openPublicInitiativeTracker}
                  type="button"
                >
                  {initiativeShareBusy ? "Готовлю..." : "Публичный трекер"}
                </button>
                <button
                  className="ghost"
                  disabled={initiativeShareBusy}
                  onClick={() => void copyPublicInitiativeTrackerLink()}
                  type="button"
                >
                  {initiativeShareBusy ? "Готовлю..." : "Копировать публичную ссылку"}
                </button>
                <button className="ghost" disabled={saving} onClick={() => void syncCombatPortraits()} type="button">
                  Подтянуть фотки
                </button>
                <button className="ghost" onClick={openCombatSetupModal} type="button">
                  Добавить врага
                </button>
                <button className="ghost" disabled={authBusy} onClick={() => void logout()} type="button">
                  {authBusy ? "Выходим..." : "Выйти"}
                </button>
                <button className="primary" disabled={!activeCombat || saving} onClick={() => void finishCombat()} type="button">
                  Завершить бой
                </button>
              </div>
            </header>
          ) : (
            <>
              <header className="panel topbar">
                <div className="topbar-campaign">
                  <p className="eyebrow">Campaign</p>
                  <strong>{campaign.title}</strong>
                  <small>{campaign.inWorldDate}</small>
                </div>

                <button className="search-btn" onClick={() => setPaletteOpen(true)} type="button">
                  <span>Ctrl + K</span>
                  <strong>Поиск сущностей, сцен и слухов</strong>
                </button>

                <div className="chips">
                  <button className={`ghost ${isCombatScreen ? "active" : ""}`} onClick={openCombatScreen} type="button">
                    Бой
                  </button>
                  {!isCombatScreen && activeModule !== "dashboard" && (activeEntity || (isBestiaryScreen && selectedBestiaryMonster)) ? (
                    <button className="ghost" onClick={() => openModuleDirectory(activeModule)} type="button">
                      К списку
                    </button>
                  ) : null}
                  {hasActiveCombat ? (
                    <button className="chip active-combat-indicator" onClick={openCombatScreen} type="button">
                      Активный бой • {activeCombat?.entries.length ?? 0}
                    </button>
                  ) : null}
                  {pinnedEntities.map((entity) => (
                    <button key={entity.id} className="chip" onClick={() => peekEntity(entity.id)} type="button">
                      {entity.title}
                    </button>
                  ))}
                  {activeModule === "quests" && !isCombatScreen ? (
                    <button className="ghost" onClick={openRandomEventModal} type="button">
                      Случайное событие
                    </button>
                  ) : null}
                  <button className="ghost" disabled={authBusy} onClick={() => void logout()} type="button">
                    {authBusy ? "Выходим..." : "Выйти"}
                  </button>
                  <button className="ghost" onClick={() => openEntityModal()} type="button">
                    Создать
                  </button>
                </div>
              </header>

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
                        setSelectedBestiaryId("");
                        setSelectedBestiaryMonster(null);
                      }
                      requestAnimationFrame(scrollContentToTop);
                    }}
                    type="button"
                  >
                    {tab}
                  </button>
                ))}
              </div>
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
                      Один кабинет для мира, квестов и живой сессии. Сущности открываются в центре без
                      прыжков страницы, а справа можно держать быстрый preview и закреплённые карточки.
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
              <div className="stack wide">
                {latestCombatSummary ? (
                    <section className="card section-card combat-report">
                      <div className="row muted">
                        <span>Итог последнего боя</span>
                        <span>Опыт считается только по убитым целям</span>
                      </div>
                      <div className="combat-report-grid">
                        <article className="card mini fact-box">
                          <small>Побеждено</small>
                        <strong className="fact-value">{latestCombatSummary.defeatedCount}</strong>
                        </article>
                        <article className="card mini fact-box">
                          <small>Всего опыта</small>
                        <strong className="fact-value">{latestCombatSummary.totalExperience} XP</strong>
                        </article>
                        <article className="card mini fact-box">
                          <small>На игрока</small>
                        <strong className="fact-value">{latestCombatSummary.experiencePerPlayer} XP</strong>
                        </article>
                      </div>
                    </section>
                ) : null}

                {activeCombat?.entries.length ? (
                  <CombatWorkbench
                    activeCombat={activeCombat}
                    bootError={bootError}
                    campaign={campaign}
                    combatPlayerEntityId={combatPlayerEntityId}
                    combatPlayerInitiative={combatPlayerInitiative}
                    combatPortraitNotice={combatPortraitNotice}
                    combatStateBusy={combatStateBusy}
                    currentPlaybackTrackLabel={currentPlaybackTrackLabel}
                    entityMap={entityMap}
                    initiativePublishNotice={initiativePublishNotice}
                    initiativeShareBusy={initiativeShareBusy}
                    isCombatPlaylistActive={isCombatPlaylistActive}
                    onAddManualPlayer={() => void addManualPlayerToCombat()}
                    onChangeHitPoints={updateCombatHitPoints}
                    onChangeInitiative={updateCombatInitiative}
                    onCombatPlayerEntityIdChange={setCombatPlayerEntityId}
                    onCombatPlayerInitiativeChange={setCombatPlayerInitiative}
                      onCopyPublicTracker={() => void copyPublicInitiativeTrackerLink()}
                      onDeclarePlayersVictory={() => void declarePlayersVictory()}
                      onFinishCombat={() => void finishCombat()}
                      onNextTurn={() => void nextCombatTurn()}
                    onOpenCombatPlaylistModal={openCombatPlaylistModal}
                    onOpenCombatSetupModal={openCombatSetupModal}
                    onOpenPublicTracker={openPublicInitiativeTracker}
                    onOpenRandomEventModal={openRandomEventModal}
                    onPlayCombatPlaylist={() => playCombatPlaylist()}
                    onPlayNextRandomTrack={playNextRandomTrack}
                    onSelectEntry={selectCombatEntryById}
                    onSetTurn={(entryId) => void setCombatTurn(entryId)}
                    onSyncCombatPortraits={() => void syncCombatPortraits()}
                    saving={saving}
                    selectedEntity={selectedCombatEntity}
                    selectedEntry={selectedCombatEntry}
                  />
                ) : (
                  <>
                    <PlaylistSection
                      action={
                        <button className="ghost" onClick={openCombatPlaylistModal} type="button">
                          Настроить
                        </button>
                      }
                      activeTrackLabel={currentPlaybackTrackLabel}
                      activeTrackUrl={currentPlaybackTrackUrl}
                      defaultCollapsed={!(campaign.combatPlaylist ?? []).length}
                      hint="Один общий плейлист кампании для всех старых и новых боёв"
                      isActive={isCombatPlaylistActive}
                      onNextRandom={playNextRandomTrack}
                      onPlayRandom={() => playCombatPlaylist()}
                      onPlayTrack={(index) => playCombatPlaylist(index, false)}
                      onStop={stopPlayback}
                      title="Общий боевой плейлист"
                      tracks={campaign.combatPlaylist ?? []}
                    />

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

                    {combatSetupOpen ? (
                      campaignCombatSetupView
                    ) : (
                      <section className="card section-card combat-screen-shell">
                        <div className="row muted">
                          <span>Активного боя пока нет</span>
                          <span>{hasConfiguredCombat ? "Сцена подготовлена" : "Нужна предварительная настройка"}</span>
                        </div>
                        <div className="stack">
                          <h2>Подготовь сцену перед стартом</h2>
                          <p className="copy">
                            {hasConfiguredCombat
                              ? "Состав боя уже подготовлен. Можно поправить участников и потом запустить сцену с вводом инициативы."
                              : "Сначала настрой состав боя: выбери игроков партии и добавь врагов, которых хочешь держать заготовленными для быстрого старта."}
                          </p>
                          {hasConfiguredCombat ? (
                            <div className="stack compact">
                              <div className="row muted">
                                <span>{campaignPreparedCombat?.title?.trim() || "Подготовленная сцена"}</span>
                                <span>
                                  {configuredCombatPlayers.length}{" "}
                                  {configuredCombatPlayers.length === 1 ? "игрок" : configuredCombatPlayers.length < 5 ? "игрока" : "игроков"} •{" "}
                                  {configuredCombatEnemyCount}{" "}
                                  {configuredCombatEnemyCount === 1 ? "противник" : configuredCombatEnemyCount < 5 ? "противника" : "противников"}
                                </span>
                              </div>
                              <div className="grid">
                                {configuredCombatPlayers.map((player) => (
                                  <button
                                    key={`configured-player-${player.id}`}
                                    className="card mini fill relation-card relation-card-with-visual"
                                    onClick={() => peekEntity(player.id)}
                                    type="button"
                                  >
                                    <EntityVisual entity={player} variant="relation" />
                                    <span className={badge("success")}>Игрок</span>
                                    <strong>{player.title}</strong>
                                    <p>{player.role || player.summary || "Персонаж партии"}</p>
                                  </button>
                                ))}
                                {configuredCombatEnemies.map(({ entity, quantity }) => (
                                  <button
                                    key={`configured-enemy-${entity.id}`}
                                    className="card mini fill relation-card relation-card-with-visual"
                                    onClick={() => peekEntity(entity.id)}
                                    type="button"
                                  >
                                    <EntityVisual entity={entity} variant="relation" />
                                    <span className={badge(entity.kind === "monster" ? "danger" : "accent")}>{kindTitle[entity.kind]}</span>
                                    <strong>{entity.title}</strong>
                                    <p>
                                      {quantity} шт. • {getEntityChallenge(entity) || "CR не указан"}
                                    </p>
                                  </button>
                                ))}
                              </div>
                            </div>
                          ) : null}
                          <label className="field field-full">
                            <span>Уровни партии через запятую</span>
                            <small className="field-hint">Нужны только для расчёта сложности. На сам запуск боя они не влияют.</small>
                            <input
                              className="input"
                              onChange={(event) => setCombatPartyLevelsText(event.target.value)}
                              placeholder="Например: 5, 5, 5, 5"
                              value={combatPartyLevelsText}
                            />
                          </label>
                          <p className="copy combat-inline-note">{combatPartySummary}</p>
                          <div className="actions">
                            <button className="ghost" onClick={openCombatSetupModal} type="button">
                              Настроить бой
                            </button>
                            <button className="primary" disabled={!canStartConfiguredCombat} onClick={openPreparedCombatStart} type="button">
                              Начать бой
                            </button>
                          </div>
                        </div>
                      </section>
                    )}
                  </>
                )}
              </div>
            ) : isBestiaryScreen ? (
              <div className="stack wide">
                <section className="card section-card bestiary-toolbar">
                  <div className="row muted">
                    <span>Официальный bestiary dnd.su</span>
                    <span>
                      {bestiary?.status.total ?? 0} записей • {bestiary?.status.hydrated ?? 0} в детальном кэше
                    </span>
                  </div>

                  <div className="bestiary-filter-grid">
                    <label className="field field-full">
                      <span>Поиск по названию</span>
                      <input
                        className="input"
                        onChange={(event) => setBestiarySearch(event.target.value)}
                        placeholder="Например: giant spider, дракон, нежить"
                        value={bestiarySearch}
                      />
                    </label>

                    <label className="field">
                      <span>Опасность / CR</span>
                      <select
                        className="input"
                        onChange={(event) => setBestiaryChallenge(event.target.value)}
                        value={bestiaryChallenge}
                      >
                        <option value="">Все значения</option>
                        {bestiary?.filters.challenges.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="field">
                      <span>Тип существа</span>
                      <select className="input" onChange={(event) => setBestiaryType(event.target.value)} value={bestiaryType}>
                        <option value="">Все типы</option>
                        {bestiary?.filters.types.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>

                  <div className="row muted">
                    <span>
                      {activeTab === "Catalog"
                        ? "Каталог dnd.su"
                        : activeTab === "Named NPC"
                          ? "Именные НИП из бестиария"
                          : "Карточки с пометкой «Классика»"}
                    </span>
                    <span>
                      {bestiaryLoading ? "Обновляю каталог..." : `${bestiary?.total ?? 0} результатов`}
                    </span>
                  </div>
                </section>

                {selectedBestiaryMonster ? (
                  <>
                    <section
                      className="card hero"
                      style={createHeroPanelStyle(
                        gradients.monster,
                        selectedBestiaryMonster.summary.imageUrl ?? selectedBestiaryMonster.monster.art?.url
                      )}
                    >
                      <div className="hero-head">
                        <span className="sigil big" style={{ backgroundImage: gradients.monster }}>
                          {sigil(selectedBestiaryMonster.monster.title)}
                        </span>
                        <div className="hero-copy-block">
                          <div className="hero-tags">
                            <span className={badge("accent")}>dnd.su</span>
                            {selectedBestiarySummary?.challenge ? (
                              <span className={badge()}>{selectedBestiarySummary.challenge}</span>
                            ) : null}
                            {selectedBestiarySummary?.creatureTypeLabel ? (
                              <span className={badge()}>{selectedBestiarySummary.creatureTypeLabel}</span>
                            ) : null}
                            {selectedBestiarySummary?.source ? (
                              <span className={badge()}>{selectedBestiarySummary.source}</span>
                            ) : null}
                          </div>
                          <h1>{selectedBestiaryMonster.monster.title}</h1>
                          <p className="hero-subtitle">{selectedBestiaryMonster.monster.subtitle}</p>
                          <p className="copy">{selectedBestiaryMonster.monster.summary}</p>
                        </div>
                      </div>

                      <div className="actions">
                        <button
                          className="ghost"
                          onClick={() => window.open(selectedBestiaryMonster.sourceUrl, "_blank", "noopener,noreferrer")}
                          type="button"
                        >
                          Открыть dnd.su
                        </button>
                        <button
                          className="primary"
                          disabled={importingBestiary}
                          onClick={() => void importSelectedBestiaryMonster()}
                          type="button"
                        >
                          {importingBestiary
                            ? "Импортирую..."
                            : selectedBestiaryImported
                              ? "Импортировать ещё раз"
                              : "Импортировать в кампанию"}
                        </button>
                      </div>
                    </section>

                    <div className="facts">
                      {selectedBestiaryMonster.monster.quickFacts.map((fact) => (
                        <article key={fact.label} className="card mini fact-box">
                          <small>{fact.label}</small>
                          <strong className={`fact-value ${toneClass[fact.tone ?? "default"]}`}>{fact.value}</strong>
                        </article>
                      ))}
                    </div>

                    <CombatEntityStatSheet entity={selectedBestiaryMonster.monster} />
                    <RewardSection kind="monster" rewardProfile={selectedBestiaryMonster.monster.rewardProfile} />

                    <article className="card section-card">
                      <div className="row muted">
                        <span>Описание</span>
                        <span>Подтянуто из официальной карточки dnd.su</span>
                      </div>
                      <div className="rich">
                        {selectedBestiaryMonster.monster.content
                          .split(/\n+/)
                          .filter(Boolean)
                          .map((paragraph) => (
                            <p key={paragraph}>{paragraph}</p>
                          ))}
                      </div>
                    </article>
                  </>
                ) : (
                  <section className="card section-card directory-screen">
                    <div className="directory-head">
                      <div>
                        <p className="eyebrow">Bestiary Browser</p>
                        <h2>{bestiaryDetailLoading ? "Открываю карточку..." : "Каталог монстров"}</h2>
                        <p className="copy">Сначала выбери запись из списка, а уже потом откроется полная карточка монстра.</p>
                      </div>
                      <span className={badge("accent")}>{bestiary?.total ?? 0}</span>
                    </div>

                    <div className="directory-grid">
                      {(bestiary?.items ?? []).map((item) => (
                        <button key={item.id} className="directory-card bestiary-directory-card" onClick={() => setSelectedBestiaryId(item.id)} type="button">
                          <span className="directory-card-thumb">
                            <img alt={item.title} className="directory-card-image" loading="lazy" src={createBestiaryPortraitSource(item)} />
                          </span>
                          <span className="directory-card-copy">
                            <span className="directory-card-topline">
                              <strong>{item.title}</strong>
                              <span className={badge("warning")}>{item.challenge ? `CR ${item.challenge}` : "CR ?"}</span>
                            </span>
                            <small>{item.creatureTypeLabel || item.source}</small>
                            <p>{truncateInlineText(item.summary || item.subtitle, 140)}</p>
                          </span>
                        </button>
                      ))}
                    </div>
                  </section>
                )}
              </div>
            ) : activeRailAlias === "events" ? (
              <EventsWorkspace
                draft={eventEditorDraft}
                draftId={eventEditorId}
                error={bootError}
                events={campaign.events}
                generating={randomEventGenerating}
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
                onOpenGenerator={openRandomEventModal}
                onOpenLocation={openEntity}
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
                onSearchChange={setModuleEntitySearch}
                onSelectEvent={requestWorldEventSwitch}
                saving={saving}
                searchQuery={moduleEntitySearch}
                selectedEventId={activeWorldEvent?.id ?? ""}
              />
            ) : activeModule === "lore" ? (
              <NotesWorkspace
                draftContent={noteEditorContent}
                draftId={noteEditorEntityId}
                draftTitle={noteEditorTitle}
                error={bootError}
                notice={noteEditorNotice}
                notes={campaign.lore}
                onContentChange={(value) => {
                  setNoteEditorContent(value);
                  setNoteEditorDirty(true);
                  setNoteEditorNotice("");
                }}
                onContentContextMenu={handleNoteContentContextMenu}
                onCreateNote={startNewLoreNote}
                onOpenPreview={openPreview}
                onSave={() => void saveLoreNote()}
                onSearchChange={setModuleEntitySearch}
                onSelectNote={requestLoreNoteSwitch}
                onTitleChange={(value) => {
                  setNoteEditorTitle(value);
                  setNoteEditorDirty(true);
                  setNoteEditorNotice("");
                }}
                saving={saving}
                searchQuery={moduleEntitySearch}
                selectedNoteId={activeLoreNote?.id ?? ""}
                editorRef={noteEditorContentRef}
              />
            ) : activeEntity?.kind === "quest" && activeModule === "quests" ? (
              <QuestWorkspace
                issuer={activeQuestIssuer?.kind === "npc" ? activeQuestIssuer : null}
                linkedEntities={activeQuestLinkedEntities}
                location={activeQuestLocation}
                nextQuest={nextQuest}
                onOpenDirectory={() => openModuleDirectory("quests")}
                onEdit={openEntityEditor}
                onOpenEntity={openPreview}
                onOpenPlayerView={openPlayerFacingView}
                onOpenQuest={openQuestFocus}
                onTogglePin={togglePin}
                pinned={activeEntityPinned}
                preparedCombatEntries={activeQuestPreparedCombatEntries}
                previousQuest={previousQuest}
                quest={activeEntity}
                relatedQuests={activeQuestRelatedQuests}
              />
            ) : activeEntity ? (
              <div className="stack wide">
                {activeModule === "monsters" && activeTab === "Imported" ? (
                  <section className="card section-card bestiary-toolbar">
                    <div className="row muted">
                      <span>Монстры кампании</span>
                      <span>{scopedEntities.length} результатов</span>
                    </div>

                    <div className="bestiary-filter-grid">
                      <label className="field field-full">
                        <span>Поиск по названию</span>
                        <input
                          className="input"
                          onChange={(event) => setImportedMonsterSearch(event.target.value)}
                          placeholder="Ищи монстра по имени или краткому описанию"
                          value={importedMonsterSearch}
                        />
                      </label>

                      <label className="field">
                        <span>Опасность / CR</span>
                        <select
                          className="input"
                          onChange={(event) => setImportedMonsterChallenge(event.target.value)}
                          value={importedMonsterChallenge}
                        >
                          <option value="">Все значения</option>
                          {challengeFilterOptions.map((option) => (
                            <option key={option} value={option}>
                              {`CR ${option}`}
                            </option>
                          ))}
                        </select>
                      </label>

                      <div className="field">
                        <span>Что сейчас показано</span>
                        <div className="combat-selected-summary">
                          <strong>{scopedEntities.length} монстров в выборке</strong>
                          <small>
                            Фильтруются только уже импортированные монстры кампании, чтобы удобно быстро открыть нужную карточку.
                          </small>
                        </div>
                      </div>
                    </div>
                  </section>
                ) : null}

                <section
                  className="card hero"
                  style={createHeroPanelStyle(gradients[activeEntity.kind], activeEntity.art?.url)}
                >
                  <div className="hero-head">
                    <EntityVisual entity={activeEntity} variant="hero" />
                    <div className="hero-copy-block">
                      <div className="hero-tags">
                        <span className={badge("accent")}>{kindTitle[activeEntity.kind]}</span>
                        {activeEntity.tags.map((tag) => (
                          <span key={tag} className={badge()}>
                            {tag}
                          </span>
                        ))}
                      </div>
                      <h1>{activeEntity.title}</h1>
                      <p className="hero-subtitle">{activeEntity.subtitle}</p>
                      <p className="copy">{activeEntity.summary}</p>
                    </div>
                  </div>

                  <div className="actions">
                    {activeEntity.playlist?.length ? (
                      <button className="ghost" onClick={() => playEntityPlaylist(activeEntity)} type="button">
                        {isEntityPlaylistActive(activeEntity.id) ? "Следующий трек" : "Случайный трек"}
                      </button>
                    ) : null}
                    <button className="ghost" onClick={() => openEntityEditor(activeEntity.id)} type="button">
                      Редактировать
                    </button>
                    <button className="ghost" onClick={() => togglePin(activeEntity.id)} type="button">
                      {activeEntityPinned ? "Unpin" : "Pin"}
                    </button>
                    <button className="primary" onClick={() => openPreview(activeEntity.id)} type="button">
                      Открыть в preview
                    </button>
                  </div>
                </section>

                {composeVisibleQuickFacts(activeEntity).length ? (
                  <CollapsibleSection
                    key={`${activeEntity.id}-facts`}
                    hint="Ключевые данные, которые стоит держать перед глазами"
                    summary={
                      <p className="copy">
                        {composeVisibleQuickFacts(activeEntity)
                          .slice(0, 3)
                          .map((fact) => `${fact.label}: ${fact.value}`)
                          .join(" • ")}
                      </p>
                    }
                    title="Быстрая сводка"
                  >
                    <div className="facts">
                      {composeVisibleQuickFacts(activeEntity).map((fact) => (
                        <article key={fact.label} className="card mini fact-box">
                          <small>{fact.label}</small>
                          <strong className={`fact-value ${toneClass[fact.tone ?? "default"]}`}>{fact.value}</strong>
                        </article>
                      ))}
                    </div>
                  </CollapsibleSection>
                ) : null}

                <PlaylistSection
                  action={
                    <button className="ghost" onClick={() => openEntityPlaylistModal(activeEntity)} type="button">
                      Настроить
                    </button>
                  }
                  activeTrackLabel={currentPlaybackTrackLabel}
                  activeTrackUrl={currentPlaybackTrackUrl}
                  defaultCollapsed={!(activeEntity.playlist ?? []).length}
                  hint="Запусти случайный трек для этой сцены или выбери конкретную композицию вручную"
                  isActive={isEntityPlaylistActive(activeEntity.id)}
                  onNextRandom={playNextRandomTrack}
                  onPlayRandom={() => playEntityPlaylist(activeEntity)}
                  onPlayTrack={(index) => playEntityPlaylist(activeEntity, index, false)}
                  onStop={stopPlayback}
                  title="Плейлист сцены"
                  tracks={activeEntity.playlist ?? []}
                />

                <GallerySection
                  action={
                    <button className="ghost" onClick={() => openEntityGalleryModal(activeEntity)} type="button">
                      Настроить
                    </button>
                  }
                  defaultCollapsed={!(activeEntity.gallery ?? []).length}
                  hint="Карты, письма, handout-арты и любые изображения, которые можно быстро показать игрокам"
                  items={activeEntity.gallery ?? []}
                  onCopyLink={handleCopyImageLink}
                  onOpenFullscreen={(index) => openEntityGalleryViewer(activeEntity, index)}
                  title="Галерея"
                />

                {activeEntity.kind === "quest" && activeQuestIssuer ? (
                  <CollapsibleSection
                    key={`${activeEntity.id}-issuer`}
                    action={
                      <button className="ghost" onClick={() => openPreview(activeQuestIssuer.id)} type="button">
                        Preview NPC
                      </button>
                    }
                    hint="НПС, который выдаёт, ведёт или продвигает этот квест"
                    summary={<p className="copy">{activeQuestIssuer.title}</p>}
                    title="Квестодатель"
                  >
                    <button className="card mini fill relation-card" onClick={() => peekEntity(activeQuestIssuer.id)} type="button">
                      <span className={badge("accent")}>НПС</span>
                      <strong>{activeQuestIssuer.title}</strong>
                      <p>{activeQuestIssuer.summary}</p>
                    </button>
                  </CollapsibleSection>
                ) : null}

                {activeEntity.kind === "quest" ? (
                  <CollapsibleSection
                    key={`${activeEntity.id}-prepared-combat`}
                    action={
                      <div className="row">
                        <button className="ghost" onClick={() => openPreparedCombatModal(activeEntity)} type="button">
                          Настроить
                        </button>
                        <button
                          className="primary"
                          disabled={saving || !activeQuestPreparedCombatEntries.length}
                          onClick={() => {
                            if (activeCombat?.entries.length) {
                              openCombatScreen();
                              return;
                            }
                            void startPreparedQuestCombat(activeEntity);
                          }}
                          type="button"
                        >
                          {activeCombat?.entries.length ? "Есть активный бой" : "Начать бой"}
                        </button>
                      </div>
                    }
                    hint="Состав врагов, который можно заранее собрать для этого квеста и запустить одной кнопкой"
                    summary={
                      <p className="copy">
                        {activeQuestPreparedCombatEntries.length
                          ? `${activeQuestPreparedCombatEntries.reduce((sum, item) => sum + item.quantity, 0)} противников в заготовленном бою.`
                          : "Заготовленный бой пока не настроен."}
                      </p>
                    }
                    title="Заготовленный бой"
                  >
                    {activeQuestPreparedCombatEntries.length ? (
                      <div className="stack">
                        <div className="row muted">
                          <span>{activeEntity.preparedCombat?.title?.trim() || `${activeEntity.title}: бой`}</span>
                          <span>
                            {activeQuestPreparedCombatEntries.reduce((sum, item) => sum + item.quantity, 0)} существ в сцене
                          </span>
                        </div>
                        {bootError ? (
                          <div className="card mini form-error" role="status">
                            <strong>Проблема при запуске боя</strong>
                            <p>{bootError}</p>
                          </div>
                        ) : null}
                        <label className="field field-full">
                          <span>Уровни партии через запятую</span>
                          <small className="field-hint">
                            Это общее значение для запуска боя. Например: `4,4,4,4` или `5,5,4,4,4`. Если оставить поле пустым,
                            сцена всё равно стартует, но будет использовать текущие пороги сложности.
                          </small>
                          <input
                            className="input"
                            onChange={(event) => setCombatPartyLevelsText(event.target.value)}
                            placeholder="4,4,4,4"
                            value={combatPartyLevelsText}
                          />
                        </label>
                        <p className="copy combat-inline-note">{combatPartySummary}</p>
                        {!hasExplicitPartyLevels ? (
                          <p className="copy combat-inline-note">
                            Текущие пороги: Easy {effectiveCombatThresholds.easy} • Medium {effectiveCombatThresholds.medium} • Hard{" "}
                            {effectiveCombatThresholds.hard} • Deadly {effectiveCombatThresholds.deadly}
                          </p>
                        ) : null}
                        <div className="grid">
                          {activeQuestPreparedCombatEntries.map(({ entity, quantity }) => (
                            <button
                              key={`${activeEntity.id}-prepared-${entity.id}`}
                              className="card mini fill relation-card relation-card-with-visual"
                              onClick={() => peekEntity(entity.id)}
                              type="button"
                            >
                              <EntityVisual entity={entity} variant="relation" />
                              <span className={badge(entity.kind === "monster" ? "danger" : "accent")}>
                                {kindTitle[entity.kind]}
                              </span>
                              <strong>{entity.title}</strong>
                              <p>
                                {quantity} шт. • {getEntityChallenge(entity) || "CR не указан"}
                              </p>
                            </button>
                          ))}
                        </div>
                        {activeCombat?.entries.length ? (
                          <p className="copy">
                            Сейчас уже есть активный бой. Заверши его или перейди в экран боя, чтобы не смешивать две сцены.
                          </p>
                        ) : null}
                      </div>
                    ) : (
                      <p className="copy">
                        Пока тут пусто. Открой редактирование квеста и добавь в заготовленный бой монстров или НПС, чтобы потом запускать сцену одной кнопкой.
                      </p>
                    )}
                  </CollapsibleSection>
                ) : null}

                {activeEntity.kind === "npc" ? (
                  <CollapsibleSection
                    key={`${activeEntity.id}-quests`}
                    action={
                      <button className="ghost" onClick={() => openNpcQuestModal(activeEntity)} type="button">
                        Создать квест
                      </button>
                    }
                    hint="Квесты, которые этот НПС выдаёт, сопровождает или к которым привязан"
                    summary={
                      <p className="copy">
                        {activeNpcQuests.length
                          ? `${activeNpcQuests.length} связанных квестов.`
                          : "Связанных квестов пока нет."}
                      </p>
                    }
                    title="Квесты НПС"
                  >
                    {activeNpcQuests.length ? (
                      <div className="grid">
                        {activeNpcQuests.map((quest) => (
                          <button key={quest.id} className="card mini fill relation-card relation-card-with-visual" onClick={() => peekEntity(quest.id)} type="button">
                            <EntityVisual entity={quest} variant="relation" />
                            <span className={badge("warning")}>Квест</span>
                            <strong>{quest.title}</strong>
                            <p>{quest.summary}</p>
                          </button>
                        ))}
                      </div>
                    ) : (
                      <p className="copy">
                        Пока этот НПС не привязан ни к одному квесту. Кнопка сверху сразу создаст новый квест с обратной ссылкой.
                      </p>
                    )}
                  </CollapsibleSection>
                ) : null}

                {isRewardableEntity(activeEntity) ? (
                  <RewardSection kind={activeEntity.kind} rewardProfile={activeEntity.rewardProfile} />
                ) : null}

                {activeEntity.kind === "npc" || activeEntity.kind === "quest" ? (
                  <>
                    <CollapsibleSection
                      key={`${activeEntity.id}-players`}
                      hint="Что эта сущность может открыть партии без мастерских секретов"
                      summary={
                        <p className="copy">
                          {activeEntity.playerContent?.trim()
                            ? truncateInlineText(activeEntity.playerContent, 180)
                            : "Пока нет отдельной версии для игроков. Её можно заполнить в редакторе сущности."}
                        </p>
                      }
                      title="Информация для игроков"
                    >
                      {activeEntity.playerContent?.trim() ? (
                        <div onContextMenu={(event) => handleActiveEntityContentContextMenu(activeEntity, "playerContent", event)}>
                          <RichParagraphs
                            content={activeEntity.playerContent}
                            entityByTitle={entityByTitle}
                            onMentionClick={openPreview}
                          />
                        </div>
                      ) : (
                        <p className="copy">
                          Пока не подготовлена отдельная player-facing версия. Здесь удобно хранить то, что НПС или квест реально раскрывает группе.
                        </p>
                      )}
                    </CollapsibleSection>

                    <CollapsibleSection
                      key={`${activeEntity.id}-knowledge`}
                      hint="Полная версия для мастера: правда, скрытые мотивы, связи и последствия"
                      summary={<p className="copy">{activeEntity.summary || activeEntity.content.slice(0, 180)}</p>}
                      title="Информация для мастера"
                    >
                      <div onContextMenu={(event) => handleActiveEntityContentContextMenu(activeEntity, "content", event)}>
                        <RichParagraphs
                          content={activeEntity.content}
                          entityByTitle={entityByTitle}
                          onMentionClick={openPreview}
                        />
                      </div>
                    </CollapsibleSection>
                  </>
                ) : (
                  <CollapsibleSection
                    key={`${activeEntity.id}-knowledge`}
                    hint="Главная информация по сущности"
                    summary={<p className="copy">{activeEntity.summary || activeEntity.content.slice(0, 180)}</p>}
                    title="Knowledge Page"
                  >
                    <div onContextMenu={(event) => handleActiveEntityContentContextMenu(activeEntity, "content", event)}>
                      <RichParagraphs
                        content={activeEntity.content}
                        entityByTitle={entityByTitle}
                        onMentionClick={openPreview}
                      />
                    </div>
                  </CollapsibleSection>
                )}

                <CollapsibleSection
                  key={`${activeEntity.id}-related`}
                  hint="Быстрые переходы без перегруза интерфейса"
                  summary={
                    <p className="copy">
                      {activeEntity.related.length
                        ? `${activeEntity.related.length} связанных сущностей`
                        : "Связей пока не добавлено."}
                    </p>
                  }
                  title="Связанные сущности"
                >
                  {activeEntity.related.length ? (
                    <div className="grid">
                      {activeEntity.related.map((item) => (
                        <button
                          key={`${item.id}-${item.label}`}
                          className="card mini fill relation-card relation-card-with-visual"
                          onClick={() => openRelatedEntity(item)}
                          type="button"
                        >
                          {resolveLinkedEntity(item) ? (
                            <EntityVisual entity={resolveLinkedEntity(item)!} variant="relation" />
                          ) : (
                            <span className="sigil" style={{ backgroundImage: gradients[item.kind] }}>
                              {sigil(item.label)}
                            </span>
                          )}
                          <span className={badge()}>{kindTitle[item.kind]}</span>
                          <strong>{item.label}</strong>
                          <p>{item.reason}</p>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="copy">Пока здесь пусто. Связи можно добавлять через редактор или wiki-ссылки в тексте.</p>
                  )}
                </CollapsibleSection>

                {isCombatProfileEntity(activeEntity) ? <CombatEntityStatSheet entity={activeEntity} /> : null}
              </div>
            ) : (
              <div className="stack wide">
                <section className="card section-card directory-screen">
                  <div className="directory-head">
                    <div>
                      <p className="eyebrow">{activeSectionLabel}</p>
                      <h2>Выбери запись</h2>
                      <p className="copy">Сначала показываю весь список по разделу. Когда выберешь сущность, здесь откроется её полноценная страница.</p>
                    </div>
                    <div className="actions">
                      {activeModule === "quests" ? (
                        <button className="ghost" onClick={openRandomEventModal} type="button">
                          Случайное событие
                        </button>
                      ) : null}
                      <button className="primary" onClick={() => openEntityModal(defaultCreateKind)} type="button">
                        Создать сущность
                      </button>
                    </div>
                  </div>

                  {activeModule === "monsters" && activeTab === "Imported" ? (
                    <div className="directory-toolbar directory-toolbar-wide">
                      <label className="field">
                        <span>Поиск по названию</span>
                        <input
                          className="input"
                          onChange={(event) => setImportedMonsterSearch(event.target.value)}
                          placeholder="Например: волк, паук, капитан"
                          value={importedMonsterSearch}
                        />
                      </label>
                      <label className="field">
                        <span>Опасность / CR</span>
                        <select
                          className="input"
                          onChange={(event) => setImportedMonsterChallenge(event.target.value)}
                          value={importedMonsterChallenge}
                        >
                          <option value="">Все значения</option>
                          {challengeFilterOptions.map((option) => (
                            <option key={option} value={option}>
                              {`CR ${option}`}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                  ) : (
                    <label className="field">
                      <span>Поиск</span>
                      <input
                        className="input"
                        onChange={(event) => setModuleEntitySearch(event.target.value)}
                        placeholder={`Поиск по разделу «${activeSectionLabel}»`}
                        value={moduleEntitySearch}
                      />
                    </label>
                  )}

                  {moduleDirectoryEntities.length ? (
                    <div className="directory-grid">
                      {activeModule === "quests"
                        ? moduleDirectoryEntities
                            .filter((entity): entity is QuestEntity => entity.kind === "quest")
                            .map((quest) => {
                              const location = resolveQuestLocation(quest);
                              const issuer = resolveQuestIssuer(quest);
                              const preparedEntries = resolveQuestPreparedCombatEntries(quest);
                              const preparedCombatCount = preparedEntries.reduce((sum, item) => sum + item.quantity, 0);
                              const sceneImage = resolveQuestSceneArtwork(quest, location, issuer, preparedEntries);

                              return (
                                <button key={quest.id} className="directory-card quest-directory-card" onClick={() => openQuestFocus(quest.id)} type="button">
                                  <span className="directory-card-thumb">
                                    <img alt={quest.title} className="directory-card-image" loading="lazy" src={sceneImage} />
                                  </span>
                                  <span className="directory-card-copy">
                                    <span className="directory-card-topline">
                                      <strong>{quest.title}</strong>
                                      <span className={badge(questStatusTone(quest.status))}>{quest.status}</span>
                                    </span>
                                    <small>{location?.title ?? issuer?.title ?? quest.subtitle}</small>
                                    <p>{truncateInlineText(quest.summary, 150)}</p>
                                    <span className="directory-meta">
                                      <span>{quest.urgency}</span>
                                      {preparedCombatCount ? <span>{preparedCombatCount} в бою</span> : null}
                                    </span>
                                  </span>
                                </button>
                              );
                            })
                        : moduleDirectoryEntities.map((entity) => (
                            <button key={entity.id} className="directory-card" onClick={() => openEntity(entity.id)} type="button">
                              <span className="directory-card-thumb">
                                {hasVisibleArt(entity.art) ? (
                                  <img alt={entity.title} className="directory-card-image" loading="lazy" src={createPortraitSource(entity)} />
                                ) : (
                                  <span className="sigil big" style={{ backgroundImage: gradients[entity.kind] }}>
                                    {sigil(entity.title)}
                                  </span>
                                )}
                              </span>
                              <span className="directory-card-copy">
                                <span className="directory-card-topline">
                                  <strong>{entity.title}</strong>
                                  <span className={badge()}>{kindTitle[entity.kind]}</span>
                                </span>
                                <small>{entity.subtitle}</small>
                                <p>{truncateInlineText(entity.summary, 150)}</p>
                              </span>
                            </button>
                          ))}
                    </div>
                  ) : (
                    <div className="directory-empty">
                      <h3>Ничего не найдено</h3>
                      <p className="copy">Либо в разделе пока нет записей, либо текущий поиск/фильтр ничего не дал.</p>
                    </div>
                  )}
                </section>
              </div>
            )}
          </section>
        </main>

        {!isCombatScreen ? (
          <>
        <div
          className="resize-handle preview-handle"
          onPointerDown={(event) => startResize("preview", event)}
          role="presentation"
        />

        <aside className="panel preview">
          {isBestiaryScreen && selectedBestiaryMonster ? (
            <div className="stack wide">
              <div className="row">
                <p className="eyebrow">dnd.su / Preview</p>
                <span className={badge(selectedBestiaryImported ? "success" : "default")}>
                  {selectedBestiaryImported ? "Уже в кампании" : "Ещё не импортирован"}
                </span>
              </div>

              <section
                className="preview-hero"
                style={createHeroPanelStyle(
                  gradients.monster,
                  selectedBestiaryMonster.summary.imageUrl ?? selectedBestiaryMonster.monster.art?.url
                )}
              >
                <span>Монстр</span>
                <strong>{selectedBestiaryMonster.monster.title}</strong>
                <small>{selectedBestiaryMonster.monster.subtitle}</small>
              </section>

              <p className="copy">{selectedBestiaryMonster.monster.summary}</p>
              <CombatEntityPreviewSummary entity={selectedBestiaryMonster.monster} />
              <RewardSection compact kind="monster" rewardProfile={selectedBestiaryMonster.monster.rewardProfile} />

              <div className="actions">
                <button className="ghost" onClick={() => window.open(selectedBestiaryMonster.sourceUrl, "_blank", "noopener,noreferrer")} type="button">
                  dnd.su
                </button>
                <button className="primary" disabled={importingBestiary} onClick={() => void importSelectedBestiaryMonster()} type="button">
                  {importingBestiary ? "Импорт..." : "Импорт"}
                </button>
              </div>
            </div>
          ) : isBestiaryScreen ? (
            <div className="stack">
              <p className="eyebrow">dnd.su / Preview</p>
              <h3>Выбери монстра из каталога</h3>
              <p className="copy">Когда откроешь запись слева, сюда подтянется краткая сводка и кнопка импорта в кампанию.</p>
            </div>
          ) : previewQuest ? (
            <QuestPreviewPanel
              combatPartyLevelsText={combatPartyLevelsText}
              combatPartySummary={combatPartySummary}
              effectiveCombatThresholds={effectiveCombatThresholds}
              hasActiveCombat={hasActiveCombat}
              hasExplicitPartyLevels={hasExplicitPartyLevels}
              issuer={previewQuestIssuer}
              linkedEntities={previewQuestLinkedEntities}
              location={previewQuestLocation}
              onCombatPartyLevelsChange={setCombatPartyLevelsText}
              onEdit={openEntityEditor}
              onOpenEntity={openPreview}
              onOpenGallery={openEntityGalleryModal}
              onOpenPlayerView={openPlayerFacingView}
              onOpenPlaylist={openEntityPlaylistModal}
              onOpenQuest={openQuestFocus}
              onOpenRandomEvent={openRandomEventModal}
              onRunCombat={handleQuestCombatAction}
              onTogglePin={togglePin}
              pinned={previewPinned}
              preparedCombatEntries={previewQuestPreparedCombatEntries}
              quest={previewQuest}
              relatedQuests={previewQuestRelatedQuests}
            />
          ) : previewEntity ? (
            <div className="stack wide">
              <div className="row">
                <p className="eyebrow">Peek / Preview</p>
                <button
                  className={badge(previewPinned ? "success" : "default")}
                  onClick={() => togglePin(previewEntity.id)}
                  type="button"
                >
                  {previewPinned ? "Pinned" : "Pin"}
                </button>
              </div>

              <section
                className="preview-hero"
                style={createHeroPanelStyle(gradients[previewEntity.kind], previewEntity.art?.url)}
              >
                <span>{kindTitle[previewEntity.kind]}</span>
                <strong>{previewEntity.title}</strong>
                <small>{previewEntity.subtitle}</small>
              </section>

              <p className="copy">{previewEntity.summary}</p>

              <div className="facts preview-facts">
                {composeVisibleQuickFacts(previewEntity).slice(0, 3).map((fact) => (
                  <article key={fact.label} className="card mini fact-box">
                    <small>{fact.label}</small>
                    <strong className="fact-value">{fact.value}</strong>
                  </article>
                ))}
              </div>

              {isCombatProfileEntity(previewEntity) ? <CombatEntityPreviewSummary entity={previewEntity} /> : null}
              {isRewardableEntity(previewEntity) ? (
                <RewardSection compact kind={previewEntity.kind} rewardProfile={previewEntity.rewardProfile} />
              ) : null}
              <PlaylistSection
                action={
                  <button className="ghost" onClick={() => openEntityPlaylistModal(previewEntity)} type="button">
                    Настроить
                  </button>
                }
                activeTrackLabel={currentPlaybackTrackLabel}
                activeTrackUrl={currentPlaybackTrackUrl}
                compact
                defaultCollapsed
                hint="Быстрый музыкальный запуск без ухода со страницы"
                isActive={isEntityPlaylistActive(previewEntity.id)}
                onNextRandom={playNextRandomTrack}
                onPlayRandom={() => playEntityPlaylist(previewEntity)}
                onPlayTrack={(index) => playEntityPlaylist(previewEntity, index, false)}
                onStop={stopPlayback}
                title="Плейлист"
                tracks={previewEntity.playlist ?? []}
              />

              <GallerySection
                action={
                  <button className="ghost" onClick={() => openEntityGalleryModal(previewEntity)} type="button">
                    Настроить
                  </button>
                }
                compact
                defaultCollapsed
                displayLimit={4}
                hint="Карты и handout-изображения можно открыть прямо отсюда"
                items={previewEntity.gallery ?? []}
                onCopyLink={handleCopyImageLink}
                onOpenFullscreen={(index) => openEntityGalleryViewer(previewEntity, index)}
                title="Галерея"
              />

              <div className="stack">
                {previewEntity.related.slice(0, 4).map((item) => (
                  <button key={`${item.id}-${item.label}`} className="ghost fill" onClick={() => openRelatedEntity(item)} type="button">
                    {item.label}
                  </button>
                ))}
              </div>

              <button className="primary" onClick={() => openEntity(previewEntity.id)} type="button">
                Открыть полностью
              </button>
            </div>
          ) : (
            <div className="stack">
              <p className="eyebrow">Preview</p>
              <h3>Контекст справа</h3>
              <p className="copy">Выбери запись в центре, кликни по `[[ссылке]]` или используй поиск, чтобы открыть карточку и синхронизировать preview.</p>
            </div>
          )}
        </aside>
          </>
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

      {galleryViewer ? (
        <GalleryLightbox
          onClose={requestGalleryViewerClose}
          onCopyLink={handleCopyImageLink}
          onSelect={selectGalleryViewerIndex}
          viewer={galleryViewer}
        />
      ) : null}

      {paletteOpen ? (
        <div className="overlay" role="presentation">
          <div className="panel palette" onClick={(event) => event.stopPropagation()} role="dialog">
            <div className="row">
              <div>
                <p className="eyebrow">Global Search</p>
                <strong>Открывает полную страницу сущности и сразу синхронизирует preview справа</strong>
              </div>
              <button className="ghost" onClick={requestPaletteClose} type="button">
                Esc
              </button>
            </div>

            <input
              autoFocus
              className="input"
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Лускан, Аркадий, волк, мост, руины..."
              value={query}
            />

            <div className="stack">
              {results.map((result) => (
                <div key={`${result.kind}-${result.id}`} className="palette-item">
                  <button className="ghost fill left palette-main palette-main-with-visual" onClick={() => openFromSearch(result.id)} type="button">
                    <EntityVisual
                      entity={{
                        kind: result.kind,
                        title: result.title,
                        art: entityMap.get(result.id)?.art
                      }}
                    />
                    <span className="palette-copy">
                      <span className={badge("accent")}>{kindTitle[result.kind]}</span>
                      <strong>{result.title}</strong>
                      <small>{result.subtitle}</small>
                      <p>{result.summary}</p>
                    </span>
                  </button>
                  <button
                    className="ghost palette-side"
                    onClick={() => {
                      openEntity(result.id);
                      openPreview(result.id);
                      setPaletteOpen(false);
                    }}
                    type="button"
                  >
                    Открыть
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      {campaignModalOpen ? (
        <div className="overlay" role="presentation">
          <div className="panel palette form-modal" onClick={(event) => event.stopPropagation()} role="dialog">
            <div className="row">
              <div>
                <p className="eyebrow">Create Campaign</p>
                <strong>Новая кампания сохраняется сразу на localhost backend</strong>
              </div>
              <button className="ghost" onClick={requestCampaignModalClose} type="button">
                Esc
              </button>
            </div>

            <div className="form-grid">
              <label className="field">
                <span>Название</span>
                <input
                  className="input"
                  onChange={(event) => setCampaignForm((current) => ({ ...current, title: event.target.value }))}
                  placeholder="Грань Тени"
                  value={campaignForm.title}
                />
              </label>
              <label className="field">
                <span>Система</span>
                <input
                  className="input"
                  onChange={(event) => setCampaignForm((current) => ({ ...current, system: event.target.value }))}
                  placeholder="D&D 5e"
                  value={campaignForm.system}
                />
              </label>
              <label className="field">
                <span>Сеттинг</span>
                <input
                  className="input"
                  onChange={(event) => setCampaignForm((current) => ({ ...current, settingName: event.target.value }))}
                  placeholder="Северная граница"
                  value={campaignForm.settingName}
                />
              </label>
              <label className="field">
                <span>Игровая дата</span>
                <input
                  className="input"
                  onChange={(event) => setCampaignForm((current) => ({ ...current, inWorldDate: event.target.value }))}
                  placeholder="17 Найтала, 1492 DR"
                  value={campaignForm.inWorldDate}
                />
              </label>
              <label className="field field-full">
                <span>Краткое описание</span>
                <textarea
                  className="input textarea"
                  onChange={(event) => setCampaignForm((current) => ({ ...current, summary: event.target.value }))}
                  placeholder="О чём эта кампания и какой у неё тон"
                  value={campaignForm.summary}
                />
              </label>
            </div>

            <div className="actions">
              <button className="primary" disabled={saving} onClick={() => void submitCampaign()} type="button">
                {saving ? "Сохраняю..." : "Создать кампанию"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {entityPlaylistModalOpen && entityPlaylistTarget ? (
        <div className="overlay" role="presentation">
          <div className="panel palette form-modal combat-playlist-modal" onClick={(event) => event.stopPropagation()} role="dialog">
            <div className="row">
              <div>
                <p className="eyebrow">Entity Playlist</p>
                <strong>{entityPlaylistTarget.title}</strong>
              </div>
              <button className="ghost" onClick={requestEntityPlaylistModalClose} type="button">
                Esc
              </button>
            </div>

            <PlaylistEditorSection
              hint="Точечная правка только для музыки этой сущности. Никакого полного редактора и длинной формы."
              onAdd={addEntityPlaylistDraftTrack}
              onChange={updateEntityPlaylistDraftTrack}
              onRemove={removeEntityPlaylistDraftTrack}
              title="Плейлист сцены"
              tracks={entityPlaylistDraft}
            />

            <div className="actions">
              <button className="ghost" onClick={requestEntityPlaylistModalClose} type="button">
                Отмена
              </button>
              <button className="primary" disabled={saving} onClick={() => void saveEntityPlaylist()} type="button">
                {saving ? "Сохраняю..." : "Сохранить плейлист"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {entityGalleryModalOpen && entityGalleryTarget ? (
        <div className="overlay" role="presentation">
          <div className="panel palette form-modal combat-playlist-modal" onClick={(event) => event.stopPropagation()} role="dialog">
            <div className="row">
              <div>
                <p className="eyebrow">Entity Gallery</p>
                <strong>{entityGalleryTarget.title}</strong>
              </div>
              <button className="ghost" onClick={requestEntityGalleryModalClose} type="button">
                Esc
              </button>
            </div>

            <GalleryEditorSection
              hint="Точечная правка только для карт, писем и handout-изображений этой сущности. Без полного редактора и длинной формы."
              items={entityGalleryDraft}
              onAdd={addEntityGalleryDraftItem}
              onChange={updateEntityGalleryDraftItem}
              onRemove={removeEntityGalleryDraftItem}
              title="Галерея сущности"
            />

            <div className="actions">
              <button className="ghost" onClick={requestEntityGalleryModalClose} type="button">
                Отмена
              </button>
              <button className="primary" disabled={saving} onClick={() => void saveEntityGallery()} type="button">
                {saving ? "Сохраняю..." : "Сохранить галерею"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

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
                  <span>Уровни персонажей через запятую</span>
                  <input
                    className="input"
                    onChange={(event) => setCombatPartyLevelsText(event.target.value)}
                    placeholder="Например: 5, 5, 5, 5"
                    value={combatPartyLevelsText}
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
                    Ничего не найдено. Для монстров dnd.su введи название или выбери CR, а локальные НПС и монстры фильтруются сразу.
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
                    <option value="deadly">Смертоносно</option>
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
                  : "Сначала укажи уровни партии через запятую, затем генерируй encounter."}
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

      {preparedCombatStartModalOpen ? (
        <div className="overlay" role="presentation">
          <div className="panel palette form-modal prepared-combat-modal" onClick={(event) => event.stopPropagation()} role="dialog">
            <div className="row">
              <div>
                <p className="eyebrow">Start Combat</p>
                <strong>Введи инициативу для всех участников, и бой сразу стартует</strong>
              </div>
              <button className="ghost" onClick={requestPreparedCombatStartModalClose} type="button">
                Esc
              </button>
            </div>

            <section className="card section-card prepared-combat-card">
              <div className="row muted">
                <span>{campaignPreparedCombat?.title?.trim() || "Подготовленная сцена"}</span>
                <span>{preparedCombatStartEntries.length} участников</span>
              </div>

              <div className="entry-editor-list prepared-combat-entry-list">
                {preparedCombatStartEntries.map((entry) => {
                  const linked = entityMap.get(entry.entityId);
                  const linkedEntity =
                    linked && (linked.kind === "player" || linked.kind === "npc" || linked.kind === "monster") ? linked : null;
                  return (
                    <article key={entry.key} className="entry-editor">
                      <div className="row">
                        <div className="row">
                          {linkedEntity ? <EntityVisual entity={linkedEntity} variant="relation" /> : null}
                          <div className="stack compact">
                            <span className={badge(entry.side === "player" ? "success" : entry.entityKind === "monster" ? "danger" : "accent")}>
                              {entry.side === "player" ? "Игрок" : kindTitle[entry.entityKind]}
                            </span>
                            <strong>{entry.title}</strong>
                            <small>{linkedEntity?.summary || "Инициатива сохранится в живой трекер сразу после старта."}</small>
                          </div>
                        </div>
                        <label className="field combat-start-initiative-field">
                          <span>Init</span>
                          <input
                            className="input"
                            onChange={(event) => updatePreparedCombatStartEntry(entry.key, Number.parseInt(event.target.value, 10) || 0)}
                            type="number"
                            value={entry.initiative}
                          />
                        </label>
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>

            <div className="actions">
              <button className="ghost" onClick={requestPreparedCombatStartModalClose} type="button">
                Отмена
              </button>
              <button className="primary" disabled={saving || !preparedCombatStartEntries.length} onClick={() => void startConfiguredCombat()} type="button">
                {saving ? "Запускаю..." : "Начать бой"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {entityModalOpen ? (
        <div className="overlay" role="presentation">
          <div className="panel palette form-modal" onClick={(event) => event.stopPropagation()} role="dialog">
            <div className="row">
              <div>
                <p className="eyebrow">{entityModalTitle}</p>
                <strong>{entityModalDescription}</strong>
              </div>
              <button className="ghost" onClick={requestEntityModalClose} type="button">
                Esc
              </button>
            </div>

            <div className="field field-full">
              <span>Описание для AI</span>
              <textarea
                className="input textarea"
                onChange={(event) => setDraftPrompt(event.target.value)}
                placeholder="Опиши город, НПС, монстра или квест. AI заполнит форму, а ты потом отредактируешь её вручную."
                value={draftPrompt}
              />
            </div>

            <div className="actions">
              <button className="ghost" disabled={generating || !draftPrompt.trim()} onClick={() => void generateDraft()} type="button">
                {generating ? "Генерирую..." : "Сгенерировать и заполнить"}
              </button>
            </div>

            {generating ? (
              <DndGenerationProgress
                detail="Собираю текущую форму, контекст кампании и прошу AI подготовить новый черновик сущности."
                steps={entityGenerationSteps}
                title="Пишу новый черновик"
              />
            ) : null}

            {draftNotes.length ? <p className="copy draft-notes">{draftNotes.join(" ")}</p> : null}

            <div className="form-grid">
              <label className="field">
                <span>Тип</span>
                <select
                  className="input"
                  disabled={isEditingEntity}
                  onChange={(event) => {
                    setGeneratedQuestIssuerDraft(null);
                    setGeneratedQuestIssuerNote("");
                    setEntityForm(emptyEntityForm(event.target.value as EntityKind));
                  }}
                  value={entityForm.kind}
                >
                  <option value="location">Локация</option>
                  <option value="player">Игрок</option>
                  <option value="npc">НПС</option>
                  <option value="monster">Монстр</option>
                  <option value="quest">Квест</option>
                  <option value="lore">Лор</option>
                </select>
              </label>
              <label className="field">
                <span>Название</span>
                <input
                  className="input"
                  onChange={(event) => setEntityForm((current) => ({ ...current, title: event.target.value }))}
                  value={entityForm.title}
                />
              </label>
              <label className="field">
                <span>Подзаголовок</span>
                <input
                  className="input"
                  onChange={(event) => setEntityForm((current) => ({ ...current, subtitle: event.target.value }))}
                  value={entityForm.subtitle}
                />
              </label>
              <label className="field">
                <span>Теги</span>
                <input
                  className="input"
                  onChange={(event) =>
                    setEntityForm((current) => ({
                      ...current,
                      tags: event.target.value
                        .split(",")
                        .map((tag) => tag.trim())
                        .filter(Boolean)
                    }))
                  }
                  placeholder="порт, тьма, север"
                  value={(entityForm.tags ?? []).join(", ")}
                />
              </label>
              <label className="field">
                <span>Ссылка на изображение</span>
                <input
                  className="input"
                  onChange={(event) =>
                    updateEntityForm((current) => ({
                      ...current,
                      art: {
                        ...(current.art ?? {}),
                        url: event.target.value
                      }
                    }))
                  }
                  placeholder="https://..."
                  value={entityForm.art?.url ?? ""}
                />
              </label>
              <label className="field">
                <span>Alt-текст</span>
                <input
                  className="input"
                  onChange={(event) =>
                    updateEntityForm((current) => ({
                      ...current,
                      art: {
                        ...(current.art ?? {}),
                        alt: event.target.value
                      }
                    }))
                  }
                  value={entityForm.art?.alt ?? ""}
                />
              </label>
              <label className="field field-full">
                <span>Подпись к изображению</span>
                <input
                  className="input"
                  onChange={(event) =>
                    updateEntityForm((current) => ({
                      ...current,
                      art: {
                        ...(current.art ?? {}),
                        caption: event.target.value
                      }
                    }))
                  }
                  value={entityForm.art?.caption ?? ""}
                />
              </label>

              {entityForm.kind === "player" || entityForm.kind === "npc" || entityForm.kind === "monster" ? (
                <section className="card npc-section form-subsection field-full entity-art-editor">
                  <div className="row muted">
                    <span>Превью портрета</span>
                    <span>
                      {entityForm.art?.url?.trim()
                        ? "Используется реальная ссылка на изображение"
                        : "Пока используется заглушка, но после вставки URL портрет обновится сразу"}
                    </span>
                  </div>

                  <div className="npc-top">
                    <figure className="npc-portrait-frame">
                      <img
                        alt={
                          entityForm.art?.alt ??
                          (entityForm.title || (entityForm.kind === "monster" ? "Монстр" : entityForm.kind === "player" ? "Игрок" : "НПС"))
                        }
                        className="npc-portrait"
                        src={createPortraitSource({
                          kind: entityForm.kind,
                          title: entityForm.title || (entityForm.kind === "monster" ? "Монстр" : entityForm.kind === "player" ? "Игрок" : "НПС"),
                          art: entityForm.art
                        })}
                      />
                      <figcaption>
                        {entityForm.art?.caption ??
                          (entityForm.kind === "monster"
                            ? "Для монстров из dnd.su ссылка на изображение подставится автоматически при импорте."
                            : entityForm.kind === "player"
                              ? "Портрет игрока будет виден в карточке персонажа и в трекере инициативы."
                              : "Для НПС вставь URL портрета, и он сразу появится в карточке персонажа.")}
                      </figcaption>
                    </figure>

                    <div className="npc-overview">
                      <div className="stack">
                        <div>
                          <p className="eyebrow">Изображение</p>
                          <h2>
                            {entityForm.title ||
                              (entityForm.kind === "monster" ? "Новый монстр" : entityForm.kind === "player" ? "Новый игрок" : "Новый НПС")}
                          </h2>
                          <p className="npc-type-line">
                            {entityForm.art?.url?.trim()
                              ? "Ссылка сохранится в сущности и будет видна на странице, в preview и в боевом профиле."
                              : "Можно вставить внешний URL вручную или оставить пустым до позднего редактирования."}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </section>
              ) : null}

              {entityModalMode === "create" ? (
                <div className="field field-full">
                  <PlaylistEditorSection
                    hint="Во время создания можно сразу добавить музыку сцены. Для уже существующей сущности плейлист редактируется отдельно маленькой модалкой прямо из её карточки."
                    onAdd={addEntityPlaylistTrack}
                    onChange={updateEntityPlaylistTrack}
                    onRemove={removeEntityPlaylistTrack}
                    title="Плейлист сущности"
                    tracks={entityForm.playlist ?? []}
                  />
                </div>
              ) : null}
              {entityModalMode === "create" ? (
                <div className="field field-full">
                  <GalleryEditorSection
                    hint="Во время создания можно сразу прикрепить карты, письма, handout-арты и любые другие изображения. Для существующей сущности галерея потом редактируется отдельной маленькой модалкой."
                    items={entityForm.gallery ?? []}
                    onAdd={addEntityGalleryItem}
                    onChange={updateEntityGalleryItem}
                    onRemove={removeEntityGalleryItem}
                    title="Галерея сущности"
                  />
                </div>
              ) : null}
              {entityForm.kind === "location" ? (
                <>
                  <label className="field">
                    <span>Категория</span>
                    <select
                      className="input"
                      onChange={(event) => setEntityForm((current) => ({ ...current, category: event.target.value as CreateEntityInput["category"] }))}
                      value={entityForm.category ?? "City"}
                    >
                      <option value="City">City</option>
                      <option value="Region">Region</option>
                      <option value="Dungeon">Dungeon</option>
                      <option value="POI">POI</option>
                    </select>
                  </label>
                  <label className="field">
                    <span>Регион</span>
                    <input
                      className="input"
                      onChange={(event) => setEntityForm((current) => ({ ...current, region: event.target.value }))}
                      value={entityForm.region ?? ""}
                    />
                  </label>
                  <label className="field">
                    <span>Опасность</span>
                    <select
                      className="input"
                      onChange={(event) => setEntityForm((current) => ({ ...current, danger: event.target.value as CreateEntityInput["danger"] }))}
                      value={entityForm.danger ?? "Tense"}
                    >
                      <option value="Safe">Safe</option>
                      <option value="Tense">Tense</option>
                      <option value="Dangerous">Dangerous</option>
                      <option value="Deadly">Deadly</option>
                    </select>
                  </label>
                </>
              ) : null}
              {entityForm.kind === "player" ? (
                <>
                  <label className="field">
                    <span>Роль</span>
                    <input
                      className="input"
                      onChange={(event) => setEntityForm((current) => ({ ...current, role: event.target.value }))}
                      placeholder="Например: паладин, вор, маг, лицо партии"
                      value={entityForm.role ?? ""}
                    />
                  </label>
                  <label className="field">
                    <span>Статус</span>
                    <select
                      className="input"
                      onChange={(event) => setEntityForm((current) => ({ ...current, status: event.target.value as CreateEntityInput["status"] }))}
                      value={entityForm.status ?? "Active"}
                    >
                      <option value="Active">Active</option>
                      <option value="Reserve">Reserve</option>
                      <option value="Guest">Guest</option>
                    </select>
                  </label>
                </>
              ) : null}
              {entityForm.kind === "npc" || entityForm.kind === "monster" ? (
                <>
                  <label className="field">
                    <span>Роль</span>
                    <input
                      className="input"
                      onChange={(event) => setEntityForm((current) => ({ ...current, role: event.target.value }))}
                      value={entityForm.role ?? ""}
                    />
                  </label>
                  <label className="field">
                    <span>Статус</span>
                    <select
                      className="input"
                      onChange={(event) => setEntityForm((current) => ({ ...current, status: event.target.value as CreateEntityInput["status"] }))}
                      value={entityForm.status ?? (entityForm.kind === "monster" ? "Hostile" : "Unknown")}
                    >
                      {entityForm.kind === "monster" ? (
                        <>
                          <option value="Hostile">Hostile</option>
                          <option value="Territorial">Territorial</option>
                          <option value="Summoned">Summoned</option>
                          <option value="Neutral">Neutral</option>
                        </>
                      ) : (
                        <>
                          <option value="Unknown">Unknown</option>
                          <option value="Ally">Ally</option>
                          <option value="Watcher">Watcher</option>
                          <option value="Threat">Threat</option>
                        </>
                      )}
                    </select>
                  </label>
                  <label className="field">
                    <span>Важность</span>
                    <select
                      className="input"
                      onChange={(event) => setEntityForm((current) => ({ ...current, importance: event.target.value as CreateEntityInput["importance"] }))}
                      value={entityForm.importance ?? (entityForm.kind === "monster" ? "Standard" : "Major")}
                    >
                      {entityForm.kind === "monster" ? (
                        <>
                          <option value="Minion">Minion</option>
                          <option value="Standard">Standard</option>
                          <option value="Elite">Elite</option>
                          <option value="Boss">Boss</option>
                        </>
                      ) : (
                        <>
                          <option value="Background">Background</option>
                          <option value="Major">Major</option>
                          <option value="Critical">Critical</option>
                        </>
                      )}
                    </select>
                  </label>
                  <label className="field">
                    <span>Локация</span>
                    <select
                      className="input"
                      onChange={(event) => setEntityForm((current) => ({ ...current, locationId: event.target.value || undefined }))}
                      value={entityForm.locationId ?? ""}
                    >
                      <option value="">Не привязано</option>
                      {(campaign?.locations ?? []).map((location) => (
                        <option key={location.id} value={location.id}>
                          {location.title}
                        </option>
                      ))}
                    </select>
                  </label>
                </>
              ) : null}
              {entityForm.kind === "quest" ? (
                <>
                  <label className="field">
                    <span>Статус</span>
                    <select
                      className="input"
                      onChange={(event) => setEntityForm((current) => ({ ...current, status: event.target.value as CreateEntityInput["status"] }))}
                      value={entityForm.status ?? "active"}
                    >
                      <option value="active">active</option>
                      <option value="paused">paused</option>
                      <option value="completed">completed</option>
                    </select>
                  </label>
                  <label className="field">
                    <span>Срочность</span>
                    <select
                      className="input"
                      onChange={(event) => setEntityForm((current) => ({ ...current, urgency: event.target.value as CreateEntityInput["urgency"] }))}
                      value={entityForm.urgency ?? "Medium"}
                    >
                      <option value="Low">Low</option>
                      <option value="Medium">Medium</option>
                      <option value="High">High</option>
                      <option value="Critical">Critical</option>
                    </select>
                  </label>
                  <label className="field">
                    <span>Квестодатель</span>
                    <select
                      className="input"
                      onChange={(event) => setEntityForm((current) => ({ ...current, issuerId: event.target.value || undefined }))}
                      value={entityForm.issuerId ?? ""}
                    >
                      <option value="">Не указан</option>
                      {(campaign?.npcs ?? []).map((npc) => (
                        <option key={npc.id} value={npc.id}>
                          {npc.title}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="field">
                    <span>Локация квеста</span>
                    <select
                      className="input"
                      onChange={(event) => setEntityForm((current) => ({ ...current, locationId: event.target.value || undefined }))}
                      value={entityForm.locationId ?? ""}
                    >
                      <option value="">Не указана</option>
                      {(campaign?.locations ?? []).map((location) => (
                        <option key={location.id} value={location.id}>
                          {location.title}
                        </option>
                      ))}
                    </select>
                  </label>
                  {!entityForm.issuerId && generatedQuestIssuerDraft?.kind === "npc" ? (
                    <section className="card npc-section form-subsection field-full generated-linked-draft">
                      <div className="row muted">
                        <span>AI-квестодатель</span>
                        <span>{generatedQuestIssuerNote || "Будет создан вместе с квестом"}</span>
                      </div>
                      <div className="entry-card">
                        <div className="row">
                          <strong>{generatedQuestIssuerDraft.title || "Новый НПС-квестодатель"}</strong>
                          <span className={badge("accent")}>Создастся автоматически</span>
                        </div>
                        <p className="copy">{generatedQuestIssuerDraft.summary || "AI подготовил отдельного НПС для выдачи этого квеста."}</p>
                        {generatedQuestIssuerDraft.playerContent?.trim() ? (
                          <p className="copy">
                            <strong>Игрокам:</strong> {generatedQuestIssuerDraft.playerContent}
                          </p>
                        ) : null}
                      </div>
                    </section>
                  ) : null}
                  <section className="card npc-section form-subsection field-full">
                    <div className="row muted">
                      <span>Заготовленный бой</span>
                      <span>Настраивается отдельно после сохранения квеста</span>
                    </div>
                    <p className="copy">
                      Сначала сохрани квест, потом открой его страницу и настрой заготовленный бой через отдельное меню с поиском по НПС и монстрам.
                    </p>
                  </section>
                </>
              ) : null}
              {entityForm.kind === "lore" ? (
                <>
                  <label className="field">
                    <span>Категория</span>
                    <select
                      className="input"
                      onChange={(event) => setEntityForm((current) => ({ ...current, category: event.target.value as CreateEntityInput["category"] }))}
                      value={entityForm.category ?? "History"}
                    >
                      <option value="History">History</option>
                      <option value="Rumor">Rumor</option>
                      <option value="Religion">Religion</option>
                      <option value="Threat">Threat</option>
                    </select>
                  </label>
                  <label className="field">
                    <span>Видимость</span>
                    <select
                      className="input"
                      onChange={(event) => setEntityForm((current) => ({ ...current, visibility: event.target.value as CreateEntityInput["visibility"] }))}
                      value={entityForm.visibility ?? "gm_only"}
                    >
                      <option value="gm_only">gm_only</option>
                      <option value="player_safe">player_safe</option>
                    </select>
                  </label>
                </>
              ) : null}
              <label className="field field-full">
                <span>Краткое описание</span>
                <textarea
                  className="input textarea"
                  onChange={(event) => setEntityForm((current) => ({ ...current, summary: event.target.value }))}
                  value={entityForm.summary}
                />
              </label>
              <label className="field field-full">
                <span>{entityForm.kind === "npc" || entityForm.kind === "quest" ? "Информация для мастера" : "Основной текст"}</span>
                <small className="field-hint">
                  {entityForm.kind === "npc" || entityForm.kind === "quest"
                    ? "Полная GM-версия: скрытые мотивы, правда, тайные связи, последствия и всё, что игроки пока не знают. Выдели текст и нажми правой кнопкой, чтобы привязать его к другой сущности."
                    : "Выдели текст, нажми правой кнопкой мыши и выбери `Создать ссылку`, чтобы привязать его к другой сущности."}
                </small>
                <textarea
                  className="input textarea textarea-lg"
                  onContextMenu={(event) => handleEntityContentContextMenu("content", event)}
                  onChange={(event) => setEntityForm((current) => ({ ...current, content: event.target.value }))}
                  ref={entityContentRef}
                  value={entityForm.content}
                />
              </label>
              {entityForm.kind === "npc" || entityForm.kind === "quest" ? (
                <label className="field field-full">
                  <span>Информация для игроков</span>
                  <small className="field-hint">
                    Сюда попадает то, что НПС реально расскажет, что можно услышать как слух, формулировка задания и безопасная версия правды без мастерских секретов.
                  </small>
                  <textarea
                    className="input textarea textarea-lg"
                    onContextMenu={(event) => handleEntityContentContextMenu("playerContent", event)}
                    onChange={(event) => setEntityForm((current) => ({ ...current, playerContent: event.target.value }))}
                    ref={entityPlayerContentRef}
                    value={entityForm.playerContent ?? ""}
                  />
                </label>
              ) : null}
            </div>

            {(entityForm.kind === "player" || entityForm.kind === "npc" || entityForm.kind === "monster") && entityForm.statBlock ? (
              <>
                <section className="card npc-section form-subsection">
                  <div className="row muted">
                    <span>
                      {entityForm.kind === "monster"
                        ? "Monster Stat Block"
                        : entityForm.kind === "player"
                          ? "Player Combat Profile"
                          : "NPC Stat Block"}
                    </span>
                    <span>Полное редактирование боевого профиля</span>
                  </div>

                  <div className="form-grid">
                    <label className="field">
                      <span>Размер</span>
                      <input
                        className="input"
                        onChange={(event) => updateNpcStatBlock((current) => ({ ...current, size: event.target.value }))}
                        value={entityForm.statBlock.size}
                      />
                    </label>
                    <label className="field">
                      <span>Тип существа</span>
                      <input
                        className="input"
                        onChange={(event) => updateNpcStatBlock((current) => ({ ...current, creatureType: event.target.value }))}
                        value={entityForm.statBlock.creatureType}
                      />
                    </label>
                    <label className="field">
                      <span>Мировоззрение</span>
                      <input
                        className="input"
                        onChange={(event) => updateNpcStatBlock((current) => ({ ...current, alignment: event.target.value }))}
                        value={entityForm.statBlock.alignment}
                      />
                    </label>
                    <label className="field">
                      <span>КБ</span>
                      <input
                        className="input"
                        onChange={(event) => updateNpcStatBlock((current) => ({ ...current, armorClass: event.target.value }))}
                        value={entityForm.statBlock.armorClass}
                      />
                    </label>
                    <label className="field">
                      <span>ХП</span>
                      <input
                        className="input"
                        onChange={(event) => updateNpcStatBlock((current) => ({ ...current, hitPoints: event.target.value }))}
                        value={entityForm.statBlock.hitPoints}
                      />
                    </label>
                    <label className="field">
                      <span>Скорость</span>
                      <input
                        className="input"
                        onChange={(event) => updateNpcStatBlock((current) => ({ ...current, speed: event.target.value }))}
                        value={entityForm.statBlock.speed}
                      />
                    </label>
                    <label className="field">
                      <span>Бонус мастерства</span>
                      <input
                        className="input"
                        onChange={(event) => updateNpcStatBlock((current) => ({ ...current, proficiencyBonus: event.target.value }))}
                        value={entityForm.statBlock.proficiencyBonus ?? ""}
                      />
                    </label>
                    <label className="field">
                      <span>Опасность / CR</span>
                      <input
                        className="input"
                        onChange={(event) => updateNpcStatBlock((current) => ({ ...current, challenge: event.target.value }))}
                        value={entityForm.statBlock.challenge ?? ""}
                      />
                    </label>
                    <label className="field">
                      <span>Чувства</span>
                      <input
                        className="input"
                        onChange={(event) => updateNpcStatBlock((current) => ({ ...current, senses: event.target.value }))}
                        value={entityForm.statBlock.senses ?? ""}
                      />
                    </label>
                    <label className="field">
                      <span>Языки</span>
                      <input
                        className="input"
                        onChange={(event) => updateNpcStatBlock((current) => ({ ...current, languages: event.target.value }))}
                        value={entityForm.statBlock.languages ?? ""}
                      />
                    </label>
                    <label className="field">
                      <span>Спасброски</span>
                      <input
                        className="input"
                        onChange={(event) => updateNpcStatBlock((current) => ({ ...current, savingThrows: event.target.value }))}
                        value={entityForm.statBlock.savingThrows ?? ""}
                      />
                    </label>
                    <label className="field">
                      <span>Навыки</span>
                      <input
                        className="input"
                        onChange={(event) => updateNpcStatBlock((current) => ({ ...current, skills: event.target.value }))}
                        value={entityForm.statBlock.skills ?? ""}
                      />
                    </label>
                    <label className="field">
                      <span>Сопротивления</span>
                      <input
                        className="input"
                        onChange={(event) => updateNpcStatBlock((current) => ({ ...current, resistances: event.target.value }))}
                        value={entityForm.statBlock.resistances ?? ""}
                      />
                    </label>
                    <label className="field">
                      <span>Иммунитеты</span>
                      <input
                        className="input"
                        onChange={(event) => updateNpcStatBlock((current) => ({ ...current, immunities: event.target.value }))}
                        value={entityForm.statBlock.immunities ?? ""}
                      />
                    </label>
                    <label className="field field-full">
                      <span>Иммунитеты к состояниям</span>
                      <input
                        className="input"
                        onChange={(event) =>
                          updateNpcStatBlock((current) => ({
                            ...current,
                            conditionImmunities: event.target.value
                          }))
                        }
                        value={entityForm.statBlock.conditionImmunities ?? ""}
                      />
                    </label>
                  </div>
                </section>

                <section className="card npc-section form-subsection">
                  <div className="row muted">
                    <span>Характеристики</span>
                    <span>Очки характеристик и модификаторы</span>
                  </div>

                  <div className="ability-edit-grid">
                    {abilityLabels.map(({ key, label }) => (
                      <label key={key} className="field ability-edit-card">
                        <span>{label}</span>
                        <input
                          className="input"
                          min={1}
                          onChange={(event) => updateNpcAbilityScore(key, event.target.value)}
                          type="number"
                          value={entityForm.statBlock?.abilityScores[key] ?? 10}
                        />
                      </label>
                    ))}
                  </div>
                </section>

                <section className="card npc-section form-subsection">
                  <div className="row muted">
                    <span>Магия</span>
                    <button
                      className="ghost"
                      onClick={() => setSpellcastingEnabled(!entityForm.statBlock?.spellcasting)}
                      type="button"
                    >
                      {entityForm.statBlock?.spellcasting ? "Убрать магию" : "Добавить магию"}
                    </button>
                  </div>

                  {entityForm.statBlock?.spellcasting ? (
                    <div className="stack">
                      <div className="form-grid">
                        <label className="field">
                          <span>Заголовок</span>
                          <input
                            className="input"
                            onChange={(event) => updateNpcSpellcasting((current) => ({ ...current, title: event.target.value }))}
                            value={entityForm.statBlock.spellcasting.title}
                          />
                        </label>
                        <label className="field">
                          <span>Базовая характеристика</span>
                          <input
                            className="input"
                            onChange={(event) => updateNpcSpellcasting((current) => ({ ...current, ability: event.target.value }))}
                            value={entityForm.statBlock.spellcasting.ability}
                          />
                        </label>
                        <label className="field">
                          <span>СЛ спасброска</span>
                          <input
                            className="input"
                            onChange={(event) => updateNpcSpellcasting((current) => ({ ...current, saveDc: event.target.value }))}
                            value={entityForm.statBlock.spellcasting.saveDc}
                          />
                        </label>
                        <label className="field">
                          <span>Модификатор атаки</span>
                          <input
                            className="input"
                            onChange={(event) =>
                              updateNpcSpellcasting((current) => ({ ...current, attackBonus: event.target.value }))
                            }
                            value={entityForm.statBlock.spellcasting.attackBonus}
                          />
                        </label>
                        <label className="field field-full">
                          <span>Описание магии</span>
                          <textarea
                            className="input textarea"
                            onChange={(event) =>
                              updateNpcSpellcasting((current) => ({ ...current, description: event.target.value }))
                            }
                            value={entityForm.statBlock.spellcasting.description ?? ""}
                          />
                        </label>
                        <label className="field field-full">
                          <span>Список заклинаний</span>
                          <textarea
                            className="input textarea"
                            onChange={(event) =>
                              updateNpcSpellcasting((current) => ({
                                ...current,
                                spells: event.target.value
                                  .split(/\n|,/)
                                  .map((spell) => spell.trim())
                                  .filter(Boolean)
                              }))
                            }
                            placeholder="mage hand&#10;shield&#10;misty step"
                            value={entityForm.statBlock.spellcasting.spells.join("\n")}
                          />
                        </label>
                      </div>

                      <div className="row muted">
                        <span>Ячейки заклинаний</span>
                        <button className="ghost" onClick={addSpellSlot} type="button">
                          Добавить ячейку
                        </button>
                      </div>

                      <div className="spell-slot-editor-list">
                        {(entityForm.statBlock.spellcasting.slots ?? []).map((slot, index) => (
                          <div key={`${slot.level}-${index}`} className="spell-slot-row">
                            <label className="field">
                              <span>Уровень</span>
                              <input
                                className="input"
                                onChange={(event) => updateSpellSlot(index, { level: event.target.value })}
                                value={slot.level}
                              />
                            </label>
                            <label className="field">
                              <span>Ячейки</span>
                              <input
                                className="input"
                                onChange={(event) => updateSpellSlot(index, { slots: event.target.value })}
                                value={slot.slots}
                              />
                            </label>
                            <button className="ghost danger-action slot-remove" onClick={() => removeSpellSlot(index)} type="button">
                              Удалить
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <p className="copy">У этой сущности сейчас нет секции spellcasting.</p>
                  )}
                </section>

                <StatEntryEditorSection
                  entries={entityForm.statBlock.traits}
                  hint="Пассивные особенности, ауры и правила поведения"
                  onAdd={() => addNpcStatEntry("traits")}
                  onChange={(index, patch) => updateNpcStatEntry("traits", index, patch)}
                  onRemove={(index) => removeNpcStatEntry("traits", index)}
                  title="Способности"
                />
                <StatEntryEditorSection
                  entries={entityForm.statBlock.actions}
                  hint="Удары, укусы, заклинания и основные действия"
                  onAdd={() => addNpcStatEntry("actions")}
                  onChange={(index, patch) => updateNpcStatEntry("actions", index, patch)}
                  onRemove={(index) => removeNpcStatEntry("actions", index)}
                  title="Действия"
                />
                <StatEntryEditorSection
                  entries={entityForm.statBlock.bonusActions ?? []}
                  hint="То, что тратит bonus action"
                  onAdd={() => addNpcStatEntry("bonusActions")}
                  onChange={(index, patch) => updateNpcStatEntry("bonusActions", index, patch)}
                  onRemove={(index) => removeNpcStatEntry("bonusActions", index)}
                  title="Бонусные действия"
                />
                <StatEntryEditorSection
                  entries={entityForm.statBlock.reactions ?? []}
                  hint="Ответные действия и защитные приёмы"
                  onAdd={() => addNpcStatEntry("reactions")}
                  onChange={(index, patch) => updateNpcStatEntry("reactions", index, patch)}
                  onRemove={(index) => removeNpcStatEntry("reactions", index)}
                  title="Реакции"
                />
              </>
            ) : null}

            {entityForm.kind === "npc" || entityForm.kind === "monster" || entityForm.kind === "quest" ? (
              <section className="card npc-section form-subsection">
                <div className="row muted">
                  <span>{rewardSectionLabel(entityForm.kind).title}</span>
                  <span>{rewardSectionLabel(entityForm.kind).hint}</span>
                </div>

                <div className="form-grid">
                  <label className="field field-full">
                    <span>{entityForm.kind === "quest" ? "Описание награды" : "Сводка наград и лута"}</span>
                    <textarea
                      className="input textarea"
                      onChange={(event) => updateEntityRewardProfile((current) => ({ ...current, summary: event.target.value }))}
                      placeholder={
                        entityForm.kind === "quest"
                          ? "Золото, артефакт, покровительство, доступ к локации, политическая услуга."
                          : entityForm.kind === "npc"
                            ? "Что НПС может заплатить, отдать добровольно или что можно забрать у него как трофей."
                            : "Что можно снять с монстра, сколько это стоит, какие риски и в каком состоянии находится добыча."
                      }
                      value={entityForm.rewardProfile?.summary ?? ""}
                    />
                  </label>
                </div>

                <div className="row muted">
                  <span>{entityForm.kind === "quest" ? "Список наград" : "Список добычи"}</span>
                  <button className="ghost" onClick={addMonsterLootEntry} type="button">
                    Добавить предмет
                  </button>
                </div>

                <div className="entry-editor-list">
                  {(entityForm.rewardProfile?.loot ?? []).map((entry, index) => (
                    <article key={`loot-${index}`} className="entry-editor">
                      <div className="row">
                        <strong>{entityForm.kind === "quest" ? `Награда #${index + 1}` : `Добыча #${index + 1}`}</strong>
                        <button className="ghost danger-action" onClick={() => removeMonsterLootEntry(index)} type="button">
                          Удалить
                        </button>
                      </div>

                      <div className="form-grid">
                        <label className="field">
                          <span>Название</span>
                          <input
                            className="input"
                            onChange={(event) => updateMonsterLootEntry(index, { name: event.target.value })}
                            placeholder={entityForm.kind === "quest" ? "Кошель с золотом" : "Клыки ледяного волка"}
                            value={entry.name}
                          />
                        </label>
                        <label className="field">
                          <span>Категория</span>
                          <input
                            className="input"
                            onChange={(event) => updateMonsterLootEntry(index, { category: event.target.value })}
                            placeholder={
                              entityForm.kind === "quest"
                                ? "Деньги / Артефакт / Репутация / Услуга"
                                : "Трофей / Алхимия / Оружие / Квест"
                            }
                            value={entry.category}
                          />
                        </label>
                        <label className="field">
                          <span>Количество</span>
                          <input
                            className="input"
                            onChange={(event) => updateMonsterLootEntry(index, { quantity: event.target.value })}
                            placeholder={entityForm.kind === "quest" ? "200 зм" : "2 клыка"}
                            value={entry.quantity}
                          />
                        </label>
                        <label className="field">
                          <span>Проверка</span>
                          <input
                            className="input"
                            onChange={(event) => updateMonsterLootEntry(index, { check: event.target.value })}
                            placeholder={
                              entityForm.kind === "quest"
                                ? "Убеждение, История, доступ по статусу, без проверки"
                                : "Медицина, Выживание, Воровские инструменты"
                            }
                            value={entry.check}
                          />
                        </label>
                        <label className="field">
                          <span>СЛ</span>
                          <input
                            className="input"
                            onChange={(event) => updateMonsterLootEntry(index, { dc: event.target.value })}
                            placeholder="СЛ 14"
                            value={entry.dc ?? ""}
                          />
                        </label>
                        <label className="field field-full">
                          <span>Детали</span>
                          <textarea
                            className="input textarea"
                            onChange={(event) => updateMonsterLootEntry(index, { details: event.target.value })}
                            placeholder={
                              entityForm.kind === "quest"
                                ? "Условия получения награды, кто вручает, какие есть ограничения и что меняется в мире."
                                : "Что именно получает группа, при каких условиях добыча портится и как это можно использовать."
                            }
                            value={entry.details ?? ""}
                          />
                        </label>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            ) : null}

            <div className="actions">
              {isEditingEntity ? (
                <button className="ghost danger-action" disabled={saving} onClick={() => void deleteEntity()} type="button">
                  Удалить
                </button>
              ) : null}
              <button className="primary" disabled={saving} onClick={() => void submitEntity()} type="button">
                {saving ? "Сохраняю..." : entitySubmitLabel}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {randomEventModalOpen ? (
        <div className="overlay" role="presentation">
          <div className="panel palette random-event-modal" onClick={(event) => event.stopPropagation()} role="dialog">
            <div className="stack wide">
              <div className="row">
                <div>
                  <p className="eyebrow">Событие</p>
                  <h2>Подбросить сценку</h2>
                  <p className="copy">
                    AI соберёт маленькое событие для стола: короткую сцену, реплики, пару веток разговора и конкретный
                    лут или награду.
                  </p>
                </div>
                <button className="ghost" onClick={requestRandomEventModalClose} type="button">
                  Esc
                </button>
              </div>

              <section className="card section-card random-event-card">
                <div className="form-grid">
                  <label className="field">
                    <span>Локация</span>
                    <select
                      className="input"
                      onChange={(event) => setRandomEventLocationId(event.target.value)}
                      value={randomEventLocationId}
                    >
                      <option value="">Без привязки</option>
                      {campaign?.locations.map((location) => (
                        <option key={location.id} value={location.id}>
                          {location.title}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="field">
                    <span>Тип сценки</span>
                    <select
                      className="input"
                      onChange={(event) => setRandomEventType(event.target.value as WorldEventType)}
                      value={randomEventType}
                    >
                      {worldEventTypeOptions.map((type) => (
                        <option key={type} value={type}>
                          {worldEventTypeLabels[type]}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="field field-full">
                    <span>Дополнительное пожелание</span>
                    <small className="field-hint">
                      Необязательно. Можно уточнить настроение, тему или гэг: например, «торговец ругается только матом»,
                      «маленькая стычка без смертей», «неловкое ограбление», «мрачная, но короткая сценка».
                    </small>
                    <textarea
                      className="input textarea"
                      onChange={(event) => setRandomEventPrompt(event.target.value)}
                      placeholder="Например: на рынке партии липнет торговец, который оскорбляет всех подряд, но может продать полезную наводку."
                      value={randomEventPrompt}
                    />
                  </label>
                </div>
              </section>

              {randomEventNotes.length ? <p className="copy draft-notes">{randomEventNotes.join(" ")}</p> : null}

              <div className="actions">
                <button className="ghost" onClick={requestRandomEventModalClose} type="button">
                  Отмена
                </button>
                <button className="primary" disabled={randomEventGenerating} onClick={() => void generateRandomEvent()} type="button">
                  {randomEventGenerating ? "Генерирую событие..." : "Сгенерировать событие"}
                </button>
              </div>

              {randomEventGenerating ? (
                <DndGenerationProgress
                  detail="AI собирает короткую сцену, подбирает реплики, ветки разговора и быстрый лут."
                  steps={randomEventGenerationSteps}
                  title="Тку маленькое событие"
                />
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {playerFacingEntity && (playerFacingEntity.kind === "quest" || playerFacingEntity.kind === "npc") ? (
        <PlayerFacingEntityModal entity={playerFacingEntity} onClose={requestPlayerFacingViewClose} />
      ) : null}

      {preparedCombatModalOpen && preparedCombatQuest ? (
        <div className="overlay" role="presentation">
          <div className="panel palette prepared-combat-modal" onClick={(event) => event.stopPropagation()} role="dialog">
            <div className="stack wide">
              <div className="row">
                <div>
                  <p className="eyebrow">Prepared Combat</p>
                  <h2>{preparedCombatQuest.title}</h2>
                  <p className="copy">
                    Подготовь список врагов отдельно от полного редактирования квеста: ищи по всем НПС и монстрам кампании,
                    фильтруй по CR и собирай сцену для запуска одной кнопкой.
                  </p>
                </div>
                <button className="ghost" onClick={requestPreparedCombatModalClose} type="button">
                  Esc
                </button>
              </div>

              {bootError ? (
                <div className="card mini form-error" role="status">
                  <strong>Проблема при сохранении или добавлении</strong>
                  <p>{bootError}</p>
                </div>
              ) : null}

              {preparedCombatNotice ? (
                <div className="card mini form-success" role="status">
                  <strong>Сохранено</strong>
                  <p>{preparedCombatNotice}</p>
                </div>
              ) : null}

              <section className="card section-card prepared-combat-card">
                <div className="form-grid">
                  <label className="field field-full">
                    <span>Название сцены</span>
                    <input
                      className="input"
                      onChange={(event) =>
                        updatePreparedCombatDraft((current) => ({
                          ...current,
                          title: event.target.value
                        }))
                      }
                      placeholder="Например: Засада у старого моста"
                      value={preparedCombatDraft.title ?? ""}
                    />
                  </label>

                  <label className="field field-full">
                    <span>Поиск по названию</span>
                    <input
                      className="input"
                      onChange={(event) => setPreparedCombatSearchQuery(event.target.value)}
                      placeholder="Бандит, волк, капитан, паук, сторож..."
                      value={preparedCombatSearchQuery}
                    />
                  </label>

                  <label className="field">
                    <span>CR</span>
                    <select
                      className="input"
                      onChange={(event) => setPreparedCombatChallenge(event.target.value)}
                      value={preparedCombatChallenge}
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
                      onChange={(event) => setPreparedCombatQuantity(Math.max(1, Number.parseInt(event.target.value, 10) || 1))}
                      type="number"
                      value={preparedCombatQuantity}
                    />
                  </label>

                  <div className="field">
                    <span>Добавить врага</span>
                    <button className="ghost fill" disabled={!selectedPreparedCombatSearchItem || saving} onClick={() => void addPreparedCombatDraftItem()} type="button">
                      Добавить в сцену
                    </button>
                  </div>
                </div>

                <div className="prepared-combat-layout">
                  <div className="stack">
                    <div className="row muted">
                      <span>НПС кампании + бестиарий dnd.su</span>
                      <span>{preparedCombatSearchItems.length} результатов</span>
                    </div>
                    <div className="combat-search-results prepared-combat-results">
                      {preparedCombatSearchItems.length ? (
                        preparedCombatSearchItems.map((item) => (
                          <button
                            key={item.key}
                            className={`entity-row combat-search-result ${
                              hasVisibleArt(item.source === "entity" ? item.entity?.art : undefined) || item.source === "bestiary" ? "has-thumb" : ""
                            } ${selectedPreparedCombatSearchItem?.key === item.key ? "active" : ""}`}
                            onClick={() => setPreparedCombatSelectionId(item.key)}
                            type="button"
                          >
                            {item.source === "entity" && item.entity ? (
                              <EntityVisual entity={item.entity} />
                            ) : (
                              <span className="entity-thumb-frame">
                                <img
                                  alt={item.title}
                                  className="entity-thumb"
                                  loading="lazy"
                                  src={
                                    item.bestiary
                                      ? createBestiaryPortraitSource(item.bestiary)
                                      : createPortraitSource({ kind: item.kind, title: item.title })
                                  }
                                />
                              </span>
                            )}
                            <span className="entity-row-copy">
                              <strong>{item.title}</strong>
                              <small>
                                {[
                                  item.source === "bestiary" ? "dnd.su" : item.kind === "monster" ? "Кампания • монстр" : "Кампания • НПС",
                                  item.challenge ? `CR ${extractChallengeToken(item.challenge)}` : "CR не указан",
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
                          По текущему поиску и фильтру ничего не найдено. Попробуй убрать CR-фильтр или изменить запрос.
                        </p>
                      )}
                    </div>
                    {preparedCombatBestiaryLoading ? <p className="copy">Подтягиваю полный список dnd.su под текущий фильтр…</p> : null}
                  </div>

                  <div className="stack">
                    {selectedPreparedCombatSearchItem ? (
                      <div className="combat-selected-summary">
                        <div className="row">
                          <span
                            className={badge(
                              selectedPreparedCombatSearchItem.source === "bestiary"
                                ? "accent"
                                : selectedPreparedCombatSearchItem.kind === "monster"
                                  ? "danger"
                                  : "accent"
                            )}
                          >
                            {selectedPreparedCombatSearchItem.source === "bestiary"
                              ? "dnd.su"
                              : kindTitle[selectedPreparedCombatSearchItem.kind]}
                          </span>
                          <span className={badge("accent")}>
                            {selectedPreparedCombatSearchItem.challenge
                              ? `CR ${extractChallengeToken(selectedPreparedCombatSearchItem.challenge)}`
                              : "CR не указан"}
                          </span>
                        </div>
                        <strong>{selectedPreparedCombatSearchItem.title}</strong>
                        <small>
                          {selectedPreparedCombatSearchItem.source === "entity" && selectedPreparedCombatSearchItem.entity?.statBlock
                            ? `КБ ${selectedPreparedCombatSearchItem.entity.statBlock.armorClass ?? "—"} • ХП ${selectedPreparedCombatSearchItem.entity.statBlock.hitPoints ?? "—"}`
                            : selectedPreparedCombatSearchItem.subtitle || "Монстр из dnd.su будет импортирован в кампанию при добавлении в сцену."}
                        </small>
                        <small>{selectedPreparedCombatSearchItem.summary || "Готовый боевой профиль."}</small>
                        {selectedPreparedCombatSearchItem.source === "entity" ? (
                          <button className="ghost" onClick={() => peekEntity(selectedPreparedCombatSearchItem.id)} type="button">
                            Открыть в preview
                          </button>
                        ) : null}
                      </div>
                    ) : (
                      <p className="copy">
                        Выбери НПС кампании или монстра из dnd.su слева, чтобы посмотреть краткую сводку и добавить его в заготовленный бой.
                      </p>
                    )}

                    <div className="row muted">
                      <span>Текущий состав сцены</span>
                      <span>{preparedCombatDraft.items.reduce((sum, item) => sum + item.quantity, 0)} существ</span>
                    </div>

                    {preparedCombatDraft.items.length ? (
                      <div className="entry-editor-list prepared-combat-entry-list">
                        {preparedCombatDraft.items.map((item) => {
                          const linked = entityMap.get(item.entityId);
                          const linkedEntity = linked && isCombatProfileEntity(linked) ? linked : null;
                          return (
                            <article key={`prepared-combat-draft-${item.entityId}`} className="entry-editor">
                              <div className="row">
                                <strong>{linkedEntity?.title ?? "Сущность не найдена"}</strong>
                                <button className="ghost danger-action" onClick={() => removePreparedCombatDraftItem(item.entityId)} type="button">
                                  Удалить
                                </button>
                              </div>
                              <div className="form-grid">
                                <label className="field">
                                  <span>Количество</span>
                                  <input
                                    className="input"
                                    min={1}
                                    onChange={(event) =>
                                      updatePreparedCombatDraftItem(item.entityId, {
                                        quantity: Math.max(1, Number.parseInt(event.target.value, 10) || 1)
                                      })
                                    }
                                    type="number"
                                    value={item.quantity}
                                  />
                                </label>
                                <div className="field">
                                  <span>Профиль</span>
                                  <div className="combat-selected-summary">
                                    <strong>{linkedEntity ? `${kindTitle[linkedEntity.kind]} • ${linkedEntity.title}` : item.entityId}</strong>
                                    <small>
                                      {linkedEntity
                                        ? `${getEntityChallenge(linkedEntity) || "CR не указан"} • ${linkedEntity.summary || linkedEntity.subtitle || "Готов к бою"}`
                                        : "Эта запись больше не найдена в кампании и будет пропущена при старте боя."}
                                    </small>
                                  </div>
                                </div>
                              </div>
                            </article>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="copy">
                        Пока враги не добавлены. Выбери подходящих НПС или монстров слева и собери сцену так, как она должна стартовать в квесте.
                      </p>
                    )}
                  </div>
                </div>
              </section>

              <div className="actions">
                <button className="ghost" onClick={requestPreparedCombatModalClose} type="button">
                  Отмена
                </button>
                <button className="primary" disabled={saving} onClick={() => void savePreparedCombatDraft()} type="button">
                  {saving ? "Сохраняю..." : "Сохранить бой"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {entityLinkMenuOpen && entityLinkSelection ? (
        <div
          className="link-context-backdrop"
          onClick={() => {
            setEntityLinkSelection(null);
            closeEntityLinkContextMenu();
          }}
          role="presentation"
        >
          <div
            className="link-context-menu"
            onClick={(event) => event.stopPropagation()}
            role="menu"
            style={{ left: entityLinkSelection.x, top: entityLinkSelection.y }}
          >
            <button className="ghost fill" onClick={openEntityLinkModal} type="button">
              Создать ссылку
            </button>
          </div>
        </div>
      ) : null}

      {entityLinkModalOpen ? (
        <div className="link-picker-backdrop" role="presentation">
          <div className="panel link-picker-modal" onClick={(event) => event.stopPropagation()} role="dialog">
            <div className="row">
              <div>
                <p className="eyebrow">Create Hyperlink</p>
                <strong>Выбери сущность, на которую будет вести выделенный текст</strong>
              </div>
              <button className="ghost" onClick={requestEntityLinkModalClose} type="button">
                Esc
              </button>
            </div>

            <div className="field field-full">
              <span>Искать сущность</span>
              <input
                className="input"
                onChange={(event) => setEntityLinkQuery(event.target.value)}
                placeholder="Начни вводить название локации, НПС, квеста или лора"
                value={entityLinkQuery}
              />
            </div>

            <div className="link-picker-selection">
              <small>Выделенный текст</small>
              <strong>{entityLinkSelection?.text.trim()}</strong>
            </div>

            <div className="link-picker-results">
              {linkableEntities.length ? (
                linkableEntities.slice(0, 12).map((entity) => (
                  <button
                    key={entity.id}
                    className={`entity-row ${hasVisibleArt(entity.art) ? "has-thumb" : ""} ${entityLinkTargetId === entity.id ? "active" : ""}`}
                    onClick={() => setEntityLinkTargetId(entity.id)}
                    type="button"
                  >
                    <EntityVisual entity={entity} />
                    <span className="entity-row-copy">
                      <strong>{entity.title}</strong>
                      <small>{kindTitle[entity.kind]} • {entity.subtitle}</small>
                    </span>
                  </button>
                ))
              ) : (
                <p className="copy">По текущему запросу сущности не нашлись.</p>
              )}
            </div>

            {selectedEntityLinkTarget ? (
              <div className="link-picker-selection">
                <small>Ссылка будет вести на</small>
                <strong>{selectedEntityLinkTarget.title}</strong>
              </div>
            ) : null}

            <div className="actions">
                <button className="ghost" onClick={requestEntityLinkModalClose} type="button">
                  Отмена
                </button>
              <button className="primary" disabled={!entityLinkTargetId} onClick={insertEntityLinkIntoContent} type="button">
                Сохранить ссылку
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {closeConfirmState ? (
        <div className="overlay" role="presentation">
          <div className="panel palette close-confirm-modal" aria-modal="true" onClick={(event) => event.stopPropagation()} role="alertdialog">
            <div className="stack wide">
              <div className="row">
                <div>
                  <p className="eyebrow">Confirm Close</p>
                  <strong>{closeConfirmState.title}</strong>
                </div>
              </div>

              <p className="copy">{closeConfirmState.description}</p>

              <div className="actions">
                <button className="ghost" onClick={cancelModalCloseRequest} type="button">
                  Продолжить редактирование
                </button>
                <button className="ghost danger-action" onClick={confirmModalCloseRequest} type="button">
                  {closeConfirmState.confirmLabel}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

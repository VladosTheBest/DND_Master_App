import type {
  AbilityScores,
  CampaignData,
  CreateEntityInput,
  EntityKind,
  GalleryImage,
  KnowledgeEntity,
  MonsterLootEntry,
  MonsterRewardProfile,
  ModuleId,
  NpcStatBlock,
  PreparedCombatPlan,
  PlaylistTrack,
  SpellSlotSummary,
  SpellcastingBlock,
  StatBlockEntry
} from "@shadow-edge/shared-types";
import { isRewardableEntity, truncateInlineText } from "../../app-shared";
import type { CombatProfileEntity } from "./entity.types";

export const acceptedImageUploadTypes = "image/png,image/jpeg,image/webp,image/gif";
export const acceptedPlayerFacingHtmlUploadTypes = ".html,.htm,text/html";

export const createEmptyStatEntry = (): StatBlockEntry => ({
  name: "",
  subtitle: "",
  toHit: "",
  damage: "",
  saveDc: "",
  description: ""
});

export const createEmptySpellSlot = (): SpellSlotSummary => ({
  level: "1st",
  slots: "2"
});

export const createEmptyPlaylistTrack = (): PlaylistTrack => ({
  title: "",
  url: ""
});

export const createEmptyGalleryImage = (): GalleryImage => ({
  title: "",
  url: "",
  caption: ""
});

export const createEmptyPreparedCombatPlan = (title = ""): PreparedCombatPlan => ({
  title,
  partyLevel: undefined,
  playerIds: [],
  allies: [],
  items: []
});

export const imageTitleFromFileName = (fileName: string) => {
  const trimmed = fileName.trim();
  if (!trimmed) {
    return "";
  }

  const extensionStart = trimmed.lastIndexOf(".");
  return extensionStart > 0 ? trimmed.slice(0, extensionStart) : trimmed;
};

export const createEmptySpellcasting = (): SpellcastingBlock => ({
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

export const createEmptyMonsterLootEntry = (): MonsterLootEntry => ({
  name: "",
  category: "Лут",
  quantity: "",
  check: "",
  dc: "",
  details: ""
});

export const createEmptyMonsterRewardProfile = (): MonsterRewardProfile => ({
  summary: "",
  loot: [createEmptyMonsterLootEntry()]
});

export const createEmptyNpcStatBlock = (): NpcStatBlock => ({
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

export const clonePlaylistTracks = (tracks?: PlaylistTrack[]): PlaylistTrack[] | undefined =>
  tracks ? tracks.map((track) => ({ ...track })) : undefined;

export const cloneGalleryImages = (items?: GalleryImage[]): GalleryImage[] | undefined =>
  items ? items.map((item) => ({ ...item })) : undefined;

export const emptyEntityForm = (kind: EntityKind = "location"): CreateEntityInput => ({
  kind,
  title: "",
  subtitle: "",
  summary: "",
  content: "",
  playerContent: "",
  playerCards: [],
  tags: [],
  playlist: [],
  gallery: [],
  category: kind === "location" ? "City" : kind === "lore" ? "History" : undefined,
  region: kind === "location" ? "" : undefined,
  danger: kind === "location" ? "Tense" : undefined,
  role: kind === "player" || kind === "npc" || kind === "monster" ? "" : undefined,
  level: undefined,
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
  preparedCombat: kind === "quest" || kind === "location" ? createEmptyPreparedCombatPlan() : undefined,
  preparedCombats: kind === "quest" || kind === "location" ? [] : undefined,
  visibility: kind === "lore" ? "gm_only" : undefined,
});

const moduleEntities = (campaign: CampaignData, moduleId: ModuleId) => {
  if (moduleId === "locations") return campaign.locations;
  if (moduleId === "players") return campaign.players;
  if (moduleId === "npcs") return campaign.npcs;
  if (moduleId === "monsters") return campaign.monsters;
  if (moduleId === "quests") return campaign.quests;
  if (moduleId === "lore") return campaign.lore;
  return [];
};

export const isCombatProfileEntity = (entity: KnowledgeEntity | null): entity is CombatProfileEntity =>
  Boolean(entity && (entity.kind === "player" || entity.kind === "npc" || entity.kind === "monster"));

export const composeVisibleQuickFacts = (entity: KnowledgeEntity) => {
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

export const filterEntities = (
  campaign: CampaignData | null,
  activeModule: ModuleId,
  activeTab: string
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
      return (
        activeTab === "Imported" ||
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

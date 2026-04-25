export type ModuleId = "dashboard" | "locations" | "players" | "npcs" | "monsters" | "combat" | "quests" | "lore";
export type EntityKind = "location" | "player" | "npc" | "monster" | "quest" | "lore";
export type QuickFactTone = "default" | "accent" | "success" | "warning" | "danger";
export type AbilityKey = "str" | "dex" | "con" | "int" | "wis" | "cha";
export type CombatDifficulty = "easy" | "medium" | "hard" | "deadly" | "custom";

export interface AppModule {
  id: ModuleId;
  label: string;
  hint: string;
}

export interface QuickFact {
  label: string;
  value: string;
  tone?: QuickFactTone;
}

export interface RelatedEntity {
  id: string;
  kind: EntityKind;
  label: string;
  reason: string;
}

export interface PreparedCombatItem {
  entityId: string;
  quantity: number;
}

export interface PreparedCombatPlan {
  title?: string;
  items: PreparedCombatItem[];
}

export interface CampaignPreparedCombat {
  title?: string;
  playerIds: string[];
  items: PreparedCombatItem[];
}

export interface HeroArt {
  url?: string;
  alt?: string;
  caption?: string;
}

export interface PlaylistTrack {
  title: string;
  url: string;
}

export interface GalleryImage {
  title: string;
  url: string;
  caption?: string;
}

export interface PlayerFacingCard {
  title: string;
  content: string;
  contentHtml?: string;
}

export interface KnowledgeEntityBase {
  id: string;
  kind: EntityKind;
  title: string;
  subtitle: string;
  summary: string;
  content: string;
  playerContent?: string;
  playerCards?: PlayerFacingCard[];
  tags: string[];
  quickFacts: QuickFact[];
  related: RelatedEntity[];
  art?: HeroArt;
  playlist?: PlaylistTrack[];
  gallery?: GalleryImage[];
}

export interface LocationEntity extends KnowledgeEntityBase {
  kind: "location";
  category: "City" | "Region" | "Dungeon" | "POI";
  region: string;
  danger: "Safe" | "Tense" | "Dangerous" | "Deadly";
  parentId?: string;
}

export interface AbilityScores {
  str: number;
  dex: number;
  con: number;
  int: number;
  wis: number;
  cha: number;
}

export interface StatBlockEntry {
  name: string;
  subtitle?: string;
  toHit?: string;
  damage?: string;
  saveDc?: string;
  description: string;
}

export interface SpellSlotSummary {
  level: string;
  slots: string;
}

export interface SpellcastingBlock {
  title: string;
  ability: string;
  saveDc: string;
  attackBonus: string;
  slots?: SpellSlotSummary[];
  spells: string[];
  description?: string;
}

export interface NpcStatBlock {
  size: string;
  creatureType: string;
  alignment: string;
  armorClass: string;
  hitPoints: string;
  speed: string;
  proficiencyBonus?: string;
  challenge?: string;
  senses?: string;
  languages?: string;
  savingThrows?: string;
  skills?: string;
  resistances?: string;
  immunities?: string;
  conditionImmunities?: string;
  abilityScores: AbilityScores;
  traits: StatBlockEntry[];
  actions: StatBlockEntry[];
  bonusActions?: StatBlockEntry[];
  reactions?: StatBlockEntry[];
  spellcasting?: SpellcastingBlock | null;
}

export interface NpcEntity extends KnowledgeEntityBase {
  kind: "npc";
  role: string;
  status: "Ally" | "Watcher" | "Threat" | "Unknown";
  importance: "Background" | "Major" | "Critical";
  locationId?: string;
  statBlock?: NpcStatBlock;
  rewardProfile?: RewardProfile;
}

export interface RewardLootEntry {
  name: string;
  category: string;
  quantity: string;
  check: string;
  dc?: string;
  details?: string;
}

export interface RewardProfile {
  summary: string;
  loot: RewardLootEntry[];
}

export type MonsterLootEntry = RewardLootEntry;
export type MonsterRewardProfile = RewardProfile;

export interface BestiaryFilterOption {
  value: string;
  label: string;
  count?: number;
}

export interface BestiarySyncStatus {
  state: "idle" | "syncing" | "ready" | "error";
  total: number;
  hydrated: number;
  lastError?: string;
  lastStartedAt?: string;
  lastFinishedAt?: string;
  updatedAt?: string;
}

export interface MonsterEntity extends KnowledgeEntityBase {
  kind: "monster";
  role: string;
  status: "Hostile" | "Territorial" | "Summoned" | "Neutral";
  importance: "Minion" | "Standard" | "Elite" | "Boss";
  locationId?: string;
  statBlock?: NpcStatBlock;
  rewardProfile?: RewardProfile;
}

export interface PlayerEntity extends KnowledgeEntityBase {
  kind: "player";
  role: string;
  status: "Active" | "Reserve" | "Guest";
  statBlock?: NpcStatBlock;
}

export interface BestiaryMonsterSummary {
  id: string;
  remoteId: string;
  slug: string;
  title: string;
  englishTitle?: string;
  subtitle: string;
  summary: string;
  challenge: string;
  creatureType: string;
  creatureTypeLabel: string;
  size: string;
  source: string;
  url: string;
  namedNpc: boolean;
  classic: boolean;
  tags?: string[];
  imageUrl?: string;
}

export interface BestiaryBrowseResult {
  items: BestiaryMonsterSummary[];
  filters: {
    challenges: BestiaryFilterOption[];
    types: BestiaryFilterOption[];
  };
  status: BestiarySyncStatus;
  total: number;
}

export interface BestiaryMonsterDetail {
  summary: BestiaryMonsterSummary;
  monster: MonsterEntity;
  sourceUrl: string;
  status: BestiarySyncStatus;
}

export interface QuestEntity extends KnowledgeEntityBase {
  kind: "quest";
  status: "active" | "paused" | "completed";
  urgency: "Low" | "Medium" | "High" | "Critical";
  issuerId?: string;
  locationId?: string;
  rewardProfile?: RewardProfile;
  preparedCombat?: PreparedCombatPlan;
}

export interface LoreEntity extends KnowledgeEntityBase {
  kind: "lore";
  category: "History" | "Rumor" | "Religion" | "Threat";
  visibility: "gm_only" | "player_safe";
}

export type KnowledgeEntity = LocationEntity | PlayerEntity | NpcEntity | MonsterEntity | QuestEntity | LoreEntity;
export type CombatEntity = PlayerEntity | NpcEntity | MonsterEntity;

export interface CombatThresholds {
  easy: number;
  medium: number;
  hard: number;
  deadly: number;
}

export interface CombatEntry {
  id: string;
  entityId: string;
  entityKind: "npc" | "monster" | "player";
  side: "enemy" | "player";
  title: string;
  summary: string;
  role: string;
  armorClass: string;
  initiative: number;
  challenge?: string;
  experience: number;
  maxHitPoints: number;
  currentHitPoints: number;
  defeated: boolean;
  statBlock?: NpcStatBlock;
}

export interface ActiveCombat {
  id: string;
  title: string;
  partySize: number;
  thresholds: CombatThresholds;
  round: number;
  currentTurnEntryId?: string;
  difficulty?: CombatDifficulty;
  targetAdjustedXp?: number;
  targetBaseXp?: number;
  actualBaseXp: number;
  actualAdjustedXp: number;
  entries: CombatEntry[];
}

export interface CombatRewardShare {
  title: string;
  experience: number;
}

export interface LastCombatSummary {
  combatId: string;
  title: string;
  outcome: "victory";
  defeatedCount: number;
  totalExperience: number;
  experiencePerPlayer: number;
  round?: number;
  entries?: CombatEntry[];
  playerRewards?: CombatRewardShare[];
  finishedAt?: string;
}

export interface DashboardCard {
  label: string;
  value: string;
  detail: string;
  tone?: QuickFactTone;
}

export type WorldEventType = "funny" | "combat" | "heist" | "social" | "oddity" | "danger";
export type WorldEventOrigin = "manual" | "ai";

export interface WorldEventDialogueBranch {
  title: string;
  lines: string[];
  outcome?: string;
}

export interface WorldEvent {
  id: string;
  title: string;
  date: string;
  summary: string;
  type: WorldEventType;
  locationId?: string;
  locationLabel?: string;
  sceneText: string;
  dialogueBranches: WorldEventDialogueBranch[];
  loot: string[];
  tags: string[];
  origin: WorldEventOrigin;
}

export interface SessionPrepItem {
  id: string;
  title: string;
  status: string;
  location: string;
  focus: string;
}

export interface CampaignData {
  id: string;
  title: string;
  system: string;
  settingName: string;
  inWorldDate: string;
  summary: string;
  modules: AppModule[];
  dashboardCards: DashboardCard[];
  locations: LocationEntity[];
  players: PlayerEntity[];
  npcs: NpcEntity[];
  monsters: MonsterEntity[];
  quests: QuestEntity[];
  lore: LoreEntity[];
  events: WorldEvent[];
  sessionPrep: SessionPrepItem[];
  combatPlaylist: PlaylistTrack[];
  preparedCombat?: CampaignPreparedCombat | null;
  activeCombat?: ActiveCombat | null;
  lastCombatSummary?: LastCombatSummary | null;
}

export interface CampaignSummary {
  id: string;
  title: string;
  system: string;
  settingName: string;
  inWorldDate: string;
  summary: string;
}

export interface CreateCampaignInput {
  title: string;
  system: string;
  settingName: string;
  inWorldDate: string;
  summary: string;
}

export interface UpdateCampaignInput {
  combatPlaylist?: PlaylistTrack[];
  preparedCombat?: CampaignPreparedCombat | null;
  updatePreparedCombat?: boolean;
}

export interface WorldEventInput {
  title: string;
  date?: string;
  summary: string;
  type: WorldEventType;
  locationId?: string;
  locationLabel?: string;
  sceneText: string;
  dialogueBranches?: WorldEventDialogueBranch[];
  loot?: string[];
  tags?: string[];
  origin?: WorldEventOrigin;
}

export interface CreateEntityInput {
  kind: EntityKind;
  title: string;
  subtitle: string;
  summary: string;
  content: string;
  playerContent?: string;
  playerCards?: PlayerFacingCard[];
  tags: string[];
  quickFacts?: QuickFact[];
  related?: RelatedEntity[];
  art?: HeroArt;
  playlist?: PlaylistTrack[];
  gallery?: GalleryImage[];
  category?: LocationEntity["category"] | LoreEntity["category"];
  region?: string;
  danger?: LocationEntity["danger"];
  parentId?: string;
  role?: string;
  status?: PlayerEntity["status"] | NpcEntity["status"] | MonsterEntity["status"] | QuestEntity["status"];
  importance?: NpcEntity["importance"] | MonsterEntity["importance"];
  locationId?: string;
  statBlock?: PlayerEntity["statBlock"] | NpcEntity["statBlock"] | MonsterEntity["statBlock"];
  rewardProfile?: RewardProfile;
  urgency?: QuestEntity["urgency"];
  issuerId?: string;
  preparedCombat?: PreparedCombatPlan;
  visibility?: LoreEntity["visibility"];
}

export interface UpdateEntityInput extends CreateEntityInput {}

export interface GenerateEntityDraftInput {
  kind: EntityKind;
  prompt: string;
  current?: Partial<CreateEntityInput>;
}

export interface LinkedDraftEntity {
  role: string;
  note?: string;
  entity: CreateEntityInput;
}

export interface GenerateEntityDraftResult {
  provider: string;
  notes: string[];
  entity: CreateEntityInput;
  linkedDrafts?: LinkedDraftEntity[];
}

export interface FormatPlayerFacingCardInput {
  title: string;
  content: string;
  contentHtml?: string;
  entityId?: string;
  entityKind?: EntityKind;
}

export interface FormatPlayerFacingCardResult {
  provider: string;
  notes: string[];
  card: PlayerFacingCard;
}

export interface GenerateWorldEventInput {
  locationId?: string;
  type: WorldEventType;
  prompt?: string;
  current?: Partial<WorldEventInput>;
}

export interface GenerateWorldEventResult {
  provider: string;
  notes: string[];
  event: WorldEventInput;
}

export interface CreateEntityResult {
  campaign: CampaignData;
  entity: KnowledgeEntity;
}

export interface DeleteEntityResult {
  campaign: CampaignData;
  entityId: string;
  kind: EntityKind;
}

export interface WorldEventResult {
  campaign: CampaignData;
  event: WorldEvent;
}

export interface DeleteWorldEventResult {
  campaign: CampaignData;
  eventId: string;
}

export interface UploadImageResult {
  url: string;
  fileName: string;
  contentType: string;
  size: number;
}

export interface AddCombatantItem {
  entityId: string;
  quantity: number;
  initiative?: number;
}

export interface ManualCombatantInput {
  title: string;
  initiative: number;
  role?: string;
  armorClass?: string;
  maxHitPoints?: number;
  currentHitPoints?: number;
}

export interface StartCombatInput {
  title?: string;
  partySize: number;
  thresholds: CombatThresholds;
  targetAdjustedXp?: number;
  targetBaseXp?: number;
  items: AddCombatantItem[];
  manualParticipants?: ManualCombatantInput[];
}

export interface UpdateCombatEntryInput {
  currentHitPoints?: number;
  defeated?: boolean;
  initiative?: number;
  entityId?: string;
  title?: string;
}

export interface CombatResult {
  campaign: CampaignData;
  combat: ActiveCombat | null;
}

export interface UpdateCombatStateInput {
  currentTurnEntryId?: string;
  nextTurn?: boolean;
  playersVictory?: boolean;
}

export interface FinishCombatResult {
  campaign: CampaignData;
  combatId: string;
  defeatedCount: number;
  totalExperience: number;
  experiencePerPlayer: number;
  defeatedEntries: CombatEntry[];
  summary?: LastCombatSummary | null;
}

export interface GenerateCombatInput {
  title?: string;
  prompt: string;
  monsterCount: number;
  difficulty: CombatDifficulty;
  partySize: number;
  partyLevels?: number[];
  thresholds: CombatThresholds;
  customAdjustedXp?: number;
}

export interface GenerateCombatResult {
  campaign: CampaignData;
  combat: ActiveCombat;
  createdEntities: MonsterEntity[];
}

export interface SearchResult {
  id: string;
  kind: EntityKind;
  title: string;
  subtitle: string;
  summary: string;
  tags: string[];
}

export interface InitiativeShareResult {
  campaignId: string;
  token: string;
  url: string;
  provider?: string;
  publishedVersion?: number;
  publishedAt?: string;
}

export interface AuthSessionResult {
  authenticated: boolean;
  username?: string;
}

export interface LoginInput {
  username: string;
  password: string;
}

export interface ApiClient {
  getSession(): Promise<AuthSessionResult>;
  login(input: LoginInput): Promise<AuthSessionResult>;
  logout(): Promise<AuthSessionResult>;
  listCampaigns(): Promise<CampaignSummary[]>;
  getCampaign(campaignId: string): Promise<CampaignData>;
  createCampaign(input: CreateCampaignInput): Promise<CampaignData>;
  updateCampaign(campaignId: string, input: UpdateCampaignInput): Promise<CampaignData>;
  browseBestiary(params?: {
    q?: string;
    challenge?: string;
    type?: string;
    namedNpc?: boolean;
    classic?: boolean;
  }): Promise<BestiaryBrowseResult>;
  getBestiaryMonster(monsterId: string): Promise<BestiaryMonsterDetail>;
  importBestiaryMonster(campaignId: string, monsterId: string): Promise<CreateEntityResult>;
  uploadImage(campaignId: string, file: File): Promise<UploadImageResult>;
  createEntity(campaignId: string, input: CreateEntityInput): Promise<CreateEntityResult>;
  updateEntity(campaignId: string, entityId: string, input: UpdateEntityInput): Promise<CreateEntityResult>;
  deleteEntity(campaignId: string, entityId: string): Promise<DeleteEntityResult>;
  generateEntityDraft(campaignId: string, input: GenerateEntityDraftInput): Promise<GenerateEntityDraftResult>;
  formatPlayerFacingCard(campaignId: string, input: FormatPlayerFacingCardInput): Promise<FormatPlayerFacingCardResult>;
  createWorldEvent(campaignId: string, input: WorldEventInput): Promise<WorldEventResult>;
  updateWorldEvent(campaignId: string, eventId: string, input: WorldEventInput): Promise<WorldEventResult>;
  deleteWorldEvent(campaignId: string, eventId: string): Promise<DeleteWorldEventResult>;
  generateWorldEvent(campaignId: string, input: GenerateWorldEventInput): Promise<GenerateWorldEventResult>;
  startCombat(campaignId: string, input: StartCombatInput): Promise<CombatResult>;
  updateCombatState(campaignId: string, input: UpdateCombatStateInput): Promise<CombatResult>;
  updateCombatEntry(campaignId: string, entryId: string, input: UpdateCombatEntryInput): Promise<CombatResult>;
  finishCombat(campaignId: string): Promise<FinishCombatResult>;
  generateCombat(campaignId: string, input: GenerateCombatInput): Promise<GenerateCombatResult>;
  createInitiativeShare(campaignId: string): Promise<InitiativeShareResult>;
  publishInitiativeShare(campaignId: string): Promise<InitiativeShareResult>;
  search(campaignId: string, query: string): Promise<SearchResult[]>;
}

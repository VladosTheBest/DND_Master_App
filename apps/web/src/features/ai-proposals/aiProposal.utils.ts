import type {
  AIProposal,
  AIProposalCampaignBlueprint,
  AIProposalKind,
  AIProposalSource,
  AIProposalStatus,
  CampaignData,
  DashboardCard,
  EntityKind,
  KnowledgeEntity,
  WorldEvent,
  WorldEventType
} from "@shadow-edge/shared-types";

const entityKinds = new Set<EntityKind>(["location", "player", "npc", "monster", "quest", "lore"]);
const worldEventTypes = new Set<WorldEventType>(["funny", "combat", "heist", "social", "oddity", "danger"]);

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;

const arrayOrEmpty = <T>(value: unknown): T[] => Array.isArray(value) ? value as T[] : [];

export const normalizeProposalEntity = (value: unknown, fallbackId = "proposal-candidate"): KnowledgeEntity | null => {
  const record = asRecord(value);
  const nested = asRecord(record?.entity);
  const candidate = nested ?? record;
  if (!candidate || typeof candidate.kind !== "string" || !entityKinds.has(candidate.kind as EntityKind)) return null;
  if (typeof candidate.title !== "string") return null;

  const common = {
    ...candidate,
    id: typeof candidate.id === "string" && candidate.id ? candidate.id : fallbackId,
    kind: candidate.kind,
    title: candidate.title,
    subtitle: typeof candidate.subtitle === "string" ? candidate.subtitle : "",
    summary: typeof candidate.summary === "string" ? candidate.summary : "",
    content: typeof candidate.content === "string" ? candidate.content : "",
    tags: arrayOrEmpty<string>(candidate.tags),
    quickFacts: arrayOrEmpty(candidate.quickFacts),
    related: arrayOrEmpty(candidate.related)
  };

  switch (candidate.kind) {
    case "location":
      return {
        ...common,
        kind: "location",
        category: candidate.category === "Region" || candidate.category === "Dungeon" || candidate.category === "POI" ? candidate.category : "City",
        region: typeof candidate.region === "string" ? candidate.region : "",
        danger: candidate.danger === "Tense" || candidate.danger === "Dangerous" || candidate.danger === "Deadly" ? candidate.danger : "Safe"
      } as KnowledgeEntity;
    case "player":
      return {
        ...common,
        kind: "player",
        role: typeof candidate.role === "string" ? candidate.role : "",
        status: candidate.status === "Reserve" || candidate.status === "Guest" ? candidate.status : "Active"
      } as KnowledgeEntity;
    case "npc":
      return {
        ...common,
        kind: "npc",
        role: typeof candidate.role === "string" ? candidate.role : "",
        status: candidate.status === "Ally" || candidate.status === "Threat" || candidate.status === "Unknown" ? candidate.status : "Watcher",
        importance: candidate.importance === "Background" || candidate.importance === "Critical" ? candidate.importance : "Major"
      } as KnowledgeEntity;
    case "monster":
      return {
        ...common,
        kind: "monster",
        role: typeof candidate.role === "string" ? candidate.role : "",
        status: candidate.status === "Territorial" || candidate.status === "Summoned" || candidate.status === "Neutral" ? candidate.status : "Hostile",
        importance: candidate.importance === "Minion" || candidate.importance === "Elite" || candidate.importance === "Boss" ? candidate.importance : "Standard"
      } as KnowledgeEntity;
    case "quest":
      return {
        ...common,
        kind: "quest",
        status: candidate.status === "paused" || candidate.status === "completed" ? candidate.status : "active",
        urgency: candidate.urgency === "Low" || candidate.urgency === "High" || candidate.urgency === "Critical" ? candidate.urgency : "Medium"
      } as KnowledgeEntity;
    case "lore":
      return {
        ...common,
        kind: "lore",
        category: candidate.category === "Rumor" || candidate.category === "Religion" || candidate.category === "Threat" ? candidate.category : "History",
        visibility: candidate.visibility === "player_safe" ? "player_safe" : "gm_only"
      } as KnowledgeEntity;
    default:
      return null;
  }
};

export const proposalBeforeEntity = (proposal: AIProposal) =>
  normalizeProposalEntity(proposal.before, proposal.target.entityId ?? `${proposal.id}-before`);

export const proposalAfterEntity = (proposal: AIProposal) =>
  normalizeProposalEntity(proposal.after, proposal.target.entityId ?? `${proposal.id}-after`);

export const normalizeProposalEvent = (value: unknown, fallbackId = "proposal-event"): WorldEvent | null => {
  const record = asRecord(value);
  const nested = asRecord(record?.event);
  const candidate = nested ?? record;
  if (!candidate || typeof candidate.title !== "string") return null;
  if (typeof candidate.sceneText !== "string" && typeof candidate.summary !== "string") return null;

  return {
    id: typeof candidate.id === "string" && candidate.id ? candidate.id : fallbackId,
    revision: typeof candidate.revision === "number" ? candidate.revision : undefined,
    title: candidate.title,
    date: typeof candidate.date === "string" ? candidate.date : "",
    summary: typeof candidate.summary === "string" ? candidate.summary : "",
    type: typeof candidate.type === "string" && worldEventTypes.has(candidate.type as WorldEventType)
      ? candidate.type as WorldEventType
      : "social",
    locationId: typeof candidate.locationId === "string" ? candidate.locationId : undefined,
    locationLabel: typeof candidate.locationLabel === "string" ? candidate.locationLabel : undefined,
    sceneText: typeof candidate.sceneText === "string" ? candidate.sceneText : "",
    dialogueBranches: arrayOrEmpty(candidate.dialogueBranches),
    loot: arrayOrEmpty<string>(candidate.loot),
    tags: arrayOrEmpty<string>(candidate.tags),
    origin: candidate.origin === "manual" ? "manual" : "ai"
  };
};

export const proposalBeforeEvent = (proposal: AIProposal) =>
  normalizeProposalEvent(proposal.before, proposal.target.eventId ?? `${proposal.id}-before-event`);

export const proposalAfterEvent = (proposal: AIProposal) =>
  normalizeProposalEvent(proposal.after, proposal.target.eventId ?? `${proposal.id}-after-event`);

export const proposalCampaignBlueprint = (proposal: AIProposal): AIProposalCampaignBlueprint | null => {
  const record = asRecord(proposal.after);
  const blueprint = asRecord(record?.blueprint) ?? record;
  if (!blueprint || !asRecord(blueprint.campaign)) return null;
  return {
    campaign: blueprint.campaign as unknown as AIProposalCampaignBlueprint["campaign"],
    entities: arrayOrEmpty(blueprint.entities) as AIProposalCampaignBlueprint["entities"],
    events: arrayOrEmpty(blueprint.events) as AIProposalCampaignBlueprint["events"]
  };
};

export const proposalCampaignEntities = (proposal: AIProposal): KnowledgeEntity[] => {
  const blueprint = proposalCampaignBlueprint(proposal);
  if (!blueprint) return [];
  return blueprint.entities
    .map((entity, index) => normalizeProposalEntity(entity, entity.tempKey || `${proposal.id}-entity-${index}`))
    .filter((entity): entity is KnowledgeEntity => Boolean(entity));
};

export const proposalCampaignEvents = (proposal: AIProposal): WorldEvent[] => {
  const blueprint = proposalCampaignBlueprint(proposal);
  if (!blueprint) return [];
  return blueprint.events
    .map((event, index) => normalizeProposalEvent(event, event.tempKey || `${proposal.id}-event-${index}`))
    .filter((event): event is WorldEvent => Boolean(event));
};

const dashboardCardsForCampaign = (campaign: Pick<CampaignData, "locations" | "players" | "npcs" | "monsters">): DashboardCard[] => [
  { label: "Локации", value: String(campaign.locations.length), detail: "Города, регионы и точки интереса", tone: "warning" },
  { label: "Игроки", value: String(campaign.players.length), detail: "Персонажи партии и их портреты", tone: "accent" },
  { label: "НПС", value: String(campaign.npcs.length), detail: "Союзники, соперники и действующие лица", tone: "success" },
  { label: "Монстры", value: String(campaign.monsters.length), detail: "Бестиарий и боевые угрозы", tone: "danger" },
  { label: "Бой", value: "Нет", detail: "Активного боя сейчас нет", tone: "success" }
];

const splitEntities = (entities: KnowledgeEntity[]) => ({
  locations: entities.filter((entity): entity is Extract<KnowledgeEntity, { kind: "location" }> => entity.kind === "location"),
  players: entities.filter((entity): entity is Extract<KnowledgeEntity, { kind: "player" }> => entity.kind === "player"),
  npcs: entities.filter((entity): entity is Extract<KnowledgeEntity, { kind: "npc" }> => entity.kind === "npc"),
  monsters: entities.filter((entity): entity is Extract<KnowledgeEntity, { kind: "monster" }> => entity.kind === "monster"),
  quests: entities.filter((entity): entity is Extract<KnowledgeEntity, { kind: "quest" }> => entity.kind === "quest"),
  lore: entities.filter((entity): entity is Extract<KnowledgeEntity, { kind: "lore" }> => entity.kind === "lore")
});

export const buildSelectedBlueprintCampaign = (
  proposal: AIProposal,
  selectedOperationKeys: ReadonlySet<string>
): CampaignData | null => {
  const blueprint = proposalCampaignBlueprint(proposal);
  if (!blueprint) return null;
  const includeAll = proposal.operations.length === 0;
  const entities = proposalCampaignEntities(proposal).filter((entity) =>
    includeAll || selectedOperationKeys.has(`entity:${entity.id}`)
  );
  const selectedEvents = proposalCampaignEvents(proposal).filter((event) =>
    includeAll || selectedOperationKeys.has(`event:${event.id}`)
  );
  const collections = splitEntities(entities);
  const locationTitles = new Map(collections.locations.map((location) => [location.id, location.title]));
  const events = selectedEvents.map((event) => ({
    ...event,
    locationLabel: event.locationLabel || (event.locationId ? locationTitles.get(event.locationId) : undefined)
  }));
  const campaignBase = {
    id: `${proposal.id}-campaign-preview`,
    revision: 0,
    title: blueprint.campaign.title || "Новая кампания",
    system: blueprint.campaign.system || "D&D 5e",
    settingName: blueprint.campaign.settingName || "Новый мир",
    inWorldDate: blueprint.campaign.inWorldDate || "",
    summary: blueprint.campaign.summary || "",
    modules: [],
    dashboardCards: [],
    ...collections,
    events,
    sessionPrep: [],
    shops: [],
    combatPlaylist: [],
    preparedCombat: null,
    activeCombat: null,
    lastCombatSummary: null
  } satisfies CampaignData;
  return { ...campaignBase, dashboardCards: dashboardCardsForCampaign(campaignBase) };
};

export const proposalAppliedCampaign = (proposal: AIProposal): CampaignData | null => {
  if (proposal.kind !== "campaign_create") return null;
  const candidate = asRecord(proposal.appliedResult);
  if (!candidate || typeof candidate.id !== "string" || typeof candidate.title !== "string") return null;
  if (!Array.isArray(candidate.locations) || !Array.isArray(candidate.events)) return null;
  return candidate as unknown as CampaignData;
};

export const campaignWithEntityCandidate = (campaign: CampaignData, entity: KnowledgeEntity): CampaignData => {
  const entities = [
    ...campaign.locations,
    ...campaign.players,
    ...campaign.npcs,
    ...campaign.monsters,
    ...campaign.quests,
    ...campaign.lore
  ].filter((candidate) => candidate.id !== entity.id);
  entities.push(entity);
  return { ...campaign, ...splitEntities(entities) };
};

export const campaignWithEventCandidate = (campaign: CampaignData, event: WorldEvent): CampaignData => ({
  ...campaign,
  events: [...campaign.events.filter((candidate) => candidate.id !== event.id), event]
});

export const proposalKindLabels: Record<AIProposalKind, string> = {
  entity_create: "Новая сущность",
  entity_update: "Изменение сущности",
  event_create: "Новая сцена",
  event_update: "Изменение сцены",
  campaign_create: "Новая кампания"
};

export const proposalStatusLabels: Record<AIProposalStatus, string> = {
  pending: "Ожидает решения",
  applied: "Применён",
  rejected: "Отклонён",
  undone: "Отменён",
  expired: "Истёк"
};

export const proposalSourceLabel = (source: AIProposalSource) => {
  if (source.type === "codex_app_server") return "ChatGPT через Codex App Server";
  if (source.type === "mcp") return "Внешний Codex / ChatGPT через MCP";
  if (source.type === "openai_api") return "OpenAI API";
  if (source.type === "website" || source.type === "website_ai") return "AI в DND Master";
  return source.provider || source.type || "AI";
};

export const proposalTitle = (proposal: AIProposal) => {
  const afterEntity = proposalAfterEntity(proposal);
  if (afterEntity) return afterEntity.title;
  const afterEvent = proposalAfterEvent(proposal);
  if (afterEvent) return afterEvent.title;
  const blueprint = proposalCampaignBlueprint(proposal);
  if (blueprint?.campaign.title) return blueprint.campaign.title;
  return proposal.operations.find((operation) => operation.title)?.title ?? proposalKindLabels[proposal.kind];
};

export const formatProposalValue = (value: unknown) => {
  if (value == null || value === "") return "—";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  try {
    const serialized = JSON.stringify(value, null, 2);
    return serialized.length > 900 ? `${serialized.slice(0, 900)}…` : serialized;
  } catch {
    return String(value);
  }
};

export const formatProposalDate = (value?: string) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("ru-RU", { dateStyle: "medium", timeStyle: "short" }).format(date);
};

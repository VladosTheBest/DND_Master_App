import { z } from "zod";

const shortText = z.string().trim().min(1).max(500);
const longText = z.string().trim().min(1).max(100_000);
const id = z.string().trim().min(1).max(200);
const proposalOperationKey = z.string().trim().min(1).max(207);
const tempKey = z
  .string()
  .trim()
  .min(1)
  .max(100)
  .regex(/^[A-Za-z0-9][A-Za-z0-9._:-]*$/, "Use a stable alphanumeric temporary key");
const campaignEntityOperationKey = z
  .string()
  .trim()
  .min(8)
  .max(107)
  .regex(
    /^entity:[A-Za-z0-9][A-Za-z0-9._:-]*$/,
    'Use the campaign operation key "entity:<tempKey>"',
  );

export const EntityKindSchema = z.enum([
  "location",
  "player",
  "npc",
  "monster",
  "quest",
  "lore",
]);

export const ReadableEntityKindSchema = z.enum([
  ...EntityKindSchema.options,
  "event",
]);

export const ProposalStatusSchema = z.enum([
  "pending",
  "applied",
  "rejected",
  "undone",
  "expired",
]);

export const SourceSchema = z
  .object({
    type: z.string().trim().max(100).optional(),
    provider: z.string().trim().max(100).optional(),
    model: z.string().trim().max(200).optional(),
    metadata: z
      .record(z.string().trim().min(1).max(100), z.string().max(2_000))
      .refine((value) => Object.keys(value).length <= 30, "At most 30 metadata entries are allowed")
      .optional(),
  })
  .strict();

export const MediaIntentSchema = z
  .object({
    id: id.optional(),
    purpose: z.string().trim().max(100).optional(),
    operationKey: tempKey.optional(),
    field: z.string().trim().max(100).optional(),
    prompt: z.string().trim().max(10_000).optional(),
    alt: z.string().trim().max(1_000).optional(),
    caption: z.string().trim().max(2_000).optional(),
    status: z.enum(["requested", "placeholder", "unavailable"]).optional(),
    selected: z.boolean().optional(),
  })
  .strict();

export const CampaignMediaIntentSchema = MediaIntentSchema.extend({
  operationKey: campaignEntityOperationKey,
  field: z.enum(["art.url", "gallery"]).optional(),
});

export const EntityMediaIntentSchema = MediaIntentSchema.extend({
  field: z.enum(["art.url", "gallery"]).optional(),
});

const QuickFactSchema = z
  .object({
    label: shortText,
    value: z.string().max(2_000),
    tone: z.enum(["default", "accent", "success", "warning", "danger"]).optional(),
  })
  .strict();

const RelatedEntitySchema = z
  .object({
    id,
    kind: EntityKindSchema,
    label: shortText,
    reason: z.string().max(2_000),
  })
  .strict();

const PlayerCardSchema = z
  .object({
    title: shortText,
    content: z.string().max(50_000),
    contentHtml: z.string().max(100_000).optional(),
  })
  .strict();

const ArtSchema = z
  .object({
    url: z.string().max(4_000).optional(),
    alt: z.string().max(1_000).optional(),
    caption: z.string().max(2_000).optional(),
  })
  .strict();

const PlaylistTrackSchema = z
  .object({
    title: shortText,
    url: z.string().trim().min(1).max(4_000),
  })
  .strict();

const GalleryImageSchema = z
  .object({
    title: shortText,
    url: z.string().trim().min(1).max(4_000),
    caption: z.string().max(2_000).optional(),
  })
  .strict();

const PreparedCombatItemSchema = z
  .object({
    entityId: id,
    quantity: z.number().int().min(1).max(100),
  })
  .strict();

const PreparedCombatSchema = z
  .object({
    title: z.string().max(500).optional(),
    partyLevel: z.number().int().min(1).max(30).optional(),
    playerIds: z.array(id).max(30).optional(),
    allies: z.array(PreparedCombatItemSchema).max(100).optional(),
    items: z.array(PreparedCombatItemSchema).max(100),
  })
  .strict();

const StatBlockEntrySchema = z
  .object({
    name: shortText,
    subtitle: z.string().max(1_000).optional(),
    toHit: z.string().max(100).optional(),
    damage: z.string().max(500).optional(),
    saveDc: z.string().max(100).optional(),
    description: z.string().max(20_000),
  })
  .strict();

const SpellcastingSchema = z
  .object({
    title: shortText,
    ability: z.string().max(100),
    saveDc: z.string().max(100),
    attackBonus: z.string().max(100),
    slots: z
      .array(
        z
          .object({ level: z.string().max(100), slots: z.string().max(100) })
          .strict(),
      )
      .max(20)
      .optional(),
    spells: z.array(z.string().max(500)).max(200),
    description: z.string().max(20_000).optional(),
  })
  .strict();

const StatBlockSchema = z
  .object({
    size: z.string().max(100),
    creatureType: z.string().max(300),
    alignment: z.string().max(200),
    armorClass: z.string().max(100),
    hitPoints: z.string().max(100),
    speed: z.string().max(500),
    proficiencyBonus: z.string().max(100).optional(),
    challenge: z.string().max(100).optional(),
    senses: z.string().max(1_000).optional(),
    languages: z.string().max(1_000).optional(),
    savingThrows: z.string().max(1_000).optional(),
    skills: z.string().max(1_000).optional(),
    resistances: z.string().max(2_000).optional(),
    immunities: z.string().max(2_000).optional(),
    conditionImmunities: z.string().max(2_000).optional(),
    abilityScores: z
      .object({
        str: z.number().int().min(0).max(40),
        dex: z.number().int().min(0).max(40),
        con: z.number().int().min(0).max(40),
        int: z.number().int().min(0).max(40),
        wis: z.number().int().min(0).max(40),
        cha: z.number().int().min(0).max(40),
      })
      .strict(),
    traits: z.array(StatBlockEntrySchema).max(100),
    actions: z.array(StatBlockEntrySchema).max(100),
    bonusActions: z.array(StatBlockEntrySchema).max(100).optional(),
    reactions: z.array(StatBlockEntrySchema).max(100).optional(),
    spellcasting: SpellcastingSchema.nullable().optional(),
  })
  .strict();

const RewardProfileSchema = z
  .object({
    summary: z.string().max(10_000),
    loot: z
      .array(
        z
          .object({
            name: shortText,
            category: z.string().max(500),
            quantity: z.string().max(500),
            check: z.string().max(1_000),
            dc: z.string().max(100).optional(),
            details: z.string().max(5_000).optional(),
          })
          .strict(),
      )
      .max(100),
  })
  .strict();

const CampaignEntitySchema = z
  .object({
    tempKey,
    kind: EntityKindSchema,
    title: z.string().trim().max(500).optional(),
    subtitle: z.string().max(1_000).optional(),
    summary: z.string().max(10_000).optional(),
    content: z.string().max(100_000).optional(),
    playerContent: z.string().max(100_000).optional(),
    playerCards: z.array(PlayerCardSchema).max(100).optional(),
    tags: z.array(z.string().max(200)).max(100).optional(),
    quickFacts: z.array(QuickFactSchema).max(100).optional(),
    related: z.array(RelatedEntitySchema).max(200).optional(),
    art: ArtSchema.optional(),
    playlist: z.array(PlaylistTrackSchema).max(100).optional(),
    gallery: z.array(GalleryImageSchema).max(100).optional(),
    category: z.string().max(200).optional(),
    region: z.string().max(500).optional(),
    danger: z.string().max(100).optional(),
    parentId: z.string().max(200).optional(),
    role: z.string().max(500).optional(),
    status: z.string().max(100).optional(),
    level: z.number().int().min(0).max(30).optional(),
    importance: z.string().max(100).optional(),
    locationId: z.string().max(200).optional(),
    statBlock: StatBlockSchema.optional(),
    rewardProfile: RewardProfileSchema.optional(),
    urgency: z.string().max(100).optional(),
    issuerId: z.string().max(200).optional(),
    preparedCombat: PreparedCombatSchema.optional(),
    preparedCombats: z.array(PreparedCombatSchema).max(50).optional(),
    visibility: z.string().max(100).optional(),
  })
  .strict();

const CampaignEventSchema = z
  .object({
    tempKey,
    title: shortText,
    date: z.string().max(500).optional(),
    summary: z.string().max(10_000),
    type: z.enum(["funny", "combat", "heist", "social", "oddity", "danger"]),
    locationId: z.string().max(200).optional(),
    locationLabel: z.string().max(500).optional(),
    sceneText: z.string().max(100_000),
    dialogueBranches: z
      .array(
        z
          .object({
            title: shortText,
            lines: z.array(z.string().max(10_000)).max(200),
            outcome: z.string().max(10_000).optional(),
          })
          .strict(),
      )
      .max(100)
      .optional(),
    loot: z.array(z.string().max(2_000)).max(200).optional(),
    tags: z.array(z.string().max(200)).max(100).optional(),
    origin: z.enum(["manual", "ai"]).optional(),
  })
  .strict();

export const CampaignBlueprintSchema = z
  .object({
    campaign: z
      .object({
        title: z.string().trim().max(500).optional(),
        system: z.string().max(500).optional(),
        settingName: z.string().max(1_000).optional(),
        inWorldDate: z.string().max(500).optional(),
        summary: z.string().max(20_000).optional(),
      })
      .strict(),
    entities: z.array(CampaignEntitySchema).max(1_000).optional(),
    events: z.array(CampaignEventSchema).max(1_000).optional(),
  })
  .strict();

export const ListCampaignsInputSchema = z.object({}).strict();

export const GetCampaignInputSchema = z
  .object({ campaignId: id.describe("Campaign ID returned by list_campaigns") })
  .strict();

export const GetCampaignOutlineInputSchema = z
  .object({ campaignId: id.describe("Campaign ID returned by list_campaigns") })
  .strict();

export const SearchEntitiesInputSchema = z
  .object({
    campaignId: id.describe("Owned campaign ID"),
    query: z
      .string()
      .trim()
      .min(1)
      .max(200)
      .describe("Case-insensitive text to find in entity and world-event fields"),
    kinds: z
      .array(ReadableEntityKindSchema)
      .min(1)
      .max(ReadableEntityKindSchema.options.length)
      .refine((value) => new Set(value).size === value.length, "Entity kinds must be unique")
      .optional()
      .describe("Optional entity kinds to search; all kinds are searched when omitted"),
    limit: z
      .number()
      .int()
      .min(1)
      .max(50)
      .optional()
      .describe("Maximum concise results to return; defaults to 20 and cannot exceed 50"),
  })
  .strict();

export const GetEntityInputSchema = z
  .object({
    campaignId: id.describe("Owned campaign ID"),
    kind: ReadableEntityKindSchema,
    entityId: id.describe("Entity or event ID"),
  })
  .strict();

export const ProposeCampaignInputSchema = z
  .object({
    prompt: longText.describe("The user's instruction and creative constraints"),
    blueprint: CampaignBlueprintSchema,
    source: SourceSchema.optional(),
    warnings: z.array(z.string().max(10_000)).max(100).optional(),
    mediaIntents: z.array(CampaignMediaIntentSchema).max(100).optional(),
  })
  .strict()
  .superRefine((value, context) => {
    const seenTempKeys = new Set<string>();
    for (const [index, entity] of (value.blueprint.entities ?? []).entries()) {
      if (seenTempKeys.has(entity.tempKey)) {
        context.addIssue({
          code: "custom",
          path: ["blueprint", "entities", index, "tempKey"],
          message: "Campaign blueprint tempKeys must be unique across entities and events",
        });
      }
      seenTempKeys.add(entity.tempKey);
    }
    for (const [index, event] of (value.blueprint.events ?? []).entries()) {
      if (seenTempKeys.has(event.tempKey)) {
        context.addIssue({
          code: "custom",
          path: ["blueprint", "events", index, "tempKey"],
          message: "Campaign blueprint tempKeys must be unique across entities and events",
        });
      }
      seenTempKeys.add(event.tempKey);
    }

    const entityOperationKeys = new Set(
      (value.blueprint.entities ?? []).map((entity) => `entity:${entity.tempKey}`),
    );
    for (const [index, media] of (value.mediaIntents ?? []).entries()) {
      if (!entityOperationKeys.has(media.operationKey)) {
        context.addIssue({
          code: "custom",
          path: ["mediaIntents", index, "operationKey"],
          message: "Campaign media operationKey must identify an entity in this blueprint",
        });
      }
    }
  });

const ProposeEntityCommonSchema = z.object({
  campaignId: id.describe("Owned campaign ID"),
  prompt: longText.describe("The user's requested change"),
  source: SourceSchema.optional(),
  warnings: z.array(z.string().max(10_000)).max(100).optional(),
});

const ProposeKnowledgeEntityBaseSchema = ProposeEntityCommonSchema.extend({
  mediaIntents: z.array(EntityMediaIntentSchema).max(100).optional(),
});

const KnowledgeEntityCandidateSchema = CampaignEntitySchema.omit({ tempKey: true, kind: true });
const KnowledgeEntityPatchSchema = KnowledgeEntityCandidateSchema.partial();
const EventCandidateSchema = CampaignEventSchema.omit({ tempKey: true });
const EventPatchSchema = EventCandidateSchema.partial();

export const ProposeEntityCreateInputSchema = z.union([
  ProposeKnowledgeEntityBaseSchema.extend({
    kind: EntityKindSchema,
    candidate: KnowledgeEntityCandidateSchema.describe("Complete proposed knowledge entity."),
  }).strict(),
  ProposeEntityCommonSchema.extend({
    kind: z.literal("event"),
    candidate: EventCandidateSchema.describe("Complete proposed world event/dialogue scene."),
  }).strict(),
]);

export const ProposeEntityUpdateInputSchema = z.union([
  ProposeKnowledgeEntityBaseSchema.extend({
    kind: EntityKindSchema,
    entityId: id.describe("Existing entity ID to update"),
    patch: KnowledgeEntityPatchSchema.describe(
      "Only entity fields intentionally changed; omitted fields are preserved by the server.",
    ),
    candidate: KnowledgeEntityCandidateSchema.optional().describe(
      "Optional complete knowledge-entity candidate; prefer patch for constrained edits.",
    ),
  }).strict(),
  ProposeEntityCommonSchema.extend({
    kind: z.literal("event"),
    entityId: id.describe("Existing world event ID to update"),
    patch: EventPatchSchema.describe(
      "Only world-event fields intentionally changed; omitted fields are preserved by the server.",
    ),
    candidate: EventCandidateSchema.optional().describe(
      "Optional complete world-event candidate; prefer patch for constrained edits.",
    ),
  }).strict(),
]);

export const ListProposalsInputSchema = z
  .object({
    status: ProposalStatusSchema.optional(),
    campaignId: id.optional(),
  })
  .strict();

export const GetProposalInputSchema = z
  .object({ proposalId: id.describe("Proposal ID returned by a proposal tool") })
  .strict();

const MediaAttachmentMetadataShape = {
  purpose: z.string().trim().max(100).optional(),
  operationKey: proposalOperationKey.optional(),
  field: z.string().trim().max(100).optional(),
  alt: z.string().trim().max(1_000).optional(),
  caption: z.string().trim().max(2_000).optional(),
} as const;

export const StageProposalMediaInputSchema = z
  .object({
    proposalId: id,
    localPath: z
      .string()
      .trim()
      .min(1)
      .max(4_000)
      .describe("Absolute or configured-root-relative local PNG, JPEG, or WebP path"),
    ...MediaAttachmentMetadataShape,
    prompt: z.string().trim().max(10_000).optional(),
  })
  .strict();

export const AttachProposalMediaInputSchema = z
  .object({
    proposalId: id,
    mediaId: id.describe("Staged media ID returned by stage_proposal_media"),
    ...MediaAttachmentMetadataShape,
    selected: z.boolean().optional(),
  })
  .strict();

export type ProposeCampaignInput = z.infer<typeof ProposeCampaignInputSchema>;
export type ProposeEntityCreateInput = z.infer<typeof ProposeEntityCreateInputSchema>;
export type ProposeEntityUpdateInput = z.infer<typeof ProposeEntityUpdateInputSchema>;
export type StageProposalMediaInput = z.infer<typeof StageProposalMediaInputSchema>;
export type AttachProposalMediaInput = z.infer<typeof AttachProposalMediaInputSchema>;

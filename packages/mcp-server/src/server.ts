import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult, ToolAnnotations } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { DndApiError, DndMasterClient } from "./client.js";
import { sanitizeModelOutput } from "./model-output.js";
import {
  AttachProposalMediaInputSchema,
  GetCampaignInputSchema,
  GetCampaignOutlineInputSchema,
  GetEntityInputSchema,
  GetProposalInputSchema,
  ListCampaignsInputSchema,
  ListProposalsInputSchema,
  ProposeCampaignInputSchema,
  ProposeEntityCreateInputSchema,
  ProposeEntityUpdateInputSchema,
  ReadableEntityKindSchema,
  SearchEntitiesInputSchema,
  StageProposalMediaInputSchema,
} from "./schemas.js";

const readAnnotations = {
  readOnlyHint: true,
  destructiveHint: false,
  openWorldHint: false,
} satisfies ToolAnnotations;

const proposalWriteAnnotations = {
  readOnlyHint: false,
  destructiveHint: false,
  idempotentHint: false,
  openWorldHint: false,
} satisfies ToolAnnotations;

const attachmentWriteAnnotations = {
  readOnlyHint: false,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
} satisfies ToolAnnotations;

const GenericRecordSchema = z.record(z.string(), z.unknown());
const CampaignSummarySchema = z
  .object({
    id: z.string(),
    title: z.string().optional(),
    system: z.string().optional(),
    settingName: z.string().optional(),
    inWorldDate: z.string().optional(),
    summary: z.string().optional(),
  })
  .passthrough();

const StoredMediaIntentSchema = z
  .object({
    id: z.string(),
    purpose: z.string().optional(),
    operationKey: z.string().optional(),
    field: z.string().optional(),
    prompt: z.string().optional(),
    alt: z.string().optional(),
    caption: z.string().optional(),
    previewUrl: z.string().optional(),
    finalUrl: z.string().optional(),
    contentType: z.string().optional(),
    size: z.number().int().nonnegative().optional(),
    status: z.enum([
      "intent",
      "requested",
      "placeholder",
      "staged",
      "promoted",
      "discarded",
      "unavailable",
    ]),
    selected: z.boolean().optional(),
  })
  .passthrough();

const ProposalSchema = z
  .object({
    id: z.string(),
    campaignId: z.string().optional(),
    kind: z.enum([
      "campaign_create",
      "entity_create",
      "entity_update",
      "event_create",
      "event_update",
    ]),
    status: z.enum(["pending", "applied", "rejected", "undone", "expired"]),
    target: z
      .object({
        campaignId: z.string().optional(),
        entityId: z.string().optional(),
        eventId: z.string().optional(),
        entityKind: z.string().optional(),
      })
      .passthrough(),
    baseRevisions: z.record(z.string(), z.number().int()),
    appliedRevisions: z.record(z.string(), z.number().int()).optional(),
    prompt: z.string(),
    source: z
      .object({
        type: z.string().optional(),
        provider: z.string().optional(),
        model: z.string().optional(),
        metadata: z.record(z.string(), z.string()).optional(),
      })
      .passthrough(),
    before: z.unknown(),
    after: z.unknown(),
    diff: z.array(
      z
        .object({
          path: z.string(),
          before: z.unknown().optional(),
          after: z.unknown().optional(),
        })
        .passthrough(),
    ),
    warnings: z.array(z.string()),
    mediaIntents: z.array(StoredMediaIntentSchema),
    operations: z.array(
      z
        .object({
          key: z.string(),
          action: z.string(),
          kind: z.string(),
          tempKey: z.string().optional(),
          title: z.string().optional(),
          dependsOn: z.array(z.string()).optional(),
          required: z.boolean().optional(),
        })
        .passthrough(),
    ),
    appliedResult: z.unknown().optional(),
    createdAt: z.string(),
    updatedAt: z.string(),
    expiresAt: z.string().optional(),
    appliedAt: z.string().optional(),
    rejectedAt: z.string().optional(),
    undoneAt: z.string().optional(),
  })
  .passthrough();

const ListCampaignsOutputSchema = z.object({ campaigns: z.array(CampaignSummarySchema) }).strict();
const GetCampaignOutputSchema = z.object({ campaign: CampaignSummarySchema }).strict();
const ConciseEntitySchema = z
  .object({
    id: z.string(),
    kind: ReadableEntityKindSchema,
    title: z.string(),
    subtitle: z.string().optional(),
    summary: z.string().optional(),
    tags: z.array(z.string()).optional(),
  })
  .strict();
const CampaignEntityCountsSchema = z
  .object({
    location: z.number().int().nonnegative(),
    player: z.number().int().nonnegative(),
    npc: z.number().int().nonnegative(),
    monster: z.number().int().nonnegative(),
    quest: z.number().int().nonnegative(),
    lore: z.number().int().nonnegative(),
    event: z.number().int().nonnegative(),
  })
  .strict();
const GetCampaignOutlineOutputSchema = z
  .object({
    outline: z
      .object({
        campaign: CampaignSummarySchema,
        counts: CampaignEntityCountsSchema,
        items: z.array(ConciseEntitySchema).max(12 * ReadableEntityKindSchema.options.length),
        truncated: z.boolean(),
      })
      .strict(),
  })
  .strict();
const SearchEntitiesOutputSchema = z
  .object({
    search: z
      .object({
        campaignId: z.string(),
        query: z.string(),
        totalMatches: z.number().int().nonnegative(),
        truncated: z.boolean(),
        results: z.array(ConciseEntitySchema.extend({ matchedText: z.string().optional() })).max(50),
      })
      .strict(),
  })
  .strict();
const GetEntityOutputSchema = z
  .object({ campaignId: z.string(), kind: z.string(), entity: GenericRecordSchema })
  .strict();
const ProposalOutputSchema = z.object({ proposal: ProposalSchema }).strict();
const ProposalListOutputSchema = z.object({ proposals: z.array(ProposalSchema) }).strict();
const MediaOutputSchema = z
  .object({ proposal: ProposalSchema, media: StoredMediaIntentSchema })
  .strict();

const safeErrorMessages = new Map<string, string>([
  ["request_too_large", "The proposal request is too large."],
  ["network_error", "The DND Master API could not be reached."],
  ["invalid_response", "The DND Master API returned an invalid response."],
  ["invalid_search_query", "The search query is invalid."],
  ["invalid_search_kinds", "The requested search kinds are invalid."],
  ["invalid_search_limit", "The requested search limit is invalid."],
  ["entity_not_found", "The requested campaign entity was not found."],
  ["media_path_not_allowed", "The proposal media path is not allowed."],
  ["media_not_found", "The proposal media file was not found."],
  ["media_not_file", "The proposal media path is not a regular file."],
  ["media_changed", "The proposal media file changed while it was being read."],
  ["media_read_failed", "The proposal media file could not be read."],
  ["media_too_large", "The proposal media file is too large."],
  ["file_too_large", "The proposal media file is too large."],
  ["unsupported_media_type", "The proposal media type is not supported."],
  ["unsupported_media", "The proposal media type is not supported."],
  ["media_cleanup_failed", "The media was staged, but its private source could not be safely removed."],
  ["auth_required", "DND Master authentication is required or has expired."],
  ["bad_request", "The DND Master API rejected the request."],
  ["not_found", "The requested DND Master record was not found."],
  ["proposals_unavailable", "AI proposals are currently unavailable."],
  ["uploads_disabled", "Proposal media uploads are unavailable."],
  ["missing_file", "A proposal media file is required."],
  ["missing_candidate", "A proposal candidate or patch is required."],
  ["missing_blueprint", "A campaign blueprint is required."],
  ["invalid_proposal_source", "The proposal source is not allowed."],
  ["invalid_blueprint", "The campaign blueprint is invalid."],
  ["invalid_candidate", "The proposal candidate is invalid."],
  ["invalid_patch", "The proposal patch is invalid."],
  ["invalid_generated_patch", "The generated proposal patch is invalid."],
  ["invalid_media_path", "The proposal media target is invalid."],
  ["invalid_media_url", "The proposal media URL is invalid."],
  ["invalid_mode", "The requested proposal mode is invalid."],
  ["invalid_operation", "The requested proposal operation is invalid."],
  ["invalid_relationship", "The proposal contains an invalid relationship."],
  ["kind_mismatch", "The proposal entity kind does not match."],
  ["missing_dependency", "The proposal is missing a required dependency."],
  ["duplicate_temp_key", "The proposal contains a duplicate temporary key."],
  ["duplicate_entity", "The proposed entity already exists."],
  ["duplicate_event", "The proposed event already exists."],
  ["duplicate_media", "The proposed media is already attached."],
  ["server_owned_media_fields", "The proposal contains server-owned media fields."],
  ["server_owned_media_status", "The proposal contains a server-owned media status."],
  ["unknown_operation", "The requested proposal operation is unknown."],
  ["unsupported_entity_kind", "The proposal entity kind is not supported."],
  ["unsupported_media_field", "The proposal media field is not supported."],
  ["unsupported_media_target", "The proposal media target is not supported."],
  ["unsupported_proposal_kind", "The proposal kind is not supported."],
  ["proposal_expired", "The proposal has expired."],
  ["proposal_not_applied", "The proposal is not applied."],
  ["proposal_not_pending", "The proposal is not pending."],
  ["stale_revision", "The proposal conflicts with newer campaign data."],
  ["generator_unavailable", "The proposal generator is unavailable."],
  ["generate_proposal_failed", "The proposal generator failed."],
  ["generate_campaign_proposal_failed", "The campaign proposal generator failed."],
  ["upload_prepare_failed", "Proposal media staging could not be prepared."],
  ["upload_open_failed", "Proposal media staging could not be opened."],
  ["upload_write_failed", "The proposal media file could not be staged."],
  ["proposal_failed", "The DND Master proposal operation failed."],
]);

function success(structuredContent: Record<string, unknown>, text: string): CallToolResult {
  return {
    structuredContent: sanitizeModelOutput(structuredContent),
    content: [{ type: "text", text }],
  };
}

function safeError(error: DndApiError): { code: string; message: string } {
  const knownMessage = safeErrorMessages.get(error.code);
  if (knownMessage) return { code: error.code, message: knownMessage };
  if (error.status === 401) {
    return { code: "auth_required", message: "DND Master authentication is required or has expired." };
  }
  if (error.status === 403) {
    return { code: "forbidden", message: "The DND Master operation is not allowed." };
  }
  if (error.status === 404) {
    return { code: "not_found", message: "The requested DND Master record was not found." };
  }
  if (error.status === 409) {
    return { code: "conflict", message: "The DND Master operation conflicts with current data." };
  }
  if (error.status === 413) {
    return { code: "request_too_large", message: "The DND Master request is too large." };
  }
  if (error.status === 429) {
    return { code: "rate_limited", message: "The DND Master API rate limit was reached." };
  }
  return { code: "api_error", message: "The DND Master API operation failed." };
}

function failure(error: unknown): CallToolResult {
  if (error instanceof DndApiError) {
    const safe = safeError(error);
    return {
      isError: true,
      content: [{ type: "text", text: `${safe.code}: ${safe.message}` }],
    };
  }
  return {
    isError: true,
    content: [{ type: "text", text: "The DND Master MCP operation failed unexpectedly." }],
  };
}

function proposalId(value: Record<string, unknown>): string | undefined {
  return typeof value.id === "string" ? value.id : undefined;
}

export function createDndMcpServer(client: DndMasterClient): McpServer {
  const server = new McpServer(
    { name: "shadow-edge-dnd-master", version: "0.1.0" },
    {
      instructions:
        "This server never applies campaign mutations. Write-intent tools only create persistent AI proposals or stage proposal media. Prefer get_campaign_outline, search_entities, and get_entity for focused reads; use get_campaign only when the complete authoritative campaign is needed. After creating a proposal, tell the user to review and apply it in the authenticated DND Master website. Read the campaign/entity before proposing an update, preserve omitted fields, and never claim a proposal has already been applied.",
    },
  );

  server.registerTool(
    "list_campaigns",
    {
      title: "List DND campaigns",
      description: "List campaigns owned by the authenticated DND Master account.",
      inputSchema: ListCampaignsInputSchema,
      outputSchema: ListCampaignsOutputSchema,
      annotations: readAnnotations,
    },
    async () => {
      try {
        const campaigns = await client.listCampaigns();
        return success({ campaigns }, `Found ${campaigns.length} campaign${campaigns.length === 1 ? "" : "s"}.`);
      } catch (error) {
        return failure(error);
      }
    },
  );

  server.registerTool(
    "get_campaign",
    {
      title: "Get DND campaign",
      description:
        "Read the complete authoritative campaign, including entities and events, before preparing a campaign proposal.",
      inputSchema: GetCampaignInputSchema,
      outputSchema: GetCampaignOutputSchema,
      annotations: readAnnotations,
    },
    async ({ campaignId }) => {
      try {
        const campaign = await client.getCampaign(campaignId);
        return success({ campaign }, `Loaded campaign ${campaign.title ?? campaign.id}.`);
      } catch (error) {
        return failure(error);
      }
    },
  );

  server.registerTool(
    "get_campaign_outline",
    {
      title: "Get DND campaign outline",
      description:
        "Read bounded campaign metadata, entity counts, and up to 12 concise references per entity kind. Use this before focused searches to avoid loading the complete campaign into context.",
      inputSchema: GetCampaignOutlineInputSchema,
      outputSchema: GetCampaignOutlineOutputSchema,
      annotations: readAnnotations,
    },
    async ({ campaignId }) => {
      try {
        const outline = await client.getCampaignOutline(campaignId);
        const count = Object.values(outline.counts).reduce((sum, value) => sum + value, 0);
        return success(
          { outline },
          `Loaded a bounded outline of ${outline.campaign.title ?? outline.campaign.id} with ${count} total records.`,
        );
      } catch (error) {
        return failure(error);
      }
    },
  );

  server.registerTool(
    "search_entities",
    {
      title: "Search DND entities",
      description:
        "Search authoritative entities and world events in one owned campaign. Returns at most 50 concise references and bounded match snippets, never complete records.",
      inputSchema: SearchEntitiesInputSchema,
      outputSchema: SearchEntitiesOutputSchema,
      annotations: readAnnotations,
    },
    async ({ campaignId, query, kinds, limit }) => {
      try {
        const search = await client.searchEntities(campaignId, query, kinds, limit);
        return success(
          { search },
          `Found ${search.totalMatches} matching record${search.totalMatches === 1 ? "" : "s"}; returned ${search.results.length}.`,
        );
      } catch (error) {
        return failure(error);
      }
    },
  );

  server.registerTool(
    "get_entity",
    {
      title: "Get DND entity",
      description:
        "Read one authoritative entity or world event from an owned campaign before proposing an update.",
      inputSchema: GetEntityInputSchema,
      outputSchema: GetEntityOutputSchema,
      annotations: readAnnotations,
    },
    async ({ campaignId, kind, entityId }) => {
      try {
        const result = await client.getEntity(campaignId, kind, entityId);
        const title = typeof result.entity.title === "string" ? result.entity.title : entityId;
        return success(result, `Loaded ${kind} ${title}.`);
      } catch (error) {
        return failure(error);
      }
    },
  );

  server.registerTool(
    "propose_campaign",
    {
      title: "Propose a DND campaign",
      description:
        "Create a persistent, review-only campaign blueprint with temporary keys. This never creates or changes campaign data; the user must apply selected operations in the website.",
      inputSchema: ProposeCampaignInputSchema,
      outputSchema: ProposalOutputSchema,
      annotations: proposalWriteAnnotations,
    },
    async (input) => {
      try {
        const proposal = await client.proposeCampaign(input);
        const id = proposalId(proposal);
        return success(
          { proposal },
          id
            ? `Created pending campaign proposal ${id}. Review it in AI-черновики before applying.`
            : "Created a pending campaign proposal. Review it in AI-черновики before applying.",
        );
      } catch (error) {
        return failure(error);
      }
    },
  );

  server.registerTool(
    "propose_entity_create",
    {
      title: "Propose a new DND entity",
      description:
        "Create a persistent proposal for a new location, player, NPC, monster, quest, lore entry, or world event/dialogue scene. This never inserts the entity directly.",
      inputSchema: ProposeEntityCreateInputSchema,
      outputSchema: ProposalOutputSchema,
      annotations: proposalWriteAnnotations,
    },
    async (input) => {
      try {
        const proposal = await client.proposeEntityCreate(input);
        const id = proposalId(proposal);
        return success(
          { proposal },
          id
            ? `Created pending entity proposal ${id}. Review it in AI-черновики before applying.`
            : "Created a pending entity proposal. Review it in AI-черновики before applying.",
        );
      } catch (error) {
        return failure(error);
      }
    },
  );

  server.registerTool(
    "propose_entity_update",
    {
      title: "Propose a DND entity update",
      description:
        "Create a persistent constrained entity or world-event update proposal. Call get_entity first and send only intentional fields in patch; the server preserves omitted media, relationships, cards, dialogue, and combat data. This never updates campaign data directly.",
      inputSchema: ProposeEntityUpdateInputSchema,
      outputSchema: ProposalOutputSchema,
      annotations: proposalWriteAnnotations,
    },
    async (input) => {
      try {
        const proposal = await client.proposeEntityUpdate(input);
        const id = proposalId(proposal);
        return success(
          { proposal },
          id
            ? `Created pending update proposal ${id}. Review it in AI-черновики before applying.`
            : "Created a pending update proposal. Review it in AI-черновики before applying.",
        );
      } catch (error) {
        return failure(error);
      }
    },
  );

  server.registerTool(
    "list_proposals",
    {
      title: "List AI proposals",
      description: "List proposals owned by the authenticated account, optionally filtered by status or campaign.",
      inputSchema: ListProposalsInputSchema,
      outputSchema: ProposalListOutputSchema,
      annotations: readAnnotations,
    },
    async (filters) => {
      try {
        const proposals = await client.listProposals(filters);
        return success({ proposals }, `Found ${proposals.length} proposal${proposals.length === 1 ? "" : "s"}.`);
      } catch (error) {
        return failure(error);
      }
    },
  );

  server.registerTool(
    "get_proposal",
    {
      title: "Get AI proposal",
      description:
        "Read a complete owned proposal, including before/after candidates, differences, warnings, and media intents.",
      inputSchema: GetProposalInputSchema,
      outputSchema: ProposalOutputSchema,
      annotations: readAnnotations,
    },
    async ({ proposalId }) => {
      try {
        const proposal = await client.getProposal(proposalId);
        return success({ proposal }, `Loaded proposal ${proposalId}.`);
      } catch (error) {
        return failure(error);
      }
    },
  );

  server.registerTool(
    "stage_proposal_media",
    {
      title: "Stage proposal image",
      description:
        "Read a PNG, JPEG, or WebP from a configured local media root and stage it for an existing proposal. The file is temporary and is not promoted into campaign uploads unless the user applies the proposal in the website. Remote URLs are not accepted.",
      inputSchema: StageProposalMediaInputSchema,
      outputSchema: MediaOutputSchema,
      annotations: proposalWriteAnnotations,
    },
    async (input) => {
      try {
        const result = await client.stageProposalMedia(input);
        return success(result, `Staged media for proposal ${input.proposalId}; it is not applied campaign data.`);
      } catch (error) {
        return failure(error);
      }
    },
  );

  server.registerTool(
    "attach_proposal_media",
    {
      title: "Attach staged proposal image",
      description:
        "Attach or update metadata for an already staged media ID on a proposal. This only changes the proposal draft and never promotes the file into campaign data.",
      inputSchema: AttachProposalMediaInputSchema,
      outputSchema: MediaOutputSchema,
      annotations: attachmentWriteAnnotations,
    },
    async (input) => {
      try {
        const result = await client.attachProposalMedia(input);
        return success(result, `Attached staged media to proposal ${input.proposalId}; it remains unapplied.`);
      } catch (error) {
        return failure(error);
      }
    },
  );

  return server;
}

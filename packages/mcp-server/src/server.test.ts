import assert from "node:assert/strict";
import { createServer as createHttpServer } from "node:http";
import type { AddressInfo } from "node:net";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import {
  getDefaultEnvironment,
  StdioClientTransport,
} from "@modelcontextprotocol/sdk/client/stdio.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { DndMasterClient } from "./client.js";
import type { DndMcpConfig } from "./config.js";
import { createDndMcpServer } from "./server.js";
import {
  AttachProposalMediaInputSchema,
  MediaIntentSchema,
  ProposeCampaignInputSchema,
  ProposeEntityCreateInputSchema,
  StageProposalMediaInputSchema,
} from "./schemas.js";

const testConfig: DndMcpConfig = {
  baseUrl: new URL("http://127.0.0.1:8080/"),
  sessionCookie: "shadow_edge_session=test-session",
  mediaRoots: [process.cwd()],
  mediaMaxBytes: 10 * 1024 * 1024,
  requestTimeoutMs: 5_000,
  sourceType: "mcp",
};

function response(data: unknown, status = 200): Response {
  return new Response(JSON.stringify({ data, error: null, meta: {} }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

test("proposal media inputs reject server-owned fields and lifecycle states", () => {
  const validInput = {
    id: "media-intent-1",
    purpose: "portrait",
    operationKey: "entity:new",
    field: "art.url",
    prompt: "A painted portrait.",
    alt: "Portrait",
    caption: "Proposed art",
    selected: true,
  };

  for (const status of ["requested", "placeholder", "unavailable"] as const) {
    assert.equal(MediaIntentSchema.safeParse({ ...validInput, status }).success, true);
  }

  for (const serverOwnedField of [
    { previewUrl: "/api/ai/proposals/example/media/example" },
    { finalUrl: "/api/uploads/example.png" },
    { contentType: "image/png" },
    { size: 1234 },
  ]) {
    assert.equal(
      MediaIntentSchema.safeParse({ ...validInput, ...serverOwnedField }).success,
      false,
    );
  }

  for (const serverLifecycleStatus of ["intent", "staged", "promoted", "discarded"]) {
    assert.equal(
      MediaIntentSchema.safeParse({ ...validInput, status: serverLifecycleStatus }).success,
      false,
    );
  }
});

test("proposal media schemas match backend target boundaries", () => {
  const blueprint = {
    campaign: { title: "Campaign" },
    entities: [{ tempKey: "npc:arden", kind: "npc", title: "Arden" }],
  };
  const media = { field: "art.url" as const, prompt: "Portrait of Arden" };

  assert.equal(
    ProposeCampaignInputSchema.safeParse({ prompt: "Create it", blueprint, mediaIntents: [media] })
      .success,
    false,
    "campaign media without an entity operation key must be rejected before the API call",
  );
  assert.equal(
    ProposeCampaignInputSchema.safeParse({
      prompt: "Create it",
      blueprint,
      mediaIntents: [{ ...media, operationKey: "entity:npc:arden" }],
    }).success,
    true,
  );

  const maximumTempKey = "a".repeat(100);
  const maximumOperationKey = `entity:${maximumTempKey}`;
  const longKeyBlueprint = {
    campaign: { title: "Long key campaign" },
    entities: [{ tempKey: maximumTempKey, kind: "npc" as const, title: "Arden" }],
  };
  assert.equal(
    ProposeCampaignInputSchema.safeParse({
      prompt: "Create it",
      blueprint: longKeyBlueprint,
      mediaIntents: [{ ...media, operationKey: maximumOperationKey }],
    }).success,
    true,
  );
  assert.equal(
    StageProposalMediaInputSchema.safeParse({
      proposalId: "proposal-1",
      localPath: "portrait.png",
      operationKey: maximumOperationKey,
    }).success,
    true,
    "every valid campaign entity operation key must remain usable while staging media",
  );
  assert.equal(
    AttachProposalMediaInputSchema.safeParse({
      proposalId: "proposal-1",
      mediaId: "media-1",
      operationKey: maximumOperationKey,
    }).success,
    true,
    "every valid campaign entity operation key must remain usable while attaching media",
  );

  const duplicateBlueprint = {
    campaign: { title: "Duplicate keys" },
    entities: [
      { tempKey: "shared", kind: "npc" as const, title: "First" },
      { tempKey: "shared", kind: "quest" as const, title: "Second" },
    ],
  };
  assert.equal(
    ProposeCampaignInputSchema.safeParse({ prompt: "Create it", blueprint: duplicateBlueprint })
      .success,
    false,
    "duplicate entity tempKeys must be rejected before the API call",
  );
  assert.equal(
    ProposeCampaignInputSchema.safeParse({
      prompt: "Create it",
      blueprint: {
        campaign: { title: "Cross-kind duplicate" },
        entities: [{ tempKey: "shared", kind: "location", title: "Place" }],
        events: [{ tempKey: "shared", title: "Scene", summary: "Summary", type: "social", sceneText: "Text" }],
      },
    }).success,
    false,
    "entity and event tempKeys share one backend namespace",
  );
  assert.equal(
    ProposeCampaignInputSchema.safeParse({
      prompt: "Create it",
      blueprint,
      mediaIntents: [{ ...media, operationKey: "npc:arden" }],
    }).success,
    false,
    "bare blueprint tempKeys are not backend operation keys",
  );
  assert.equal(
    ProposeCampaignInputSchema.safeParse({
      prompt: "Create it",
      blueprint,
      mediaIntents: [{ ...media, operationKey: "entity:missing" }],
    }).success,
    false,
    "campaign media must reference an entity present in the same blueprint",
  );
  assert.equal(
    ProposeCampaignInputSchema.safeParse({
      prompt: "Create it",
      blueprint,
      mediaIntents: [{ ...media, operationKey: "campaign" }],
    }).success,
    false,
    "campaign-root media must be rejected",
  );
  assert.equal(
    ProposeEntityCreateInputSchema.safeParse({
      campaignId: "campaign-1",
      prompt: "Create an event",
      kind: "event",
      candidate: { title: "Storm" },
      mediaIntents: [media],
    }).success,
    false,
    "world-event media must be rejected",
  );
  assert.equal(
    ProposeEntityCreateInputSchema.safeParse({
      campaignId: "campaign-1",
      prompt: "Create an NPC",
      kind: "npc",
      candidate: { title: "Arden" },
      mediaIntents: [media],
    }).success,
    true,
  );
});

test("server advertises focused tools with accurate proposal-only annotations", async (t) => {
  let proposedBody: Record<string, unknown> | undefined;
  const mockFetch = (async (input: URL | RequestInfo, init?: RequestInit) => {
    const url = new URL(input instanceof URL ? input.href : String(input));
    if (url.pathname === "/api/campaigns/campaign-1" && init?.method === "GET") {
      return response({
        id: "campaign-1",
        title: "Campaign One",
        locations: [{ id: "location-1", title: "Dragon Gate", summary: "A sealed gate." }],
        quests: [{ id: "quest-1", title: "Open the Gate", content: "Find the dragon key." }],
      });
    }
    if (url.pathname === "/api/ai/proposals/entity" && init?.method === "POST") {
      proposedBody = JSON.parse(String(init.body)) as Record<string, unknown>;
      return response(
        {
          id: "proposal-1",
          ownerId: "owner-1",
          campaignId: "campaign-1",
          kind: "entity_update",
          status: "pending",
          target: {
            campaignId: "campaign-1",
            entityId: "quest-1",
            entityKind: "quest",
          },
          baseRevisions: { campaign: 1, "entity:quest-1": 2 },
          prompt: "Increase urgency and preserve all other fields.",
          source: { type: "mcp" },
          before: { id: "quest-1", urgency: "High" },
          after: { id: "quest-1", urgency: "Critical" },
          diff: [{ path: "urgency", before: "High", after: "Critical" }],
          warnings: [],
          mediaIntents: [],
          operations: [
            {
              key: "entity:quest-1",
              action: "update",
              kind: "quest",
              title: "Quest",
              required: true,
            },
          ],
          createdAt: "2026-09-01T00:00:00Z",
          updatedAt: "2026-09-01T00:00:00Z",
          expiresAt: "2026-09-08T00:00:00Z",
        },
        201,
      );
    }
    return response([]);
  }) as typeof fetch;

  const server = createDndMcpServer(new DndMasterClient(testConfig, mockFetch));
  const client = new Client({ name: "mcp-test-client", version: "1.0.0" });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  t.after(async () => {
    await client.close();
    await server.close();
  });
  await server.connect(serverTransport);
  await client.connect(clientTransport);

  const listed = await client.listTools();
  const names = listed.tools.map((tool) => tool.name).sort();
  assert.deepEqual(names, [
    "attach_proposal_media",
    "get_campaign",
    "get_campaign_outline",
    "get_entity",
    "get_proposal",
    "list_campaigns",
    "list_proposals",
    "propose_campaign",
    "propose_entity_create",
    "propose_entity_update",
    "search_entities",
    "stage_proposal_media",
  ]);
  assert.equal(names.some((name) => /apply|reject|undo/.test(name)), false);

  for (const tool of listed.tools) {
    assert.equal(tool.annotations?.openWorldHint, false, `${tool.name} must stay closed-world`);
    assert.equal(tool.annotations?.destructiveHint, false, `${tool.name} must be non-destructive`);
    const isRead =
      tool.name.startsWith("list_") ||
      tool.name.startsWith("get_") ||
      tool.name === "search_entities";
    assert.equal(tool.annotations?.readOnlyHint, isRead, `${tool.name} readOnlyHint mismatch`);
  }

  const outlineResult = await client.callTool({
    name: "get_campaign_outline",
    arguments: { campaignId: "campaign-1" },
  });
  assert.equal(outlineResult.isError, undefined);
  assert.equal(
    (outlineResult.structuredContent as { outline: { counts: { location: number } } }).outline
      .counts.location,
    1,
  );

  const searchResult = await client.callTool({
    name: "search_entities",
    arguments: { campaignId: "campaign-1", query: "dragon", kinds: ["quest"], limit: 10 },
  });
  assert.equal(searchResult.isError, undefined);
  assert.equal(
    (searchResult.structuredContent as { search: { results: Array<{ id: string }> } }).search
      .results[0]?.id,
    "quest-1",
  );
  for (const invalidArguments of [
    { campaignId: "campaign-1", query: "   " },
    { campaignId: "campaign-1", query: "dragon", kinds: ["quest", "quest"] },
    { campaignId: "campaign-1", query: "dragon", kinds: ["artifact"] },
    { campaignId: "campaign-1", query: "dragon", limit: 51 },
  ]) {
    const invalidResult = await client.callTool({
      name: "search_entities",
      arguments: invalidArguments,
    });
    assert.equal(invalidResult.isError, true);
    const invalidContent = (invalidResult as {
      content: Array<{ type: string; text?: string }>;
    }).content;
    assert.match(
      invalidContent
        .filter((item) => item.type === "text")
        .map((item) => item.text ?? "")
        .join(" "),
      /validation error/i,
    );
  }

  const callResult = await client.callTool({
    name: "propose_entity_update",
    arguments: {
      campaignId: "campaign-1",
      entityId: "quest-1",
      kind: "quest",
      prompt: "Increase urgency and preserve all other fields.",
      patch: { urgency: "Critical" },
    },
  });

  assert.equal(callResult.isError, undefined);
  assert.deepEqual(proposedBody, {
    campaignId: "campaign-1",
    entityId: "quest-1",
    kind: "quest",
    prompt: "Increase urgency and preserve all other fields.",
    patch: { urgency: "Critical" },
    mode: "update",
    source: { type: "mcp" },
  });
  assert.equal(
    (callResult.structuredContent as { proposal: { status: string } }).proposal.status,
    "pending",
  );
});

test("compiled entrypoint speaks MCP over a real stdio child process", async (t) => {
  const httpServer = createHttpServer((request, response) => {
    response.statusCode = 200;
    response.setHeader("Content-Type", "application/json");
    if (request.url === "/api/ai/proposals/proposal-intent") {
      response.end(
        JSON.stringify({
          data: {
            id: "proposal-intent",
            ownerId: "owner-1",
            campaignId: "campaign-1",
            kind: "entity_create",
            status: "pending",
            target: { campaignId: "campaign-1", entityKind: "npc" },
            baseRevisions: { campaign: 1 },
            prompt: "Create an NPC with a portrait intent.",
            source: { type: "mcp" },
            before: null,
            after: { title: "Arden" },
            diff: [],
            warnings: [],
            mediaIntents: [{ id: "media-intent-1", status: "intent", prompt: "Portrait of Arden" }],
            operations: [{ key: "entity:new", action: "create", kind: "npc", required: true }],
            createdAt: "2026-09-01T00:00:00Z",
            updatedAt: "2026-09-01T00:00:00Z",
          },
          error: null,
          meta: {},
        }),
      );
      return;
    }
    response.statusCode = 404;
    response.end(JSON.stringify({ error: { code: "not_found", message: "Not found" } }));
  });
  await new Promise<void>((resolve, reject) => {
    httpServer.once("error", reject);
    httpServer.listen(0, "127.0.0.1", resolve);
  });
  t.after(() => {
    httpServer.close();
  });
  const address = httpServer.address() as AddressInfo;
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [fileURLToPath(new URL("./index.js", import.meta.url))],
    env: {
      ...getDefaultEnvironment(),
      DND_MASTER_BASE_URL: `http://127.0.0.1:${address.port}`,
      DND_MASTER_SESSION_COOKIE: "test-session",
    },
    stderr: "pipe",
  });
  const client = new Client({ name: "stdio-test-client", version: "1.0.0" });
  t.after(async () => {
    await client.close();
  });

  await client.connect(transport);
  const tools = await client.listTools(undefined, { timeout: 5_000 });
  assert.equal(tools.tools.some((tool) => tool.name === "propose_campaign"), true);
  assert.equal(tools.tools.some((tool) => tool.name === "get_campaign_outline"), true);
  assert.equal(tools.tools.some((tool) => tool.name === "search_entities"), true);
  assert.equal(tools.tools.some((tool) => tool.name === "apply_proposal"), false);

  const proposal = await client.callTool(
    { name: "get_proposal", arguments: { proposalId: "proposal-intent" } },
    undefined,
    { timeout: 5_000 },
  );
  assert.equal(proposal.isError, undefined);
  assert.equal(
    (proposal.structuredContent as { proposal: { mediaIntents: Array<{ status: string }> } })
      .proposal.mediaIntents[0]?.status,
    "intent",
  );
});

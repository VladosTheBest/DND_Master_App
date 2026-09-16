import assert from "node:assert/strict";
import { access, appendFile, mkdtemp, open, readFile, rename, rm, symlink, writeFile } from "node:fs/promises";
import type { FileHandle } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { DndApiError, DndMasterClient } from "./client.js";
import type { DndMcpConfig } from "./config.js";
import { SessionJournalSchema } from "./schemas.js";

function config(overrides: Partial<DndMcpConfig> = {}): DndMcpConfig {
  return {
    baseUrl: new URL("http://127.0.0.1:8080/"),
    sessionCookie: "shadow_edge_session=test-session",
    mediaRoots: [process.cwd()],
    mediaMaxBytes: 10 * 1024 * 1024,
    requestTimeoutMs: 5_000,
    sourceType: "mcp",
    ...overrides,
  };
}

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify({ data, error: null, meta: {} }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

test("session transcript pages preserve Unicode and session analysis writes stay separate from entities", async () => {
  const original = "🙂Привет ".repeat(6000);
  const analysis = {
    runId: "analysis-test", digest: "a".repeat(64), summary: "Итог",
    recap: "Партия осмотрела мост.\n\nЗатем нашла следы 🐉.",
    keyEvents: ["Осмотр моста"], players: [{ name: "Арина", actions: ["Нашла следы"], moments: [], nextSessionFocus: "Исследовать следы" }],
    nextSession: ["Продолжить путь"], uncertainties: [], proposalIds: [],
    journal: { version: 1, locations: [], entries: [], speech: [] },
  };
  const calls:Array<{url:string;init?:RequestInit}>=[];
  const client = new DndMasterClient(config(), (async (url, init) => {
    calls.push({url:String(url),init});
    if (init?.method === "PUT") {
      // An empty request must fail as it does at the real Go endpoint.
      assert.equal(new Headers(init.headers).get("Content-Type"), "application/json");
      const received = JSON.parse(String(init.body));
      assert.deepEqual(received, analysis);
      return jsonResponse(received);
    }
    return jsonResponse({id:"session-1",title:"Игра",text:original,digest:"a".repeat(64),participants:["Арина"]});
  }) as typeof fetch);
  let offset=0, text="";
  do { const page=await client.getSessionTranscript("campaign-1","session-1",offset);text+=page.text;offset=page.nextOffset as number; } while(offset!==null);
  assert.equal(text,original);
  assert.deepEqual(await client.saveSessionAnalysis("campaign-1","session-1",analysis), analysis);
  assert.equal(calls.at(-1)?.init?.method,"PUT");
  assert.match(calls.at(-1)?.url || "",/sessions\/session-1\/analysis$/);
});

test("numbered transcript pages keep absolute line references across Unicode and partial lines", async () => {
  const original = "Заголовок\n" + "🙂".repeat(24010) + "\nПоследняя строка";
  const client = new DndMasterClient(config(), (async () => jsonResponse({id:"s",title:"Demo",text:original,digest:"a".repeat(64),participants:[]})) as typeof fetch);
  const first = await client.getSessionTranscript("c", "s");
  assert.equal(first.firstLine, 1);
  assert.match(String(first.numberedText), /^\[L1\] Заголовок\n\[L2\] 🙂/);
  const second = await client.getSessionTranscript("c", "s", first.nextOffset as number);
  assert.equal(second.firstLine, 2);
  assert.match(String(second.numberedText), /^\[L2\] 🙂+\n\[L3\] Последняя строка$/u);
  assert.equal(String(first.text) + String(second.text), original);
  assert.equal(second.nextOffset, null);
});

test("journal tool schema preserves structured findings and rejects unsupported labels or source ranges", () => {
  const journal = {version:1,locations:[],entries:[{id:"e",kind:"discovery",title:"Следы",detail:"Следы у дороги",people:[],status:"uncertain",sources:[{fromLine:4,toLine:5}]}],speech:[{fromLine:4,toLine:5,kind:"uncertain"}]};
  assert.deepEqual(SessionJournalSchema.parse(journal),journal);
  assert.equal(SessionJournalSchema.safeParse({...journal,entries:[{...journal.entries[0],kind:"rumor"}]}).success,false);
  assert.equal(SessionJournalSchema.safeParse({...journal,entries:[{...journal.entries[0],sources:[{fromLine:5,toLine:4}]}]}).success,false);
  assert.equal(SessionJournalSchema.safeParse({...journal,speech:[{fromLine:4,toLine:5,kind:"probably-game"}]}).success,false);
});

test("proposal writes use the proposal endpoint and never an apply route", async () => {
  const calls: Array<{ url: URL; init?: RequestInit }> = [];
  const mockFetch = (async (input: URL | RequestInfo, init?: RequestInit) => {
    calls.push({ url: new URL(input instanceof URL ? input.href : String(input)), init });
    return jsonResponse({ id: "proposal-1", status: "pending" }, 201);
  }) as typeof fetch;
  const client = new DndMasterClient(config(), mockFetch);

  const proposal = await client.proposeEntityUpdate({
    campaignId: "campaign-1",
    entityId: "quest-1",
    kind: "quest",
    prompt: "Make the deadline urgent without changing its relationships.",
    patch: { urgency: "Critical" },
  });

  assert.equal(proposal.id, "proposal-1");
  assert.equal(calls.length, 1);
  assert.equal(calls[0]?.url.pathname, "/api/ai/proposals/entity");
  assert.equal(calls[0]?.init?.method, "POST");
  assert.equal(new Headers(calls[0]?.init?.headers).get("Cookie"), "shadow_edge_session=test-session");
  const body = JSON.parse(String(calls[0]?.init?.body)) as Record<string, unknown>;
  assert.equal(body.mode, "update");
  assert.deepEqual(body.source, { type: "mcp" });
  assert.deepEqual(body.patch, { urgency: "Critical" });
  assert.equal(calls[0]?.url.pathname.includes("apply"), false);
});

test("world events use the dedicated proposal route while keeping the focused entity tool contract", async () => {
  let requestUrl: URL | undefined;
  let requestBody: Record<string, unknown> | undefined;
  const mockFetch = (async (input: URL | RequestInfo, init?: RequestInit) => {
    requestUrl = new URL(input instanceof URL ? input.href : String(input));
    requestBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
    return jsonResponse({ id: "proposal-event-1", status: "pending" }, 201);
  }) as typeof fetch;
  const client = new DndMasterClient(config(), mockFetch);

  await client.proposeEntityUpdate({
    campaignId: "campaign-1",
    entityId: "event-1",
    kind: "event",
    prompt: "Add a peaceful dialogue branch.",
    patch: {
      dialogueBranches: [{ title: "Parley", lines: ["We can still settle this."] }],
    },
  });

  assert.equal(requestUrl?.pathname, "/api/ai/proposals/event");
  assert.equal(requestBody?.eventId, "event-1");
  assert.equal(requestBody?.entityId, undefined);
  assert.equal(requestBody?.kind, undefined);
  assert.equal(requestBody?.mode, "update");
});

test("attachProposalMedia updates proposal metadata only", async () => {
  let requestUrl: URL | undefined;
  let requestBody: Record<string, unknown> | undefined;
  const mockFetch = (async (input: URL | RequestInfo, init?: RequestInit) => {
    requestUrl = new URL(input instanceof URL ? input.href : String(input));
    requestBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
    return jsonResponse({
      proposal: { id: "proposal-1", status: "pending" },
      media: { id: "media-1", selected: true },
    });
  }) as typeof fetch;
  const client = new DndMasterClient(config(), mockFetch);

  await client.attachProposalMedia({
    proposalId: "proposal-1",
    mediaId: "media-1",
    purpose: "key_scene",
    selected: true,
  });

  assert.equal(requestUrl?.pathname, "/api/ai/proposals/proposal-1/media/attachments");
  assert.deepEqual(requestBody, {
    mediaId: "media-1",
    purpose: "key_scene",
    selected: true,
  });
});

test("getEntity reads the authoritative campaign and selects the requested collection", async () => {
  const mockFetch = (async () =>
    jsonResponse({
      id: "campaign-1",
      quests: [
        { id: "quest-1", kind: "quest", title: "First" },
        { id: "quest-2", kind: "quest", title: "Second" },
      ],
    })) as typeof fetch;
  const client = new DndMasterClient(config(), mockFetch);

  const result = await client.getEntity("campaign-1", "quest", "quest-2");
  assert.equal(result.entity.title, "Second");
});

test("getEntity reports a closed not-found error", async () => {
  const mockFetch = (async () => jsonResponse({ id: "campaign-1", npcs: [] })) as typeof fetch;
  const client = new DndMasterClient(config(), mockFetch);

  await assert.rejects(
    client.getEntity("campaign-1", "npc", "npc-missing"),
    (error: unknown) => error instanceof DndApiError && error.code === "entity_not_found",
  );
});

test("getCampaignOutline returns bounded concise references and authoritative counts", async () => {
  const locations = Array.from({ length: 15 }, (_, index) => ({
    id: `location-${index + 1}`,
    title: `Location ${index + 1}`,
    summary: "A ".repeat(500),
    content: "This full body must not be returned by the outline.",
  }));
  const mockFetch = (async () =>
    jsonResponse({
      id: "campaign-1",
      title: "The Long Road",
      summary: "Campaign summary",
      locations,
      quests: [{ id: "quest-1", title: "A Small Beginning", tags: ["starter"] }],
      events: [{ id: "event-1", title: "First Night" }],
    })) as typeof fetch;
  const client = new DndMasterClient(config(), mockFetch);

  const outline = await client.getCampaignOutline("campaign-1");

  assert.equal(outline.counts.location, 15);
  assert.equal(outline.counts.quest, 1);
  assert.equal(outline.counts.event, 1);
  assert.equal(outline.items.filter((item) => item.kind === "location").length, 12);
  assert.equal(outline.items.length, 14);
  assert.equal(outline.truncated, true);
  assert.equal("content" in outline.items[0]!, false);
  assert.ok((outline.items[0]?.summary?.length ?? 0) <= 400);
});

test("searchEntities validates filters and returns ranked bounded results", async () => {
  let fetchCalls = 0;
  const mockFetch = (async () => {
    fetchCalls += 1;
    return jsonResponse({
      id: "campaign-1",
      quests: [
        { id: "quest-2", title: "Track the Dragon", summary: "Find its mountain lair." },
        { id: "quest-1", title: "Dragon", summary: "Negotiate before the eclipse." },
      ],
      npcs: [{ id: "npc-1", title: "Archivist", content: "She studies dragon legends." }],
    });
  }) as typeof fetch;
  const client = new DndMasterClient(config(), mockFetch);

  const result = await client.searchEntities("campaign-1", " dragon ", ["quest"], 1);
  assert.equal(result.query, "dragon");
  assert.equal(result.totalMatches, 2);
  assert.equal(result.truncated, true);
  assert.equal(result.results.length, 1);
  assert.equal(result.results[0]?.id, "quest-1");
  assert.equal(result.results[0]?.kind, "quest");
  assert.ok((result.results[0]?.matchedText?.length ?? 0) <= 320);
  assert.equal("content" in result.results[0]!, false);
  assert.equal(fetchCalls, 1);

  await assert.rejects(
    client.searchEntities("campaign-1", "   "),
    (error: unknown) => error instanceof DndApiError && error.code === "invalid_search_query",
  );
  await assert.rejects(
    client.searchEntities("campaign-1", "dragon", ["quest", "quest"]),
    (error: unknown) => error instanceof DndApiError && error.code === "invalid_search_kinds",
  );
  await assert.rejects(
    client.searchEntities("campaign-1", "dragon", ["quest"], 51),
    (error: unknown) => error instanceof DndApiError && error.code === "invalid_search_limit",
  );
  assert.equal(fetchCalls, 1, "invalid searches must fail before reading campaign data");
});

test("stageProposalMedia verifies a local image and sends multipart proposal data", async () => {
  const mediaRoot = await mkdtemp(path.join(os.tmpdir(), "dnd-mcp-media-"));
  const imagePath = path.join(mediaRoot, "portrait.bin");
  await writeFile(
    imagePath,
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]),
  );

  let requestUrl: URL | undefined;
  let requestForm: FormData | undefined;
  const mockFetch = (async (input: URL | RequestInfo, init?: RequestInit) => {
    requestUrl = new URL(input instanceof URL ? input.href : String(input));
    requestForm = init?.body as FormData;
    return jsonResponse({
      proposal: { id: "proposal-1", status: "pending" },
      media: { id: "media-1", status: "staged" },
    });
  }) as typeof fetch;
  const client = new DndMasterClient(config({ mediaRoots: [mediaRoot] }), mockFetch);

  const result = await client.stageProposalMedia({
    proposalId: "proposal-1",
    localPath: imagePath,
    purpose: "portrait",
    field: "art",
  });

  assert.equal(requestUrl?.pathname, "/api/ai/proposals/proposal-1/media");
  assert.equal(requestForm?.get("purpose"), "portrait");
  assert.equal(requestForm?.get("field"), "art");
  assert.equal((requestForm?.get("file") as File).type, "image/png");
  assert.deepEqual(result.media, { id: "media-1", status: "staged" });
});

test("managed bridge staging rejects and retains paths outside configured roots", async () => {
  const mediaRoot = await mkdtemp(path.join(os.tmpdir(), "dnd-mcp-root-"));
  const outsideRoot = await mkdtemp(path.join(os.tmpdir(), "dnd-mcp-outside-"));
  const imagePath = path.join(outsideRoot, "portrait.png");
  await writeFile(
    imagePath,
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]),
  );
  let called = false;
  const mockFetch = (async () => {
    called = true;
    return jsonResponse({});
  }) as typeof fetch;
  const client = new DndMasterClient(
    config({ mediaRoots: [mediaRoot], sourceType: "codex_app_server" }),
    mockFetch,
  );

  await assert.rejects(
    client.stageProposalMedia({ proposalId: "proposal-1", localPath: imagePath }),
    (error: unknown) => error instanceof DndApiError && error.code === "media_path_not_allowed",
  );
  assert.equal(called, false);
  await access(imagePath);
});

test("proposal media rejects URI, UNC, and device paths before filesystem or API access", async (t) => {
  const mediaRoot = await mkdtemp(path.join(os.tmpdir(), "dnd-mcp-path-syntax-"));
  t.after(() => rm(mediaRoot, { recursive: true, force: true }));
  let fetchCalls = 0;
  const client = new DndMasterClient(
    config({ mediaRoots: [mediaRoot] }),
    (async () => {
      fetchCalls += 1;
      return jsonResponse({});
    }) as typeof fetch,
  );

  for (const localPath of [
    "file:///tmp/portrait.png",
    "https://example.invalid/portrait.png",
    String.raw`\\example.invalid\share\portrait.png`,
    String.raw`\\?\C:\private\portrait.png`,
    String.raw`\\.\C:\private\portrait.png`,
    String.raw`\??\C:\private\portrait.png`,
    String.raw`\Device\HarddiskVolume1\private\portrait.png`,
    "NUL",
    "nul.png",
    "CON",
    "AUX.txt",
    String.raw`C:\private\COM1.jpeg`,
    String.raw`C:\private\lPt9.webp`,
  ]) {
    await assert.rejects(
      client.stageProposalMedia({ proposalId: "proposal-1", localPath }),
      (error: unknown) => error instanceof DndApiError && error.code === "media_path_not_allowed",
    );
  }
  assert.equal(fetchCalls, 0);
});

test("proposal media rejects a symlinked directory that resolves outside the configured root", async (t) => {
  const mediaRoot = await mkdtemp(path.join(os.tmpdir(), "dnd-mcp-symlink-root-"));
  const outsideRoot = await mkdtemp(path.join(os.tmpdir(), "dnd-mcp-symlink-outside-"));
  t.after(() => Promise.all([
    rm(mediaRoot, { recursive: true, force: true }),
    rm(outsideRoot, { recursive: true, force: true }),
  ]));
  const imagePath = path.join(outsideRoot, "portrait.png");
  await writeFile(
    imagePath,
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]),
  );
  const linkedDirectory = path.join(mediaRoot, "linked");
  try {
    await symlink(outsideRoot, linkedDirectory, process.platform === "win32" ? "junction" : "dir");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "EPERM") {
      t.skip("directory symlinks are not permitted on this host");
      return;
    }
    throw error;
  }
  let fetchCalls = 0;
  const client = new DndMasterClient(
    config({ mediaRoots: [mediaRoot] }),
    (async () => {
      fetchCalls += 1;
      return jsonResponse({});
    }) as typeof fetch,
  );

  await assert.rejects(
    client.stageProposalMedia({
      proposalId: "proposal-1",
      localPath: path.join(linkedDirectory, "portrait.png"),
    }),
    (error: unknown) => error instanceof DndApiError && error.code === "media_path_not_allowed",
  );
  assert.equal(fetchCalls, 0);
});

test("proposal media larger than 32 MiB is rejected before file read or API access", async (t) => {
  const mediaRoot = await mkdtemp(path.join(os.tmpdir(), "dnd-mcp-media-limit-"));
  t.after(() => rm(mediaRoot, { recursive: true, force: true }));
  const imagePath = path.join(mediaRoot, "oversized.png");
  const image = await open(imagePath, "w");
  await image.truncate(32 * 1024 * 1024 + 1);
  await image.close();
  let fetchCalls = 0;
  const client = new DndMasterClient(
    config({ mediaRoots: [mediaRoot], mediaMaxBytes: 50 * 1024 * 1024 }),
    (async () => {
      fetchCalls += 1;
      return jsonResponse({});
    }) as typeof fetch,
  );

  await assert.rejects(
    client.stageProposalMedia({ proposalId: "proposal-1", localPath: imagePath }),
    (error: unknown) => error instanceof DndApiError && error.code === "media_too_large",
  );
  assert.equal(fetchCalls, 0);
});

test("proposal media growth after the opened-file stat is rejected by the bounded handle read", async (t) => {
  const mediaRoot = await mkdtemp(path.join(os.tmpdir(), "dnd-mcp-media-growth-"));
  t.after(() => rm(mediaRoot, { recursive: true, force: true }));
  const imagePath = path.join(mediaRoot, "growing.png");
  await writeFile(
    imagePath,
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]),
  );

  const probe = await open(imagePath, "r");
  const fileHandlePrototype = Object.getPrototypeOf(probe) as object;
  await probe.close();
  const originalStat = Reflect.get(fileHandlePrototype, "stat") as (
    this: FileHandle,
    ...args: unknown[]
  ) => Promise<unknown>;
  let injectedGrowth = false;
  Reflect.set(fileHandlePrototype, "stat", async function (this: FileHandle, ...args: unknown[]) {
    const result = await Reflect.apply(originalStat, this, args);
    if (!injectedGrowth) {
      injectedGrowth = true;
      await appendFile(imagePath, Buffer.alloc(64, 0x41));
    }
    return result;
  });
  t.after(() => {
    Reflect.set(fileHandlePrototype, "stat", originalStat);
  });

  let fetchCalls = 0;
  const client = new DndMasterClient(
    config({ mediaRoots: [mediaRoot], mediaMaxBytes: 16 }),
    (async () => {
      fetchCalls += 1;
      return jsonResponse({});
    }) as typeof fetch,
  );

  await assert.rejects(
    client.stageProposalMedia({ proposalId: "proposal-1", localPath: imagePath }),
    (error: unknown) => error instanceof DndApiError && error.code === "media_too_large",
  );
  assert.equal(injectedGrowth, true);
  assert.equal(fetchCalls, 0);
});

test("the MCP never deletes managed bridge media paths", async () => {
  const mediaRoot = await mkdtemp(path.join(os.tmpdir(), "dnd-mcp-managed-media-"));
  const successfulImage = path.join(mediaRoot, "successful.png");
  const failedImage = path.join(mediaRoot, "failed.png");
  const bytes = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
  await Promise.all([writeFile(successfulImage, bytes), writeFile(failedImage, bytes)]);

  const successfulClient = new DndMasterClient(
    config({ mediaRoots: [mediaRoot], sourceType: "codex_app_server" }),
    (async () =>
      jsonResponse({
        proposal: { id: "proposal-1", status: "pending" },
        media: { id: "media-1", status: "staged" },
      })) as typeof fetch,
  );
  await successfulClient.stageProposalMedia({ proposalId: "proposal-1", localPath: successfulImage });
  await access(successfulImage);

  const failingClient = new DndMasterClient(
    config({ mediaRoots: [mediaRoot], sourceType: "codex_app_server" }),
    (async () => jsonResponse(undefined, 500)) as typeof fetch,
  );
  await assert.rejects(failingClient.stageProposalMedia({ proposalId: "proposal-1", localPath: failedImage }));
  await access(failedImage);
});

test("a path replacement during staging is never deleted by MCP cleanup", async (t) => {
  const mediaRoot = await mkdtemp(path.join(os.tmpdir(), "dnd-mcp-media-replacement-"));
  t.after(() => rm(mediaRoot, { recursive: true, force: true }));
  const imagePath = path.join(mediaRoot, "source.png");
  const movedPath = path.join(mediaRoot, "source-original.png");
  const originalBytes = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x11]);
  const replacementBytes = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x22]);
  await writeFile(imagePath, originalBytes);
  const client = new DndMasterClient(
    config({ mediaRoots: [mediaRoot], sourceType: "codex_app_server" }),
    (async () => {
      await rename(imagePath, movedPath);
      await writeFile(imagePath, replacementBytes);
      return jsonResponse({
        proposal: { id: "proposal-1", status: "pending" },
        media: { id: "media-1", status: "staged" },
      });
    }) as typeof fetch,
  );

  await client.stageProposalMedia({ proposalId: "proposal-1", localPath: imagePath });
  assert.deepEqual(await readFile(movedPath), originalBytes);
  assert.deepEqual(await readFile(imagePath), replacementBytes);
});

test("external MCP staging retains the caller-owned source image", async () => {
  const mediaRoot = await mkdtemp(path.join(os.tmpdir(), "dnd-mcp-external-media-"));
  const imagePath = path.join(mediaRoot, "external.png");
  await writeFile(
    imagePath,
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]),
  );
  const client = new DndMasterClient(
    config({ mediaRoots: [mediaRoot], sourceType: "mcp" }),
    (async () => jsonResponse({ proposal: {}, media: {} })) as typeof fetch,
  );

  await client.stageProposalMedia({ proposalId: "proposal-1", localPath: imagePath });
  await access(imagePath);
});

import { readFile, realpath, stat, unlink } from "node:fs/promises";
import path from "node:path";
import type { DndMcpConfig } from "./config.js";
import type {
  AttachProposalMediaInput,
  ProposeCampaignInput,
  ProposeEntityCreateInput,
  ProposeEntityUpdateInput,
  StageProposalMediaInput,
} from "./schemas.js";

type FetchImplementation = typeof fetch;

interface ApiEnvelope<T> {
  data?: T;
  error?: { code?: string; message?: string } | null;
}

export class DndApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "DndApiError";
    this.status = status;
    this.code = code;
  }
}

export interface CampaignSummary {
  id: string;
  title?: string;
  system?: string;
  settingName?: string;
  inWorldDate?: string;
  summary?: string;
  [key: string]: unknown;
}

export interface CampaignData extends CampaignSummary {
  locations?: Array<Record<string, unknown>>;
  players?: Array<Record<string, unknown>>;
  npcs?: Array<Record<string, unknown>>;
  monsters?: Array<Record<string, unknown>>;
  quests?: Array<Record<string, unknown>>;
  lore?: Array<Record<string, unknown>>;
  events?: Array<Record<string, unknown>>;
}

const entityCollections = {
  location: "locations",
  player: "players",
  npc: "npcs",
  monster: "monsters",
  quest: "quests",
  lore: "lore",
  event: "events",
} as const satisfies Record<string, keyof CampaignData>;

export type ReadableEntityKind = keyof typeof entityCollections;

export interface ConciseEntityReference {
  id: string;
  kind: ReadableEntityKind;
  title: string;
  subtitle?: string;
  summary?: string;
  tags?: string[];
}

export interface CampaignOutline {
  campaign: CampaignSummary;
  counts: Record<ReadableEntityKind, number>;
  items: ConciseEntityReference[];
  truncated: boolean;
}

export interface EntitySearchResult extends ConciseEntityReference {
  matchedText?: string;
}

export interface EntitySearchResults {
  campaignId: string;
  query: string;
  totalMatches: number;
  truncated: boolean;
  results: EntitySearchResult[];
}

const readableEntityKinds = Object.keys(entityCollections) as ReadableEntityKind[];
const outlineItemsPerKind = 12;
const defaultSearchLimit = 20;
const maximumSearchLimit = 50;
const maximumProposalMediaBytes = 32 * 1024 * 1024;

function normalizedText(value: string): string {
  return value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function boundedText(value: unknown, maximumLength: number): string | undefined {
  if (typeof value !== "string") return undefined;
  const normalized = normalizedText(value);
  if (!normalized) return undefined;
  return normalized.length <= maximumLength
    ? normalized
    : `${normalized.slice(0, Math.max(1, maximumLength - 1))}…`;
}

function boundedTags(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const tags = value
    .filter((item): item is string => typeof item === "string")
    .map((item) => boundedText(item, 80))
    .filter((item): item is string => Boolean(item))
    .slice(0, 8);
  return tags.length ? tags : undefined;
}

function conciseEntity(kind: ReadableEntityKind, entity: Record<string, unknown>): ConciseEntityReference | undefined {
  const id = boundedText(entity.id, 200);
  if (!id) return undefined;
  const subtitle = boundedText(entity.subtitle, 240);
  const summary = boundedText(entity.summary, 400);
  const tags = boundedTags(entity.tags);
  return {
    id,
    kind,
    title: boundedText(entity.title, 240) ?? id,
    ...(subtitle ? { subtitle } : {}),
    ...(summary ? { summary } : {}),
    ...(tags ? { tags } : {}),
  };
}

function collectSearchStrings(value: unknown, output: string[], state: { characters: number }, depth = 0): void {
  if (state.characters >= 64_000 || depth > 5 || value === null || value === undefined) return;
  if (typeof value === "string") {
    const text = normalizedText(value);
    if (!text) return;
    const remaining = 64_000 - state.characters;
    const bounded = text.slice(0, remaining);
    output.push(bounded);
    state.characters += bounded.length;
    return;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    const text = String(value);
    output.push(text);
    state.characters += text.length;
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value.slice(0, 250)) {
      collectSearchStrings(item, output, state, depth + 1);
      if (state.characters >= 64_000) break;
    }
    return;
  }
  if (typeof value === "object") {
    for (const [key, item] of Object.entries(value).slice(0, 250)) {
      if (/url|image|art|audio|playlist/i.test(key)) continue;
      collectSearchStrings(item, output, state, depth + 1);
      if (state.characters >= 64_000) break;
    }
  }
}

function matchSnippet(values: string[], normalizedQuery: string): string | undefined {
  for (const value of values) {
    const index = value.toLocaleLowerCase().indexOf(normalizedQuery);
    if (index < 0) continue;
    const start = Math.max(0, index - 100);
    const end = Math.min(value.length, index + normalizedQuery.length + 180);
    const snippet = `${start > 0 ? "…" : ""}${value.slice(start, end)}${end < value.length ? "…" : ""}`;
    return boundedText(snippet, 320);
  }
  return undefined;
}

function searchScore(entity: Record<string, unknown>, normalizedQuery: string, searchable: string[]): number {
  const title = normalizedText(typeof entity.title === "string" ? entity.title : "").toLocaleLowerCase();
  const subtitle = normalizedText(typeof entity.subtitle === "string" ? entity.subtitle : "").toLocaleLowerCase();
  const summary = normalizedText(typeof entity.summary === "string" ? entity.summary : "").toLocaleLowerCase();
  const tags = Array.isArray(entity.tags)
    ? entity.tags.filter((item): item is string => typeof item === "string").join(" ").toLocaleLowerCase()
    : "";
  if (title === normalizedQuery) return 100;
  if (title.startsWith(normalizedQuery)) return 90;
  if (title.includes(normalizedQuery)) return 80;
  if (subtitle.includes(normalizedQuery)) return 60;
  if (tags.includes(normalizedQuery)) return 50;
  if (summary.includes(normalizedQuery)) return 40;
  return searchable.some((value) => value.toLocaleLowerCase().includes(normalizedQuery)) ? 10 : 0;
}

function encodePath(value: string): string {
  return encodeURIComponent(value);
}

function safeApiMessage(value: unknown, fallback: string): string {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, 2_000) : fallback;
}

function withMcpSource<T extends { source?: Record<string, unknown> }>(
  input: T,
  sourceType: DndMcpConfig["sourceType"],
): T {
  return {
    ...input,
    source: {
      ...input.source,
      type: sourceType,
    },
  };
}

function isInsideRoot(filePath: string, rootPath: string): boolean {
  const relative = path.relative(rootPath, filePath);
  return relative === "" || (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative));
}

function resolveLocalMediaPath(localPath: string, rootPath: string): string {
  const trimmed = localPath.trim();
  const slashNormalized = trimmed.replace(/\\/g, "/");
  const isWindowsDrivePath = /^[a-z]:[\\/]/i.test(trimmed);
  if (slashNormalized.startsWith("//")) {
    throw new DndApiError(
      0,
      "media_path_not_allowed",
      "Proposal media must not use a UNC or device path",
    );
  }
  if (!isWindowsDrivePath && /^[a-z][a-z0-9+.-]*:/i.test(trimmed)) {
    throw new DndApiError(
      0,
      "media_path_not_allowed",
      "Proposal media must be a filesystem path, not a URI",
    );
  }
  return path.isAbsolute(trimmed) ? path.resolve(trimmed) : path.resolve(rootPath, trimmed);
}

function sniffImageType(bytes: Uint8Array): { contentType: string; extension: string } | undefined {
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return { contentType: "image/png", extension: ".png" };
  }
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return { contentType: "image/jpeg", extension: ".jpg" };
  }
  if (
    bytes.length >= 12 &&
    String.fromCharCode(...bytes.subarray(0, 4)) === "RIFF" &&
    String.fromCharCode(...bytes.subarray(8, 12)) === "WEBP"
  ) {
    return { contentType: "image/webp", extension: ".webp" };
  }
  return undefined;
}

export class DndMasterClient {
  readonly #config: DndMcpConfig;
  readonly #fetch: FetchImplementation;

  constructor(config: DndMcpConfig, fetchImplementation: FetchImplementation = fetch) {
    this.#config = config;
    this.#fetch = fetchImplementation;
  }

  async #request<T>(
    method: "GET" | "POST",
    pathname: string,
    options: { query?: URLSearchParams; body?: unknown; form?: FormData } = {},
  ): Promise<T> {
    const url = new URL(pathname, this.#config.baseUrl);
    if (options.query) url.search = options.query.toString();

    const headers = new Headers({ Accept: "application/json" });
    if (this.#config.sessionCookie) headers.set("Cookie", this.#config.sessionCookie);
    if (this.#config.bearerToken) headers.set("Authorization", `Bearer ${this.#config.bearerToken}`);

    let body: BodyInit | undefined;
    if (options.form) {
      body = options.form;
    } else if (options.body !== undefined) {
      headers.set("Content-Type", "application/json");
      const serialized = JSON.stringify(options.body);
      if (Buffer.byteLength(serialized, "utf8") > 1 << 20) {
        throw new DndApiError(
          0,
          "request_too_large",
          "The proposal payload exceeds the DND Master API 1 MiB JSON limit",
        );
      }
      body = serialized;
    }

    let response: Response;
    try {
      response = await this.#fetch(url, {
        method,
        headers,
        body,
        redirect: "error",
        signal: AbortSignal.timeout(this.#config.requestTimeoutMs),
      });
    } catch (error) {
      const reason = error instanceof Error && error.name === "TimeoutError" ? "request timed out" : "request failed";
      throw new DndApiError(0, "network_error", `DND Master API ${reason}`);
    }

    let envelope: ApiEnvelope<T>;
    try {
      envelope = (await response.json()) as ApiEnvelope<T>;
    } catch {
      throw new DndApiError(
        response.status,
        "invalid_response",
        `DND Master API returned a non-JSON response (${response.status})`,
      );
    }

    if (!response.ok || envelope.error) {
      throw new DndApiError(
        response.status,
        safeApiMessage(envelope.error?.code, "api_error"),
        safeApiMessage(envelope.error?.message, `DND Master API request failed (${response.status})`),
      );
    }
    if (!("data" in envelope)) {
      throw new DndApiError(response.status, "invalid_response", "DND Master API response did not contain data");
    }
    return envelope.data as T;
  }

  listCampaigns(): Promise<CampaignSummary[]> {
    return this.#request("GET", "/api/campaigns");
  }

  getCampaign(campaignId: string): Promise<CampaignData> {
    return this.#request("GET", `/api/campaigns/${encodePath(campaignId)}`);
  }

  async getCampaignOutline(campaignId: string): Promise<CampaignOutline> {
    const campaign = await this.getCampaign(campaignId);
    const counts = Object.fromEntries(readableEntityKinds.map((kind) => [kind, 0])) as Record<
      ReadableEntityKind,
      number
    >;
    const items: ConciseEntityReference[] = [];

    for (const kind of readableEntityKinds) {
      const collection = campaign[entityCollections[kind]];
      if (!Array.isArray(collection)) continue;
      counts[kind] = collection.length;
      for (const entity of collection.slice(0, outlineItemsPerKind)) {
        if (!entity || typeof entity !== "object") continue;
        const concise = conciseEntity(kind, entity);
        if (concise) items.push(concise);
      }
    }

    const title = boundedText(campaign.title, 300);
    const system = boundedText(campaign.system, 200);
    const settingName = boundedText(campaign.settingName, 300);
    const inWorldDate = boundedText(campaign.inWorldDate, 200);
    const summary = boundedText(campaign.summary, 1_000);
    const campaignSummary: CampaignSummary = {
      id: campaign.id,
      ...(title ? { title } : {}),
      ...(system ? { system } : {}),
      ...(settingName ? { settingName } : {}),
      ...(inWorldDate ? { inWorldDate } : {}),
      ...(summary ? { summary } : {}),
    };
    const total = Object.values(counts).reduce((sum, count) => sum + count, 0);
    return { campaign: campaignSummary, counts, items, truncated: items.length < total };
  }

  async searchEntities(
    campaignId: string,
    query: string,
    kinds?: ReadableEntityKind[],
    limit = defaultSearchLimit,
  ): Promise<EntitySearchResults> {
    const normalizedQuery = normalizedText(query).toLocaleLowerCase();
    if (!normalizedQuery || normalizedQuery.length > 200) {
      throw new DndApiError(0, "invalid_search_query", "Search query must contain 1 to 200 characters");
    }
    const selectedKinds = kinds ?? readableEntityKinds;
    if (
      selectedKinds.length < 1 ||
      selectedKinds.length > readableEntityKinds.length ||
      new Set(selectedKinds).size !== selectedKinds.length ||
      selectedKinds.some((kind) => !readableEntityKinds.includes(kind))
    ) {
      throw new DndApiError(0, "invalid_search_kinds", "Search kinds must be a unique, non-empty subset");
    }
    if (!Number.isInteger(limit) || limit < 1 || limit > maximumSearchLimit) {
      throw new DndApiError(0, "invalid_search_limit", "Search limit must be an integer from 1 to 50");
    }

    const campaign = await this.getCampaign(campaignId);
    const matches: Array<EntitySearchResult & { score: number }> = [];
    for (const kind of selectedKinds) {
      const collection = campaign[entityCollections[kind]];
      if (!Array.isArray(collection)) continue;
      for (const entity of collection) {
        if (!entity || typeof entity !== "object") continue;
        const concise = conciseEntity(kind, entity);
        if (!concise) continue;
        const searchable: string[] = [];
        collectSearchStrings(entity, searchable, { characters: 0 });
        const score = searchScore(entity, normalizedQuery, searchable);
        if (score === 0) continue;
        const matchedText = matchSnippet(searchable, normalizedQuery);
        matches.push({ ...concise, ...(matchedText ? { matchedText } : {}), score });
      }
    }

    matches.sort(
      (left, right) =>
        right.score - left.score ||
        left.title.localeCompare(right.title) ||
        left.kind.localeCompare(right.kind) ||
        left.id.localeCompare(right.id),
    );
    const results = matches.slice(0, limit).map(({ score: _score, ...result }) => result);
    return {
      campaignId: campaign.id,
      query: normalizedText(query),
      totalMatches: matches.length,
      truncated: matches.length > results.length,
      results,
    };
  }

  async getEntity(campaignId: string, kind: keyof typeof entityCollections, entityId: string) {
    const campaign = await this.getCampaign(campaignId);
    const collectionName = entityCollections[kind];
    const collection = campaign[collectionName];
    const entity = Array.isArray(collection)
      ? collection.find((item) => item && item.id === entityId)
      : undefined;
    if (!entity) {
      throw new DndApiError(404, "entity_not_found", `${kind} entity was not found in the campaign`);
    }
    return { campaignId: campaign.id, kind, entity };
  }

  proposeCampaign(input: ProposeCampaignInput): Promise<Record<string, unknown>> {
    return this.#request("POST", "/api/ai/proposals/campaign", {
      body: withMcpSource(input, this.#config.sourceType),
    });
  }

  proposeEntityCreate(input: ProposeEntityCreateInput): Promise<Record<string, unknown>> {
    const { kind, ...eventInput } = input;
    const pathname = kind === "event" ? "/api/ai/proposals/event" : "/api/ai/proposals/entity";
    return this.#request("POST", pathname, {
      body: withMcpSource(
        kind === "event"
          ? { ...eventInput, mode: "create" as const }
          : { ...input, mode: "create" as const },
        this.#config.sourceType,
      ),
    });
  }

  proposeEntityUpdate(input: ProposeEntityUpdateInput): Promise<Record<string, unknown>> {
    const { kind, entityId, ...eventInput } = input;
    const pathname = kind === "event" ? "/api/ai/proposals/event" : "/api/ai/proposals/entity";
    return this.#request("POST", pathname, {
      body: withMcpSource(
        kind === "event"
          ? { ...eventInput, eventId: entityId, mode: "update" as const }
          : { ...input, mode: "update" as const },
        this.#config.sourceType,
      ),
    });
  }

  listProposals(filters: { status?: string; campaignId?: string }): Promise<Array<Record<string, unknown>>> {
    const query = new URLSearchParams();
    if (filters.status) query.set("status", filters.status);
    if (filters.campaignId) query.set("campaignId", filters.campaignId);
    return this.#request("GET", "/api/ai/proposals", { query });
  }

  getProposal(proposalId: string): Promise<Record<string, unknown>> {
    return this.#request("GET", `/api/ai/proposals/${encodePath(proposalId)}`);
  }

  async #readAllowedMedia(localPath: string): Promise<{
    bytes: Uint8Array;
    filename: string;
    contentType: string;
    canonicalPath: string;
  }> {
    const candidate = resolveLocalMediaPath(
      localPath,
      this.#config.mediaRoots[0] ?? process.cwd(),
    );

    let canonicalFile: string;
    let canonicalRoots: string[];
    try {
      [canonicalFile, canonicalRoots] = await Promise.all([
        realpath(candidate),
        Promise.all(this.#config.mediaRoots.map((root) => realpath(root))),
      ]);
    } catch {
      throw new DndApiError(0, "media_not_found", "The media file or configured media root does not exist");
    }

    if (!canonicalRoots.some((root) => isInsideRoot(canonicalFile, root))) {
      throw new DndApiError(
        0,
        "media_path_not_allowed",
        "The media file is outside DND_MASTER_MEDIA_ROOTS",
      );
    }

    const fileStat = await stat(canonicalFile);
    if (!fileStat.isFile()) {
      throw new DndApiError(0, "media_not_file", "The media path is not a regular file");
    }
    const mediaMaxBytes = Math.min(this.#config.mediaMaxBytes, maximumProposalMediaBytes);
    if (fileStat.size > mediaMaxBytes) {
      throw new DndApiError(
        0,
        "media_too_large",
        `The media file exceeds the ${mediaMaxBytes}-byte proposal limit`,
      );
    }

    const bytes = await readFile(canonicalFile);
    const detected = sniffImageType(bytes);
    if (!detected) {
      throw new DndApiError(
        0,
        "unsupported_media_type",
        "Only PNG, JPEG, and WebP proposal images are supported",
      );
    }
    const basename = path.basename(canonicalFile, path.extname(canonicalFile));
    return {
      bytes,
      filename: `${basename || "proposal-image"}${detected.extension}`,
      contentType: detected.contentType,
      canonicalPath: canonicalFile,
    };
  }

  async stageProposalMedia(input: StageProposalMediaInput): Promise<Record<string, unknown>> {
    const { bytes, filename, contentType, canonicalPath } = await this.#readAllowedMedia(input.localPath);
    const form = new FormData();
    const arrayBuffer = bytes.buffer.slice(
      bytes.byteOffset,
      bytes.byteOffset + bytes.byteLength,
    ) as ArrayBuffer;
    form.set("file", new Blob([arrayBuffer], { type: contentType }), filename);
    for (const key of ["purpose", "operationKey", "field", "alt", "caption", "prompt"] as const) {
      const value = input[key];
      if (value) form.set(key, value);
    }
    const result = await this.#request<Record<string, unknown>>(
      "POST",
      `/api/ai/proposals/${encodePath(input.proposalId)}/media`,
      {
        form,
      },
    );
    if (this.#config.sourceType === "codex_app_server") {
      try {
        await unlink(canonicalPath);
      } catch {
        throw new DndApiError(
          0,
          "media_cleanup_failed",
          "Proposal media was staged, but its private generated-image source could not be removed",
        );
      }
    }
    return result;
  }

  attachProposalMedia(input: AttachProposalMediaInput): Promise<Record<string, unknown>> {
    const { proposalId, ...body } = input;
    return this.#request(
      "POST",
      `/api/ai/proposals/${encodePath(proposalId)}/media/attachments`,
      { body },
    );
  }
}

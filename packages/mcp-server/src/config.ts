import path from "node:path";
import { z } from "zod";

const ConfigEnvSchema = z
  .object({
    DND_MASTER_BASE_URL: z.string().trim().url(),
    DND_MASTER_SESSION_COOKIE: z.string().trim().min(1).optional(),
    DND_MASTER_BEARER_TOKEN: z.string().trim().min(1).optional(),
    DND_MASTER_SOURCE_TYPE: z.enum(["mcp", "codex_app_server"]).default("mcp"),
    DND_MASTER_MEDIA_ROOTS: z.string().trim().optional(),
    DND_MASTER_MEDIA_MAX_BYTES: z.coerce
      .number()
      .int()
      .min(1)
      .max(50 * 1024 * 1024)
      .default(10 * 1024 * 1024),
    DND_MASTER_REQUEST_TIMEOUT_MS: z.coerce.number().int().min(1_000).max(120_000).default(30_000),
    DND_MASTER_ALLOW_INSECURE_HTTP: z.enum(["true", "false"]).default("false"),
  })
  .passthrough();

export interface DndMcpConfig {
  baseUrl: URL;
  sessionCookie?: string;
  bearerToken?: string;
  mediaRoots: string[];
  mediaMaxBytes: number;
  requestTimeoutMs: number;
  sourceType: "mcp" | "codex_app_server";
}

function isLoopback(hostname: string): boolean {
  const normalized = hostname.toLowerCase();
  return normalized === "localhost" || normalized === "127.0.0.1" || normalized === "[::1]" || normalized === "::1";
}

function normalizeBaseUrl(raw: string, allowInsecure: boolean): URL {
  const baseUrl = new URL(raw);
  if (baseUrl.protocol !== "http:" && baseUrl.protocol !== "https:") {
    throw new Error("DND_MASTER_BASE_URL must use http or https");
  }
  if (baseUrl.username || baseUrl.password || baseUrl.search || baseUrl.hash) {
    throw new Error("DND_MASTER_BASE_URL must not contain credentials, a query, or a fragment");
  }
  if (baseUrl.protocol === "http:" && !isLoopback(baseUrl.hostname) && !allowInsecure) {
    throw new Error(
      "DND_MASTER_BASE_URL must use HTTPS outside localhost (or explicitly set DND_MASTER_ALLOW_INSECURE_HTTP=true)",
    );
  }
  baseUrl.pathname = `${baseUrl.pathname.replace(/\/+$/, "")}/`;
  return baseUrl;
}

function normalizeSessionCookie(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  if (/\r|\n/.test(raw)) {
    throw new Error("DND_MASTER_SESSION_COOKIE contains invalid characters");
  }

  const namedCookie = raw
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith("shadow_edge_session="));
  if (namedCookie) {
    const token = namedCookie.slice("shadow_edge_session=".length).trim();
    if (!token) throw new Error("DND_MASTER_SESSION_COOKIE is empty");
    return `shadow_edge_session=${token}`;
  }

  if (raw.includes(";") || raw.includes("=")) {
    throw new Error(
      "DND_MASTER_SESSION_COOKIE must be the raw session token or shadow_edge_session=<token>",
    );
  }
  return `shadow_edge_session=${raw}`;
}

function normalizeBearerToken(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  if (/\r|\n/.test(raw)) {
    throw new Error("DND_MASTER_BEARER_TOKEN contains invalid characters");
  }
  return raw;
}

export function loadConfig(
  env: NodeJS.ProcessEnv = process.env,
  cwd: string = process.cwd(),
): DndMcpConfig {
  const parsed = ConfigEnvSchema.parse(env);
  const sessionCookie = normalizeSessionCookie(parsed.DND_MASTER_SESSION_COOKIE);
  const bearerToken = normalizeBearerToken(parsed.DND_MASTER_BEARER_TOKEN);
  if (!sessionCookie && !bearerToken) {
    throw new Error(
      "Set DND_MASTER_SESSION_COOKIE or DND_MASTER_BEARER_TOKEN to authenticate the MCP server",
    );
  }
  if (sessionCookie && bearerToken) {
    throw new Error(
      "Set only one of DND_MASTER_SESSION_COOKIE or DND_MASTER_BEARER_TOKEN",
    );
  }

  const configuredRoots = parsed.DND_MASTER_MEDIA_ROOTS
    ? parsed.DND_MASTER_MEDIA_ROOTS.split(path.delimiter)
        .map((entry) => entry.trim())
        .filter(Boolean)
    : [cwd];

  return {
    baseUrl: normalizeBaseUrl(
      parsed.DND_MASTER_BASE_URL,
      parsed.DND_MASTER_ALLOW_INSECURE_HTTP === "true",
    ),
    sessionCookie,
    bearerToken,
    mediaRoots: configuredRoots.map((root) => path.resolve(cwd, root)),
    mediaMaxBytes: parsed.DND_MASTER_MEDIA_MAX_BYTES,
    requestTimeoutMs: parsed.DND_MASTER_REQUEST_TIMEOUT_MS,
    sourceType: parsed.DND_MASTER_SOURCE_TYPE,
  };
}

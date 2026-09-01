# DND Master local MCP server

This package lets a local Codex client read the authenticated user's DND Master campaigns and create persistent AI proposals. It intentionally has no apply, reject, undo, entity-CRUD, or remote HTTP transport. A proposal only becomes campaign data after the user reviews and applies it in the authenticated website.

The implementation follows the official TypeScript `@modelcontextprotocol/sdk`, uses Zod input/output schemas, and advertises explicit safety annotations. Local Codex supports stdio MCP processes and environment forwarding; see the [official Codex MCP documentation](https://learn.chatgpt.com/docs/extend/mcp) and [OpenAI's MCP server guide](https://developers.openai.com/plugins/build/mcp-server).

## Build and test

From the repository root:

```powershell
npm install
npm run build --workspace @shadow-edge/mcp-server
npm test --workspace @shadow-edge/mcp-server
```

Node.js 20 or newer is required.

## Authentication and configuration

Set these environment variables in the process that launches Codex:

- `DND_MASTER_BASE_URL` — the website origin, for example `http://127.0.0.1:8080` or `https://dnd.example.com`. HTTP is accepted only for loopback by default.
- `DND_MASTER_SESSION_COOKIE` — either the raw opaque session value or `shadow_edge_session=<value>`. It is never logged or returned by a tool.
- `DND_MASTER_MEDIA_ROOTS` — optional OS-delimited list of directories from which proposal images may be staged. It defaults to the MCP process working directory. On Windows the delimiter is `;`; on Linux/macOS it is `:`.
- `DND_MASTER_MEDIA_MAX_BYTES` — optional per-file limit, default 10 MiB and hard-capped at 50 MiB.
- `DND_MASTER_REQUEST_TIMEOUT_MS` — optional backend timeout, default 30000.
- `DND_MASTER_SOURCE_TYPE` — optional provenance marker (`mcp` by default). The managed website bridge sets `codex_app_server`; external clients should keep the default.

`DND_MASTER_BEARER_TOKEN` is also supported for a future scoped bridge token. Configure exactly one authentication method. The current website uses a random opaque cookie backed by the server's revocable in-memory session allowlist, so logout, rotation, and a server restart invalidate copied cookies.

Never commit a session cookie, place it in `config.toml`, pass it as a command-line argument, or paste it into a prompt. Prefer `env_vars`, as shown in [config.example.toml](./config.example.toml), so Codex forwards values already present in its environment.

After editing the Codex config, restart the client and inspect the MCP server with `/mcp` or `codex mcp list`.

## Tools

| Tool | Effect |
| --- | --- |
| `list_campaigns` | Reads owned campaign summaries. |
| `get_campaign` | Reads one complete owned campaign. |
| `get_campaign_outline` | Reads bounded metadata, counts, and up to 12 concise references per kind. |
| `search_entities` | Searches selected entity/event kinds and returns at most 50 concise matches. |
| `get_entity` | Reads one entity or world event from a campaign. |
| `propose_campaign` | Creates a pending campaign blueprint proposal with temporary keys. |
| `propose_entity_create` | Creates a pending proposal for a new entity or world event/dialogue scene. |
| `propose_entity_update` | Creates a pending constrained entity/event patch or candidate proposal. |
| `list_proposals` | Reads owned proposals with optional status/campaign filters. |
| `get_proposal` | Reads a complete owned proposal. |
| `stage_proposal_media` | Uploads a local PNG/JPEG/WebP into temporary proposal storage. |
| `attach_proposal_media` | Attaches or updates metadata for an already staged media ID. |

Read tools are annotated read-only. `get_campaign_outline` and `search_entities` are the context-efficient discovery path; `get_campaign` remains available when the complete authoritative campaign is genuinely needed. Search requires a non-empty query, accepts only known unique kinds, and limits output to 1–50 matches. Proposal/media tools are non-destructive, closed-world writes: they mutate proposal state only and cannot apply campaign data. Proposal creation is non-idempotent; media metadata attachment is idempotent.

For entity updates, call `get_entity` first and send only intentional fields in `patch`. The Go proposal service loads the authoritative current entity and preserves omitted art, gallery, relationships, player cards, playlists, prepared combats, and other fields.

## Media safety

`stage_proposal_media` accepts local paths only. It resolves symlinks, requires the final path to remain inside `DND_MASTER_MEDIA_ROOTS`, enforces size limits, and verifies PNG/JPEG/WebP signatures. It never downloads a remote URL. Staged media remains temporary; the website promotes it only when a proposal is applied and discards it when the proposal is rejected or expires.

When `DND_MASTER_SOURCE_TYPE=codex_app_server`, a successfully staged file is deleted from the bridge user's private generated-image directory so proposal staging is the sole retained copy. Failed uploads keep the source for diagnosis or retry. External `mcp` mode never deletes caller-owned source files.

If image generation is unavailable, create a `mediaIntents` placeholder with a `prompt` and `status: "unavailable"` or `"placeholder"` rather than failing the proposal. Campaign-blueprint media must include the target entity operation key in the exact form `entity:<tempKey>` and that entity must exist in the same blueprint; campaign-root and world-event media are intentionally unsupported. Entity media uses only `art.url` or `gallery`.

## Backend contract

The adapter calls authenticated website endpoints under `/api/ai/proposals`:

- `GET /api/ai/proposals` and `GET /api/ai/proposals/:id`
- `POST /api/ai/proposals/campaign`
- `POST /api/ai/proposals/entity`
- `POST /api/ai/proposals/event`
- `POST /api/ai/proposals/:id/media` (multipart staging)
- `POST /api/ai/proposals/:id/media/attachments` (JSON metadata attachment)

It also reads `GET /api/campaigns` and `GET /api/campaigns/:id`. Any `401` means the configured session is missing or expired. Any `404` is deliberately indistinguishable from cross-account access denial at the website boundary.

There is no unauthenticated streamable-HTTP endpoint in this package. A hosted MCP transport requires a separate authenticated deployment and authorization design.

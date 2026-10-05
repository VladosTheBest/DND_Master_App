# Storage and subscription migration

## Status

Infrastructure and migration implementation (2026-10-04):

- Fly Managed PostgreSQL `shadow-edge-db`, Basic, PostgreSQL 17, `ams`; provisioning now reports 20 GB allocated.
- Private Tigris bucket `shadow-edge-media`; credentials are Fly Secrets only.
- `SHADOW_EDGE_STORAGE_MODE=postgres` selects PostgreSQL/S3. Unset/`json` retains the local development backend. `DATABASE_URL` alone never triggers migration. Initial import additionally requires `SHADOW_EDGE_IMPORT_LEGACY_JSON=true`; remove that flag after verification.
- The initial database credential printed by the provisioning CLI was revoked by deleting its unused role. The replacement application role is `shadow_edge_app`; its connection string is stored in Fly Secrets, not in this repository.
- Existing volume must remain intact. No user data or credentials belong in this document.

Production cutover is complete: 218 domain rows and nine AI jobs imported; 20,872 upload files (1,364,052,023 bytes) verified in S3, plus 32 private backup/catalog objects. Canonical source/SQL digests matched. A restart with import disabled passed; Google login opened the existing campaigns. Four real media samples passed GET/HEAD/Range byte checks, and unauthenticated private routes remained denied. A Fly volume snapshot was created before cutover. This does not claim verification of every application editing workflow after deployment.

## Implemented storage

### Per-account storage (2026-10-05)

Schema v2 adds indexed owner-prefix resolution and live SQL views (`owned_storage_objects`, `account_database_records`, `account_storage_usage`); v3 also resolves legacy `uploads/{campaignID}/...` paths through unique campaign prefixes and their owners, without overriding any account prefix. Existing accounts and verified objects are included immediately; repeated uploads and overwrites cannot inflate a cumulative counter. Ambiguous or unknown paths remain unassigned and are reported by `cloud-status`. Domain ownership follows account, campaign and session relationships. Database size is logical UTF-8 JSONB content, not physical PostgreSQL allocation, indexes or WAL.

The total includes persistent uploaded files, retained private AI staging and logical account/campaign records. Temporary local tiles are excluded. Legacy S3 tiles remain counted only until successful deletion removes their manifest rows. Backups, service caches, local duplicates and browser-only data are excluded. Other retained unreferenced S3 media still count until general remote garbage collection exists. The verified manifest is authoritative for accounting; out-of-band bucket changes are not automatically discovered. Views reflect subsequent manifest/domain writes without a scheduled backfill; this is current usage, not historical daily analytics.

`GET /api/auth/subscription` includes the authenticated account's `storageUsage` only, with bytes by category, object count, measured timestamp and nullable active-plan allowance (decimal GB). Anonymous requests receive null, database failures return 503, and local JSON mode explicitly reports unavailable. The subscription dialog displays the breakdown. Limits remain informational (`quotaEnforced:false`); this change does not activate billing or delete files.

`cloud_records.go` splits the compatibility state into separately addressable domain rows. `cloud_postgres.go` owns schema migrations (currently v3) and transactional changed-row persistence through pgx. `cloud_assets.go` owns the private S3 adapter; `cloud_runtime.go` owns import, verification and operational commands.

| Area | Current tables and guarantees |
|---|---|
| Accounts | `accounts`, unique username key; `oauth_identities`, unique provider/subject with account FK; `subscriptions`, account FK and plan FK. Legacy IDs, hashes and provider bindings remain unchanged. |
| Campaigns | `campaigns` with owner FK and revision; `entities`, `world_events`, `shops`, `session_preparations`, `playlist_tracks` with campaign FK. Arrays retain exact order via ordinal. Combat state and dashboard configuration remain fields of the campaign row. |
| Sessions | `game_sessions` with campaign FK; transcript text and analysis are separate `transcripts`/`session_analyses` rows with session FK. |
| Other content | `ai_proposals`, `proposal_audits`, `survey_invites`, `survey_responses`, `character_invites`, `character_sheets`, `ai_jobs`. Legacy payloads and public tokens are preserved; invite row keys use a token hash. |
| Infrastructure | `app_meta` holds auth secret and root metadata, not campaign content; `schema_migrations`, `migration_runs`, `storage_objects` (SHA-256, size, source mtime, content type, verification time). |
| Billing foundation | `subscription_plans` seeds USD 500/1000/2000 cents; `usage_events` and idempotent `payment_events` are schema foundations only. No payment integration or automatic complete usage collection yet. |

Every domain row has an extensible JSONB payload plus record ID, parent, kind, ordinal and update time. Frequently needed ownership/revision/provider fields are indexed or constrained relational columns. The current codec keys campaign children by parent/kind/ordinal to preserve even legacy duplicate or missing child IDs; these keys are not public resource IDs. Entity-level repositories should replace this compatibility indexing before large-scale concurrent editing.

The runtime still loads the full domain state into one process. A PostgreSQL **session advisory lock on the direct endpoint** permits only one writer, and ambiguous commits/lost connections fail closed with HTTP 503 until restart. This is not yet a multi-replica architecture. Current role `shadow_edge_app` can run schema migrations; separate runtime/migration roles and RLS remain future hardening. Auth sessions/OAuth attempts, live views and Codex subprocesses remain process-local.

Public originals and Deep Zoom descriptors retain `/uploads/...` URLs through an S3 proxy (GET/HEAD and byte ranges); the bucket itself is private. Staging lives under `staging/` and is served only after owner/proposal checks. Backups have no HTTP route. Persistent uploads become successful only after PUT plus full GET/SHA-256 verification and manifest persistence. General orphan cleanup and bounded original-cache eviction remain unimplemented.

In PostgreSQL/S3 mode, `tile_cache.go` makes Deep Zoom tiles disposable local cache with a fixed four-hour lifetime, not extended by reads. Tile GET/HEAD uses the existing URLs with private/no-store and regenerates missing/expired pyramids from a verified original plus the retained descriptor, preserving format, geometry, tile size and overlap. Generation is serialized with upload-time Deep Zoom work. A startup/minutely sweeper deletes only recognized expired tile files and old S3 tile objects in batches, then removes successful deletions from SQL and the in-memory manifest. Failures retain accounting and retry. Physical deletion can lag by the sweep interval or an in-progress rebuild; downtime delays cleanup until restart. Originals, descriptors, unrelated media, staging and backups are never removed. New/rebuilt tiles are not uploaded to S3. Temporary rebuild directories left by crashes expire as well. JSON-only development retains its previous behavior. Tests cover real worker JPEG regeneration, TTL deletion, original preservation, SQL accounting removal and absence of new S3 tile publication.

New uploads are optimized before S3 publication: PNG to lossless WebP, JPEG to quality-92 WebP, retaining pixel dimensions and requiring at least 5% size reduction. API/staged metadata records the actual optimized format and bytes. Existing objects are not rewritten. The bounded optional worker skips animations, videos, already compressed WebP, oversized/high-depth/oriented/CMYK inputs and falls back to the source on failure. New deep-zoom tiles use quality-90 WebP; existing JPEG descriptors/URLs remain valid. See `image_optimization.go` for execution limits and `npm run test:media` for codec checks.

### Migration operations

Production tile-cache cutover: 20,711 old cache objects (486,271,956 bytes, including tile-side metadata) removed from S3. Persistent media now comprise 150 images and 11 descriptors; 32 private service backup/catalog objects remain unchanged. `verify-tile-cache.mjs` confirmed a cold real-map rebuild in about three seconds, unchanged original SHA-256, HEAD and no-store; `verify-cloud-media.mjs` passed GET/HEAD/Range and private boundaries after deployment. TTL boundaries are tested with controlled timestamps, not a four-hour production wait.

1. Run `shadow-edge-server cloud-copy` on the production machine while the JSON server is running. It validates the source codec, copies uploads/private staging and records byte-verified objects. Reruns skip unchanged size/mtime entries. It does not run a second HTTP server.
2. Stop/replace the old process with PostgreSQL mode and explicit import enabled. Startup catches up file changes, backs up the exact JSON, `.bak`, AI jobs and catalog caches into private S3, imports domain rows transactionally, reloads them and compares canonical SHA-256. It refuses unknown fields, missing/duplicate IDs, invalid UTF-8 and mismatches. A partially completed marker can resume only if retained source and SQL are identical.
3. AI jobs import separately and verify every row; interrupted work becomes failed using the existing restart semantics. Existing job retention (50 results/owner, seven days) is unchanged. No automatic replay or spending.
4. Run `shadow-edge-server cloud-status`: read-only snapshot counts, verified object totals, AI-job count and retained-source digest check. Disable import and restart to prove SQL authority. PostgreSQL mode does not seed from JSON or restore `.bak`; JSON password-reset maintenance is explicitly rejected.
5. Preserve the original volume and private snapshots. Never roll back to stale JSON after accepting SQL writes; export the current SQL state first. Do not run `cloud-copy` after cutover (it refuses a completed migration).

Reproducible catalog caches and Codex credentials remain on the volume; catalog snapshots are also backed up. Secrets/process homes are deliberately not published or treated as media. Browser localStorage (custom items, drafts, settings) is outside the server migration, as are local Quill recordings. HTTP routes/contracts and owner checks are unchanged.

Verification: full Go suite; dedicated real PostgreSQL database `shadow_edge_migration_test` with disposable schemas; roundtrip, FK rollback, updates/deletes, OAuth reorder, exclusive writer lock, job persistence, full import and restart without a JSON file. S3 tests cover verified writes, corruption rejection, cache restoration, public/private boundaries and HEAD. Production copying verifies every transferred object's bytes, not mock responses.

## Future boundaries

### Implemented subscription presentation and access gate

The site now displays the three planned packages in an accessible responsive dialog. `GET /api/auth/subscription` serves the catalog and the current account's status without caching. The executable requires a valid persisted `users[].subscription` for every generation POST, including synchronous, background and legacy alias routes. Missing/expired/future/unknown plans are denied before generation with HTTP 402 `subscription_required`; the web client opens the dialog. Manual campaign work is not paywalled. Checkout, subscription issuance, provider webhooks and numeric quota accounting are not implemented. Existing accounts are not automatically subscribed. Recording/transcription is explicitly marked as upcoming.

After cutover PostgreSQL is authoritative for existing domain content, subscription state, jobs and object metadata; Tigris is authoritative for uploaded files. Recording chunks, complete resource accounting and bounded local-cache eviction are future work.

Use typed relational columns for IDs, ownership, timestamps, lifecycle states, amounts and searchable attributes. Use versioned JSONB for extensible D&D rules, character configurations and proposal payloads, not a single JSONB copy of the entire application store. Keep stable internal user and campaign IDs; provider identities never become primary user IDs.

Further schema evolution, not a list of tables already implemented:

| Area | Tables and constraints |
|---|---|
| Identity | `accounts`, `oauth_identities` with unique `(provider, subject)`, hashed `auth_sessions`, expiring single-use `oauth_attempts`. Password hashes remain unchanged. |
| Tenancy | `workspaces`, `workspace_members`, `campaigns`. Initially one personal workspace per existing owner. All tenant-owned records carry workspace ID; composite foreign keys prevent cross-tenant relationships. |
| Campaign data | `entities`, `world_events`, `shops`, `combat_states`, `session_preparations`. Index campaign, kind and update time; version numbers support optimistic edits. |
| Sessions | `game_sessions`, `transcripts`, `session_analyses`, `survey_invites`, `survey_responses`, `character_invites`, `character_sheets`. Preserve public tokens during migration; hash new bearer tokens where lookup allows it. |
| AI | `ai_jobs`, `ai_job_attempts`, `ai_proposals`, `proposal_audits`. Transactional outbox connects durable jobs and workers; unique request keys prevent accidental duplicates. |
| Objects | `storage_objects`: workspace/campaign, bucket/key, SHA-256, bytes, media type, state, retention deadline. Pending uploads become ready only after successful object verification. Object deletion is retryable outbox work. |
| Billing | Versioned `plans`, `plan_prices`, `plan_entitlements`, `billing_customers`, `subscriptions`, `subscription_periods`, `payment_events`. Integer minor currency units, unique provider IDs and webhook event IDs. No payment-card data. |
| Usage | Append-only `usage_events`, `usage_reservations`, `usage_period_totals`, `daily_metrics`. Unique operation/event IDs; reserve before work, settle measured usage on success, release on failure. |
| Recorder | `recorder_installations`, `recording_sessions`, `recording_participants`, `recording_chunks`, `transcription_jobs`, consent events. Do not reuse the Discord login client as a recording bot. |

Database roles: migrations own schema; runtime has only required DML grants; reporting is read-only. Tenant authorization stays explicit in every repository operation; add transaction-scoped RLS as defense in depth. Do not trust client-supplied ownership, subscription state or usage amounts.

## Proposed monthly packages

These are a product proposal, not approved/enforced limits or a verified profitability forecast.

| Resource | Starter $5 | GM $10 | Studio $20 |
|---|---:|---:|---:|
| Standard text generations | 100 | 300 | 800 |
| Stored assets | 2 GB | 10 GB | 30 GB |
| Cloud recording and transcription hours | 2 | 6 | 16 |
| Concurrent recording sessions | 1 | 1 | 1 |
| Discord server installations | 1 | 2 | 5 |

A standard generation needs a defined input/output token envelope before enforcement. Long campaign generation, transcript analysis, images and transcription are distinct metered operations, not equivalent one-click generations. Final allowances require measured cost with the approved models; do not silently change models to make a package appear profitable.

The user selected a cloud Discord bot with both recording and transcription. These reduced draft allowances include both, subject to benchmarking the chosen transcription engine and speaker-track strategy. Recording hours mean elapsed session time, not participant-hours. Multi-track transcription can multiply the underlying provider cost and must be accounted for separately even if the displayed allowance is elapsed hours. No model or transcription provider has been selected or changed. Local Quill capture/transcription remains separate and must not be stopped or retroactively restricted by website billing.

Do not terminate an active session abruptly at the monthly boundary: reserve its configured maximum duration before starting, show the maximum, warn before it ends and finalize chunks safely. Require participant consent. Keep source audio for a stated configurable retention window, then delete asynchronously; transcripts/reports are retained under the workspace storage allowance. Deletion must cover S3 objects and database metadata with retry and audit.

No automatic overage charges. Periods follow the payment subscription, not calendar months. Downgrade/cancellation never deletes campaigns: allow read/export and block new billable work after grace. Store allowance is current bytes, not a monthly sum. Failed operations and duplicate callbacks do not double-charge usage.

## Statistics and privacy

Record successful operations, reserved/actual AI tokens, model, duration, measured cost in integer micro-USD, stored bytes, recording seconds, transcription minutes, errors by safe code, jobs queued/completed and subscription lifecycle events. Aggregate by workspace, UTC day and billing period. Do not include prompts, transcripts, names, bearer tokens, full URLs or raw IP addresses in analytics. Application content stays in its domain tables with owner-controlled access. Define retention and deletion before enabling collection; separate necessary billing audit from optional product analytics.

## Cutover and scale gates

1. Back up the live JSON, AI-job file, uploads and private proposal staging; record sizes and hashes without logging contents. Verify restore into an isolated target.
2. Implement repositories and transaction tests against isolated PostgreSQL. Import preserving IDs, ordering, links, hashes and OAuth identities; detect conflicts/orphans instead of silently dropping rows.
3. Upload all assets including deep-zoom descriptors/tiles and proposal staging. Verify hashes and counts. Keep existing public media URLs working through an access-aware S3 adapter; private bucket alone does not make old public `/uploads` links private.
4. Pause mutations for the final snapshot, import in one controlled migration, compare counts and canonical digests, then switch authority. Do not dual-write JSON and SQL without an outbox and reconciliation protocol. Keep rollback snapshots but never restore a stale JSON after SQL accepts new writes.
5. Verify login, ownership isolation, edits, uploads, proposals/apply/undo, public shares, character sheets and AI-job recovery. Add readiness checks for dependencies and an explicit export/restore path.
6. Before multiple web instances: persist auth/OAuth state, remove whole-store memory authority, move workers to durable job claims/leases, and isolate Codex processes. Use pooled connections, paginated reads and per-record optimistic concurrency. SQL/S3 provisioning alone is not horizontal scalability.
7. Enable billing only after a provider is chosen and signed idempotent webhooks, period transitions, refunds, duplicate/out-of-order events, reservations, account deletion and failure recovery are tested. Prices are USD 500/1000/2000 cents per month; taxes and payment fees are not assumed included.

## Infrastructure cost

Managed Basic is $38/month plus storage ($0.28/GB-month; approximately $40.80 at 10 GB). Tigris storage/request fees, app Machines, workers, AI, transcription, tax and payment processing are additional. Sources: https://docs.fly.io/postgres/ and https://www.tigrisdata.com/pricing/ . Recheck pricing before commercial launch.

# Shadow Edge GM

Shadow Edge GM is a backend-first DnD master toolkit with:

- React/Vite frontend in `apps/web`
- Go API/server in `apps/server`
- local JSON persistence in `data/store.json`
- public initiative tracker links
- reviewable, persistent AI proposals for campaigns, entities, and events
- a proposal-only local MCP server and an optional managed ChatGPT/Codex bridge

The project is now prepared for:

- local development
- single-container Docker deploy
- Fly.io deployment with one app and one persistent volume

## Project layout

```text
/apps
  /server
  /web
/data
  store.json
/packages
  /api-client
  /design-tokens
  /mcp-server
  /shared-types
```

## Local development

Install frontend dependencies:

```powershell
npm install
```

Run backend:

```powershell
npm run server
```

Run frontend:

```powershell
npm run dev --workspace @shadow-edge/web
```

Local URLs:

- app: [http://localhost:5173](http://localhost:5173)
- api: [http://localhost:8080](http://localhost:8080)

The Vite dev server now proxies `/api`, `/healthz`, and `/initiative` to the Go backend, so the frontend can use same-origin requests in both dev and production.

Before exposing a checkout that already has `data/store.json`, rotate its account
password with `npm run reset-password`. A credential that has ever appeared in
repository history must be treated as compromised even if it is no longer shown
in the current README.

## Environment

The server reads `.env.local` from the repo root and `apps/server/.env.local`.

Useful variables:

```powershell
SHADOW_EDGE_AUTH_USERNAME=...
SHADOW_EDGE_AUTH_PASSWORD=...
SHADOW_EDGE_AI_PROVIDER=openai
SHADOW_EDGE_AI_MODEL=gpt-5.4-mini
SHADOW_EDGE_AI_BASE_URL=https://api.openai.com/v1
SHADOW_EDGE_AI_API_KEY=...
SHADOW_EDGE_CODEX_BRIDGE_ENABLED=true
SHADOW_EDGE_CODEX_COMMAND=codex
SHADOW_EDGE_CODEX_MCP_COMMAND=node
SHADOW_EDGE_CODEX_MCP_SCRIPT=packages/mcp-server/dist/index.js
SHADOW_EDGE_CODEX_HOME_ROOT=data/codex-users
SHADOW_EDGE_CODEX_ALLOWED_USERNAME=your-admin-name
SHADOW_EDGE_CODEX_IDLE_TIMEOUT_MINUTES=30
SHADOW_EDGE_CODEX_MAX_USER_PROCESSES=1
```

`SHADOW_EDGE_AUTH_USERNAME` and `SHADOW_EDGE_AUTH_PASSWORD` bootstrap the first
account only when the selected data store has no users. They deliberately do
not overwrite credentials in an existing store. Use the password-reset command
below for an existing local file or persistent volume.

There are three AI entry modes. A server API key remains the direct fallback. A user can instead connect their ChatGPT account from the AI drafts inbox through the managed Codex App Server device flow. An external local Codex client can use the stdio package in `packages/mcp-server`; see its README and `config.example.toml`.

The managed bridge keeps Codex credentials in a private directory below `SHADOW_EDGE_CODEX_HOME_ROOT`, outside `store.json`. Because child processes on one host share an OS identity, managed ChatGPT connection is deliberately single-account: set `SHADOW_EDGE_CODEX_ALLOWED_USERNAME`, or leave it empty only when the site has exactly one registered DND account. The sole owner is pinned before the HTTP server starts accepting later registrations. Multi-account deployments must isolate users in separate OS identities or containers. The bridge gives Codex only a short-lived, revocable DND session and the proposal-only MCP server. Applying, rejecting, or undoing a proposal always happens in the authenticated website.

Managed image generation is disabled by default and enabled per prompt only when the user checks the image option. Turns are serialized, use ephemeral App Server threads, and clear the private generated-image scope before and after each turn; staged proposal media is the only output retained. Disconnect uses Codex's own logout flow against that owner's isolated credential home.

Legacy OpenAI aliases are also supported:

```powershell
OPENAI_API_KEY=...
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_MODEL=gpt-5.4-mini
```

## Build checks

Frontend:

```powershell
npm run build --workspace @shadow-edge/web
```

Backend:

```powershell
go test ./apps/server/...
```

MCP adapter:

```powershell
npm test --workspace @shadow-edge/mcp-server
```

## Docker

This repo includes a single multi-stage `Dockerfile`:

- builds the React frontend
- builds the proposal-only MCP server and installs the pinned Codex CLI
- builds the Go server
- serves the frontend from the Go server
- creates a credential-free starter campaign when `/data/store.json` is absent
- restores `/data/store.json.bak` when the primary file is absent

The repository's development `data/store.json` is never copied into the image.
This keeps local accounts, password hashes, ownership, public links, and survey
data out of fresh Docker and Fly deployments. The Docker build context also
excludes the complete runtime `data/` tree, including uploads, staged proposal
media, and managed Codex credential homes.

Build locally:

```powershell
docker build -t shadow-edge-gm .
```

Run locally:

```powershell
docker run --rm -p 8080:8080 `
  -e SHADOW_EDGE_AUTH_USERNAME=your-admin-name `
  -e SHADOW_EDGE_AUTH_PASSWORD=use-a-long-random-password `
  shadow-edge-gm
```

The two auth variables are required for a non-interactive first boot. Use a
long, unique password; a missing pair leaves first-account registration open.

Then open:

- app: [http://localhost:8080](http://localhost:8080)

If you want persistent data outside the container, mount a host folder:

```powershell
docker run --rm -p 8080:8080 `
  -v ${PWD}\\docker-data:/data `
  -e SHADOW_EDGE_AUTH_USERNAME=your-admin-name `
  -e SHADOW_EDGE_AUTH_PASSWORD=use-a-long-random-password `
  shadow-edge-gm
```

To rotate an account password in an existing mounted store, stop the serving
container and run the image interactively against the same volume:

```powershell
docker run --rm -it `
  -v ${PWD}\docker-data:/data `
  shadow-edge-gm reset-password
```

For an existing Fly volume, run the same `reset-password` subcommand in a
one-off console attached to that volume. Merely changing
`SHADOW_EDGE_AUTH_PASSWORD` does not rewrite an existing account.

## Fly.io

There is a ready `fly.toml` in the repo. It uses:

- one app
- one Docker image
- one mounted volume at `/data`
- health check on `/healthz`

Before deploy:

1. Change `app = "shadow-edge-gm"` in `fly.toml` to your unique Fly app name.
2. Make sure Docker Desktop is running locally if you want to test the image before deploy.

Deploy flow:

```powershell
fly auth login
fly apps create your-shadow-edge-app
fly secrets set SHADOW_EDGE_AUTH_USERNAME=your-admin-name SHADOW_EDGE_AUTH_PASSWORD=use-a-long-random-password
fly secrets set SHADOW_EDGE_AI_API_KEY=your_openai_key
fly deploy
```

Optional AI settings:

```powershell
fly secrets set SHADOW_EDGE_AI_PROVIDER=openai
fly secrets set SHADOW_EDGE_AI_MODEL=gpt-5.4-mini
```

Notes:

- public initiative links automatically use the request host in production, so they work on the deployed Fly domain without tunneling
- the first deploy creates a clean starter store in the Fly volume; repository development accounts and public-link tokens are not included
- an existing volume is preserved across upgrades; rotate any previously deployed or shared credential with `reset-password` before exposing the app
- if you ever want a custom domain, public initiative links will follow it automatically when the app is accessed through that domain

## GitHub push

This project can be pushed as a normal GitHub repo.

If you have not created the repo yet:

1. Create an empty repository on GitHub.
2. In this project folder run:

```powershell
git init -b main
git add .
git commit -m "Prepare Shadow Edge GM for Fly deploy"
git remote add origin https://github.com/YOUR_NAME/YOUR_REPO.git
git push -u origin main
```

If the repo is already initialized, just add the remote and push.

## Important security note

Do not commit real secrets into the repo:

- `.env.local` is ignored
- auth credentials should go into Fly secrets
- AI keys should go into Fly secrets

That keeps the public GitHub repo clean while the deployed app stays protected.

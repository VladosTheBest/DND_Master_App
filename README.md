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
- seeds `/data/store.json` and `/data/dndsu-bestiary.json` on first boot

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
- the first deploy will seed `/data/store.json` into the Fly volume if it does not exist yet
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

# External Integrations

**Analysis Date:** 2026-03-06

## APIs & External Services

**Fonts:**
- Google Fonts - Serves "Bebas Neue" and "Nunito" typefaces
  - SDK/Client: Browser `@import url(...)` in `client/src/index.css` line 2
  - Auth: None (public CDN)
  - Note: Requires internet access at load time; no local fallback fonts beyond generic `cursive` / `sans-serif`

No other external APIs or third-party services are integrated.

## Data Storage

**Databases:**
- None - All game state is held in-memory inside `RoomManager` (`server/src/game/RoomManager.ts`). No persistence layer exists.

**File Storage:**
- Local filesystem only - Sound assets served from `assets/sounds/` in development; bundled into `client/dist/` in production.

**Caching:**
- None

## Authentication & Identity

**Auth Provider:**
- None - No authentication system. Players identify only by a display name entered at the menu. The server matches reconnecting players by name within the same room (`RoomManager.ts` reconnection logic).

## Real-Time Transport

**WebSockets:**
- Socket.io 4.7.2 (bidirectional, server-authoritative)
  - Server: `server/src/index.ts` — `new Server(httpServer, { cors, pingTimeout: 60000, pingInterval: 25000 })`
  - Client: `client/src/socket.ts` — connects to `/` (same origin in prod, Vite-proxied in dev)
  - Transports: `['websocket', 'polling']` with reconnection (5 attempts, 1s delay)

## Monitoring & Observability

**Error Tracking:**
- None

**Logs:**
- `console.log` only — socket connect/disconnect events logged in `server/src/index.ts`
- No structured logging or log aggregation

## CI/CD & Deployment

**Hosting:**
- Not defined in codebase — no deployment config files (Dockerfile, fly.toml, Procfile, etc.) present

**CI Pipeline:**
- None

**Tunneling (Dev/Demo):**
- ngrok — documented in `CLAUDE.md` for exposing local Vite dev server to the internet on port 5173

## Environment Configuration

**Required env vars:**
- `PORT` — server listen port (default `3001`)
- `CLIENT_ORIGIN` — allowed CORS origin for Express and Socket.io (default `http://localhost:5173`)
- `NODE_ENV` — set to `production` to enable Express static file serving from `client/dist/`

**Secrets location:**
- No `.env` file present in repo; no secrets required (no third-party service keys)

## Webhooks & Callbacks

**Incoming:**
- None

**Outgoing:**
- None

---

*Integration audit: 2026-03-06*

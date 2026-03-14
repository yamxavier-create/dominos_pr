# Phase 10: Cloud Deployment - Context

**Gathered:** 2026-03-13
**Status:** Ready for planning

<domain>
## Phase Boundary

Deploy the app to Railway with HTTPS, WebSocket support, and auto-redeploy from main. Support custom domain configuration. The app must be permanently accessible at a public URL where anyone can play.

</domain>

<decisions>
## Implementation Decisions

### CORS & Environment Config
- Same-origin CORS only: disable CORS middleware in production (client served from same Express origin). Keep CORS enabled only for development
- Zero-config environment: only PORT (Railway-injected) and NODE_ENV=production. No custom env vars for STUN/TURN or other services
- Socket.io client auto-detects server URL from window.location (no explicit URL config). Dev proxy already handles this in development
- Add explicit `railway.toml` config file for build/start commands — version-controlled, prevents Railway from guessing wrong with monorepo structure

### Production Resilience
- Accept in-memory room loss on redeploy — games are short, players create new rooms. No persistence needed for v1.1
- Room cleanup timer behavior during free-tier sleep is acceptable — rooms are empty after process restart anyway
- Free tier for now — accept cold starts (~5-10s after 30 min inactivity). Document upgrade path to Hobby ($5/mo) for always-on

### Health Monitoring
- Add simple GET /health endpoint returning 200 — Railway uses this for health checks and auto-restart on failure
- No room stats exposed in health endpoint
- Rely on Railway's built-in metrics (CPU, memory, request logs) for everything else

### Claude's Discretion
- railway.toml exact configuration (build command, start command, environment settings)
- Socket.io client connection logic changes (if any needed beyond auto-detect)
- Health endpoint implementation details
- CORS middleware conditional logic (dev vs production)
- Custom domain setup documentation (DEPLOY-02 — support it, document how)

</decisions>

<specifics>
## Specific Ideas

No specific requirements — standard Railway deployment patterns apply.

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `server/src/config.ts`: Already reads PORT, CLIENT_ORIGIN, NODE_ENV from env vars — needs minor production-mode adjustment
- `server/src/index.ts`: Express already serves `client/dist/` in production with SPA fallback — deployment-ready architecture
- Root `package.json`: `npm run build` and `npm start` scripts already defined and working

### Established Patterns
- Single-process architecture: Express + Socket.io on same HTTP server — no separate WebSocket port needed
- Vite proxy in dev: `/socket.io` proxied to localhost:3001 — production doesn't need this (same origin)
- `NODE_ENV=production` triggers static file serving in Express

### Integration Points
- `server/src/index.ts`: CORS middleware needs conditional (dev-only)
- `server/src/index.ts`: Health endpoint added alongside existing Express routes
- Root directory: new `railway.toml` file
- GitHub repo: Railway connects for auto-deploy on push to main

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 10-cloud-deployment*
*Context gathered: 2026-03-13*

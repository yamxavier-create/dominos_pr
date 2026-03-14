# Phase 10: Cloud Deployment - Research

**Researched:** 2026-03-13
**Domain:** Cloud deployment (Railway), Node.js monorepo, Socket.io production, HTTPS/WebSocket
**Confidence:** HIGH

## Summary

This phase deploys an existing Express + Socket.io + Vite monorepo to Railway. The codebase is already production-architecture-ready: Express serves `client/dist/` in production mode, Socket.io shares the same HTTP server, and the client socket connects to `/` (same origin). The primary work is: (1) creating a `railway.toml` config file, (2) making CORS conditional for dev-only, (3) adding a `/health` endpoint, and (4) connecting the GitHub repo to Railway for auto-deploy.

Railway natively supports WebSocket upgrades over HTTPS -- no special proxy or configuration is needed. The `PORT` environment variable is auto-injected. The monorepo build/start commands already exist in root `package.json` (`npm run build` and `npm start`).

**Primary recommendation:** Use Railway's Nixpacks builder with root-level `railway.toml` specifying build and start commands. The deployment requires minimal code changes -- only CORS conditioning and a health endpoint.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Same-origin CORS only: disable CORS middleware in production (client served from same Express origin). Keep CORS enabled only for development
- Zero-config environment: only PORT (Railway-injected) and NODE_ENV=production. No custom env vars for STUN/TURN or other services
- Socket.io client auto-detects server URL from window.location (no explicit URL config). Dev proxy already handles this in development
- Add explicit `railway.toml` config file for build/start commands -- version-controlled, prevents Railway from guessing wrong with monorepo structure
- Accept in-memory room loss on redeploy -- games are short, players create new rooms. No persistence needed for v1.1
- Room cleanup timer behavior during free-tier sleep is acceptable -- rooms are empty after process restart anyway
- Free tier for now -- accept cold starts (~5-10s after 30 min inactivity). Document upgrade path to Hobby ($5/mo) for always-on
- Add simple GET /health endpoint returning 200 -- Railway uses this for health checks and auto-restart on failure
- No room stats exposed in health endpoint
- Rely on Railway's built-in metrics (CPU, memory, request logs) for everything else

### Claude's Discretion
- railway.toml exact configuration (build command, start command, environment settings)
- Socket.io client connection logic changes (if any needed beyond auto-detect)
- Health endpoint implementation details
- CORS middleware conditional logic (dev vs production)
- Custom domain setup documentation (DEPLOY-02 -- support it, document how)

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| DEPLOY-01 | App is deployed to cloud hosting with HTTPS and permanent URL | Railway provides auto-HTTPS via Let's Encrypt, permanent `*.up.railway.app` URL. Existing codebase architecture (single Express+Socket.io server, Vite static serving) maps directly to Railway's single-service model |
| DEPLOY-02 | App supports custom domain configuration | Railway supports custom domains via CNAME records. Requires adding CNAME in DNS provider pointing to Railway-provided target. SSL auto-provisioned |
| DEPLOY-03 | Push to main branch triggers automatic redeploy | Railway's GitHub integration triggers deploy on push to connected branch. Configurable via dashboard. Watch paths in railway.toml can scope triggers |
</phase_requirements>

## Standard Stack

### Core
| Component | Version/Detail | Purpose | Why Standard |
|-----------|----------------|---------|--------------|
| Railway | Hobby plan ($5/mo) | Cloud hosting platform | Native WebSocket support, auto-HTTPS, GitHub deploy integration, no Dockerfile needed |
| Nixpacks | (Railway default) | Build system | Auto-detects Node.js, runs npm install + build commands |
| railway.toml | Config-as-code | Build/deploy configuration | Version-controlled, prevents Railway from guessing monorepo structure |

### Supporting
| Component | Purpose | When to Use |
|-----------|---------|-------------|
| Railway CLI | Local debugging | Optional -- dashboard is sufficient for initial setup |
| GitHub integration | Auto-deploy | Connect repo in Railway dashboard, select main branch |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Railway | Render | Free tier sleeps after 15 min, WebSocket support similar, but Railway has better monorepo auto-detection |
| Railway | Fly.io | More control but requires Dockerfile, more complex for Socket.io |
| Nixpacks | Dockerfile | More control but unnecessary -- Nixpacks handles Node.js monorepo correctly |

## Architecture Patterns

### Recommended Configuration Structure
```
dominos-pr/
├── railway.toml              # NEW: Railway build/deploy config
├── package.json              # Existing: build + start scripts
├── server/
│   └── src/
│       ├── index.ts          # MODIFY: conditional CORS + health endpoint
│       └── config.ts         # EXISTING: already reads PORT, NODE_ENV from env
└── client/
    └── dist/                 # Built by npm run build, served by Express in production
```

### Pattern 1: railway.toml for Monorepo
**What:** Explicit build/deploy configuration that tells Railway exactly how to handle the monorepo
**When to use:** Always -- prevents auto-detection guessing wrong

```toml
[build]
buildCommand = "npm run build"

[deploy]
startCommand = "npm start"
healthcheckPath = "/health"
healthcheckTimeout = 300
restartPolicyType = "ON_FAILURE"
restartPolicyMaxRetries = 5
```

Key points:
- `npm run build` runs `npm run build --workspace=client && npm run build --workspace=server` (already defined in root package.json)
- `npm start` runs `npm run start --workspace=server` which runs `node dist/index.js` (already defined)
- No root directory override needed -- build commands operate from repo root
- healthcheckPath tells Railway to probe `/health` for liveness

### Pattern 2: Conditional CORS (Dev vs Production)
**What:** CORS middleware only active in development; production serves client from same origin
**When to use:** This exact app architecture (Express serves Vite build in production)

```typescript
// server/src/index.ts
if (config.NODE_ENV !== 'production') {
  app.use(cors({ origin: config.CLIENT_ORIGIN }))
}

const io = new Server(httpServer, {
  cors: config.NODE_ENV !== 'production'
    ? { origin: config.CLIENT_ORIGIN, methods: ['GET', 'POST'] }
    : undefined,
  pingTimeout: 60000,
  pingInterval: 25000,
})
```

Rationale: In production, client is served from the same Express server at the same origin. CORS is irrelevant. In development, Vite dev server runs on port 5173 and proxies Socket.io to port 3001, but direct connections need CORS.

### Pattern 3: Health Endpoint
**What:** Simple GET endpoint for Railway health checks
**When to use:** Always in Railway deployments

```typescript
// Add before the SPA catch-all route
app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok' })
})
```

Must be registered BEFORE the `app.get('*', ...)` SPA fallback in production, otherwise the catch-all swallows it.

### Pattern 4: Socket.io Client -- No Changes Needed
**What:** The existing client socket configuration already works for production

```typescript
// client/src/socket.ts (EXISTING -- no changes needed)
const SOCKET_URL = '/'
export const socket: Socket = io(SOCKET_URL, {
  autoConnect: false,
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
  transports: ['websocket', 'polling'],
})
```

The `/` URL resolves to the same origin in production (Express serves the client). The `transports: ['websocket', 'polling']` order is correct -- tries WebSocket first, falls back to polling. Railway supports WebSocket upgrade natively over HTTPS.

### Anti-Patterns to Avoid
- **Hardcoding production URLs in Socket.io client:** The `/` URL works for both dev (via Vite proxy) and production (same origin). Never set an explicit production URL.
- **Adding a separate WebSocket port:** Railway exposes a single port. Express + Socket.io must share one HTTP server (already the case).
- **Setting PORT in railway.toml:** Railway auto-injects PORT. Never hardcode it.
- **Using `cors: { origin: '*' }` in production:** Unnecessary and insecure when same-origin.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| SSL/HTTPS | Custom cert management | Railway auto-HTTPS (Let's Encrypt) | Automatic certificate provisioning and renewal |
| Build pipeline | Custom CI/CD | Railway GitHub integration | Push-to-deploy with zero config |
| Health monitoring | Custom status page | Railway built-in metrics | CPU, memory, request logs available in dashboard |
| Process management | PM2 or similar | Railway container restart policy | `restartPolicyType: ON_FAILURE` handles crashes |

## Common Pitfalls

### Pitfall 1: Health Endpoint Swallowed by SPA Catch-All
**What goes wrong:** The `app.get('*', ...)` route in production catches `/health` before the health handler
**Why it happens:** Express routes are matched in registration order
**How to avoid:** Register `/health` BEFORE the production static-serving block
**Warning signs:** Railway shows health check failures even though the app is running

### Pitfall 2: CORS Blocking Socket.io in Production
**What goes wrong:** Socket.io connections fail with CORS errors
**Why it happens:** CORS middleware configured with `localhost` origin runs in production
**How to avoid:** Disable CORS middleware entirely in production (same-origin, not needed)
**Warning signs:** Browser console shows CORS policy errors on WebSocket upgrade

### Pitfall 3: Railway Pricing Surprise
**What goes wrong:** Developer expects permanent free hosting
**Why it happens:** Railway no longer has a free tier. Trial gives $5 one-time credit for 30 days. After that, Hobby plan is $5/month (includes $5 usage credit).
**How to avoid:** Set up Hobby plan from the start; $5/mo covers a small app easily
**Warning signs:** App goes offline after trial expires

### Pitfall 4: WebSocket Stuck on Polling
**What goes wrong:** Socket.io never upgrades from HTTP polling to WebSocket
**Why it happens:** Misconfigured proxy or CORS blocking the upgrade request
**How to avoid:** Same-origin deployment eliminates proxy issues. Verify transports order is `['websocket', 'polling']`
**Warning signs:** Network tab shows repeated XHR requests to `/socket.io/?transport=polling` without a WebSocket frame

### Pitfall 5: Build Fails Due to devDependencies
**What goes wrong:** `npm run build` fails because TypeScript or Vite are devDependencies
**Why it happens:** Some platforms prune devDependencies before build
**How to avoid:** Railway's Nixpacks installs ALL dependencies (including dev) during build phase, then prunes. No action needed, but be aware.
**Warning signs:** `tsc: command not found` during build

## Code Examples

### Complete railway.toml
```toml
[build]
buildCommand = "npm run build"

[deploy]
startCommand = "npm start"
healthcheckPath = "/health"
healthcheckTimeout = 300
restartPolicyType = "ON_FAILURE"
restartPolicyMaxRetries = 5
```

### Modified server/src/index.ts (key changes only)
```typescript
// Health endpoint -- BEFORE static serving
app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok' })
})

// Conditional CORS -- development only
if (config.NODE_ENV !== 'production') {
  app.use(cors({ origin: config.CLIENT_ORIGIN }))
}

// Socket.io CORS -- conditional
const io = new Server(httpServer, {
  cors: config.NODE_ENV !== 'production'
    ? { origin: config.CLIENT_ORIGIN, methods: ['GET', 'POST'] }
    : undefined,
  pingTimeout: 60000,
  pingInterval: 25000,
})
```

### Custom Domain Setup (DEPLOY-02)
```
1. In Railway dashboard: Settings > Domains > Add Custom Domain
2. Enter your domain (e.g., dominospr.com)
3. Railway provides a CNAME target (e.g., g05ns7.up.railway.app)
4. In DNS provider: Create CNAME record
   - Name: @ (or subdomain like "play")
   - Value: [Railway-provided CNAME target]
   - For root domains on Cloudflare: CNAME flattening is automatic
5. Wait for Railway to verify (usually < 5 min, up to 72 hours for DNS propagation)
6. SSL certificate auto-provisioned by Railway
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Heroku free tier | Railway Hobby ($5/mo) | 2022 (Heroku removed free tier) | Railway is the modern Heroku replacement for hobby projects |
| Dockerfile required | Nixpacks auto-detection | 2023 | No Dockerfile needed for Node.js projects |
| Manual SSL setup | Auto-HTTPS (Let's Encrypt) | Standard on Railway | Zero SSL configuration |
| PM2 process manager | Container restart policies | Standard on Railway | Platform handles process restarts |

**Railway pricing note:** No permanent free tier exists. Trial = $5 one-time credit for 30 days. Hobby = $5/month subscription (includes $5 usage credit). The CONTEXT.md mentions "free tier" but this actually refers to the trial period or the Hobby plan's included credits.

## Open Questions

1. **Railway trial vs Hobby plan**
   - What we know: Trial gives $5 credit for 30 days. Hobby is $5/mo with $5 included usage.
   - What's unclear: User may expect zero-cost hosting; Railway requires $5/mo minimum after trial.
   - Recommendation: Document this clearly. The $5/mo Hobby plan is sufficient and includes app sleeping for cost savings.

2. **WebRTC STUN through Railway**
   - What we know: App uses `stun:stun.l.google.com:19302` (Google's free STUN). This is client-to-client, doesn't go through Railway.
   - What's unclear: Whether symmetric NAT scenarios will block connections for some users.
   - Recommendation: Out of scope per REQUIREMENTS.md (TURN server deferred). Monitor post-deploy.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | None configured |
| Config file | None |
| Quick run command | N/A |
| Full suite command | `cd client && npx tsc --noEmit && cd ../server && npx tsc --noEmit` (type-check only) |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DEPLOY-01 | App accessible at public HTTPS URL | manual-only | Visit Railway-provided URL in browser | N/A |
| DEPLOY-01 | Health endpoint returns 200 | smoke | `curl -s https://<app-url>/health` | N/A |
| DEPLOY-01 | Socket.io WebSocket upgrade works | manual-only | Browser Network tab shows WS frame (not just polling) | N/A |
| DEPLOY-02 | Custom domain supported | manual-only | Railway dashboard domain configuration documented | N/A |
| DEPLOY-03 | Push to main triggers redeploy | manual-only | Push a commit, observe Railway dashboard for new deploy | N/A |

**Justification for manual-only:** Deployment verification inherently requires a running production instance. Type-checking (`tsc --noEmit`) validates code correctness before deploy. Post-deploy verification is manual: visit URL, check WebSocket in devtools, confirm auto-deploy.

### Sampling Rate
- **Per task commit:** `cd client && npx tsc --noEmit && cd ../server && npx tsc --noEmit`
- **Per wave merge:** Same + manual smoke test of deployed URL
- **Phase gate:** All 5 success criteria verified manually on live deployment

### Wave 0 Gaps
None -- this phase has no unit-testable code. Validation is deployment verification (manual). Type-checking serves as the automated quality gate.

## Sources

### Primary (HIGH confidence)
- [Railway Build Configuration](https://docs.railway.com/builds/build-configuration) - build/deploy config options
- [Railway Config as Code](https://docs.railway.com/reference/config-as-code) - railway.toml/json schema
- [Railway Monorepo Guide](https://docs.railway.com/guides/monorepo) - monorepo deployment patterns
- [Railway Domains](https://docs.railway.com/networking/domains) - custom domain CNAME setup
- [Railway Serverless/App Sleeping](https://docs.railway.com/reference/app-sleeping) - sleep behavior, cold starts
- [Railway Pricing](https://docs.railway.com/reference/pricing/plans) - plan details, trial vs hobby

### Secondary (MEDIUM confidence)
- [Railway Help Station: Socket.io](https://station.railway.com/questions/socket-io-f5ab904e) - Socket.io deployment patterns
- [Railway Help Station: WebSocket Issues](https://station.railway.com/questions/web-socket-connection-issues-in-producti-ec8d4a69) - common WebSocket pitfalls

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Railway is a well-documented platform, deployment pattern is straightforward
- Architecture: HIGH - Existing codebase already has production-ready architecture (single server, static serving, same-origin Socket.io)
- Pitfalls: HIGH - Common issues are well-documented in Railway help forums and docs

**Research date:** 2026-03-13
**Valid until:** 2026-04-13 (Railway docs are stable, pricing may change)

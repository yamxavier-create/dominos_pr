# Technology Stack

**Project:** Dominos PR v1.1 -- Deploy, PWA, Circular Avatar Cameras
**Researched:** 2026-03-13
**Confidence:** MEDIUM -- versions need npm verification; patterns and recommendations are HIGH confidence from stable, well-documented tools.

---

## Executive Verdict

**Three new dev dependencies, zero new runtime dependencies, one deployment platform.**

1. **Deployment:** Railway -- native WebSocket support, monorepo-friendly, simple `npm run build && npm start` deploy, no Dockerfile needed.
2. **PWA:** `vite-plugin-pwa` -- the canonical Vite PWA solution. Generates manifest, registers service worker, handles precaching via Workbox under the hood. One plugin addition to `vite.config.ts`.
3. **Circular avatar cameras:** Pure CSS (`border-radius: 50%` + `object-fit: cover` on `<video>`) -- the existing `VideoTile.tsx` already has `overflow-hidden` and `object-cover`. Changing the container from `rounded-xl` to `rounded-full` and making it square is the entire implementation. **No library needed.**

---

## Recommended Stack Additions

### 1. Deployment Platform: Railway

| Attribute | Value |
|-----------|-------|
| Platform | [Railway](https://railway.app) |
| Purpose | Cloud hosting with persistent URL |
| Why Railway | Native WebSocket support (critical for Socket.io), auto-detects Node.js monorepo, `PORT` env var injection matches existing `config.ts`, free trial then $5/mo hobby tier |

**Why Railway over alternatives:**

| Platform | WebSocket Support | Monorepo | Free Tier | Verdict |
|----------|-------------------|----------|-----------|---------|
| **Railway** | Native, no config | Yes (Nixpacks auto-detect) | Trial credits, then $5/mo Hobby | **Recommended** |
| Render | Yes (native) | Yes | 750h free (spins down after 15min inactivity -- bad for WebSocket reconnection) | Good alternative but spin-down kills active games |
| Fly.io | Yes (via `fly.toml` config) | Requires Dockerfile | 3 shared VMs free | More config overhead, Dockerfile needed |
| Vercel | Serverless only -- no persistent WebSocket | Optimized for frontend only | Generous | **Not viable** -- Socket.io requires persistent server process |
| Netlify | No WebSocket server support | Frontend only | Generous | **Not viable** -- same reason as Vercel |

**Critical requirement:** This app uses Socket.io with long-lived WebSocket connections for real-time game state. Any serverless or spin-down platform will kill active game sessions. Railway keeps the process running continuously on the Hobby plan.

**Integration with existing codebase:**

The server already reads `PORT` from environment (see `server/src/config.ts`). Railway injects `PORT` automatically. The production static file serving is already implemented in `server/src/index.ts`. The only changes needed:

1. Set `CLIENT_ORIGIN` env var on Railway (or change CORS to allow the Railway URL)
2. Possibly adjust `CLIENT_ORIGIN` to accept the Railway-assigned domain
3. Set `NODE_ENV=production` env var

**No Dockerfile, no Procfile, no buildpack config.** Railway's Nixpacks builder detects the monorepo structure and runs `npm run build` then `npm start`.

#### Confidence: MEDIUM
Railway's WebSocket support and Node.js deployment are well-established (HIGH confidence from training data). Pricing details may have changed -- verify at railway.app/pricing before committing. The Render spin-down behavior is well-documented and confirmed as problematic for WebSocket apps.

---

### 2. PWA Support: vite-plugin-pwa

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| `vite-plugin-pwa` | `^0.20.0` | PWA manifest + service worker generation | Canonical Vite PWA plugin; maintained by the Vite ecosystem team (antfu); handles Workbox config, manifest generation, and SW registration in one plugin |

**What it provides:**

- Auto-generates `manifest.webmanifest` from config in `vite.config.ts`
- Generates a Workbox-powered service worker for asset precaching
- Provides `registerSW` virtual module for the client to register the service worker
- Handles update prompts ("New version available, reload?")

**What it does NOT do (and we don't need):**

- Offline mode -- the app is real-time multiplayer, offline play is meaningless. The service worker caches the app shell so it loads fast, but gameplay requires a socket connection.
- Push notifications -- no server infrastructure for this, out of scope.
- Background sync -- no offline queue needed.

#### Configuration approach

Add to `vite.config.ts`:

```typescript
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',  // SW updates silently, no prompt needed for a game app
      manifest: {
        name: 'Dominos PR',
        short_name: 'Dominos',
        description: 'Puerto Rican dominoes -- online multiplayer',
        theme_color: '#0f172a',
        background_color: '#0f172a',
        display: 'standalone',
        orientation: 'portrait',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        // Do NOT cache socket.io polling/websocket -- only static assets
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/socket\.io/],
      },
    }),
  ],
  // ... existing config
})
```

**Key decisions in this config:**

- `registerType: 'autoUpdate'` -- for a game app, prompting users to reload is disruptive. Auto-update the service worker silently; the next page load gets the new version.
- `navigateFallbackDenylist: [/^\/socket\.io/]` -- **critical**: without this, the service worker would intercept Socket.io HTTP polling requests and serve `index.html` instead. This would silently break the socket connection.
- `globPatterns` caches only static assets -- no API routes to worry about since there are none.

#### Assets needed

Two PNG icons (192x192 and 512x512) placed in `client/public/`. Can be generated from any domino tile graphic. These are the only new non-code files needed.

#### Confidence: MEDIUM
`vite-plugin-pwa` is the standard solution (HIGH confidence on that). Version `^0.20.0` is approximate from training data -- verify with `npm view vite-plugin-pwa version` before installing. The Workbox configuration patterns are stable and well-documented.

---

### 3. Circular Avatar Cameras: No New Dependencies

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| CSS `border-radius: 50%` | N/A (browser native) | Circular video crop | Standard CSS; works on `<video>` elements in all modern browsers; already proven in existing `overflow-hidden rounded-xl` pattern |
| Existing WebRTC streams | N/A (already implemented) | Video source | `callStore.localStream` and `callStore.remoteStreams` already provide `MediaStream` objects per player |

**The existing `PlayerSeat.tsx` already has a circular avatar** (line 27-39: `w-8 h-8 rounded-full` div showing initials). The circular video camera replaces the initials `<div>` with a `<video>` element inside the same circular container. The `object-cover` CSS property (already used in `VideoTile.tsx`) handles the aspect ratio crop.

**No canvas manipulation needed.** A common mistake is to think circular video requires drawing to a `<canvas>` with clipping. It does not -- CSS `border-radius: 50%` with `overflow: hidden` on the parent crops the `<video>` element visually. This is hardware-accelerated and zero-cost.

**No new component library needed.** The pattern is:

```tsx
<div className="w-10 h-10 rounded-full overflow-hidden">
  <video
    ref={videoRef}
    autoPlay
    playsInline
    muted={isMe}
    className="w-full h-full object-cover"
  />
</div>
```

This is a refactor of `PlayerSeat.tsx` to conditionally render video when a stream is available, falling back to the existing initials avatar when not. The `VideoTile.tsx` component already demonstrates this pattern (lines 84-98) -- the change is shape (circle vs rectangle) and integration point (inline in player seat vs separate panel).

#### Confidence: HIGH
Pure CSS circular video is a universally supported, well-proven pattern. No version concerns. The existing codebase already has all the WebRTC plumbing.

---

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| Deployment | Railway | Render Free Tier | 15-minute spin-down kills active WebSocket games; players would lose sessions |
| Deployment | Railway | Fly.io | Requires Dockerfile and `fly.toml` configuration; more DevOps overhead for a simple Node.js app |
| Deployment | Railway | Vercel/Netlify | Serverless -- cannot run persistent Socket.io server process |
| Deployment | Railway | DigitalOcean App Platform | More expensive ($12/mo minimum), more config; overkill for a single-process Node.js app |
| PWA plugin | vite-plugin-pwa | Manual service worker | Reinventing Workbox integration, manifest generation, and SW registration that vite-plugin-pwa handles in 20 lines of config |
| PWA plugin | vite-plugin-pwa | @vite-pwa/assets-generator | Only needed if generating icons from SVG source; simpler to create 2 PNG icons manually |
| Circular video | CSS border-radius | Canvas clipping | Unnecessary complexity; CSS does the job with zero JavaScript overhead |
| Circular video | Inline in PlayerSeat | Separate floating bubbles | Floating bubbles require drag/position management and overlay z-index conflicts with the game board; inline replacement is simpler and matches the existing layout |

---

## Installation

```bash
# PWA support (client workspace only)
npm install -D vite-plugin-pwa --workspace=client

# Deployment -- no npm packages, just Railway CLI (optional, can deploy via GitHub integration)
# npm install -g @railway/cli  # only if deploying from CLI

# Circular avatars -- no installation needed
```

**Total new packages: 1 dev dependency (`vite-plugin-pwa`)**

---

## Environment Variables for Deployment

These must be set on Railway (or equivalent platform):

| Variable | Value | Notes |
|----------|-------|-------|
| `NODE_ENV` | `production` | Enables static file serving from `client/dist/` |
| `PORT` | (auto-injected by Railway) | Already read by `config.ts` |
| `CLIENT_ORIGIN` | `https://your-app.up.railway.app` | For CORS -- or change to `*` in production if the server serves the client (same-origin) |

**Important CORS note:** In production, the Express server serves the client build AND the Socket.io server from the same origin. CORS is only needed for cross-origin requests. Since both run on the same `PORT` from the same process, `CLIENT_ORIGIN` can be set to the Railway URL or CORS can be relaxed. The cleanest approach: detect `NODE_ENV === 'production'` and set CORS origin to `*` or the known Railway domain.

---

## Integration Points Summary

| Feature | Files Modified | Files Created | New Dependencies |
|---------|---------------|---------------|-----------------|
| Deployment | `server/src/config.ts` (CORS adjustment) | None (Railway config via dashboard) | None |
| PWA | `client/vite.config.ts` (add plugin) | `client/public/icon-192.png`, `client/public/icon-512.png` | `vite-plugin-pwa` (dev) |
| Circular avatars | `client/src/components/player/PlayerSeat.tsx` (replace initials with conditional video) | None | None |

---

## What NOT to Add

| Temptation | Why Not |
|------------|---------|
| Docker/Dockerfile | Railway's Nixpacks handles Node.js monorepos natively; a Dockerfile adds maintenance burden with no benefit |
| Nginx reverse proxy | The Express server already serves static files and Socket.io from one process; adding a reverse proxy layer is unnecessary for a single-origin deployment |
| `workbox-*` packages directly | `vite-plugin-pwa` bundles Workbox internally; installing Workbox packages separately leads to version conflicts |
| Service worker for offline play | The app is real-time multiplayer -- offline mode is meaningless. The SW should only cache the app shell for fast loading |
| `next-pwa` or `@remix-pwa/*` | These are framework-specific; the app uses vanilla Vite + React, not Next.js or Remix |
| WebRTC media processing libraries (e.g., `mediapipe`, `@tensorflow/tfjs`) | Circular crop is CSS-only; no need for face detection, background blur, or video processing |
| Third-party avatar/video component libraries | The existing `<video>` element with CSS is all that's needed |

---

## Sources

- Codebase analysis: `server/src/config.ts` -- confirms `PORT` env var reading, `CLIENT_ORIGIN` for CORS
- Codebase analysis: `server/src/index.ts` -- confirms production static file serving already implemented
- Codebase analysis: `client/vite.config.ts` -- confirms current Vite 5 plugin structure
- Codebase analysis: `client/src/components/player/PlayerSeat.tsx` -- confirms existing circular avatar (initials) at line 27-39
- Codebase analysis: `client/src/components/player/VideoTile.tsx` -- confirms existing video + initials fallback pattern
- Codebase analysis: `client/src/components/game/VideoCallPanel.tsx` -- confirms existing WebRTC stream management
- Training data: Railway deployment for Node.js + Socket.io apps (MEDIUM confidence -- verify pricing)
- Training data: `vite-plugin-pwa` configuration patterns (MEDIUM confidence -- verify current version)
- Training data: CSS `border-radius: 50%` on video elements (HIGH confidence -- browser standard)

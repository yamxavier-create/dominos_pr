# Feature Landscape

**Domain:** Cloud deployment, PWA installation, and circular video avatar overlays for an existing real-time multiplayer domino web app
**Researched:** 2026-03-13
**Milestone scope:** v1.1 Deploy & Polish -- deploy to cloud, PWA support, circular avatar cameras

---

## Existing Feature Baseline (What Is Already Built)

| Feature | Status | Relevance to v1.1 |
|---------|--------|-------------------|
| Express serves `client/dist/` in production mode | Built | Deployment-ready. `server/src/index.ts` lines 30-34 |
| `config.ts` reads `PORT`, `CLIENT_ORIGIN`, `NODE_ENV` from env | Built | Cloud platforms set these via env vars |
| WebRTC video/audio with lobby opt-in | Built | Streams exist in `callStore` -- reuse for avatar cameras |
| `VideoCallPanel` side panel with 160x120 tiles | Built | To be replaced by circular avatar cameras |
| `PlayerSeat` with 32x32 initials circle | Built | To be modified to show live video |
| `VideoTile` component (56x42 mini video) | Built | Reference pattern; logic reusable |
| `callStore` with `localStream`, `remoteStreams`, `mutedPeers`, `cameraOffPeers` | Built | Avatar cameras consume these directly |
| Remote audio via separate `<audio>` elements in `VideoCallPanel` | Built | Must be relocated when side panel is removed |
| Stale `web/manifest.json` (Flutter boilerplate) | Exists but unused | Must be replaced with proper PWA manifest in `client/public/` |
| In-game chat, rematch voting, score history | Built | No changes needed for v1.1 |

---

## Table Stakes

Features that must ship for v1.1 to meet its stated goals. Missing = milestone incomplete.

### 1. Persistent URL via Cloud Deployment

**Why expected:** The entire point of "deploy" is a URL that works 24/7 without ngrok. Friends share a link, it just works.

**Concrete expected behavior:**
- App accessible at `https://[app-name].[platform].app` (or custom domain)
- Socket.io WebSocket connections persist (not serverless, not edge functions)
- WebRTC `getUserMedia()` works (requires HTTPS -- secure context)
- Server auto-restarts on crash (platform-managed)

**Complexity:** Low -- architecture is already production-ready. Express serves static files, Socket.io shares the HTTP server, config is env-based.

**Dependencies:** None on existing features. Unblocks PWA and production WebRTC.

### 2. WebSocket Support on Hosting Platform

**Why expected:** Socket.io is the ENTIRE transport layer. Zero REST endpoints. A platform that doesn't support persistent WebSocket connections is unusable.

**Concrete requirements:**
- Persistent process (not serverless/lambda)
- WebSocket upgrade support (not just HTTP long-polling)
- No aggressive idle timeout (Socket.io `pingInterval` is 25s, `pingTimeout` is 60s -- platform must not kill idle connections faster than this)

**Complexity:** Low -- platform selection constraint, not a code change.

**Eliminates:** Vercel (serverless), Netlify Functions (serverless), AWS Lambda (without complex API Gateway WebSocket config).

### 3. HTTPS in Production

**Why expected:** WebRTC `getUserMedia()` is blocked on insecure origins in all modern browsers. Camera/mic features break without HTTPS. PWA installability also requires secure context.

**Complexity:** Low -- Railway, Render, and Fly.io all provide free auto-managed TLS certificates.

### 4. CORS Configured for Production Origin

**Why expected:** Server currently has `cors({ origin: config.CLIENT_ORIGIN })`. In production with same-origin serving (Express serves client), CORS headers are technically unnecessary for same-origin requests. However, Socket.io's CORS config also needs to allow the production origin.

**Concrete fix:** In production, set `CLIENT_ORIGIN` to the Railway domain (e.g., `https://dominos-pr.up.railway.app`), or configure Socket.io CORS to allow same-origin by detecting production mode.

**Complexity:** Low -- environment variable configuration.

### 5. PWA Manifest + Service Worker (Minimal)

**Why expected:** "Installable from browser" is a stated v1.1 goal. Browser installability criteria: (1) valid `manifest.json` with `name`, `icons`, `start_url`, `display`; (2) registered service worker; (3) HTTPS.

**Concrete expected behavior:**
- Chrome/Safari show "Add to Home Screen" option
- App launches in standalone mode (no browser chrome)
- Home screen icon shows a domino-themed image
- Status bar matches app theme color

**Complexity:** Low -- `vite-plugin-pwa` generates manifest and service worker from config.

**Critical note on service worker scope:** The SW should cache static assets (JS, CSS, fonts, images) for faster subsequent loads. It must NOT intercept Socket.io WebSocket traffic or attempt offline game state caching. This is a real-time-only app.

### 6. PWA Icons (192px + 512px, Regular + Maskable)

**Why expected:** Install prompt and home screen require icons. Without them, the browser uses a generic icon or screenshot.

**Requirements:** 192x192 regular, 512x512 regular, 192x192 maskable, 512x512 maskable. Domino-themed design matching the dark aesthetic.

**Complexity:** Low -- design/asset creation task.

### 7. Circular Video in Player Seat Positions

**Why expected:** Headline feature of v1.1. Replace the 32x32 initials circle in `PlayerSeat` with a live video feed.

**Concrete expected behavior:**
- Each player seat shows a circular video when camera is active
- CSS approach: `border-radius: 50%` + `object-fit: cover` + `overflow: hidden` on the container
- Falls back to initials when: player not in call, camera off, no stream
- Turn indicator glow (existing `neon-glow` + team color border) applies to video circle
- Tile count badge stays visible (absolute-positioned overlay)
- Disconnect indicator preserved

**Complexity:** Medium
- Size consideration: current avatar is `w-8 h-8` (32px). Video needs at least 48-64px diameter to show a recognizable face. This means adjusting `PlayerSeat` sizing and potentially affecting game table layout
- 4 simultaneous `<video>` elements on mobile needs performance testing
- Muted attribute: video elements MUST be muted (audio plays through separate `<audio>` elements, already established pattern)
- Layout positions: `PlayerSeat` is used at top/bottom/left/right with different flex directions. The larger avatar must work in all orientations

**Dependencies:** Existing `callStore.remoteStreams` and `callStore.localStream`. No new WebRTC code.

### 8. Audio Element Relocation

**Why expected:** Currently `<audio>` elements for remote streams live inside `VideoCallPanel` (the side panel). If the side panel is removed/replaced, audio playback breaks.

**Concrete fix:** Move `RemoteAudio` components to a parent component that's always rendered (e.g., `GameTable` or `AppRoutes`), independent of any video UI panel.

**Complexity:** Low -- extract and relocate existing `RemoteAudio` pattern from `VideoCallPanel.tsx` lines 135-144.

---

## Differentiators

Features that elevate beyond minimum expectations but are not required.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Custom install prompt banner** | `beforeinstallprompt` event + custom UI increases install rate vs relying on browser's native prompt | Low | NOT available on iOS Safari. Banner only for Chrome/Android. Dismiss with localStorage for 7 days |
| **iOS standalone meta tags** | `apple-mobile-web-app-capable`, `apple-mobile-web-app-status-bar-style`, `apple-touch-icon` for polished iOS PWA feel | Low | Add to `client/index.html` head |
| **Mic/camera toggle on avatar tap** | Quick control access after side panel removal | Medium | Tap own avatar shows floating control bar; auto-dismiss after 3s. Must not interfere with tile selection |
| **Speaking indicator (pulsing ring)** | Visual feedback that a player is talking | Medium | `AudioContext.createAnalyser()` on remote `MediaStream`; animate border pulse when volume above threshold |
| **Responsive avatar size** | Larger circles on tablet, smaller on phone | Low | Tailwind responsive classes `w-10 sm:w-12 md:w-14` |
| **PWA splash screen** | Branded loading screen when app launches from home screen | Low | Manifest `theme_color` + `background_color` configuration only |
| **Health check endpoint** | Monitoring for deployed server uptime | Very Low | Single `app.get('/health', ...)` returning 200 |
| **Custom domain** | `dominos.pr` or similar is vastly more shareable than `*.up.railway.app` | Low | DNS CNAME + platform config. ~$12/year |
| **TURN server configuration** | Reliable WebRTC across carrier NATs post-deployment | Medium | Metered.ca or Twilio TURN free tier. Env var for ICE server config. No code architecture changes |

---

## Anti-Features

Features to explicitly NOT build in v1.1.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| **Offline gameplay mode** | Entire app is real-time Socket.io. No local game engine exists. Offline play is impossible | SW caches static assets only; show "Sin conexion" when socket disconnects |
| **Push notifications** | No accounts, no server-side user registry, no push subscription storage | Skip. Players coordinate via external messaging |
| **Background sync** | No pending actions queue. Game state is ephemeral and server-authoritative | Skip |
| **New getUserMedia calls in PlayerSeat** | Streams already managed in `callStore`/`useWebRTC`. Duplicate acquisition creates permission prompts and stream conflicts | Pass `MediaStream \| null` as prop. PlayerSeat renders, does not acquire |
| **Side panel AND avatar cameras simultaneously** | Redundant video display. Two places showing same streams wastes space and confuses UX | Replace side panel with avatar cameras. Relocate audio elements |
| **Full offline-first PWA with Workbox strategies** | Over-engineered for a real-time game with zero local state persistence | `vite-plugin-pwa` with `registerType: 'autoUpdate'` and default precaching |
| **Canvas-based video processing** | Face detection, background blur, circular crop via canvas are all unnecessary | Pure CSS `border-radius: 50%` + `overflow: hidden` + `object-fit: cover` |
| **Database** | No persistent data exists. Rooms are in-memory. Explicitly out of scope per PROJECT.md | Keep zero-database architecture |
| **CI/CD pipeline** | Over-engineering for this project stage | Railway auto-deploys from GitHub push |
| **Dockerfile** | Railway Nixpacks handles Node.js monorepos natively | Let platform auto-detect |
| **Adaptive bitrate / simulcast** | Avatars are small (48-64px). Even low bitrate WebRTC video looks fine at that size | Use default WebRTC quality negotiation |

---

## Feature Dependencies

```
Cloud Deployment (persistent process + HTTPS)
  |--> PWA installability (HTTPS required for service worker registration)
  |--> WebRTC works in production (getUserMedia requires secure context)
  |--> Permanent shareable URL
  |--> Can test PWA install flow (only fires on served HTTPS origins)

CORS config for production origin
  |--> Socket.io connects successfully in production

PWA manifest + icons + service worker
  |--> Browser "Add to Home Screen" prompt
  |--> beforeinstallprompt event for custom banner (Chrome/Android only)

Existing callStore streams (localStream, remoteStreams)
  |--> Circular avatar cameras (consume existing streams, no new WebRTC code)

PlayerSeat component modification
  |--> Circular video avatars (modify existing, don't create separate component)
  |--> Must preserve: initials fallback, tile count badge, turn glow, disconnect indicator

Audio element relocation (from VideoCallPanel to always-rendered parent)
  |--> Safe to remove VideoCallPanel
  |--> Audio continues playing when panel is gone

Call join controls relocation
  |--> Currently "join call" buttons are in VideoCallPanel
  |--> Need new UX for late-joining a call (button near avatars? lobby reminder?)
```

**Key insight:** Deploy must come first. Both PWA and avatar cameras can be developed locally, but PWA install prompts only fire on HTTPS origins and WebRTC camera permissions behave differently on localhost vs production. Deploy early, iterate in production.

---

## MVP Recommendation

**Phase 1: Deploy** (unblocks everything, no UI changes)
1. Deploy to Railway -- persistent process, free HTTPS, WebSocket support
2. Set `CLIENT_ORIGIN`, `PORT`, `NODE_ENV=production` environment variables
3. Verify Socket.io connects over public internet
4. Verify WebRTC video/audio works (may reveal TURN server need)

**Phase 2: Circular Avatar Cameras** (highest UX impact)
1. Modify `PlayerSeat` to accept `stream: MediaStream | null` + `cameraOff: boolean` props
2. Render `<video>` inside rounded-full container with `object-fit: cover`
3. Increase avatar diameter from 32px to ~48-56px for video visibility
4. Preserve all existing overlays (tile count, turn glow, disconnect indicator)
5. Extract `<audio>` elements from `VideoCallPanel` to always-rendered parent
6. Add compact mic/camera controls (tap own avatar or dedicated small buttons)
7. Remove `VideoCallPanel` side panel (or convert to controls-only)

**Phase 3: PWA** (polish layer, minimal code)
1. Install `vite-plugin-pwa`, configure manifest with icons
2. Add minimal service worker (static asset precaching, autoUpdate)
3. Add iOS meta tags to `client/index.html`
4. Add `viewport-fit=cover` for fullscreen feel
5. Optional: custom install prompt banner for Android/Chrome

**Defer:**
- **TURN server:** Monitor post-deploy. Add only if users report connection failures
- **Custom domain:** After deployment verified stable
- **Speaking indicator:** Future polish pass

---

## Complexity Assessment

| Feature Area | Estimated Effort | Risk | Notes |
|--------------|-----------------|------|-------|
| Cloud deployment | 2-4 hours | Low | Architecture is production-ready. Config + deploy + verify |
| Circular avatar cameras | 4-8 hours | Medium | CSS is simple but: avatar sizing affects layout, controls need new UX, audio relocation, removing side panel without regressions |
| PWA support | 2-3 hours | Low | `vite-plugin-pwa` handles 90%. Icon creation is main manual work |
| TURN server (if needed) | 2-4 hours | Medium | Provider signup + env config. No architecture changes |
| Custom install banner | 1-2 hours | Low | `beforeinstallprompt` + simple component |

---

## Sources

- **Direct codebase analysis (HIGH confidence):**
  - `server/src/index.ts` lines 30-34: production static serving implemented
  - `server/src/config.ts`: env-based config for `PORT`, `CLIENT_ORIGIN`, `NODE_ENV`
  - `client/vite.config.ts`: dev proxy config (irrelevant in production same-origin setup)
  - `PlayerSeat.tsx`: 32x32 (`w-8 h-8`) initials circle, team color border, tile count badge, turn glow
  - `VideoTile.tsx`: 56x42 video with `showVideo` conditional, mic/camera toggle buttons, `videoRef` pattern
  - `VideoCallPanel.tsx`: side panel with `RemoteAudio` audio elements (lines 135-144), call join buttons, ordered player indices
  - `web/manifest.json`: stale Flutter boilerplate with `"description": "A new Flutter project."` -- clearly not for this app
  - `client/index.html`: no PWA meta tags, no manifest link, no service worker
  - `client/package.json`: Vite 5, React 18, no PWA plugin yet
  - Socket.io config: `pingTimeout: 60000`, `pingInterval: 25000` -- platform must support these keepalive intervals

- **PWA installability criteria (HIGH confidence):** W3C Web App Manifest standard. Secure context + manifest + service worker. Stable since 2019.

- **WebRTC secure context requirement (HIGH confidence):** `getUserMedia()` restricted to HTTPS in all modern browsers. Established W3C/IETF spec.

- **Deployment platform capabilities (MEDIUM confidence):** Training data on Railway, Render, Fly.io. WebSocket support and free HTTPS are documented features. Verify current pricing/free tier limits at deployment time.

- **`vite-plugin-pwa` (MEDIUM confidence):** Widely used Vite plugin for PWA. Verify specific API and latest version during implementation.

**Confidence assessment:**

| Area | Confidence | Notes |
|------|------------|-------|
| Deployment readiness | HIGH | Verified by reading actual production mode code in `server/src/index.ts` |
| PWA requirements | HIGH | Browser installability criteria are a stable W3C standard |
| Avatar camera feasibility | HIGH | Existing `VideoTile` proves the pattern; `PlayerSeat` modification is mechanical |
| Audio relocation necessity | HIGH | Verified `RemoteAudio` lives inside `VideoCallPanel` -- must be relocated |
| Platform recommendations | MEDIUM | Training data only; verify current pricing before committing |
| `vite-plugin-pwa` API | MEDIUM | Verify during implementation |
| TURN server necessity | LOW | Depends on actual user network conditions post-deploy |

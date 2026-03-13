# Project Research Summary

**Project:** Dominos PR v1.1 — Deploy, PWA, Circular Avatar Cameras
**Domain:** Cloud deployment + progressive web app + WebRTC UI polish for an existing real-time multiplayer game
**Researched:** 2026-03-13
**Confidence:** HIGH (codebase-grounded findings) / MEDIUM (platform and PWA patterns from training data)

## Executive Summary

This milestone delivers three additive layers on top of an already production-ready codebase: cloud deployment, PWA installability, and circular avatar cameras. The existing architecture requires almost no structural change — the server already reads `PORT` and `NODE_ENV` from environment variables, Express already serves the Vite build in production mode, and the WebRTC call infrastructure already stores streams in `callStore` by player index. The entire feature set is achievable with one new dev dependency (`vite-plugin-pwa`), minimal config changes, and targeted UI component work in `PlayerSeat`. No new socket events, no new Zustand stores, zero changes to `GameEngine.ts`.

The recommended approach is to sequence phases strictly by dependency: deploy first (HTTPS is required for both WebRTC camera access and service worker registration), then PWA (additive client-only change), then circular avatar cameras (most complex UI change, benefits from real-device testing on the deployed URL). Railway is the clear platform choice — native WebSocket support, auto-detects the Node.js monorepo, provides free HTTPS, and keeps the process running continuously on the Hobby plan. Serverless platforms (Vercel, Netlify) are entirely non-viable due to Socket.io's persistent connection requirement. Render free tier is disqualified by its 15-minute idle spin-down.

The two highest risks are: (1) STUN-only WebRTC failing silently for users behind symmetric NAT (common on mobile carriers and corporate networks) — must verify post-deploy and add a TURN server if connections fail; and (2) the PWA service worker accidentally caching Socket.io polling requests, which silently breaks socket reconnection — prevented by a single `navigateFallbackDenylist: [/^\/socket\.io/]` rule in the Workbox config. Both risks are well-understood and have clear prevention strategies documented in PITFALLS.md.

---

## Key Findings

### Recommended Stack

The milestone requires minimal new dependencies. Railway provides cloud hosting with no Dockerfile required — Nixpacks auto-detects the Node.js monorepo and runs `npm run build && npm start`. `vite-plugin-pwa` (one dev dependency) handles PWA manifest generation and Workbox-powered service worker from a ~20-line config addition to `vite.config.ts`. Circular avatar cameras require zero new dependencies — pure CSS (`border-radius: 50%` + `overflow: hidden` + `object-fit: cover` + `object-position: center top`) on the existing `<video>` element pattern, already demonstrated in `VideoTile.tsx`.

**Core technologies:**
- **Railway** (deployment): persistent Node.js process, native WebSocket, auto-HTTPS, Nixpacks monorepo detection — no Dockerfile needed
- **vite-plugin-pwa ^0.20.0** (PWA): canonical Vite PWA plugin; generates manifest and Workbox service worker from `vite.config.ts` config; one install, ~20 lines of config
- **CSS `border-radius: 50%`** (circular video): browser native, zero cost; already proven by existing `rounded-full overflow-hidden` pattern in `PlayerSeat.tsx`

**Explicitly not adding:** Docker, nginx, Workbox packages directly, canvas/media processing libraries, third-party video components, offline gameplay, push notifications, CI/CD pipeline.

See STACK.md for full alternatives comparison and installation details.

### Expected Features

**Must have (table stakes):**
- Persistent public URL via cloud deployment — the entire point of v1.1
- WebSocket support on hosting platform — Socket.io is the sole transport; serverless is non-viable
- HTTPS in production — required for `getUserMedia` (WebRTC) and service worker registration (PWA)
- CORS configured for production origin — `CLIENT_ORIGIN` env var must match deployment URL
- PWA manifest + service worker (minimal) — meets browser installability criteria
- PWA icons (192px + 512px, regular + maskable) — required for "Add to Home Screen" prompt
- Circular video in player seat positions — headline UX feature; CSS-only, no new WebRTC code
- Audio element relocation — `RemoteAudio` components live inside `VideoCallPanel`; must move to an always-rendered parent before panel is deleted

**Should have (differentiators):**
- iOS standalone meta tags (`apple-touch-icon`, `apple-mobile-web-app-capable`) — professional PWA feel on iOS
- Mic/camera/join controls replacement (`FloatingCallControls`) — side panel deletion requires new control home
- Health check endpoint (`/api/health`) — monitoring, also prevents some platform idle detection
- TURN server for reliable cross-network WebRTC — monitor after deploy, add only if users report failures
- Custom install prompt banner for Android/Chrome

**Defer to v2+:**
- Offline gameplay (structurally impossible — real-time multiplayer only)
- Push notifications (no accounts, no server-side user registry)
- Speaking indicator (AudioContext analyser pulsing ring)
- Custom domain (after deployment stable)
- Persistent room state / Redis adapter

See FEATURES.md for full complexity and effort estimates.

### Architecture Approach

All three v1.1 features layer on top of the existing architecture without modifying core game logic, socket events, or store architecture. Deploy changes only `config.ts` CORS handling. PWA changes only `vite.config.ts` and adds static assets. Avatar cameras modify `PlayerSeat.tsx` and `GameTable.tsx`, create `AvatarCamera.tsx` and `FloatingCallControls.tsx`, move `RemoteAudio` to `GamePage.tsx`, and delete `VideoCallPanel.tsx`. The `callStore` already stores everything needed for avatar cameras — `localStream`, `remoteStreams[playerIndex]`, `cameraOffPeers[playerIndex]` — so `AvatarCamera` can read via fine-grained Zustand selectors without prop drilling through `GameTable`.

**Major components (new/modified):**
1. **Railway config** — env vars (`NODE_ENV=production`, `CLIENT_ORIGIN`, `PORT` auto-injected); `engines` field in `package.json`; `.env.example`
2. **VitePWA plugin config** — in `vite.config.ts`; Socket.io denylist is the critical single line
3. **`AvatarCamera`** (new) — circular `<video>` in `React.memo`; reads from `callStore` selector per player; initials fallback when no stream or camera off; mirrors local player
4. **`FloatingCallControls`** (new) — mic/camera/join/leave bar above `PlayerHand`; relocates logic from `VideoCallPanel`
5. **`PlayerSeat`** (modified) — gains `playerIndex` prop; embeds `AvatarCamera`; avatar size increases 32px → 48-56px; all existing overlays preserved
6. **`GamePage`** (modified) — hosts relocated `RemoteAudio` elements; always rendered during gameplay

See ARCHITECTURE.md for full component diagram and data flow.

### Critical Pitfalls

1. **STUN-only WebRTC fails silently for ~15% of users (symmetric NAT)** — test with phone on mobile data immediately after deploy; add TURN server (Metered.ca free tier or self-hosted coturn) if connections fail; load credentials from env vars
2. **PWA service worker caches Socket.io polling** — `navigateFallbackDenylist: [/^\/socket\.io/]` in Workbox config; this single line prevents silent socket breakage on second visit/reconnect
3. **CORS mismatch blocks socket connection in production** — set `CLIENT_ORIGIN` Railway env var to deployed URL, OR disable CORS entirely in production since same-origin deployment makes it unnecessary
4. **Video element remount causes black flash** — use `React.memo` on `AvatarCamera` and `useEffect` depending only on `[stream]` to prevent re-renders when turn changes
5. **Flutter-era `web/manifest.json` is not a valid PWA manifest** — create new `client/public/manifest.json`; install prompt silently never fires without valid icons and correct `start_url`

See PITFALLS.md for 17 total pitfalls with detection and prevention strategies.

---

## Implications for Roadmap

Based on research, the dependency graph is clear and dictates a 3-phase structure. Phases 2 and 3 can run in parallel after Phase 1, but Phase 1 is a hard prerequisite for both.

```
Phase 1: Deploy ──> Phase 2: PWA (needs HTTPS)
    |
    └──────────> Phase 3: Avatar Cameras (needs real-device testing)
```

### Phase 1: Cloud Deployment

**Rationale:** HTTPS is required for `getUserMedia` (avatar cameras) and service worker registration (PWA). Deploy must come first so all subsequent testing happens in the real environment. Both PWA install prompts and WebRTC permissions behave differently on localhost vs production HTTPS — do not defer.

**Delivers:** Persistent public URL, WebSocket connectivity over internet, HTTPS, verified socket connection, preliminary WebRTC test across real networks.

**Addresses:** Persistent URL, WebSocket platform requirement, HTTPS, CORS config for production.

**Avoids:** PORT binding mismatch (P8 — never hardcode PORT in start command), CORS mismatch (P3 — set CLIENT_ORIGIN or disable in production), missing HTTPS (P12 — choose PaaS with auto-HTTPS), idle timeout killing active games (P17 — Railway Hobby plan, not Render free tier).

**Key tasks:**
- Add `"engines": { "node": ">=18" }` to root `package.json`
- Create `.env.example` documenting `NODE_ENV`, `CLIENT_ORIGIN`, `PORT`
- Adjust CORS: disable in production (same-origin) or set `CLIENT_ORIGIN` env var on Railway
- Create Railway project, connect GitHub repo, set env vars, deploy
- Verify Socket.io WebSocket upgrade (`socket.io.engine.transport.name === 'websocket'` in console)
- Test WebRTC video between two real devices on different networks — decision point for TURN server

### Phase 2: PWA Support

**Rationale:** Entirely client-side, no interaction with avatar camera changes. Can be parallelized with Phase 3 once Phase 1 is complete. Fastest of the three phases (2-3 hours).

**Delivers:** Browser "Add to Home Screen" prompt on Android/Chrome, standalone launch mode (no browser chrome), home screen icon, fast repeat-visit loading via precached app shell.

**Uses:** `vite-plugin-pwa` (single new dev dependency; `npm install -D vite-plugin-pwa --workspace=client`).

**Avoids:** SW caching socket polling (P4 — denylist rule), install prompt never firing (P9 — valid manifest + real icons, not Flutter boilerplate), stale cached bundles after deploy (P13 — `skipWaiting`), iOS meta tag gaps (P16 — `apple-touch-icon`, `apple-mobile-web-app-capable`), `getUserMedia` permissions lost on iOS PWA (P5 — graceful fallback to initials).

**Key tasks:**
- Install `vite-plugin-pwa --workspace=client` (verify current version first)
- Create `client/public/manifest.json` (new, replaces Flutter-era `web/manifest.json`)
- Create icon assets: 192px regular, 512px regular, 512px maskable, 180px apple-touch-icon
- Configure VitePWA plugin with `navigateFallbackDenylist: [/^\/socket\.io/]`, `registerType: 'autoUpdate'`, Google Fonts `StaleWhileRevalidate`
- Add iOS meta tags + manifest link to `client/index.html`
- Run Lighthouse PWA audit after deploy; fix any installability warnings

### Phase 3: Circular Avatar Cameras

**Rationale:** Highest UX impact but most complex UI change. Benefits from stable deployment for real-device testing — avatar sizing at 48-56px and mobile tappability need physical device validation.

**Delivers:** Live circular video feeds embedded in all four player seats, removal of `VideoCallPanel` side panel (cleaner game layout), compact call controls bar, audio playback preserved.

**Implements:** `AvatarCamera` component, `FloatingCallControls` component, `PlayerSeat` modification, `GameTable` cleanup, `GamePage` audio relocation.

**Avoids:** Layout breakage for non-video players (P10 — unified component, optional video overlay, always preserve tile count badge and turn indicator), aspect ratio distortion (P6 — square container + `object-position: center top`), toggle buttons clipped by circular overflow (P14 — move controls outside circle to `FloatingCallControls`), autoplay blocked on mobile (P11 — explicit `play()` after user gesture in "Join Call" handler), prop drilling causing cascade re-renders (AP5 — `AvatarCamera` reads directly from `callStore` via fine-grained selector).

**Key tasks:**
- Create `AvatarCamera.tsx`: circular CSS, `React.memo`, `callStore` selector per `playerIndex`, initials fallback, mirror local player with `scaleX(-1)`
- Add `playerIndex` prop to `PlayerSeat`; embed `AvatarCamera`; increase size to 48-56px
- Move `RemoteAudio` elements from `VideoCallPanel` to `GamePage.tsx`
- Create `FloatingCallControls`: mic/camera/join/leave buttons, fixed bar above `PlayerHand`
- Update `GameTable`: remove `VideoCallPanel` import/render, add `playerIndex` to each `PlayerSeat`, add `FloatingCallControls`
- Delete `VideoCallPanel.tsx`
- Test on mobile: circular video renders, initials fallback works, controls tappable, no layout overflow at left/right seat columns

### Phase Ordering Rationale

- Deploy before everything else because HTTPS is required for both `getUserMedia` (camera access) and service worker registration. Testing PWA install or video calling in a non-HTTPS environment gives false results.
- PWA and avatar cameras are independent after deploy; parallelization is possible. If sequential, PWA is faster and provides a clean checkpoint before the more complex component refactor.
- TURN server decision is a branch point at the end of Phase 1: test WebRTC between two real devices on different networks. If connections succeed with STUN-only, TURN can be deferred. If they fail, add TURN before Phase 3 ships (avatar cameras depend on reliable video streams).

### Research Flags

Phases needing deeper research during planning:
- **Phase 1 (Deploy) — TURN server:** Whether Metered.ca free tier suffices or self-hosted coturn is needed depends on actual test results post-deploy. Flag for research only if Phase 1 WebRTC testing reveals connection failures across different networks.
- **Phase 3 (Avatar Cameras) — iOS PWA camera lifecycle:** Re-acquisition after app backgrounding via `document.visibilitychange` + `RTCRtpSender.replaceTrack()` is an edge case that may need targeted research if iOS testing reveals track-ended issues.

Phases with standard patterns (skip research-phase):
- **Phase 2 (PWA):** `vite-plugin-pwa` is well-documented with stable Workbox patterns. All configuration decisions are fully covered in ARCHITECTURE.md and PITFALLS.md.
- **Phase 1 (Railway deployment):** Single-process Node.js + Socket.io on Railway is a well-established pattern with clear steps. No novel integration challenges.

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | MEDIUM | Railway and `vite-plugin-pwa` well-established; verify exact pricing and version at implementation time |
| Features | HIGH | Grounded in direct codebase analysis; what exists and what needs to change is confirmed by reading actual source files |
| Architecture | HIGH | Change map grounded in actual component code; data flow verified against `callStore`, `PlayerSeat`, `VideoCallPanel` source |
| Pitfalls | HIGH (codebase) / MEDIUM (platform) | CORS, audio relocation, and layout risks verified against real code; WebRTC TURN and platform behaviors are training data |

**Overall confidence:** MEDIUM-HIGH

### Gaps to Address

- **TURN server necessity:** Cannot determine until WebRTC is tested across different real networks post-deploy. Recommended fallback: Metered.ca free tier (500MB/month). Add only if Phase 1 test reveals connection failures.
- **`vite-plugin-pwa` exact version:** Training data suggests `^0.20.0`; verify with `npm view vite-plugin-pwa version` before installing.
- **Railway pricing:** Training data on $5/month Hobby plan; verify at railway.app/pricing before committing.
- **iOS PWA camera permissions:** Behavior in standalone mode varies by iOS version (pre-16.4 had severe restrictions). Design `AvatarCamera` with graceful fallback to initials as the safe default; test on physical iOS device.
- **Avatar size impact on game table layout:** Increasing `PlayerSeat` avatar from 32px to 48-56px needs visual testing on mobile screen sizes. Left/right seat columns are the tightest constraint — may need responsive sizing (`w-10 sm:w-12 md:w-14`).

---

## Sources

### Primary (HIGH confidence — direct codebase analysis)
- `server/src/index.ts` — production static serving confirmed at lines 30-34
- `server/src/config.ts` — env var reading for `PORT`, `CLIENT_ORIGIN`, `NODE_ENV` confirmed
- `client/src/socket.ts` — relative URL `'/'` confirmed (correct for same-origin production)
- `client/src/components/player/PlayerSeat.tsx` — 32x32 initials circle, `rounded-full overflow-hidden`, existing props confirmed
- `client/src/components/game/VideoCallPanel.tsx` — `RemoteAudio` at lines 135-144, call controls confirmed
- `client/src/components/game/GameTable.tsx` — 3x3 grid, `VideoCallPanel` placement confirmed
- `client/src/store/callStore.ts` — `localStream`, `remoteStreams[playerIndex]`, `cameraOffPeers` confirmed
- `client/src/hooks/useWebRTC.ts` — STUN-only ICE config confirmed
- `client/src/components/player/VideoTile.tsx` — `object-fit: cover`, `videoRef` srcObject pattern confirmed
- `web/manifest.json` — Flutter boilerplate confirmed (description: "A new Flutter project." — unusable)
- `client/index.html` — no PWA meta tags, no manifest link confirmed
- Socket.io config — `pingTimeout: 60000`, `pingInterval: 25000` confirmed
- `.planning/PROJECT.md` — v1.1 scope, no-database constraint, avatar camera intent confirmed

### Secondary (MEDIUM confidence — training data)
- Railway deployment for Node.js + Socket.io WebSocket apps
- `vite-plugin-pwa` / Workbox configuration patterns
- WebRTC TURN/STUN behavior and symmetric NAT failure modes (~15% failure rate)
- PaaS platform behavior: idle timeouts, WebSocket proxy support, Nixpacks build detection
- Service worker + Socket.io interaction patterns (polling fallback interception risk)
- iOS PWA standalone mode limitations for `getUserMedia`
- PWA installability criteria — W3C Web App Manifest standard
- WebRTC secure context requirement — W3C/IETF spec (`getUserMedia` requires HTTPS)

### Tertiary (verify at implementation)
- Railway current pricing (was $5/month Hobby plan — confirm at railway.app/pricing)
- `vite-plugin-pwa` current stable version (was `^0.20.0` — verify with `npm view vite-plugin-pwa version`)
- Metered.ca TURN free tier limits (was 500MB/month relay — verify at metered.ca)

---
*Research completed: 2026-03-13*
*Ready for roadmap: yes*

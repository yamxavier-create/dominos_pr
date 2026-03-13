# Architecture Patterns

**Domain:** Real-time multiplayer domino web app -- v1.1 deploy, PWA, and circular avatar cameras
**Researched:** 2026-03-13
**Confidence:** MEDIUM (deploy platform and PWA plugin recommendations based on training data; CSS/WebRTC patterns are HIGH confidence)

---

## Current Architecture Snapshot

Before describing changes, here is what exists:

```
[Browser]                          [Server (Express + Socket.io)]
  React 18 + Vite 5                  Express 4 serves client/dist in production
  Zustand (gameStore, roomStore,     Socket.io 4.7 on same HTTP server
    uiStore, callStore)              RoomManager (in-memory, 10-min cleanup)
  Socket.io-client (ws://)           GameEngine (pure functions only)
  WebRTC peer-to-peer                webrtcHandlers (signaling relay)
  useWebRTC hook (Perfect Neg.)      No database, no auth
  VideoCallPanel (side panel)        PORT from env, CLIENT_ORIGIN from env
```

**Key invariants preserved by this milestone:**
- Server is a single Node.js process with in-memory state
- Express serves Vite build (`client/dist/`) in production mode
- Socket.io shares the same HTTP server -- single origin, no CORS needed in production
- `socket.ts` client uses relative URL `SOCKET_URL = '/'` -- works on any domain
- WebRTC is peer-to-peer with STUN only (`stun:stun.l.google.com:19302`)
- `GameEngine.ts` pure functions are NOT touched by any v1.1 feature
- All game state flows through Socket.io -- no REST API

**None of the v1.1 features modify core game logic, socket events, or store architecture.**

---

## High-Level Change Map

```
FEATURE 1: Cloud Deployment
  MODIFY: server/src/config.ts (production CLIENT_ORIGIN handling)
  MODIFY: package.json (add "engines" field for Node version)
  NEW:    .env.example (document required env vars)
  NO CHANGE: socket.ts (already uses relative '/')
  NO CHANGE: vite.config.ts proxy (dev-only, ignored in production)
  NO CHANGE: server/src/index.ts production serving (already correct)

FEATURE 2: PWA Support
  NEW:    client/public/manifest.json
  NEW:    client/public/icons/ (192px, 512px, maskable app icons)
  MODIFY: client/vite.config.ts (add VitePWA plugin)
  MODIFY: client/index.html (theme-color meta, apple-touch-icon link)
  MODIFY: client/package.json (add vite-plugin-pwa as devDependency)
  NO CHANGE: server (PWA is entirely client-side)
  NO CHANGE: Socket.io (WebSocket bypasses service workers)

FEATURE 3: Circular Avatar Cameras
  NEW:    client/src/components/player/AvatarCamera.tsx
  NEW:    client/src/components/game/FloatingCallControls.tsx
  MODIFY: client/src/components/player/PlayerSeat.tsx (embed AvatarCamera, add playerIndex prop)
  MODIFY: client/src/components/game/GameTable.tsx (remove VideoCallPanel, add FloatingCallControls)
  MODIFY: client/src/pages/GamePage.tsx (move RemoteAudio elements here)
  DELETE: client/src/components/game/VideoCallPanel.tsx (replaced entirely)
  NO CHANGE: client/src/hooks/useWebRTC.ts (streams stay in callStore)
  NO CHANGE: client/src/store/callStore.ts (already stores streams by player index)
  NO CHANGE: server (WebRTC signaling unchanged)
```

---

## Component Boundaries

| Component | Responsibility | Communicates With |
|-----------|---------------|-------------------|
| **Deploy config** (.env, Railway) | Platform setup, port binding, build pipeline | Railway platform, Express server |
| **vite-plugin-pwa** (build plugin) | Generates service worker + injects manifest | Vite build pipeline, browser PWA APIs |
| **manifest.json** | PWA metadata (name, icons, display mode) | Browser install prompt, OS launcher |
| **Service Worker** (auto-generated) | Cache app shell, offline fallback | Browser Cache API, network |
| **AvatarCamera** (new) | Renders circular `<video>` from MediaStream | `callStore` (reads stream), `PlayerSeat` (parent) |
| **PlayerSeat** (modified) | Player info + circular avatar (video or initials) | `AvatarCamera`, `callStore`, `GameTable` |
| **FloatingCallControls** (new) | Mic/camera toggle, join/leave call buttons | `callStore`, `socket` (webrtc:toggle emit) |
| **GamePage** (modified) | Hosts RemoteAudio elements (moved from VideoCallPanel) | `callStore` |

---

## Feature 1: Cloud Deployment

### Architecture Decision: Single-Process Deploy on Railway

**Use Railway** because Express + Socket.io on the same HTTP server is a single-process architecture. Railway natively supports WebSocket upgrades on its proxy, auto-deploys from GitHub, provides HTTPS by default, and supports custom domains. The app needs zero architectural changes.

**Why not Vercel/Netlify:** Optimized for serverless/static. Socket.io requires a persistent process for WebSocket connections. Vercel Functions have execution timeouts (10s free, 60s pro) and do not support WebSocket upgrades. Would force splitting client and server to separate hosts, requiring CORS and absolute socket URL.

**Why not Fly.io:** Works but requires Dockerfile and `fly.toml`. Railway auto-detects Node.js and runs scripts directly. Less config friction.

**Why not Render:** Comparable to Railway. Either works. Railway's usage-based pricing is slightly better for intermittent hobby traffic vs Render's free tier spin-down after 15 min inactivity.

### Deployment Data Flow

```
[GitHub push to main] --> [Railway auto-deploy]
  1. npm install (all workspaces -- monorepo detected)
  2. npm run build
     a. client: tsc && vite build --> client/dist/
     b. server: tsc --> server/dist/
  3. npm start --> node server/dist/index.js
     - Express serves client/dist as static files
     - Socket.io attaches to same HTTP server
     - PORT injected by Railway (process.env.PORT)
  4. Railway proxy terminates HTTPS, upgrades WebSocket
```

### Server Config Changes

Current `config.ts` already reads `PORT`, `CLIENT_ORIGIN`, `NODE_ENV` from env:

```typescript
export const config = {
  PORT: parseInt(process.env.PORT || '3001', 10),
  CLIENT_ORIGIN: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
  NODE_ENV: process.env.NODE_ENV || 'development',
}
```

- **PORT**: Railway auto-injects. Already handled. No change.
- **CLIENT_ORIGIN**: In production, set to the Railway URL via dashboard env vars. Simplest approach -- no code change needed. The CORS middleware and Socket.io CORS config use this value.
- **NODE_ENV**: Railway sets to `'production'` by default.

### Socket.io Path in Production

Client `socket.ts` already uses `SOCKET_URL = '/'` (relative URL). In production, this connects to the same Express origin -- correct. The Vite dev proxy is irrelevant in production builds. No changes needed.

### WebSocket Considerations

- Railway proxy supports WebSocket upgrades natively
- `pingTimeout: 60000` and `pingInterval: 25000` are production-appropriate
- STUN-only WebRTC will fail for symmetric NAT pairs (common on cellular). Consider adding TURN as a fast follow if users report video failures. Not blocking for initial deploy.

### What Does NOT Change

- `socket.ts` client: relative `'/'` URL works on any domain
- `vite.config.ts` proxy: dev-only, not in production build
- `index.ts` production static serving: already implemented (lines 30-34)
- `RoomManager`: in-memory rooms acceptable. Server restart loses rooms (accepted)

---

## Feature 2: PWA Support

### Architecture Decision: vite-plugin-pwa with Network-First Navigation

**Use vite-plugin-pwa** because it is the standard PWA plugin for Vite. Auto-generates service worker via Workbox, handles manifest, integrates with build pipeline. Manual service worker would be more work for no benefit.

**Cache strategy:** Network-first for navigation, cache-first for static assets. The app is real-time multiplayer -- caching game state or Socket.io would break the app. SW caches only the app shell for fast repeat-visit loading.

**No offline mode** because core value is real-time multiplayer. Offline dominos against AI is a different product. Cache the shell, show "Sin conexion" when offline.

### PWA Data Flow

```
[First visit]
  Browser loads app --> SW registers --> precaches shell assets
  Browser may show "Add to Home Screen" prompt

[Subsequent visits]
  SW serves cached shell --> app boots instantly
  Socket.io connects over WebSocket (bypasses SW entirely)
  If offline --> SW serves fallback, socket fails to connect

[App update after deploy]
  New SW hash --> browser downloads update in background
  registerType: 'autoUpdate' --> activates on next navigation
```

### Critical Configuration: Socket.io Denylist

**The service worker MUST NOT intercept Socket.io polling URLs.** Socket.io falls back to HTTP long-polling when WebSocket fails. If the SW matches `/socket.io/*` and serves cached HTML, the connection silently breaks.

```typescript
navigateFallbackDenylist: [/^\/socket\.io/]
```

This is the single most important line in the PWA configuration.

### vite.config.ts Changes

```typescript
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/socket\.io/],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com/,
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'google-fonts-stylesheets' }
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-webfonts',
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 }
            }
          }
        ]
      },
      manifest: false, // Use manual manifest.json in public/
    })
  ],
  // ... existing server, host, proxy config unchanged
})
```

### manifest.json (new: client/public/manifest.json)

```json
{
  "name": "Domino PR",
  "short_name": "Domino PR",
  "description": "Domino puertorriqueno en linea",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#0a0a0a",
  "theme_color": "#0a0a0a",
  "orientation": "portrait",
  "icons": [
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png" },
    { "src": "/icons/icon-512-maskable.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ]
}
```

- `display: "standalone"` hides browser chrome
- `orientation: "portrait"` -- game table designed for portrait
- Colors match dark felt-table background
- Maskable icon for Android adaptive icons

### index.html Additions

```html
<head>
  <meta name="theme-color" content="#0a0a0a" />
  <link rel="manifest" href="/manifest.json" />
  <link rel="apple-touch-icon" href="/icons/icon-192.png" />
  <!-- existing preconnect + font tags stay -->
</head>
```

### What Does NOT Change

- Server code: PWA is client-side only
- Socket.io: WebSocket bypasses service workers
- React Router: SPA fallback (`app.get('*', ...)`) already serves `index.html`

---

## Feature 3: Circular Avatar Cameras

### Architecture Decision: Embed Video in PlayerSeat, Delete Side Panel

Current `PlayerSeat` renders a 32x32px circle with 2-letter initials. Current `VideoCallPanel` renders 160x120px rectangular video tiles in a collapsible right-side panel. Avatar cameras replace the initials circle with live circular video, eliminating the side panel.

**Embed in PlayerSeat (not overlay)** because PlayerSeat already occupies the correct position in the 3x3 game grid. Overlaying video would duplicate position logic.

**Delete VideoCallPanel (not keep both)** because two video displays of the same stream confuse users and waste space. Side panel was v1.0 pragmatic choice; avatar cameras are the intended UX per PROJECT.md decision.

### Target Component Architecture

```
GamePage
  +-- GameTable
  |     +-- PlayerSeat (bottom = me)
  |     |     +-- AvatarCamera (localStream, circular, mirrored)
  |     |     +-- Name + tile count badge
  |     +-- PlayerSeat (top)
  |     |     +-- AvatarCamera (remoteStreams[topIndex] or initials)
  |     +-- PlayerSeat (left)
  |     |     +-- AvatarCamera (remoteStreams[leftIndex] or initials)
  |     +-- PlayerSeat (right)
  |     |     +-- AvatarCamera (remoteStreams[rightIndex] or initials)
  |     +-- FloatingCallControls (join/leave, mic, camera toggles)
  |
  +-- RemoteAudio x N (hidden <audio> elements, moved from VideoCallPanel)
  +-- ChatButton + ChatPanel (existing)
```

### AvatarCamera Component Design

```typescript
interface AvatarCameraProps {
  playerIndex: number
  initials: string
  isMe: boolean
  isCurrentTurn: boolean
  teamColor: string
  size?: number  // 48 for opponents, 56 for local player
}
```

**Implementation details:**

1. **Circular video via CSS:** Container gets `border-radius: 50%` + `overflow: hidden`. `<video>` uses `object-fit: cover`. Standard CSS, all browsers. No clip-path, no canvas.

2. **Stream sourcing from callStore (fine-grained selectors):**
   ```typescript
   const stream = useCallStore(s =>
     isMe ? s.localStream : (s.remoteStreams[playerIndex] ?? null)
   )
   const cameraOff = useCallStore(s =>
     isMe ? s.cameraOff : (s.cameraOffPeers[playerIndex] ?? false)
   )
   ```
   Component only re-renders when its own stream changes. No prop drilling through GameTable.

3. **Fallback to initials:** When `stream === null` or `cameraOff === true`, render existing initials circle. Same visual as current PlayerSeat.

4. **Mirror local video:** `transform: scaleX(-1)` on local player's `<video>`. Users expect mirror self-view. Remote videos NOT mirrored.

5. **Muted video element:** `<video muted={true}>` always. Audio through separate `<audio>` elements. Prevents echo, satisfies autoplay policies.

6. **Size increase:** From 32x32 to 48x48 opponents, 56x56 self. Fits existing grid:
   - Top: plenty of vertical space
   - Left/Right: narrow columns accommodate 48px with existing `px-1` padding
   - Bottom: most space available

7. **Turn indicator glow:** Existing neon border effect applies to video circle container div, not the `<video>` element.

### Preventing Video Element Remount Flashes

If `<video>` unmounts/remounts, `srcObject` must be reassigned and `play()` called again, causing a visible black flash. Prevention:

- **`React.memo` on AvatarCamera** -- prevents re-renders from parent state changes (like `currentPlayerIndex` changing every turn)
- **`useEffect` depends only on `[stream]`** -- not on parent state
- **Stable props from PlayerSeat** -- `playerIndex`, `isMe`, `initials` are stable within a game

### Data Flow (No New Plumbing)

```
callStore.localStream ──────────────────────┐
callStore.remoteStreams[playerIndex] ────────┤
callStore.cameraOffPeers[playerIndex] ──────┤
                                            v
                             AvatarCamera (Zustand selector, React.memo)
                                            |
                                            v
                             <video> circular or initials fallback
```

callStore already stores everything needed. The only code change: PlayerSeat gains a `playerIndex` prop so AvatarCamera can look up the correct stream.

### RemoteAudio Relocation

`RemoteAudio` components (hidden `<audio>` for remote peer audio) currently live in `VideoCallPanel`. Since that is being deleted, move to **GamePage.tsx** -- always mounted during gameplay. NOT inside PlayerSeat (presentational component should not manage audio lifecycle).

```typescript
// In GamePage.tsx, after <GameTable />:
{inCall && peerIndices.map(idx => (
  <RemoteAudio key={`audio-${idx}`} stream={remoteStreams[idx] ?? null} />
))}
```

### FloatingCallControls (New Component)

With side panel removed, controls need a new home.

**Fixed bar at bottom of screen, above PlayerHand:**

```
  ┌──────────────────────────────────────┐
  │  [Mic] [Camera] [Leave Call]         │  <-- FloatingCallControls
  ├──────────────────────────────────────┤
  │  PlayerSeat (me) + AvatarCamera      │
  │  [tile] [tile] [tile] [tile] ...     │  <-- PlayerHand
  └──────────────────────────────────────┘
```

States:
- **Not in call:** Show "Unirse" button (replaces VideoCallPanel join buttons)
- **In call:** Mic toggle, camera toggle, leave-call button

Reads from callStore, emits `webrtc:toggle` and `webrtc:lobby_opt` via socket -- same logic from VideoCallPanel, relocated.

### PlayerSeat Modification

Current props: `player, isCurrentTurn, position, teamLabel, teamColor`
New props: `player, isCurrentTurn, position, teamLabel, teamColor, playerIndex`

GameTable already knows each player's index. Pass through to PlayerSeat.

### GameTable Modification

1. Remove `<VideoCallPanel>` render and import
2. Add `playerIndex` prop to each `<PlayerSeat>` call
3. Add `<FloatingCallControls>` at bottom of layout
4. No changes to 3x3 grid structure -- avatars live inside existing PlayerSeat cells

---

## Patterns to Follow

### Pattern 1: Environment-Driven Configuration
**What:** Deploy-specific values from env vars with dev defaults.
**Where:** `server/src/config.ts` -- extend minimally.
**Why:** Same code runs locally and on Railway.

### Pattern 2: Fine-Grained Zustand Selectors for Streams
**What:** Specific selectors per player to avoid cascade re-renders.
```typescript
// GOOD: re-renders only when THIS player's stream changes
const stream = useCallStore(s => s.remoteStreams[playerIndex] ?? null)

// BAD: re-renders when ANY stream changes
const allStreams = useCallStore(s => s.remoteStreams)
```

### Pattern 3: Progressive Enhancement for PWA
**What:** PWA is additive. If SW fails, app works as regular web app.
**Why:** Must work in all browsers. PWA features are a layer, never a requirement.

### Pattern 4: CSS-Only Circular Video
**What:** `border-radius: 50%` + `overflow: hidden` + `object-fit: cover`.
**Why:** Simpler and more performant than canvas or clip-path. Handles resize automatically.

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Service Worker Caching Socket.io Traffic
**What:** SW intercepts `/socket.io/*` URLs.
**Why bad:** Long-polling fallback gets cached HTML. Connection silently breaks.
**Instead:** `navigateFallbackDenylist: [/^\/socket\.io/]`

### Anti-Pattern 2: Video Elements in Frequently Re-rendering Parents
**What:** `<video>` unmounts/remounts on turn changes.
**Why bad:** Each remount requires `srcObject` reassignment + `play()`, causing black flash.
**Instead:** `React.memo` on AvatarCamera; `useEffect` depends only on `[stream]`.

### Anti-Pattern 3: Splitting Client and Server to Different Hosts
**What:** Client on Vercel, server on Railway.
**Why bad:** Requires CORS, separate deploys, absolute socket URL. Architecture is single-origin.
**Instead:** Single Railway deploy. Express serves client build.

### Anti-Pattern 4: Full Offline Mode for Real-Time Game
**What:** Cache game state, provide offline gameplay.
**Why bad:** Core value is real-time multiplayer. Stale cached state shows wrong board.
**Instead:** Cache only app shell. Show offline message.

### Anti-Pattern 5: Threading Streams Through Props
**What:** GameTable passes streams as props through PlayerSeat to AvatarCamera.
**Why bad:** GameTable re-renders every turn, unnecessarily updating all stream props.
**Instead:** AvatarCamera reads directly from callStore via Zustand selector.

### Anti-Pattern 6: Creating New Store for Avatar State
**What:** New `videoAvatarStore` tracking which players have active video.
**Why bad:** callStore already tracks all of this. Duplicates state, creates sync issues.
**Instead:** AvatarCamera reads from callStore directly.

---

## Build Order (Dependency-Aware)

### Phase 1: Cloud Deployment (prerequisite for everything)

1. Create `.env.example` documenting env vars
2. Set `CLIENT_ORIGIN` on Railway dashboard to deployed URL
3. Add `"engines": { "node": ">=18" }` to root `package.json`
4. Create Railway project, connect GitHub repo
5. Deploy, verify: HTTP serves app, Socket.io WebSocket upgrades, full game flow
6. Verify WebRTC video between two devices on deployed URL

**Why first:** PWA requires HTTPS (Railway provides it). Avatar cameras need real-device testing. Deploy unlocks everything.

### Phase 2: PWA Support (depends on deploy for HTTPS)

1. `npm install -D vite-plugin-pwa --workspace=client`
2. Create `client/public/manifest.json` and icon assets
3. Add VitePWA plugin to `vite.config.ts` with Socket.io denylist
4. Add meta tags to `index.html`
5. Deploy, test install prompt on mobile Chrome and Safari
6. Verify Socket.io works with SW active

**Why second:** Entirely client-side. Does not interact with avatar cameras. Requires HTTPS.

### Phase 3: Circular Avatar Cameras (benefits from deploy)

1. Create `AvatarCamera` component (circular CSS, React.memo, stream selector)
2. Add `playerIndex` prop to PlayerSeat, embed AvatarCamera
3. Move RemoteAudio from VideoCallPanel to GamePage
4. Create FloatingCallControls for mic/cam/join/leave
5. Update GameTable: remove VideoCallPanel, pass playerIndex to each PlayerSeat
6. Delete VideoCallPanel.tsx
7. Test: circular video, turn glow, initials fallback, mirrored local view
8. Test on mobile: avatar sizes fit, controls tappable, no layout overflow

**Why third:** Most complex UI change. Benefits from stable deploy for real-device testing. Independent of PWA.

### Dependency Graph

```
Phase 1: Deploy ──> Phase 2: PWA (needs HTTPS)
    |
    └──────────> Phase 3: Avatar Cameras (needs real-device testing)

Phase 2 and Phase 3 can run in parallel after Phase 1.
```

---

## Integration Points Summary

| Change | Touches | Does NOT Touch |
|--------|---------|----------------|
| Deploy | `config.ts` (CORS env), Railway env vars, `package.json` (engines) | Any game logic, stores, components |
| PWA | `vite.config.ts` (plugin), `client/public/` (icons), `index.html` (meta) | Server code, stores, game logic |
| Avatars | `PlayerSeat.tsx`, `GameTable.tsx`, `GamePage.tsx`, new `AvatarCamera.tsx`, new `FloatingCallControls.tsx` | `GameEngine.ts`, `callStore`, `useWebRTC.ts`, socket events |

**GameEngine.ts changes: zero.**
**New socket events: zero.**
**New Zustand stores: zero.**
**Server-side changes: config only (deploy). Zero for PWA and avatars.**

---

## Scalability Considerations

| Concern | Current (4 players) | At 100 rooms | At 1000 rooms |
|---------|---------------------|--------------|---------------|
| Memory | ~50KB/room | ~5MB total | ~50MB -- fine |
| WebSocket connections | 4/room | 400 | 4000 -- may need scaling |
| WebRTC (STUN) | Peer-to-peer | Same | Same |
| SW cache per client | ~2MB shell | Same | Same |
| Railway free tier | 500 hrs/month | Paid ($5/mo) | Paid |

Single Railway instance sufficient for foreseeable future. Do not over-architect.

---

## Sources

- Codebase: `server/src/index.ts` -- production static serving (lines 30-34), Socket.io setup
- Codebase: `server/src/config.ts` -- env var handling
- Codebase: `client/src/socket.ts` -- relative URL `'/'`, transport config
- Codebase: `client/src/components/player/PlayerSeat.tsx` -- current 32x32 initials avatar, props
- Codebase: `client/src/components/game/VideoCallPanel.tsx` -- current video tiles, RemoteAudio, controls
- Codebase: `client/src/components/game/GameTable.tsx` -- 3x3 grid, PlayerSeat usage, VideoCallPanel placement
- Codebase: `client/src/pages/GamePage.tsx` -- WebRTC hook mount, component tree
- Codebase: `client/src/store/callStore.ts` -- stream storage by player index
- Codebase: `client/src/hooks/useWebRTC.ts` -- STUN config, Perfect Negotiation
- Codebase: `client/vite.config.ts` -- current plugins, dev proxy
- Codebase: `client/index.html` -- current HTML structure
- Codebase: `package.json` files -- dependencies, scripts
- `.planning/PROJECT.md` -- v1.1 scope, avatar camera decision
- Training data: Railway deployment for Node.js + WebSocket (MEDIUM confidence)
- Training data: vite-plugin-pwa / Workbox configuration (MEDIUM confidence)
- Training data: CSS circular video rendering (HIGH confidence -- basic CSS)
- Training data: Service worker + Socket.io interaction (MEDIUM confidence)

---
*Architecture analysis completed: 2026-03-13*

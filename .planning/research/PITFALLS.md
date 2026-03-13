# Domain Pitfalls

**Domain:** Cloud deployment, PWA support, and circular video avatars for an Express+Socket.io+WebRTC real-time game
**Researched:** 2026-03-13
**Milestone:** v1.1 Deploy & Polish
**Confidence:** HIGH (codebase-grounded) / MEDIUM (deployment and PWA patterns from training data, no web search available)

---

## Critical Pitfalls

Mistakes that cause broken deploys, unusable video, or production outages.

---

### Pitfall 1: STUN-Only WebRTC Fails for ~15% of Users Behind Symmetric NAT

**What goes wrong:** The current `useWebRTC.ts` uses only Google's public STUN server (`stun:stun.l.google.com:19302`). STUN works when both peers are behind cone NATs (most home routers). It fails silently when either peer is behind a symmetric NAT (common in corporate networks, mobile carriers, university WiFi, and some 4G/5G connections). The 15-second timeout in `createPC` fires, `peerState` becomes `'failed'`, and the user sees no video with no actionable error.

**Why it happens:** STUN only discovers the peer's public IP. Symmetric NATs assign different port mappings per destination, so the STUN-discovered port is useless for the actual peer connection. Only a TURN relay can bridge symmetric NATs.

**Consequences:** Video calling works perfectly in development (same LAN) and testing (same home network), then fails for a significant fraction of real users once deployed. Users blame the app, not their network.

**Prevention:**
- Add at least one TURN server to the `iceServers` config. Free options: Metered.ca free tier (500MB/month), or self-hosted coturn on the same VPS as the game server.
- Configuration: `iceServers: [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'turn:your-server:3478', username: '...', credential: '...' }]`
- TURN credentials should be time-limited (TURN REST API pattern) or at minimum loaded from environment variables, never hardcoded.
- Test with a phone on mobile data connecting to a peer on home WiFi -- this is the most common symmetric NAT scenario.

**Detection:** WebRTC `iceConnectionState` stays at `'checking'` and never reaches `'connected'`. The 15-second timeout fires. Check `pc.getStats()` for `candidateType: 'relay'` -- if no relay candidates exist, TURN is not configured.

**Phase:** Deploy phase. Must be addressed before the app goes live to external users.

---

### Pitfall 2: Socket.io WebSocket Upgrade Blocked by Reverse Proxy / PaaS

**What goes wrong:** Socket.io starts with HTTP long-polling and upgrades to WebSocket. Many cloud platforms (Railway, Render, Fly.io, Heroku) and reverse proxies (nginx, Cloudflare) require explicit WebSocket upgrade configuration. Without it, Socket.io stays on long-polling, which works but adds 100-300ms latency per event and breaks the real-time feel of tile plays.

**Why it happens:** The current `server/src/index.ts` creates a Socket.io `Server` attached to `httpServer`. The client in `client/src/socket.ts` likely connects with default transport options (polling + websocket). The upgrade handshake requires the proxy to forward `Upgrade: websocket` and `Connection: Upgrade` headers. Most PaaS defaults strip these unless configured.

**Consequences:** The game technically works but feels sluggish. Tile plays take 200-500ms instead of 30-50ms. Auto-pass cascades feel broken because each pass notification is delayed. Users on mobile notice most.

**Prevention:**
- **Railway/Render:** WebSocket support is enabled by default on these platforms. Verify by checking `socket.io.engine.transport.name` in the browser console -- it should say `'websocket'`, not `'polling'`.
- **Fly.io:** Requires `force_https = false` in `fly.toml` for the internal service, plus explicit `[services.ports]` config for WebSocket.
- **nginx (if self-hosted):** Add `proxy_http_version 1.1; proxy_set_header Upgrade $http_upgrade; proxy_set_header Connection "upgrade";` to the location block.
- **Cloudflare (if fronting the domain):** Enable "WebSockets" in the Network tab. Without this, Cloudflare strips the Upgrade header.
- **Client-side verification:** Add a one-time check after connection: `socket.io.engine.on('upgrade', () => console.log('Upgraded to WebSocket'))`. If this never fires, the proxy is blocking upgrades.

**Detection:** Open browser DevTools Network tab, filter by `WS`. If no WebSocket connection appears and only XHR polling requests are visible, the upgrade failed.

**Phase:** Deploy phase. Must be verified immediately after first deployment.

---

### Pitfall 3: SERVICE_ORIGIN / CLIENT_ORIGIN CORS Mismatch in Production

**What goes wrong:** The server's `config.ts` reads `CLIENT_ORIGIN` from env (defaulting to `http://localhost:5173`). Socket.io CORS is configured with this value. In production, the client is served from the same origin (Express static middleware), so CORS is not needed at all -- but the `cors` middleware and Socket.io CORS config are still active with the wrong origin. If the deployment URL is `https://dominos.example.com` but `CLIENT_ORIGIN` is unset or set to `localhost`, Socket.io connections from the production client will be CORS-rejected.

**Why it happens:** In dev, Vite proxies `/socket.io` to `localhost:3001` (configured in `vite.config.ts`). In production, both client and server share the same origin. The CORS config is only relevant if they are on different origins. But the env variable must still match the actual deployment URL for same-origin detection to work with Socket.io's CORS check.

**Consequences:** The app loads (static files are served) but socket connection fails silently. No room creation, no game, no chat. The user sees a blank lobby that never connects.

**Prevention:**
- For same-origin production deployment: set `CLIENT_ORIGIN` to the deployment URL (`https://dominos.example.com`), OR better, detect same-origin and skip CORS entirely:
  ```typescript
  const io = new Server(httpServer, {
    cors: config.NODE_ENV === 'production' ? undefined : {
      origin: config.CLIENT_ORIGIN,
      methods: ['GET', 'POST'],
    },
  })
  ```
- Add a health check endpoint (`app.get('/api/health', ...)`) that the client can ping on startup to verify connectivity before attempting socket connection.
- Document the required env variables for deployment in a `.env.example` file.

**Detection:** After deploying, open browser console and look for `CORS policy` errors on the WebSocket connection attempt.

**Phase:** Deploy phase. Must be configured before first production deployment.

---

### Pitfall 4: PWA Service Worker Caches Socket.io Polling Requests

**What goes wrong:** A service worker registered with a broad cache strategy (e.g., Workbox `NetworkFirst` or `StaleWhileRevalidate` on all routes) intercepts Socket.io's HTTP long-polling fallback requests (`/socket.io/?EIO=4&transport=polling&...`). The SW returns a cached response, the socket connection receives stale data or fails entirely, and real-time events stop flowing.

**Why it happens:** Vite PWA plugins (like `vite-plugin-pwa` with Workbox) generate a service worker that caches navigation routes and static assets. If the `navigateFallback` is set to `index.html` and the exclude patterns do not include `/socket.io/`, the SW captures polling requests. Even if WebSocket is the primary transport, Socket.io falls back to polling during reconnection.

**Consequences:** The game appears to work on first load, but after the SW activates (second visit or after install), socket connections become unreliable. Reconnections after network blips fail because the SW serves cached polling responses. This is extremely difficult to debug because clearing the cache "fixes" it temporarily.

**Prevention:**
- Explicitly exclude Socket.io paths from the service worker's fetch handler:
  ```typescript
  // vite-plugin-pwa config
  workbox: {
    navigateFallback: '/index.html',
    navigateFallbackDenylist: [/^\/socket\.io/],
    runtimeCaching: [] // no runtime caching for this app
  }
  ```
- Use `CacheFirst` only for truly static assets (JS bundles, CSS, images, fonts). Never cache API or WebSocket paths.
- Consider a minimal service worker that only handles the install prompt and offline fallback page, without any fetch interception beyond static asset precaching.
- Test the SW by: enabling it in dev (Workbox dev mode), connecting, then refreshing -- verify socket still connects on second load.

**Detection:** After installing the PWA, check `chrome://serviceworker-internals` or Application > Service Workers in DevTools. Look for `/socket.io/` requests being intercepted in the "Fetch/XHR" network tab -- they should NOT show "(from ServiceWorker)".

**Phase:** PWA phase. The service worker must be configured correctly from the first implementation.

---

### Pitfall 5: getUserMedia Permissions Lost After PWA Install on iOS

**What goes wrong:** On iOS Safari, `getUserMedia` permissions are granted per-origin per-session. When the app is "installed" as a PWA (Add to Home Screen), it runs in a standalone WKWebView context that does not share permissions with Safari. The user must re-grant camera/mic permission every time they open the PWA. Worse, iOS sometimes blocks `getUserMedia` entirely in standalone PWA mode depending on the iOS version.

**Why it happens:** iOS treats standalone web apps as separate browsing contexts. Permission grants are not shared between Safari and the standalone PWA. The `navigator.mediaDevices` API is available, but `getUserMedia` may prompt on every launch or fail silently in some iOS versions (pre-iOS 16.4 had severe restrictions; 16.4+ improved but still has quirks).

**Consequences:** Users install the PWA for convenience, then find video calling broken or requiring re-permission every session. They blame the app and uninstall.

**Prevention:**
- Display a clear in-app message when running in standalone mode (`window.matchMedia('(display-mode: standalone)').matches`) explaining that camera/mic permission may need re-granting.
- Handle `getUserMedia` rejection gracefully: show a "Camera access needed -- tap to retry" button instead of silently failing. The current `acquireLocalStream` in `useWebRTC.ts` catches errors but returns `null` without user notification.
- Test the PWA on actual iOS devices (not just Safari desktop). The Simulator does not accurately reproduce permission behavior.
- Consider making video calling a "nice to have" feature in PWA mode on iOS, with clear fallback to initials-only avatars.

**Detection:** Install PWA on iPhone, close and reopen, attempt to join a video call -- observe whether permission prompt appears and whether `getUserMedia` succeeds.

**Phase:** PWA phase, specifically when testing on iOS devices.

---

### Pitfall 6: Circular Avatar Video Aspect Ratio Distortion

**What goes wrong:** The current `VideoTile.tsx` uses a 56x42px rectangle with `object-fit: cover`. Switching to a circular avatar (`border-radius: 50%`) on a non-square container clips the video asymmetrically. If the container is made square but the video stream is 16:9, `object-cover` crops the sides heavily, potentially cutting off the user's face. If `object-contain` is used instead, black bars appear inside the circle, which looks broken.

**Why it happens:** Webcam streams are typically 4:3 (640x480) or 16:9 (1280x720). A circle is 1:1. There is no way to display a non-square video in a circle without cropping. The question is where and how much to crop.

**Consequences:** Users' faces are partially cut off (forehead/chin missing in landscape video) or the avatar circle has ugly letterboxing.

**Prevention:**
- Use a square container (e.g., `w-10 h-10` or `w-12 h-12`) with `border-radius: 50%` and `overflow: hidden`.
- Always use `object-fit: cover` with `object-position: center top` -- this crops from the bottom (chest), keeping the face visible. Standard pattern for video calling avatars.
- Request a more square aspect ratio from `getUserMedia` when targeting avatar display: `{ video: { width: { ideal: 240 }, height: { ideal: 240 }, facingMode: 'user' } }`. Most cameras will serve the closest supported resolution.
- The existing `w-8 h-8` initials circle in `PlayerSeat.tsx` is the target size. Video at 8x8 Tailwind units (32x32px) is too small to be useful. Increase to `w-10 h-10` (40x40px) minimum, ideally `w-12 h-12` (48x48px).

**Detection:** Open video call with two players, observe whether faces are fully visible in the circular crop. Test with both laptop webcam (16:9) and phone front camera (4:3).

**Phase:** Avatar cameras phase.

---

## Moderate Pitfalls

---

### Pitfall 7: In-Memory State Lost on PaaS Auto-Restart / Deploy

**What goes wrong:** Cloud platforms (Railway, Render, Fly.io) restart the server process on deploy, on crashes, and sometimes on idle timeout (Render free tier sleeps after 15 minutes of inactivity). Every restart wipes all in-memory `Room` objects. Active games are lost with no recovery.

**Why it happens:** The project explicitly accepts in-memory state (PROJECT.md: "no persistence"). This is fine for local dev but becomes a user-facing issue in production where deploys happen during active games.

**Consequences:** Players mid-game see their connection drop. Reconnect finds no room. The game is lost.

**Prevention:**
- Accept this limitation for v1.1 -- it is explicitly out of scope to add persistence.
- Choose a platform that does NOT sleep on idle: Railway (Pro plan), Fly.io (machines stay up with `auto_stop_machines = false`), or a VPS (DigitalOcean, Hetzner).
- Avoid Render free tier (sleeps after 15 min inactivity).
- For deploys: use zero-downtime deploy strategies. Railway and Fly.io support this by default (new instance starts before old one stops). However, Socket.io connections will still be dropped during the switchover.
- Add a client-side reconnection message: "El servidor se actualizo. Crea una nueva sala." rather than letting the user stare at a broken game screen.
- Long term (v2+): consider Redis-backed session store or socket.io-redis adapter for horizontal scaling and persistence.

**Detection:** Deploy a code change while a game is active. Observe whether players receive an error message or just see a frozen screen.

**Phase:** Deploy phase. Platform selection must account for this.

---

### Pitfall 8: PORT and HOST Binding Mismatch on PaaS

**What goes wrong:** The server's `config.ts` defaults to `PORT=3001`. Most PaaS platforms inject their own `PORT` environment variable (Railway, Render, Fly.io all do this). If the app ignores the injected port or binds to `127.0.0.1` instead of `0.0.0.0`, the platform's health check fails and the container is killed.

**Why it happens:** `httpServer.listen(config.PORT)` in `server/src/index.ts` uses `config.PORT` which reads from `process.env.PORT`. This is correct. However, the `listen` call does not specify a host, which defaults to `0.0.0.0` in Node.js -- also correct. The risk is that the root `package.json` dev script hardcodes `PORT=3001`, and if this leaks into a production `Dockerfile` or start command, it overrides the platform's injected port.

**Consequences:** The server starts but the platform cannot route traffic to it. The health check fails. The deployment shows as "crashed" even though the process is running.

**Prevention:**
- Never hardcode `PORT` in the production start command. Use only `npm run start` which runs `npm run start --workspace=server`, which should simply run `node dist/index.js` without a PORT override.
- Verify the server workspace's `start` script does NOT set `PORT`.
- Add explicit host binding: `httpServer.listen(config.PORT, '0.0.0.0', ...)` for clarity.
- Set `NODE_ENV=production` in the platform's env variables so the static file serving activates.

**Detection:** Check platform logs immediately after deploy. Look for "listening on port XXXX" where XXXX matches the platform's expected port.

**Phase:** Deploy phase. First thing to verify.

---

### Pitfall 9: PWA Install Prompt Never Fires Without Proper Manifest

**What goes wrong:** The existing `web/manifest.json` is a leftover from a Flutter project (description says "A new Flutter project"). It references icons in `web/icons/` that do not exist in the Vite client build. The `start_url` is `.` which may resolve incorrectly. Without a valid manifest linked from `index.html` with correct icon paths, the browser never triggers the `beforeinstallprompt` event, and "Add to Home Screen" silently fails.

**Why it happens:** Chrome's PWA installability criteria require: (1) valid `manifest.json` linked via `<link rel="manifest">`, (2) at least one 192x192 and one 512x512 icon that actually loads, (3) `start_url` that resolves, (4) `display: standalone` or `fullscreen`, (5) registered service worker with a fetch handler. Missing any one of these silently prevents the install prompt.

**Consequences:** The PWA "works" in the sense that the site loads, but it is never installable. Users cannot add it to their home screen. The entire PWA feature is silently non-functional.

**Prevention:**
- Create a new `manifest.json` in `client/public/` (Vite copies `public/` to `dist/` at build time). Do NOT reuse the Flutter-era `web/manifest.json`.
- Generate proper icons: 192x192, 512x512, and maskable variants. Use a domino-themed icon.
- Set `start_url: "/"`, `display: "standalone"`, `theme_color` matching the app's dark theme.
- Link from `client/index.html`: `<link rel="manifest" href="/manifest.json">`
- Verify installability in Chrome DevTools > Application > Manifest -- it will show specific errors if criteria are not met.
- Register a minimal service worker even if it does nothing beyond the install event (the fetch handler requirement was relaxed in recent Chrome versions, but a basic SW is still needed).

**Detection:** Open Chrome DevTools > Application > Manifest. If "Installability" shows warnings, the manifest is not valid. Run Lighthouse PWA audit for a comprehensive check.

**Phase:** PWA phase. Manifest and icons must be the first task, before service worker work.

---

### Pitfall 10: Replacing PlayerSeat with Video Avatar Breaks Layout for Non-Call Players

**What goes wrong:** The current game table renders `PlayerSeat` for all four player positions. When video calling is active, `VideoTile` replaces it. If circular avatar cameras are integrated directly into `PlayerSeat`, players who did not join the video call (or whose camera is off) lose their initials avatar, tile count badge, team label, and disconnection indicator. The layout breaks because the video container has different dimensions than the initials circle.

**Why it happens:** `PlayerSeat` and `VideoTile` are separate components with different layouts. `VideoTile` is 56x42px rectangular; `PlayerSeat` uses an 8x8 circle plus text. Merging them requires a unified container that gracefully falls back when no video stream exists.

**Consequences:** Players without video see a broken/empty avatar area. The tile count badge (critical game information) disappears. The turn indicator stops working because the new component does not apply the `neon-glow` class or turn-based border color.

**Prevention:**
- Design the unified component as "PlayerSeat with optional video overlay." The base is always the initials circle with tile count badge, team label, and turn indicator. When a video stream exists, overlay it inside the circle, replacing the initials but keeping the badge and indicators.
- Component structure:
  ```
  <CircularAvatar>
    {hasVideoStream ? <video ... /> : <Initials />}
    <TileCountBadge />   // always visible
    <TurnIndicator />    // always visible
  </CircularAvatar>
  <PlayerName />
  <TeamLabel />
  ```
- Do NOT conditionally render entirely different components based on call state. Use a single component with conditional video content inside a consistent frame.
- Keep the `PlayerSeat` component as the source of truth for position-dependent layout (vertical for left/right, horizontal for top/bottom). Video is just a visual replacement for the initials inside the circle.

**Detection:** Start a game where only 2 of 4 players have video enabled. Verify all four seats show name, tile count, team label, and turn indicator correctly.

**Phase:** Avatar cameras phase. Architecture decision before any code is written.

---

### Pitfall 11: Video Element autoplay Blocked on Mobile PWA Without User Gesture

**What goes wrong:** Mobile browsers (especially iOS Safari and Chrome on Android) block `<video autoplay>` unless the user has interacted with the page AND the video is muted. The current `VideoTile` sets `muted={isMe}` (only mutes own video). Remote peer videos have `autoplay` but are not muted, which can cause them to not play at all on mobile. In PWA standalone mode, autoplay policies are even stricter.

**Why it happens:** Browser autoplay policies require a user gesture before unmuted media can play. The current app relies on `autoplay playsInline` attributes. This works in desktop browsers and sometimes in mobile Safari if the page has had prior user interaction (like tapping "Join Call"), but is not guaranteed.

**Consequences:** Remote players' video feeds show a black frame. Audio from remote peers may not play. The user sees a frozen black circle where a video should be.

**Prevention:**
- The current architecture uses a separate `<audio>` element for remote audio streams (per commit `c195c46`). This is correct -- keep it.
- For video elements: call `videoRef.current.play().catch(() => {})` explicitly after setting `srcObject`, ideally inside a user-gesture handler (the "Join Call" button click is the right place).
- Add a "Tap to enable video" overlay on mobile if autoplay fails. Detect failure by checking if `video.paused` is still `true` after setting srcObject.
- In PWA mode: the initial "Join Call" tap counts as a user gesture. Do not add intermediate navigations or modal dismissals between the gesture and the `play()` call, as these can invalidate the gesture.

**Detection:** Open the PWA on a phone, join a call, verify remote video plays. If video is black but audio works (via separate audio element), autoplay was blocked for the video element.

**Phase:** Avatar cameras phase.

---

### Pitfall 12: Deploying Without HTTPS Breaks getUserMedia and Service Worker

**What goes wrong:** Both `getUserMedia` (WebRTC camera/mic) and Service Worker registration require a Secure Context (HTTPS or localhost). If the deployed app is served over plain HTTP, the camera permission prompt never appears, `navigator.mediaDevices` is `undefined`, and `navigator.serviceWorker` is `undefined`. Video calling and PWA install both silently fail.

**Why it happens:** Development works because `localhost` is a secure context. Production on a custom domain without TLS is not. Some PaaS platforms (Railway, Render) provide HTTPS by default on their `.up.railway.app` / `.onrender.com` subdomains. But if using a custom domain with DNS pointing to a VPS without TLS, nothing works.

**Consequences:** Every feature in this milestone (video avatars, PWA) is dead on arrival. The app appears to load but camera never works and PWA never installs.

**Prevention:**
- Choose a PaaS that provides automatic HTTPS (Railway, Render, Fly.io all do).
- If self-hosting: use Let's Encrypt / certbot with nginx reverse proxy. Set up HTTPS before deploying the app, not after.
- Verify by checking `window.isSecureContext` in the browser console after deploying.
- Add an early check in the app: if `!window.isSecureContext`, show a warning banner.

**Detection:** Navigate to the deployed URL. Open console. Type `window.isSecureContext` -- if `false`, nothing will work.

**Phase:** Deploy phase. HTTPS is the foundation for everything else in this milestone.

---

## Minor Pitfalls

---

### Pitfall 13: PWA Caches Stale Vite Build Hashes

**What goes wrong:** Vite generates hashed filenames (`index-DUs88-Gi.css`). A service worker that precaches these files will serve the old bundle after a new deploy. The user sees the old version of the app until the SW updates and the page is refreshed. With Socket.io, a protocol mismatch between old client and new server can cause silent event handling failures.

**Prevention:**
- Configure the service worker to use `skipWaiting()` and `clientsClaim()` so new versions activate immediately.
- Add a version check: emit a `app:version` event on socket connection; if the server version does not match the client version, show a "New version available -- refresh" banner.
- Alternatively, use `workbox-window` to detect SW updates and prompt the user to reload.

**Phase:** PWA phase.

---

### Pitfall 14: Circular Video Clips Mic/Camera Toggle Buttons

**What goes wrong:** The current `VideoTile` places mic/camera toggle buttons at `absolute bottom-1 right-1` inside the video container. Switching to a circular container with `overflow: hidden` clips these buttons outside the visible area (corners of a circle are clipped).

**Prevention:**
- Move toggle controls outside the circular video container. Place them below the avatar or in a separate control bar.
- For the local player's avatar, consider a small floating control row beneath the circle rather than overlaid inside it.
- Alternatively, use a tap-to-reveal overlay: tap the avatar circle to show controls, then auto-hide after 3 seconds.

**Phase:** Avatar cameras phase.

---

### Pitfall 15: Vite Proxy Config Leaks Into Production Build

**What goes wrong:** The `vite.config.ts` proxy (`/socket.io` -> `localhost:3001`) only applies in dev mode. In production, Vite is not running. If the client's socket connection URL is hardcoded or derived from `import.meta.env`, it may point to the wrong place. The current `client/src/socket.ts` likely uses a relative URL or auto-detection, which is correct -- but if anyone changes it to an absolute URL during development, production breaks.

**Prevention:**
- Verify `socket.ts` connects with a relative URL or no explicit URL (Socket.io client auto-detects the current host). Never hardcode `localhost:3001`.
- In production, Socket.io shares the same HTTP server, so the client should connect to the same origin with no explicit URL.

**Phase:** Deploy phase. Quick verification, not a code change.

---

### Pitfall 16: Missing `apple-touch-icon` and iOS PWA Metadata

**What goes wrong:** iOS Safari uses `apple-touch-icon` (not the manifest icons) for the home screen icon. Without `<link rel="apple-touch-icon" href="...">` in `index.html`, iOS generates a screenshot thumbnail as the app icon, which looks unprofessional. Additionally, iOS requires `<meta name="apple-mobile-web-app-capable" content="yes">` and `<meta name="apple-mobile-web-app-status-bar-style">` for proper standalone behavior.

**Prevention:**
- Add to `client/index.html`:
  ```html
  <link rel="apple-touch-icon" href="/apple-touch-icon.png">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
  ```
- Generate a 180x180 `apple-touch-icon.png` and place it in `client/public/`.

**Phase:** PWA phase.

---

### Pitfall 17: Platform Idle Timeout Kills Long Games

**What goes wrong:** Some PaaS free tiers (Render free, some Fly.io configs) sleep the process after 15-30 minutes of "inactivity." If inactivity is measured by HTTP requests (not WebSocket frames), a game with active WebSocket traffic but no HTTP requests may still be considered idle and killed.

**Prevention:**
- Render free tier: the app sleeps after 15 minutes of no inbound requests. WebSocket pings do NOT count as requests on some platforms. Avoid Render free tier for this app.
- Railway: does not sleep on hobby plan. Best option for always-on.
- Fly.io: set `auto_stop_machines = false` and `min_machines_running = 1` in `fly.toml`.
- If cost is a concern, add a client-side keepalive: `setInterval(() => fetch('/api/health'), 5 * 60 * 1000)` to prevent idle detection.

**Phase:** Deploy phase. Platform selection.

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| **Deploy: Platform selection** | Idle timeout kills active games (P17) | Choose Railway or Fly.io with always-on config; avoid Render free tier |
| **Deploy: First deploy** | CORS mismatch blocks socket connection (P3) | Set `CLIENT_ORIGIN` env or disable CORS in production |
| **Deploy: First deploy** | PORT binding mismatch (P8) | Never hardcode PORT in production start command |
| **Deploy: First deploy** | No HTTPS = no getUserMedia, no SW (P12) | Use PaaS with automatic HTTPS; verify before any other testing |
| **Deploy: WebSocket** | Proxy blocks WS upgrade (P2) | Verify `socket.io.engine.transport.name === 'websocket'` after deploy |
| **Deploy: WebRTC** | STUN-only fails on mobile/corporate networks (P1) | Add TURN server before going live; test with phone on cellular |
| **Deploy: State** | Server restart loses all rooms (P7) | Accept for v1.1; display clear error to users; avoid idle-sleep platforms |
| **PWA: Manifest** | Install prompt never fires (P9) | New manifest in `client/public/`, valid icons, Lighthouse audit |
| **PWA: Service worker** | SW caches socket.io polling (P4) | Exclude `/socket.io/` from SW fetch handler |
| **PWA: iOS** | getUserMedia permissions lost per session (P5) | Graceful fallback; user-facing retry button |
| **PWA: iOS** | Missing apple-touch-icon (P16) | Add apple-specific meta tags and icon |
| **PWA: Updates** | Stale cached JS after deploy (P13) | skipWaiting + version check banner |
| **Avatar: Layout** | Replacing PlayerSeat breaks non-video players (P10) | Single unified component with optional video overlay |
| **Avatar: Aspect ratio** | Face cropped in circle (P6) | Square container, object-cover, object-position center top |
| **Avatar: Controls** | Toggle buttons clipped by circular overflow (P14) | Move controls outside the circle |
| **Avatar: Mobile** | autoplay blocked for remote video (P11) | Explicit play() after user gesture; tap-to-enable fallback |

---

## Integration Pitfalls (Cross-Feature)

### Deploy + PWA: Service Worker Registration Timing

The service worker should only be registered after the initial socket connection succeeds. If the SW registers first and has a buggy fetch handler, it can intercept and break the socket handshake on the very first page load, before the user ever sees the app.

**Mitigation:** Register the SW in an `onload` handler or after a short delay, not in the module's top-level scope. Verify socket connection first, then register SW.

### Deploy + Avatar Cameras: TURN Server Cost Scales with Video

STUN is free. TURN relays all media through the server, consuming bandwidth proportional to the video bitrate multiplied by the number of relayed connections. A 4-player game with 3 TURN-relayed video streams at 250kbps each burns ~2.7GB/month per concurrent room.

**Mitigation:** Use TURN only as fallback (ICE will prefer STUN/direct when possible). Set bandwidth limits on the TURN server. Monitor usage. For a free tier: Metered.ca offers 500MB/month TURN relay, which supports roughly 6 hours of 3-peer video per month.

### PWA + Avatar Cameras: Standalone Mode Camera Lifecycle

When a PWA is backgrounded on mobile, the OS may revoke camera access. When foregrounded, `getUserMedia` may need to be re-acquired. The current `useWebRTC.ts` acquires media once in `init()` and does not handle re-acquisition after background/foreground cycles.

**Mitigation:** Listen for `document.visibilitychange`. On `visible`, check if `localStreamRef.current` tracks are still `live` (not `ended`). If ended, re-acquire and replace tracks on all active PeerConnections using `RTCRtpSender.replaceTrack()`.

---

## Sources

- Codebase analysis: `server/src/index.ts`, `server/src/config.ts`, `client/vite.config.ts`, `client/src/hooks/useWebRTC.ts`, `client/src/components/player/PlayerSeat.tsx`, `client/src/components/player/VideoTile.tsx`, `server/src/socket/webrtcHandlers.ts`
- Existing `web/manifest.json` (Flutter-era leftover, not usable)
- Project constraints: `.planning/PROJECT.md` (no persistence, no auth, in-memory rooms)
- Training knowledge of WebRTC TURN/STUN requirements, PaaS deployment patterns, PWA installability criteria, iOS standalone mode limitations, and service worker caching strategies (MEDIUM confidence -- well-established patterns but could not verify against current 2026 documentation due to web search unavailability)

---

*Pitfalls analysis: 2026-03-13 -- v1.1 Deploy & Polish milestone*

# Phase 11: PWA Support - Research

**Researched:** 2026-03-13
**Domain:** Progressive Web App (manifest, service worker, installability)
**Confidence:** HIGH

## Summary

Phase 11 adds PWA capabilities so users can install Domino PR to their home screen and launch it like a native app. The project already decided on `vite-plugin-pwa` (STATE.md), which is the standard Vite ecosystem solution -- a single dev dependency that auto-generates the web manifest, creates a Workbox-based service worker, and injects the manifest link into `index.html`.

The critical concern for this project is that the service worker MUST NOT intercept Socket.io WebSocket traffic. The default `generateSW` strategy with Workbox's `navigateFallbackDenylist` and `runtimeCaching` NetworkOnly handler solves this cleanly. Since this is a real-time multiplayer game with no offline mode (explicitly out of scope per REQUIREMENTS.md), the service worker should only precache the app shell for fast launch -- not attempt offline gameplay.

**Primary recommendation:** Use `vite-plugin-pwa` with `generateSW` strategy, `registerType: 'autoUpdate'`, explicit Socket.io exclusion in workbox config, and create PNG icons at 192x192 and 512x512 (plus maskable variants) for Domino PR branding.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| PWA-01 | User can install the app from browser on phone or desktop | vite-plugin-pwa generates valid manifest + service worker; Chrome shows install prompt when criteria met (HTTPS + manifest + SW) |
| PWA-02 | Installed app runs in standalone mode (no browser chrome, with splash screen) | Manifest `display: 'standalone'` + `theme_color` + `background_color` + icons enable standalone launch with splash |
| PWA-03 | App manifest includes proper icons and metadata for Domino PR branding | Manifest configured with name, icons (192/512 + maskable), theme colors from existing CSS variables |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| vite-plugin-pwa | ^1.2.0 | PWA manifest + service worker generation | Official Vite PWA solution, zero-config baseline, uses Workbox internally |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| (workbox) | bundled | Service worker caching strategies | Bundled inside vite-plugin-pwa, no separate install needed |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| vite-plugin-pwa | Manual SW + manifest | 10x more code, must maintain Workbox config separately, no auto-inject |

**Installation:**
```bash
npm install -D vite-plugin-pwa --workspace=client
```

## Architecture Patterns

### What Gets Added
```
client/
├── public/
│   ├── pwa-192x192.png        # Standard icon
│   ├── pwa-512x512.png        # Standard icon
│   ├── pwa-maskable-192x192.png  # Maskable icon (safe zone padding)
│   └── pwa-maskable-512x512.png  # Maskable icon (safe zone padding)
├── vite.config.ts              # Add VitePWA plugin config
├── tsconfig.json               # Add vite-plugin-pwa/client types
└── index.html                  # Plugin auto-injects manifest link
```

No new source files needed. The plugin generates `manifest.webmanifest` and `sw.js` at build time.

### Pattern 1: VitePWA Plugin Configuration

**What:** Complete plugin config for a real-time SPA that must NOT cache WebSocket traffic.
**When to use:** This exact config for Domino PR.
**Example:**
```typescript
// Source: vite-pwa-org.netlify.app/guide/ + workbox docs
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Domino PR',
        short_name: 'Domino PR',
        description: 'Dominó puertorriqueño online con amigos',
        theme_color: '#0A1A0F',
        background_color: '#0A1A0F',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/',
        start_url: '/',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: 'pwa-maskable-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'maskable',
          },
          {
            src: 'pwa-maskable-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        navigateFallback: 'index.html',
        navigateFallbackDenylist: [/^\/socket\.io/, /^\/health/],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'gstatic-fonts-cache',
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
})
```

### Pattern 2: TypeScript Types

**What:** Add PWA client types so `virtual:pwa-register/react` resolves.
**When to use:** After installing the plugin.
**Example:**
```json
// client/tsconfig.json - add to compilerOptions.types
{
  "compilerOptions": {
    "types": ["vite-plugin-pwa/client"]
  }
}
```

### Anti-Patterns to Avoid
- **Using `"any maskable"` purpose on a single icon:** This causes icons to look wrong on some platforms. Always provide separate `"any"` and `"maskable"` icon entries.
- **Caching Socket.io traffic:** The service worker MUST NOT intercept `/socket.io` paths. WebSocket upgrades through a caching layer will break real-time gameplay.
- **Adding offline gameplay logic:** Out of scope per REQUIREMENTS.md. The SW precaches the app shell only for fast launch, not for offline play.
- **Using `injectManifest` strategy:** Overkill for this use case. `generateSW` handles everything needed with zero custom SW code.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Web manifest | Manual JSON file + link tag | vite-plugin-pwa manifest config | Auto-generates, auto-injects, handles hashing |
| Service worker | Custom SW with fetch handlers | vite-plugin-pwa generateSW | Workbox handles precaching, versioning, cleanup |
| SW registration | Manual `navigator.serviceWorker.register()` | Plugin's `registerType: 'autoUpdate'` | Handles update lifecycle, skip waiting, clients claim |
| Icon generation | Manual Photoshop/Figma export | Single source image, export at required sizes | Consistency, safe zone handling for maskable |

**Key insight:** The entire PWA setup for this project is ~30 lines of config in vite.config.ts plus icon files. There is no custom service worker code needed.

## Common Pitfalls

### Pitfall 1: Service Worker Caches Socket.io Requests
**What goes wrong:** WebSocket upgrade requests get intercepted by the service worker, breaking real-time communication.
**Why it happens:** Default Workbox `navigateFallback` catches all navigation requests including `/socket.io` polling fallback.
**How to avoid:** Add `navigateFallbackDenylist: [/^\/socket\.io/, /^\/health/]` to workbox config.
**Warning signs:** Game connections fail after installing as PWA but work in browser tab.

### Pitfall 2: Missing Icons Block Install Prompt
**What goes wrong:** Chrome never shows the install prompt despite having a manifest and service worker.
**Why it happens:** Chrome requires at least a 192x192 AND 512x512 icon in the manifest for installability.
**How to avoid:** Always include both sizes. Test with Chrome DevTools > Application > Manifest.
**Warning signs:** Lighthouse PWA audit shows "Manifest doesn't have a maskable icon" or missing sizes.

### Pitfall 3: No `public/` Directory
**What goes wrong:** Icons referenced in manifest are 404 in production.
**Why it happens:** Project currently has no `client/public/` directory. Icons must be placed there for Vite to serve them as static assets.
**How to avoid:** Create `client/public/` and place all icon PNGs there. Vite copies `public/` contents to build output root.
**Warning signs:** 404 errors for icon URLs in DevTools Network tab.

### Pitfall 4: Stale Service Worker After Deploy
**What goes wrong:** Users see old version of the app after a deploy.
**Why it happens:** Service worker serves cached assets without checking for updates.
**How to avoid:** `registerType: 'autoUpdate'` with Workbox's `skipWaiting` and `clientsClaim` (both enabled by default with autoUpdate) ensures the new SW activates immediately.
**Warning signs:** Users report seeing old UI after you deployed changes.

### Pitfall 5: iOS Standalone Mode Quirks
**What goes wrong:** On iOS, navigating to external URLs (e.g., OAuth) exits standalone mode; storage is separate from Safari; no background sync.
**Why it happens:** iOS PWA implementation is more limited than Android/Chrome.
**How to avoid:** For this app: not a major concern since there's no auth, no offline mode, and no push notifications. Just ensure `display: 'standalone'` and proper `theme_color` are set.
**Warning signs:** iOS users report the app "restarting" or losing state on reopen.

### Pitfall 6: Express Wildcard Route Intercepts SW File
**What goes wrong:** In production, the server's `app.get('*', ...)` catch-all returns `index.html` instead of `sw.js`.
**Why it happens:** The catch-all for SPA routing fires before Express can serve `sw.js` from static files.
**How to avoid:** This is already handled correctly -- `express.static(clientBuild)` is registered BEFORE the wildcard route in `server/src/index.ts`, so `sw.js` and `manifest.webmanifest` in `client/dist/` will be served as static files.
**Warning signs:** Service worker registration fails with "bad-content-type" or returns HTML.

## Code Examples

### Complete vite.config.ts (Target State)
```typescript
// Source: vite-pwa-org.netlify.app/guide/
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Domino PR',
        short_name: 'Domino PR',
        description: 'Domino puertorriqueno online con amigos',
        theme_color: '#0A1A0F',
        background_color: '#0A1A0F',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/',
        start_url: '/',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-maskable-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
          { src: 'pwa-maskable-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        navigateFallback: 'index.html',
        navigateFallbackDenylist: [/^\/socket\.io/, /^\/health/],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'gstatic-fonts-cache',
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
  server: {
    port: 5173,
    host: '0.0.0.0',
    allowedHosts: true,
    proxy: {
      '/socket.io': {
        target: 'http://localhost:3001',
        ws: true,
        changeOrigin: true,
      },
    },
  },
})
```

### Adding meta tags to index.html
```html
<!-- These go in <head> of client/index.html -->
<meta name="theme-color" content="#0A1A0F" />
<link rel="apple-touch-icon" href="/pwa-192x192.png" />
```

Note: vite-plugin-pwa auto-injects the `<link rel="manifest">` tag, but `theme-color` meta and `apple-touch-icon` should be added manually for iOS compatibility.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Manual manifest.json + custom SW | vite-plugin-pwa generateSW | 2022+ | ~30 lines config vs 200+ lines manual |
| `"any maskable"` icon purpose | Separate icons per purpose | 2023+ | Better rendering across all platforms |
| Manual SW registration | `registerType: 'autoUpdate'` | vite-plugin-pwa 0.12.2+ | Auto skip-waiting + clients-claim |

**Deprecated/outdated:**
- `workbox.clientsClaim` + `workbox.skipWaiting` manual config: Now handled automatically by `registerType: 'autoUpdate'` in vite-plugin-pwa 0.12.2+

## Open Questions

1. **Icon Source Image**
   - What we know: Need 192x192 and 512x512 PNGs (regular + maskable). No existing icons in the project.
   - What's unclear: Whether the user has a Domino PR logo/brand asset to use as source.
   - Recommendation: Create simple domino-themed icons programmatically or use a placeholder. The planner should include a task for icon creation/placement. A simple SVG domino tile with "PR" text, exported to PNG at required sizes, would suffice.

2. **Google Fonts Caching**
   - What we know: App uses Google Fonts (Bebas Neue + Nunito) loaded via CSS @import.
   - What's unclear: Whether fonts should be cached by SW (faster repeat loads) or always fetched (always current).
   - Recommendation: Cache Google Fonts with CacheFirst strategy (included in config above). Fonts rarely change and caching improves load time significantly.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | No test framework configured |
| Config file | none |
| Quick run command | N/A |
| Full suite command | `cd client && npx tsc --noEmit` (type-check only) |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PWA-01 | Install prompt appears with valid manifest + SW | manual | Chrome DevTools > Application > Manifest check | N/A |
| PWA-02 | Standalone mode, no browser chrome, splash screen | manual | Install on Android/Chrome, verify launch behavior | N/A |
| PWA-03 | Proper icons and branding in manifest | manual + type-check | `cd client && npx tsc --noEmit` (validates config compiles) | N/A |

### Sampling Rate
- **Per task commit:** `cd client && npx tsc --noEmit` (ensure config compiles)
- **Per wave merge:** Build + deploy to Railway, verify with Chrome DevTools Application tab
- **Phase gate:** Lighthouse PWA audit passes on deployed URL

### Wave 0 Gaps
- [ ] `client/public/` directory -- does not exist yet, must be created for icon files
- [ ] Icon PNG files -- must be created (192x192, 512x512, regular + maskable)
- [ ] No automated PWA testing -- all verification is manual via Chrome DevTools + Lighthouse

## Sources

### Primary (HIGH confidence)
- [vite-pwa-org.netlify.app/guide/](https://vite-pwa-org.netlify.app/guide/) - Getting started, configuration, FAQ
- [vite-pwa-org.netlify.app/guide/faq](https://vite-pwa-org.netlify.app/guide/faq) - TypeScript types, common errors
- [vite-pwa-org.netlify.app/workbox/generate-sw](https://vite-pwa-org.netlify.app/workbox/generate-sw) - Workbox generateSW configuration
- [npmjs.com/package/vite-plugin-pwa](https://www.npmjs.com/package/vite-plugin-pwa) - Version 1.2.0, latest

### Secondary (MEDIUM confidence)
- [developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Manifest/Reference/icons](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Manifest/Reference/icons) - Icon requirements and purpose field
- [web.dev/learn/pwa/web-app-manifest](https://web.dev/learn/pwa/web-app-manifest) - Manifest best practices
- [github.com/vite-pwa/vite-plugin-pwa/discussions/545](https://github.com/vite-pwa/vite-plugin-pwa/discussions/545) - Excluding paths from SW

### Tertiary (LOW confidence)
- [brainhub.eu/library/pwa-on-ios](https://brainhub.eu/library/pwa-on-ios) - iOS PWA limitations (informational, not blocking)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - vite-plugin-pwa is the locked decision from STATE.md, verified current on npm (v1.2.0)
- Architecture: HIGH - generateSW with navigateFallbackDenylist is well-documented official pattern
- Pitfalls: HIGH - Socket.io exclusion pattern verified across multiple sources; Express static serving order confirmed by reading server code

**Research date:** 2026-03-13
**Valid until:** 2026-04-13 (stable domain, PWA standards mature)

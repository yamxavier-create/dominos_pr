# Phase 13: Audio Foundation - Context

**Gathered:** 2026-03-14
**Status:** Ready for planning

<domain>
## Phase Boundary

The app has a working audio infrastructure that all sounds and music will build on — shared AudioContext, autoplay compliance, and offline-ready audio caching. No actual sound effects or music playback in this phase.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
User delegated all decisions for this infrastructure phase. Claude has full flexibility on:

- **AudioContext singleton design** — Where the shared context lives, how useSpeakingDetection integrates
- **Autoplay unlock strategy** — How and when the AudioContext gets unlocked (silent resume on first user gesture)
- **Audio file format** — MP3 for broad compatibility + small size; add to PWA cache patterns
- **uiStore audio preferences** — Prepare separate `sfxEnabled` and `musicEnabled` booleans now (replacing single `soundEnabled`) to avoid refactoring in Phase 15
- **Default audio state** — Both SFX and music default to ON (matches current `soundEnabled: true` behavior)
- **PWA caching approach** — Add audio file extensions to workbox globPatterns

</decisions>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches. User trusts Claude to make all infrastructure decisions based on codebase patterns and requirements.

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `uiStore.ts`: Has `soundEnabled: boolean` + `toggleSound()` — will be replaced with split SFX/music toggles
- `callStore.ts`: `setSpeakingPeers()` — speaking detection consumer, unaffected by AudioContext refactor

### Established Patterns
- Zustand stores for client state (gameStore, roomStore, uiStore, callStore)
- Hooks pattern for side-effect logic (useSocket, useWebRTC, useSpeakingDetection)
- vite-plugin-pwa with workbox for service worker caching

### Integration Points
- `useSpeakingDetection.ts` (lines 63-68): Creates own AudioContext — must refactor to use shared singleton
- `vite.config.ts` (line 30): `globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}']` — needs audio extensions added
- `uiStore.ts` (line 23/55/78): `soundEnabled` toggle — components referencing this will need updating when split

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 13-audio-foundation*
*Context gathered: 2026-03-14*

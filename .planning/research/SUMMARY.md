# Project Research Summary

**Project:** Dominos PR -- v1.2 Sound & Audio
**Domain:** Game audio (SFX + background music) for existing real-time multiplayer PWA
**Researched:** 2026-03-14
**Confidence:** HIGH

## Executive Summary

Adding sound to Dominos PR is a zero-dependency, client-only effort. The app needs roughly 5-6 short sound effects and one looping background music track. The Web Audio API (already used in the codebase for WebRTC speaking detection) handles SFX with sub-millisecond latency and overlapping playback. HTMLAudioElement handles background music with built-in loop and streaming support. No audio library (Howler.js, use-sound, Tone.js) is justified -- a custom AudioManager singleton plus a React hook covers everything. MP3 is the only format needed (100% browser support, patent-free since 2017). Total audio payload is under 1MB, well within PWA precache budget.

The recommended approach is a singleton AudioManager class that owns one shared AudioContext (for SFX via pre-decoded AudioBuffers) and one HTMLAudioElement (for background music). Sound triggers hook into existing Socket.io event handlers in useSocket.ts -- no new server events, no new socket messages, zero server-side changes. The existing `soundEnabled` boolean in uiStore gets split into `sfxEnabled` + `musicEnabled` with localStorage persistence. A new `useAudio` hook mounted at the app root handles AudioContext unlock (browser autoplay policy), buffer preloading, and music lifecycle tied to route changes.

The highest-risk area is the interaction between the new AudioContext and the existing WebRTC speaking detection code, which currently creates and destroys its own AudioContext per stream change. iOS Safari enforces a hard limit of one active AudioContext -- creating a second suspends the first. This means the very first task must be refactoring `useSpeakingDetection.ts` to share a single global AudioContext. Browser autoplay policy is the second risk, but the app's natural user flow (clicking to join/create rooms) provides the required user gesture before any audio plays. iOS silent mode (ringer switch) will block all web audio with no programmatic workaround -- this must be documented, not "fixed."

## Key Findings

### Recommended Stack

Zero new dependencies. The entire feature uses native browser APIs already present in the codebase.

**Core technologies:**
- **Web Audio API (AudioContext + AudioBuffer):** SFX playback -- zero latency, overlapping playback, per-channel gain control. Already used in `useSpeakingDetection.ts`.
- **HTMLAudioElement:** Background music -- built-in loop, streaming (no full download needed), simple volume/pause API.
- **MP3 format only:** Universal browser support, good compression (~10KB per short SFX, ~400-500KB for music loop). No OGG/WebM fallbacks needed.
- **Workbox precache (existing):** Add `mp3` to globPatterns in vite.config.ts -- one line change for offline audio support.

### Expected Features

**Must have (table stakes):**
- Browser autoplay compliance (AudioContext unlock on first user gesture)
- Tile placement sound (domino clack) -- the single most impactful audio addition
- Turn notification sound -- prevents game stalling when players tab away
- Auto-pass sound effect -- makes silent pass cascades audible
- SFX mute toggle in game UI

**Should have (differentiators):**
- Lo-fi background music in menu/lobby with fade-out on game start
- Separate music vs SFX toggles (critical for players on voice chat)
- Round-end and game-end fanfare sounds
- Audio preference persistence via localStorage
- Capicu/Chuchazo special celebration sound (culturally relevant)

**Defer (v2+):**
- Per-player sound customization
- Dynamic/adaptive music
- Spatial/3D audio
- Volume sliders (simple toggles sufficient for v1.2)
- Background music during gameplay (competes with WebRTC voice chat)

### Architecture Approach

The architecture adds three new files and modifies four existing ones, with zero server-side changes. An AudioManager singleton (not a Zustand store) owns all audio playback -- audio is imperative (play/stop/fade), not declarative React state. A `useAudio` hook bridges the AudioManager to React, handling preloading, autoplay unlock, and route-dependent music lifecycle. SFX triggers go directly into existing useSocket event handlers, not into React components or useEffect hooks.

**Major components:**
1. **AudioManager** (new singleton) -- manages shared AudioContext, pre-decoded AudioBuffers, SFX playback via GainNode, and HTMLAudioElement music with fade transitions
2. **useAudio** (new hook) -- mounted in AppRoutes alongside useSocket; handles buffer preloading, autoplay unlock via document click listener, and music start/stop on route changes
3. **AudioControls** (new UI component) -- two toggle buttons (music, SFX) reading from uiStore
4. **uiStore** (modified) -- replaces `soundEnabled` with `sfxEnabled` + `musicEnabled`, both persisted to localStorage

### Critical Pitfalls

1. **Browser autoplay policy blocks all audio** -- AudioContext created at module level or in socket handlers starts suspended. Prevention: lazy-create on first user gesture, call `resume()` before every play. Test on real iOS Safari, not Chrome emulation.
2. **Multiple AudioContexts kill WebRTC speaking detection** -- iOS enforces one active AudioContext. The existing `useSpeakingDetection.ts` creates its own. Prevention: refactor to share a single global AudioContext singleton. Never call `audioCtx.close()` on cleanup.
3. **iOS silent mode (ringer switch) blocks all web audio** -- no programmatic workaround exists. Prevention: show user-facing hint about ringer switch on iOS. Document as known platform limitation.
4. **PWA service worker does not cache audio files** -- current globPatterns exclude `.mp3`. Prevention: add `mp3` to globPatterns for SFX; consider runtimeCaching for large music files.
5. **Sound timing desync with animations** -- SFX triggered from raw socket events fires before tile animation completes. Prevention: trigger tile clack on emit (instant feedback) or from animation lifecycle, debounce rapid cascades.

## Implications for Roadmap

Based on research, suggested phase structure:

### Phase 1: Audio Foundation
**Rationale:** Everything depends on having a working AudioContext and correct uiStore preferences. The AudioContext singleton must exist before any sound can play. The useSpeakingDetection refactor must happen first to prevent iOS AudioContext conflicts.
**Delivers:** AudioManager singleton, shared AudioContext, uiStore split (sfxEnabled + musicEnabled with localStorage), refactored useSpeakingDetection to use shared context, updated Workbox globPatterns.
**Addresses:** Autoplay compliance (table stakes), preference persistence (differentiator)
**Avoids:** Pitfall 1 (autoplay), Pitfall 2 (multiple AudioContexts), Pitfall 4 (PWA cache), Pitfall 7 (no persistence), Pitfall 12 (coarse toggle)

### Phase 2: Core SFX
**Rationale:** Depends on Phase 1 (AudioManager must exist). These three sounds deliver the "game feels alive" goal. Tile clack is the highest-impact single addition. Turn notification solves a real UX problem (tabbed-away players). Pass sound completes the gameplay audio loop.
**Delivers:** Tile clack, turn notification, pass sound wired to existing socket handlers. useAudio hook mounted in AppRoutes for preloading and autoplay unlock. SFX toggle button in game UI.
**Addresses:** Tile placement sound, turn notification, pass SFX, SFX toggle (all table stakes)
**Avoids:** Pitfall 5 (memory leaks -- AudioBuffer pool pattern), Pitfall 6 (timing desync -- debounce), Pitfall 9 (background tab -- check document.hidden)

### Phase 3: Background Music + Extended SFX
**Rationale:** Music adds polish but is lower priority than core gameplay SFX. Requires fade logic and route-aware lifecycle, which is slightly more complex. Round/game fanfares are low-effort additions using the same pattern as Phase 2.
**Delivers:** Lo-fi background music in menu/lobby with fade transitions, round-end fanfare, game-end fanfare, game-start sound, separate music toggle in UI.
**Addresses:** Background music, round/game fanfare, separate toggles (all differentiators)
**Avoids:** Pitfall 8 (music state complexity -- keep it simple: pause not stop, single audio element), Pitfall 9 (background tab -- pause music on visibilitychange)

### Phase 4: Polish + Cultural Sounds
**Rationale:** Optional polish. Only pursue if Phases 1-3 ship cleanly. Chat ping and Capicu/Chuchazo sounds add cultural flavor but are not essential.
**Delivers:** Chat notification ping (when panel closed), Capicu/Chuchazo celebration accent, boneyard draw sound (2-player mode), iOS silent mode user hint.
**Addresses:** Chat ping, Capicu/Chuchazo accent, boneyard draw (all P2 features)
**Avoids:** Pitfall 3 (iOS silent mode -- user-facing hint, not code fix)

### Phase Ordering Rationale

- **Strictly sequential:** Each phase builds on the previous. Phase 2 cannot exist without Phase 1's AudioManager. Phase 3's music needs Phase 1's uiStore split.
- **Risk-first ordering:** The highest-risk work (AudioContext sharing with WebRTC, autoplay unlock) happens in Phase 1 where it can be validated early.
- **Impact-ordered features:** Phase 2 delivers the three sounds with the highest user impact before investing in lower-priority music and fanfares.
- **Architecture groups naturally:** AudioManager + uiStore (infrastructure), then SFX triggers (event wiring), then music lifecycle (route awareness), then polish (optional).

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 1:** The useSpeakingDetection refactor to share AudioContext needs careful review of existing WebRTC audio flow. Verify that disconnecting AnalyserNode on cleanup (without closing AudioContext) does not leak resources.
- **Phase 3:** Music file sourcing -- finding a royalty-free lo-fi track with a clean loop point is non-trivial. Licensing terms must be verified.

Phases with standard patterns (skip research-phase):
- **Phase 2:** SFX triggers are straightforward -- add playSound calls to existing socket handlers. Well-documented Web Audio API pattern.
- **Phase 4:** Simple additions using the same AudioManager.playSound pattern established in Phase 2.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Zero dependencies; Web Audio API is a stable W3C spec already used in the codebase. No version concerns. |
| Features | HIGH | Feature list derived directly from codebase analysis of existing socket events and UI state. Priority ordering based on user impact. |
| Architecture | HIGH | AudioManager singleton + useAudio hook is the established pattern for browser game audio. Integration points identified with exact file/line references. |
| Pitfalls | MEDIUM-HIGH | Browser autoplay and iOS AudioContext limits are well-documented. The useSpeakingDetection interaction is codebase-specific and needs hands-on validation. |

**Overall confidence:** HIGH

### Gaps to Address

- **Audio file sourcing:** No specific royalty-free sound files identified. Need to source from freesound.org, Pixabay, or create custom. Quality of chosen sounds significantly impacts perceived polish. Budget 1-2 hours for sourcing and testing.
- **useSpeakingDetection refactor scope:** The current code creates/destroys AudioContext per stream lifecycle. Exact refactor approach (pass shared context as parameter vs module import) needs validation during Phase 1 implementation.
- **iOS silent mode UX:** The exact wording and placement of the "check your ringer switch" hint needs UX consideration. When to show it (first SFX attempt? settings screen?) is undecided.
- **Music licensing:** Specific royalty-free music recommendations were not verified. License terms for chosen tracks must be confirmed before shipping.

## Sources

### Primary (HIGH confidence)
- Codebase: `useSpeakingDetection.ts` -- existing AudioContext usage pattern (lines 48-63)
- Codebase: `uiStore.ts` -- existing `soundEnabled` boolean (line 23), toggle (line 39)
- Codebase: `useSocket.ts` -- all event handlers with exact trigger points for SFX
- Codebase: `vite.config.ts` -- Workbox globPatterns (line 31), missing audio extensions
- W3C: Web Audio API specification (stable recommendation since 2018)
- MDN: AudioContext, AudioBuffer, AudioBufferSourceNode, GainNode documentation

### Secondary (MEDIUM confidence)
- Browser autoplay policies: Chrome (since v66, 2018), Safari (since v11, 2017), Firefox (2019)
- iOS AudioContext limitations: single active context enforcement
- Howler.js/use-sound evaluation: version numbers from training data, but irrelevant since neither is recommended

### Tertiary (LOW confidence)
- Audio file size estimates (~450KB-1MB total): based on typical game SFX at MP3 128kbps, actual sizes depend on sourced files
- Music licensing: royalty-free sources (freesound.org, Pixabay) existence confirmed but specific track recommendations not verified

---
*Research completed: 2026-03-14*
*Ready for roadmap: yes*

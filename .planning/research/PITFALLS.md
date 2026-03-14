# Domain Pitfalls

**Domain:** Game audio (SFX + background music) added to existing real-time multiplayer web app with WebRTC
**Researched:** 2026-03-14
**Milestone:** v1.2 Sound & Audio
**Confidence:** MEDIUM-HIGH (codebase-grounded analysis + well-established browser audio policies; web search unavailable for 2026-specific verification)

---

## Critical Pitfalls

Mistakes that cause broken audio, WebRTC interference, or silent failures across devices.

---

### Pitfall 1: Browser Autoplay Policy Blocks All Audio

**What goes wrong:** AudioContext is created on page load or in response to a Socket.io event (not a user gesture). Browser suspends the context silently. No sounds play. On iOS Safari this is especially strict -- even a programmatic `.play()` on an `<audio>` element silently fails without a prior user gesture in the same browsing session.

**Why it happens:** Since Chrome 66 and Safari 11, browsers require a user gesture (click, tap, keydown) before allowing AudioContext to enter "running" state or HTMLAudioElement to play. The app's current flow has users clicking buttons to join rooms and start games, but an AudioContext created at module import time or inside a Socket.io event handler will be born "suspended" with no way to resume without a gesture.

**Consequences:** Complete silence on first load. Intermittent silence on mobile. Users toggle the existing `soundEnabled` toggle and nothing changes. Bug reports impossible to reproduce on desktop dev environments where autoplay restrictions may be relaxed.

**Prevention:**
1. Create a **single global AudioContext lazily** -- on the first user click (any button), not at import time or in a useEffect.
2. Add a `resumeAudioContext()` helper that calls `audioCtx.resume()`. Attach it to a document-level `click`/`touchstart` listener as a one-time handler.
3. Check `audioCtx.state === 'suspended'` before every play attempt. If suspended, queue the sound and attempt resume.
4. For background music: start playback inside the click handler of "Crear Sala" / "Unirse" button -- this satisfies the gesture requirement.
5. Test on **real iOS Safari** (not Chrome DevTools mobile emulation -- Chrome emulation does NOT enforce autoplay policy).

**Detection:** Add `console.warn('AudioContext suspended')` when `audioCtx.state !== 'running'` at play time. Check Safari Web Inspector on a real iPhone.

---

### Pitfall 2: Multiple AudioContexts Conflicting with WebRTC Speaking Detection

**What goes wrong:** Game SFX creates its own AudioContext. The existing `useSpeakingDetection.ts` (line 63) already creates a **new AudioContext per effect cycle** and closes it on cleanup (line 49). WebRTC internally uses audio processing. Three competing audio pipelines fight for the audio hardware. On iOS, there is a **hard limit of one active AudioContext** -- creating a second one suspends the first.

**Why it happens:** The current codebase creates and destroys AudioContext instances in `useSpeakingDetection` every time streams change. Adding a separate AudioContext for SFX creates resource contention. iOS Safari is particularly brutal -- it suspends older contexts when new ones are created, meaning SFX could kill the speaking detection or vice versa.

**Consequences:** WebRTC voice audio cuts out when SFX plays. Speaking detection glow indicators stop working. On iOS, either game sounds or the voice chat speaking detection stops working entirely. Crackling or popping audio artifacts.

**Prevention:**
1. Create **exactly one shared AudioContext singleton** for the entire app. Store it in a module-level variable (not React state, not a Zustand store).
2. **Refactor `useSpeakingDetection.ts`** to accept or import the shared AudioContext instead of creating its own. On cleanup, disconnect individual `AnalyserNode`/`MediaStreamAudioSourceNode` instances but **never call `audioCtx.close()`**.
3. Route SFX through the same AudioContext using `AudioBufferSourceNode` -> `GainNode` -> `destination`.
4. Background music can use a separate `<audio>` HTML element (lighter for long streams), but if volume control via Web Audio is needed, connect it via `createMediaElementSource()` to the shared context.
5. The shared context lives for the app's entire lifetime. Only close it on page unload.

**Detection:** Monitor `audioCtx.state` transitions. If it changes to `'suspended'` unexpectedly during gameplay, a competing context was created. Test with WebRTC call active + SFX playing simultaneously on iOS Safari.

---

### Pitfall 3: iOS Safari Silent Mode (Ringer Switch) Blocks All Web Audio

**What goes wrong:** iPhone users have their physical ringer switch set to silent. ALL Web Audio API and HTMLAudioElement output obeys the ringer switch in Safari. The app appears completely broken -- no tile clack, no notifications, no music. Users don't realize their phone is on silent because they expect game audio to behave like a native app (many native games override silent mode).

**Why it happens:** Safari on iOS routes Web Audio API output through the same audio session as the system ringer. Unlike native iOS apps, web apps cannot request a playback audio session category (`AVAudioSessionCategoryPlayback`). There is no JavaScript API to detect or override the ringer switch state.

**Consequences:** A significant percentage of iPhone users (arguably the majority of casual mobile users keep their phone on silent) will never hear game sounds. They will report "sound doesn't work" and there is literally nothing the app can do programmatically.

**Prevention:**
1. Add a visible audio state indicator in the UI (speaker icon showing whether sound is "on") so users can see the app thinks it's playing sound.
2. On first SFX attempt, if running on iOS (detect via user agent), show a one-time tooltip: "No escuchas sonido? Verifica el interruptor de silencio de tu iPhone."
3. Do NOT treat this as a bug. Document it as a known platform limitation.
4. Note: WebRTC voice chat audio uses a different audio session path through `getUserMedia` and may still work even when the ringer is off -- do not conflate the two systems.

**Detection:** Test on a real iPhone with the ringer switch set to silent. There is no programmatic way to detect silent mode state in Safari.

---

### Pitfall 4: PWA Service Worker Does Not Cache Audio Files

**What goes wrong:** The current Workbox config in `vite.config.ts` uses `globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}']`. This list **does not include audio extensions** (`.mp3`, `.ogg`, `.wav`, `.webm`). Audio files will not be precached by the service worker, causing network fetches on every play and broken audio in offline/poor-network scenarios after PWA install.

**Why it happens:** The PWA config was written before audio files existed in the project. The glob pattern was never updated for the new file types.

**Consequences:** SFX plays with noticeable delay on first trigger (network fetch). After losing connectivity briefly (common on mobile), sounds fail silently. In airplane mode after PWA install, no audio at all. Large background music files (2-5 MB) could also bloat precache if added to globPatterns, causing slow service worker install on constrained connections.

**Prevention:**
1. **SFX files (small, <100KB each):** Add audio extensions to `globPatterns`: `'**/*.{js,css,html,ico,png,svg,woff2,mp3,ogg,wav}'`
2. **Background music (large, >500KB):** Use `runtimeCaching` with `CacheFirst` strategy instead of precaching:
   ```typescript
   {
     urlPattern: /\.mp3$/i,  // or match the specific music file path
     handler: 'CacheFirst',
     options: {
       cacheName: 'audio-cache',
       expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 30 },
       cacheableResponse: { statuses: [0, 200] },
     },
   }
   ```
3. Ensure Express serves audio files with correct `Content-Type` headers (should be automatic with `express.static`).
4. Verify in DevTools > Application > Cache Storage that audio files appear after first load.

**Detection:** Open DevTools > Application > Cache Storage after first visit. Search for `.mp3` files. Test in airplane mode after PWA install.

---

## Moderate Pitfalls

---

### Pitfall 5: Memory Leaks from Unreleased Audio Objects

**What goes wrong:** Creating `new Audio(url)` objects or unbounded `AudioBufferSourceNode` instances for every SFX play without cleanup. Each `Audio()` object holds a decoded buffer in memory. Over a long game session (30+ minutes, 50+ tile plays, many auto-pass cascades), memory grows steadily.

**Prevention:**
1. Use the **AudioBuffer pool pattern**: decode each sound file once into an `AudioBuffer` at initialization. For each play, create a new `AudioBufferSourceNode` (cheap, ~100 bytes), connect it to destination, call `.start()`. The source node auto-garbage-collects after playback ends.
2. **Never use `new Audio(url)` in a loop.** HTMLAudioElement is fine for one long-lived background music element, but terrible for rapid-fire SFX.
3. For the tile clack sound (may fire rapidly during auto-pass cascades -- up to 3 consecutive passes means 3 rapid clacks), allow overlapping playback by creating a new source node each time. `AudioBufferSourceNode` is cheap; the `AudioBuffer` is shared/reused.
4. Call `sourceNode.disconnect()` in the `onended` callback if connecting through intermediate gain nodes.

---

### Pitfall 6: Sound Timing Desync with Socket.io Events and Animations

**What goes wrong:** SFX is triggered directly from Socket.io event handlers (`game:state_snapshot`). Due to network latency and the auto-pass cascade logic, multiple sounds fire in rapid succession or at wrong times. The tile clack plays before the tile animation finishes. The pass sound plays for a player who was auto-passed 500ms ago. Turn notification plays on every state update, not just when turn changes.

**Prevention:**
1. Trigger tile placement SFX from the **animation lifecycle**, not from the socket event. The `lastTileSequence` field in `gameStore` tracks which tile was just placed -- play the clack when the tile animation starts rendering.
2. For pass notifications: tie the pass sound to the same moment `addPasoNotification` in `uiStore` fires (the visual notification appearance).
3. For turn notification: play only when `gameState.currentPlayer === myPlayerIndex` transitions from false to true, not on every `game:state_snapshot`.
4. Add a **minimum interval debounce** between identical sounds: ~100ms for tile clacks, ~300ms for pass sounds. This prevents machine-gun audio during rapid auto-pass cascades where 3+ players pass in sequence.
5. Use `useRef` to track last-play timestamps per sound type.

---

### Pitfall 7: Volume/Mute Preferences Not Persisted Across Sessions

**What goes wrong:** Users set their preferred mute state. They close the PWA and reopen. Everything resets to defaults. The existing `soundEnabled` boolean in `uiStore` is Zustand in-memory state -- no persistence. The first thing they hear on reopen is unwanted background music.

**Prevention:**
1. Use `localStorage` to persist: `sfxEnabled`, `musicEnabled`, `sfxVolume`, `musicVolume`.
2. Initialize the audio store values from `localStorage` on app load (before first render).
3. Keep it simple: direct `localStorage.getItem`/`setItem` inside the Zustand actions. No need for Zustand persist middleware for 4 values.
4. **Critical order of operations:** read saved mute state BEFORE creating AudioContext or playing any sound. Do not play a burst of music before checking the user's saved preference.

---

### Pitfall 8: Background Music State Machine Complexity and Route-Change Bugs

**What goes wrong:** Developers implement elaborate crossfade logic between menu music and game music (or silence), creating complex state machines with race conditions. Music continues playing after navigating from lobby to game. Two audio elements overlap. Music restarts from the beginning when navigating back to lobby.

**Prevention:**
1. Keep it dead simple: **one music track for menu/lobby, silence during gameplay**. Fade out on game start, fade in on return to lobby.
2. Use a single `<audio>` element with a `GainNode` for volume transitions (linear ramp over 500ms).
3. Tie music lifecycle to React Router route changes or game state transitions, not to socket events.
4. **Pause** (not stop) music on game start so it resumes from the same position when returning to lobby.
5. Handle `document.visibilitychange`: pause music when tab is hidden, resume when visible (saves battery, prevents surprise audio from a forgotten tab).
6. Add `loop` attribute to the music `<audio>` element for seamless looping.

---

### Pitfall 9: SFX Playing When Tab Is in Background

**What goes wrong:** User switches to another tab or app. Socket.io events still arrive. Tile clack and pass sounds play from a hidden tab, startling the user or playing from an unexpected speaker.

**Prevention:**
1. Check `document.hidden` before playing any SFX. Skip all SFX when tab is not visible.
2. **Exception: turn notification sound.** This is the ONE sound that SHOULD play in background -- it alerts the user it's their turn. Use a short, distinct sound for this.
3. Pause background music on `visibilitychange` `'hidden'`, resume on `'visible'`.

---

## Minor Pitfalls

---

### Pitfall 10: Audio File Format Incompatibility Across Browsers

**What goes wrong:** Using only `.ogg` (no Safari support) or only `.wav` (huge file sizes, slow decode). Safari on iOS supports fewer codecs in Web Audio API `decodeAudioData()`.

**Prevention:**
1. Ship **MP3 for everything**. Every modern browser (Chrome, Firefox, Safari, Edge) supports MP3 in both HTMLAudioElement and Web Audio API's `decodeAudioData()`.
2. For SFX: keep files short (<1 second) and small (<50KB each as MP3 at 128kbps).
3. For background music: MP3 at 128kbps. Target 2-3 minutes with a clean loop point. Total file size: ~2-3 MB.
4. Place audio files in `client/public/audio/` so Vite copies them to `dist/audio/` unchanged.

---

### Pitfall 11: Race Between AudioBuffer Decoding and First Game Event

**What goes wrong:** Game starts before audio assets finish decoding. The first tile play produces no sound. `decodeAudioData()` is async and takes 50-200ms on slow mobile devices.

**Prevention:**
1. Pre-decode all SFX AudioBuffers when the AudioContext is first created (on first user gesture, which happens at room join/create -- well before the first tile play).
2. If a sound is requested before its buffer is ready, skip it silently. Do not queue, retry, or block.
3. The lobby screen provides ample time for decoding. Start decode on lobby entry, not on game start.

---

### Pitfall 12: Existing `soundEnabled` Toggle Is Too Coarse for Music + SFX

**What goes wrong:** The existing `uiStore.soundEnabled` boolean controls everything. Users want background music off but SFX on (or vice versa). A single toggle forces all-or-nothing audio.

**Prevention:**
1. Replace `soundEnabled: boolean` with two separate toggles: `sfxEnabled: boolean` and `musicEnabled: boolean`.
2. Optionally add volume sliders (`sfxVolume: number`, `musicVolume: number`, 0-1 range).
3. The UI should show two distinct controls (matching the milestone requirements: "Separate toggles for music and SFX").
4. Migration: if `soundEnabled` is already persisted anywhere, map it to both new booleans on first read.

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| **AudioContext setup** | P1 (autoplay) + P2 (multiple contexts) | Shared singleton AudioContext, resumed on first gesture. Refactor `useSpeakingDetection.ts` to use shared context. This MUST happen first -- all other audio work depends on it. |
| **SFX implementation** | P5 (memory leaks) + P6 (timing desync) | AudioBuffer pool pattern. Trigger from animation/UI state, not raw socket events. Debounce rapid sounds. |
| **Background music** | P8 (state complexity) + P9 (background tabs) | Simple fade in/out. Pause on visibilitychange. Single `<audio>` element with gain node. |
| **PWA caching update** | P4 (missing audio in globPatterns) | Update workbox config in `vite.config.ts` before deploying audio files. SFX in precache, music in runtimeCaching. |
| **Audio preferences UI** | P7 (persistence) + P12 (coarse toggle) | Split into sfxEnabled + musicEnabled. Persist to localStorage. Read before first sound plays. |
| **Mobile testing** | P3 (iOS silent mode) + P1 (autoplay) | Test on real iOS device with ringer switch off. Add user-facing hint about silent mode. Cannot be fixed in code. |

---

## Integration Risk Matrix: Game Audio vs Existing Systems

| Existing System | Risk Level | Specific Concern | Mitigation |
|----------------|-----------|-----------------|------------|
| **WebRTC voice chat** | HIGH | Competing AudioContexts; iOS one-context limit | Shared AudioContext singleton; never create secondary contexts |
| **Speaking detection (`useSpeakingDetection.ts`)** | HIGH | Currently creates/destroys its own AudioContext per stream change (lines 48-63); must be refactored | Accept shared context; disconnect nodes on cleanup, never close context |
| **Socket.io event flow** | MEDIUM | SFX triggered by events may fire rapidly during auto-pass cascades (up to 3 passes in ~1.5s) | Debounce SFX; trigger from UI state transitions, not raw socket handlers |
| **PWA Service Worker** | MEDIUM | Audio files not in current cache config; music file could bloat precache | Update globPatterns for SFX; use runtimeCaching for music |
| **Zustand stores (`uiStore`)** | LOW | Existing `soundEnabled` boolean needs splitting into sfx + music | Extend uiStore; add localStorage persistence |
| **Tile animations (`lastTileSequence`)** | LOW | Sound/animation timing alignment | Trigger SFX from animation lifecycle callbacks |
| **`callStore` state** | LOW | No direct conflict; call mute state is separate from game audio mute | Keep them independent; game SFX mute and mic mute are separate concerns |

---

## Sources

- Codebase analysis: `useSpeakingDetection.ts` (creates/closes AudioContext per effect cycle, lines 48-63), `uiStore.ts` (`soundEnabled` boolean with no persistence), `callStore.ts` (WebRTC state management), `useWebRTC.ts` (media acquisition flow), `vite.config.ts` (workbox globPatterns missing audio extensions)
- Browser autoplay policies: Chromium autoplay policy (enforced since Chrome 66, 2018), WebKit autoplay policy (Safari 11+, 2017)
- Web Audio API: W3C specification -- AudioContext state management, AudioBufferSourceNode lifecycle, single-context best practices
- iOS audio session behavior: WebKit documentation on audio session handling; ringer switch affecting all web audio output
- PWA caching: Workbox documentation for globPatterns and runtimeCaching configuration patterns

---

*Pitfalls analysis: 2026-03-14 -- v1.2 Sound & Audio milestone*

# Phase 13: Audio Foundation - Research

**Researched:** 2026-03-14
**Domain:** Web Audio API, browser autoplay policy, PWA audio caching
**Confidence:** HIGH

## Summary

Phase 13 establishes audio infrastructure for all future sound/music phases. The core challenge is threefold: (1) create a shared AudioContext singleton that both SFX playback and the existing `useSpeakingDetection` hook can use without conflict (especially on iOS which limits concurrent AudioContexts), (2) handle browser autoplay policies transparently so audio "just works" regardless of when the first sound trigger fires, and (3) ensure audio files are precached by the PWA service worker for offline playback.

No external audio libraries are needed. The Web Audio API is sufficient for this project's needs (short SFX clips, one music loop). The existing codebase already uses Web Audio API for speaking detection, so the team is familiar with the API surface. The primary work is refactoring the AudioContext lifecycle and adding autoplay unlock logic.

**Primary recommendation:** Create an `audioContext.ts` singleton module that lazily creates one AudioContext, registers a one-time user gesture listener for autoplay unlock, and exports the context for both `useSpeakingDetection` and a new `useAudio` hook. Add `mp3` to workbox `globPatterns` for precaching.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
None -- all decisions delegated to Claude's discretion.

### Claude's Discretion
User delegated all decisions for this infrastructure phase. Claude has full flexibility on:

- **AudioContext singleton design** -- Where the shared context lives, how useSpeakingDetection integrates
- **Autoplay unlock strategy** -- How and when the AudioContext gets unlocked (silent resume on first user gesture)
- **Audio file format** -- MP3 for broad compatibility + small size; add to PWA cache patterns
- **uiStore audio preferences** -- Prepare separate `sfxEnabled` and `musicEnabled` booleans now (replacing single `soundEnabled`) to avoid refactoring in Phase 15
- **Default audio state** -- Both SFX and music default to ON (matches current `soundEnabled: true` behavior)
- **PWA caching approach** -- Add audio file extensions to workbox globPatterns

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| AUD-01 | Audio uses a shared AudioContext singleton (compatible with existing WebRTC speaking detection) | Singleton module pattern; `useSpeakingDetection` refactored to consume shared context instead of creating its own |
| AUD-02 | Audio handles browser autoplay policy (unlocks on first user interaction) | One-time gesture listener (`click`/`touchend`/`keydown`) calls `audioContext.resume()` when state is `suspended` |
| AUD-03 | Audio files are cached by PWA service worker for offline playback | Add `mp3` to workbox `globPatterns`; short SFX files precached at install time |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Web Audio API | Browser-native | AudioContext, AudioBuffer, decodeAudioData | Already used in codebase for speaking detection; no external dependency needed |
| vite-plugin-pwa | ^1.2.0 (existing) | PWA service worker with workbox | Already configured in project; just needs globPatterns update |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| zustand | ^4.4.7 (existing) | Audio preference state (sfxEnabled, musicEnabled) | uiStore already manages soundEnabled toggle |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Raw Web Audio API | howler.js | Howler adds ~10KB for cross-browser normalization we don't need (project already uses Web Audio API directly) |
| Raw Web Audio API | Tone.js | Overkill -- designed for music synthesis, not simple SFX playback |

**Installation:**
```bash
# No new packages needed -- all dependencies already in place
```

## Architecture Patterns

### Recommended Project Structure
```
client/src/
├── audio/
│   ├── audioContext.ts      # Singleton AudioContext + autoplay unlock
│   └── audioLoader.ts       # Fetch + decode audio files into AudioBuffers
├── hooks/
│   ├── useAudio.ts          # Hook for playing sounds (consumes audioContext singleton)
│   └── useSpeakingDetection.ts  # Refactored to use shared audioContext
├── store/
│   └── uiStore.ts           # sfxEnabled + musicEnabled (replaces soundEnabled)
└── assets/
    └── audio/               # MP3 files (placeholder/silent file for testing)
```

### Pattern 1: AudioContext Singleton Module
**What:** A module-level singleton that lazily creates one `AudioContext` and handles autoplay unlock.
**When to use:** Any code needing Web Audio API access imports from this module.
**Example:**
```typescript
// client/src/audio/audioContext.ts
// Source: MDN Web Audio API Best Practices

let audioContext: AudioContext | null = null
let unlockRegistered = false

export function getAudioContext(): AudioContext {
  if (!audioContext) {
    audioContext = new AudioContext()
    registerAutoplayUnlock()
  }
  return audioContext
}

function registerAutoplayUnlock(): void {
  if (unlockRegistered) return
  unlockRegistered = true

  const unlock = () => {
    if (audioContext && audioContext.state === 'suspended') {
      audioContext.resume()
    }
    // Remove after first successful unlock
    if (audioContext && audioContext.state === 'running') {
      document.removeEventListener('click', unlock, true)
      document.removeEventListener('touchend', unlock, true)
      document.removeEventListener('keydown', unlock, true)
    }
  }

  document.addEventListener('click', unlock, true)
  document.addEventListener('touchend', unlock, true)
  document.addEventListener('keydown', unlock, true)
}
```

### Pattern 2: AudioBuffer Preloading
**What:** Fetch MP3 files and decode them into `AudioBuffer` objects at app init, stored in a Map for instant playback.
**When to use:** For SFX clips that need low-latency playback (Phase 14 will consume this).
**Example:**
```typescript
// client/src/audio/audioLoader.ts
import { getAudioContext } from './audioContext'

const bufferCache = new Map<string, AudioBuffer>()

export async function loadAudio(url: string): Promise<AudioBuffer> {
  const cached = bufferCache.get(url)
  if (cached) return cached

  const response = await fetch(url)
  const arrayBuffer = await response.arrayBuffer()
  const audioBuffer = await getAudioContext().decodeAudioData(arrayBuffer)
  bufferCache.set(url, audioBuffer)
  return audioBuffer
}

export function playBuffer(buffer: AudioBuffer, volume = 1.0): void {
  const ctx = getAudioContext()
  const source = ctx.createBufferSource()
  source.buffer = buffer

  if (volume !== 1.0) {
    const gain = ctx.createGain()
    gain.gain.value = volume
    source.connect(gain).connect(ctx.destination)
  } else {
    source.connect(ctx.destination)
  }

  source.start(0)
}
```

### Pattern 3: useSpeakingDetection Refactor
**What:** Replace local `new AudioContext()` / `.close()` with shared singleton.
**When to use:** The existing hook creates and destroys AudioContexts on every stream change -- this must stop.
**Example:**
```typescript
// Key change in useSpeakingDetection.ts:
// BEFORE:
const audioCtx = new AudioContext()
audioCtxRef.current = audioCtx
// ... cleanup: audioCtx.close()

// AFTER:
import { getAudioContext } from '../audio/audioContext'
const audioCtx = getAudioContext()
// No close() -- singleton persists. Only disconnect sources on cleanup.
```

**Critical difference:** The refactored hook must NOT call `audioContext.close()` in its cleanup. It should only `source.disconnect()` for its own analyser nodes. The AudioContext is shared and must remain alive.

### Pattern 4: uiStore Split Toggle
**What:** Replace single `soundEnabled` with `sfxEnabled` + `musicEnabled`.
**When to use:** Preparing for Phase 15 (CTL-01, CTL-02) where independent toggles are needed.
**Example:**
```typescript
// uiStore.ts changes:
// REMOVE: soundEnabled: boolean, toggleSound()
// ADD:
sfxEnabled: boolean    // default: true
musicEnabled: boolean  // default: true
toggleSfx: () => void
toggleMusic: () => void
```

### Anti-Patterns to Avoid
- **Creating multiple AudioContexts:** iOS Safari limits concurrent AudioContexts. The speaking detection hook currently creates/destroys contexts per stream change -- this MUST be refactored to use the singleton.
- **Calling audioContext.close() in component cleanup:** The singleton must persist for the app lifetime. Only disconnect individual nodes.
- **Playing audio without checking sfxEnabled/musicEnabled:** Always gate playback on the store preference.
- **Using HTML `<audio>` elements for SFX:** `AudioBuffer` + `createBufferSource()` has lower latency for short clips. Reserve `<audio>` for long-form music (Phase 15).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Autoplay unlock | Custom per-browser detection | Single resume-on-gesture pattern | All modern browsers (Chrome, Safari, Firefox) converge on the same `suspended` state + `resume()` pattern |
| Audio file caching | Custom cache API logic | Workbox precaching via globPatterns | Already configured in the project; just add `mp3` extension |
| AudioContext singleton | React context/provider | Module-level singleton | AudioContext is a browser API, not React state. Module singleton is simpler and works outside React (e.g., in utility functions) |

**Key insight:** The Web Audio API is well-standardized across browsers now. The only real cross-browser concern is autoplay policy, and the `resume()` on user gesture pattern handles it universally.

## Common Pitfalls

### Pitfall 1: iOS AudioContext Limit
**What goes wrong:** Creating multiple AudioContext instances causes silent failures or resource exhaustion on iOS Safari.
**Why it happens:** iOS limits the number of concurrent AudioContexts (typically 4-6, but behavior is unpredictable).
**How to avoid:** Single AudioContext singleton shared between SFX playback and speaking detection.
**Warning signs:** Audio stops working on iOS after navigating between pages or toggling voice chat.

### Pitfall 2: Closing the Shared AudioContext
**What goes wrong:** `useSpeakingDetection` currently calls `audioCtx.close()` on cleanup, which would kill audio for the entire app.
**Why it happens:** The hook was designed with its own private AudioContext. After refactoring to shared singleton, the close() call must be removed.
**How to avoid:** Refactored hook only disconnects its own `MediaStreamAudioSourceNode` and `AnalyserNode`. Never calls `close()` on the shared context.
**Warning signs:** Audio works initially, then stops after voice chat streams change.

### Pitfall 3: Autoplay Unlock Timing
**What goes wrong:** First sound effect is silent because `AudioContext` is still suspended.
**Why it happens:** AudioContext created before any user gesture starts in `suspended` state. If the first `playBuffer()` call happens before a gesture, audio is silently dropped.
**How to avoid:** The `getAudioContext()` function registers document-level gesture listeners that call `resume()`. Additionally, `playBuffer()` should check `audioContext.state` and call `resume()` as a safety net before playing.
**Warning signs:** First sound after page load is silent; subsequent sounds work fine.

### Pitfall 4: decodeAudioData on Suspended Context
**What goes wrong:** `decodeAudioData()` can fail or hang on some browsers if the AudioContext is suspended.
**Why it happens:** Some browser implementations require the context to be running before decoding.
**How to avoid:** Call `audioContext.resume()` before `decodeAudioData()`, or preload audio after the first user gesture fires.
**Warning signs:** Audio files fail to load on first page visit; work after user interaction.

### Pitfall 5: PWA Cache Size
**What goes wrong:** Large audio files bloat the precache manifest, slowing initial service worker install.
**Why it happens:** Adding `mp3` to globPatterns includes ALL mp3 files in precache.
**How to avoid:** Keep audio files small (SFX should be <100KB each). For the Phase 13 test file, use a tiny silent MP3 or very short clip. If music files are large (Phase 15), consider `runtimeCaching` with CacheFirst strategy + RangeRequestsPlugin instead of precaching.
**Warning signs:** Service worker install takes noticeably longer; storage quota warnings.

## Code Examples

Verified patterns from official sources:

### Playing a Sound Effect (Complete Flow)
```typescript
// Source: MDN Web Audio API, web.dev Web Audio intro
import { getAudioContext } from '../audio/audioContext'

// 1. Load at app startup or on demand
const response = await fetch('/audio/clack.mp3')
const arrayBuffer = await response.arrayBuffer()
const buffer = await getAudioContext().decodeAudioData(arrayBuffer)

// 2. Play (can be called many times with same buffer)
const ctx = getAudioContext()
const source = ctx.createBufferSource()
source.buffer = buffer
source.connect(ctx.destination)
source.start(0)
// source is automatically garbage collected after playback ends
```

### Autoplay Unlock (Robust Pattern)
```typescript
// Source: Chrome Autoplay Policy, MDN Autoplay Guide
function ensureAudioContextRunning(ctx: AudioContext): Promise<void> {
  if (ctx.state === 'running') return Promise.resolve()
  return ctx.resume()
}

// Call before any playback attempt as safety net
async function safePlay(buffer: AudioBuffer): Promise<void> {
  const ctx = getAudioContext()
  await ensureAudioContextRunning(ctx)
  const source = ctx.createBufferSource()
  source.buffer = buffer
  source.connect(ctx.destination)
  source.start(0)
}
```

### PWA globPatterns Update
```typescript
// vite.config.ts -- add mp3 to existing pattern
workbox: {
  globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2,mp3}'],
  // ... rest of existing config unchanged
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `webkitAudioContext` fallback | Standard `AudioContext` | ~2020 (Safari 14.1) | No vendor prefix needed; all modern browsers support standard API |
| Autoplay always allowed | Autoplay policy (suspended by default) | Chrome 66 (2018), Safari 11 (2017) | Must handle `suspended` state and call `resume()` on user gesture |
| HTML5 `<audio>` for everything | `AudioBuffer` for SFX, `<audio>` for streaming | Stable pattern | Lower latency for short clips; `<audio>` still appropriate for music loops |

**Deprecated/outdated:**
- `webkitAudioContext`: No longer needed. Safari has supported standard `AudioContext` since version 14.1 (April 2021).
- `createScriptProcessor()`: Deprecated in favor of `AudioWorklet`. Not relevant to this phase (not used in codebase).

## Open Questions

1. **Audio file sourcing (Phase 14/15 concern, not Phase 13)**
   - What we know: 3 SFX clips + 1 music loop needed in MP3 format, royalty-free
   - What's unclear: Specific files not yet selected
   - Recommendation: For Phase 13 testing, create or download a tiny test MP3 (e.g., a 0.1s click sound). Actual SFX files are Phase 14 scope.

2. **Music playback mechanism (Phase 15 concern)**
   - What we know: `AudioBuffer` is ideal for short SFX; long music loops may benefit from `<audio>` element or `MediaElementAudioSourceNode`
   - What's unclear: Whether to use `AudioBuffer` or `<audio>` for the lo-fi loop
   - Recommendation: Phase 13 should design the AudioContext singleton to support both patterns. Decision deferred to Phase 15 research.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | None configured (TypeScript strict mode is primary correctness check) |
| Config file | none -- no test framework in project |
| Quick run command | `cd client && npx tsc --noEmit` |
| Full suite command | `cd client && npx tsc --noEmit && cd ../server && npx tsc --noEmit` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| AUD-01 | Shared AudioContext singleton, speaking detection still works | manual | Start dev, open voice chat, verify green glow ring | N/A |
| AUD-02 | Autoplay unlock on first user gesture | manual | Load app fresh, click anywhere, verify AudioContext state transitions to `running` | N/A |
| AUD-03 | Audio files cached for offline | manual | Build, serve, go offline in DevTools, verify audio file in Cache Storage | N/A |

### Sampling Rate
- **Per task commit:** `cd client && npx tsc --noEmit`
- **Per wave merge:** `cd client && npx tsc --noEmit && cd ../server && npx tsc --noEmit`
- **Phase gate:** TypeScript passes + manual verification of all 3 requirements

### Wave 0 Gaps
None -- no test framework to set up. All validation is TypeScript compilation + manual browser testing. This is appropriate because:
- AudioContext behavior cannot be unit tested without browser APIs
- Autoplay policy requires real browser interaction
- PWA caching requires a built service worker

## Sources

### Primary (HIGH confidence)
- [MDN Web Audio API Best Practices](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API/Best_practices) - AudioContext singleton, autoplay handling, mobile considerations
- [MDN AudioContext](https://developer.mozilla.org/en-US/docs/Web/API/AudioContext) - API reference, constructor, state management
- [MDN Autoplay Guide](https://developer.mozilla.org/en-US/docs/Web/Media/Guides/Autoplay) - Browser autoplay policies, user gesture requirements
- [Chrome Autoplay Policy](https://developer.chrome.com/blog/autoplay/) - Chrome-specific autoplay implementation details
- [Chrome Workbox: Serving Cached Audio/Video](https://developer.chrome.com/docs/workbox/serving-cached-audio-and-video) - RangeRequestsPlugin, precaching vs runtime caching

### Secondary (MEDIUM confidence)
- [vite-plugin-pwa Service Worker Precache](https://vite-pwa-org.netlify.app/guide/service-worker-precache) - globPatterns configuration
- [Matt Montag: Unlock Web Audio in Safari](https://www.mattmontag.com/web/unlock-web-audio-in-safari-for-ios-and-macos) - iOS/macOS Safari unlock patterns

### Tertiary (LOW confidence)
- iOS AudioContext instance limit (4-6 concurrent) - referenced in multiple forums but no official Apple documentation found. Treated as real constraint based on widespread developer reports and existing codebase comment in STATE.md.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Using browser-native Web Audio API already present in codebase; no new dependencies
- Architecture: HIGH - Singleton pattern for AudioContext is well-documented MDN best practice; project structure follows existing codebase conventions
- Pitfalls: HIGH - Autoplay policy and iOS constraints are extensively documented; the useSpeakingDetection close() issue is verified by reading actual code
- PWA caching: HIGH - globPatterns approach verified against existing vite.config.ts; simple extension addition

**Research date:** 2026-03-14
**Valid until:** 2026-04-14 (Web Audio API is stable; no breaking changes expected)

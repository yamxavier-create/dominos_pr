# Technology Stack: v1.2 Sound & Audio

**Project:** Dominos PR
**Researched:** 2026-03-14
**Scope:** Audio additions only (SFX + background music for existing React PWA)

---

## Executive Verdict

**Zero new dependencies. Zero new dev dependencies. One line changed in vite.config.ts.**

Use the native **Web Audio API** with a custom `useAudio` hook. The app needs 5 short sound effects and 1 looping music track -- Howler.js, use-sound, and Tone.js are all unnecessary overhead. The codebase already uses Web Audio API for speaking detection (`useSpeakingDetection.ts`), and the existing Workbox service worker already caches static assets -- just add `mp3` to the glob pattern.

---

## Recommended Stack

### Audio Playback (NEW -- zero dependencies)

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Web Audio API (native) | N/A (browser built-in) | SFX playback and music loop | Zero deps, already used in codebase, supports overlapping playback and per-channel volume |
| AudioContext | N/A | Single shared context for all audio | One context per app is the standard pattern; resume on user gesture handles autoplay policy |
| AudioBuffer | N/A | Pre-decoded audio data for instant SFX | Decoded once at load, played many times with zero latency |
| GainNode | N/A | Volume control per channel | Separate gain nodes for SFX vs music maps to the two independent toggles |

### Audio Format (NEW -- no build tool changes)

| Format | Extension | Purpose | Why |
|--------|-----------|---------|-----|
| MP3 | `.mp3` | All sound effects and music | Universal browser support (100%), good compression, no patent issues since 2017, Vite serves from `public/` with no config |

### Existing Stack (unchanged, leveraged)

| Technology | Version | Role in Audio Feature |
|------------|---------|----------------------|
| Zustand (uiStore) | ^4.4.7 | Already has `soundEnabled` toggle -- extend with separate `sfxEnabled` and `musicEnabled` |
| vite-plugin-pwa (Workbox) | ^1.2.0 | Already caches `**/*.{js,css,html,ico,png,svg,woff2}` -- add `mp3` to globPatterns |
| Vite | ^5.0.8 | Serves audio files from `client/public/` as static assets with zero config |
| Web Audio API (useSpeakingDetection.ts) | N/A | Proves the team has Web Audio API precedent in the codebase already |

---

## Decision: Web Audio API (native) -- No Library

### Why NOT Howler.js

Howler.js (~v2.2.4, last significant update ~2023) adds ~7KB gzipped for features this project will never use: audio sprites, spatial/3D audio, codec negotiation across legacy browsers, automatic HTML5 Audio fallback. Its main value proposition -- abstracting away cross-browser inconsistencies -- is irrelevant when targeting only modern browsers (which this PWA does).

For 5 sound files, a 30-line custom hook provides everything Howler.js would, without the dependency.

### Why NOT use-sound

`use-sound` (~v4.0.3) is a React hook wrapper around Howler.js. It adds a second dependency (Howler) as a transitive dep, has stale maintenance, and its hook API actually provides less control than a custom hook for music looping and cross-component volume management.

### Why NOT HTMLAudioElement (`<audio>` / `new Audio()`)

- Cannot play overlapping instances of the same sound (e.g., rapid tile clacks in spectated games)
- No fine-grained volume control independent of system volume
- Higher latency for short SFX -- HTMLAudioElement loads and decodes each play
- No gain node graph for per-channel (SFX vs music) volume control

### Why Web Audio API

- **Already in the codebase:** `useSpeakingDetection.ts` creates an `AnalyserNode` on a WebRTC `MediaStream` -- the team has Web Audio API precedent
- **Zero dependencies:** Browser built-in, no bundle size impact
- **Sub-millisecond latency:** Pre-decoded `AudioBuffer` plays instantly via `AudioBufferSourceNode`
- **Overlapping playback:** Create a new `AudioBufferSourceNode` each time -- no "channel" limits for the same sound
- **Per-channel volume:** Separate `GainNode` for SFX and music maps exactly to the two UI toggles
- **Full PWA support:** Audio files cached as static assets by existing service worker

---

## Audio Format Decision: MP3 Only

**Use MP3 for everything. Do not provide OGG/WebM fallbacks.**

| Format | Compression | Browser Support (2025+) | File Size (3s SFX) | Decision |
|--------|-------------|------------------------|---------------------|----------|
| **MP3** | Lossy, ~10:1 | 100% modern browsers | ~10KB | **USE THIS** |
| OGG Vorbis | Lossy, ~12:1 | ~96% (older Safari gap) | ~8KB | Skip -- marginal savings, adds dual-format complexity |
| WAV | Uncompressed | 100% | ~130KB | Skip -- 10x larger, no audible benefit for short SFX |
| WebM/Opus | Lossy, best ratio | ~96% (Safari 16.1+) | ~6KB | Skip -- Safari gap on older iOS devices |
| AAC/M4A | Lossy, good | ~98% | ~9KB | Skip -- MP3 equally universal and simpler tooling |

MP3 patents expired in 2017. There are zero licensing, compatibility, or quality concerns for short SFX and compressed music loops.

---

## Integration Points

### 1. AudioContext Initialization (autoplay policy)

```typescript
// Single shared AudioContext, created and resumed on first user gesture
// Chrome and iOS Safari require user interaction before AudioContext can produce sound
let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext {
  if (!audioCtx) {
    audioCtx = new AudioContext();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}
```

The first click/tap on any screen (joining a room, pressing "Start Game") resumes the context. No explicit "enable audio" prompt needed.

### 2. Pre-decoded Buffer Cache

```typescript
const bufferCache = new Map<string, AudioBuffer>();

async function loadSound(url: string): Promise<AudioBuffer> {
  if (bufferCache.has(url)) return bufferCache.get(url)!;
  const response = await fetch(url);
  const arrayBuffer = await response.arrayBuffer();
  const audioBuffer = await getAudioContext().decodeAudioData(arrayBuffer);
  bufferCache.set(url, audioBuffer);
  return audioBuffer;
}
```

Preload all SFX on game start. Music can lazy-load when entering lobby/menu.

### 3. Playback with Gain Nodes

```typescript
// SFX: fire-and-forget one-shot
function playSFX(buffer: AudioBuffer, gainNode: GainNode) {
  const ctx = getAudioContext();
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.connect(gainNode).connect(ctx.destination);
  source.start(0);
}

// Music: looping with returned handle for stop/volume
function startMusic(buffer: AudioBuffer, gainNode: GainNode) {
  const ctx = getAudioContext();
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.loop = true;
  source.connect(gainNode).connect(ctx.destination);
  source.start(0);
  return source; // Store ref to call source.stop() later
}
```

Two persistent `GainNode` instances -- one for SFX, one for music -- controlled by Zustand state.

### 4. uiStore Extension

Current state has `soundEnabled: boolean`. Extend to:

```typescript
// Replace single toggle with two:
sfxEnabled: boolean       // default: true
musicEnabled: boolean     // default: true
// Optional future enhancement:
sfxVolume: number         // 0.0-1.0, default: 1.0
musicVolume: number       // 0.0-1.0, default: 0.3
```

The existing `toggleSound` action becomes `toggleSFX` and `toggleMusic`. The UI needs two toggle buttons instead of one.

### 5. PWA Offline Caching (one-line change)

In `vite.config.ts`, add `mp3` to the existing Workbox glob:

```typescript
// Current:
globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
// Updated:
globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2,mp3}'],
```

Audio files in `client/public/sounds/` are precached on first visit. No runtime caching rules needed -- they are local static assets.

### 6. Sound File Placement and Budget

```
client/public/sounds/
  tile-clack.mp3      (~10KB)  -- played on tile placement
  turn-ding.mp3       (~8KB)   -- played when it becomes your turn
  pass-swoosh.mp3     (~6KB)   -- played on auto-pass
  round-end.mp3       (~12KB)  -- played on round completion
  game-end.mp3        (~15KB)  -- played on game over
  lofi-music.mp3      (~400KB) -- background loop, 30-60 seconds
```

**Total audio budget: ~450KB** precached by service worker. This is well within acceptable PWA precache limits (Workbox warns at 2MB+).

### 7. Visibility API Integration

Pause music when the browser tab is hidden to avoid battery drain and unexpected audio:

```typescript
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    musicSource?.stop();  // or suspend AudioContext
  } else {
    // Restart music if musicEnabled
  }
});
```

### 8. No Conflict with Existing WebRTC Audio

The existing WebRTC code uses `MediaStream` audio tracks through peer connections -- this is a separate audio pipeline from Web Audio API's `AudioContext`. They coexist without interference. The `useSpeakingDetection.ts` hook already proves this coexistence works (it creates an `AnalyserNode` from a MediaStream while WebRTC audio plays).

---

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| Audio library | Web Audio API (native) | Howler.js v2.2.x | Unnecessary for 5 sounds; adds 7KB gzipped; cross-browser fallback not needed |
| Audio library | Web Audio API (native) | use-sound v4.0.x | React wrapper over Howler; stale maintenance; less control for music looping |
| Audio library | Web Audio API (native) | HTMLAudioElement | Cannot overlap same sound; higher latency; no per-channel gain |
| Audio library | Web Audio API (native) | Tone.js | Music synthesis/sequencing library; massive overkill for MP3 playback |
| Audio library | Web Audio API (native) | Pizzicato.js | Abandoned; Web Audio API wrapper that adds effects we don't need |
| Format | MP3 only | MP3 + OGG fallback | Dual formats double asset management; MP3 support is universal |
| Format | MP3 only | WAV | 10x file size for no audible quality benefit on 1-3 second SFX |
| Format | MP3 only | WebM/Opus | Better compression but Safari gap on older iOS; not worth the complexity |
| Caching | Workbox precache | Runtime caching | Audio files are static and small; precache ensures offline availability from first load |

---

## What NOT to Add

| Do Not Add | Reason |
|------------|--------|
| `howler` npm package | Unnecessary abstraction; 7KB for features we won't use |
| `use-sound` npm package | Stale, Howler dependency, less control than custom hook |
| `tone.js` npm package | Music synthesis library -- we play back files, not generate audio |
| `pizzicato` npm package | Abandoned audio effects library |
| OGG/WebM fallback files | MP3 is universally supported; dual formats add build/asset complexity |
| Audio sprite sheets | Useful for 50+ sounds; overkill for 5-6 files |
| Server-side audio logic | Audio is purely client-side presentation; server should not know about sounds |
| `<audio>` HTML elements in DOM | Web Audio API is superior for game SFX; reserve `<audio>` for accessibility-only use |
| Web Audio API polyfills | Not needed -- AudioContext is supported in all browsers this PWA targets |

---

## Installation

```bash
# No new packages needed!

# Audio files go in client/public/sounds/
# (Source free-use SFX from freesound.org, pixabay.com/sound-effects, or create custom)

# Only code change to existing config:
# In vite.config.ts, add 'mp3' to globPatterns string
```

**Total new dependencies: 0 runtime, 0 dev**

---

## Browser Considerations

| Concern | Solution | Confidence |
|---------|----------|------------|
| Chrome autoplay policy | Create/resume AudioContext on first user gesture (click/tap) | HIGH |
| iOS Safari AudioContext limit | Reuse single AudioContext instance for entire app lifetime | HIGH |
| Mobile low-power / background | Pause music on `visibilitychange` event when `document.hidden` | HIGH |
| Multiple AudioContext warning | One AudioContext shared across all audio playback | HIGH |
| WebRTC audio coexistence | Separate pipelines; proven by existing `useSpeakingDetection.ts` | HIGH |
| Old browsers without AudioContext | PWA requires modern browser anyway; not a concern | HIGH |

---

## Confidence Assessment

| Claim | Confidence | Basis |
|-------|------------|-------|
| Web Audio API sufficient for this use case | HIGH | Stable W3C spec since 2020; already used in this codebase |
| No audio library needed | HIGH | Only 5-6 sounds; well-understood 30-line pattern |
| MP3 universal browser support | HIGH | Patent-free since 2017; 100% modern browser support |
| Workbox globPatterns caches MP3s | HIGH | Workbox precache handles any static asset matched by glob |
| AudioContext autoplay policy behavior | HIGH | Well-documented Chrome/Safari policy since 2018 |
| Howler.js latest is ~v2.2.4 | MEDIUM | Training data -- verify with `npm view howler version` if needed |
| use-sound latest is ~v4.0.3 | LOW | Training data -- irrelevant since we are not using it |
| Total audio budget ~450KB | MEDIUM | Depends on actual SFX sourced; estimate based on typical game SFX |

---

## Sources

- **Codebase:** `client/src/hooks/useSpeakingDetection.ts` -- existing Web Audio API usage (AnalyserNode, AudioContext)
- **Codebase:** `client/src/store/uiStore.ts` -- existing `soundEnabled: boolean` toggle
- **Codebase:** `client/vite.config.ts` -- existing Workbox config with globPatterns and navigateFallbackDenylist
- **Codebase:** `client/package.json` -- confirms no existing audio dependencies
- **W3C:** Web Audio API specification (stable recommendation)
- **MDN:** AudioContext, AudioBuffer, AudioBufferSourceNode, GainNode documentation
- **Google Developers:** Autoplay policy for AudioContext (documented since 2018)
- **Training data:** Howler.js and use-sound comparison (MEDIUM confidence on version numbers)

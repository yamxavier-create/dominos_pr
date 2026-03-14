# Phase 15: Background Music & Controls - Research

**Researched:** 2026-03-14
**Domain:** Web Audio looping music playback, route-aware audio lifecycle, independent audio controls
**Confidence:** HIGH

## Summary

Phase 15 adds lo-fi background music to the menu and lobby screens, stops it when gameplay begins, and provides independent toggle controls for SFX and music. The audio infrastructure from Phase 13 (AudioContext singleton, autoplay unlock, buffer caching, PWA precaching of mp3 files) is fully in place. The Zustand `uiStore` already has separate `sfxEnabled` and `musicEnabled` booleans with toggle actions -- this was explicitly planned in Phase 13 (decision: "Split soundEnabled into sfxEnabled + musicEnabled for independent control in future phases").

The critical architectural decision is using an HTML5 `<audio>` element for music rather than the Web Audio API `AudioBufferSourceNode` used for SFX. Long-form looping audio (30s-2min loops) should use `<audio>` because: (1) it streams rather than loading the entire file into memory, (2) it natively supports `loop`, `pause()`, and `play()`, and (3) AudioBuffer is designed for short clips that need sub-millisecond latency -- unnecessary for background music. The `<audio>` element can still be connected to the shared AudioContext via `createMediaElementSource()` if needed in the future (e.g., for volume control via GainNode), but for simple play/pause/loop that is unnecessary.

The music module needs route awareness: play on `/` (menu) and `/lobby`, stop on `/game`. The simplest approach is a `useBackgroundMusic` hook that reads `location.pathname` from React Router and the `musicEnabled` store state, controlling a singleton `<audio>` element accordingly. The `game:started` socket event handler already navigates to `/game`, so the route change naturally triggers the music stop.

**Primary recommendation:** Create a `music.ts` singleton module with a hidden `<audio>` element for looping playback, and a `useBackgroundMusic` hook that starts/stops based on route + `musicEnabled` state. Expand the existing `SfxToggleButton` into an `AudioControls` component with two independent toggle buttons.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| MUS-01 | User hears lo-fi background music on the menu and lobby screens | `useBackgroundMusic` hook plays music when `pathname` is `/` or `/lobby` and `musicEnabled` is true |
| MUS-02 | Background music stops when the game starts | Hook stops music when `pathname` changes to `/game` (triggered by `navigate('/game')` in `game:started` handler) |
| CTL-01 | User can toggle SFX on/off independently from music | `uiStore.sfxEnabled` + `uiStore.toggleSfx()` already exist; need visible toggle in menu/lobby/game UI |
| CTL-02 | User can toggle background music on/off independently from SFX | `uiStore.musicEnabled` + `uiStore.toggleMusic()` already exist; need visible toggle in menu/lobby/game UI |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| HTML5 `<audio>` | Browser-native | Looping background music playback | Streams audio, native loop/pause/play, no memory overhead for long clips |
| audioContext.ts | Phase 13 | Shared AudioContext singleton (autoplay unlock) | Ensures AudioContext is unlocked; `<audio>` benefits from same user gesture unlock flow |
| Zustand (uiStore) | Existing | `sfxEnabled` + `musicEnabled` state | Already split in Phase 13; toggles already wired |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| react-router-dom | Existing | `useLocation()` for route-aware music lifecycle | Hook reads `pathname` to decide play/stop |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| HTML5 `<audio>` element | AudioBuffer via Web Audio API | AudioBuffer loads entire file into memory; overkill for 30s+ loops. `<audio>` streams and has native `loop` support |
| Route-based music control | Socket event-based control | Route change is the natural boundary; socket events would add coupling between music and game protocol |
| Howler.js | N/A | Adds 10KB dependency for functionality achievable with native `<audio>` + 20 lines of code |

**Installation:**
```bash
# No new packages needed -- HTML5 <audio> is browser-native
```

## Architecture Patterns

### Recommended Project Structure
```
client/src/
├── audio/
│   ├── audioContext.ts      # [EXISTS] Singleton AudioContext
│   ├── audioLoader.ts       # [EXISTS] loadAudio() + playBuffer()
│   ├── sfx.ts               # [EXISTS] SFX preload + play
│   └── music.ts             # [NEW] Music singleton: play, stop, isPlaying
├── hooks/
│   ├── useSocket.ts         # [EXISTS] No changes needed
│   └── useBackgroundMusic.ts # [NEW] Route-aware music lifecycle hook
├── components/
│   └── game/
│       ├── SfxToggleButton.tsx    # [REMOVE or REPLACE]
│       └── AudioControls.tsx      # [NEW] Combined SFX + Music toggles
└── public/
    └── audio/
        ├── tile-clack.mp3    # [EXISTS] SFX
        ├── test-click.mp3    # [EXISTS] Phase 13 placeholder
        └── lofi-loop.mp3     # [NEW] Background music loop
```

### Pattern 1: Music Singleton Module
**What:** A module that creates and controls a single `<audio>` element for background music. Not a React component -- a plain TypeScript module with imperative play/stop functions.
**When to use:** Called by the `useBackgroundMusic` hook. Singleton ensures only one music instance exists regardless of component mounts/unmounts.
**Example:**
```typescript
// client/src/audio/music.ts
let audio: HTMLAudioElement | null = null

function getAudio(): HTMLAudioElement {
  if (!audio) {
    audio = new Audio('/audio/lofi-loop.mp3')
    audio.loop = true
    audio.volume = 0.3  // Background music should be subtle
  }
  return audio
}

export function playMusic(): void {
  const el = getAudio()
  if (el.paused) {
    el.play().catch(() => {
      // Autoplay blocked -- will retry on next user interaction
    })
  }
}

export function stopMusic(): void {
  if (audio && !audio.paused) {
    audio.pause()
    audio.currentTime = 0
  }
}

export function pauseMusic(): void {
  if (audio && !audio.paused) {
    audio.pause()
    // Don't reset currentTime -- resume from same position
  }
}

export function isMusicPlaying(): boolean {
  return audio !== null && !audio.paused
}
```

### Pattern 2: Route-Aware Music Hook
**What:** A React hook that subscribes to route changes and `musicEnabled` state, calling play/stop on the music singleton accordingly.
**When to use:** Mounted once at the `AppRoutes` level (same place `useSocket` is mounted).
**Example:**
```typescript
// client/src/hooks/useBackgroundMusic.ts
import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { useUIStore } from '../store/uiStore'
import { playMusic, stopMusic, pauseMusic } from '../audio/music'

const MUSIC_ROUTES = ['/', '/lobby']

export function useBackgroundMusic(): void {
  const { pathname } = useLocation()
  const musicEnabled = useUIStore(s => s.musicEnabled)

  useEffect(() => {
    const shouldPlay = MUSIC_ROUTES.includes(pathname) && musicEnabled

    if (shouldPlay) {
      playMusic()
    } else if (!musicEnabled) {
      pauseMusic()  // Pause (not stop) so toggling back on resumes
    } else {
      stopMusic()   // Stop + reset when leaving music routes
    }

    return () => {
      // Cleanup not needed -- singleton persists across route changes
    }
  }, [pathname, musicEnabled])
}
```

### Pattern 3: Combined Audio Controls Component
**What:** A component with two independent toggle buttons (SFX and Music), replacing the current single `SfxToggleButton`.
**When to use:** Displayed in the game UI (bottom-left, where `SfxToggleButton` currently lives) AND on menu/lobby screens.
**Example:**
```typescript
// client/src/components/game/AudioControls.tsx
import { useUIStore } from '../../store/uiStore'

export function AudioControls() {
  const sfxEnabled = useUIStore(s => s.sfxEnabled)
  const musicEnabled = useUIStore(s => s.musicEnabled)
  const toggleSfx = useUIStore(s => s.toggleSfx)
  const toggleMusic = useUIStore(s => s.toggleMusic)

  return (
    <div className="fixed bottom-20 left-4 z-30 flex flex-col gap-2">
      <button
        onClick={toggleSfx}
        className="rounded-full shadow-lg w-10 h-10 flex items-center justify-center
          bg-black/60 hover:bg-black/80 text-white transition-colors duration-200"
        title={sfxEnabled ? 'Silenciar efectos' : 'Activar efectos'}
      >
        {sfxEnabled ? '\uD83D\uDD0A' : '\uD83D\uDD07'}
      </button>
      <button
        onClick={toggleMusic}
        className="rounded-full shadow-lg w-10 h-10 flex items-center justify-center
          bg-black/60 hover:bg-black/80 text-white transition-colors duration-200"
        title={musicEnabled ? 'Silenciar musica' : 'Activar musica'}
      >
        {musicEnabled ? '\uD83C\uDFB5' : '\uD83D\uDD15'}
      </button>
    </div>
  )
}
```

### Anti-Patterns to Avoid
- **Using AudioBuffer for music:** AudioBuffer loads the entire file into memory before playback. A 30-second loop at 128kbps is ~480KB in memory as decoded PCM. `<audio>` streams and uses far less memory.
- **Creating `<audio>` elements in React components:** Mount/unmount cycles would restart the music. Use a singleton module instead.
- **Playing music automatically without user gesture:** Browser autoplay policies block `audio.play()` without a prior user interaction. The existing autoplay unlock in `audioContext.ts` covers AudioContext but not `<audio>` elements. Music should attempt to play and gracefully handle rejection -- the first user click/tap will allow subsequent plays.
- **Using `useEffect` cleanup to stop music:** The hook mounts at `AppRoutes` level and never unmounts. Music lifecycle is driven by route + toggle state, not component lifecycle.
- **Volume slider in this phase:** CTL-03/CTL-04 (volume sliders) are explicitly listed as Future Requirements. This phase only needs on/off toggles.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Looping playback | Custom loop logic with AudioBuffer | `<audio loop>` | Native, zero code, handles edge cases (gapless loop) |
| Play/pause state tracking | Manual boolean state | `audio.paused` property | Native getter, always accurate |
| Autoplay error handling | Complex retry queue | `.play().catch(() => {})` + next user interaction retries | Browsers auto-resolve on next gesture |
| PWA caching of music file | Custom cache logic | Workbox `globPatterns` already includes `*.mp3` | Phase 13 already configured this |

**Key insight:** HTML5 `<audio>` gives us looping, pause/resume, and streaming for free. The only custom code is the route-awareness logic (~20 lines).

## Common Pitfalls

### Pitfall 1: Autoplay Policy Blocks Initial Music
**What goes wrong:** Music does not play when the user first loads the menu page.
**Why it happens:** Browsers require a user gesture (click, tap, keydown) before allowing `audio.play()`. On first page load, no gesture has occurred.
**How to avoid:** Call `playMusic()` on mount, catch the rejected promise silently. The user's first interaction (clicking "Create Room" or "Join Room") will satisfy the autoplay policy. Subscribe to the `musicEnabled` toggle change to retry playback. Alternatively, hook into the existing autoplay unlock event listeners in `audioContext.ts` to also call `playMusic()` when the gesture fires.
**Warning signs:** Music never plays on page load but plays fine after navigating away and back.

### Pitfall 2: Music Restarts on Route Change Within Music Routes
**What goes wrong:** Navigating from `/` to `/lobby` restarts the music from the beginning instead of continuing seamlessly.
**Why it happens:** If `stopMusic()` + `playMusic()` are called on every route change, the audio resets.
**How to avoid:** Only call `playMusic()` if `audio.paused` is true. The `playMusic()` function in the singleton checks `el.paused` before calling `play()`, so it's a no-op if music is already playing.
**Warning signs:** Music restarting every time you enter the lobby.

### Pitfall 3: Music Plays During Game After Toggle
**What goes wrong:** User enables music toggle while on the game screen, and music starts playing during gameplay.
**Why it happens:** The `useBackgroundMusic` hook reacts to `musicEnabled` changes. If it only checks `musicEnabled` without also checking the current route, it would play on any screen.
**How to avoid:** The hook's effect checks BOTH `pathname` (must be `/` or `/lobby`) AND `musicEnabled`. Music never plays on `/game` regardless of toggle state.
**Warning signs:** Hearing background music during active gameplay.

### Pitfall 4: Music Toggle Has No Visible Effect on Game Screen
**What goes wrong:** User sees a music toggle button on the game screen but toggling it does nothing (music is already stopped).
**Why it happens:** Music doesn't play during games, so the toggle appears broken.
**How to avoid:** Two options: (A) hide the music toggle on the game screen entirely, or (B) keep it visible so the state is set for when they return to lobby. Option B is better -- it lets the user pre-set their preference. The toggle should show the current state (on/off) even if music is not actively playing.
**Warning signs:** User confusion about whether the toggle works.

### Pitfall 5: Music File Too Large for PWA Precache
**What goes wrong:** Service worker precache takes too long or fails on slow connections.
**Why it happens:** A high-quality music file could be 2-5MB. Workbox `globPatterns` precaches ALL matching files on first load.
**How to avoid:** Keep the music file small: 30-60 second loop at 96-128kbps = 360-960KB. A 30-second loop at 96kbps is ~360KB, which is perfectly acceptable for precaching.
**Warning signs:** Slow PWA install time, large precache manifest.

## Code Examples

### Music Module (Complete)
```typescript
// client/src/audio/music.ts
let audio: HTMLAudioElement | null = null

function getAudio(): HTMLAudioElement {
  if (!audio) {
    audio = new Audio('/audio/lofi-loop.mp3')
    audio.loop = true
    audio.volume = 0.3
  }
  return audio
}

export function playMusic(): void {
  const el = getAudio()
  if (el.paused) {
    el.play().catch(() => {})
  }
}

export function stopMusic(): void {
  if (audio && !audio.paused) {
    audio.pause()
    audio.currentTime = 0
  }
}

export function pauseMusic(): void {
  if (audio && !audio.paused) {
    audio.pause()
  }
}
```

### Hook Integration in AppRoutes
```typescript
// client/src/App.tsx -- add useBackgroundMusic alongside useSocket
function AppRoutes() {
  useSocket()
  useBackgroundMusic()  // Route-aware music lifecycle

  return (
    <Routes>
      <Route path="/" element={<MenuPage />} />
      <Route path="/lobby" element={<LobbyPage />} />
      <Route path="/game" element={<GamePage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
```

### Music File Generation with ffmpeg
```bash
# Generate a simple lo-fi loop (30 seconds, low sine wave with reverb-like decay)
# This is a functional placeholder -- can be replaced with a real lo-fi track later
ffmpeg -f lavfi -i "sine=frequency=220:duration=30" \
  -af "atempo=0.8,aecho=0.8:0.88:60:0.4,lowpass=f=800,volume=0.4" \
  -b:a 96k client/public/audio/lofi-loop.mp3
```
**Note:** A real lo-fi music loop (royalty-free) from a source like Pixabay or FreeMusicArchive will sound significantly better. The ffmpeg command above is a functional placeholder only. Target file size: 300-500KB for a 30-second loop at 96kbps.

### AudioControls Placement in GameTable
```typescript
// Replace <SfxToggleButton /> with <AudioControls /> in GameTable.tsx
// The AudioControls component renders both SFX and Music toggle buttons
<AudioControls />
```

### AudioControls on Menu/Lobby Pages
```typescript
// Add AudioControls to MenuPage and LobbyPage for music control before game starts
// Position: fixed bottom-left, same as game screen
<AudioControls />
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Single `soundEnabled` toggle | Split `sfxEnabled` + `musicEnabled` | Phase 13 (this project) | Enables independent control without refactoring |
| `<audio>` with `autoplay` attribute | Programmatic `.play()` after user gesture | ~2018 (Chrome 66 autoplay policy) | Must handle rejected promises, wait for interaction |
| AudioBuffer for all audio | `<audio>` for music, AudioBuffer for SFX | Established pattern | Memory-efficient streaming for longer audio |

**Deprecated/outdated:**
- `test-click.mp3`: Phase 13 placeholder (748 bytes, silent). Can be cleaned up but is not blocking.

## Open Questions

1. **Music file source**
   - What we know: Need a royalty-free lo-fi loop, MP3 format, 30-60 seconds, ~300-500KB
   - What's unclear: Whether the user wants a real lo-fi track (from Pixabay/FreeMusicArchive) or an ffmpeg-generated placeholder
   - Recommendation: Generate a functional placeholder with ffmpeg for immediate implementation. The file is trivially swappable later -- just replace `lofi-loop.mp3` with no code changes. Phase 14 used ffmpeg-generated sounds successfully.

2. **AudioControls visibility on all screens vs game-only**
   - What we know: Current `SfxToggleButton` only appears on the game screen. Music needs a toggle on menu/lobby too.
   - What's unclear: Whether a unified `AudioControls` component should appear on ALL screens, or whether menu/lobby get a different control layout.
   - Recommendation: Use the same `AudioControls` component on all screens (fixed position, bottom-left). On the game screen it shows both SFX + Music toggles. On menu/lobby it shows only the Music toggle (SFX is irrelevant since no SFX play outside the game). Alternatively, show both on all screens for consistency.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | None (TypeScript strict mode is primary check) |
| Config file | none |
| Quick run command | `cd client && npx tsc --noEmit` |
| Full suite command | `cd client && npx tsc --noEmit && cd ../server && npx tsc --noEmit` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| MUS-01 | Lo-fi music plays on menu and lobby | manual | Navigate to `/` and `/lobby` in dev mode, confirm music is audible | N/A |
| MUS-02 | Music stops when game starts | manual | Start a game from lobby, confirm music stops on `/game` | N/A |
| CTL-01 | SFX toggle independent of music | manual | Toggle SFX off, confirm music still plays; play tile, confirm no clack | N/A |
| CTL-02 | Music toggle independent of SFX | manual | Toggle music off, confirm SFX still work; toggle music on, confirm it resumes | N/A |

### Sampling Rate
- **Per task commit:** `cd client && npx tsc --noEmit`
- **Per wave merge:** `cd client && npx tsc --noEmit && cd ../server && npx tsc --noEmit`
- **Phase gate:** TypeScript passes + manual verification of music playback and both toggles in Chrome and Safari

### Wave 0 Gaps
- [ ] `client/public/audio/lofi-loop.mp3` -- MUS-01 music file (generate or source)

## Sources

### Primary (HIGH confidence)
- Existing codebase: `audioContext.ts`, `audioLoader.ts`, `sfx.ts`, `uiStore.ts`, `useSocket.ts`, `SfxToggleButton.tsx`, `App.tsx`, `GamePage.tsx`, `MenuPage.tsx`, `LobbyPage.tsx` -- Read and analyzed for integration points
- Phase 13 CONTEXT.md -- Documents the decision to split `soundEnabled` into `sfxEnabled` + `musicEnabled`
- Phase 14 RESEARCH.md -- Documents SFX patterns and existing audio architecture
- STATE.md -- Confirms Phase 13/14 complete, all audio infrastructure in place
- MDN HTMLAudioElement -- `loop`, `pause()`, `play()`, `paused`, `currentTime` are stable APIs across all browsers

### Secondary (MEDIUM confidence)
- Browser autoplay policies -- Chrome 66+, Safari 11+, Firefox 66+ all require user gesture. `<audio>` follows same policy as `AudioContext.resume()`
- PWA precaching -- Workbox `globPatterns` already includes `mp3`, confirmed in `vite.config.ts` line 30

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- No new libraries; HTML5 `<audio>` + existing Zustand store
- Architecture: HIGH -- Route-aware hook pattern is straightforward; integration points clearly identified from codebase analysis
- Pitfalls: HIGH -- Autoplay policy handling is well-documented; route change behavior verified by reading App.tsx and useSocket.ts
- Music file sourcing: MEDIUM -- ffmpeg can generate placeholder; quality depends on user preference for real vs generated

**Research date:** 2026-03-14
**Valid until:** 2026-04-14 (no external dependencies changing; purely internal integration)

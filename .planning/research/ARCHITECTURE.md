# Architecture Patterns

**Domain:** Game audio integration -- sound effects and background music for existing domino web app
**Researched:** 2026-03-14
**Confidence:** HIGH (Web Audio API and HTMLAudioElement are stable browser APIs; patterns are well-established for game audio in React)

---

## Current Architecture Snapshot

```
[Browser]                          [Server (Express + Socket.io)]
  React 18 + Vite 5                  Express 4 serves client/dist in production
  Zustand (gameStore, roomStore,     Socket.io 4.7 on same HTTP server
    uiStore, callStore)              RoomManager (in-memory)
  Socket.io-client (ws://)           GameEngine (pure functions only)
  WebRTC peer-to-peer                No database, no auth
  useWebRTC hook
  Pages: MenuPage, LobbyPage,       Server has ZERO audio responsibility
    GamePage
```

**Key existing audio-related state:**
- `uiStore.soundEnabled: boolean` -- exists but currently unused
- `uiStore.toggleSound()` -- toggles the boolean, never actually triggers audio

**What does NOT change:**
- Server code: zero changes. Audio is 100% client-side
- GameEngine.ts: untouched
- Socket events: no new events. Sounds trigger from existing events
- gameStore, roomStore: untouched
- callStore, useWebRTC: untouched (WebRTC audio is separate from game audio)

---

## Recommended Architecture

### Core Decision: useAudio Custom Hook + AudioManager Singleton

**Use a singleton AudioManager class** instantiated once, accessed by a `useAudio` hook. Do NOT use a Zustand store for audio playback state -- audio is imperative (play/stop/fade), not declarative React state.

**Use HTMLAudioElement for background music** (simple, supports loop, volume control) and **Web Audio API (AudioContext) for sound effects** (low latency, can play overlapping sounds, no pop/click artifacts). This is the standard split for browser game audio.

**Do NOT use Howler.js or use-sound.** The app needs ~5 sound effects and 1 music track. Howler.js adds 10KB gzipped for sprite sheets, spatial audio, and codec fallbacks this app does not need. Web Audio API + HTMLAudioElement covers everything with zero dependencies.

### Architecture Diagram

```
                    uiStore (state)
                    +-----------------------+
                    | musicEnabled: boolean |  <-- persisted to localStorage
                    | sfxEnabled: boolean   |
                    +-----------------------+
                           |
                           | reads via getState()
                           v
                    AudioManager (singleton)
                    +-----------------------+
                    | audioCtx: AudioContext |  <-- created on first user gesture
                    | bgMusic: HTMLAudioElement
                    | sfxBuffers: Map<string, AudioBuffer>
                    | currentVolume: number  |
                    +-----------------------+
                       ^              ^
                      /                \
           useAudio hook            Direct calls from
           (React bridge)           useSocket handlers
           - exposes play/stop      - playSound('tilePlace')
           - manages music          - playSound('pass')
             lifecycle on           - playSound('yourTurn')
             route change
```

### Why NOT a Zustand Store for Audio

Audio playback is imperative: you call `audioBuffer.start()` or `audio.play()`. Putting "isPlaying" in a store creates synchronization problems -- the store says playing but the browser paused (tab backgrounded, autoplay blocked). The AudioManager owns playback truth. The store only owns user preferences (enabled/disabled).

### Why NOT Trigger All Sounds from Components

Socket events fire regardless of which component is mounted. `game:player_passed` fires even when the pass notification component hasn't rendered yet. The `useSocket` hook is always mounted (via `AppRoutes`) and receives every event -- it is the correct place to trigger game event sounds.

Background music, however, is route-dependent (menu/lobby yes, game no) -- that belongs in a hook that responds to route changes.

---

## Component Boundaries

| Component | Responsibility | Communicates With |
|-----------|---------------|-------------------|
| **AudioManager** (new singleton) | Manages AudioContext, preloads buffers, plays SFX, controls music | uiStore (reads preferences), browser Audio APIs |
| **useAudio** (new hook) | React bridge to AudioManager; manages music lifecycle on route changes; handles autoplay unlock | AudioManager, uiStore, React Router location |
| **uiStore** (modified) | Stores `musicEnabled` and `sfxEnabled` preferences | AudioManager reads via getState(), UI components read via selectors |
| **useSocket** (modified) | Calls `AudioManager.playSound()` in existing event handlers | AudioManager |
| **useGameActions** (modified) | Calls `AudioManager.playSound('tilePlace')` on tile emit | AudioManager |
| **AudioControls** (new UI component) | Toggle buttons for music/SFX in game HUD | uiStore |

---

## Data Flow

### Sound Effect Trigger Flow

```
Socket event arrives (e.g., game:player_passed)
  |
  v
useSocket handler fires (already exists)
  |
  +-- existing logic (addPasoNotification, etc.)
  |
  +-- NEW: audioManager.playSound('pass')
        |
        +-- checks uiStore.getState().sfxEnabled
        |   (if false, return immediately)
        |
        +-- audioCtx.createBufferSource()
        +-- source.buffer = sfxBuffers.get('pass')
        +-- source.connect(audioCtx.destination)
        +-- source.start()
```

### Background Music Lifecycle Flow

```
User lands on MenuPage
  |
  v
useAudio hook detects route = '/' or '/lobby'
  |
  +-- audioManager.startMusic()
        |
        +-- checks uiStore.getState().musicEnabled
        +-- bgMusic.play() (may need user gesture first)
        +-- bgMusic.loop = true
        +-- bgMusic.volume = 0.3
  |
User navigates to /game (game:started event)
  |
  v
useAudio hook detects route = '/game'
  |
  +-- audioManager.fadeOutMusic(1000)  // 1s fade
        +-- gradual volume reduction via requestAnimationFrame
        +-- bgMusic.pause() when volume reaches 0
  |
User returns to lobby (game ends, navigates back)
  |
  v
useAudio hook detects route = '/lobby'
  |
  +-- audioManager.fadeInMusic(1000)
```

### User Preference Flow

```
User taps SFX toggle in AudioControls
  |
  v
uiStore.toggleSfx()
  |
  +-- sfxEnabled flips to false
  +-- localStorage.setItem('sfxEnabled', 'false')
  |
  v
Next playSound() call:
  audioManager.playSound('tilePlace')
    +-- reads uiStore.getState().sfxEnabled === false
    +-- returns immediately, no sound
```

---

## Integration Points: Existing Code Changes

### 1. uiStore.ts -- Replace `soundEnabled` with Two Toggles

```typescript
// REMOVE
soundEnabled: boolean
toggleSound: () => void

// ADD
musicEnabled: boolean
sfxEnabled: boolean
toggleMusic: () => void
toggleSfx: () => void
setMusicEnabled: (v: boolean) => void
setSfxEnabled: (v: boolean) => void
```

Initialize from localStorage with defaults:
```typescript
musicEnabled: localStorage.getItem('musicEnabled') !== 'false',  // default true
sfxEnabled: localStorage.getItem('sfxEnabled') !== 'false',      // default true
```

Persist on change:
```typescript
toggleMusic: () => set(state => {
  const next = !state.musicEnabled
  localStorage.setItem('musicEnabled', String(next))
  return { musicEnabled: next }
}),
toggleSfx: () => set(state => {
  const next = !state.sfxEnabled
  localStorage.setItem('sfxEnabled', String(next))
  return { sfxEnabled: next }
}),
```

### 2. useSocket.ts -- Add Sound Triggers to Existing Handlers

Add to existing handlers (NOT new event listeners):

| Existing Handler | Add Sound Call |
|-----------------|----------------|
| `game:state_snapshot` (when `lastAction?.type === 'play_tile'`) | `audioManager.playSound('tilePlace')` |
| `game:state_snapshot` (when `gameState.isMyTurn` becomes true) | `audioManager.playSound('yourTurn')` |
| `game:player_passed` | `audioManager.playSound('pass')` |
| `game:round_ended` | `audioManager.playSound('roundEnd')` |
| `game:game_ended` | `audioManager.playSound('gameEnd')` |
| `game:started` | `audioManager.playSound('gameStart')` |

**Critical: isMyTurn detection.** The `game:state_snapshot` handler receives every state update. To play "your turn" sound only when it becomes your turn (not on every snapshot), compare previous and current `isMyTurn`:

```typescript
// Inside game:state_snapshot handler
const wasMyTurn = useGameStore.getState().gameState?.isMyTurn ?? false
setGameState(gameState)  // existing
if (!wasMyTurn && gameState.isMyTurn) {
  audioManager.playSound('yourTurn')
}
```

### 3. useGameActions.ts -- Optional: Tile Place Sound on Emit

For immediate audio feedback (before server confirms), play tile sound on emit:

```typescript
// In selectTile, when emitting game:play_tile:
socket.emit('game:play_tile', { roomCode, tileId, targetEnd: 'right' })
audioManager.playSound('tilePlace')  // instant feedback
```

**Trade-off:** Playing on emit gives instant feedback but the play might be rejected by server. Playing on `game:state_snapshot` is authoritative but has network latency. **Recommendation: play on emit** -- server rejections are rare (client only shows valid plays), and the latency improvement matters more for game feel.

If playing on emit, do NOT also play on `game:state_snapshot` for the local player's own tile plays. Detect by checking if the `lastAction.playerIndex` matches `myPlayerIndex`.

### 4. App.tsx -- Mount useAudio Hook

```typescript
function AppRoutes() {
  useSocket()   // existing
  useAudio()    // NEW: manages music lifecycle, preloads sounds

  return (
    <Routes>...</Routes>
  )
}
```

### 5. vite.config.ts -- Add Audio File Types to PWA Cache

```typescript
globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2,mp3,ogg}'],
```

Add `mp3` and `ogg` to the service worker precache glob so audio files are cached for offline-capable fast loading.

---

## New Files

| File | Purpose |
|------|---------|
| `client/src/audio/AudioManager.ts` | Singleton class: AudioContext, buffer loading, SFX playback, music control |
| `client/src/hooks/useAudio.ts` | React hook: preload on mount, music lifecycle on route, autoplay unlock |
| `client/src/components/ui/AudioControls.tsx` | Toggle buttons for music and SFX |
| `client/public/sounds/tile-place.mp3` | Tile clack sound (~50KB) |
| `client/public/sounds/your-turn.mp3` | Subtle notification chime (~30KB) |
| `client/public/sounds/pass.mp3` | Soft knock or buzz (~30KB) |
| `client/public/sounds/round-end.mp3` | Completion jingle (~50KB) |
| `client/public/sounds/game-end.mp3` | Victory/defeat sound (~80KB) |
| `client/public/sounds/bg-music.mp3` | Lo-fi loop (~500KB-1MB, 30-60s loop) |

---

## Patterns to Follow

### Pattern 1: AudioContext Creation on First User Gesture

**What:** Create AudioContext inside a click/touch handler, not on page load.
**Why:** All modern browsers (Chrome, Safari, Firefox) block AudioContext creation or suspend it until a user gesture. Creating on load results in a suspended context that silently fails.
**How:**
```typescript
class AudioManager {
  private ctx: AudioContext | null = null

  private ensureContext(): AudioContext {
    if (!this.ctx) {
      this.ctx = new AudioContext()
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume()
    }
    return this.ctx
  }
}
```
Call `ensureContext()` inside every `playSound()`. The first call that happens after a user gesture (clicking a tile, pressing start) will create/resume the context.

### Pattern 2: Preload Audio Buffers via fetch + decodeAudioData

**What:** Fetch audio files and decode to AudioBuffer at app startup.
**Why:** Web Audio API plays from pre-decoded buffers with <1ms latency. HTMLAudioElement has decode latency on first play.
**How:**
```typescript
async preloadSounds(sounds: Record<string, string>) {
  const ctx = this.ensureContext()
  for (const [name, url] of Object.entries(sounds)) {
    const response = await fetch(url)
    const arrayBuffer = await response.arrayBuffer()
    const audioBuffer = await ctx.decodeAudioData(arrayBuffer)
    this.sfxBuffers.set(name, audioBuffer)
  }
}
```
Call from `useAudio` hook's `useEffect` on mount. Non-blocking -- sounds that aren't loaded yet simply don't play.

### Pattern 3: HTMLAudioElement for Background Music (Not Web Audio API)

**What:** Use `new Audio('/sounds/bg-music.mp3')` for background music.
**Why:** HTMLAudioElement handles streaming (doesn't need full download before play), has built-in `loop` property, and doesn't require buffer management. Web Audio API would require loading the entire file into memory and manually implementing looping with `AudioBufferSourceNode`.
**How:**
```typescript
private bgMusic = new Audio('/sounds/bg-music.mp3')

constructor() {
  this.bgMusic.loop = true
  this.bgMusic.volume = 0.3
}
```

### Pattern 4: Read Store State Imperatively, Not Reactively

**What:** AudioManager reads `uiStore.getState().sfxEnabled` at call time.
**Why:** AudioManager is not a React component. Subscribing to store changes to "pause when disabled" adds complexity. Checking the flag at play time is simpler and correct.
```typescript
playSound(name: string) {
  if (!useUIStore.getState().sfxEnabled) return
  // ... play
}
```

### Pattern 5: Fade Music with requestAnimationFrame

**What:** Smooth volume transitions on route change.
**Why:** Abrupt stop/start of background music is jarring.
```typescript
fadeOut(durationMs = 1000) {
  const start = this.bgMusic.volume
  const startTime = performance.now()
  const step = () => {
    const elapsed = performance.now() - startTime
    const progress = Math.min(elapsed / durationMs, 1)
    this.bgMusic.volume = start * (1 - progress)
    if (progress < 1) requestAnimationFrame(step)
    else this.bgMusic.pause()
  }
  requestAnimationFrame(step)
}
```

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Creating AudioContext on Page Load

**What:** `const ctx = new AudioContext()` at module level or in component body.
**Why bad:** Context starts suspended. First `playSound()` call silently fails. Chrome DevTools shows "AudioContext was not allowed to start."
**Instead:** Lazy-create in `ensureContext()`, resume on each use.

### Anti-Pattern 2: Zustand Store for Audio Playback State

**What:** Store `isPlaying`, `currentTrack`, etc. in Zustand.
**Why bad:** Audio state lives in browser APIs. Zustand mirror goes stale when browser pauses audio (tab switch, autoplay block). Creates two sources of truth.
**Instead:** AudioManager singleton owns playback truth. Store owns only user preferences (`musicEnabled`, `sfxEnabled`).

### Anti-Pattern 3: Playing Sounds in React Component Render Cycle

**What:** `useEffect(() => { playSound() }, [gameState.isMyTurn])`
**Why bad:** useEffect fires after render. Sound lags behind visual by one frame. Also, strict mode double-fires cause double sounds in development.
**Instead:** Play sounds in event handlers (useSocket callbacks, useGameActions emit handlers) where the trigger is synchronous and unambiguous.

### Anti-Pattern 4: Creating New Audio() on Every Play

**What:** `new Audio('/sounds/tile.mp3').play()` each time.
**Why bad:** Each call allocates a new HTMLAudioElement, fetches the file (or hits cache), decodes it. Adds ~50-100ms latency. Memory leak if elements accumulate.
**Instead:** Preloaded AudioBuffers via Web Audio API. One `createBufferSource()` per play is cheap (<1ms).

### Anti-Pattern 5: One Big Sound Toggle

**What:** Keep existing `soundEnabled` for both music and SFX.
**Why bad:** Users commonly want SFX (game feedback) but not music, or vice versa. A single toggle forces all-or-nothing.
**Instead:** Separate `musicEnabled` and `sfxEnabled`. Both default to true.

### Anti-Pattern 6: Importing AudioManager in Every Component

**What:** `import { audioManager } from '../audio/AudioManager'` in 10 files.
**Why bad:** Scattered audio calls become hard to audit. If a sound name changes, grep 10 files.
**Instead:** Centralize SFX triggers in useSocket (event-driven) and useGameActions (user actions). Only useAudio and these two hooks import AudioManager.

---

## Critical: Browser Autoplay Policy

Every major browser blocks audio before a user gesture:

| Browser | Policy |
|---------|--------|
| Chrome/Edge | AudioContext starts suspended. HTMLAudioElement.play() returns rejected promise. |
| Safari | Stricter. Even after gesture, audio may require same-origin or user-initiated event chain. |
| Firefox | AudioContext suspended until user gesture in the page. |

**Solution for this app:**

The user always clicks before any audio plays:
1. MenuPage: user clicks "Crear Sala" or "Unirse" -- this is the first gesture
2. Background music starts on LobbyPage (user already interacted on MenuPage)
3. Sound effects play during game (user clicked to start game)

The `useAudio` hook should attempt `audioCtx.resume()` and `bgMusic.play()` on the first user interaction. Wire a one-time click listener on `document` that calls `audioManager.unlock()`:

```typescript
useEffect(() => {
  const unlock = () => {
    audioManager.unlock()
    document.removeEventListener('click', unlock)
    document.removeEventListener('touchstart', unlock)
  }
  document.addEventListener('click', unlock)
  document.addEventListener('touchstart', unlock)
  return () => {
    document.removeEventListener('click', unlock)
    document.removeEventListener('touchstart', unlock)
  }
}, [])
```

---

## AudioManager Class Design

```typescript
class AudioManager {
  private ctx: AudioContext | null = null
  private sfxBuffers = new Map<string, AudioBuffer>()
  private bgMusic: HTMLAudioElement
  private unlocked = false

  constructor() {
    this.bgMusic = new Audio()
    this.bgMusic.loop = true
    this.bgMusic.volume = 0.3
  }

  unlock() {
    if (this.unlocked) return
    this.ensureContext()
    this.ctx?.resume()
    this.unlocked = true
  }

  private ensureContext(): AudioContext {
    if (!this.ctx) this.ctx = new AudioContext()
    if (this.ctx.state === 'suspended') this.ctx.resume()
    return this.ctx
  }

  async preload(sounds: Record<string, string>) {
    const ctx = this.ensureContext()
    const entries = Object.entries(sounds)
    await Promise.all(entries.map(async ([name, url]) => {
      try {
        const resp = await fetch(url)
        const buf = await resp.arrayBuffer()
        const decoded = await ctx.decodeAudioData(buf)
        this.sfxBuffers.set(name, decoded)
      } catch (e) {
        console.warn(`Failed to preload sound: ${name}`, e)
      }
    }))
  }

  playSound(name: string) {
    if (!useUIStore.getState().sfxEnabled) return
    const buffer = this.sfxBuffers.get(name)
    if (!buffer || !this.ctx) return
    const source = this.ctx.createBufferSource()
    source.buffer = buffer
    source.connect(this.ctx.destination)
    source.start()
  }

  startMusic() {
    if (!useUIStore.getState().musicEnabled) return
    this.bgMusic.src = '/sounds/bg-music.mp3'
    this.bgMusic.play().catch(() => {})  // swallow autoplay rejection
  }

  stopMusic() { /* fade out then pause */ }
  fadeOut(ms: number) { /* rAF volume ramp */ }
  fadeIn(ms: number) { /* rAF volume ramp */ }

  setMusicEnabled(enabled: boolean) {
    if (enabled) this.startMusic()
    else { this.bgMusic.pause(); this.bgMusic.currentTime = 0 }
  }
}

export const audioManager = new AudioManager()
```

---

## useAudio Hook Design

```typescript
export function useAudio() {
  const location = useLocation()
  const musicEnabled = useUIStore(s => s.musicEnabled)

  // One-time: preload SFX buffers + register autoplay unlock
  useEffect(() => {
    audioManager.preload({
      tilePlace: '/sounds/tile-place.mp3',
      yourTurn: '/sounds/your-turn.mp3',
      pass: '/sounds/pass.mp3',
      roundEnd: '/sounds/round-end.mp3',
      gameEnd: '/sounds/game-end.mp3',
      gameStart: '/sounds/game-start.mp3',
    })

    const unlock = () => {
      audioManager.unlock()
      document.removeEventListener('click', unlock)
      document.removeEventListener('touchstart', unlock)
    }
    document.addEventListener('click', unlock)
    document.addEventListener('touchstart', unlock)
    return () => {
      document.removeEventListener('click', unlock)
      document.removeEventListener('touchstart', unlock)
    }
  }, [])

  // Music lifecycle: play on menu/lobby, fade out on game
  useEffect(() => {
    const isGamePage = location.pathname === '/game'
    if (isGamePage) {
      audioManager.fadeOut(1000)
    } else if (musicEnabled) {
      audioManager.fadeIn(1000)
    }
  }, [location.pathname, musicEnabled])

  // React to musicEnabled toggle
  useEffect(() => {
    audioManager.setMusicEnabled(musicEnabled)
  }, [musicEnabled])
}
```

---

## PWA / Service Worker Considerations

Audio files in `client/public/sounds/` will be precached by the service worker if `globPatterns` includes `mp3`. This is desirable: cached audio loads instantly on repeat visits.

**Total audio budget estimate:** ~800KB-1.2MB (5 short SFX + 1 music loop). Acceptable for precaching. Service worker cache is typically 50MB+.

**Modify vite.config.ts:**
```typescript
globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2,mp3,ogg}'],
```

---

## Build Order (Dependency-Aware)

### Phase 1: AudioManager + uiStore Changes

1. Split `soundEnabled` into `musicEnabled` + `sfxEnabled` in uiStore with localStorage persistence
2. Create `AudioManager.ts` singleton with Web Audio API SFX + HTMLAudioElement music
3. Remove old `soundEnabled` / `toggleSound` from uiStore
4. Update any existing UI that reads `soundEnabled` (find and replace)

**Why first:** Foundation layer. Everything depends on AudioManager existing and preferences being stored correctly.

### Phase 2: useAudio Hook + Autoplay Unlock

1. Create `useAudio.ts` hook with preloading, autoplay unlock, and music lifecycle
2. Mount in `App.tsx` (AppRoutes)
3. Add placeholder audio files for testing (can use generated tones)
4. Test: music plays on menu, fades on game start, resumes on lobby return
5. Test: autoplay works after first click on Chrome, Safari, Firefox

**Why second:** Establishes the music lifecycle and preloading. Proves the autoplay strategy works before wiring up game events.

### Phase 3: SFX Triggers in useSocket + useGameActions

1. Add `audioManager.playSound()` calls to useSocket event handlers
2. Add tile place sound to useGameActions emit path
3. Handle "your turn" detection (wasMyTurn vs isMyTurn comparison)
4. Avoid double-play for local player's own tile (emit plays it, skip on snapshot)
5. Test: play full game, verify each event triggers correct sound

**Why third:** Depends on AudioManager (Phase 1) and preloaded buffers (Phase 2).

### Phase 4: Audio Controls UI + Final Audio Files

1. Create AudioControls component (two toggle buttons: music, SFX)
2. Place in GamePage HUD (near existing controls) and optionally in menu
3. Source or create final audio files (tile clack, turn chime, pass knock, etc.)
4. Polish: adjust volumes, timing, fade durations
5. Test on mobile: iOS Safari autoplay, Android Chrome background tab behavior

**Why last:** UI polish and final assets. Core functionality works without pretty toggle buttons.

### Dependency Graph

```
Phase 1: AudioManager + uiStore ──> Phase 2: useAudio hook
                                        |
                                        v
                                    Phase 3: SFX triggers in useSocket
                                        |
                                        v
                                    Phase 4: Audio controls UI + polish
```

Strictly sequential. Each phase builds on the previous.

---

## Integration Points Summary

| Change | Touches | Does NOT Touch |
|--------|---------|----------------|
| uiStore split | `uiStore.ts` (modify: replace soundEnabled with 2 booleans + localStorage) | gameStore, roomStore, callStore |
| AudioManager | New file `audio/AudioManager.ts` | Server code, stores, any existing component |
| useAudio hook | New file `hooks/useAudio.ts`, modify `App.tsx` (add hook call) | useSocket, useGameActions, useWebRTC |
| SFX triggers | `useSocket.ts` (add ~6 playSound calls in existing handlers), `useGameActions.ts` (add 1 playSound call) | Server events, GameEngine, any component |
| Audio controls | New file `components/ui/AudioControls.tsx`, modify `GamePage.tsx` or `GameTable.tsx` (mount component) | Game logic, socket events |
| Audio files | New files in `client/public/sounds/` | Code (just static assets) |
| PWA cache | `vite.config.ts` (add mp3 to globPatterns) | Service worker logic, socket denylist |

**Server-side changes: zero.**
**New socket events: zero.**
**New Zustand stores: zero.**
**Existing store modifications: uiStore only (replace 1 boolean with 2).**

---

## Scalability Considerations

| Concern | Current App | With Audio |
|---------|-------------|------------|
| Bundle size | ~2MB shell | +800KB-1.2MB audio assets (precached by SW) |
| Memory | Minimal | +~2MB for decoded AudioBuffers (5 short clips) |
| CPU | Negligible | Web Audio API SFX is trivial; no concern |
| Mobile battery | N/A | HTMLAudioElement music loop is hardware-decoded; low impact |
| Network on first load | ~2MB | +1MB; consider lazy-loading music file after SFX preloaded |

**Optimization if needed:** Lazy-load `bg-music.mp3` only when entering lobby (not on preload). SFX files are small enough to preload eagerly.

---

## Sources

- Codebase: `client/src/store/uiStore.ts` -- existing `soundEnabled` boolean (line 23), `toggleSound` (line 39)
- Codebase: `client/src/hooks/useSocket.ts` -- all event handlers where sounds should trigger
- Codebase: `client/src/hooks/useGameActions.ts` -- `selectTile` and `playTileOnEnd` emit points
- Codebase: `client/src/App.tsx` -- `AppRoutes` where useSocket is mounted (line 8)
- Codebase: `client/src/pages/GamePage.tsx` -- current component tree
- Codebase: `client/src/pages/MenuPage.tsx` -- first user interaction point
- Codebase: `client/src/pages/LobbyPage.tsx` -- music should play here
- Codebase: `client/vite.config.ts` -- PWA globPatterns (line 31)
- Codebase: `.planning/PROJECT.md` -- v1.2 milestone scope
- Training data: Web Audio API (AudioContext, AudioBuffer, AudioBufferSourceNode) -- HIGH confidence, stable W3C spec since 2018
- Training data: HTMLAudioElement loop/volume/play -- HIGH confidence, basic DOM API
- Training data: Browser autoplay policies (Chrome, Safari, Firefox) -- HIGH confidence, well-documented restrictions
- Training data: requestAnimationFrame for volume fading -- HIGH confidence, standard technique

---
*Architecture analysis completed: 2026-03-14*

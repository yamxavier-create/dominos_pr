# Phase 14: Game Sound Effects - Research

**Researched:** 2026-03-14
**Domain:** Web Audio API SFX playback, audio asset sourcing, Socket.io event-driven sound triggers
**Confidence:** HIGH

## Summary

Phase 14 adds three distinct sound effects to gameplay: tile placement clack, turn notification, and pass sound. The audio infrastructure (AudioContext singleton, autoplay unlock, buffer loading, PWA caching) is already complete from Phase 13. The existing `audioLoader.ts` provides `loadAudio()` and `playBuffer()` functions ready for consumption. The `uiStore` already has `sfxEnabled` toggle. This phase is purely about: (1) sourcing/creating three MP3 files, (2) preloading them at game start, and (3) triggering playback at the right moments in the existing socket event handlers.

The key architectural decision is WHERE to trigger sounds. Three socket events map directly to the three SFX: `game:state_snapshot` with `lastAction.type === 'play_tile'` for tile placement, `game:state_snapshot` where `isMyTurn` transitions to `true` for turn notification, and `game:player_passed` for pass sounds. All three are already handled in `useSocket.ts`. The pass sound needs debouncing because `processAutoPassCascade()` on the server can emit multiple `game:player_passed` events in rapid succession (up to 3 consecutive passes in a 4-player game).

**Primary recommendation:** Create a `useSoundEffects` hook that subscribes to Zustand store changes and socket events, calling `playBuffer()` from the existing `audioLoader.ts`. Preload all three AudioBuffers when entering the game route. Debounce pass sounds with a 300ms window to collapse rapid auto-pass cascades into a single sound.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| SFX-01 | User hears a clack sound when any player plays a tile on the board | Trigger on `game:state_snapshot` with `lastAction.type === 'play_tile'`; existing handler already detects this condition (line 93 of useSocket.ts) |
| SFX-02 | User hears a notification sound when it becomes their turn to play | Detect `isMyTurn` transition from false to true in `game:state_snapshot` handler; compare previous and new `gameState.isMyTurn` |
| SFX-03 | User hears a distinct sound when a player passes | Trigger on `game:player_passed` socket event; debounce rapid auto-pass cascades (server emits these synchronously in a loop) |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Web Audio API | Browser-native | AudioBuffer playback via `playBuffer()` | Already implemented in Phase 13 `audioLoader.ts` |
| audioContext.ts | Phase 13 | Shared AudioContext singleton with autoplay unlock | Already in codebase at `client/src/audio/audioContext.ts` |
| audioLoader.ts | Phase 13 | `loadAudio()` + `playBuffer()` with buffer cache | Already in codebase at `client/src/audio/audioLoader.ts` |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| zustand | existing | `sfxEnabled` gate from `uiStore` | Check before every `playBuffer()` call |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Custom hook for sound triggers | howler.js | Unnecessary -- Phase 13 already built equivalent functionality with raw Web Audio API |
| Sourcing real audio files | Web Audio API oscillator-generated sounds | Oscillators sound synthetic; real MP3 clips give better UX for <50KB total |

**Installation:**
```bash
# No new packages needed -- all infrastructure from Phase 13
```

## Architecture Patterns

### Recommended Project Structure
```
client/src/
├── audio/
│   ├── audioContext.ts      # [EXISTS] Singleton AudioContext
│   ├── audioLoader.ts       # [EXISTS] loadAudio() + playBuffer()
│   └── sfx.ts               # [NEW] SFX constants, preload function, play helpers
├── hooks/
│   ├── useSocket.ts          # [MODIFY] Add sound trigger calls
│   └── useSoundEffects.ts    # [NEW] Preload sounds on game entry, expose play functions
└── public/
    └── audio/
        ├── test-click.mp3    # [EXISTS] Phase 13 placeholder
        ├── tile-clack.mp3    # [NEW] SFX-01 tile placement sound
        ├── turn-notify.mp3   # [NEW] SFX-02 turn notification sound
        └── pass.mp3          # [NEW] SFX-03 pass sound
```

### Pattern 1: SFX Module with Preloading
**What:** A module that defines sound URLs, preloads all buffers into the existing cache, and exports typed play functions.
**When to use:** Called once when entering the game screen; play functions called from socket event handlers.
**Example:**
```typescript
// client/src/audio/sfx.ts
import { loadAudio, playBuffer } from './audioLoader'
import { useUIStore } from '../store/uiStore'

const SFX_URLS = {
  tileClack: '/audio/tile-clack.mp3',
  turnNotify: '/audio/turn-notify.mp3',
  pass: '/audio/pass.mp3',
} as const

const buffers: Partial<Record<keyof typeof SFX_URLS, AudioBuffer>> = {}

export async function preloadSfx(): Promise<void> {
  const entries = Object.entries(SFX_URLS) as [keyof typeof SFX_URLS, string][]
  await Promise.all(
    entries.map(async ([key, url]) => {
      buffers[key] = await loadAudio(url)
    })
  )
}

export function playSfx(name: keyof typeof SFX_URLS, volume?: number): void {
  if (!useUIStore.getState().sfxEnabled) return
  const buffer = buffers[name]
  if (buffer) playBuffer(buffer, volume)
}
```

### Pattern 2: Sound Triggers in useSocket
**What:** Add `playSfx()` calls directly in the existing `useSocket.ts` event handlers where the game events are already processed.
**When to use:** This is the simplest integration point -- sounds fire in the same handler that updates state.
**Example:**
```typescript
// In useSocket.ts game:state_snapshot handler:
socket.on('game:state_snapshot', ({ gameState, lastAction }) => {
  const prevIsMyTurn = useGameStore.getState().gameState?.isMyTurn ?? false

  setGameState(gameState)
  // ... existing logic ...

  // SFX-01: Tile placement clack
  if (lastAction?.type === 'play_tile') {
    playSfx('tileClack')
  }

  // SFX-02: Turn notification (my turn just started)
  if (gameState.isMyTurn && !prevIsMyTurn) {
    playSfx('turnNotify')
  }
})

// In game:player_passed handler:
socket.on('game:player_passed', (payload) => {
  addPasoNotification(payload)
  // SFX-03: Pass sound (debounced)
  playPassSfx()
  // ... existing timeout logic ...
})
```

### Pattern 3: Pass Sound Debouncing
**What:** Collapse rapid auto-pass events into a single sound. The server's `processAutoPassCascade()` emits `game:player_passed` synchronously in a loop, so multiple events arrive in quick succession.
**When to use:** Always for pass sounds. Without debouncing, 3 consecutive auto-passes would play 3 overlapping sounds instantly.
**Example:**
```typescript
// Simple debounce for pass sound
let passDebounceTimer: ReturnType<typeof setTimeout> | null = null

function playPassSfx(): void {
  if (passDebounceTimer) return  // Already scheduled
  passDebounceTimer = setTimeout(() => {
    passDebounceTimer = null
  }, 300)
  playSfx('pass')
}
```
**Note:** The debounce uses a "leading edge" pattern -- play the FIRST pass sound immediately, then suppress subsequent ones within 300ms. This feels more responsive than waiting 300ms to confirm no more passes are coming.

### Anti-Patterns to Avoid
- **Playing sounds in React render/useEffect with state deps:** Sound triggers belong in socket event handlers, not in effects that react to store changes. Effects would double-fire on StrictMode and have timing issues.
- **Creating new AudioBufferSourceNodes without playing:** Each `createBufferSource()` is lightweight but still allocatable. Only create when actually playing.
- **Awaiting loadAudio in event handlers:** Preload at game entry; event handlers should be synchronous `playBuffer()` calls for zero-latency playback.
- **Playing turn notification on initial game start:** When `game:started` fires, `isMyTurn` may be true for the starting player, but this is not a "turn change" -- don't play the notification sound. Only play when `isMyTurn` transitions from false to true within `game:state_snapshot`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Audio playback | Custom AudioBuffer management | `loadAudio()` + `playBuffer()` from Phase 13 | Already built, handles buffer caching and gain nodes |
| Autoplay unlock | Per-sound unlock logic | Phase 13 `audioContext.ts` handles it globally | One-time gesture listener already registered |
| SFX toggle | Custom toggle system | `uiStore.sfxEnabled` from Phase 13 | Already in Zustand store with toggle action |
| Audio file caching | Custom service worker logic | Workbox precache (already configured for mp3) | Phase 13 added mp3 to globPatterns |

**Key insight:** Phase 13 built all the infrastructure. Phase 14 is purely integration -- sourcing 3 audio files and adding 3 `playSfx()` calls to existing event handlers.

## Common Pitfalls

### Pitfall 1: Turn Sound on Game Start
**What goes wrong:** Turn notification plays when the game first starts for the player who has the first move.
**Why it happens:** `game:started` sets `gameState` with `isMyTurn: true` for the starting player. If sound logic checks `isMyTurn` without tracking previous state, it fires.
**How to avoid:** Only trigger turn sound in `game:state_snapshot` handler (not `game:started`). Track `prevIsMyTurn` by reading current store state BEFORE calling `setGameState()`.
**Warning signs:** Hearing the notification sound at the very start of every game.

### Pitfall 2: Overlapping Pass Sounds from Auto-Pass Cascade
**What goes wrong:** 2-3 identical sounds play simultaneously, creating a loud distorted mess.
**Why it happens:** Server `processAutoPassCascade()` emits `game:player_passed` for each auto-passed player synchronously. Socket.io delivers them as separate events in rapid succession.
**How to avoid:** Leading-edge debounce: play the first one immediately, suppress subsequent ones within 300ms.
**Warning signs:** Loud/distorted pass sound when multiple players pass in sequence.

### Pitfall 3: Sounds Not Playing on Mobile Safari After Tab Switch
**What goes wrong:** Returning to the tab after backgrounding produces no sounds.
**Why it happens:** Mobile Safari suspends `AudioContext` when the page is backgrounded. The autoplay unlock listeners may have already been removed.
**How to avoid:** The existing `playBuffer()` in `audioLoader.ts` already calls `ctx.resume()` as a safety net before playing. This handles the re-suspension case. No additional work needed.
**Warning signs:** Sounds work, stop after switching tabs, then work again after a tap.

### Pitfall 4: Turn Sound Fires on Opponent Tile Plays
**What goes wrong:** Turn notification plays when it is NOT the user's turn.
**Why it happens:** Every `game:state_snapshot` triggers state update. If the `isMyTurn` check doesn't compare previous state, it could fire incorrectly.
**How to avoid:** Capture `prevIsMyTurn` from current store state BEFORE the `setGameState()` call. Only play when `!prevIsMyTurn && gameState.isMyTurn`.
**Warning signs:** Notification sound playing when opponents play tiles.

### Pitfall 5: Audio Files Not Found in Production
**What goes wrong:** `loadAudio()` fetch returns 404 in production build.
**Why it happens:** Files in `public/audio/` must exist at build time. The placeholder `test-click.mp3` is there but the 3 new files are not yet.
**How to avoid:** Place MP3 files in `client/public/audio/` before building. Verify they appear in `client/dist/audio/` after build.
**Warning signs:** Console errors on game screen load; silent gameplay.

## Code Examples

### Audio File Creation with ffmpeg (if sourcing from scratch)
```bash
# Generate a short click/clack sound (white noise burst, 0.1s)
ffmpeg -f lavfi -i "anoisesrc=d=0.1:c=white:r=44100:a=0.5" \
  -af "afade=t=out:st=0.05:d=0.05" -b:a 64k client/public/audio/tile-clack.mp3

# Generate a notification chime (sine wave, 0.3s)
ffmpeg -f lavfi -i "sine=frequency=880:duration=0.15" \
  -f lavfi -i "sine=frequency=1320:duration=0.15" \
  -filter_complex "[0][1]concat=n=2:v=0:a=1,afade=t=out:st=0.2:d=0.1" \
  -b:a 64k client/public/audio/turn-notify.mp3

# Generate a pass/thud sound (low tone, 0.15s)
ffmpeg -f lavfi -i "sine=frequency=220:duration=0.15" \
  -af "afade=t=in:d=0.02,afade=t=out:st=0.08:d=0.07" \
  -b:a 64k client/public/audio/pass.mp3
```
**Note:** ffmpeg-generated sounds are functional placeholders. Real sounds can be swapped later by replacing the MP3 files -- no code changes needed.

### Complete Integration in useSocket.ts
```typescript
// At top of useSocket.ts:
import { playSfx } from '../audio/sfx'

// In game:state_snapshot handler, BEFORE setGameState():
const prevIsMyTurn = useGameStore.getState().gameState?.isMyTurn ?? false

// After setGameState(), alongside existing lastAction check:
if (lastAction?.type === 'play_tile') {
  playSfx('tileClack')
}
if (gameState.isMyTurn && !prevIsMyTurn) {
  playSfx('turnNotify')
}

// In game:player_passed handler, after addPasoNotification():
playPassSfx()  // debounced wrapper around playSfx('pass')
```

### Preloading in Game Page
```typescript
// Call preloadSfx() when entering game route
// Could be in a useEffect in GamePage or in the game:started handler
import { preloadSfx } from '../audio/sfx'

// In game:started handler of useSocket.ts:
socket.on('game:started', ({ gameState }) => {
  // ... existing logic ...
  preloadSfx()  // Non-blocking; buffers cached for subsequent plays
})
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| HTML5 `<audio>` for all sounds | `AudioBuffer` + `createBufferSource()` for SFX | Stable pattern since ~2018 | Sub-5ms latency for short clips vs 50-100ms with `<audio>` |
| Inline audio data URIs | Separate MP3 files in `public/` with workbox precaching | Project convention from Phase 13 | Clean separation, PWA offline support, easy file replacement |

**Deprecated/outdated:**
- `test-click.mp3`: Phase 13 placeholder (748 bytes, silent). Should be replaced or left alongside the real SFX files.

## Open Questions

1. **Audio file quality vs. generated sounds**
   - What we know: ffmpeg can generate functional placeholder sounds. Real sounds from royalty-free libraries would sound better.
   - What's unclear: Whether the user prefers polished sounds now or functional placeholders that can be swapped later.
   - Recommendation: Start with ffmpeg-generated sounds (zero-cost, instant). Files can be replaced later without code changes. Keep files small (<50KB each).

2. **Turn sound for the first player in a new hand**
   - What we know: After `game:next_hand`, the server sends `game:state_snapshot` with the new hand's starting player having `isMyTurn: true`. The previous state before that snapshot would have `isMyTurn` depending on who played last.
   - What's unclear: Whether the turn notification should play when a new hand starts for the starting player.
   - Recommendation: Yes, it should. The `isMyTurn` transition check (`false -> true`) naturally handles this -- after `game:round_ended`, the phase changes and `isMyTurn` resets. When the new hand snapshot arrives, the starting player gets a valid transition.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | None (TypeScript strict mode is primary check) |
| Config file | none |
| Quick run command | `cd client && npx tsc --noEmit` |
| Full suite command | `cd client && npx tsc --noEmit && cd ../server && npx tsc --noEmit` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SFX-01 | Clack plays on tile placement | manual | Play a tile in dev mode, listen for clack sound | N/A |
| SFX-02 | Notification plays on turn start | manual | Have opponent play a tile, listen for notification when it becomes your turn | N/A |
| SFX-03 | Pass sound plays on pass (debounced) | manual | Create a position where auto-pass cascade occurs, verify single pass sound | N/A |

### Sampling Rate
- **Per task commit:** `cd client && npx tsc --noEmit`
- **Per wave merge:** `cd client && npx tsc --noEmit && cd ../server && npx tsc --noEmit`
- **Phase gate:** TypeScript passes + manual verification of all 3 SFX in Chrome and Safari

### Wave 0 Gaps
- [ ] `client/public/audio/tile-clack.mp3` -- SFX-01 audio file
- [ ] `client/public/audio/turn-notify.mp3` -- SFX-02 audio file
- [ ] `client/public/audio/pass.mp3` -- SFX-03 audio file

## Sources

### Primary (HIGH confidence)
- Phase 13 Research (`13-RESEARCH.md`) -- Established all audio patterns, singleton, autoplay unlock
- Existing codebase: `audioContext.ts`, `audioLoader.ts`, `uiStore.ts`, `useSocket.ts` -- Read and analyzed for integration points
- MDN Web Audio API: AudioBufferSourceNode reuse patterns, `createBufferSource()` is single-use by spec

### Secondary (MEDIUM confidence)
- ffmpeg audio generation commands -- Standard ffmpeg lavfi filters for synthesizing short audio clips
- Socket.io event delivery ordering -- Events emitted in a synchronous server loop arrive in order but with near-zero gap, confirmed by reading `processAutoPassCascade()` implementation

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- No new libraries; consuming Phase 13 infrastructure directly
- Architecture: HIGH -- Integration points clearly identified by reading useSocket.ts and gameHandlers.ts; patterns are straightforward
- Pitfalls: HIGH -- Auto-pass cascade timing verified by reading server code; turn transition edge cases identified from ClientGameState type analysis
- Audio sourcing: MEDIUM -- ffmpeg generation is proven but real sound quality depends on user preference

**Research date:** 2026-03-14
**Valid until:** 2026-04-14 (no external dependencies changing; purely internal integration)

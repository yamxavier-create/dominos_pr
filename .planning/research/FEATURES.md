# Feature Landscape: Game Audio (v1.2)

**Domain:** Sound effects and background music for a multiplayer domino web app
**Researched:** 2026-03-14

---

## Existing Infrastructure to Leverage

The codebase already has pieces that make audio integration straightforward:

| Existing Asset | Location | Relevance |
|----------------|----------|-----------|
| `soundEnabled` boolean in uiStore | `client/src/store/uiStore.ts` line 23, 55, 78 | Toggle exists but is not wired to any UI component or audio playback. Must be split into `musicEnabled` + `sfxEnabled`. |
| `AudioContext` usage pattern | `client/src/hooks/useSpeakingDetection.ts` | App already creates and manages AudioContext for WebRTC speaking detection. Pattern for creating/resuming AudioContext is established. |
| All game events already fire | `client/src/hooks/useSocket.ts` | `game:state_snapshot` (with `lastAction`), `game:player_passed`, `game:round_ended`, `game:game_ended`, `game:boneyard_draw`, `chat:message` are all wired. Sound triggers are just new subscribers to existing events. |
| Legacy `click.mp3` | `assets/sounds/click.mp3` | From a Flutter build. May or may not be suitable; needs evaluation. |
| PWA service worker | `vite-plugin-pwa` config | Audio files placed in `client/public/` will be precached by the SW for instant playback. |

---

## Table Stakes

Features users expect when a game advertises audio. Missing = product feels broken or incomplete.

### 1. Browser Autoplay Compliance (AudioContext Unlock)

**Why expected:** Chrome, Safari, and Firefox all block audio playback until user gesture. This is a hard browser requirement since 2018. Failing to handle it means zero sound, ever.

**Concrete behavior:**
- On first user interaction (click/tap anywhere), resume or create the shared `AudioContext`
- All subsequent sound playback goes through this unlocked context
- No visible UI for this -- it's invisible plumbing

**Complexity:** Low
**Dependencies:** None. This MUST be solved before any other audio feature works.

### 2. Tile Placement Sound (Domino Clack)

**Why expected:** Core tactile feedback. Every board game app plays a sound when a piece is placed on the board. This single sound does more for "game feels alive" than all other sounds combined.

**Concrete behavior:**
- Plays on every `game:state_snapshot` where `lastAction.type === 'play_tile'`
- Plays for ALL players' moves, not just local player
- Must not conflict with tile animation timing (animation already uses 500ms timeout at useSocket line 96)
- Crisp, short domino-on-table clack

**Complexity:** Low
**Dependencies:** AudioContext unlock, SFX toggle
**Trigger point:** `useSocket.ts` line 93-97 (same event that drives `setLastTileSequence`)

### 3. Turn Notification Sound

**Why expected:** Players tab away, check phones, or get distracted. An audio cue that it's your turn prevents game stalling. This is the #2 most impactful sound.

**Concrete behavior:**
- Plays when `gameState.isMyTurn` transitions from `false` to `true`
- Must NOT play on initial game load (when `isMyTurn` is first set)
- Must NOT play when the local player just placed a tile (it's already their context)
- Distinct from tile clack -- gentle chime, not percussive

**Complexity:** Low
**Dependencies:** AudioContext unlock, SFX toggle
**Trigger point:** `useSocket.ts` `game:state_snapshot` handler -- compare previous `isMyTurn` with new value

### 4. Pass Sound Effect

**Why expected:** Auto-pass is silent and fast. Without audio cue, players often don't realize passes happened, especially in rapid cascade scenarios where 2-3 players pass sequentially.

**Concrete behavior:**
- Plays on each `game:player_passed` event
- Must handle rapid-fire cascade (multiple passes in <1 second) without clipping or overlapping badly
- Short, subtle sound (whoosh or soft knock)

**Complexity:** Low
**Dependencies:** AudioContext unlock, SFX toggle
**Trigger point:** `useSocket.ts` line 100 (`game:player_passed` handler)

### 5. SFX Mute Toggle (Game UI)

**Why expected:** Players in meetings, late at night, or on a video call need to silence game sounds instantly. A mute button is mandatory.

**Concrete behavior:**
- Toggle button visible on game screen (small speaker icon, likely near existing UI controls)
- Reads/writes `soundEnabled` (or `sfxEnabled` if split) from uiStore
- When muted, no SFX play. When unmuted, SFX resume immediately.
- Persist preference to `localStorage` so it survives page reload

**Complexity:** Low
**Dependencies:** Existing `soundEnabled` in uiStore (already defined, just needs UI binding)

---

## Differentiators

Features that elevate the experience. Not required for "game feels alive" but add significant polish.

| Feature | Value Proposition | Complexity | Dependencies | Notes |
|---------|-------------------|------------|--------------|-------|
| **Lo-fi background music (menu/lobby)** | Sets mood; makes waiting for players feel less dead. Puerto Rican casual vibe. | Medium | Royalty-free music file, separate music toggle, fade-in/out logic | Must fade out when game starts. Must not conflict with WebRTC voice chat. Needs loopable track (60-120s). |
| **Separate music vs SFX toggles** | Players on video call want SFX but music interferes with conversation | Medium | Split `soundEnabled` into `musicEnabled` + `sfxEnabled` | Two controls instead of one. Both persisted to localStorage. Only needed if music feature ships. |
| **Round end fanfare** | Punctuates victories; short celebratory sound when a round ends | Low | `game:round_ended` event | 1-2 second jingle. Different weight than game-end. |
| **Game end fanfare** | Bigger celebration for winning the whole game | Low | `game:game_ended` event | 2-3 second celebration. More impactful than round fanfare. |
| **Chat message notification ping** | Subtle ping when new chat arrives while panel is closed | Low | `chat:message` event + `chatOpen` state (unreadCount logic already exists) | Very short, subtle. Only when chat is closed. |
| **Boneyard draw sound** | Distinct sound for drawing from boneyard in 2-player mode | Low | `game:boneyard_draw` event | Shuffling/drawing sound distinct from tile clack. |
| **Audio state persistence (localStorage)** | Preferences survive page reload and reconnection | Low | localStorage read on store init | Use Zustand `persist` middleware or manual read/write. Quick win. |
| **Capicu / Chuchazo special sound** | Celebratory accent for bonus scoring plays unique to Puerto Rican dominoes | Low | Detectable from round-end data (capicu/chuchazo flags) | Culturally relevant. Short celebratory SFX before round fanfare. |
| **SFX volume slider** | Fine-grained control over effect loudness | Low | Global GainNode in audio manager | Single slider, not per-sound. Separate from music volume. |
| **Game start sound** | Brief flourish when game begins; signals transition from lobby to gameplay | Low | `game:started` event | Very short (< 1s). Plays once. |

---

## Anti-Features

Features to explicitly NOT build. These add complexity without proportional value.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| **Background music during gameplay** | Competes with WebRTC voice chat and tile/turn sounds. Most players will mute it immediately. Creates audio fatigue in long games. | Music in menu/lobby only. Silence (with SFX) during gameplay. |
| **Per-player sound customization** | Multiplies audio assets, adds settings UI complexity for marginal value in a casual game | Single curated sound set. Well-chosen defaults. |
| **Spatial/3D audio positioning** | This is a board game, not an FPS. Positional audio adds nothing to dominos. | Standard stereo playback. |
| **Dynamic/adaptive music** | Enormous complexity (layered music systems reacting to game state). Completely overkill for a casual domino game. | Static lo-fi loop with simple fade transitions. |
| **Server-side audio synchronization** | Sounds are client-side UI feedback, not game state. Syncing adds latency, server load, and complexity for zero benefit. | Each client plays sounds locally based on received socket events. |
| **Custom sound upload** | Security risk (audio files can be malicious), storage costs, moderation burden | Fixed curated sound set. |
| **Voice chat join/leave chimes** | WebRTC already has visual connection indicators. Adding audio chimes creates confusion between "game event" and "call event" sounds. | Keep WebRTC audio system completely separate from game audio. |
| **Howler.js or heavy audio library** | The Web Audio API handles everything needed here (short SFX, gain control, single music loop). Adding a dependency for features we won't use (sprites, spatial audio, format fallback) is unnecessary. | Lightweight custom audio manager using Web Audio API directly. The codebase already uses AudioContext for speaking detection. |

---

## Sound Event Mapping

Complete mapping from game events to audio triggers.

| Game Event | Socket Event / Trigger | Sound Type | Priority | Notes |
|------------|----------------------|------------|----------|-------|
| Tile placed (any player) | `game:state_snapshot` + `lastAction.type === 'play_tile'` | Domino clack | P0 | Core feedback |
| My turn starts | `game:state_snapshot` where `isMyTurn` flips to `true` | Gentle notification chime | P0 | Skip if local player just played |
| Player passed | `game:player_passed` | Quick subtle whoosh/knock | P0 | May fire rapidly in cascade |
| Enter menu/lobby | Route change to `/` or `/lobby` | Start background music loop | P1 | Fade in over ~1s |
| Leave lobby (game starts) | `game:started` event | Fade out music, optional start flourish | P1 | Crossfade or quick fade |
| Round ended | `game:round_ended` | Short fanfare (1-2s) | P1 | |
| Game ended | `game:game_ended` | Celebration fanfare (2-3s) | P1 | More impactful than round |
| Chat message (panel closed) | `chat:message` + `!chatOpen` | Soft ping | P2 | Only when chat panel is closed |
| Boneyard draw | `game:boneyard_draw` | Card/tile shuffle | P2 | 2-player mode only |
| Capicu / Chuchazo | Detectable from `game:round_ended` payload | Special celebratory accent | P2 | Before round fanfare |

---

## Audio File Requirements

| Sound | Format | Duration | Size Target | Character |
|-------|--------|----------|-------------|-----------|
| Tile clack | MP3 | 200-400ms | < 20KB | Crisp, satisfying; domino-on-table impact |
| Turn notification | MP3 | 300-500ms | < 15KB | Gentle chime; noticeable but not jarring |
| Pass sound | MP3 | 150-300ms | < 10KB | Subtle; must not be annoying when rapid-fired |
| Round fanfare | MP3 | 1-2s | < 50KB | Upbeat, short celebration |
| Game fanfare | MP3 | 2-3s | < 80KB | Bigger celebration than round |
| Chat ping | MP3 | 100-200ms | < 8KB | Subtle, non-intrusive |
| Boneyard draw | MP3 | 200-400ms | < 15KB | Shuffling/drawing character |
| Capicu/Chuchazo accent | MP3 | 500ms-1s | < 30KB | Celebratory sting |
| Lo-fi background music | MP3 | 60-120s (seamless loop) | < 500KB | Chill, ambient; clean loop point |

**Total estimated audio payload:** ~730KB max. Well within PWA cache budget. All files served from `client/public/sounds/` and precached by service worker.

**Format rationale:** MP3 has universal browser support (including Safari/iOS). OGG is unnecessary as a fallback since MP3 coverage is 100% in modern browsers. Single format simplifies the build.

---

## Feature Dependencies

```
Browser Autoplay Compliance (AudioContext unlock on first gesture)
  |
  +--> Audio Manager (singleton managing AudioContext, GainNodes, playback)
  |      |
  |      +--> SFX Channel (GainNode for all sound effects)
  |      |     |
  |      |     +--> Tile clack
  |      |     +--> Turn notification
  |      |     +--> Pass sound
  |      |     +--> Round/game fanfare
  |      |     +--> Chat ping
  |      |     +--> Boneyard draw
  |      |     +--> Capicu/Chuchazo accent
  |      |
  |      +--> Music Channel (GainNode for background music)
  |            |
  |            +--> Lo-fi lobby/menu music
  |
  +--> SFX Toggle (uiStore) --> Controls SFX GainNode (mute/unmute)
  +--> Music Toggle (uiStore) --> Controls Music GainNode (mute/unmute)
  +--> localStorage persistence --> Feeds both toggles on page reload

Split soundEnabled into sfxEnabled + musicEnabled
  --> Replaces existing single boolean in uiStore
```

---

## MVP Recommendation

**Ship in this order for maximum impact with minimum risk:**

### Phase 1: Audio Foundation + Core SFX (P0)

1. **Audio manager singleton** with autoplay unlock -- foundation; nothing works without this
2. **Tile clack on play** -- most impactful single sound; makes the game feel physical
3. **Turn notification** -- solves "whose turn is it?" when players tab away
4. **Pass sound** -- completes the core gameplay audio loop
5. **SFX toggle in game UI** -- mute button wired to existing `soundEnabled`

This delivers the "game feels alive" goal with 4 sounds and a mute button.

### Phase 2: Music + Extended SFX (P1)

1. **Lo-fi background music** in menu/lobby with fade-out on game start
2. **Split toggles** (music vs SFX) in both lobby and game screens
3. **Round/game end fanfare** sounds
4. **localStorage persistence** for audio preferences
5. **Game start sound**

### Phase 3: Polish SFX (P2) -- Optional

1. Chat notification ping
2. Boneyard draw sound
3. Capicu/Chuchazo special sound
4. Volume slider

**Defer entirely:**
- **Dynamic/adaptive music:** Massive complexity, zero ROI for casual game
- **Per-player customization:** Not needed

---

## Complexity Assessment

| Feature Area | Estimated Effort | Risk | Notes |
|--------------|-----------------|------|-------|
| Audio manager + autoplay unlock | 1-2 hours | Low | Well-understood pattern. AudioContext already used in codebase for speaking detection. |
| Core SFX (clack, turn, pass) | 2-3 hours | Low | Event hooks already exist in useSocket. Just add play calls. |
| SFX toggle UI | 30 min | Low | Store field exists. Wire a button. |
| Background music + fade logic | 2-3 hours | Medium | Looping, fade transitions, route-aware playback. Music file sourcing adds time. |
| Separate music/SFX toggles | 1 hour | Low | Split one boolean into two. Two UI controls. |
| Round/game fanfare | 30 min | Low | Same pattern as tile clack, different trigger event. |
| localStorage persistence | 30 min | Low | Zustand persist middleware or manual. |
| Sound file sourcing | 1-2 hours | Medium | Finding good royalty-free SFX and music. Quality matters for feel. |

**Total estimated effort:** 8-12 hours for full feature set (Phases 1-3).

---

## Sources

- **Direct codebase analysis (HIGH confidence):**
  - `client/src/store/uiStore.ts`: `soundEnabled` boolean (line 23), toggle function (line 78), default `true` (line 55). Not referenced in any component.
  - `client/src/hooks/useSocket.ts`: All game event handlers with exact line numbers for trigger points.
  - `client/src/hooks/useSpeakingDetection.ts`: Existing AudioContext creation/resume pattern (lines 62-67).
  - `client/public/`: Only PWA icons, no audio files yet.
  - `assets/sounds/click.mp3`: Legacy Flutter asset, exists but not integrated.

- **Browser autoplay policy (HIGH confidence):** Chrome (2018+), Safari (2017+), Firefox (2019+) all require user gesture before AudioContext or HTMLAudioElement can play. This is a stable, well-documented browser behavior.

- **Web Audio API suitability (HIGH confidence):** Native browser API, no dependencies needed. Supports AudioBufferSourceNode for low-latency SFX, GainNode for volume control, and HTMLMediaElement for music streaming. Already in use in this codebase.

- **MP3 browser support (HIGH confidence):** Universal in modern browsers including Safari/iOS since 2012+. No need for OGG fallback.

**Confidence assessment:**

| Area | Confidence | Notes |
|------|------------|-------|
| Event-to-sound mapping | HIGH | Derived directly from reading useSocket.ts event handlers |
| Audio manager architecture | HIGH | Web Audio API is mature and already used in this codebase |
| Feature prioritization | HIGH | Based on user-facing impact analysis of each sound |
| Audio file specifications | MEDIUM | Based on general web game audio practices, not domino-specific research |
| Effort estimates | MEDIUM | Based on codebase familiarity; actual sourcing of sound files may vary |
| Music licensing requirements | LOW | Royalty-free sources exist but specific recommendations need verification |

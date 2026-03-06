# Feature Landscape

**Domain:** Real-time multiplayer browser card/tile game (Puerto Rican Dominoes)
**Researched:** 2026-03-06
**Milestone scope:** In-game chat, rematch flow, running score history panel

---

## Existing Feature Baseline (What Is Already Built)

Before categorizing new work, document what exists so we do not duplicate or contradict it.

| Feature | Status | Notes |
|---------|--------|-------|
| Real-time 4-player game via Socket.io | Built | Full Puerto Rican rules |
| Score tracking per round | Built | `RoundEndModal` shows pip breakdown, bonuses |
| Running score bar | Built | `ScorePanel` shows team totals + progress bar toward target |
| Hand number display | Built | Shown in `ScorePanel` as `#N` |
| Pass (paso) toasts | Built | `PasoToast` + `PasoChip` components |
| Round end summary modal | Built | Remaining tiles, points breakdown, Capicú/Chuchazo badges |
| Game end modal | Built | Final scores, "Jugar de Nuevo" exits to `/` |
| Sound toggle | Built | `soundEnabled` in `uiStore` |
| Disconnect indicator | Partial | `connected: false` flag in player data; no UI notification beyond that |

**Critical gap identified in `CONCERNS.md`:** "Jugar de Nuevo" in `GameEndModal` currently calls `room:leave` and navigates to `/`. There is zero server-side support for resetting a room for a new game without re-sharing a room code.

---

## Table Stakes

Features that multiplayer browser game players expect. Missing = product feels unfinished.

### 1. Rematch in Same Room

**Why expected:** After any multiplayer game, the most natural next action is "again." Forcing players to leave, re-share a code, and re-join is friction that kills session continuity. Games like skribbl.io, Gartic Phone, and Jackbox all keep players in the room between rounds.

**Concrete expected behavior:**
- At game end, a "Revancha" (rematch) button appears for all players — not just host
- Each player presses it; a lobby-style "ready" state shows who has confirmed
- When all 4 press it, the server resets game state and starts a new game in the same room with the same seats
- The room code does not change; the share link stays valid

**Complexity:** Medium — requires server-side `room:rematch_ready` event and a new room phase transition (`'game_over'` → `'waiting_rematch'` → `'in_game'`).

**Edge cases (must be specified before implementation):**

| Edge Case | Expected Behavior |
|-----------|-------------------|
| A player disconnects before all 4 confirm | Timer or host-override: if a player has been disconnected > 30s and everyone else confirmed, allow the remaining 3 connected players to proceed (or host can force start) |
| A player closes the tab (true leave) | Their slot opens; others can wait or host can navigate to lobby to invite a new player |
| Mid-game rematch request (impossible with this flow) | Not applicable — rematch only surfaces at game end, never mid-game |
| Host left during game, host promoted | New host has same rematch authority; fix `isHost` determination first (known bug in `RoundEndModal`) |
| Server restart between game end and rematch confirm | Room is lost (in-memory); show "room expired" error and redirect to `/` |

### 2. In-Game Chat — Free Text

**Why expected:** These are 4 friends playing together. Trash talk, commentary, and coordination are core to the experience. Without chat, players are silent strangers. Every real-money or casual social game (Ludo King, Playtika, Rummy) has chat.

**Concrete expected behavior:**
- Chat panel accessible during game without leaving the board view (slide-in drawer or fixed sidebar)
- Messages show sender name + text + timestamp (relative: "just now", "2m ago")
- New message badge/indicator when chat is collapsed so players know something was said
- Messages are room-scoped and in-memory (no persistence across sessions)
- Scroll to bottom on new message from others; do not auto-scroll if user is reading history

**Character limit:** 200 characters per message. Long enough for a sentence; short enough to prevent walls of text that obscure the board.

**Message retention:** Last 50 messages in server memory per room. No persistence beyond server memory. On reconnect, player sees only messages received after reconnect (no replay).

**Complexity:** Low-Medium — new socket events `chat:message` (client→server→all clients), minimal server state (array of last N messages in room).

### 3. In-Game Chat — Quick Reactions

**Why expected:** In fast-paced card/tile games, typing mid-turn is too slow. Quick reactions (preset phrases or emojis) let players respond to a great play without breaking focus. Boardgame Arena, online Uno, and Dominoes Gold all have quick-tap reactions.

**Concrete expected behavior:**
- Reaction picker: 6–8 preset options accessible with a single tap (no typing)
- Reactions appear as floating toast/bubble anchored near the reacting player's seat, then fade after 2–3 seconds
- Reactions are NOT stored in chat history (ephemeral, not persistent in the message list)
- Reaction options must be in Spanish to match the game's language: e.g., "¡Capicú!", "¡Buena jugada!", "🤔", "😂", "🔥", "😤"

**Complexity:** Low — a subset of the chat socket infrastructure (same `chat:reaction` event, client-side animation only).

---

## Differentiators

Features that would set this apart from other free domino apps but are not baseline expectations.

### 1. Score History Panel — Per-Hand Log

**What it is:** A collapsible log showing each completed hand's outcome: points scored, which team won, any bonuses (Capicú, Chuchazo, blocked). The current `ScorePanel` shows only the running cumulative total.

**Value proposition:** Players can review "how did we get here?" during a tense game. Useful for Modo 500 where 5+ hands may be played.

**Expected format:**
```
Mano 1: Equipo A +45  (Capicú +100)  →  A: 145 | B: 0
Mano 2: Equipo B +30               →  A: 145 | B: 30
Mano 3: Trancado, Equipo A +15     →  A: 160 | B: 30
```

**When visible:** Accessible via a tap on the score bar (expand/collapse). Not shown by default — board space is precious on mobile.

**Data source:** Server already emits `game:round_ended` with full `RoundEndPayload`. Client can accumulate these in an array in `gameStore` during the session. No new server state needed.

**Complexity:** Low (client-only) — `gameStore` accumulates round payloads already received; panel renders the array.

### 2. Disconnect/Reconnect Notification Toast

**What it is:** Visible UI notification when a player disconnects or reconnects mid-game. Currently `connection:player_disconnected` and `connection:player_reconnected` are received but only `console.log`'d (CONCERNS.md confirmed).

**Value proposition:** Players know why the game is paused. Without this, a stall feels like a bug.

**Concrete behavior:** Toast at bottom of screen: "[Player] se desconectó. Esperando reconexión..." — dismisses automatically when they reconnect or after 10 seconds.

**Complexity:** Very Low — hook into existing events in `useSocket.ts`, emit to `uiStore` toast queue (same pattern as `pasoNotifications`).

### 3. Per-Player Reaction Animations Anchored to Seats

**What it is:** Quick reactions appear floating above the reacting player's seat position on the board, not just in a generic notification area.

**Value proposition:** Creates spatial context — the reaction comes "from" the player who sent it. More immersive than a generic toast.

**Complexity:** Medium — requires mapping `playerIndex` to seat DOM position, animating absolutely-positioned elements relative to the game table.

---

## Anti-Features

Features to explicitly NOT build in this milestone (and why).

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Chat message persistence across sessions | No database, no auth — in-memory only is the constraint. Persistence adds Redis or DB dependency not in scope. | Keep messages in-memory, lost on room cleanup |
| Chat moderation / profanity filter | This is a private room game (friends only). A filter adds false-positive friction with no real benefit when players chose each other. | Trust the room-code social contract |
| Individual "ready" checkboxes for rematch with countdown timer | Over-engineered for 4 friends. Simple "all confirm" is sufficient. | All-4-confirm or host-override after timeout |
| Message read receipts ("seen by") | Adds complexity, not needed for this game context | Show unread count badge only |
| Chat notifications (push/OS-level) | Browser game in a tab; OS notifications are inappropriate scope creep | In-tab badge only |
| Rematch with seat shuffle / team swap | Puerto Rican dominoes has fixed social dynamics — people sit where they sit. Shuffling undermines the game's culture. | Keep same seats for rematch |
| Host-only chat moderation (kick/mute) | Private room, 4 friends. No moderation layer needed. | N/A |
| Score history export (PDF/image) | Nice idea, high complexity, zero demand signal yet | Defer indefinitely |
| Spectator mode | Requires architectural changes to seat assignment and `buildClientGameState`. Explicitly out of scope. | N/A |

---

## Feature Dependencies

```
Quick Reactions → In-Game Chat socket infrastructure
  (reactions use same socket event plumbing as text chat)

Disconnect Toast → No dependency (standalone useSocket.ts hook change)

Score History Panel → No new server state (client accumulates existing round_ended payloads)

Rematch Flow → Fix isHost bug in RoundEndModal first
  (same host-determination logic is needed in GameEndModal for rematch)

Rematch Flow → Fix game:next_hand starter bug (CONCERNS.md)
  (if rematch resets the game, starter logic must be correct from hand 1 of the new game)
```

---

## MVP Recommendation

**Priority 1 — Rematch in same room**
- Highest user value; eliminates the biggest UX cliff (forced re-share after every game)
- Requires: new server room phase, `room:rematch_ready` event, reset of `ServerGameState`
- Prerequisite: fix `isHost` determination (CONCERNS.md bug) before gating any button on host status

**Priority 2 — In-game chat (text + quick reactions)**
- New socket channel, minimal server state (last 50 messages array in Room object)
- Text chat first; quick reactions are a thin layer on top
- Mobile layout must be designed so chat does not obscure the board

**Priority 3 — Disconnect/reconnect notification toasts**
- Very low effort, very high perceived quality. Server events already exist. Client just needs UI.

**Defer to subsequent milestone:**
- Score history panel (client-only, low urgency, but nice for completeness)
- Per-seat reaction animations (fun, but layout complexity on mobile is non-trivial)

---

## Chat Feature Specification (Detailed)

### Server-Side

**New Room state fields:**
```typescript
chatMessages: ChatMessage[]  // max 50, in Room object
```

```typescript
interface ChatMessage {
  id: string           // nanoid or incrementing int
  playerIndex: number
  playerName: string
  text: string         // max 200 chars, server-enforced trim + length check
  timestamp: number    // Date.now()
  type: 'text' | 'reaction'
}
```

**New socket events (client → server):**
- `chat:send_message` — `{ text: string }` — server validates length, appends to room, broadcasts to all 4
- `chat:send_reaction` — `{ reactionKey: string }` — server validates key against allowlist, broadcasts ephemeral event

**New socket events (server → client):**
- `chat:message` — `ChatMessage` — received by all players in room
- `chat:reaction` — `{ playerIndex: number; reactionKey: string }` — ephemeral, not stored

**Spam prevention:** Rate limit `chat:send_message` to 5 messages per 10 seconds per socket (simple token bucket in `gameHandlers.ts`). Excess messages are silently dropped (no error shown). This fits within the existing "no rate limiting" tech debt noted in CONCERNS.md.

**Input sanitization:** Server must enforce `text.trim().slice(0, 200)`. No HTML stripping needed (React escapes JSX output). `playerName` is already stored server-side from join — use that, do not trust the client to send it.

### Client-Side

**State:** New `chatStore.ts` (fourth Zustand store) OR add chat to `uiStore` — preference is a separate `chatStore` to keep store boundaries clean per existing convention.

**UI layout options:**
- Option A: Slide-in drawer from right, overlays game partially, closes with tap outside or X button
- Option B: Fixed bottom panel below score bar, collapses to a single line with unread badge
- Recommendation: **Option B** (bottom panel) — less disruptive on mobile, always visible, no modal stack complexity

**Unread badge:** `uiStore.unreadChatCount: number` — increments when a `chat:message` arrives and chat is collapsed; resets to 0 when panel is expanded.

---

## Rematch Flow Specification (Detailed)

### State Machine

```
'in_game' → game ends → 'game_over'
'game_over' → all players confirm → 'in_game' (new hand 1, same room, same seats)
'game_over' → host force-starts (after timeout or disconnected player) → 'in_game'
'game_over' → any player leaves → remaining players see "waiting for player" state
```

### Server-Side

**New `room:rematch_ready` event (client → server):**
- Server records `socketId` as ready in a `rematchReady: Set<string>` on the Room object
- Broadcasts updated ready state to all players: `room:rematch_status` → `{ readyCount: number; playerStates: { name, ready }[] }`
- When all connected players are ready: call `resetGameForRematch(room)`, transition to `'in_game'`, broadcast `game:state_snapshot`

**`resetGameForRematch(room: Room)`:**
- Clear `room.game` (or reset all fields)
- Reset `room.status = 'in_game'`
- Re-deal tiles, find first player (double-six rule), set up `ServerGameState` from scratch
- Seats and teams are unchanged (players[0]&[2] = Team A, players[1]&[3] = Team B)
- Reset team scores to 0 (new game, not continuation)
- Clear `rematchReady` set

**Host force-override:** If a player has `connected: false` for > 30 seconds and all connected players are ready, host can emit `room:rematch_force` to start without the disconnected player. The disconnected player's seat becomes effectively an auto-pass machine until they reconnect (existing disconnect handling handles this, per CONCERNS.md recommendation).

### Client-Side

**`GameEndModal` changes:**
- Replace "Jugar de Nuevo" (which exits to `/`) with two buttons:
  - "Revancha" — emits `room:rematch_ready`; button becomes "Esperando..." disabled state
  - "Salir" — existing behavior (emit `room:leave`, navigate to `/`)
- Show ready count: "3/4 listos"
- When `game:state_snapshot` arrives with new `hand === 1` and `scores = { team0: 0, team1: 0 }`, dismiss modal automatically — the new game begins

**Known bug that must be fixed first:** `isHost` determination in `RoundEndModal.tsx:20` is wrong (checks `players[0].connected && myPlayerIndex === 0`). The same pattern exists in `GameEndModal`. Fix before adding host-specific rematch controls. Server already tracks `hostSocketId` in `getRoomInfo()` — expose it in the client room payload.

---

## Score History Panel Specification (Detailed)

### Data Model

The `RoundEndPayload` already contains everything needed per hand. Client can accumulate these.

**`gameStore` addition:**
```typescript
roundHistory: RoundEndPayload[]  // appended each time setRoundEnd() is called
```

Reset to `[]` on `resetGame()` (new game start).

### UI

**Trigger:** Tapping the `ScorePanel` bar expands it into a scrollable log below. Same tap collapses it.

**Per-hand row:**
```
Mano 3 | Equipo A | +45 pts | ¡Capicú! | A: 190 | B: 30
```

Columns: hand number, winning team (color-coded), points scored, bonus label (if any), running cumulative scores after that hand.

**Running totals:** Derived from the accumulated `roundHistory` array on the client — no new server data needed.

**Height constraint:** Max 3 rows visible; scroll for older hands. Do not expand so far that it covers the board.

---

## Sources

This research is based on:
- Direct codebase analysis: `GameEndModal.tsx`, `RoundEndModal.tsx`, `ScorePanel.tsx`, `RoomManager.ts`, `gameStore.ts`, `uiStore.ts`, `gameHandlers.ts`
- Project context: `.planning/PROJECT.md`
- Known defects and gaps: `.planning/codebase/CONCERNS.md`
- Domain knowledge of multiplayer browser game UX conventions (skribbl.io, Gartic Phone, Jackbox, Boardgame Arena, Ludo King patterns) — MEDIUM confidence (no live web search available in this session; patterns are well-established and stable)
- Puerto Rican dominoes cultural context: same seats for rematch is conventional in the game's social setting

**Confidence assessment:**

| Area | Confidence | Notes |
|------|------------|-------|
| Table stakes categorization | HIGH | Directly derived from codebase gaps + domain conventions |
| Chat character/retention limits | MEDIUM | Industry conventions, not project-specific requirements — validate with stakeholder |
| Rematch flow state machine | HIGH | Derived from existing RoomManager code + CONCERNS.md gaps |
| Score history panel | HIGH | Client-only change; existing server payloads cover all data needed |
| Anti-features list | MEDIUM | Rationale is sound; some (e.g. seat shuffle) are cultural assumptions worth confirming |

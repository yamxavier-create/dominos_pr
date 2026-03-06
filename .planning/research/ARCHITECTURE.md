# Architecture Patterns

**Domain:** Real-time multiplayer Puerto Rican dominoes — social feature integration
**Researched:** 2026-03-06
**Scope:** Chat, rematch, and score history integration into the existing Socket.io + React + Zustand stack

---

## Existing Architecture Summary (Basis for All Decisions)

Before recommending anything, the key invariants of the existing system that must not be violated:

- All state changes flow through Socket.io — no REST endpoints, no polling
- `GameEngine.ts` contains only pure functions — zero side effects, zero I/O. It must stay that way.
- `broadcastState()` in `gameHandlers.ts` is the single path for game state delivery
- Three Zustand stores (`gameStore`, `roomStore`, `uiStore`) are isolated — they never import from each other
- `useSocket.ts` is the single registration point for all server-to-client event handlers
- `Room.game` is `null` until `game:start` fires; the `Room` itself always exists

---

## Feature 1: Chat

### Where Chat State Lives

**Verdict: New `chatStore` — do not extend `uiStore` or `gameStore`.**

`uiStore` manages ephemeral interaction state (selected tile, notification queue, modal flags, sound toggle). Chat messages are persistent within a session and unrelated to game mechanics. Adding chat to `uiStore` would bloat it and break its coherent responsibility.

`gameStore` owns `ClientGameState` snapshots — chat is not part of game state and must not be mixed in.

A dedicated `chatStore` is the correct boundary:

```typescript
// client/src/store/chatStore.ts

interface ChatMessage {
  id: string             // uuid or timestamp+playerIndex composite
  playerIndex: number
  playerName: string
  text: string           // free text OR a reaction key
  type: 'text' | 'reaction'
  timestamp: number      // ms epoch, server-assigned
}

interface ChatStore {
  messages: ChatMessage[]
  unreadCount: number    // increments when chat panel is closed
  isChatOpen: boolean

  addMessage: (msg: ChatMessage) => void
  markRead: () => void
  setChatOpen: (open: boolean) => void
  clearChat: () => void
}
```

`clearChat()` is called on `game:game_ended` (or room leave) to reset between games.

### Where Chat State Lives on the Server

Chat messages are **not** stored in `ServerGameState`. They are room-scoped ambient data. Add a `chatHistory` field to `Room` in `GameState.ts`:

```typescript
// Addition to server/src/game/GameState.ts

export interface ChatMessage {
  id: string
  playerIndex: number
  playerName: string
  text: string
  type: 'text' | 'reaction'
  timestamp: number
}

// Inside Room interface — add:
chatHistory: ChatMessage[]   // last N messages, capped at 100
```

This sits on the `Room` object alongside `game`, not inside `ServerGameState`. It survives hand transitions (a player can see messages from earlier in the game). It is cleared when the room is destroyed (same in-memory lifecycle as the game itself).

### New Socket.io Events for Chat

Follow existing namespace:action convention.

**Client → Server:**

| Event | Payload | Notes |
|-------|---------|-------|
| `chat:send` | `{ roomCode: string; text: string; type: 'text' \| 'reaction' }` | Server validates sender identity via `socket.id`, enforces max length (120 chars), rate-limits |

**Server → Client (broadcast to room):**

| Event | Payload | Notes |
|-------|---------|-------|
| `chat:message` | `ChatMessage` (server-stamped with `timestamp`, `playerIndex`, `playerName`) | Broadcast to all sockets in room via `io.to(roomCode).emit(...)` |

The server assigns `playerIndex` and `playerName` from `room.game.players` or `room.players` — the client never self-reports its identity for a chat message. The server also generates the `id` (e.g. `${Date.now()}-${playerIndex}`) and `timestamp`.

### New Handler File

Create `server/src/socket/chatHandlers.ts` following the exact pattern of `gameHandlers.ts` and `roomHandlers.ts`:

```typescript
// server/src/socket/chatHandlers.ts
export function registerChatHandlers(socket: Socket, io: Server, rooms: RoomManager) {
  socket.on('chat:send', ({ roomCode, text, type }) => {
    // 1. Get room and verify sender
    // 2. Find player by socket.id in room.players
    // 3. Validate text (trim, max 120 chars, non-empty)
    // 4. Build ChatMessage with server timestamp
    // 5. Push to room.chatHistory (cap at 100)
    // 6. io.to(roomCode).emit('chat:message', message)
    // 7. Update room.lastActivity
  })
}
```

Register in `server/src/socket/handlers.ts` alongside the existing registrations.

### Chat in useSocket

Add one handler registration to the existing `useSocket.ts` effect:

```typescript
socket.on('chat:message', (msg: ChatMessage) => {
  useChatStore.getState().addMessage(msg)
})
```

Add cleanup in the return function:
```typescript
socket.off('chat:message')
```

This is the only touch to `useSocket.ts` for chat.

### Reconnect: Replay Chat History

When a player reconnects (`room:join` while `room.status === 'in_game'`), the server should send accumulated chat history:

```typescript
// In roomHandlers.ts reconnect branch, after game:state_snapshot:
socket.emit('chat:history', { messages: room.chatHistory })
```

Client handler in `useSocket.ts`:
```typescript
socket.on('chat:history', ({ messages }: { messages: ChatMessage[] }) => {
  messages.forEach(msg => useChatStore.getState().addMessage(msg))
})
```

### Component Placement for Chat

The chat panel belongs in `GameTable.tsx` as a slide-in overlay panel anchored to the right edge of the screen. It must not displace the board or player positions.

```
GameTable layout (existing 3x3 grid):
┌──────────────────────────────────────┐
│ ScorePanel (top bar)                 │
├───────────────────────────────────────┤
│ [TopLeft] │  Top Opponent   │ [TpRt] │
│───────────────────────────────────────│
│  Left     │   Board Center  │  Right │
│ Opponent  │  (GameBoard)    │ Opp    │
│───────────────────────────────────────│
│ [BotLft]  │   My Hand       │ [BtRt] │
└──────────────────────────────────────┘
     ↑
ChatPanel overlays from right edge — position: fixed, right: 0
Does not affect grid layout at all
```

Implementation: `ChatPanel` renders as `position: fixed` on the right side with a slide-in animation. A chat toggle button sits in the `ScorePanel` top bar (far right, next to the sound toggle). This avoids adding a new row or column to the 3x3 grid.

New components needed:
- `client/src/components/game/ChatPanel.tsx` — the slide-in panel with message list and input
- `client/src/components/game/ChatToggleButton.tsx` — the badge button (shows `unreadCount`)
- `client/src/components/game/ReactionPicker.tsx` — quick-reaction emoji row

`ChatPanel` reads from `chatStore` only. It emits via `socket.emit('chat:send', ...)` directly (same pattern as other one-off emits in `useGameActions.ts`).

Quick reactions: define a fixed set of ~6 preset phrases or emojis (e.g. "Buena!", "Jajaja", "Ay bendito", "Doble!", "Paso paso", "GG"). These are sent with `type: 'reaction'` and rendered differently in the message list (pill chip vs. text bubble).

---

## Feature 2: Rematch

### Rematch State Machine

Rematch requires consensus: all 4 players must agree before starting a new game. This is a coordination problem that the server must own.

**State shape on the server — add to `Room`:**

```typescript
// Addition to Room in GameState.ts

rematch: {
  votes: Set<string>   // socket IDs that voted to rematch
  expiresAt: number    // timestamp; server clears stale votes after 60s
} | null
```

`rematch` is `null` when no rematch vote is in progress. It becomes non-null the moment the first player votes after `game:game_ended`. It resets to `null` when: all 4 vote (game restarts), any player leaves, or 60 seconds pass with no consensus.

### New Socket.io Events for Rematch

**Client → Server:**

| Event | Payload | Notes |
|-------|---------|-------|
| `game:rematch_vote` | `{ roomCode: string }` | Idempotent — duplicate votes from same socket are no-ops |

**Server → Client:**

| Event | Payload | Notes |
|-------|---------|-------|
| `game:rematch_update` | `{ votes: number[]; total: 4 }` | `votes` is array of playerIndexes that have voted; broadcast after each new vote |
| `game:rematch_started` | `{ gameState: ClientGameState }` (personalized, same shape as `game:started`) | Sent individually per player when all 4 agree |

`game:rematch_update` follows the "announce each change" pattern already established by `game:player_passed`. The client can render "2/4 quieren revancha" from the `votes.length`.

**Why not reuse `game:started`?**

`game:rematch_started` and `game:started` have identical payloads but distinct semantics on the client: `game:started` navigates to `/game`, while `game:rematch_started` does not navigate (the player is already on `/game`). The client handler needs to distinguish them. Using separate event names is correct here.

### Server Handler for Rematch

Add a new handler inside `gameHandlers.ts` (not a new file — rematch is game lifecycle):

```typescript
socket.on('game:rematch_vote', ({ roomCode }) => {
  const room = rooms.getRoom(roomCode)
  if (!room) return
  // Only valid during game_end phase
  if (!room.game || room.game.phase !== 'game_end') return
  // Find player
  const player = room.game.players.find(p => p.socketId === socket.id)
  if (!player) return

  // Initialize rematch tracking on room if not already
  if (!room.rematch) {
    room.rematch = { votes: new Set(), expiresAt: Date.now() + 60_000 }
  }
  room.rematch.votes.add(socket.id)

  // Broadcast current vote count
  const voteIndexes = [...room.rematch.votes].map(sid =>
    room.game!.players.find(p => p.socketId === sid)?.index ?? -1
  ).filter(i => i >= 0)
  io.to(roomCode).emit('game:rematch_update', { votes: voteIndexes, total: 4 })

  // All 4 voted — start new game
  if (room.rematch.votes.size === 4) {
    room.rematch = null
    // Reset game state (same logic as game:start but keep same room/players/seats)
    // ... deal tiles, find first player, build new ServerGameState ...
    // Send personalized state to each player
    for (const p of room.game.players) {
      const clientState = buildClientGameState(room.game, p.index)
      io.to(p.socketId).emit('game:rematch_started', { gameState: clientState })
    }
  }
})
```

Critical: rematch resets `room.game` to a fresh `ServerGameState` with the same player roster and seat assignments. It does NOT reset `room.players` (seats stay the same). Score history accumulates across the lobby session (discussed below).

### Client-Side Rematch State

Extend `gameStore` — do not create a new store:

```typescript
// Addition to GameStore interface
rematchVotes: number[]       // playerIndexes that have voted

setRematchVotes: (votes: number[]) => void
clearRematch: () => void
```

`rematchVotes` resets to `[]` when `game:rematch_started` fires (game begins) or when navigating away.

The `GameEndModal` component is modified to show:
1. A "Revancha" button — emits `game:rematch_vote` on click
2. A vote counter "2/4" that updates as `game:rematch_update` events arrive
3. The existing "Jugar de Nuevo" button (leave room) remains unchanged

The "Jugar de Nuevo" path (`room:leave` → navigate to `/`) is the escape hatch and stays exactly as-is.

### useSocket Additions for Rematch

```typescript
socket.on('game:rematch_update', ({ votes }: { votes: number[] }) => {
  useGameStore.getState().setRematchVotes(votes)
})

socket.on('game:rematch_started', ({ gameState }: { gameState: ClientGameState }) => {
  setGameState(gameState)
  // No navigate() call — already on /game
  useGameStore.getState().clearRematch()
  useUIStore.getState().setShowGameEnd(false)
  useUIStore.getState().setShowRoundEnd(false)
})
```

The distinction from `game:started` is precisely that there is no `navigate('/game')` call.

### Rematch and Score History Integration

Rematch is the trigger that makes score history meaningful: players see the previous game's result before committing to another. The `GameEndModal` already shows `finalScores` from `game:game_ended`. No new data needed for this view — it is already there.

---

## Feature 3: Score History

### Where Score History Lives

Score history (per-hand breakdown) is **not** part of `ClientGameState`. It is accumulated data, not current-game state.

**Verdict: Server accumulates on `Room`; client accumulates in `gameStore`.**

Server:
```typescript
// Addition to Room in GameState.ts

export interface HandRecord {
  handNumber: number
  reason: 'played_out' | 'blocked'
  winningTeam: 0 | 1 | null
  pointsScored: number
  isCapicu: boolean
  isChuchazo: boolean
  scoresAfter: TeamScores   // cumulative score at end of this hand
}

// Inside Room interface — add:
scoreHistory: HandRecord[]
```

The server appends a `HandRecord` at the same moment it emits `game:round_ended`, pulling data from the payload it is already constructing. This requires no new computation — all fields already exist in the `game:round_ended` payload.

Client:
```typescript
// Addition to GameStore interface

scoreHistory: HandRecord[]
addHandRecord: (record: HandRecord) => void
clearScoreHistory: () => void
```

The client builds `scoreHistory` by appending on each `game:round_ended` event — it does not need a separate server push. The data is already in the `RoundEndPayload`. Add to the `game:round_ended` handler in `useSocket.ts`:

```typescript
socket.on('game:round_ended', (data: RoundEndPayload) => {
  setRoundEnd(data)
  setShowRoundEnd(true)
  // Append to score history
  useGameStore.getState().addHandRecord({
    handNumber: /* from gameState.handNumber */,
    reason: data.reason,
    winningTeam: data.winningTeam,
    pointsScored: data.totalPointsScored,
    isCapicu: data.isCapicu,
    isChuchazo: data.isChuchazo,
    scoresAfter: data.scores,
  })
})
```

`handNumber` comes from `gameStore.gameState.handNumber` at the moment the event fires. The `useSocket` hook already reads from `useGameStore` — this is not a new cross-store dependency.

**Reconnect: Send Score History**

When a player reconnects mid-game, the server should replay `scoreHistory` alongside the chat history:

```typescript
// In roomHandlers.ts reconnect branch:
socket.emit('game:score_history', { records: room.scoreHistory })
```

Client handler:
```typescript
socket.on('game:score_history', ({ records }: { records: HandRecord[] }) => {
  records.forEach(r => useGameStore.getState().addHandRecord(r))
})
```

### Score History Component Placement

The running score history is an expandable overlay accessible from the `ScorePanel`. It does not live in a modal — it should be a slide-in panel from the top (below `ScorePanel`), or a popover triggered by tapping the score bar.

Recommended: a `ScoreHistoryPanel` component triggered by a tap on `ScorePanel`. It displays a compact table:

```
Hand | Winner     | Points | A  | B
  1  | Equipo A   | 12     | 12 | 0
  2  | Blocked    | 8      | 20 | 0
  3  | Equipo B   | 15     | 20 | 15
```

The panel is `position: fixed`, full-width, slides down from the top bar. It reads only from `chatStore.scoreHistory` (should be `gameStore.scoreHistory`).

New component: `client/src/components/game/ScoreHistoryPanel.tsx`

Visibility toggle state: add `showScoreHistory: boolean` and `setShowScoreHistory` to `uiStore` (same pattern as `showRoundEnd`, `showGameEnd`).

---

## Component Boundaries

| Component | Responsibility | Reads From | Emits |
|-----------|---------------|------------|-------|
| `ChatPanel` | Render message list, text input, reaction picker | `chatStore` | `chat:send` |
| `ChatToggleButton` | Badge button in `ScorePanel` showing unread count | `chatStore.unreadCount`, `chatStore.isChatOpen` | sets `chatStore.isChatOpen` |
| `ReactionPicker` | Quick reaction row in `ChatPanel` | static config | triggers `ChatPanel` send |
| `ScoreHistoryPanel` | Per-hand score table slide-in | `gameStore.scoreHistory` | — |
| `GameEndModal` (modified) | Add rematch vote button + vote count | `gameStore.rematchVotes` | `game:rematch_vote` |
| `ScorePanel` (modified) | Add chat toggle button | `chatStore` | toggles `chatStore.isChatOpen` |

---

## Integration with Existing broadcastState Flow

**Chat does NOT go through `broadcastState`.** Chat events are independent room broadcasts using `io.to(roomCode).emit('chat:message', ...)` directly in `chatHandlers.ts`. This is intentional — chat is not personalized per-player (unlike game state), so it does not need `buildClientGameState` projection.

**Rematch does NOT go through `broadcastState`.** `game:rematch_update` and `game:rematch_started` are their own broadcasts from `gameHandlers.ts`. `game:rematch_started` does use `buildClientGameState` for the same reason `game:started` does — each player needs a personalized view of their own hand.

**Score history does NOT change `broadcastState`.** It is derived entirely from `game:round_ended` payloads that already flow through the existing emit chain. No modification to `broadcastState`, `broadcastStateWithAction`, or `GameEngine.ts` is required.

**`GameEngine.ts` requires zero changes.** All three features use existing outputs from the engine (score data from `game:round_ended`, game state from `buildClientGameState`). The pure-function contract is preserved.

---

## New Socket.io Event Registry

Complete list of new events — named consistently with existing `namespace:action` convention:

| Direction | Event | Handler Location | Description |
|-----------|-------|-----------------|-------------|
| C→S | `chat:send` | `chatHandlers.ts` | Player sends a message or reaction |
| S→C | `chat:message` | `useSocket.ts` | Broadcast: new chat message |
| S→C | `chat:history` | `useSocket.ts` | Reconnect: replay accumulated messages |
| C→S | `game:rematch_vote` | `gameHandlers.ts` | Player votes for rematch |
| S→C | `game:rematch_update` | `useSocket.ts` | Broadcast: updated vote count |
| S→C | `game:rematch_started` | `useSocket.ts` | Broadcast: all 4 voted, new game begins |
| S→C | `game:score_history` | `useSocket.ts` | Reconnect: replay hand records |

No existing events are modified. No existing events are removed.

---

## Server-Side State Additions (Room Object)

The `Room` interface in `server/src/game/GameState.ts` gains three fields. `ServerGameState` is unchanged.

```typescript
// Additions to Room interface only:
chatHistory: ChatMessage[]     // capped at 100 entries
scoreHistory: HandRecord[]     // one entry per completed hand
rematch: {
  votes: Set<string>           // socket IDs
  expiresAt: number
} | null
```

`RoomManager.createRoom` initializes all three: `chatHistory: []`, `scoreHistory: []`, `rematch: null`.

`RoomManager.leaveRoom` mid-game: clear `rematch` (consensus broken by departure) but preserve `chatHistory` and `scoreHistory` for the reconnecting player.

---

## Client-Side Store Changes

| Store | Change | What Changes |
|-------|--------|-------------|
| `chatStore` (new) | Create new file | `messages`, `unreadCount`, `isChatOpen`, CRUD actions |
| `gameStore` | Extend | Add `rematchVotes`, `scoreHistory`, `addHandRecord`, `setRematchVotes`, `clearRematch`, `clearScoreHistory` |
| `uiStore` | Extend minimally | Add `showScoreHistory`, `setShowScoreHistory` |
| `roomStore` | No change | — |

---

## Build Order (Feature Dependencies)

```
1. Score History
   ← No dependencies on other new features
   ← Depends only on existing game:round_ended payload
   ← Lowest risk: purely additive, no new events on critical path

2. Rematch
   ← Depends on score history being visible (players want to see results before revancheing)
   ← Modifies GameEndModal — ship score history panel first to avoid modal conflicts
   ← Requires server Room changes (rematch field)

3. Chat
   ← Independent of rematch and score history
   ← Can be built in parallel with rematch after score history ships
   ← Largest surface area (new store, new handler file, new components, reconnect replay)
   ← Most likely to surface layout conflicts with GameTable on mobile
```

Recommended sequence: Score History → Rematch → Chat (or Score History → Chat and Rematch in parallel).

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Storing Chat in ClientGameState

**What it looks like:** Adding a `chatMessages` field to `ClientGameState` / `ServerGameState` and delivering chat via `broadcastState`.

**Why bad:** `broadcastState` is called on every game event and calls `buildClientGameState` 4x per action. Chat messages are room-ambient — they change independently of game state. Bundling them into game state creates unnecessary coupling, inflates payload size on every tile play, and adds complexity to `GameEngine.ts` which must stay pure.

**Instead:** Separate `chat:message` broadcast, separate `chatStore` on the client.

### Anti-Pattern 2: Client-Side Rematch Consensus

**What it looks like:** Clients emit `game:rematch_vote`, each client tracks vote counts locally, the first client that sees 4 votes initiates the game restart.

**Why bad:** No authoritative decision point. Race conditions. A disconnecting player could leave 3 clients each thinking a different consensus state. The server is the sole authority for all game state changes — rematch is a game state change.

**Instead:** Server owns the `rematch.votes` Set; only the server emits `game:rematch_started` when the Set reaches size 4.

### Anti-Pattern 3: Navigating on game:rematch_started

**What it looks like:** `useSocket.ts` handler for `game:rematch_started` calls `navigate('/game')` the same way `game:started` does.

**Why bad:** The player is already on `/game`. A navigation event causes the page to unmount and remount, clearing React state, causing a flash, and potentially triggering the `GamePage.tsx` redirect guard (`if (!gameState) navigate('/')`) during the remount cycle.

**Instead:** `game:rematch_started` handler calls only `setGameState()` and clears rematch/modal state. No `navigate()` call.

### Anti-Pattern 4: Extending uiStore for Chat

**What it looks like:** Adding `chatMessages`, `isChatOpen`, `unreadCount` to the existing `uiStore`.

**Why bad:** `uiStore` is already the "miscellaneous" store. Chat is a first-class feature with its own message list (unbounded growth relative to the tile selection and notification queue). Separate concerns: `uiStore` owns ephemeral interaction state; `chatStore` owns persisted session communication.

**Instead:** New `chatStore` with a single clear responsibility.

---

## Scalability Considerations

| Concern | Current (4 players) | With new features |
|---------|--------------------|--------------------|
| `Room` memory | ~2KB per room | ~3–5KB with chat (100 msg cap) + history |
| broadcastState calls | Unchanged | Unchanged — chat/rematch bypass it |
| `useSocket` handler count | 10 handlers | 14 handlers (+4 new events) |
| `chatHistory` cap | — | 100 messages (enforce in server handler) |
| Rematch timeout | — | 60s server-side cleanup to prevent stale vote state |

The 10-minute room cleanup interval in `RoomManager` already handles stale rooms. No additional cleanup needed for chat or score history — they live and die with the `Room` object.

---

## Sources

- Codebase direct analysis: `server/src/game/GameState.ts`, `server/src/socket/gameHandlers.ts`, `server/src/socket/roomHandlers.ts`, `server/src/game/RoomManager.ts`
- Client analysis: `client/src/hooks/useSocket.ts`, `client/src/store/{gameStore,roomStore,uiStore}.ts`, `client/src/components/game/GameTable.tsx`, `client/src/components/game/{GameEndModal,ScorePanel}.tsx`
- Project requirements: `.planning/PROJECT.md`
- Known concerns: `.planning/codebase/CONCERNS.md`
- Confidence: HIGH — all recommendations derived directly from reading the production source files, not from training data about the domain

---

*Architecture analysis: 2026-03-06*

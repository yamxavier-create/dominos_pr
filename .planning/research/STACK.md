# Technology Stack

**Project:** Dominos PR — Social Features Milestone (Chat, Rematch, Score History)
**Researched:** 2026-03-06
**Confidence:** HIGH — all three features fit within the existing Socket.io 4.7 / React 18 / Zustand 4.4 / Express 4 stack with zero new npm packages.

---

## Executive Verdict

**No new packages required.** Chat, rematch, and score history can all be built using Socket.io room broadcasts (already wired), Zustand stores (already three of them, pattern is established), and Tailwind components (already in use). Adding new dependencies for any of these features would be over-engineering for a 4-player in-memory game.

---

## Recommended Stack Per Feature

### Feature 1: In-Game Chat

#### Approach: Same Socket.io channel, new event namespace

Use the existing `socket.io` server instance. Emit `chat:message` to the room with `io.to(roomCode).emit(...)` — the identical pattern used today by `game:player_passed` and `game:state_snapshot`. No separate namespace, no separate connection, no third-party chat service.

**Why not a dedicated Socket.io namespace?** Namespaces are useful when you need separate auth or different connection lifecycles. Chat here shares auth (same socket.id), the same room, and the same lifecycle as the game. A separate namespace doubles socket overhead with zero benefit at 4-player scale.

**Why not a third-party service (Pusher, Ably, Stream Chat, etc.)?** The codebase constraint is explicit: "no new frameworks without clear justification." Chat backed by a third-party service would introduce: an external dependency, an API key to manage, egress latency, and potential cost. The existing Socket.io server already provides all required primitives.

#### Server-side additions

Add `server/src/socket/chatHandlers.ts` following the exact pattern of `gameHandlers.ts` and `roomHandlers.ts`. Register in `handlers.ts` via a single `registerChatHandlers(socket, io, rooms)` call. The handler:

1. Receives `chat:send` event with `{ roomCode, text }` (or `{ roomCode, reactionId }` for quick reactions).
2. Looks up the room via `rooms.getRoomBySocket(socket.id)` — no extra auth needed.
3. Emits `chat:message` to `io.to(roomCode)` with `{ senderName, senderIndex, text, reactionId, timestamp }`.

No message persistence — messages live only in client memory. When a player refreshes, they lose chat history (acceptable per "no persistence" constraint).

#### Client-side additions

Add a fourth Zustand store: `client/src/store/chatStore.ts`. The three existing stores are not imported from each other — this store follows the same discipline. It holds `messages: ChatMessage[]` and exposes `addMessage` and `clearMessages`.

`useSocket.ts` registers `socket.on('chat:message', ...)` alongside the existing game event handlers and routes into `chatStore`.

UI: A collapsible `ChatPanel` component rendered inside `GameTable.tsx` alongside the existing `ScorePanel`, `RoundEndModal`, `GameEndModal`. No new routing.

**Quick reactions** — a fixed set of preset strings (e.g. "¡Bien jugado!", "¡Paso!", "Suerte") rendered as tap buttons. Emitted as `chat:send` with a `reactionId` field. Server passes through; client renders with special styling. No emoji library needed — use plain Unicode or HTML entities served by the existing Google Fonts stack.

#### Technologies used

| Technology | Version | Role |
|---|---|---|
| socket.io (server) | 4.7.2 (existing) | `chat:send` / `chat:message` events |
| socket.io-client | 4.7.2 (existing) | Emit and receive chat events |
| zustand | 4.4.7 (existing) | `chatStore` — message list state |
| React + Tailwind | 18.2 / 3.4 (existing) | `ChatPanel` component |

**New packages: none.**

---

### Feature 2: Rematch Flow

#### Approach: Server-side room reset, consent protocol on same socket connection

The current "Play Again" button in `GameEndModal.tsx` calls `socket.emit('room:leave', {})` and navigates to `/`. This destroys the room. Rematch replaces this with a vote-then-reset flow that keeps the room alive.

**Why not navigate away and create a new room?** Players would need to re-share the room code. The explicit requirement is "play again without re-sharing room code." The room already exists in-memory; resetting `room.game` and `room.status` back to `'waiting'` (then immediately to `'in_game'` once confirmed) is sufficient.

#### Consent protocol (server)

All 4 players must confirm. The server holds a `rematchVotes: Set<string>` (socket IDs) on the `Room` object. When all 4 have voted:

1. Reset `room.game = null`, `room.status = 'waiting'` momentarily, then immediately start a new game (same as `game:start` handler logic — shuffle, deal, find first player).
2. Emit `game:started` with personalized states to all players. Clients navigate to `/game` via the existing `useSocket` handler (no change needed on client).

**Why not require only the host to confirm?** Four friends need to all agree — forcing one player back into a game they want to leave would be poor UX. Standard pattern for casual multiplayer.

**Timeout on votes:** If not all players vote within 30 seconds, clear the vote set and notify with `rematch:declined`. This prevents a room from being stuck if a player disconnects during the vote phase.

#### Server-side additions

Extend `Room` type in `GameState.ts`:

```typescript
rematchVotes: Set<string>  // socket IDs who have voted for rematch
```

Add `rematch:vote` handler in `roomHandlers.ts` (or a dedicated `rematchHandlers.ts`). Add `rematch:status` server→client event broadcasting how many of 4 have voted. Add `rematch:declined` for timeout/cancellation.

#### Client-side additions

`GameEndModal.tsx` currently has a single "Jugar de Nuevo" button that leaves the room. Replace with:

- "Revancha" button → emits `rematch:vote`
- Waiting state showing vote count (e.g. "3/4 listos")
- "Salir" button → existing `room:leave` behavior for players who don't want to rematch

`uiStore` gains `rematchVoteCount: number` and `waitingForRematch: boolean` fields. These are set by `socket.on('rematch:status', ...)` in `useSocket`.

When `game:started` fires (the existing handler already navigates to `/game` and calls `setGameState`), the rematch is complete — no special case needed on the client. The `chatStore` should also clear on rematch so old chat doesn't bleed into new game.

#### Technologies used

| Technology | Version | Role |
|---|---|---|
| socket.io (server) | 4.7.2 (existing) | `rematch:vote`, `rematch:status`, `rematch:declined` events |
| socket.io-client | 4.7.2 (existing) | Emit vote, receive status |
| zustand (uiStore) | 4.4.7 (existing) | `rematchVoteCount`, `waitingForRematch` fields |

**New packages: none.**

---

### Feature 3: Running Score History Panel

#### Approach: Client-side accumulation of `game:round_ended` payloads

The server already emits `game:round_ended` with `scores`, `winningTeam`, `totalPointsScored`, `reason`, and `handNumber` after each hand. The client currently only shows this data in `RoundEndModal` then discards it. Score history requires keeping these payloads across rounds.

**Why not add score history to `ServerGameState`?** Server state is already broadcast as personalized `ClientGameState` snapshots. Adding an array of round history to the server adds payload size on every `broadcastState` call. The data is already delivered per-round and never needs server authority — it is display-only. Client accumulation is the right call.

#### Client-side additions

`gameStore.ts` gains one new field:

```typescript
roundHistory: RoundEndPayload[]
```

`addRoundToHistory` action appends on each `game:round_ended` event. `resetGame` (already exists) clears this array. No server changes needed.

UI: A collapsible `ScoreHistory` panel (or a tab within the expanded `ScorePanel`). Shows a table with one row per completed hand: Hand #, winner, points scored, running totals. Rendered using plain `<table>` elements with Tailwind classes. No charting library — text table is sufficient and what players actually need to glance at during play.

**Why not a charting library (Recharts, Chart.js, Victory)?** The PROJECT.md decision states "accumulated table only — simple running total is what players actually glance at during play; per-hand detail is v2." A visual chart is explicitly deferred. Adding a charting library (typically 50-200kB gzipped) for a text table is unjustified.

The existing `ScorePanel` bar at the top of `GameTable` is unchanged. The history panel is additive — toggled open via a button in the ScorePanel, or as a collapsible drawer.

#### Technologies used

| Technology | Version | Role |
|---|---|---|
| zustand (gameStore) | 4.4.7 (existing) | `roundHistory` array |
| React + Tailwind | 18.2 / 3.4 (existing) | `ScoreHistory` component |

**New packages: none.**

---

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|---|---|---|---|
| Chat transport | Existing Socket.io channel | Socket.io separate namespace | Same lifecycle/auth; doubles socket overhead with no benefit at 4-player scale |
| Chat transport | Existing Socket.io channel | Third-party service (Pusher, Stream) | Violates "no new frameworks" constraint; adds external dependency, API key, cost |
| Message storage | Client memory only | Server-side message log on Room | Adds unbounded memory growth on server; no persistence requirement; players who disconnect lose history anyway |
| Rematch consent | All-4-players vote | Host-only confirm | Poor UX; forces players back into a game; 4-player agree is standard casual multiplayer pattern |
| Rematch state reset | In-place Room reset | Room teardown + new Room | Violates "rematch without re-sharing code" requirement |
| Score history | Client-side `roundHistory` array | Server-side history in `ServerGameState` | Display-only data; no server authority needed; adds payload size to every state broadcast |
| Score history UI | Plain Tailwind text table | Charting library (Recharts, Chart.js) | PROJECT.md explicitly defers per-hand detail charts to v2; table is sufficient; saves 50-200kB |
| Emoji reactions | Unicode / preset strings | Emoji picker library (emoji-mart) | Preset phrases are lower friction and avoid the 60kB+ cost of a picker library |

---

## Installation

No new packages. All three features install as new TypeScript files within existing workspace structure.

```bash
# Verify current Socket.io version (should be 4.7.2)
npm ls socket.io --workspace=server

# Verify Zustand version (should be 4.4.7)
npm ls zustand --workspace=client
```

---

## Key Architectural Constraints Honored

- **No new npm packages** — all three features built on existing Socket.io, Zustand, React, Tailwind primitives.
- **Server is sole authority** — rematch reset triggered and validated server-side; chat authenticated via existing socket identity (socket.id + name).
- **Store isolation** — `chatStore` added as a fourth independent store; does not import from `gameStore`, `roomStore`, or `uiStore`.
- **Event namespace consistency** — chat events use `chat:` prefix; rematch events use `rematch:` prefix; both follow existing `game:` / `room:` / `connection:` conventions.
- **TypeScript strict** — all new types added to `GameState.ts` (server) and mirrored manually in `client/src/types/game.ts`.

---

## Sources

- Codebase analysis: `/server/src/socket/gameHandlers.ts` — broadcast patterns, event naming conventions
- Codebase analysis: `/server/src/game/RoomManager.ts` — Room structure, lifecycle methods
- Codebase analysis: `/client/src/hooks/useSocket.ts` — client event registration pattern
- Codebase analysis: `/client/src/store/` — Zustand store discipline (isolated stores, no cross-imports)
- Codebase analysis: `/client/src/components/game/GameEndModal.tsx` — current "play again" flow to replace
- Codebase analysis: `/client/src/components/game/ScorePanel.tsx` — score display to extend
- Project constraints: `.planning/PROJECT.md` — "no new frameworks without clear justification", "no persistence", score history table-only decision
- Socket.io 4.x room broadcast API (HIGH confidence — stable since 4.0, confirmed from training data on v4.7.x): `io.to(roomCode).emit(...)` and `socket.to(roomCode).emit(...)` (excludes sender)
- Zustand 4.x store creation pattern (HIGH confidence): `create<Store>(set => ({...}))` — identical to existing stores

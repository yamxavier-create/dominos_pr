# Domain Pitfalls

**Domain:** Real-time multiplayer game social features (chat, rematch, score history) on Socket.io
**Researched:** 2026-03-06
**Confidence:** HIGH (codebase-grounded) / MEDIUM (general Socket.io patterns from training data)

---

## Critical Pitfalls

Mistakes that cause rewrites, data loss, or broken game state.

---

### Pitfall 1: Rematch Race Condition — Both Players Trigger Reset Simultaneously

**What goes wrong:** Two or more players click "Rematch" within milliseconds of each other. The server receives two `game:rematch_vote` events concurrently and starts the reset sequence twice. The second reset runs on a partially-initialized `ServerGameState`, corrupting tile distribution or losing the score tally.

**Why it happens:** There is no guard state between "game ended" and "rematch in progress." The current pattern in `gameHandlers.ts` uses early-return guards like `if (!room?.game) return`, but a half-reset game still has `room.game` populated.

**Consequences:** Duplicate `game:started` emissions to some players; two players may receive different initial hands; accumulated game score is wiped on the first reset and not restored for the second.

**Prevention:**
- Add a `room.rematchPhase: 'idle' | 'voting' | 'starting'` field to the Room type.
- Server only transitions from `'idle'` → `'voting'` → `'starting'` — never backwards without a full vote reset.
- Once `'starting'` is set, all subsequent `game:rematch_vote` events are no-ops.
- Use a single flag, not a counter: the host triggers the actual rematch; others only register readiness.

**Detection (warning signs):**
- Players receive two `game:started` events in quick succession.
- Score panel shows 0-0 at the start of what should be round 2.
- Console shows `broadcastState` called twice within the same tick.

**Phase:** Rematch implementation phase. Must be designed into the state machine before writing any handler code.

---

### Pitfall 2: Chat Messages Contain Unsanitized HTML — React Escape Is Not Enough

**What goes wrong:** Player names and chat messages are displayed in React JSX, which does escape HTML by default. However, the existing codebase already has a known gap: player names are only trimmed on the server (`roomHandlers.ts:8`), with no length enforcement or character stripping beyond the client-side `maxLength` attribute. Chat text — which is longer and more varied — will share this same path. A message containing `<script>` or SQL-style payloads is harmless in JSX rendering, but becomes dangerous if the message is ever: (a) passed to `dangerouslySetInnerHTML` for rich text or emoji rendering, (b) logged server-side and viewed in a log viewer that renders HTML, or (c) stored and later used in a non-React context.

**Why it happens:** React's JSX escaping is a defense at the render layer only. The raw strings still travel over the socket, are stored in memory, and are re-emitted to other players without sanitization. A future developer adds emoji rendering via `innerHTML` without realizing the data is untrusted.

**Consequences:**
- If `dangerouslySetInnerHTML` is ever used for emoji rendering (a common pattern for quick reactions): stored XSS across the room.
- Player names with angle brackets break downstream tooling.

**Prevention:**
- Server-side: validate chat message length (e.g., max 200 chars) and strip non-printable characters before re-emitting to the room. Apply same validation to player names (CONCERNS.md already flags this).
- Client-side: never use `dangerouslySetInnerHTML` for any user-supplied content, including emoji/reaction strings. Use a static emoji map keyed by reaction ID instead (`{ thumbsup: '👍', ... }` — client renders the emoji; server only stores the key).
- Apply a single shared `sanitizeText(input: string): string` utility on the server used for both player names and chat.

**Detection:** Attempt to send a message containing `<b>bold</b>` — it should render as literal text, not bold.

**Phase:** Chat implementation. Must be done before the feature ships.

---

### Pitfall 3: Late-Join / Reconnect Gets No Chat History

**What goes wrong:** A player disconnects mid-game and reconnects. The existing reconnect path in `roomHandlers.ts` sends the current `game:state_snapshot` only. Chat messages sent during the disconnection are lost to that player — they rejoin mid-conversation with no context.

**Why it happens:** Chat state is not part of `ServerGameState` or `Room`. There is no chat buffer to include in the reconnect payload. The reconnect path (`roomHandlers.ts:36`) already has a known tech debt issue (dynamic `require` instead of static import), so adding chat to this path without fixing that issue first risks a silent runtime crash.

**Consequences:** Reconnected players are confused; they see ongoing conversation without prior messages. For quick reactions, they miss acknowledgments of game events that already happened.

**Prevention:**
- Add a `chatLog: ChatMessage[]` array to the `Room` object (not `ServerGameState` — chat persists across hands).
- Cap at last 50 messages (memory bound for in-process storage).
- On reconnect, include `chatLog` in the reconnect payload alongside the game state snapshot.
- Fix the dynamic `require` in `roomHandlers.ts:36` before touching the reconnect path (CONCERNS.md flags this).

**Detection:** Send 3 chat messages, disconnect, reconnect — verify all 3 appear in the chat panel.

**Phase:** Chat implementation. History replay must be built from day one, not added later.

---

### Pitfall 4: Score History Shows Stale Data After Blocked Game or Capicú

**What goes wrong:** The score panel reads accumulated totals from `ClientGameState`. After a blocked game (`handleBlockedGame`) or a Capicú/Chuchazo win, the score update is sent as part of `game:round_ended`, not as a `game:state_snapshot`. If the score panel reads from `gameStore.gameState.scores` (which is the in-play state) rather than `gameStore.roundEndPayload.scores`, it will display the pre-round score until the next hand starts.

**Why it happens:** `broadcastStateWithAction` sends the final board state, but scores are only finalized in the `game:round_ended` payload. There are two score sources and the panel may read the wrong one depending on timing.

**Consequences:** Score panel shows 0-0 or last round's score during the round-end modal, which is the exact moment players are most likely to look at it.

**Prevention:**
- Define one canonical score source for the panel: use `game:round_ended` payload scores when `roundEndPayload` is non-null (modal is showing), fall back to `gameState.scores` during active play.
- Never derive display scores by summing `gameState.board` or player tile counts client-side — always use what the server sends.
- Include cumulative game score (not just round delta) in every `game:state_snapshot` so the running panel always has current data.

**Detection:** Play out a blocked game. Verify the score panel updates before or at the same moment the round-end modal appears.

**Phase:** Score history panel implementation.

---

### Pitfall 5: Animation Regression When Fixing Left-End Tile Bug

**What goes wrong:** The known animation bug (`useSocket.ts:56`) reads `board.tiles[board.tiles.length - 1]` to find the newest tile. The fix is to find the tile with the maximum `sequence`. This change touches the same code path that drives `lastTileSequence` in `gameStore`, which is used by `BoardTile` to trigger the CSS flash animation. An incorrect fix (e.g., using `Math.max` but forgetting to handle an empty board, or using `find` instead of `reduce` and missing ties) will silently break animations for ALL tile plays, not just left-end plays.

**Why it happens:** Zero test coverage. `computeSnakeLayout` and the animation sequence are purely visual and untested. Any regression is invisible until a human playtests the exact scenario.

**Consequences:** No tile highlight animation ever plays, or it plays on the wrong tile for every right-end play (regression introduced by the fix).

**Prevention:**
- Before changing `useSocket.ts:56`, write a test or inline assertion verifying the current behavior for right-end plays.
- The fix (`Math.max(...board.tiles.map(t => t.sequence))`) must guard for empty array: `board.tiles.length === 0 ? null : Math.max(...)`.
- After the fix, manually verify: (a) right-end play flashes correct tile, (b) left-end play flashes correct tile, (c) first-tile play (board was empty before) does not throw.
- This is an isolated change — do not bundle it with any board layout refactoring or `SNAKE_CAP` constant changes. The snake layout fragility (CONCERNS.md: pixel constants) makes combined changes dangerous.

**Detection (regression):** Play a right-end tile immediately after the fix is applied and verify the rightmost tile flashes.

**Phase:** Bug fix phase (first, before social features). Must not be bundled with layout changes.

---

### Pitfall 6: Rematch Resets Game Score Instead of Accumulating It

**What goes wrong:** "Rematch" is ambiguous: does it mean "play another hand in this session" (accumulating score) or "start fresh" (resetting score to 0-0)? The existing `GameEndModal` offers "Jugar de Nuevo" which calls `room:leave` and sends players to `/`. If rematch is implemented as a room-level game reset, the score must be explicitly preserved or explicitly cleared — whichever is intended. Getting this wrong means the score panel shows incorrect accumulated totals or resets mid-session.

**Why it happens:** `ServerGameState` is re-created by `game:start` handler which initializes scores to zero. A rematch handler that re-uses this same initialization path will wipe scores. The distinction between "new hand" (score accumulates) and "new game" (score resets) must be explicit in the server state machine.

**Consequences:** Players who won game 1 see the score reset; they have no evidence of their victory. Alternatively, if scores accidentally carry over, game 2 starts in a winning state.

**Prevention:**
- Define clearly in the `Room` type: `gameScore: { team0: number, team1: number }` persists across rematches (session-level); `ServerGameState.scores` is per-game.
- Rematch creates a new `ServerGameState` (fresh) but increments `room.gameScore` based on the completed game's winner.
- The score history panel displays `room.gameScore` (session wins), not `game.scores` (current game points).

**Detection:** Win a game, trigger rematch, verify the score panel shows the session win record without wiping to 0-0.

**Phase:** Rematch implementation.

---

## Moderate Pitfalls

---

### Pitfall 7: Chat Spam Floods Other Players

**What goes wrong:** Any player can emit `chat:message` at unlimited frequency. A single player can send hundreds of messages per second, flooding the other three players' chat panels and causing React to re-render at unacceptable frequency.

**Why it happens:** No rate limiting exists on any socket event (CONCERNS.md already flags this for `game:play_tile`). Chat is a higher-frequency event type and more easily abused because there is no server-side validation (unlike tile plays, which must match `getValidPlays()`).

**Prevention:**
- Server: token-bucket rate limit per `socket.id` for `chat:message` — e.g., 5 messages per 3 seconds. Drop excess without error (or send a soft `chat:throttled` event to the sender only).
- Client: debounce the send button and disable it for 500ms after each send.
- Cap message length at 200 characters server-side (not just client-side `maxLength`).

**Detection:** Emit 20 `chat:message` events in 1 second from the browser console and observe server behavior.

**Phase:** Chat implementation.

---

### Pitfall 8: Partial Rematch State — One Player Disconnects After Voting

**What goes wrong:** Player A votes to rematch. Player B disconnects before voting. The server has 1/4 votes. Player B reconnects. The server now has their socket ID registered again but their vote status is lost — they appear as "not voted" and the rematch never proceeds unless they vote again. Worse, if the server counted B's reconnect as a new player, it may now show 1/5 votes.

**Why it happens:** Rematch vote state is transient and tied to socket IDs. Reconnection re-uses name-based matching (CONCERNS.md), so the socket ID changes but the seat is preserved. Vote state keyed by old socket ID is now orphaned.

**Prevention:**
- Key rematch votes by seat index (0-3), not socket ID. On reconnect, the seat is the stable identifier.
- Include current vote state in the reconnect payload so the reconnecting player sees what they missed.
- Set a rematch vote timeout (e.g., 60 seconds) — if not all four vote, auto-cancel and return to post-game state.

**Detection:** Player A votes, Player B disconnects and reconnects — verify B can still cast their vote and the count doesn't corrupt.

**Phase:** Rematch implementation.

---

### Pitfall 9: Score Panel Causes Unnecessary Re-renders During Active Play

**What goes wrong:** The score history panel subscribes to `gameStore`. Every `game:state_snapshot` updates `gameStore`, which triggers a re-render of everything subscribed to that store — including the score panel, even when scores have not changed. At 28 tile plays per hand, this is 28 unnecessary score panel re-renders.

**Why it happens:** `gameStore` is a monolithic Zustand store. Components subscribed to it receive all updates. The existing `computeSnakeLayout` memoization issue (CONCERNS.md) is the same root cause.

**Prevention:**
- Use Zustand selector subscriptions: `const scores = useGameStore(s => s.gameState?.scores)` — this will only re-render when `scores` itself changes (once per round end).
- Do not create a separate store for scores — the three-store pattern must be preserved (ARCHITECTURE.md).

**Detection:** Add a render counter to the score panel component and play through a full hand — it should re-render at most once per round end, not once per tile play.

**Phase:** Score panel implementation.

---

### Pitfall 10: `isHost` Bug Breaks Rematch Trigger

**What goes wrong:** The existing `isHost` bug in `RoundEndModal.tsx:20` (CONCERNS.md) — which computes host incorrectly as `players[0].connected && myPlayerIndex === 0` — will affect the rematch UI in exactly the same way it already breaks "Siguiente Mano." If rematch uses the same pattern, the "Rematch" button may never appear after a host transfer.

**Why it happens:** The server does not expose `isHost` in the client payload. The client guesses based on seat index, which is wrong after host promotion.

**Consequences:** After the original host disconnects and host promotion occurs, no player sees a rematch button — the game is stuck.

**Prevention:**
- Fix `isHost` before implementing rematch. The fix is documented in CONCERNS.md: expose `hostSocketId` or a per-player `isHost: boolean` in the room info payload.
- All host-gated actions (next hand, rematch) must use this server-authoritative flag, not a client-side seat-index guess.

**Detection:** Original host (seat 0) leaves lobby; confirm seat 1 is promoted; trigger game end; verify the rematch button appears for seat 1, not seat 0.

**Phase:** Must be fixed before rematch UI is built. Ideally fixed in the bug-fix phase.

---

### Pitfall 11: `selectedTileId` Leak Interferes with Chat Input Focus

**What goes wrong:** The existing `selectedTileId` bug (CONCERNS.md) — where a selected tile ID is not cleared when the turn changes — can interact with the chat input. If a player selects a tile, then opens the chat panel and types, the board end badges may remain active for one render cycle. Pressing Enter to send a chat message could fire a board-end click handler if focus management is not explicit.

**Why it happens:** `uiStore.selectedTileId` is global and not scoped to the game board. Adding chat input (which uses keyboard events) without clearing `selectedTileId` on focus-out from the board creates ambiguous key-event routing.

**Prevention:**
- Fix the `selectedTileId` clear-on-turn-change bug (CONCERNS.md) before adding chat.
- Additionally, clear `selectedTileId` whenever the chat input receives focus.
- End badge click handlers must check `isMyTurn` before acting — they already should, but verify this guard exists.

**Detection:** Select a tile (two-step placement mode), then immediately open chat and press Enter — confirm no tile is played.

**Phase:** Chat implementation.

---

## Minor Pitfalls

---

### Pitfall 12: Chat Messages Arrive Out of Order for Slow Clients

**What goes wrong:** Socket.io guarantees message ordering per-connection over TCP, but if a player's connection is slow, they may receive a `game:state_snapshot` (large payload) and a `chat:message` (small payload) in a different order than the server sent them. The chat message appears before the board state that prompted it.

**Why it happens:** Socket.io multiplexes events on a single connection. Large payloads are fragmented; small payloads may be enqueued after. In practice this is rare and cosmetic only.

**Prevention:** Add a server-assigned `timestamp` (or monotonic `seq` counter) to each `ChatMessage`. Client renders messages sorted by timestamp. No reordering of game events is needed — this is cosmetic for chat only.

**Detection:** Low-priority; test on a throttled connection (Chrome DevTools Network → Slow 3G).

**Phase:** Chat implementation — minor addition to the message schema.

---

### Pitfall 13: Rematch Offer Shown After Server Restart Loses Room

**What goes wrong:** A server restart during the post-game state clears all in-memory rooms. If a client shows a rematch modal and the player clicks "Rematch," the `game:rematch_vote` event goes to a server that has no record of that room. The server silently returns (early-return guard: `if (!room) return`). The client is stuck on the rematch modal with no feedback.

**Why it happens:** In-process room state is acknowledged as acceptable for v1 (PROJECT.md). The gap is that the client has no mechanism to detect that the room it was in no longer exists.

**Prevention:**
- Server should emit `room:error` with code `ROOM_NOT_FOUND` for any event received after the room is gone (currently it silently returns for most event types).
- Client: if `room:error` with `ROOM_NOT_FOUND` is received during the game or post-game phase, navigate to `/` and display a message like "La sala ya no existe."

**Detection:** Start dev server, complete a game, restart server, click rematch — verify client shows an error and navigates home rather than hanging.

**Phase:** Rematch implementation. Low-effort guard with high UX payoff.

---

### Pitfall 14: Score Panel Accumulates Across Server-Restart Boundary

**What goes wrong:** Related to Pitfall 13. If in-memory room state is lost (server restart) and players somehow rejoin with the same room code (impossible with the current UUID-based codes, but possible if codes are manually reused), the score panel might show stale accumulated scores from `gameStore` (client state) while the server starts fresh at 0-0.

**Why it happens:** Client Zustand state persists across reconnects within the same browser session. If the server restarts and emits a fresh `game:started` with 0-0 scores, `gameStore` must fully overwrite (not merge) the previous state.

**Prevention:** `setGameState` in `gameStore` must be a full replacement, not a partial merge (`Object.assign`). Verify the Zustand setter replaces rather than merges.

**Detection:** Complete a game, restart server, trigger a new game in the same browser tab — confirm score panel shows 0-0, not leftover totals.

**Phase:** Score panel implementation.

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| Animation bug fix (left-end tile) | Regression breaks all tile flash animations | Fix in isolation; verify right-end play still animates correctly; do not bundle with layout changes |
| Animation bug fix | Empty board edge case in `Math.max` | Guard for `board.tiles.length === 0` before computing max sequence |
| Chat — message schema | Missing `timestamp`/`seq` causes ordering ambiguity | Include server-assigned timestamp in every `ChatMessage` from day one |
| Chat — server validation | Unsanitized text reaches `dangerouslySetInnerHTML` if quick reactions use innerHTML | Use static emoji map keyed by ID; never pass user text to `dangerouslySetInnerHTML` |
| Chat — reconnect | Late joiners miss history | Add `chatLog: ChatMessage[]` to `Room`; send on reconnect; fix `roomHandlers.ts:36` dynamic require first |
| Chat — spam | Unlimited emit rate floods clients | Token-bucket rate limit per socket ID; debounce send button |
| Rematch — voting | Concurrent votes corrupt state | Guard with explicit `rematchPhase` state machine; host triggers start |
| Rematch — disconnect during vote | Vote count corrupts after reconnect | Key votes by seat index, not socket ID |
| Rematch — isHost display | Wrong player sees rematch button | Fix `isHost` bug (CONCERNS.md) before building rematch UI |
| Rematch — score semantics | Score resets instead of accumulating | Separate session score (`room.gameScore`) from per-game score (`game.scores`) |
| Score panel — data freshness | Panel shows pre-round scores at round end | Canonical source: `roundEndPayload.scores` during modal, `gameState.scores` during play |
| Score panel — performance | Re-renders on every tile play | Zustand selector subscription to `scores` field only |
| All new events | No rate limiting on any socket event | Apply per-socket limits to `chat:message`, `game:rematch_vote` at minimum |
| All new server state | `isHost` computed client-side from seat 0 | Fix server payload to include authoritative `isHost` flag before any host-gated feature |

---

## Sources

- CONCERNS.md (codebase audit, 2026-03-06) — all fragile areas, known bugs, and tech debt referenced directly
- ARCHITECTURE.md (codebase audit, 2026-03-06) — data flow, store isolation constraints, handler patterns
- PROJECT.md (2026-03-06) — scope constraints (no persistence, no auth)
- Training knowledge of Socket.io multiplayer patterns, React state management pitfalls, and XSS attack vectors (MEDIUM confidence for general patterns; HIGH confidence where grounded in the specific codebase)

---

*Pitfalls analysis: 2026-03-06*

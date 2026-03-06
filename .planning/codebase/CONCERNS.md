# Codebase Concerns

**Analysis Date:** 2026-03-06

---

## Tech Debt

**CommonJS `require()` inside ESM TypeScript server module:**
- Issue: `roomHandlers.ts` uses a dynamic `require('../game/GameEngine')` inside an async reconnect branch instead of a static ES import. This bypasses TypeScript's type checking for that call site and is a pattern inconsistency (the entire server is otherwise ESM-style TypeScript).
- Files: `server/src/socket/roomHandlers.ts:36`
- Impact: The `buildClientGameState` call here is untyped at compile time. A rename or signature change in `GameEngine.ts` will not produce a type error here and could cause a silent runtime crash for reconnecting players.
- Fix approach: Move `buildClientGameState` to a static top-level import alongside the other `GameEngine` imports. The dynamic require exists likely to avoid a circular dependency concern that does not actually exist.

**Disconnection handler duplicates `leaveRoom` logic:**
- Issue: `server/src/index.ts` socket `disconnect` handler calls `rooms.leaveRoom(socket.id)` and then also re-broadcasts state manually, which partially duplicates what `roomHandlers.ts` `room:leave` already does. If `leaveRoom` behavior changes, both paths must be updated.
- Files: `server/src/index.ts:40-68`, `server/src/socket/roomHandlers.ts:52-58`
- Impact: Logic drift risk. If host-promotion logic is added to `leaveRoom`, the disconnect path might not call it.
- Fix approach: Extract a shared `handlePlayerLeave(socketId, io, rooms)` function used by both the `room:leave` event handler and the `disconnect` handler.

**`game:next_hand` starter logic is unreliable:**
- Issue: `gameHandlers.ts` comment block (lines 386–393) shows unresolved ambiguity about what `handStarterIndex` represents between rounds. After a played-out hand, `nextStarterIndex` in the `game:round_ended` payload is `player.index` (the winner), but `game.handStarterIndex` is never updated to this new value before the `game:next_hand` handler reads it. The value used (`newStarterIdx = game.handStarterIndex`) is the starter of the *previous* hand, not the winner.
- Files: `server/src/socket/gameHandlers.ts:360-415`
- Impact: The wrong player goes first in hand 2+. The winner of the previous hand should start the next hand, but the server starts the old starter again.
- Fix approach: After a played-out win, set `game.handStarterIndex = player.index` before the round ends, so `game:next_hand` inherits the correct starter.

**`forcedFirstTileId = ''` sentinel is fragile:**
- Issue: For hands 2+, `game.forcedFirstTileId` is set to `''` (empty string) as a signal meaning "no forced tile." `getValidPlays` in `GameEngine.ts` handles `!firstPlayMade` by looking up this ID in the hand — an empty string will simply never match, effectively allowing any tile. This is an implicit contract, not an explicit parameter.
- Files: `server/src/socket/gameHandlers.ts:405`, `server/src/game/GameEngine.ts:100-104`
- Impact: Fragile: any refactor of `getValidPlays` that assumes `forcedFirstTileId` is always a valid tile ID could break turn-1 behavior for hands 2+. Also confuses readers.
- Fix approach: Add an explicit `forced: boolean` flag to `ServerGameState`, or pass `null` instead of `''` and handle it in `getValidPlays`.

**`useSocket` dependency array is empty (`[]`):**
- Issue: The `useSocket` hook registers all socket event listeners in a `useEffect` with an empty dependency array, but the callbacks close over `navigate`, `setGameState`, `setRoom`, etc. from the outer scope. In React Strict Mode (or any future refactor that makes these non-stable), stale closures could cause subtle bugs.
- Files: `client/src/hooks/useSocket.ts:100`
- Impact: Low risk in current form because Zustand setters and `useNavigate` are stable references, but the pattern is non-idiomatic and will confuse linters if ESLint with exhaustive-deps is ever added.
- Fix approach: Either document why the empty array is intentional (all captured values are stable) or use `useCallback` + `useRef` for stable handlers.

**Reconnection is name-only, no authentication:**
- Issue: `RoomManager.joinRoom` matches a reconnecting player solely by display name (`p.name === playerName && !p.connected`). Any user can claim a disconnected seat by guessing or reusing the same name.
- Files: `server/src/game/RoomManager.ts:47`
- Impact: Identity spoofing — a malicious player can rejoin as a disconnected player and see their hand.
- Fix approach: Assign a session token on first join (stored in `localStorage`) and verify it on reconnect.

---

## Known Bugs

**Animation highlight targets wrong tile after left-end plays:**
- Symptoms: When a tile is played on the `left` end, it is prepended to `board.tiles` (index 0). The animation code reads `gameState.board.tiles[gameState.board.tiles.length - 1]` (the last element) to find the "newest" tile's sequence. For right-end plays this is correct; for left-end plays it reads the old rightmost tile.
- Files: `client/src/hooks/useSocket.ts:56`
- Trigger: Play any tile on the left end of the board.
- Workaround: None. The tile flash goes to the wrong tile.
- Fix approach: Find the tile with `sequence === Math.max(...board.tiles.map(t => t.sequence))` rather than using array position.

**`isHost` determination in `RoundEndModal` is wrong:**
- Symptoms: `isHost` is computed as `room?.players[0]?.connected && myPlayerIndex === 0`. This checks `players[0].connected` (the first element in the room player list) not whether the *local player* is the host. If the original host disconnected and host was transferred, seat 0 might be a non-host or missing entirely.
- Files: `client/src/components/game/RoundEndModal.tsx:20`
- Trigger: Host disconnects mid-game; host promotion is never surfaced to the client.
- Workaround: None. The "Siguiente Mano" button may never appear or appear for the wrong player.
- Fix approach: Expose `hostSocketId` or a `isHost` boolean in the room info payload sent to the client.

**`game:next_hand` event is not restricted to host only (client enforcement only):**
- Symptoms: The server handler for `game:next_hand` checks `room.hostSocketId !== socket.id` (line 362) and returns silently if not host — this is correct. However the client shows the "Siguiente Mano" button only to `myPlayerIndex === 0`, not to the actual host after host promotion. A non-host at seat 0 could theoretically emit the event from the browser console.
- Files: `server/src/socket/gameHandlers.ts:362`, `client/src/components/game/RoundEndModal.tsx:20`
- Impact: Not exploitable beyond advancing game state prematurely (no score manipulation), but the client check is wrong.

**`selectedTileId` not cleared on turn change:**
- Symptoms: If a player selects a tile (two-step placement mode) and then the turn switches to another player (e.g. rapid game update), the `selectedTileId` remains set in `uiStore`. On the next state snapshot the end badges will incorrectly show as clickable for one render cycle.
- Files: `client/src/store/uiStore.ts`, `client/src/hooks/useSocket.ts:49-60`
- Trigger: Race between tile selection and incoming state snapshot.
- Workaround: Server validates play anyway; incorrect click is rejected.
- Fix approach: In `useSocket.ts` `game:state_snapshot` handler, call `setSelectedTile(null)` when `!gameState.isMyTurn`.

---

## Security Considerations

**No rate limiting on socket events:**
- Risk: Any client can spam `game:play_tile`, `room:create`, or `room:join` events at unlimited frequency. A single client could create thousands of rooms or attempt to brute-force room codes.
- Files: `server/src/socket/gameHandlers.ts`, `server/src/socket/roomHandlers.ts`
- Current mitigation: None.
- Recommendations: Add per-socket rate limiting (e.g. `socket.io-rate-limiter` or a simple token bucket per `socket.id`) and limit room creation to ~5/minute.

**CORS `CLIENT_ORIGIN` defaults to `http://localhost:5173` in production if env var is missing:**
- Risk: If `CLIENT_ORIGIN` env var is not set in the production environment, the server defaults to `http://localhost:5173`. Socket.io CORS will reject all production client connections, breaking the app silently.
- Files: `server/src/config.ts:6`
- Current mitigation: None — the default is not production-safe.
- Recommendations: Fail fast: throw an error if `NODE_ENV === 'production'` and `CLIENT_ORIGIN` is not set. Or use `'*'` in production when serving the client from the same origin (which is the case — Express serves the static build).

**Player names are not sanitized beyond `.trim()`:**
- Risk: A player can use names containing HTML/script-like content. While React's JSX escapes output, names are also emitted in Socket.io events and stored server-side without any length enforcement beyond the client-side `maxLength={16}` input attribute.
- Files: `server/src/socket/roomHandlers.ts:8`, `server/src/game/RoomManager.ts:61`
- Current mitigation: Client-side `maxLength` only (can be bypassed via raw socket emit).
- Recommendations: Validate `playerName.length <= 20` and strip non-printable characters server-side.

**Room state stored entirely in-process memory:**
- Risk: Server restart loses all active games. No persistence layer.
- Files: `server/src/game/RoomManager.ts`
- Current mitigation: 10-minute cleanup interval handles abandoned rooms. Active games are lost on crash.
- Recommendations: Acceptable for a casual game; document it. For production, consider Redis for session state.

---

## Performance Bottlenecks

**`buildClientGameState` called once per connected player per state change:**
- Problem: After every tile play, `broadcastState` iterates all 4 players and calls `buildClientGameState` 4 times, then calls `getValidPlays` inside each call. `getValidPlays` does a linear scan over the hand for each board end. With 28 tiles this is trivial, but the pattern of recomputing game state 4x on every action does not scale if rooms increase.
- Files: `server/src/game/GameEngine.ts:325-358`, `server/src/socket/gameHandlers.ts:31-54`
- Cause: Personalized payloads require separate serialization per player.
- Improvement path: Acceptable at current scale (4 players, ≤28 tiles). Document the design choice.

**`computeSnakeLayout` recalculates entire board on every render:**
- Problem: `GameBoard.tsx` calls `computeSnakeLayout(board.tiles, dims.w, dims.h)` on every render. With 28 tiles this is O(n) computation inside JSX render. No memoization with `useMemo`.
- Files: `client/src/components/board/GameBoard.tsx:156`
- Cause: Layout is a pure function of `board.tiles` and container dims, making it an easy memoization candidate.
- Improvement path: Wrap with `useMemo(() => computeSnakeLayout(board.tiles, dims.w, dims.h), [board.tiles, dims.w, dims.h])`.

---

## Fragile Areas

**Snake layout corner detection depends on pixel constants:**
- Files: `client/src/components/board/GameBoard.tsx:9,43`, `client/src/components/board/BoardTile.tsx`
- Why fragile: `SNAKE_CAP = 560` and tile pixel dimensions (`TILE_H_W = 52`, etc.) are magic constants spread across two files. If tile sizes change for responsive design, the snake layout will break without a compile error — rows will wrap at wrong positions.
- Safe modification: Always update `SNAKE_CAP` and tile dimension constants together. `SNAKE_CAP` should be derived from tile dimensions, not hardcoded separately.
- Test coverage: None — layout is purely visual and untested.

**`processAutoPassCascade` loop limited to 4 iterations:**
- Files: `server/src/socket/gameHandlers.ts:68`
- Why fragile: The function loops `for (let i = 0; i < 4; i++)` which assumes a maximum of 4 consecutive auto-passes (one per player). This is correct for the 4-blocked-game detection (4 consecutive passes = blocked). However, the loop body calls `nextPlayerIndex(idx)` which advances `idx`, and after the loop exits (not via `return`) it falls through to `handleBlockedGame`. If `isGameBlocked` is triggered inside the loop at `i < 3`, `handleBlockedGame` is returned early. The fallthrough at line 123 is a safety net but is also a potential hidden code path that could be reached if game logic changes.
- Safe modification: Add an explicit `unreachable` comment at line 122 and a server log warning if that branch is ever hit.

**`RoomManager.leaveRoom` re-indexes seats during waiting phase:**
- Files: `server/src/game/RoomManager.ts:83`
- Why fragile: When a player leaves the lobby, seats are re-indexed (`room.players.forEach((p, i) => { p.seatIndex = i })`). This means the player at seat 2 becomes seat 1 if seat 1 leaves. Any client that stored its own `myPlayerIndex` before this re-index will have a stale seat number. The client receives a `room:updated` event but the `myPlayerIndex` stored in `roomStore` is not updated.
- Safe modification: When re-indexing, emit individual seat reassignment events, or include each player's new index in `room:updated` keyed by socket ID.
- Test coverage: None.

**`useSocket` hook mounts once at app root but socket cleanup only removes listeners:**
- Files: `client/src/hooks/useSocket.ts:87-99`
- Why fragile: Cleanup removes event listeners with `socket.off(eventName)` (no-arg form), which removes ALL listeners for that event. If multiple components ever register the same socket event (unlikely now but possible), cleanup would remove others' listeners too.
- Safe modification: Pass the specific handler function to `socket.off(event, handler)` instead of the no-argument form.

---

## Missing Critical Features

**No disconnection handling during active turn:**
- Problem: If it is a player's turn and they disconnect, the game is permanently stalled — there is no timeout to auto-pass or auto-play for a disconnected player. Connected players cannot do anything.
- Blocks: Game completion if any player loses connectivity during their turn.
- Files: `server/src/index.ts:40-68`, `server/src/socket/gameHandlers.ts`
- Suggested approach: On disconnect, if the disconnected player is `currentPlayerIndex` and `game.phase === 'playing'`, start a 30-second timer. If they have not reconnected by then, trigger an auto-pass cascade as if they passed.

**No client-side notification of disconnect/reconnect beyond console.log:**
- Problem: `connection:player_disconnected` and `connection:player_reconnected` events are received in `useSocket.ts` but only logged to the browser console. No UI indicator is shown to players (beyond the `connected: false` flag in `ClientGameState.players`, which is displayed via `PlayerSeat` component only if the component reads it).
- Files: `client/src/hooks/useSocket.ts:79-85`
- Blocks: Players have no actionable feedback when an opponent disconnects.

**No "play again in same room" flow:**
- Problem: `GameEndModal` only offers "Jugar de Nuevo" which calls `room:leave` and redirects to `/`. Players must share a new room code for a rematch. There is no server-side support for resetting a room for a new game without re-joining.
- Files: `client/src/components/game/GameEndModal.tsx:22-29`, `server/src/socket/gameHandlers.ts`

---

## Test Coverage Gaps

**Zero test files exist:**
- What's not tested: Entire codebase — all game logic, socket handlers, scoring, board layout.
- Files: All files under `server/src/` and `client/src/`.
- Risk: Any regression in `GameEngine.ts` scoring, `processAutoPassCascade`, or `buildClientGameState` state filtering is undetectable without manual playtesting.
- Priority: High — `calculateBlockedResult`, `isCapicu`, `applyPassBonus200`, and `getValidPlays` are pure functions that are excellent unit test targets with no test infra needed beyond a basic test runner.

**Capicú detection not covered by any test:**
- What's not tested: The `isCapicu` function in `GameEngine.ts` involves a specific board-end matching condition. Corner cases (double tiles, single-tile board) are not tested.
- Files: `server/src/game/GameEngine.ts:255-263`
- Risk: Silent scoring error for Capicú in Modo 500.
- Priority: High.

**Snake layout has no visual regression tests:**
- What's not tested: `computeSnakeLayout` in `GameBoard.tsx` — corner tile rotation, row wrapping, centering offset.
- Files: `client/src/components/board/GameBoard.tsx:38-120`
- Risk: Visual layout breaks silently on tile dimension or `SNAKE_CAP` changes.
- Priority: Medium.

---

## Dependencies at Risk

**All dependencies pinned to caret ranges, no lockfile integrity enforcement in CI:**
- Risk: `^4.7.2` for `socket.io`/`socket.io-client` means a minor version bump could introduce breaking transport changes. There is no CI pipeline to catch this.
- Impact: Potential client/server socket.io version mismatch if one workspace is updated independently.
- Migration plan: Pin exact versions (`4.7.2`) or add a CI check that both `socket.io` and `socket.io-client` share the same version.

**`tsx` used for server hot-reload in development:**
- Risk: `tsx` (`^4.6.2`) is a dev-only tool. If it has a bug that silently ignores TypeScript errors during dev, broken code could reach production (production build uses `tsc` which is strict).
- Impact: Low — dev ergonomics only. Production path through `tsc` is safe.

---

*Concerns audit: 2026-03-06*

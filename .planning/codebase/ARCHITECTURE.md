# Architecture

**Analysis Date:** 2026-03-06

## Pattern Overview

**Overall:** Real-time multiplayer client-server with event-driven Socket.io communication

**Key Characteristics:**
- No REST API — all game state flows exclusively through Socket.io events
- Server is sole authority: game logic, scoring, and valid move computation live only server-side
- Personalized state projection: server sends each player a filtered `ClientGameState` where only their own tiles are populated
- Pure-function game engine: `GameEngine.ts` has zero I/O or side effects; all mutation happens in `gameHandlers.ts`
- Three isolated Zustand stores on the client that never import from each other

**Note:** The root directory also contains a Flutter/Dart project (leftover from an earlier prototype) with `lib/`, `pubspec.yaml`, `android/`, `ios/`, etc. The active codebase is the `client/` + `server/` npm workspace. Flutter artifacts can be ignored.

## Layers

**Game Engine (Pure Functions):**
- Purpose: All game rules, scoring, board mutation, and valid-play calculation
- Location: `server/src/game/GameEngine.ts`
- Contains: `generateDoubleSixSet`, `shuffleTiles`, `dealTiles`, `findFirstPlayer`, `getValidPlays`, `applyTileToBoard`, `calculatePlayOutPoints`, `calculateBlockedResult`, `calculateMode500Bonuses`, `applyPassBonus200`, `isCapicu`, `isChuchazo`, `buildClientGameState`
- Depends on: `server/src/game/GameState.ts` types only
- Used by: `server/src/socket/gameHandlers.ts`

**Game State (Type Definitions):**
- Purpose: Shared type contracts for server state, client state, and socket payloads
- Location: `server/src/game/GameState.ts`
- Contains: `Tile`, `BoardTile`, `BoardState`, `ServerGameState`, `Room`, `RoomPlayer`, `ClientPlayer`, `ClientGameState`, `GameAction`
- Depends on: Nothing
- Used by: All server modules; mirrored manually in `client/src/types/game.ts`

**Room Manager (Lifecycle):**
- Purpose: Room creation, seat assignment, player reconnection, host promotion, stale-room cleanup
- Location: `server/src/game/RoomManager.ts`
- Contains: `RoomManager` class with `createRoom`, `joinRoom`, `leaveRoom`, `getRoom`, `getRoomBySocket`, `getRoomInfo`, `cleanup`
- Depends on: `server/src/game/GameState.ts`
- Used by: `server/src/socket/handlers.ts`, `server/src/index.ts`

**Socket Handlers (Server-Side Mutation):**
- Purpose: Handle client events, mutate `ServerGameState`, broadcast updated state
- Location: `server/src/socket/gameHandlers.ts`, `server/src/socket/roomHandlers.ts`, `server/src/socket/handlers.ts`
- Contains: `registerGameHandlers` (game:start, game:play_tile, game:next_hand), `registerRoomHandlers` (room:create, room:join, room:leave), `processAutoPassCascade`, `handleBlockedGame`, `broadcastState`, `broadcastStateWithAction`
- Depends on: `GameEngine.ts`, `RoomManager.ts`, `GameState.ts`
- Used by: `server/src/index.ts` via `registerHandlers`

**Server Entry Point:**
- Purpose: Express + Socket.io bootstrap, static file serving in production, disconnect handling
- Location: `server/src/index.ts`
- Contains: HTTP server creation, Socket.io init, disconnect handler that calls `buildClientGameState` directly for mid-game disconnects
- Depends on: `RoomManager`, `registerHandlers`, `buildClientGameState`, `config`

**Client Socket Bridge:**
- Purpose: Single socket instance, all server-to-client event handlers, navigation side-effects
- Location: `client/src/hooks/useSocket.ts`, `client/src/socket.ts`
- Contains: All `socket.on(...)` registrations; routes events to the three Zustand stores and `navigate()`
- Depends on: All three stores, `socket.ts` singleton
- Used by: `client/src/App.tsx` via `AppRoutes` (mounted once at root)

**Client State (Zustand Stores):**
- Purpose: Isolated reactive state for game data, room/session info, and UI interactions
- Location: `client/src/store/`
- Contains: `gameStore.ts` (ClientGameState, round/game end payloads, lastTileSequence), `roomStore.ts` (roomCode, playerName, myPlayerIndex, gameMode, error), `uiStore.ts` (selectedTileId, pasoNotifications, modal visibility, soundEnabled)
- Depends on: `client/src/types/game.ts`
- Used by: All React components and hooks

**Client Actions Hook:**
- Purpose: Encapsulates all socket.emit calls with local validation
- Location: `client/src/hooks/useGameActions.ts`
- Contains: `selectTile` (two-step placement logic), `playTileOnEnd`, `startNextHand`, `startGame`, `createRoom`, `joinRoom`
- Depends on: `socket.ts`, all three stores

**React Pages:**
- Purpose: Route-level components; thin shells that guard navigation and render feature components
- Location: `client/src/pages/`
- Contains: `MenuPage.tsx` (renders `MainMenu`), `LobbyPage.tsx` (renders `RoomLobby`), `GamePage.tsx` (renders `GameTable`, redirects home if no state)
- Depends on: Zustand stores, component subtrees

**React Components:**
- Purpose: Presentational and interactive UI elements
- Location: `client/src/components/`
- Subdirectories: `board/` (snake layout engine, tile rendering, end badges), `domino/` (tile face rendering), `game/` (full table layout, score panel, modals, paso notifications), `lobby/` (main menu, room lobby), `player/` (hand display, opponent hand, seat indicator, turn indicator), `ui/` (Button, Input primitives)

## Data Flow

**Game Action (Tile Play):**

1. Player clicks a tile → `useGameActions.selectTile()` runs client-side validation using `gameState.validPlays`
2. If tile has one valid end: `socket.emit('game:play_tile', { roomCode, tileId, targetEnd })` immediately
3. If tile has two valid ends: `uiStore.selectedTileId` is set → board end badges become clickable → player taps end → `playTileOnEnd()` emits
4. Server `gameHandlers.ts` receives `game:play_tile`, validates identity and move legality via `getValidPlays()`
5. `applyTileToBoard()` mutates `game.board`; tile removed from `player.tiles`
6. Capicú / Chuchazo / win conditions checked; `applyScore()` called if hand ends
7. `broadcastStateWithAction(io, game, lastAction)` loops over connected players and emits `game:state_snapshot` with a per-player `buildClientGameState()` result
8. `processAutoPassCascade()` advances turn, auto-passing players with no valid moves; each auto-pass emits `game:player_passed`
9. Final `broadcastState(io, game)` emitted for new current player's turn
10. Client `useSocket` receives `game:state_snapshot` → `setGameState()` → Zustand → React re-render

**Room Lifecycle:**

1. Player emits `room:create` or `room:join` → `RoomManager` assigns seat
2. Server emits `room:created` / `room:joined` with `myPlayerIndex` → `useSocket` sets roomStore, navigates to `/lobby`
3. Additional players joining trigger `room:updated` broadcast to all room members
4. Host emits `game:start` → server deals tiles, identifies first player via `findFirstPlayer()`, creates `ServerGameState`, emits `game:started` with personalized state to each player
5. `useSocket` receives `game:started` → `setGameState()` + `navigate('/game')`

**State Management:**

- `gameStore`: updated on every `game:state_snapshot`, `game:round_ended`, `game:game_ended`
- `roomStore`: updated on `room:created`, `room:joined`, `room:updated`
- `uiStore`: updated locally (selectedTileId on tile click), and by `game:player_passed` (pasoNotifications), and round/game end events (modal visibility)
- Stores never import from each other; cross-store reads done via `useGameActions` which imports all three

## Key Abstractions

**ServerGameState vs ClientGameState:**
- `ServerGameState` in `server/src/game/GameState.ts` holds full truth including all players' tiles
- `ClientGameState` is produced by `buildClientGameState(state, playerIndex)` in `GameEngine.ts`: only `players[i].tiles` is populated for the receiving player; `validPlays` and `isMyTurn` are computed per-player
- The client type mirror lives in `client/src/types/game.ts` — kept manually in sync

**Room vs Game:**
- A `Room` (`RoomManager.ts`) always exists: it owns seat assignment, host tracking, and reconnection
- A `ServerGameState` is created inside `room.game` only when `game:start` fires; it is null before that

**Snake Layout:**
- `computeSnakeLayout` in `client/src/components/board/GameBoard.tsx` converts `BoardTile[]` (ordered by play sequence) into absolute pixel positions
- First-played tile (lowest `sequence`) is pinned to canvas center as anchor
- Row wraps at `SNAKE_CAP` (560px); corner tiles rotate 90°; direction reverses each row

**Two-Step Tile Placement:**
- Managed by `uiStore.selectedTileId` + `useGameActions.selectTile()`
- If a tile matches only one board end: immediate emit, no selection state set
- If a tile matches both ends: `selectedTileId` is set, board end badges activate for end selection

## Entry Points

**Server:**
- Location: `server/src/index.ts`
- Triggers: `node dist/index.js` (production) or `tsx src/index.ts` (dev)
- Responsibilities: Create Express app, attach Socket.io to same HTTP server, instantiate single `RoomManager`, register all socket handlers, serve Vite build in production

**Client:**
- Location: `client/src/main.tsx`
- Triggers: Browser load; Vite dev server or Express static serve in production
- Responsibilities: Render `<App />` which wraps `<BrowserRouter>` and mounts `AppRoutes`

**AppRoutes:**
- Location: `client/src/App.tsx` (`AppRoutes` function)
- Triggers: Every render cycle
- Responsibilities: Call `useSocket()` once (registers all server event handlers), define three routes (`/`, `/lobby`, `/game`)

## Error Handling

**Strategy:** Server silently returns on invalid events (no error thrown); explicit `room:error` emitted only for user-visible failures

**Patterns:**
- Server socket handlers use early returns on invalid state: `if (!room?.game) return`
- `room:error` emitted with `{ code, message }` for user-actionable errors (ROOM_NOT_FOUND, NOT_HOST, NOT_ENOUGH_PLAYERS, INVALID_NAME)
- Client `useSocket` stores error string in `roomStore.error` via `setError(message)`
- No global error boundary on client; no try/catch around socket handlers

## Cross-Cutting Concerns

**Logging:** `console.log` only, prefixed with `[socket]` in `server/src/index.ts`
**Validation:** Server recomputes `getValidPlays()` on every `game:play_tile` event; client-side checks are advisory only
**Authentication:** None — players are identified by socket ID + display name; reconnection matches by name within same room
**Reconnection:** `RoomManager.joinRoom` detects `room.status === 'in_game'` + matching disconnected player name and reattaches socket; `roomHandlers.ts` sends current game state snapshot on reconnect

---

*Architecture analysis: 2026-03-06*

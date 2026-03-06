# Codebase Structure

**Analysis Date:** 2026-03-06

## Directory Layout

```
dominos_pr/                         # Repo root (npm workspace root)
├── package.json                    # Workspace root; scripts: dev, build, start
├── package-lock.json
├── node_modules/                   # Workspace hoisted dependencies
├── CLAUDE.md                       # Project instructions for Claude Code
│
├── client/                         # React + Vite frontend (workspace: "client")
│   ├── package.json
│   ├── vite.config.ts
│   ├── tsconfig.json
│   ├── index.html
│   ├── dist/                       # Vite build output (served by Express in prod)
│   └── src/
│       ├── main.tsx                # React entry point
│       ├── App.tsx                 # BrowserRouter + AppRoutes (mounts useSocket)
│       ├── socket.ts               # Socket.io client singleton (autoConnect: false)
│       ├── index.css               # Global styles + Tailwind directives
│       ├── types/
│       │   └── game.ts             # Client-side type mirror of server GameState
│       ├── store/
│       │   ├── gameStore.ts        # ClientGameState, round/game end payloads, lastTileSequence
│       │   ├── roomStore.ts        # roomCode, playerName, myPlayerIndex, gameMode, error
│       │   └── uiStore.ts          # selectedTileId, pasoNotifications, modals, soundEnabled
│       ├── hooks/
│       │   ├── useSocket.ts        # All server→client event handlers; mounts once in AppRoutes
│       │   ├── useGameActions.ts   # All client→server emits; two-step tile placement logic
│       │   └── usePlayerPositions.ts # Visual seat mapping relative to local player
│       ├── pages/
│       │   ├── MenuPage.tsx        # Route "/" — renders MainMenu
│       │   ├── LobbyPage.tsx       # Route "/lobby" — renders RoomLobby
│       │   └── GamePage.tsx        # Route "/game" — renders GameTable, guards navigation
│       └── components/
│           ├── board/
│           │   ├── GameBoard.tsx   # Snake layout engine (computeSnakeLayout) + end badges
│           │   ├── BoardTile.tsx   # Individual board tile renderer with animation support
│           │   └── BoardEnds.tsx   # End pip badge subcomponents
│           ├── domino/
│           │   ├── DominoTile.tsx  # Face-up tile (shows pips)
│           │   ├── DominoTileBack.tsx  # Face-down tile for opponent hands
│           │   └── DotPattern.tsx  # Pip dot layout primitive
│           ├── game/
│           │   ├── GameTable.tsx   # Full 3x3 grid table layout (top/left/right/bottom/board)
│           │   ├── ScorePanel.tsx  # Score bar at top
│           │   ├── RoundEndModal.tsx
│           │   ├── GameEndModal.tsx
│           │   ├── PasoChip.tsx    # Inline "PASO" badge over player seat
│           │   └── PasoToast.tsx   # Toast notification variant
│           ├── lobby/
│           │   ├── MainMenu.tsx    # Create/join room form
│           │   └── RoomLobby.tsx   # Waiting room with player list + start button
│           ├── player/
│           │   ├── PlayerHand.tsx  # Local player's tile rack (bottom)
│           │   ├── OpponentHand.tsx # Face-down tiles for opponents
│           │   ├── PlayerSeat.tsx  # Name + team color badge
│           │   └── TurnIndicator.tsx # Whose turn overlay
│           └── ui/
│               ├── Button.tsx      # Shared button primitive
│               └── Input.tsx       # Shared input primitive
│
├── server/                         # Express + Socket.io backend (workspace: "server")
│   ├── package.json
│   ├── tsconfig.json               # Compiles to CommonJS in dist/
│   └── src/
│       ├── index.ts                # Entry point: Express, Socket.io, RoomManager, disconnect handling
│       ├── config.ts               # PORT, CLIENT_ORIGIN, NODE_ENV from env vars
│       ├── game/
│       │   ├── GameState.ts        # All type definitions (Tile, BoardState, ServerGameState, ClientGameState, Room, etc.)
│       │   ├── GameEngine.ts       # Pure functions: tile generation, board mutation, scoring, buildClientGameState
│       │   ├── RoomManager.ts      # Room lifecycle: create, join, leave, reconnect, cleanup
│       │   └── gameHandlers.ts     # (Note: actual file is server/src/socket/gameHandlers.ts)
│       └── socket/
│           ├── handlers.ts         # Fan-out: calls registerRoomHandlers + registerGameHandlers
│           ├── roomHandlers.ts     # room:create, room:join, room:leave events
│           └── gameHandlers.ts     # game:start, game:play_tile, game:next_hand; processAutoPassCascade; broadcastState
│
├── .planning/                      # GSD planning docs (not committed to main branch)
│   └── codebase/
│
│── [Flutter artifacts — inactive]
├── lib/                            # Flutter Dart source (deprecated prototype)
├── pubspec.yaml                    # Flutter package manifest
├── android/                        # Android runner for Flutter
├── ios/                            # iOS runner for Flutter
├── macos/                          # macOS runner for Flutter
├── linux/                          # Linux runner for Flutter
├── windows/                        # Windows runner for Flutter
├── web/                            # Web runner for Flutter
├── assets/sounds/                  # Audio files (used by Flutter, may be referenced by client)
└── build/                          # Flutter build artifacts
```

## Directory Purposes

**`server/src/game/`:**
- Purpose: The entire game domain — types, pure logic, room management
- Contains: Type contracts (`GameState.ts`), stateless functions (`GameEngine.ts`), stateful class (`RoomManager.ts`)
- Key files: `GameState.ts` (read this first to understand all data shapes), `GameEngine.ts` (all rules), `RoomManager.ts` (in-memory store)

**`server/src/socket/`:**
- Purpose: Socket.io event registration and orchestration; only place that mutates game state
- Contains: Handler registration functions that close over a shared `RoomManager` instance
- Key files: `gameHandlers.ts` (most logic), `roomHandlers.ts` (lobby events)

**`client/src/store/`:**
- Purpose: Global reactive state; never cross-import between stores
- Contains: Three Zustand stores with flat, explicit action interfaces
- Key files: `gameStore.ts` (primary game data), `roomStore.ts` (session), `uiStore.ts` (interaction state)

**`client/src/hooks/`:**
- Purpose: Stateful logic that touches multiple stores or emits socket events
- Contains: `useSocket.ts` (all inbound events), `useGameActions.ts` (all outbound events), `usePlayerPositions.ts` (layout math)

**`client/src/components/board/`:**
- Purpose: Snake layout computation and board rendering
- Key files: `GameBoard.tsx` contains `computeSnakeLayout` — the most complex client-side algorithm

**`client/src/components/game/`:**
- Purpose: The main game screen assembly and game-end overlays
- Key files: `GameTable.tsx` is the top-level game layout component rendered by `GamePage`

**`client/src/types/`:**
- Purpose: Client-side TypeScript types — manually mirrored from `server/src/game/GameState.ts`
- Key files: `game.ts` — must be kept in sync with server types when adding new fields

## Key File Locations

**Entry Points:**
- `server/src/index.ts`: Server start, Socket.io connection handler
- `client/src/main.tsx`: React root render
- `client/src/App.tsx`: Router and global hook mounting

**Configuration:**
- `server/src/config.ts`: Environment variable config (PORT, CLIENT_ORIGIN, NODE_ENV)
- `client/vite.config.ts`: Vite config with `host: '0.0.0.0'` for ngrok/LAN
- `package.json` (root): `dev` script hardcodes `PORT=3001`

**Core Logic:**
- `server/src/game/GameEngine.ts`: All pure game functions
- `server/src/game/GameState.ts`: All type definitions
- `server/src/socket/gameHandlers.ts`: State mutation and broadcast orchestration
- `client/src/hooks/useGameActions.ts`: Two-step tile placement and all socket emits

**Testing:**
- No test files present — TypeScript strict mode (`"strict": true`) is the primary correctness check

## Naming Conventions

**Files:**
- PascalCase for React components: `GameTable.tsx`, `PlayerHand.tsx`
- PascalCase for class/type-heavy modules: `GameEngine.ts`, `RoomManager.ts`, `GameState.ts`
- camelCase for hooks: `useSocket.ts`, `useGameActions.ts`, `usePlayerPositions.ts`
- camelCase for stores: `gameStore.ts`, `roomStore.ts`, `uiStore.ts`
- camelCase for server config/entry: `index.ts`, `config.ts`, `handlers.ts`, `gameHandlers.ts`, `roomHandlers.ts`

**Directories:**
- lowercase for feature groups: `board/`, `domino/`, `game/`, `lobby/`, `player/`, `ui/`
- lowercase for cross-cutting: `hooks/`, `store/`, `types/`, `pages/`, `socket/`

**Socket Events:**
- `namespace:action` pattern: `room:create`, `room:join`, `room:error`, `game:start`, `game:play_tile`, `game:state_snapshot`, `game:round_ended`, `connection:player_disconnected`

**Types:**
- Interface names PascalCase: `ServerGameState`, `ClientGameState`, `BoardTile`, `RoomPlayer`
- Type aliases for unions: `GameMode = 'modo200' | 'modo500'`, `GamePhase`, `PipValue`

## Where to Add New Code

**New game rule or scoring logic:**
- Pure function: `server/src/game/GameEngine.ts`
- New type required: `server/src/game/GameState.ts` (and mirror in `client/src/types/game.ts`)

**New server event handler:**
- Game-related: add `socket.on(...)` inside `registerGameHandlers` in `server/src/socket/gameHandlers.ts`
- Room/lobby-related: add inside `registerRoomHandlers` in `server/src/socket/roomHandlers.ts`

**New client event listener:**
- Add `socket.on(...)` inside the `useEffect` in `client/src/hooks/useSocket.ts`
- Add corresponding `socket.off(...)` in the cleanup return

**New client action (emit):**
- Add a `useCallback` inside `useGameActions` in `client/src/hooks/useGameActions.ts`
- Return it from the hook

**New UI state (modal, toggle, notification):**
- Add field and setter to `client/src/store/uiStore.ts`

**New page route:**
- Add route in `client/src/App.tsx`
- Create page file in `client/src/pages/`

**New React component:**
- Board rendering: `client/src/components/board/`
- Game screen: `client/src/components/game/`
- Lobby/menu: `client/src/components/lobby/`
- Player display: `client/src/components/player/`
- Reusable primitive: `client/src/components/ui/`

## Special Directories

**`client/dist/`:**
- Purpose: Vite production build output
- Generated: Yes (by `npm run build --workspace=client`)
- Committed: No; served by Express in production via `express.static`

**`server/dist/`:**
- Purpose: TypeScript compiled output (CommonJS)
- Generated: Yes (by `npm run build --workspace=server`)
- Committed: No; `npm run start` runs `node dist/index.js`

**`.planning/codebase/`:**
- Purpose: GSD codebase analysis documents
- Generated: By GSD map-codebase commands
- Committed: Optional (not in `.gitignore` by default)

**`node_modules/` (root):**
- Purpose: Hoisted dependencies shared between workspaces (`concurrently`)
- Generated: Yes
- Committed: No

**`build/`, `android/`, `ios/`, `lib/`, `macos/`, `linux/`, `windows/`:**
- Purpose: Flutter prototype artifacts — inactive, not part of the active web application
- Generated: Partially (build outputs) or scaffolded (platform runners)
- Committed: Scaffolded files are committed; build outputs are not

---

*Structure analysis: 2026-03-06*

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Start both client (5173) and server (3001) concurrently
npm run dev

# Build both workspaces (client first, then server)
npm run build

# Run production server (after build)
npm run start

# Server dev only (with hot reload via tsx)
npm run dev --workspace=server

# Client dev only
npm run dev --workspace=client

# Type-check client (no emit)
cd client && npx tsc --noEmit

# Type-check server
cd server && npx tsc --noEmit
```

There are no test or lint scripts configured. TypeScript strict mode (`"strict": true`) is the primary correctness check.

## Architecture

### Monorepo
`npm workspaces` with `client/` (React + Vite) and `server/` (Express + Socket.io). Both use TypeScript strict mode. Server outputs CommonJS (`dist/`); client is ESNext bundled by Vite.

### Request / Response Flow
All real-time state flows through Socket.io — there is no REST API. The sequence for every game action:

1. **Client emits** event (e.g. `game:play_tile`)
2. **Server validates** in `gameHandlers.ts`, mutates `ServerGameState` via `GameEngine.ts` pure functions
3. **Server calls `broadcastState()`** which calls `buildClientGameState(state, playerIndex)` for each connected player — producing a personalized payload where `players[i].tiles` is only populated for the receiving player
4. **Client receives** `game:state_snapshot` → `useSocket` hook → Zustand stores → React re-render

### Server-Side Game Logic (`server/src/game/`)

`GameEngine.ts` contains **only pure functions** — no I/O, no side effects, no mutation of shared state. The main server mutation loop lives in `gameHandlers.ts`:

- `processAutoPassCascade()` — after each tile play, repeatedly checks if the next player has no valid moves and auto-passes them. Handles Modo 200 pass bonuses, detects 4 consecutive passes → blocked game.
- `handleBlockedGame()` — calculates which team has lower pip total, awards points, checks for game over.
- `broadcastState()` / `broadcastStateWithAction()` — sends personalized `ClientGameState` to every connected player in the room.

`RoomManager.ts` owns all room lifecycle: code generation (e.g. `COQUI-4829`), seat assignment, reconnection matching (same name → same seat), host promotion on leave, and a 10-minute cleanup interval for stale rooms.

### Game Lifecycle Events

| Phase transition | Client emits | Server emits | Notes |
|---|---|---|---|
| Start game | `game:start` | `game:started` (per-player) | Host only. Navigates all clients to `/game` |
| Play tile | `game:play_tile` | `game:state_snapshot` | Server auto-passes subsequent players if needed |
| Round end | _(server-initiated)_ | `game:round_ended` + optionally `game:game_ended` | Round data includes remaining tiles, bonuses, scores |
| Next hand | `game:next_hand` | `game:state_snapshot` (per-player) | Host only. Resets board, deals new tiles, preserves scores |
| Next game | `game:next_game` | `game:started` (per-player) | Host only. Full reset including scores. Same event as initial start |

### Client State (`client/src/store/`)

Three Zustand stores, never imported across each other:

| Store | Owns |
|---|---|
| `gameStore` | `ClientGameState`, round/game end payloads, `lastTileSequence` (animation), `scoreHistory` (per-hand entries) |
| `roomStore` | Room info, `roomCode`, `playerName`, `myPlayerIndex`, `gameMode`, error string |
| `uiStore` | `selectedTileId` (two-step placement), paso notification queue, modal visibility (`showRoundEnd`, `showGameEnd`, `showScoreHistory`), sound toggle |

### `useSocket` hook (`client/src/hooks/useSocket.ts`)

Mounted once at app root via `AppRoutes`. Connects the socket and registers all server→client event handlers. Routes are `/`, `/lobby`, `/game` — **no URL params** (room code lives in `roomStore.roomCode`). Any socket event that navigates uses plain `navigate('/lobby')` or `navigate('/game')`.

The `game:started` handler clears all stale game-end state (`showGameEnd`, `showRoundEnd`, `gameEndData`, `roundEndData`, `scoreHistory`) before navigating. This handles both initial game start and new-game-after-game-end transitions.

### Tile Placement UX

Two-step interaction managed in `uiStore.selectedTileId` + `useGameActions.selectTile()`:

1. Player clicks a tile → `selectedTileId` is set
2. If the tile is valid on only one end → immediate emit of `game:play_tile`
3. If valid on both ends → board end indicators become clickable → player taps an end → emit

### Production Build

In production (`NODE_ENV=production`), Express serves the Vite build from `client/dist/` and all non-API routes fall back to `index.html`. Socket.io shares the same HTTP server so no separate origin or proxy config is needed.

## Key Invariants

- **4 players only.** Deal is 7 × 4 = 28 tiles (full set), boneyard is always empty.
- **Clockwise turn order (visual):** `nextPlayer = (current + 3) % 4` — play goes clockwise: bottom → right → top → left.
- **Visual seat mapping** (relative to local player at bottom): right=+1 (plays next), top=+2 (partner), left=+3.
- **Teams:** 0 & 2 vs 1 & 3 (partners sit top/bottom; opponents sit left/right).
- **Server is sole authority.** Client never computes scores or valid plays — it only renders `validPlays` from `ClientGameState`.
- **No `game:pass` client event.** Passes are triggered automatically server-side after `game:play_tile`.
- **First play.** The player holding the double-six (scanning 6-6 → 5-5 → … → 0-0) is forced to play it as the opening move (`forcedFirstTileId` field). Subsequent hands: previous winner starts, plays freely (`forcedFirstTileId = ''`).
- **Capicu + Chuchazo don't stack** — only +100 total (Modo 500).
- **Host-only actions:** `game:start`, `game:next_hand`, `game:next_game`. Non-hosts see "Esperando al host..." in modals.

### Board Snake Layout (`client/src/components/board/GameBoard.tsx`)

`computeSnakeLayout` places tiles in a serpentine with anchor-based positioning:

- Horizontal tiles: 80 × 40 px (1:1 with SVG viewBox). Doubles (vertical): 40 × 80 px.
- **Anchor:** The first-played tile (lowest sequence) is fixed at `(boardW/2, boardH/2)`. The right arm extends rightward/downward, the left arm extends leftward/upward — adding tiles to one side never shifts the other.
- **Row wrapping**: when a tile would exceed `SNAKE_CAP` (620 px), the turn tile is placed directly below/above the **previous tile** (not at the hard boundary), creating a visible corner. New row proceeds in the opposite direction.
- **Corner tiles**: horizontal tiles at corners are rendered vertically (`corner` flag). Their display size swaps to `TILE_V_W × TILE_V_H`.
- **Minimum tiles per row**: after each corner, at least 2 tiles must be placed before the next corner is allowed (`tilesInRow >= 2` with counter starting at 0 after each corner). This prevents rapid direction changes that misalign doubles.
- **Row spacing** is dynamic: `prevTileH / 2 + cornerTileH / 2 + GAP` — uses the **previous tile's** actual display height (not `rowMaxH`) so the corner tile sits flush against the tile it connects to, even when taller doubles exist elsewhere in the row.
- **Flipped tiles**: tiles in left-going rows have `flipped=true`, which swaps `leftPip`/`rightPip` display so the connecting pip always faces the adjacent tile.
- **End badges** (pip indicators): position adapts to end tile state — left of tile normally, right when flipped (after corner turn), above/below when the end tile is a corner.

### Board Tile Data Model

`BoardTile.leftPip` / `rightPip` represent the logical board chain, not visual display:
- **Left-end tiles** (prepended to array): `leftPip` = exposed pip, `rightPip` = connecting pip
- **Right-end tiles** (appended to array): `leftPip` = connecting pip, `rightPip` = exposed pip
- `board.leftEnd` / `board.rightEnd` track the current exposed pip values at each end

## Environment & Port Notes

- `PORT=3001` is hardcoded in the root `dev` script to prevent `preview_start` tooling from injecting `PORT=5173` and breaking the server.
- If `npm run dev` fails with `EADDRINUSE`, kill both ports first: `lsof -ti:3001,5173 | xargs kill -9`
- `vite.config.ts` sets `host: '0.0.0.0'` — required for ngrok and LAN access.
- Google Fonts `@import` must be the **first line** of `client/src/index.css` (before `@tailwind` directives).

## Sharing via ngrok

```bash
# One-time auth setup
ngrok config add-authtoken <TOKEN>

# Expose the Vite dev server (keep npm run dev running in another terminal)
ngrok http 5173
```

## Instrucciones Permanentes de Flujo de Trabajo

### 1. Commits antes de cambios grandes
Antes de cualquier cambio grande de UI, lógica o estructura, ejecuta automáticamente:
```bash
git add .
git commit -m "<descripción clara de lo que se va a cambiar>"
```
Esto preserva un punto de retorno limpio antes de cada iteración significativa.

### 2. Resumen de sesión al terminar
Al terminar cada sesión, guarda un resumen en:
```
/Users/yamirx/Claude_Code/The Vault/Projects/dominos_pr/sesiones/sesion-FECHA.md
```
Formato del archivo:
```markdown
# Sesión FECHA

## Qué hicimos
- ...

## Decisiones tomadas
- ...

## Próximos pasos
- ...
```

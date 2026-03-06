# Coding Conventions

**Analysis Date:** 2026-03-06

## Naming Patterns

**Files:**
- React components: PascalCase matching the exported component name — `GameBoard.tsx`, `DominoTile.tsx`, `RoundEndModal.tsx`
- Hooks: camelCase prefixed with `use` — `useSocket.ts`, `useGameActions.ts`, `usePlayerPositions.ts`
- Stores: camelCase suffixed with `Store` — `gameStore.ts`, `roomStore.ts`, `uiStore.ts`
- Server handlers: camelCase suffixed with `Handlers` — `gameHandlers.ts`, `roomHandlers.ts`
- Type/state files: PascalCase — `GameState.ts`, `GameEngine.ts`, `RoomManager.ts`
- Client type file: lowercase — `game.ts` (inside `types/`)

**Functions:**
- Regular functions: camelCase — `generateDoubleSixSet`, `shuffleTiles`, `nextPlayerIndex`
- React components: PascalCase — `GameTable`, `PlayerHand`, `DominoTile`
- Event handlers: `handle` prefix — `handleCreate`, `handleJoin`, `handleNextHand`
- Socket registration: `register` prefix — `registerGameHandlers`, `registerRoomHandlers`

**Variables:**
- camelCase throughout — `roomCode`, `playerIndex`, `currentPlayerIndex`
- Constants: SCREAMING_SNAKE_CASE for module-level constants — `SNAKE_CAP`, `GAP`, `HAND_W`, `HAND_H`, `TILE_H_W`
- Boolean flags: `is`/`can` prefix — `isDouble`, `isMyTurn`, `isHost`, `canPlayLeft`, `firstPlayMade`

**Types and Interfaces:**
- `interface` for object shapes — `GameBoardProps`, `PlayerHandProps`, `ServerGameState`
- `type` for unions and aliases — `GameMode`, `GamePhase`, `PipValue`, `GameAction`, `View`
- Props interfaces named `{ComponentName}Props` and defined immediately before the component

**Socket Events:**
- `namespace:action` format — `game:play_tile`, `room:create`, `game:state_snapshot`, `connection:player_disconnected`

## Code Style

**Formatting:**
- No Prettier or ESLint config present — formatting is enforced by TypeScript compiler settings and manual consistency
- 2-space indentation throughout (both client and server)
- Single quotes for strings in TypeScript/TSX
- Trailing commas in multi-line arrays and objects

**TypeScript:**
- `"strict": true` in both `client/tsconfig.json` and `server/tsconfig.json`
- `noFallthroughCasesInSwitch: true` in client
- No `noUnusedLocals` or `noUnusedParameters` enforcement (both `false` in client)
- Explicit return type annotations on pure functions: `export function applyScore(...): { updatedScores: TeamScores; gameOver: boolean }`
- Props types declared inline as interfaces, never inlined into function signatures

**Tailwind CSS:**
- Custom design tokens defined in `client/tailwind.config.ts`: `primary`, `accent`, `gold`, `bg`, `tile`, `surface`, `border`
- Custom font families: `font-header` (Bebas Neue), `font-body` (Nunito)
- Class strings built with template literals for conditional variants: `${isPlayable ? 'cursor-pointer hover:-translate-y-2' : 'opacity-60'}`
- Long static class strings kept on one line; multi-condition strings use template literals

## Import Organization

**Order (observed pattern):**
1. React and framework imports — `import { useRef, useEffect, useState } from 'react'`
2. Third-party library imports — `import { useNavigate } from 'react-router-dom'`
3. Internal socket singleton — `import { socket } from '../socket'`
4. Store imports — `import { useGameStore } from '../store/gameStore'`
5. Hook imports — `import { useGameActions } from '../hooks/useGameActions'`
6. Component imports — `import { GameBoard } from '../board/GameBoard'`
7. Type imports — `import { ClientGameState, RoundEndPayload } from '../types/game'`

**No path aliases configured** — all imports use relative paths (`../../types/game`, `../store/gameStore`).

**Server imports use named exports exclusively.** No default exports on the server side.

**Client exports:**
- Named exports for all components and hooks — `export function GameTable()`, `export function useSocket()`
- Default export only at app entry: `export default function App()` in `client/src/App.tsx`

## Error Handling

**Server pattern — silent early return with error emit:**
```typescript
const room = rooms.getRoom(roomCode)
if (!room) return socket.emit('room:error', { code: 'ROOM_NOT_FOUND', message: 'Sala no encontrada' })
if (room.hostSocketId !== socket.id) return socket.emit('room:error', { code: 'NOT_HOST', message: 'Solo el host puede iniciar' })
```

- No `try/catch` blocks anywhere in the codebase — all error paths are guard clauses with early returns
- Server emits structured error events: `{ code: 'ERROR_CODE', message: 'User-facing text (Spanish)' }`
- Client receives errors via `socket.on('room:error', ({ message }) => setError(message))`
- Error state lives in `roomStore.error` (string | null), cleared on next action via `clearError()`
- No error boundaries in the client React tree

**GameEngine.ts has no error handling by design** — it is pure functions only; invalid inputs are expected to be pre-validated by `gameHandlers.ts` before calling engine functions.

## Logging

**Server:**
- `console.log` only — no structured logging library
- Connection events: `console.log('[socket] connected: ${socket.id}')` and `console.log('[socket] disconnected: ...')`
- Server startup: `console.log('🎲 Dominó PR server running on port ${config.PORT}')`

**Client:**
- `console.log` for disconnect/reconnect events in `client/src/hooks/useSocket.ts`
- No other client-side logging

## Comments

**When to Comment:**
- Section dividers in long files using ASCII banners: `// ─── Tile Generation ──────────────────────────────────────────────────────────`
- JSDoc-style block comments on complex pure functions explaining invariants and edge cases
- Inline comments on non-obvious logic: `// CCW with 4 players: 0 → 1 → 2 → 3 → 0 (left player plays next)`
- Comment on intentional omissions: `// gamePassCount intentionally NOT reset — it tracks total passes for the entire game`

**JSDoc/TSDoc:**
- Used selectively on pure engine functions in `server/src/game/GameEngine.ts`
- Not used on React components or hooks

## Function Design

**Pure functions (GameEngine.ts):**
- Single responsibility, descriptive names, explicit return types
- No side effects, no mutation of arguments — always return new objects
- Small to medium size (5–30 lines each)

**Mutation pattern (gameHandlers.ts):**
- `ServerGameState` is mutated in place via direct property assignment: `game.board = applyTileToBoard(...)`, `game.scores = updatedScores`
- Handler functions (`processAutoPassCascade`, `handleBlockedGame`) accept `io` and `game` and produce side effects via emit + mutation

**React components:**
- Destructure props at the function signature: `function PlayerHand({ tiles, validPlayIds, isMyTurn, forcedFirstTileId }: PlayerHandProps)`
- Helper functions defined outside the component when they do not need closure: `function teamInfo(playerIndex: number)`, `function computeSnakeLayout(...)`
- Private sub-components defined in the same file when used only there: `HorizontalTile`, `VerticalTile`, `GreenBtn`, `OutlineBtn`

## Module Design

**Exports:**
- No barrel (`index.ts`) files anywhere — all imports reference the specific file directly
- Each module exports only what it provides; server-side files use named exports exclusively

**Zustand stores:**
- Interface declared above `create<T>()` call
- All state and actions in one `create` call
- Stores never import each other — they are consumed independently in components/hooks

**Class usage:**
- Only `RoomManager` uses a class (in `server/src/game/RoomManager.ts`) — for stateful room lifecycle management with private fields
- All other server logic uses plain functions

---

*Convention analysis: 2026-03-06*

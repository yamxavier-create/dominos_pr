# Testing Patterns

**Analysis Date:** 2026-03-06

## Test Framework

**Runner:**
- None configured. No Jest, Vitest, or any other test runner is installed in either `client/package.json` or `server/package.json`.
- No `jest.config.*`, `vitest.config.*`, or equivalent config files are present in the project root, `client/`, or `server/`.

**Assertion Library:**
- None installed.

**Run Commands:**
```bash
# No test scripts are configured.
# The root package.json has no "test" script.
# TypeScript strict mode is the primary correctness check:
cd client && npx tsc --noEmit
cd server && npx tsc --noEmit
```

## Test File Organization

**Location:**
- No TypeScript/JavaScript test files exist in `client/src/` or `server/src/`.
- A single Flutter test file exists at `/test/widget_test.dart` — this is a remnant of a Flutter project scaffold and is unrelated to the Node/React codebase.

**Naming:**
- No established naming convention (no test files exist).

## Test Structure

**Suite Organization:**
- Not established.

## Mocking

**Framework:**
- None.

**What Would Need Mocking (for future test setup):**
- `socket.io` `Server` and `Socket` instances in `server/src/socket/gameHandlers.ts` and `server/src/socket/roomHandlers.ts`
- The `RoomManager` class in `server/src/game/RoomManager.ts`
- The `socket` singleton in `client/src/socket.ts` for hook tests
- Zustand stores (`useGameStore`, `useRoomStore`, `useUIStore`) for component isolation

## Fixtures and Factories

**Test Data:**
- None defined.

**Testable Pure Functions (natural unit test targets in `server/src/game/GameEngine.ts`):**
- `generateDoubleSixSet()` — deterministic, no arguments
- `shuffleTiles(tiles)` — verifiable output length and content
- `dealTiles(tiles)` — fixed split: four 7-tile hands, empty boneyard
- `findFirstPlayer(hands)` — deterministic given known hands
- `nextPlayerIndex(current)` — simple modular arithmetic
- `tileCanPlayOnEnd(tile, endValue)` — boolean output
- `getValidPlays(hand, board, firstPlayMade, forcedFirstTileId)` — deterministic given inputs
- `applyTileToBoard(board, tile, targetEnd, playedByIndex)` — pure, immutable return
- `isCapicu(tile, board)` — boolean, verifiable
- `isChuchazo(tile)` — boolean, trivial
- `calculateBlockedResult(players)` — deterministic scoring
- `applyScore(scores, winningTeam, points, targetScore)` — deterministic, returns `{ updatedScores, gameOver }`
- `calculateMode500Bonuses(handNumber, capicuTriggered, chuchazoTriggered)` — deterministic
- `buildClientGameState(game, forPlayerIndex)` — verifies player tile visibility filtering

## Coverage

**Requirements:** None enforced — no coverage tooling configured.

**View Coverage:**
```bash
# Not available — no test runner installed.
```

## Test Types

**Unit Tests:**
- Not present. `server/src/game/GameEngine.ts` is the highest-priority target for unit testing: it contains ~20 pure functions with no I/O or side effects. These could be tested without any mocking infrastructure.

**Integration Tests:**
- Not present. Socket handler integration (client→server→broadcast) would require `socket.io` test utilities or a live server instance.

**E2E Tests:**
- Not used.

## Correctness Strategy (Current)

In the absence of automated tests, correctness is maintained by:

1. **TypeScript strict mode** (`"strict": true` in both `client/tsconfig.json` and `server/tsconfig.json`) — catches type mismatches, null/undefined issues at compile time.
2. **Server as sole authority** — the client never computes game logic; all validation happens server-side in `server/src/socket/gameHandlers.ts` with guard clauses before any state mutation.
3. **Pure functions in `GameEngine.ts`** — all game logic is isolated from I/O, making manual verification straightforward.
4. **Type-shared contracts** — `ClientGameState`, `RoundEndPayload`, and other shared types in `client/src/types/game.ts` mirror the server's `server/src/game/GameState.ts`, keeping the socket contract explicit.

## Recommended Test Setup (If Adding Tests)

The highest-value addition would be unit tests for `server/src/game/GameEngine.ts` using Vitest (compatible with the existing TypeScript setup):

```bash
# Install in server workspace
npm install --save-dev vitest --workspace=server
```

```typescript
// Example: server/src/game/GameEngine.test.ts
import { describe, it, expect } from 'vitest'
import { generateDoubleSixSet, applyScore, isCapicu } from './GameEngine'

describe('generateDoubleSixSet', () => {
  it('produces exactly 28 tiles', () => {
    expect(generateDoubleSixSet()).toHaveLength(28)
  })
})

describe('applyScore', () => {
  it('sets gameOver when team reaches targetScore', () => {
    const { gameOver } = applyScore({ team0: 19, team1: 0 }, 0, 1, 20)
    expect(gameOver).toBe(true)
  })
})
```

---

*Testing analysis: 2026-03-06*

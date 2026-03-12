---
phase: 07-two-player-boneyard
plan: 01
subsystem: game-engine
tags: [two-player, boneyard, game-state, pure-functions]

requires:
  - phase: 05-video-audio-call
    provides: "Stable 4-player game engine baseline"
provides:
  - "ServerGameState.boneyard field (Tile[])"
  - "ClientGameState.boneyardCount and playerCount fields"
  - "Parameterized dealTiles, nextPlayerIndex, isGameBlocked, calculateBlockedResult for playerCount"
  - "buildClientGameState includes boneyardCount and playerCount"
affects: [07-02, 07-03, 07-04]

tech-stack:
  added: []
  patterns: ["playerCount default parameter pattern for backward-compatible 2/4 player support"]

key-files:
  created: []
  modified:
    - server/src/game/GameState.ts
    - server/src/game/GameEngine.ts
    - server/src/socket/gameHandlers.ts
    - client/src/types/game.ts

key-decisions:
  - "applyPassBonus200 left unchanged -- partner protection logic lives in gameHandlers.ts, not in the pure function"
  - "calculateBlockedResult uses players.length branching instead of explicit playerCount parameter"
  - "Client-side ClientGameState type updated in client/src/types/game.ts to mirror server additions"

patterns-established:
  - "playerCount default=4: all parameterized functions use default parameter values to preserve backward compatibility with existing 4-player callers"

requirements-completed: [TWO-02, TWO-04, TWO-05, TWO-07]

duration: 9min
completed: 2026-03-12
---

# Phase 7 Plan 01: Server Types & Engine Functions Summary

**Boneyard field on ServerGameState, boneyardCount/playerCount on ClientGameState, and parameterized pure functions (dealTiles, nextPlayerIndex, isGameBlocked, calculateBlockedResult) supporting 2-player mode**

## Performance

- **Duration:** 9 min
- **Started:** 2026-03-12T20:35:20Z
- **Completed:** 2026-03-12T20:44:20Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Added `boneyard: Tile[]` to ServerGameState and `boneyardCount`/`playerCount` to ClientGameState
- Parameterized dealTiles (2 hands + 14 boneyard for playerCount=2), nextPlayerIndex (% playerCount), isGameBlocked (>= playerCount)
- Added 2-player individual pip comparison branch to calculateBlockedResult
- buildClientGameState now includes boneyardCount and playerCount in output

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend ServerGameState and ClientGameState types** - `d7b1a8c` (feat)
2. **Task 2: Parameterize GameEngine pure functions for playerCount** - `5419ab7` (feat)

## Files Created/Modified
- `server/src/game/GameState.ts` - Added boneyard field to ServerGameState, boneyardCount and playerCount to ClientGameState
- `server/src/game/GameEngine.ts` - Parameterized dealTiles, nextPlayerIndex, isGameBlocked, calculateBlockedResult; updated buildClientGameState output
- `server/src/socket/gameHandlers.ts` - Updated all ServerGameState construction sites to destructure and set boneyard
- `client/src/types/game.ts` - Added boneyardCount and playerCount to client-side ClientGameState mirror type

## Decisions Made
- applyPassBonus200 left unchanged -- the partner protection logic that needs 2-player awareness lives in gameHandlers.ts (Plan 02), not in this pure function
- calculateBlockedResult branches on `players.length` rather than taking an explicit playerCount parameter, since it already receives the players array
- Client-side type file updated alongside server types to keep both workspaces compiling (per project convention of duplicated types)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Updated gameHandlers.ts to include boneyard in ServerGameState construction**
- **Found during:** Task 1 (type extension)
- **Issue:** Adding required `boneyard: Tile[]` to ServerGameState caused compilation errors at all construction sites in gameHandlers.ts (game:start, game:next_hand, game:next_game, game:rematch_vote)
- **Fix:** Destructured `boneyard` from `dealTiles()` return value and set `game.boneyard = boneyard` at all four construction/reset sites
- **Files modified:** server/src/socket/gameHandlers.ts
- **Verification:** `npx tsc --noEmit` passes clean
- **Committed in:** d7b1a8c (Task 1 commit)

**2. [Rule 3 - Blocking] Updated client-side ClientGameState type**
- **Found during:** Task 1 (type extension)
- **Issue:** Client has its own duplicate `ClientGameState` interface in `client/src/types/game.ts` that needs to match server
- **Fix:** Added `boneyardCount: number` and `playerCount: number` fields to client type
- **Files modified:** client/src/types/game.ts
- **Verification:** `cd client && npx tsc --noEmit` passes clean
- **Committed in:** d7b1a8c (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (2 blocking)
**Impact on plan:** Both auto-fixes necessary for TypeScript compilation. No scope creep -- only the minimum changes needed for both workspaces to compile.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Type foundation and parameterized pure functions ready for Plan 02 (gameHandlers.ts integration)
- All existing callers unaffected due to default parameter values
- Both server and client workspaces compile clean

---
*Phase: 07-two-player-boneyard*
*Completed: 2026-03-12*

## Self-Check: PASSED

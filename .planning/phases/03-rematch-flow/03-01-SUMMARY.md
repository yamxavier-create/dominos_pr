---
phase: 03-rematch-flow
plan: 01
subsystem: api
tags: [socket.io, zustand, rematch, voting]

requires:
  - phase: 02-score-history
    provides: gameStore patterns, uiStore structure
provides:
  - Server-side rematch vote tracking with 4/4 consensus
  - Client rematch state in uiStore (votes, playerNames, cancelled)
  - Socket event handlers for rematch_vote_update, rematch_accepted, rematch_cancelled
  - RematchVoteUpdate and RematchCancelled payload types
affects: [03-rematch-flow]

tech-stack:
  added: []
  patterns: [exported helper for cross-file disconnect handling]

key-files:
  created: []
  modified:
    - server/src/game/GameState.ts
    - server/src/socket/gameHandlers.ts
    - server/src/index.ts
    - server/src/game/RoomManager.ts
    - client/src/types/game.ts
    - client/src/store/uiStore.ts
    - client/src/hooks/useSocket.ts

key-decisions:
  - "Export checkRematchCancellation helper from gameHandlers for use in index.ts disconnect handler"
  - "Rematch triggers same logic as next_game: reset scores to 0-0, same seats, winner starts"

patterns-established:
  - "Cross-file server logic via exported helper functions (checkRematchCancellation pattern)"

requirements-completed: [REM-01, REM-02, REM-04, REM-05, REM-06]

duration: 2min
completed: 2026-03-08
---

# Phase 3 Plan 1: Rematch Vote Data Layer Summary

**Server-side rematch vote consensus (4/4) with disconnect cancellation, client uiStore state, and full socket event wiring**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-08T20:26:26Z
- **Completed:** 2026-03-08T20:28:54Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- Server tracks rematch votes per room, broadcasts updates, triggers new game at 4/4 consensus
- Disconnect during voting cancels rematch and notifies all players
- Client stores vote state and handles all 3 rematch socket events with cleanup

## Task Commits

Each task was committed atomically:

1. **Task 1: Add rematch vote types and server handler** - `5729917` (feat)
2. **Task 2: Add client rematch state and socket handlers** - `3ca5ac5` (feat)

## Files Created/Modified
- `server/src/game/GameState.ts` - Added rematchVotes to Room interface
- `server/src/socket/gameHandlers.ts` - Added game:rematch_vote handler, checkRematchCancellation export
- `server/src/index.ts` - Call checkRematchCancellation on disconnect
- `server/src/game/RoomManager.ts` - Initialize rematchVotes in createRoom
- `client/src/types/game.ts` - Added RematchVoteUpdate and RematchCancelled types
- `client/src/store/uiStore.ts` - Added rematchVotes, rematchPlayerNames, rematchCancelled state
- `client/src/hooks/useSocket.ts` - Added handlers for 3 rematch events with cleanup

## Decisions Made
- Exported checkRematchCancellation helper from gameHandlers since disconnect is handled in index.ts
- Rematch reuses next_game logic: shuffle, deal, reset scores to 0-0, same seats, winner starts freely

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Data layer complete, ready for UI plan (03-02) to render rematch voting interface
- All socket events wired and types exported for component consumption

---
*Phase: 03-rematch-flow*
*Completed: 2026-03-08*

---
phase: 07-two-player-boneyard
plan: 03
subsystem: client-state
tags: [two-player, boneyard, zustand, socket-io, layout]

requires:
  - phase: 07-two-player-boneyard
    provides: "Server types with boneyard/playerCount fields and parameterized engine functions"
provides:
  - "BoneyardDrawPayload client type"
  - "handleBoneyardDraw gameStore action for surgical tile/count updates"
  - "game:boneyard_draw socket event wiring in useSocket"
  - "usePlayerPositions 2-player layout (bottom + top)"
affects: [07-04]

tech-stack:
  added: []
  patterns: ["playerCount default parameter on usePlayerPositions/getPosition for backward-compatible 2/4 layout"]

key-files:
  created: []
  modified:
    - client/src/types/game.ts
    - client/src/store/gameStore.ts
    - client/src/hooks/useSocket.ts
    - client/src/hooks/usePlayerPositions.ts

key-decisions:
  - "handleBoneyardDraw does surgical update (add tile + update counts) rather than full state replacement, since the full state_snapshot follows after"
  - "Drawing player gets both tile object and tileCount increment; opponents only see tileCount increment"

patterns-established:
  - "playerCount default=4 on layout functions: usePlayerPositions and getPosition accept optional playerCount for backward compatibility"

requirements-completed: [TWO-06]

duration: 2min
completed: 2026-03-12
---

# Phase 7 Plan 03: Client Types, State & Layout Summary

**BoneyardDrawPayload type, handleBoneyardDraw store action with surgical tile updates, game:boneyard_draw socket wiring, and 2-player position mapping (bottom + top)**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-12T20:47:48Z
- **Completed:** 2026-03-12T20:49:27Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Added BoneyardDrawPayload interface for client-side draw event handling
- Implemented handleBoneyardDraw store action that surgically adds drawn tile to player hand and updates boneyard/tile counts
- Wired game:boneyard_draw socket event in useSocket with proper cleanup
- Updated usePlayerPositions and getPosition to support 2-player layout (bottom + top only)

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend client types and add boneyard draw handler to gameStore** - `60ef34c` (feat)
2. **Task 2: Wire game:boneyard_draw in useSocket and update usePlayerPositions for 2-player** - `15838e0` (feat)

## Files Created/Modified
- `client/src/types/game.ts` - Added BoneyardDrawPayload interface (boneyardCount/playerCount already present from 07-01)
- `client/src/store/gameStore.ts` - Added handleBoneyardDraw action with immutable state update
- `client/src/hooks/useSocket.ts` - Registered game:boneyard_draw handler with cleanup
- `client/src/hooks/usePlayerPositions.ts` - Added playerCount parameter to usePlayerPositions and getPosition, 2-player maps bottom+top

## Decisions Made
- handleBoneyardDraw performs surgical update (add tile, update counts) rather than full state replacement, since game:state_snapshot follows after draw
- Drawing player gets both the tile object added to tiles array AND tileCount incremented; opponents only see tileCount increment

## Deviations from Plan

None - plan executed exactly as written. Note: boneyardCount and playerCount were already on ClientGameState from Plan 07-01, so Task 1 only needed to add BoneyardDrawPayload and the store action.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Client data layer fully ready for Plan 04 UI components
- usePlayerPositions returns 2-player layout when playerCount=2
- gameStore handles boneyard draw events for real-time tile updates

---
*Phase: 07-two-player-boneyard*
*Completed: 2026-03-12*

## Self-Check: PASSED

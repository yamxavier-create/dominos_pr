---
phase: 02-score-history
plan: "05"
subsystem: game-lifecycle
tags: [socket.io, game-reset, modal, zustand]

requires:
  - phase: 02-score-history
    provides: "GameEndModal, useSocket state_snapshot handler, gameHandlers.ts next_hand pattern"
provides:
  - "game:next_game server handler — full game reset with broadcast"
  - "Host/non-host UX split in GameEndModal"
  - "Automatic game-end modal dismissal on new game start"
affects: [03-rematch]

tech-stack:
  added: []
  patterns:
    - "game:next_game follows same guard/reset/broadcast pattern as game:next_hand"
    - "Host-only action with non-host waiting message (same as RoundEndModal)"

key-files:
  created: []
  modified:
    - server/src/socket/gameHandlers.ts
    - client/src/components/game/GameEndModal.tsx
    - client/src/hooks/useSocket.ts

key-decisions:
  - "gamePassCount reset to 0 on new game (unlike next_hand which preserves it) — new game means fresh pass bonus tracking"
  - "Modal dismissal driven by state_snapshot arrival (phase=playing, handNumber=1) rather than optimistic client-side close"

patterns-established:
  - "New game flow: host emits game:next_game, server resets and broadcasts, all clients react to state_snapshot"

requirements-completed: [SCORE-03]

duration: 2min
completed: 2026-03-07
---

# Phase 02 Plan 05: Next-Game Desync Fix Summary

**game:next_game handler with host-gated emit and automatic modal dismissal via state_snapshot phase detection**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-07T19:06:04Z
- **Completed:** 2026-03-07T19:08:00Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Added game:next_game server handler that fully resets scores, hand number, board, and pass counts then broadcasts to all players
- GameEndModal now shows "Jugar de Nuevo" button only to host; non-hosts see "Esperando al host..."
- useSocket automatically dismisses game-end modal and clears score history when a fresh game arrives (phase=playing, handNumber=1)

## Task Commits

Each task was committed atomically:

1. **Task 1: Add game:next_game handler in gameHandlers.ts** - `8a7c684` (feat)
2. **Task 2: Update GameEndModal and useSocket for new game flow** - `3cb75b8` (feat)

## Files Created/Modified
- `server/src/socket/gameHandlers.ts` - Added game:next_game handler with full game state reset
- `client/src/components/game/GameEndModal.tsx` - Host/non-host button split, emit game:next_game instead of room:leave
- `client/src/hooks/useSocket.ts` - Clear game-end modal + score history on new game state_snapshot

## Decisions Made
- Removed navigate('/') and room:leave from play-again flow — players stay in-room for the new game
- Used useGameStore.getState().clearGameEnd() in socket handler (correct Zustand pattern for non-React context)
- socket import was already present in GameEndModal (plan said to add it, but it existed)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Next-game flow complete — all four players atomically transition from game-end to fresh game
- Score history correctly resets on new game start
- Ready for rematch/session features if planned

## Self-Check: PASSED

All files found, all commits verified, both type-checks pass.

---
*Phase: 02-score-history*
*Completed: 2026-03-07*

---
phase: 07-two-player-boneyard
plan: 02
subsystem: game-handlers
tags: [two-player, boneyard, socket-handlers, auto-pass, draw-mechanic]

requires:
  - phase: 07-two-player-boneyard
    provides: "Parameterized GameEngine functions (dealTiles, nextPlayerIndex, isGameBlocked) and ServerGameState.boneyard field"
provides:
  - "game:start accepts 2 or 4 players"
  - "Boneyard draw loop in processAutoPassCascade"
  - "game:boneyard_draw event emission (tile to drawer, null to opponents)"
  - "Dynamic rematch vote count (playerCount instead of hardcoded 4)"
  - "All handler loops use game.players.length"
affects: [07-03, 07-04]

tech-stack:
  added: []
  patterns: ["boneyard draw-before-pass pattern in auto-pass cascade", "game:boneyard_draw split emit (private tile vs public notification)"]

key-files:
  created: []
  modified:
    - server/src/socket/gameHandlers.ts

key-decisions:
  - "No RoomManager changes needed -- max 4 cap at join time is correct; 2-or-4 validation happens at game:start"
  - "Boneyard draw emits per-tile events rather than batched -- enables client-side draw animations"
  - "io.to(room).except(socket) pattern for split emit -- standard Socket.io v4 API"

patterns-established:
  - "Boneyard draw-before-pass: always attempt boneyard draws before auto-passing a player"
  - "Split emit pattern: sensitive data (drawn tile) to actor only, public data (count) to room"

requirements-completed: [TWO-01, TWO-03]

duration: 3min
completed: 2026-03-12
---

# Phase 7 Plan 02: Server Handlers Summary

**Dynamic playerCount in all game handlers with boneyard draw-before-pass mechanic in processAutoPassCascade**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-12T20:47:45Z
- **Completed:** 2026-03-12T20:51:06Z
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments
- game:start now accepts rooms with exactly 2 or 4 players, rejecting 1 or 3
- All handler loops (next_hand, next_game, rematch, auto-pass cascade) use dynamic playerCount
- Boneyard draw loop draws tiles one-by-one before auto-passing, emitting game:boneyard_draw per tile
- Partner protection disabled in 2-player mode (partnerOfTilePlayer = -1)
- Rematch requires playerCount votes instead of hardcoded 4

## Task Commits

Each task was committed atomically:

1. **Task 1: Update game:start, next_hand, next_game, and rematch handlers for dynamic playerCount** - `667c262` (feat)
2. **Task 2: Add boneyard draw logic to processAutoPassCascade** - `5bd88f3` (feat)

## Files Created/Modified
- `server/src/socket/gameHandlers.ts` - Dynamic playerCount in all handlers, boneyard draw loop in processAutoPassCascade, split emit for draw events

## Decisions Made
- No RoomManager.ts changes needed -- the max 4 player cap at join time is correct; the 2-or-4 exact count validation belongs at game:start time
- Boneyard draws emit individual game:boneyard_draw events per tile (not batched) to enable client draw animations
- Used io.to(room).except(socket) for split emit -- drawing player gets tile data, opponents get null

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Server handlers fully support 2-player games with boneyard draw mechanic
- Ready for Plan 03 (client-side UI adaptations for 2-player layout and boneyard display)
- game:boneyard_draw event ready for client handler implementation

---
*Phase: 07-two-player-boneyard*
*Completed: 2026-03-12*

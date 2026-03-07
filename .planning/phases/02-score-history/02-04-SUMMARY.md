---
phase: 02-score-history
plan: "04"
subsystem: ui
tags: [react, domino-tiles, svg, resize-observer, layout]

requires:
  - phase: 02-score-history
    provides: "Board tile rendering infrastructure (BoardTile.tsx, GameBoard.tsx)"
provides:
  - "Legible 80x40 board tiles matching SVG viewBox 1:1"
  - "Jitter-free first render via ResizeObserver-driven dims"
  - "SNAKE_CAP bumped to 620 for proper row density with larger tiles"
affects: [02-score-history]

tech-stack:
  added: []
  patterns:
    - "ResizeObserver guard pattern: init dims to 0, skip render until observer fires"

key-files:
  created: []
  modified:
    - client/src/components/board/BoardTile.tsx
    - client/src/components/board/GameBoard.tsx

key-decisions:
  - "Tile dimensions set to 80x40 (1:1 SVG viewBox) rather than intermediate scale"
  - "containerRef attached to all early-return divs so ResizeObserver works in every state"

patterns-established:
  - "Zero-init dims pattern: useState({w:0,h:0}) + guard clause prevents layout flash"

requirements-completed: [SCORE-01, SCORE-02]

duration: 2min
completed: 2026-03-07
---

# Phase 2 Plan 04: Tile Scale + Jitter Fix Summary

**Board tiles scaled from 52x26 to 80x40 (1:1 SVG viewBox) with zero-jitter first render via ResizeObserver guard**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-07T19:06:04Z
- **Completed:** 2026-03-07T19:07:29Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Tile dimensions increased from 52x26 to 80x40 making pips clearly legible on mobile
- Eliminated first-frame layout jitter by initializing dims to {w:0,h:0}
- Bumped SNAKE_CAP from 560 to 620 maintaining ~7 tiles per row visual density

## Task Commits

Each task was committed atomically:

1. **Task 1: Increase tile dimensions in BoardTile.tsx** - `4891b58` (feat)
2. **Task 2: Fix GameBoard initial dims and bump SNAKE_CAP** - `9dc44b5` (fix)

## Files Created/Modified
- `client/src/components/board/BoardTile.tsx` - Updated TILE_H_W/H_H/V_W/V_H constants to 80/40/40/80
- `client/src/components/board/GameBoard.tsx` - Zero-init dims, ResizeObserver guard, SNAKE_CAP 620

## Decisions Made
- Set tile dimensions to exact 1:1 SVG viewBox match (80x40) rather than an intermediate scale
- Attached containerRef to all early-return paths (empty board + zero-dims guard) so ResizeObserver fires in every component state

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Board tiles are now legible at full SVG resolution
- No first-render layout flash
- Ready for Plan 05 (next-game desync fix)

---
*Phase: 02-score-history*
*Completed: 2026-03-07*

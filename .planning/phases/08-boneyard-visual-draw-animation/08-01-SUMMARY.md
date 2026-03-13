---
phase: 08-boneyard-visual-draw-animation
plan: 01
subsystem: ui
tags: [react, svg, domino, animation, boneyard]

requires:
  - phase: 07-two-player-mode
    provides: boneyardCount in ClientGameState, 2-player mode infrastructure
provides:
  - DominoTile faceDown prop for rendering tile backs
  - BoneyardPile component with stacked visual and count badge
  - Visual boneyard integrated into GameTable for 2-player mode
affects: [08-02-draw-animation]

tech-stack:
  added: []
  patterns: [face-down tile rendering via faceDown prop, fade-out unmount pattern with useRef timer]

key-files:
  created:
    - client/src/components/game/BoneyardPile.tsx
  modified:
    - client/src/components/domino/DominoTile.tsx
    - client/src/components/game/GameTable.tsx

key-decisions:
  - "faceDown tiles use dark green (#2D4A3E) with subtle inner border to match felt table aesthetic"
  - "BoneyardPile uses useRef timer for fade-out to avoid stale closure issues"

patterns-established:
  - "faceDown prop pattern: DominoTile early-returns with solid back SVG, skipping all pip/selection logic"

requirements-completed: [BONE-01, BONE-04]

duration: 2min
completed: 2026-03-12
---

# Phase 8 Plan 1: Boneyard Visual Pile Summary

**Visual boneyard pile with stacked face-down domino tiles, count badge, and smooth fade-out when emptied**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-13T00:39:04Z
- **Completed:** 2026-03-13T00:40:38Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- DominoTile renders solid dark green back when faceDown=true (no pips, no divider, no interaction states)
- BoneyardPile shows 1-4 stacked face-down tiles with natural 2px offset depth illusion and count badge
- GameTable renders visual pile in 2-player mode instead of plain text counter

## Task Commits

Each task was committed atomically:

1. **Task 1: Add faceDown prop to DominoTile and create BoneyardPile component** - `0bc4fcd` (feat)
2. **Task 2: Integrate BoneyardPile into GameTable replacing text badge** - `6c5f982` (feat)

## Files Created/Modified
- `client/src/components/domino/DominoTile.tsx` - Added faceDown prop with early-return solid back rendering for both horizontal and vertical orientations
- `client/src/components/game/BoneyardPile.tsx` - New component: stacked face-down tiles with count badge and fade-out on empty
- `client/src/components/game/GameTable.tsx` - Replaced text badge with BoneyardPile, guarded by is2Player

## Decisions Made
- faceDown tiles use dark green (#2D4A3E) with subtle inner border (#3D5A4E) to match the felt table aesthetic
- BoneyardPile uses useRef for the fade-out timer to avoid stale closure cleanup issues
- Pile container sized at 36x68px to accommodate 4 stacked tiles with 2px offsets

## Deviations from Plan
None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- BoneyardPile component ready for draw animation integration in plan 08-02
- faceDown prop available for any future face-down tile rendering needs

---
*Phase: 08-boneyard-visual-draw-animation*
*Completed: 2026-03-12*

## Self-Check: PASSED

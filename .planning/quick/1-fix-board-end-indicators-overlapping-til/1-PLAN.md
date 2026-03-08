---
phase: quick
plan: 1
type: execute
wave: 1
depends_on: []
files_modified:
  - client/src/components/board/GameBoard.tsx
autonomous: true
requirements: [QUICK-1]
must_haves:
  truths:
    - "End badges never visually overlap tiles at corners"
    - "Snake rows contain at least 2 tiles before a direction change"
  artifacts:
    - path: "client/src/components/board/GameBoard.tsx"
      provides: "Fixed computeSnakeLayout and badge positioning"
  key_links:
    - from: "computeSnakeLayout"
      to: "badge position calculations"
      via: "corner flag and tile positions"
      pattern: "leftItem\\.corner|rightItem\\.corner"
---

<objective>
Fix two related issues in GameBoard.tsx: (1) end indicator badges overlap tiles when the end tile is a corner tile, and (2) the snake layout allows direction changes after a single tile, creating cramped visuals.

Purpose: Improve board readability by preventing badge/tile overlap and ensuring a minimum of 2 tiles per row before wrapping.
Output: Updated computeSnakeLayout with minimum-tiles-per-row enforcement and improved badge offset calculations for corner tiles.
</objective>

<execution_context>
@/Users/yamirx/.claude/get-shit-done/workflows/execute-plan.md
@/Users/yamirx/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@client/src/components/board/GameBoard.tsx
</context>

<tasks>

<task type="auto">
  <name>Task 1: Enforce minimum 2 tiles per row in computeSnakeLayout</name>
  <files>client/src/components/board/GameBoard.tsx</files>
  <action>
In computeSnakeLayout, add a `tilesInRow` counter for both the right arm and left arm loops. Initialize to 1 (anchor counts for the first row). Increment on each non-corner tile placement. When the boundary check triggers (tile would exceed ±half), only allow corner wrapping if `tilesInRow >= 2`. If fewer than 2, place the tile normally (let it extend slightly past the boundary) and increment `tilesInRow`. Reset `tilesInRow = 1` after each corner wrap (the corner tile counts as the first tile of the new row).

Right arm loop (lines 66-107): Add `let tilesInRow = 1` before the loop. In both dir===1 and dir===-1 branches, gate the `isCorner = true` assignment with `&& tilesInRow >= 2`. After setting isCorner and changing direction, reset `tilesInRow = 1`. In the else (non-corner) branch, increment `tilesInRow++`.

Left arm loop (lines 120-161): Same pattern — `let tilesInRow = 1`, gate corner with `tilesInRow >= 2`, reset on wrap, increment on non-corner.
  </action>
  <verify>
    <automated>cd /Users/yamirx/Claude_Code/development/dominos_pr/client && npx tsc --noEmit</automated>
  </verify>
  <done>computeSnakeLayout never creates a row with fewer than 2 tiles. TypeScript compiles cleanly.</done>
</task>

<task type="auto">
  <name>Task 2: Fix end badge positioning for corner tiles</name>
  <files>client/src/components/board/GameBoard.tsx</files>
  <action>
The current badge positioning for corner tiles places badges too close to the tile, causing overlap. Fix the badge offset calculations (lines 254-275) for corner cases:

For the LEFT end badge when leftItem.corner is true:
- The left-end corner tile is vertical (rotated horizontal). The exposed pip faces upward (top of tile). Place the badge ABOVE the tile with more clearance: `leftBadgeY = leftItem.pos.y - leftDisplaySize.h / 2 - 40` (was -22, increase to -40 for 36px badge + 4px gap). Keep leftBadgeX centered: `leftItem.pos.x - 18`.

For the RIGHT end badge when rightItem.corner is true:
- The right-end corner tile is vertical. The exposed pip faces downward (bottom of tile). Place the badge BELOW with more clearance: `rightBadgeY = rightItem.pos.y + rightDisplaySize.h / 2 + 40` (was +22, increase to +40). Keep rightBadgeX centered: `rightItem.pos.x - 18`.

Also ensure badge positions are clamped within container bounds (the existing Math.max/Math.min guards).
  </action>
  <verify>
    <automated>cd /Users/yamirx/Claude_Code/development/dominos_pr/client && npx tsc --noEmit</automated>
  </verify>
  <done>End badges for corner tiles are offset far enough to not overlap the tile. Badge is 36px; offset provides at least 4px gap from tile edge.</done>
</task>

</tasks>

<verification>
1. `cd client && npx tsc --noEmit` — no type errors
2. `npm run dev` — visual verification: play tiles until snake wraps; confirm badges don't overlap corner tiles and rows have at least 2 tiles
</verification>

<success_criteria>
- TypeScript compiles with no errors
- Snake rows always contain at least 2 tiles before direction change
- End indicator badges have visible gap from corner tiles (no overlap)
</success_criteria>

<output>
After completion, create `.planning/quick/1-fix-board-end-indicators-overlapping-til/1-SUMMARY.md`
</output>

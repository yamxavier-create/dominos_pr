# Phase 8: Boneyard Visual & Draw Animation - Context

**Gathered:** 2026-03-12
**Status:** Ready for planning

<domain>
## Phase Boundary

Show boneyard tiles face-down on the game table and animate drawing one tile at a time. This is a visual/UX polish phase — no server logic changes. The `game:boneyard_draw` event and `boneyardCount` already exist from Phase 7.

</domain>

<decisions>
## Implementation Decisions

### Boneyard Visual Representation
- Stacked pile of 3-4 face-down domino tiles, offset by 2-3px each to show depth
- Reuse existing `DominoTile` component with a new `faceDown` prop (hides pips, shows solid/pattern back)
- Positioned to the side of the board area (right side), out of the snake layout's way
- Pile visually shrinks as tiles are drawn — layers reduce as `boneyardCount` drops
- When boneyard empties (count reaches 0), pile fades away smoothly (opacity transition ~300ms)
- Count badge overlaid on or near the pile

### Draw Animation — Drawing Player
- Tile flies face-down from boneyard pile toward the player's hand area
- On arrival, tile appears face-up in hand (no flip animation — just reveals with pips)
- Sequential draws with ~500ms pause between each draw
- Matches existing `tile-new` animation style (scale+fade, 0.35s) for consistency

### Draw Animation — Opponent View
- Opponents see a face-down tile fly from the boneyard pile toward the drawing player's seat position
- Tile disappears into opponent's hand area — their visible tile count increments
- Same sequential pacing as drawing player (~500ms between draws)

### Multi-Draw Pacing
- Each draw is animated individually, one at a time
- ~500ms pause between consecutive draws to build tension and mimic real table feel
- Total time for N draws: approximately N × 800ms (300ms flight + 500ms pause)

### Empty Boneyard
- After last tile drawn, pile fades out entirely (opacity 1 → 0, ~300ms)
- No ghost outline or placeholder remains — space is simply empty

### Claude's Discretion
- Exact CSS animation implementation (keyframes, transforms, easing curves)
- Flight path shape (linear, arc, or bezier curve)
- How to queue/manage animation state for sequential draws
- Face-down tile visual design (solid color, subtle pattern, or branded back)
- Exact positioning coordinates relative to board container
- How to handle the transition from current text badge to new pile visual

</decisions>

<specifics>
## Specific Ideas

- The boneyard pile should feel like a real domino table — tiles stacked naturally, not perfectly aligned
- Sequential draw animation is key to the game feel — each draw should be its own moment of anticipation
- Reusing DominoTile component keeps visual consistency with the rest of the game

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `DominoTile` component ([DominoTile.tsx](client/src/components/domino/DominoTile.tsx)): Add `faceDown` prop to hide pips
- `lastTileSequence` in gameStore: Pattern for tracking "newest" element for animation
- `tile-new` keyframes in [index.css:62](client/src/index.css#L62): Existing animation pattern (scale+fade, 0.35s)
- `BoardTileItem` wrapper: Shows how `isNew` flag triggers CSS animation class

### Established Patterns
- Animation via CSS classes toggled by state (`tile-new` class on `isNew` flag)
- `handleBoneyardDraw` in gameStore already handles state updates (tile to hand, count decrement)
- `game:boneyard_draw` socket event already emits per-tile with split payload (tile for drawer, null for opponents)

### Integration Points
- `GameTable.tsx`: Currently renders boneyard as text badge (`{boneyardCount} fichas`) — replace with pile component
- `gameStore.handleBoneyardDraw`: Add animation state/queue management for sequential draws
- `usePlayerPositions`: Provides seat positions for flight animation targets
- `index.css`: Add new keyframes for flight animation

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 08-boneyard-visual-draw-animation*
*Context gathered: 2026-03-12*

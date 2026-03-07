# Phase 2: Score History - Context

**Gathered:** 2026-03-06
**Status:** Ready for planning

<domain>
## Phase Boundary

Add a collapsible per-hand score log accessible by tapping the score bar during a game. Players can open the panel to review completed hand results and running totals without leaving the game view. Resets when a new game starts (not on rematch).

</domain>

<decisions>
## Implementation Decisions

### Panel shape
- Slides DOWN from the score bar — top-anchored, board remains visible behind/below
- Fixed height (~3 rows visible); scrollable if more hands than fit
- Newest hand at the top (most recent first)
- Smooth CSS transition (slide/height animation) on open and close — consistent with existing tile animations

### Entry detail
- Each row: hand number, winning team (Nosotros/Ellos — relative to viewer), points scored (+N), running team totals (e.g. `75 | 30`)
- Format example: `Mano 3  Nosotros  +50   75 | 30`
- Special outcome badges on the row: `¡Capicú!` (gold), `¡Chuchazo!` (accent/orange), `¡Trancado!` (amber) — data already in `RoundEndPayload`, no server changes needed
- Team labels are relative per-player (Nosotros/Ellos), same convention as ScorePanel and RoundEndModal
- Only completed hands appear — no "En curso" placeholder for the hand in progress

### Claude's Discretion
- Trigger affordance: how the score bar signals it's tappable (chevron icon, subtle border, cursor change)
- Dismissal mechanic: tap score bar again or tap outside/overlay — either is fine
- Auto-close behavior when round-end modal appears
- Empty state (before hand 1 completes) — could hide tap affordance, show "No hands yet", or grey out
- Exact typography, spacing, row padding, and color treatment of the panel rows
- Whether to add a thin separator line between panel and board

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `ScorePanel.tsx`: Pure display component, no onClick — needs an `onClick` prop and a chevron indicator added; otherwise keep as-is
- `RoundEndPayload` type (already in `client/src/types/game.ts`): contains all fields needed per row — `winningTeam`, `totalPointsScored`, `scores`, `isCapicu`, `isChuchazo`, `reason` — zero server changes required
- `uiStore.ts` `showRoundEnd`/`showGameEnd` pattern: add `showScoreHistory: boolean` + `setShowScoreHistory` following the exact same pattern
- `gameStore.ts` `resetGame()`: extend to also clear `scoreHistory` array when a new game starts

### Established Patterns
- Modals (`RoundEndModal`, `GameEndModal`): `fixed inset-0 z-40` full-screen overlay — this feature intentionally differs (partial, non-blocking)
- Custom design tokens: `primary` (#22C55E green), `accent` (#F97316 orange), `gold` for badge colors
- `font-header` (Bebas Neue) for scores/numbers, `font-body` (Nunito) for labels — maintain this split
- `gameStore` holds game data, `uiStore` holds visibility state — score history array belongs in `gameStore`; open/close toggle belongs in `uiStore`

### Integration Points
- **`gameStore.ts`**: Add `scoreHistory: RoundEndPayload[]`, `addToScoreHistory(data: RoundEndPayload)`, extend `resetGame()` to clear it
- **`uiStore.ts`**: Add `showScoreHistory: boolean`, `setShowScoreHistory(v: boolean)`
- **`useSocket.ts`**: In `game:round_ended` handler, call `addToScoreHistory(data)` (alongside existing `setRoundEnd`); in `game:started` handler, call `clearScoreHistory()` (new game resets history)
- **`ScorePanel.tsx`**: Add `onClick` prop + open/closed state indicator (chevron); `GameTable.tsx` passes the handler
- **`GameTable.tsx`**: Render new `<ScoreHistoryPanel />` immediately below `<ScorePanel />`, conditionally shown via `showScoreHistory`
- **New file**: `client/src/components/game/ScoreHistoryPanel.tsx`

</code_context>

<specifics>
## Specific Ideas

- Row format confirmed by user: `Mano 3  Nosotros  +50   75 | 30`
- Badge style should match the inline badges in RoundEndModal (`bg-gold text-bg font-bold text-sm px-3 py-1 rounded-full`) but smaller for the compact row context

</specifics>

<deferred>
## Deferred Ideas

- None — discussion stayed within phase scope. Trigger/dismissal and empty state deferred to Claude's Discretion (no strong user preference expressed).

</deferred>

---

*Phase: 02-score-history*
*Context gathered: 2026-03-06*

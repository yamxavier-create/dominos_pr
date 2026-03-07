---
phase: 02-score-history
plan: 01
subsystem: ui
tags: [react, zustand, typescript]

# Dependency graph
requires: []
provides:
  - "gameStore.scoreHistory: ScoreHistoryEntry[] — typed accumulator for round results, newest-first"
  - "gameStore.addToScoreHistory(data, handNumber) — prepend action"
  - "gameStore.clearScoreHistory() — reset action"
  - "gameStore.resetGame() — extended to clear scoreHistory"
  - "ScoreHistoryEntry type export from gameStore.ts"
  - "uiStore.showScoreHistory: boolean — panel open/close toggle"
  - "uiStore.setShowScoreHistory(v) — setter action"
affects: [02-02, 02-03]

# Tech tracking
tech-stack:
  added: []
  patterns: ["ScoreHistoryEntry interface co-located in gameStore.ts (no separate types file for store-local types)"]

key-files:
  created: []
  modified:
    - client/src/store/gameStore.ts
    - client/src/store/uiStore.ts

key-decisions:
  - "ScoreHistoryEntry defined inside gameStore.ts (not in types/game.ts) — it is a store-layer concern, not a protocol type"
  - "Export via `export type { ScoreHistoryEntry }` so ScoreHistoryPanel can import without coupling to implementation"
  - "handNumber captured at addToScoreHistory call time — not derivable from scoreHistory.length due to clearScoreHistory possibility"

patterns-established:
  - "Prepend pattern: scoreHistory: [newEntry, ...state.scoreHistory] — index 0 is always newest"
  - "Modal toggle pattern: setShowScoreHistory follows setShowRoundEnd / setShowGameEnd convention exactly"

requirements-completed: [SCORE-01, SCORE-02, SCORE-03]

# Metrics
duration: 1min
completed: 2026-03-07
---

# Phase 2 Plan 01: Store Extensions Summary

**Zustand store contracts for score history: ScoreHistoryEntry accumulator in gameStore and showScoreHistory toggle in uiStore, typed and passing strict TypeScript**

## Performance

- **Duration:** ~1 min
- **Started:** 2026-03-07T01:35:16Z
- **Completed:** 2026-03-07T01:36:12Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Extended gameStore with `scoreHistory: ScoreHistoryEntry[]`, `addToScoreHistory`, `clearScoreHistory`, and updated `resetGame` to clear the array
- Exported `ScoreHistoryEntry` type so ScoreHistoryPanel (plan 02-02) can import it without coupling to internal implementation
- Extended uiStore with `showScoreHistory: boolean` and `setShowScoreHistory` following the identical pattern used by `setShowRoundEnd` / `setShowGameEnd`

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend gameStore with scoreHistory** - `9397886` (feat)
2. **Task 2: Extend uiStore with showScoreHistory** - `cd932cd` (feat)

## Files Created/Modified
- `client/src/store/gameStore.ts` - Added ScoreHistoryEntry interface, scoreHistory field, addToScoreHistory, clearScoreHistory, extended resetGame
- `client/src/store/uiStore.ts` - Added showScoreHistory field and setShowScoreHistory action

## Decisions Made
- ScoreHistoryEntry defined co-located in gameStore.ts rather than types/game.ts — it is a store-layer concern (contains RoundEndPayload, which IS a protocol type, but the wrapper is not)
- handNumber stored explicitly at add-time because it cannot be derived from array length if clearScoreHistory is called mid-game

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Store contracts are in place for plan 02-02 (ScoreHistoryPanel component) and 02-03 (wire-up in useSocket + GameTable)
- No blockers

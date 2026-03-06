# Phase 1: Bug Fixes - Context

**Gathered:** 2026-03-06
**Status:** Ready for planning

<domain>
## Phase Boundary

Fix four prerequisite bugs that block correct rematch UI, chat input, and animation behavior. No new features, no GameEngine.ts changes. Each fix is independently verifiable.

</domain>

<decisions>
## Implementation Decisions

### BUG-01: Animation targets wrong tile on left-end plays
- Fix: In `useSocket.ts:56`, replace array-position lookup with sequence-based lookup
- Use `Math.max(...board.tiles.map(t => t.sequence))` to find the newest tile's sequence
- Do NOT use `board.tiles[board.tiles.length - 1]` — this is wrong for left-end plays
- File: `client/src/hooks/useSocket.ts`

### BUG-02: isHost determination wrong in RoundEndModal
- Fix: Expose `isHost` as a boolean per-player in the server's room info payload
- Server computes `isHost` per-player (not `hostSocketId` sent raw to client)
- `RoundEndModal.tsx` reads this value instead of computing `myPlayerIndex === 0`
- Also applies to any other component that checks host status (make it canonical)
- File: `client/src/components/game/RoundEndModal.tsx`, server room payload

### BUG-03: selectedTileId not cleared on turn change
- Fix: In `useSocket.ts` `game:state_snapshot` handler, call `setSelectedTile(null)` when `!gameState.isMyTurn`
- Files: `client/src/hooks/useSocket.ts:49-60`, `client/src/store/uiStore.ts`

### BUG-04: Dynamic require() in roomHandlers.ts
- Fix: Convert `require('../game/GameEngine')` at `roomHandlers.ts:36` to a static ES import at the top of the file
- Scope: ONLY the static import conversion — do NOT also refactor the disconnect handler duplication
- Disconnect handler cleanup is deferred (relevant to Phase 3/4 but not required for this phase)
- File: `server/src/socket/roomHandlers.ts`

### Claude's Discretion
- Commit strategy (one commit per bug vs batched)
- Whether to add inline comments explaining the fix rationale

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `uiStore.setSelectedTile(null)`: already exists, just needs to be called in the right place
- `buildClientGameState` in `GameEngine.ts`: already imported in most server files statically — roomHandlers.ts is the outlier

### Established Patterns
- Server sends personalized `ClientGameState` per player via `buildClientGameState(state, playerIndex)` — isHost should follow the same per-player projection pattern
- `useSocket.ts` is the single place all `game:state_snapshot` side effects happen — BUG-01 and BUG-03 both live here

### Integration Points
- `useSocket.ts`: hub for BUG-01 and BUG-03 fixes (same file, different handler sections)
- Room info payload (server → client): needs `isHost` boolean added for BUG-02
- `roomHandlers.ts:36`: isolated dynamic require, no cascading changes needed for BUG-04

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches. All four bugs have clear, documented fix paths in CONCERNS.md.

</specifics>

<deferred>
## Deferred Ideas

- Disconnect handler duplication cleanup (`handlePlayerLeave` extraction) — relevant for Phase 3/4, deferred from BUG-04 scope
- `game:next_hand` hand-starter bug (wrong player starts hand 2+) — known issue but out of Phase 1 scope; address in a future phase or as a pre-Phase-3 insert

</deferred>

---

*Phase: 01-bug-fixes*
*Context gathered: 2026-03-06*

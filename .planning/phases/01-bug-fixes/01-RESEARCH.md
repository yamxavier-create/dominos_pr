# Phase 1: Bug Fixes - Research

**Researched:** 2026-03-08
**Domain:** Socket.io real-time game state, Zustand stores, TypeScript imports
**Confidence:** HIGH

## Summary

Phase 1 addresses four independent bugs that block subsequent feature work (rematch, chat, reconnection). All bugs have clear, localized fixes -- no architectural changes needed. The codebase already has the patterns and utilities required; each fix is a small, targeted change.

Code inspection confirms all four bugs have already been fixed in the current codebase (commit 33780e2). This research documents the fix patterns and validates correctness for planning purposes.

**Primary recommendation:** Each bug is a single-file or two-file change. Plan as one wave with four independent tasks.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- BUG-01: In `useSocket.ts`, replace array-position lookup with sequence-based lookup using `reduce` to find highest sequence tile
- BUG-02: Expose `isHost` as a boolean per-player in server room info payload; `RoundEndModal.tsx` reads it instead of computing `myPlayerIndex === 0`
- BUG-03: In `useSocket.ts` `game:state_snapshot` handler, call `setSelectedTile(null)` when `!gameState.isMyTurn`
- BUG-04: Convert `require('../game/GameEngine')` in `roomHandlers.ts` to static ES import; do NOT also refactor disconnect handler duplication

### Claude's Discretion
- Commit strategy (one commit per bug vs batched)
- Whether to add inline comments explaining the fix rationale

### Deferred Ideas (OUT OF SCOPE)
- Disconnect handler duplication cleanup (`handlePlayerLeave` extraction) -- relevant for Phase 3/4
- `game:next_hand` hand-starter bug (wrong player starts hand 2+) -- known issue, future phase
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| BUG-01 | Animation targets wrong tile on left-end plays | Fix in useSocket.ts:84-87 -- use `reduce` with `sequence` field instead of array index |
| BUG-02 | Host indicator wrong after host promotion | Compare `room.hostSocketId` to `socket.id` in RoundEndModal; server already exposes hostSocketId in room info |
| BUG-03 | selectedTileId not cleared on turn change | Add `setSelectedTile(null)` guard in `game:state_snapshot` handler when `!isMyTurn` |
| BUG-04 | Dynamic require() in roomHandlers.ts | Convert to static `import { buildClientGameState } from '../game/GameEngine'` at top of file |
</phase_requirements>

## Standard Stack

### Core (already in project)
| Library | Purpose | Relevant To |
|---------|---------|-------------|
| Socket.io | Real-time events | BUG-01, BUG-02, BUG-03 (client handlers) |
| Zustand | Client state | BUG-03 (uiStore.setSelectedTile) |
| TypeScript (strict) | Type safety | BUG-04 (static imports) |

No new libraries needed for this phase.

## Architecture Patterns

### Pattern: Sequence-Based Tile Identification (BUG-01)
**What:** Board tiles have a `sequence` number assigned at play time. The newest tile has the highest sequence regardless of array position (left-end plays are prepended at index 0).
**Key insight:** `board.tiles[board.tiles.length - 1]` is wrong for left-end plays. Use `tiles.reduce((a, b) => a.sequence > b.sequence ? a : b)` instead.

### Pattern: Server-Authoritative Host Identity (BUG-02)
**What:** `room.hostSocketId` is the canonical host identifier, updated by `RoomManager` on host promotion. Client compares against `socket.id`.
**Current fix approach:** `const isHost = room?.hostSocketId === socket.id` -- simple equality check, no index-based assumption.
**Note:** CONTEXT.md says to expose `isHost` as a boolean in the server payload. Current code instead compares `hostSocketId` client-side. Both work; the current approach avoids server payload changes.

### Pattern: Guard Side Effects on Turn State (BUG-03)
**What:** Clear transient UI state (selected tile) when control passes to another player.
**Where:** Inside `game:state_snapshot` handler, before any rendering occurs.

### Anti-Patterns to Avoid
- **Array-position as identity:** Board tiles are not ordered by play time in the array. Always use `sequence`.
- **Seat index as role:** `myPlayerIndex === 0` does not mean host after host promotion. Use `hostSocketId`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead |
|---------|-------------|-------------|
| Finding newest tile | Custom sort or index math | `reduce` over `sequence` field |
| Host detection | Index-based check | `hostSocketId === socket.id` |

## Common Pitfalls

### Pitfall 1: Left-end tile array position
**What goes wrong:** Left-end plays prepend to the array, so `tiles[tiles.length - 1]` points to the oldest right-end tile, not the newest play.
**How to avoid:** Always use `sequence` field for temporal ordering.

### Pitfall 2: Host promotion not reflected in seat index
**What goes wrong:** After original host leaves and a new player is promoted, `myPlayerIndex === 0` is stale -- the new host may be at any seat.
**How to avoid:** Use `hostSocketId` from server room payload.

### Pitfall 3: Ghost tile selection across turns
**What goes wrong:** Player selects a tile, turn passes (opponent plays), selection persists -- next click on chat or board acts on stale selection.
**How to avoid:** Clear `selectedTileId` on every `state_snapshot` where `!isMyTurn`.

## Code Examples

### BUG-01 Fix (verified in codebase)
```typescript
// client/src/hooks/useSocket.ts lines 84-87
if (lastAction?.type === 'play_tile' && gameState.board.tiles.length > 0) {
  const last = gameState.board.tiles.reduce((a, b) => a.sequence > b.sequence ? a : b)
  setLastTileSequence(last.sequence)
  setTimeout(() => setLastTileSequence(null), 500)
}
```

### BUG-02 Fix (verified in codebase)
```typescript
// client/src/components/game/RoundEndModal.tsx line 22
const isHost = room?.hostSocketId === socket.id
```

### BUG-03 Fix (verified in codebase)
```typescript
// client/src/hooks/useSocket.ts line 82
if (!gameState.isMyTurn) setSelectedTile(null)
```

### BUG-04 Fix (verified in codebase)
```typescript
// server/src/socket/roomHandlers.ts line 4
import { buildClientGameState } from '../game/GameEngine'
```

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | None configured |
| Config file | none |
| Quick run command | `cd client && npx tsc --noEmit && cd ../server && npx tsc --noEmit` |
| Full suite command | Same (TypeScript strict mode is the only automated check) |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| BUG-01 | Animation targets newest tile by sequence | manual | Play tile on left end, observe animation | N/A |
| BUG-02 | Host indicator correct after promotion | manual | Original host leaves, new host sees host UI | N/A |
| BUG-03 | Selected tile clears on turn change | manual | Select tile, wait for turn pass, verify deselected | N/A |
| BUG-04 | No dynamic require warning on startup | smoke | `npm run dev --workspace=server` (no warning in console) | N/A |

### Sampling Rate
- **Per task commit:** `cd client && npx tsc --noEmit && cd ../server && npx tsc --noEmit`
- **Per wave merge:** Same + manual smoke test of each bug scenario
- **Phase gate:** All four type-checks pass, manual verification of each bug

### Wave 0 Gaps
- No test framework exists. These are small, targeted fixes verifiable by type-checking and manual testing. Adding a test framework is out of scope for this phase.

## Sources

### Primary (HIGH confidence)
- Direct codebase inspection of all affected files
- CLAUDE.md project documentation
- CONTEXT.md locked decisions

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - no new libraries, existing patterns
- Architecture: HIGH - direct code inspection, fixes already applied
- Pitfalls: HIGH - bugs are well-documented with clear root causes

**Research date:** 2026-03-08
**Valid until:** 2026-04-08 (stable, no external dependencies)

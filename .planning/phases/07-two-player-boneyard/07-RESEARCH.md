# Phase 7: Two-Player Mode with Boneyard - Research

**Researched:** 2026-03-12
**Domain:** Game engine refactoring (server logic + client layout) for 2-player domino variant with boneyard
**Confidence:** HIGH

## Summary

This phase extends the existing 4-player-only domino game to also support 2-player games with a boneyard (draw pile). The core challenge is pervasive hardcoding of `4` throughout the server game engine, handlers, room manager, and client layout. Every function that assumes 4 players, team-based scoring (TeamScores with team0/team1), or fixed seat positions (bottom/right/top/left) must be branched or parameterized by player count.

The boneyard mechanic is the most novel addition: when a player cannot play, the server draws tiles from the boneyard one by one until a playable tile is found or the boneyard empties. This happens entirely server-side within `processAutoPassCascade()` -- the client never initiates draws. The client only sees: (1) its own tiles growing after a draw, (2) a boneyard count decrementing, and (3) pass notifications if the boneyard empties without finding a playable tile.

The scoring model changes fundamentally: in 2-player mode there are no teams -- each player is an individual. The existing `TeamScores` structure (`team0`/`team1`) can be reused by mapping player 0 to `team0` and player 1 to `team1`, but all UI labels must change from "Nosotros/Ellos" to player names.

**Primary recommendation:** Parameterize by `playerCount` (derived from `game.players.length`) rather than introducing a separate `gameType` flag. Use `game.players.length` as the single source of truth for 2-player vs 4-player branching throughout server and client.

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions
- Game mode detection is automatic based on player count: 2 players = 2-player mode, 4 players = classic mode
- Each player receives 7 tiles; remaining 14 form the boneyard
- Boneyard is server-side only -- client knows boneyard count but not tile contents
- When a player cannot play, they draw tiles one at a time until a playable tile is found OR the boneyard is empty
- If boneyard empties and still no valid play, the player passes
- No client `game:pass` event -- server auto-handles drawing + passing (consistent with existing pattern)
- Individual scoring -- no teams in 2-player mode
- Winner of the hand earns the opponent's remaining pip count
- Both Modo 200 and Modo 500 remain available with same bonus rules
- Game is blocked when BOTH players pass consecutively (boneyard must be empty)
- NOT 4 consecutive passes -- only 2 needed since there are only 2 players
- Local player at bottom, opponent at top; left and right seats hidden/removed
- Simple alternation: player 0 -> player 1 -> player 0
- `nextPlayerIndex` uses `% playerCount` instead of hardcoded `% 4`

### Claude's Discretion
- How to communicate boneyard state to client (count only vs tiles after draw)
- Animation for drawing tiles from boneyard
- Whether to show a visual boneyard pile on the board
- How to adapt Modo 200 pass bonuses for 2-player (no partner concept)
- Rematch vote count (2 instead of 4)

### Deferred Ideas (OUT OF SCOPE)
- AI/bot opponents for 2-player mode
- 3-player mode variant
- Visual boneyard pile with draw animation (can be v2 polish)

</user_constraints>

<phase_requirements>

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| TWO-01 | 2 players in room = auto 2-player mode (no manual selection) | Server `game:start` handler accepts 2 or 4; lobby UI shows "2 o 4 jugadores"; `canStart` logic updated |
| TWO-02 | Each player gets 7 tiles; 14 remaining form boneyard | `dealTiles()` branched by playerCount; `ServerGameState.boneyard` field added |
| TWO-03 | Draw from boneyard one-by-one until playable or empty; then pass | `processAutoPassCascade()` gains boneyard draw loop before auto-pass; new `game:boneyard_draw` event |
| TWO-04 | Individual scoring (no teams); winner gets opponent's pips | `calculatePlayOutPoints` already sums non-winner pips; `TeamScores` reused as player0/player1 scores; UI labels changed |
| TWO-05 | Modo 200 / Modo 500 work with same bonus rules | `applyPassBonus200` adapted for 2-player (no partner protection); mode500 bonuses unchanged |
| TWO-06 | Layout: local player bottom, opponent top; left/right hidden | `usePlayerPositions` 2-player variant; `GameTable` conditional rendering; `ScorePanel` shows player names |
| TWO-07 | Blocked when both pass consecutively (boneyard empty) | `isGameBlocked` accepts playerCount; `consecutivePasses >= playerCount` |

</phase_requirements>

## Architecture Patterns

### Pattern 1: playerCount as Branch Variable

**What:** Use `game.players.length` (or `room.players.length` pre-game) as the single branching variable. Never introduce a separate `is2Player` boolean -- derive it.

**Why:** Keeps the door open for future player count variants and avoids scattered boolean checks.

**Example:**
```typescript
// Server: GameEngine.ts
export function nextPlayerIndex(current: number, playerCount: number): number {
  return (current + 1) % playerCount
}

export function isGameBlocked(consecutivePasses: number, playerCount: number): boolean {
  return consecutivePasses >= playerCount
}
```

### Pattern 2: Reuse TeamScores for Individual Scoring

**What:** In 2-player mode, map player 0 -> `team0` and player 1 -> `team1`. The existing `TeamScores` interface stays unchanged; only UI labels change.

**Why:** Avoids a parallel scoring system. `applyScore()`, `scoresReachedTarget()`, `getLeadingTeam()` all work unchanged. The `playerTeam()` function already returns `playerIndex % 2` which maps correctly: player 0 -> team 0, player 1 -> team 1.

**Implication:** `calculateBlockedResult()` team sum logic (`pipCounts[0] + pipCounts[2]`) must branch for 2-player to use individual pips. But `calculateBlockedResult200()` already uses individual pips -- in 2-player mode, both modes can use the individual-pip approach.

### Pattern 3: Boneyard Draw Inside processAutoPassCascade

**What:** Before auto-passing a player, check if boneyard has tiles. If yes, draw one tile at a time into the player's hand and recheck valid plays. Emit a `game:boneyard_draw` event for each draw so the client can update the hand and boneyard count. Only auto-pass if boneyard is empty AND no valid plays.

**Server-side flow:**
```
processAutoPassCascade(io, game, startPlayerIndex, tilePlayerIndex):
  idx = startPlayerIndex
  for i in 0..playerCount:
    // BONEYARD DRAW PHASE (only if 2-player)
    while game.boneyard.length > 0:
      validPlays = getValidPlays(game.players[idx].tiles, ...)
      if validPlays.length > 0: break  // can play, stop drawing
      drawnTile = game.boneyard.pop()
      game.players[idx].tiles.push(drawnTile)
      emit 'game:boneyard_draw' to idx's socket (tile data)
      emit 'game:boneyard_draw' to opponent (count only, no tile)

    // NORMAL CHECK
    validPlays = getValidPlays(game.players[idx].tiles, ...)
    if validPlays.length > 0:
      game.currentPlayerIndex = idx
      return false  // player's turn

    // AUTO-PASS (no valid plays even after exhausting boneyard)
    ...existing pass logic...
```

### Pattern 4: Conditional Layout Rendering

**What:** `GameTable` checks `players.length` to decide between 4-seat grid and 2-seat layout. The 2-seat layout uses the same grid but skips left/right columns.

**Example approach:**
```typescript
const is2Player = players.length === 2
const topIndex = is2Player ? (myPlayerIndex + 1) % 2 : (myPlayerIndex + 2) % 4
```

### Anti-Patterns to Avoid
- **Duplicating entire handler functions for 2-player:** Branch within existing functions, do not create `processAutoPassCascade2P()` etc.
- **Adding `is2Player` field to ServerGameState:** Derive from `game.players.length` instead
- **Sending boneyard tile data to the opponent:** Only the drawing player sees the tile; opponent sees count change only

## Hardcoded `4` Inventory (Complete Audit)

Every location where `4` is hardcoded and needs parameterization:

### Server: GameEngine.ts
| Line | Code | Change |
|------|------|--------|
| 38-43 | `dealTiles()` slices 4 hands | Branch: 2 hands + boneyard OR 4 hands |
| 78-79 | `nextPlayerIndex` `% 4` | Accept `playerCount` param |
| 83-85 | `playerTeam` `% 2` | Works for 2-player as-is (player 0->team0, player 1->team1) |
| 215-217 | `isGameBlocked` `>= 4` | Accept `playerCount` param |
| 239-240 | `calculateBlockedResult` `pipCounts[0]+pipCounts[2]` | Branch for 2-player: individual pips |
| 312-324 | `applyPassBonus200` partner/opponent logic | In 2-player: no partner protection, every pass awards bonus to opponent |
| 352-385 | `buildClientGameState` | Add `boneyardCount` to output |

### Server: gameHandlers.ts
| Line | Code | Change |
|------|------|--------|
| 89 | `partnerOfTilePlayer = (tilePlayerIndex + 2) % 4` | No partner in 2-player |
| 91 | `for (let i = 0; i < 4; i++)` | Use `playerCount` |
| 282 | `room.players.length !== 4` | Accept 2 or 4 |
| 296 | `room.players.map((rp, i)` deals `hands[i]` | Works if dealTiles returns correct hand count |
| 486 | `for (let i = 0; i < 4; i++)` in next_hand | Use `playerCount` |
| 536 | `for (let i = 0; i < 4; i++)` in next_game | Use `playerCount` |
| 572 | `rematchVotes.length === 4` | Use `playerCount` |
| 577-605 | Rematch reset loop `for (let i = 0; i < 4; i++)` | Use `playerCount` |

### Server: RoomManager.ts
| Line | Code | Change |
|------|------|--------|
| 62 | `room.players.length >= 4` | Dynamic max (allow 2 or 4 to join, but cap at 4) |

### Client: usePlayerPositions.ts
| Line | Code | Change |
|------|------|--------|
| 16-22 | Hardcoded 4 positions | Add 2-player path: bottom + top only |
| 27-29 | `getPosition` hardcoded `+ 4) % 4` | Accept playerCount |

### Client: GameTable.tsx
| Line | Code | Change |
|------|------|--------|
| 55-57 | Index calculations `% 4` | Branch for 2-player |
| 101-165 | Left/right seats rendered | Conditionally hide for 2-player |

### Client: ScorePanel.tsx
| Line | Code | Change |
|------|------|--------|
| 15-16 | `players[0], players[2]` and `players[1], players[3]` team grouping | 2-player: individual names |
| 18-20 | `Nosotros/Ellos` labels | 2-player: player names |

### Client: ScoreHistoryPanel.tsx
| Line | Code | Change |
|------|------|--------|
| 10 | `myTeam = myPlayerIndex % 2` | Works, but labels need player names |
| 26-28 | `Nosotros/Ellos/Trancado` labels | 2-player: winner's name |

### Client: RoundEndModal.tsx
| Line | Code | Change |
|------|------|--------|
| 31 | `myTeam = (myPlayerIndex ?? 0) % 2 === 0 ? 0 : 1` | Works for 2-player |
| 32 | `weWon = roundEndData.winningTeam === myTeam` | Works |
| 136-148 | "Equipo A" / "Equipo B" labels | 2-player: player names |

### Client: GameEndModal.tsx
| Line | Code | Change |
|------|------|--------|
| 29-30 | Team logic | Works for 2-player |
| 34 | `rematchVotes.length === 4` | Use playerCount |
| 115 | `{rematchVotes.length}/4 listos` | Dynamic player count |
| 41-43 | `Nosotros/Ellos` labels | 2-player: player names |

### Client: RoomLobby.tsx
| Line | Code | Change |
|------|------|--------|
| 37 | `canStart = playerCount === 4` | `playerCount === 2 \|\| playerCount === 4` |
| 69 | `[0, 1, 2, 3].map` | Dynamic based on max seats |
| 196 | `Esperando {4 - playerCount}` | Dynamic message |
| 205 | `${playerCount}/4 jugadores` | Dynamic denominator |

## New Fields & Events

### ServerGameState additions
```typescript
interface ServerGameState {
  // ...existing fields...
  boneyard: Tile[]  // NEW: tiles remaining in draw pile (empty in 4-player)
}
```

### ClientGameState additions
```typescript
interface ClientGameState {
  // ...existing fields...
  boneyardCount: number  // NEW: how many tiles in boneyard (0 in 4-player)
  playerCount: number    // NEW: 2 or 4 — so client knows layout mode
}
```

### New socket event: `game:boneyard_draw`
```typescript
// Emitted to the DRAWING player only (includes tile data)
io.to(drawingPlayerSocketId).emit('game:boneyard_draw', {
  tile: drawnTile,           // Tile — so client can add to hand
  boneyardRemaining: count,  // number
  playerIndex: drawingPlayerIndex,
})

// Emitted to ALL other players (no tile data)
io.to(roomCode).except(drawingPlayerSocketId).emit('game:boneyard_draw', {
  tile: null,                // no tile — opponent doesn't see what was drawn
  boneyardRemaining: count,
  playerIndex: drawingPlayerIndex,
})
```

Alternatively, a simpler approach: emit to the room with `tile: null`, then emit to the drawing player specifically with the tile. The `game:state_snapshot` after the draw phase will naturally include the updated hand and boneyard count, but individual draw events create a better UX (client can show draw animation per tile).

**Recommendation (Claude's discretion):** Emit individual `game:boneyard_draw` events per tile drawn, then a final `game:state_snapshot`. This enables the client to show a "drawing..." animation and increment tile count visibly. Keep it simple for v1 -- just update the hand in state, no fancy animation.

## Modo 200 Pass Bonus Adaptation (Claude's Discretion)

In 4-player mode, pass bonuses work as follows:
- When a player passes, the **opposing team** gets points
- The **partner** of the tile player is protected (their pass doesn't count for bonus)

In 2-player mode, there is no partner. Recommendation:
- **Every pass awards bonus to the opponent.** The "partner protection" concept does not apply.
- First pass in the game: +2 to opponent
- Subsequent passes: +1 to opponent
- This is consistent with the spirit of Modo 200 (passes are penalized)

Implementation:
```typescript
// In processAutoPassCascade, when 2-player:
const is2Player = game.players.length === 2
const isPartnerPass = !is2Player && (idx === (tilePlayerIndex + 2) % 4)
```

## Boneyard Count Display (Claude's Discretion)

Recommendation: Show a small badge/counter near the board center indicating remaining boneyard tiles. Simple text like "Boneyard: 12" or a small pile icon with a number. No fancy visual pile (deferred per CONTEXT.md).

Implementation: Add to `GameBoard.tsx` or `GameTable.tsx` a conditional element:
```tsx
{boneyardCount > 0 && (
  <div className="absolute top-2 right-2 ...">
    {boneyardCount} fichas
  </div>
)}
```

## Rematch Vote Count (Claude's Discretion)

Straightforward: use `game.players.length` instead of hardcoded `4`.

Server: `rematchVotes.length === game.players.length`
Client: `{rematchVotes.length}/{playerCount} listos`

## Common Pitfalls

### Pitfall 1: findFirstPlayer with Boneyard
**What goes wrong:** In 2-player mode, the 6-6 might be in the boneyard, not in any player's hand.
**Why it happens:** `findFirstPlayer()` scans all dealt hands for the highest double. With only 14 tiles dealt (7+7) out of 28, the 6-6 may be in the boneyard.
**How to avoid:** `findFirstPlayer()` already has a fallback chain (6-6 -> 5-5 -> ... -> highest composite). It will find whatever highest tile exists in the dealt hands. No code change needed -- but the forced tile may not be 6-6.
**Warning signs:** Test a 2-player game where 6-6 is in the boneyard and verify the correct player starts.

### Pitfall 2: processAutoPassCascade Loop Bounds
**What goes wrong:** The cascade loop runs `for (let i = 0; i < 4; i++)` -- in 2-player, this would try to check 4 players but only 2 exist.
**Why it happens:** Hardcoded loop bound.
**How to avoid:** Change to `game.players.length`.

### Pitfall 3: calculateBlockedResult Team Sums
**What goes wrong:** `pipCounts[0] + pipCounts[2]` crashes when `pipCounts` only has 2 entries.
**Why it happens:** Array index out of bounds.
**How to avoid:** Branch based on player count. For 2-player, use individual pips directly (equivalent to `calculateBlockedResult200` behavior).

### Pitfall 4: Client Layout Crash with 2 Players
**What goes wrong:** `players[topIndex]` where `topIndex = (myPlayerIndex + 2) % 4` gives index 2 but `players` only has 2 entries.
**Why it happens:** Index calculation assumes 4 players.
**How to avoid:** Compute indices based on `players.length`.

### Pitfall 5: Room Max Players Too Restrictive
**What goes wrong:** If a 3rd player joins a room intended for 2-player, the game can't start (needs exactly 2 or 4).
**Why it happens:** Room doesn't know the target player count.
**How to avoid:** Accept 2 or 4 in `game:start`. If 3 players are in the room, show error "Se necesitan 2 o 4 jugadores". Room max stays at 4 (anyone can join up to 4). The `game:start` handler validates the count is exactly 2 or 4.

### Pitfall 6: Boneyard Draw During Opponent's Auto-Pass Chain
**What goes wrong:** In 2-player mode, after player A plays, player B might need to draw. If B draws and can now play, the cascade stops. But if B draws everything and still can't play, B passes, then it's A's turn again. The cascade must NOT try to draw for A (the tile player) -- A already played.
**Why it happens:** The cascade checks if the next player can play; in 2-player that's only 1 player to check.
**How to avoid:** The existing cascade already handles this correctly -- it loops `playerCount` times max and stops when someone can play. With `playerCount=2`, it checks at most 2 players (the opponent, then back to the tile player who just played and should have tiles unless they won).

### Pitfall 7: Modo 200 Block Bonus + 2-Player
**What goes wrong:** In `handleBlockedGame`, Modo 200 awards +2 to the team that caused the block (last tile player). In 2-player, this means the player who played last gets +2 -- but that player already played a tile, meaning their opponent couldn't play. The last tile player benefits from blocking.
**How to avoid:** This logic is correct as-is for 2-player. The team/player mapping via `playerTeam()` already maps correctly.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Separate 2-player game state type | New `TwoPlayerGameState` | Extend `ServerGameState` with `boneyard` field | One code path, less duplication |
| Separate scoring system | `IndividualScores` interface | Reuse `TeamScores` with team0=player0, team1=player1 | All score functions work unchanged |
| New pass/draw socket event flow | Client-initiated `game:draw` event | Server auto-draws within `processAutoPassCascade` | Consistent with no-client-pass pattern |

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | None configured (TypeScript strict mode is primary check) |
| Config file | None |
| Quick run command | `cd client && npx tsc --noEmit && cd ../server && npx tsc --noEmit` |
| Full suite command | Same as quick run (no test suite exists) |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| TWO-01 | 2 players triggers auto 2-player mode | manual | Start game with 2 players in lobby | N/A |
| TWO-02 | 7 tiles dealt, 14 in boneyard | manual | Verify tile count in game state | N/A |
| TWO-03 | Boneyard draw until playable or empty | manual | Play until a pass would occur, verify draws | N/A |
| TWO-04 | Individual scoring, no teams | manual | Win a hand, check opponent's pips added | N/A |
| TWO-05 | Modo 200/500 bonuses work | manual | Test pass bonuses and hand bonuses | N/A |
| TWO-06 | 2-seat layout (bottom + top) | manual | Visual check, no left/right seats | N/A |
| TWO-07 | Blocked when both pass (boneyard empty) | manual | Empty boneyard, both players stuck | N/A |

### Sampling Rate
- **Per task commit:** `cd /Users/yamirx/Claude_Code/dominos_pr/client && npx tsc --noEmit && cd ../server && npx tsc --noEmit`
- **Per wave merge:** Same + manual play-test
- **Phase gate:** Type-check clean + full 2-player game play-through

### Wave 0 Gaps
- No test infrastructure exists (project uses TypeScript strict mode as correctness check)
- Manual testing required via `npm run dev` with 2 browser windows

## Open Questions

1. **Should the boneyard count be a permanent UI element or only shown during 2-player games?**
   - What we know: Only 2-player games have a boneyard
   - Recommendation: Conditionally render when `boneyardCount > 0` or `playerCount === 2`

2. **Should drawn tiles appear in hand immediately or with a brief delay?**
   - What we know: Multiple tiles may be drawn in rapid succession
   - Recommendation: For v1, update hand immediately via state snapshot. Animation is deferred.

3. **Room join flow -- can a 3rd player join a 2-player game in progress?**
   - What we know: Currently reconnection matches by name; new players can't join mid-game
   - Recommendation: No change needed. Room stays at `status: 'in_game'`, new joins are rejected for in-game rooms.

## Sources

### Primary (HIGH confidence)
- Direct codebase audit of all files listed in the hardcoded-4 inventory
- `server/src/game/GameEngine.ts` -- all pure functions reviewed
- `server/src/socket/gameHandlers.ts` -- all handlers reviewed
- `server/src/game/GameState.ts` -- all interfaces reviewed
- `server/src/game/RoomManager.ts` -- room lifecycle reviewed
- `client/src/hooks/usePlayerPositions.ts` -- layout logic reviewed
- `client/src/components/game/GameTable.tsx` -- rendering logic reviewed
- `client/src/components/game/ScorePanel.tsx` -- team label logic reviewed
- `client/src/components/game/RoundEndModal.tsx` -- team display reviewed
- `client/src/components/game/GameEndModal.tsx` -- rematch vote count reviewed
- `client/src/components/lobby/RoomLobby.tsx` -- lobby start logic reviewed
- `client/src/types/game.ts` -- client type definitions reviewed

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - no new libraries needed, all changes are within existing codebase
- Architecture: HIGH - full audit of every hardcoded `4` and team assumption completed
- Pitfalls: HIGH - identified from direct code review, not speculation

**Research date:** 2026-03-12
**Valid until:** Indefinite (codebase-specific research, not library-dependent)

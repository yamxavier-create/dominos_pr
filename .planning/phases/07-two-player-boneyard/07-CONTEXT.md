# Phase 7: Two-Player Mode with Boneyard - Context

**Gathered:** 2026-03-12
**Status:** Ready for planning
**Source:** Direct conversation with user

<domain>
## Phase Boundary

This phase adds support for 2-player domino games with a boneyard mechanic. When only 2 players are in the room, the game automatically switches to 2-player rules: 7 tiles dealt per player, 14 remaining tiles form the boneyard, and players draw from the boneyard when they cannot play.

</domain>

<decisions>
## Implementation Decisions

### Game Mode Detection
- Automatic based on player count: 2 players in room = 2-player mode, 4 players = classic mode
- No manual selection needed — the lobby/start logic detects player count

### Tile Distribution
- Each player receives 7 tiles (same as 4-player)
- Remaining 14 tiles form the boneyard
- Boneyard is server-side only — client knows boneyard count but not tile contents

### Boneyard Draw Mechanic
- When a player cannot play, they draw tiles one at a time from the boneyard
- Drawing continues until a playable tile is found OR the boneyard is empty
- If boneyard empties and still no valid play, the player passes
- No client `game:pass` event — server auto-handles drawing + passing (consistent with existing pattern)

### Scoring
- Individual scoring — no teams in 2-player mode
- Winner of the hand earns the opponent's remaining pip count
- Both Modo 200 and Modo 500 remain available with same bonus rules
- TeamScores structure needs adaptation or replacement for individual scores

### Blocked Game
- Game is blocked when BOTH players pass consecutively (boneyard must be empty)
- NOT 4 consecutive passes — only 2 needed since there are only 2 players
- Winner of blocked game = player with fewer remaining pips

### Layout
- Local player at bottom, opponent at top
- Left and right seat positions are hidden/removed
- Board remains centered between the two players

### Turn Order
- Simple alternation: player 0 → player 1 → player 0...
- `nextPlayerIndex` uses `% playerCount` instead of hardcoded `% 4`

### Claude's Discretion
- How to communicate boneyard state to client (count only vs tiles after draw)
- Animation for drawing tiles from boneyard
- Whether to show a visual boneyard pile on the board
- How to adapt Modo 200 pass bonuses for 2-player (no partner concept)
- Rematch vote count (2 instead of 4)

</decisions>

<specifics>
## Specific Ideas

- The `dealTiles()` function already returns a `boneyard` field (currently always `[]`) — extend it for 2-player
- `ServerGameState` needs a `boneyard: Tile[]` field
- `isGameBlocked()` should accept player count: blocked when `consecutivePasses >= playerCount`
- `processAutoPassCascade()` needs boneyard draw logic before auto-passing
- `usePlayerPositions` needs a 2-player variant (bottom + top only)
- `Room.players` max changes from 4 to dynamic (2 or 4)

</specifics>

<deferred>
## Deferred Ideas

- AI/bot opponents for 2-player mode
- 3-player mode variant
- Visual boneyard pile with draw animation (can be v2 polish)

</deferred>

---

*Phase: 07-two-player-boneyard*
*Context gathered: 2026-03-12 via direct conversation*

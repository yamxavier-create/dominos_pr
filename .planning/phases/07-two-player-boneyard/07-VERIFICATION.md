---
phase: 07-two-player-boneyard
verified: 2026-03-12T00:00:00Z
status: passed
score: 7/7 requirements verified
re_verification: false
human_verification:
  - test: "Start a 2-player game and verify full end-to-end flow"
    expected: "Lobby shows 2 players connected with Iniciar Partida enabled; game starts with 7 tiles each and '14 fichas' boneyard counter visible; only top and bottom seats shown; boneyard draws happen automatically when a player has no valid plays; ScorePanel shows player names not Nosotros/Ellos; RoundEndModal shows player name not Equipo A/B; GameEndModal shows player name and rematch counter shows X/2"
    why_human: "Visual layout, boneyard draw animation timing, real-time socket behavior, and modal label accuracy require a live browser session to confirm"
  - test: "4-player regression: open 4 tabs and play a game"
    expected: "All 4 seats visible, team labels Nosotros/Ellos in ScorePanel, Equipo A/B in modals, no boneyard counter shown, rematch counter shows X/4"
    why_human: "Visual regression requires live browser session"
---

# Phase 07: Two-Player Boneyard Verification Report

**Phase Goal:** Support 2-player games where leftover tiles form a boneyard — players draw from the boneyard when they can't play, scoring is individual (no teams), and the layout adapts to show only two seats (bottom + top)
**Verified:** 2026-03-12
**Status:** passed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | 2-player game mode is detected automatically based on player count | ✓ VERIFIED | `gameHandlers.ts:309` — `room.players.length !== 2 && room.players.length !== 4` guard; no manual mode selection required |
| 2 | Each player receives 7 tiles; 14 tiles form the boneyard | ✓ VERIFIED | `GameEngine.ts:38-43` — `dealTiles(tiles, 2)` returns 2 hands + `tiles.slice(14)` as boneyard; `gameHandlers.ts:315` passes `playerCount` to `dealTiles` |
| 3 | Players draw from boneyard one by one when they can't play | ✓ VERIFIED | `gameHandlers.ts:96-123` — `processAutoPassCascade` boneyard draw loop draws one tile per iteration via `game.boneyard.pop()`, emits `game:boneyard_draw` per tile, stops when playable tile found or boneyard empty |
| 4 | Scoring is individual (no teams); winner of hand earns opponent's pips | ✓ VERIFIED | `GameEngine.ts:246-253` — `calculateBlockedResult` branches on `players.length === 2` to compare individual pips; `playerTeam(0)=0`, `playerTeam(1)=1` maps players to team slots |
| 5 | Modo 200 and Modo 500 scoring rules apply in 2-player mode | ✓ VERIFIED | `applyPassBonus200` unchanged (works with `playerTeam`); `calculateMode500Bonuses` unchanged; all bonus paths hit both player counts |
| 6 | Layout shows only bottom (me) and top (opponent); left/right seats hidden | ✓ VERIFIED | `GameTable.tsx:66-71` — `leftIndex` and `rightIndex` set to `-1` when `is2Player`; left/right `<div>` blocks guarded with `{!is2Player && leftPlayer && (...)}` |
| 7 | Game blocks after 2 consecutive passes when boneyard is empty | ✓ VERIFIED | `GameEngine.ts:221-223` — `isGameBlocked(consecutivePasses, playerCount)` returns `true` at `>= playerCount` (2 for 2-player); `gameHandlers.ts:174` passes `playerCount` |

**Score:** 7/7 truths verified

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `server/src/game/GameState.ts` | `boneyard: Tile[]` on `ServerGameState`; `boneyardCount`, `playerCount` on `ClientGameState` | ✓ VERIFIED | Line 66: `boneyard: Tile[]`; Lines 127-128: `boneyardCount: number`, `playerCount: number` |
| `server/src/game/GameEngine.ts` | Parameterized `dealTiles`, `nextPlayerIndex`, `isGameBlocked`, `calculateBlockedResult`, `buildClientGameState` | ✓ VERIFIED | All five functions updated with `playerCount` param or `players.length` branching; `buildClientGameState` includes both new fields |
| `server/src/socket/gameHandlers.ts` | 2-player game start, boneyard draw in cascade, dynamic rematch vote count | ✓ VERIFIED | `game:start` at line 309 accepts 2 or 4; `processAutoPassCascade` has boneyard draw loop at lines 96-123; `game:rematch_vote` uses `game.players.length` at line 603 |
| `client/src/types/game.ts` | `boneyardCount`, `playerCount` on `ClientGameState`; `BoneyardDrawPayload` type | ✓ VERIFIED | Lines 58-59 add both fields; Lines 118-122 define `BoneyardDrawPayload` |
| `client/src/store/gameStore.ts` | `handleBoneyardDraw` action | ✓ VERIFIED | Lines 46-66 implement surgical update: adds tile to hand when `payload.tile !== null`, increments `tileCount`, updates `boneyardCount` |
| `client/src/hooks/useSocket.ts` | `game:boneyard_draw` event handler registered and cleaned up | ✓ VERIFIED | Lines 107-112 register handler; line 184 cleans up on unmount |
| `client/src/hooks/usePlayerPositions.ts` | 2-player layout (bottom + top only) when `playerCount=2` | ✓ VERIFIED | Both `usePlayerPositions` and `getPosition` branch on `playerCount === 2`; maps `myIndex -> bottom`, `(myIndex+1)%2 -> top` |
| `client/src/components/game/GameTable.tsx` | Conditional 2-seat layout; boneyard count display | ✓ VERIFIED | `is2Player` flag controls index calculations and conditional seat rendering; boneyard counter rendered at lines 159-163 |
| `client/src/components/lobby/RoomLobby.tsx` | `canStart` accepts 2 or 4; mode indicator for 2-player lobby | ✓ VERIFIED | Line 37: `canStart = playerCount === 2 || playerCount === 4`; line 179-181: shows "Modo 2 jugadores (individual)" text when `is2PlayerLobby` |
| `client/src/components/game/ScorePanel.tsx` | Individual player name labels for 2-player | ✓ VERIFIED | Lines 15-26: `is2Player = players.length === 2`; uses `players[0].name` / `players[1].name` instead of Nosotros/Ellos |
| `client/src/components/game/ScoreHistoryPanel.tsx` | Player names instead of Nosotros/Ellos in 2-player | ✓ VERIFIED | Lines 26-33: `is2Player` path uses `playerNames?.[entry.data.winningTeam]`; falls back to 'Ganador' |
| `client/src/components/game/RoundEndModal.tsx` | Singular pronouns, player names in 2-player | ✓ VERIFIED | Lines 59-68: `is2Player` switches header to '¡Ganaste esta mano!' / 'Perdiste esta mano'; lines 146-155: scores summary uses player names |
| `client/src/components/game/GameEndModal.tsx` | Dynamic rematch vote count; individual labels | ✓ VERIFIED | Line 38: `allVoted = rematchVotes.length === playerCount`; line 125: `{rematchVotes.length}/{playerCount} listos`; team labels use player names when `is2Player` |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `gameHandlers.ts` | `GameEngine.ts` | `dealTiles(tiles, playerCount)` | ✓ WIRED | Line 315 passes `playerCount`; also lines 487, 547, 609 in next_hand, next_game, rematch handlers |
| `gameHandlers.ts` | `GameEngine.ts` | `nextPlayerIndex(idx, playerCount)` | ✓ WIRED | Lines 179, 470 pass `playerCount` |
| `gameHandlers.ts` | `GameEngine.ts` | `isGameBlocked(consecutivePasses, playerCount)` | ✓ WIRED | Line 174 passes `playerCount` |
| `processAutoPassCascade` | `game:boneyard_draw` event | `io.emit` per drawn tile | ✓ WIRED | Lines 111-122: emits to drawing player with tile data; emits to room excluding drawing player with `tile: null` |
| `useSocket.ts` | `gameStore.handleBoneyardDraw` | `game:boneyard_draw` socket event | ✓ WIRED | Lines 107-112: handler calls `useGameStore.getState().handleBoneyardDraw(payload, myIdx)` |
| `GameTable.tsx` | `usePlayerPositions.ts` | `getPosition(..., playerCount)` | ✓ WIRED | Lines 120, 143, 171: all `getPosition` calls pass `playerCount` |
| `GameTable.tsx` | `gameStore` | reads `boneyardCount` from `gameState` | ✓ WIRED | Line 58: `const boneyardCount = gameState.boneyardCount ?? 0`; used in render at line 159 |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| TWO-01 | 07-02 | Si hay 2 jugadores, el juego inicia en modo 2 jugadores automáticamente | ✓ SATISFIED | `gameHandlers.ts:309` — validation accepts 2 or 4; `playerCount = room.players.length` drives all downstream logic |
| TWO-02 | 07-01 | Cada jugador recibe 7 fichas; las 14 restantes forman el boneyard | ✓ SATISFIED | `GameEngine.ts:38-43` — `dealTiles` with `playerCount=2` returns 2×7 hands + 14-tile boneyard |
| TWO-03 | 07-02 | Cuando un jugador no puede tirar, roba fichas del boneyard una por una | ✓ SATISFIED | `gameHandlers.ts:96-123` — boneyard draw loop in `processAutoPassCascade` |
| TWO-04 | 07-01 | Scoring es individual — el ganador gana los pips del oponente | ✓ SATISFIED | `GameEngine.ts:246-253` — `calculateBlockedResult` individual pip comparison for 2-player |
| TWO-05 | 07-01 | Modos 200/500 funcionan en 2-player con mismas reglas de bonificación | ✓ SATISFIED | `applyPassBonus200`, `calculateMode500Bonuses`, all scoring paths work for both player counts |
| TWO-06 | 07-03, 07-04 | Layout visual muestra jugador local abajo y oponente arriba; izquierda/derecha ocultas | ✓ SATISFIED | `GameTable.tsx:59-71` + `usePlayerPositions.ts:14-17` + all UI components branch on `playerCount`/`players.length` |
| TWO-07 | 07-01 | Juego se bloquea cuando ambos jugadores pasan consecutivamente | ✓ SATISFIED | `GameEngine.ts:221-223` — `isGameBlocked(n, 2)` triggers at `consecutivePasses >= 2` |

All 7 requirements verified. No orphaned requirements found.

---

### Anti-Patterns Found

No blockers or warnings found. All `return null` instances in components are legitimate guard clauses for missing data, not stub implementations. No TODO/FIXME/PLACEHOLDER comments exist in any phase-07 files. Both TypeScript workspaces compile with zero errors.

---

### Human Verification Required

#### 1. 2-Player End-to-End Flow

**Test:** Run `npm run dev`; open two tabs; create a room; join with second tab; start game from tab 1
**Expected:** Each player sees 7 tiles; boneyard counter shows "14 fichas" near board center; only top and bottom seats visible (no left/right); when a player has no valid plays, their hand grows automatically and boneyard counter decrements; ScorePanel shows player names; RoundEndModal shows "¡Ganaste esta mano!" or "Perdiste esta mano" (singular); GameEndModal shows player names and rematch counter as "X/2 listos"
**Why human:** Visual layout, real-time boneyard draw UX, and modal label correctness require a live browser session

#### 2. 4-Player Regression

**Test:** Open 4 tabs, create a 4-player game
**Expected:** All 4 seats visible; ScorePanel shows "Nosotros/Ellos" with partner names; no boneyard counter; RoundEndModal shows "¡Ganamos esta mano!" / "Perdimos esta mano" (plural); GameEndModal rematch counter shows "X/4 listos"; blocked game detection triggers after 4 consecutive passes
**Why human:** Visual regression requires live browser session with 4 simultaneous connections

---

### Gaps Summary

No gaps. All observable truths verified. All 13 artifacts exist, are substantive, and are wired to their dependents. All 7 key links are confirmed. Both TypeScript workspaces compile clean. Phase 07 goal is achieved.

---

_Verified: 2026-03-12_
_Verifier: Claude (gsd-verifier)_

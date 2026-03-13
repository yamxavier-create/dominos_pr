---
phase: 08-boneyard-visual-draw-animation
verified: 2026-03-12T02:00:00Z
status: human_needed
score: 6/6 must-haves verified
human_verification:
  - test: "Boneyard pile renders correctly in a live 2-player game"
    expected: "Stacked face-down tiles appear at bottom-right of board area with a count badge showing 14 at game start"
    why_human: "Visual rendering, positioning, and count badge appearance cannot be verified programmatically"
  - test: "Pile shrinks as tiles are drawn"
    expected: "Visible layer count drops from 4 to 3 to 2 to 1 as boneyardCount decreases; pile fades out when count reaches 0"
    why_human: "Layer reduction and CSS opacity transition require visual inspection during live play"
  - test: "Draw animation plays when a player draws from the boneyard"
    expected: "Face-down tile visibly flies from bottom-right pile toward the drawing player's seat area over 350ms, then the tile appears in the hand"
    why_human: "CSS keyframe animation, timing, and directional targeting require live observation"
  - test: "Consecutive draws animate sequentially with pause"
    expected: "Each draw triggers its own flight animation; approximately 500ms pause between consecutive draws; no draws are skipped or batched"
    why_human: "Queue timing behavior requires observation under real gameplay conditions"
  - test: "Opponent view of draw animation"
    expected: "Second browser window shows the face-down tile flying toward the drawing player's seat and disappearing (tile does not appear face-up for the opponent)"
    why_human: "Requires two browser windows open simultaneously to observe the opponent perspective"
---

# Phase 8: Boneyard Visual and Draw Animation Verification Report

**Phase Goal:** Visual boneyard pile and draw animation for 2-player mode
**Verified:** 2026-03-12T02:00:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Boneyard tiles appear as a stacked pile of face-down dominoes on the game table | VERIFIED | `BoneyardPile.tsx` renders 1–4 stacked `DominoTile faceDown` SVGs with absolute positioning and 2px offsets; integrated into `GameTable.tsx` line 161 |
| 2 | A count badge shows how many tiles remain in the boneyard | VERIFIED | `BoneyardPile.tsx` lines 72–84: `<div className="absolute bg-black/60 text-white/80 ...">` renders `{count}` as a pill badge |
| 3 | The pile visually shrinks as tiles are drawn (fewer stacked layers) | VERIFIED | `layerCount = Math.min(count, 4)` drives `Array.from({ length: layerCount })` — layer count dynamically matches remaining tiles |
| 4 | When the boneyard empties, the pile fades away smoothly | VERIFIED | `useEffect` in `BoneyardPile.tsx` starts a 300ms `setTimeout` → sets `visible=false`; outer wrapper uses `transition: 'opacity 300ms ease-out'` |
| 5 | A face-down tile flies from the pile toward the drawing player's hand area, then appears in hand | VERIFIED | `BoneyardDrawAnimation.tsx` renders `DominoTile faceDown` with `boneyard-fly-{direction}` CSS class (0.35s keyframes); calls `handleBoneyardDraw` after 350ms to reveal tile |
| 6 | Multiple consecutive draws animate one at a time with ~500ms pause between each | VERIFIED | `isProcessingRef` gates re-entrant processing; 500ms `pauseTimer` fires after each animation before releasing the ref |

**Score:** 6/6 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `client/src/components/domino/DominoTile.tsx` | `faceDown` prop renders solid back | VERIFIED | Lines 10, 20–31 (horizontal), 62–73 (vertical): early-return SVG with `#2D4A3E` fill, no pips, no divider |
| `client/src/components/game/BoneyardPile.tsx` | Stacked face-down pile with count badge | VERIFIED | 87 lines; exports `BoneyardPile`; substantive implementation with fade-out logic |
| `client/src/components/game/GameTable.tsx` | Renders `BoneyardPile` replacing text badge | VERIFIED | Lines 14–15: imports both components; line 161: `{is2Player && <BoneyardPile count={boneyardCount} .../>}` |
| `client/src/store/gameStore.ts` | Animation queue for sequential draws | VERIFIED | Lines 15, 27–29, 40, 51–53: `boneyardDrawQueue`, `queueBoneyardDraw`, `shiftBoneyardDraw`, `clearBoneyardDrawQueue` all present and wired |
| `client/src/components/game/BoneyardDrawAnimation.tsx` | Animated flying tile overlay | VERIFIED | 68 lines; exports `BoneyardDrawAnimation`; reads queue, applies `boneyard-fly-{direction}` class, calls `handleBoneyardDraw` after 350ms |
| `client/src/index.css` | CSS keyframes for boneyard draw flight | VERIFIED | Lines 188–213: `@keyframes boneyard-fly-bottom/top/left/right` and utility classes all defined |
| `client/src/hooks/useSocket.ts` | Queues draws instead of immediate apply | VERIFIED | Lines 107–108: `socket.on('game:boneyard_draw', ...)` calls only `queueBoneyardDraw(payload)` — no direct `handleBoneyardDraw` call remains |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `BoneyardPile.tsx` | `DominoTile.tsx` | imports and uses `faceDown={true}` | WIRED | Line 62: `<DominoTile pip1={0} pip2={0} orientation="vertical" faceDown style=.../>` |
| `GameTable.tsx` | `BoneyardPile.tsx` | renders with `boneyardCount` prop | WIRED | Line 161: `<BoneyardPile count={boneyardCount} className="absolute bottom-2 right-2 z-10" />` |
| `useSocket.ts` | `gameStore.ts` | pushes to queue via `queueBoneyardDraw` | WIRED | Line 108: `useGameStore.getState().queueBoneyardDraw(payload)` |
| `BoneyardDrawAnimation.tsx` | `gameStore.ts` | reads queue, calls `handleBoneyardDraw` on completion | WIRED | Lines 13–15 subscribe to queue/actions; line 36 calls `handleBoneyardDraw(currentDraw, myIdx)` |
| `GameTable.tsx` | `BoneyardDrawAnimation.tsx` | renders animation overlay in board center | WIRED | Lines 15, 162–167: imported and rendered conditionally inside board center div |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| BONE-01 | 08-01-PLAN.md | Boneyard tiles shown as face-down pile with visible count | SATISFIED | `BoneyardPile.tsx` stacks `DominoTile faceDown` with count badge; wired into `GameTable` for 2-player mode |
| BONE-02 | 08-02-PLAN.md | Face-down tile flies from pile to drawing player's hand on draw | SATISFIED | `BoneyardDrawAnimation.tsx` renders flying `DominoTile faceDown` with directional CSS class; `handleBoneyardDraw` called after 350ms to update hand |
| BONE-03 | 08-02-PLAN.md | Consecutive draws animate one at a time with ~500ms pause | SATISFIED | `isProcessingRef` gate + 500ms `pauseTimer` per draw enforces sequential processing |
| BONE-04 | 08-01-PLAN.md | Pile shrinks and fades away when empty | SATISFIED | `layerCount = Math.min(count, 4)` shrinks layers; `opacity: 0 + transition: 300ms` fades pile on empty |

All four BONE requirements are accounted for across plans 08-01 and 08-02. No orphaned requirements.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| — | — | — | — | No anti-patterns detected in any phase 8 files |

No TODOs, FIXMEs, stubs, empty implementations, or placeholder comments found in any of the five modified/created files.

### TypeScript Compilation

`cd client && npx tsc --noEmit` exits 0 with no errors across all phase 8 changes.

### Commits Verified

All four commits documented in summaries exist in git history:

- `0bc4fcd` feat(08-01): add faceDown prop to DominoTile and create BoneyardPile component
- `6c5f982` feat(08-01): integrate BoneyardPile into GameTable replacing text badge
- `7178bf4` feat(08-02): add boneyard draw animation queue to gameStore and wire useSocket
- `38febb6` feat(08-02): create boneyard draw flight animation and wire into GameTable

### Human Verification Required

All automated checks passed. The following require human observation in a live 2-player game:

#### 1. Boneyard pile visual appearance

**Test:** Start a 2-player game and observe the board area immediately after game start.
**Expected:** Bottom-right of the board shows 4 stacked face-down domino tiles (dark green, offset 2px each) with a count badge showing "14".
**Why human:** CSS stacking, visual offset depth illusion, and badge positioning cannot be verified programmatically.

#### 2. Pile layer reduction

**Test:** Play through the game and watch the boneyard pile as tiles are drawn.
**Expected:** When boneyardCount drops below 4, the visible stack layers decrease. At count 0, the pile fades out over 300ms and disappears.
**Why human:** Dynamic layer count and CSS opacity transition require visual inspection.

#### 3. Draw animation flight

**Test:** Force a draw situation (play tiles until a player cannot move) and observe the draw event.
**Expected:** A dark green face-down tile appears at bottom-right of the board and visibly flies toward the drawing player's seat area over ~350ms. After landing, the tile appears in the player's hand (face-up for the drawing player, absent for the opponent).
**Why human:** CSS keyframe animation playback and directional accuracy require live observation.

#### 4. Sequential draw pacing

**Test:** Force multiple consecutive draws and observe timing.
**Expected:** Each draw triggers a separate flight animation. There is a visible ~500ms pause between consecutive draws before the next tile begins flying. No draws are lost or batched.
**Why human:** Animation queue timing and pacing require real-time observation to verify the tension-building feel.

#### 5. Opponent perspective of draw animation

**Test:** Open two browser windows, start a 2-player game, and observe a draw event from the non-drawing player's window.
**Expected:** The non-drawing player sees the face-down tile fly toward the drawing player's seat and disappear. The tile does NOT appear face-up for the opponent. The opponent's tile count increases by 1 after the animation.
**Why human:** Requires simultaneous two-window observation to verify perspective-correct rendering.

### Gaps Summary

No gaps found. All implementation artifacts exist, are substantive, and are fully wired. The phase goal is structurally achieved. Human verification is required only to confirm visual quality, animation timing, and correct behavior in live gameplay — all of which passed automated structural checks.

---

_Verified: 2026-03-12T02:00:00Z_
_Verifier: Claude (gsd-verifier)_

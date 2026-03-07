# Phase 2: Score History - Research

**Researched:** 2026-03-06
**Domain:** React/Zustand UI pattern — collapsible panel, state accumulation, socket event integration
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Panel slides DOWN from the score bar — top-anchored, board remains visible behind/below
- Fixed visible height (~3 rows); scrollable if more hands than fit
- Newest hand at the top (most recent first)
- Smooth CSS transition (slide/height animation) on open and close — consistent with existing tile animations
- Each row format: `Mano 3  Nosotros  +50   75 | 30`
- Special outcome badges per row: `¡Capicú!` (gold), `¡Chuchazo!` (accent/orange), `¡Trancado!` (amber)
- Team labels are relative (Nosotros/Ellos) — same convention as ScorePanel and RoundEndModal
- Only completed hands appear — no "En curso" placeholder
- Data source: `RoundEndPayload` already has everything — zero server changes needed
- scoreHistory array belongs in `gameStore`; open/close toggle belongs in `uiStore`
- Resets on new game start (`game:started` event), NOT on rematch

### Claude's Discretion
- Trigger affordance: how score bar signals it's tappable (chevron icon, subtle border, cursor change)
- Dismissal mechanic: tap score bar again or tap outside/overlay — either is fine
- Auto-close behavior when round-end modal appears
- Empty state (before hand 1 completes) — hide affordance, show "No hands yet", or grey out
- Exact typography, spacing, row padding, color treatment of panel rows
- Whether to add a thin separator line between panel and board

### Deferred Ideas (OUT OF SCOPE)
- None — discussion stayed within phase scope.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| SCORE-01 | User can see accumulated per-team score broken down hand by hand during a game | `RoundEndPayload` contains all fields (`winningTeam`, `totalPointsScored`, `scores`, `isCapicu`, `isChuchazo`, `reason`). Array stored in `gameStore.scoreHistory`. Rendered by `ScoreHistoryPanel.tsx`. |
| SCORE-02 | History panel opens and closes by tapping the score bar during a game | `ScorePanel.tsx` receives an `onClick` prop; click toggles `uiStore.showScoreHistory`. `GameTable.tsx` renders `<ScoreHistoryPanel />` directly below `<ScorePanel />` with CSS height transition. |
| SCORE-03 | History resets at the start of each new game (not rematch) | `useSocket.ts` `game:started` handler calls `clearScoreHistory()`. `resetGame()` in `gameStore` is extended to also clear the array. |
</phase_requirements>

---

## Summary

Phase 2 is a pure front-end feature — no server code changes are required. All data needed for the score log is already transmitted in `RoundEndPayload` on each `game:round_ended` event. The work is confined to three layers: a new `scoreHistory` array in `gameStore`, a new `showScoreHistory` boolean in `uiStore`, and a new `ScoreHistoryPanel.tsx` component inserted between the score bar and the board in `GameTable.tsx`.

The panel follows the "partial overlay" pattern: unlike `RoundEndModal` and `GameEndModal` which use `fixed inset-0 z-40/50`, this panel is not full-screen. It is positioned in normal document flow immediately below `ScorePanel`, dropping down over the top portion of the game table. The board remains visible and interactive behind it. CSS `max-height` transition (0 → a fixed value) is the correct animation primitive here — it works with the existing Tailwind + custom CSS setup without adding any animation library.

The `game:started` socket event is the correct reset trigger. This event fires for genuinely new games (host starts the game fresh, or rematch — but CONTEXT.md confirms that for this phase, reset only on new game, not rematch; the distinction between "new game" vs "rematch" will be clarified in Phase 3 when the rematch event is introduced; for now, `game:started` is the sole trigger and resetting there is correct behavior).

**Primary recommendation:** Build `ScoreHistoryPanel.tsx` as a self-contained display component that reads from Zustand; wire store and socket changes as small, isolated additions to existing files.

---

## Standard Stack

### Core (already in project — no new installs)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React | ^18.2.0 | UI rendering | Project standard |
| Zustand | ^4.4.7 | Client state | Project standard — gameStore + uiStore pattern |
| Tailwind CSS | ^3.4.0 | Utility styling | Project standard — design tokens already configured |
| TypeScript | ^5.3.2 | Type safety | Project standard — strict mode enabled |

### No New Dependencies
This phase requires zero new npm packages. All animation is done with CSS transitions (already used throughout the project). All data types exist in `client/src/types/game.ts`.

**Installation:**
```bash
# Nothing to install — all dependencies already present
```

---

## Architecture Patterns

### Recommended File Changes

```
client/src/
├── store/
│   ├── gameStore.ts          # ADD: scoreHistory[], addToScoreHistory(), extend resetGame()
│   └── uiStore.ts            # ADD: showScoreHistory, setShowScoreHistory()
├── hooks/
│   └── useSocket.ts          # ADD: addToScoreHistory() in game:round_ended handler
│                             # ADD: clearScoreHistory() in game:started handler
├── components/game/
│   ├── ScorePanel.tsx        # ADD: onClick prop + chevron indicator
│   ├── GameTable.tsx         # ADD: showScoreHistory read, onClick handler, <ScoreHistoryPanel />
│   └── ScoreHistoryPanel.tsx # NEW: collapsible panel component
```

### Pattern 1: Zustand Store Extension (gameStore)

**What:** Add `scoreHistory` array and its mutators following the exact existing pattern.
**When to use:** Any time game-data (not UI-visibility) needs accumulating across rounds.

```typescript
// Source: existing gameStore.ts pattern
interface GameStore {
  // ... existing fields ...
  scoreHistory: RoundEndPayload[]

  addToScoreHistory: (data: RoundEndPayload) => void
  clearScoreHistory: () => void
  // resetGame already exists — extend its set() call to include scoreHistory: []
}

// Implementation
addToScoreHistory: data =>
  set(state => ({ scoreHistory: [data, ...state.scoreHistory] })),
  // Prepend so newest is first — matches locked decision

clearScoreHistory: () => set({ scoreHistory: [] }),

resetGame: () => set({
  gameState: null,
  roundEndData: null,
  gameEndData: null,
  lastTileSequence: null,
  scoreHistory: [],  // extend existing resetGame
}),
```

### Pattern 2: Zustand Store Extension (uiStore)

**What:** Add `showScoreHistory` boolean following the exact `showRoundEnd`/`showGameEnd` pattern.

```typescript
// Source: existing uiStore.ts pattern
interface UIStore {
  // ... existing fields ...
  showScoreHistory: boolean
  setShowScoreHistory: (v: boolean) => void
}

// Implementation — matches setShowRoundEnd / setShowGameEnd exactly
showScoreHistory: false,
setShowScoreHistory: showScoreHistory => set({ showScoreHistory }),
```

### Pattern 3: Socket Event Hook Extension (useSocket)

**What:** Two additions to the existing `useEffect` in `useSocket.ts`.

```typescript
// Source: existing useSocket.ts pattern
// In game:round_ended handler — add alongside existing setRoundEnd + setShowRoundEnd:
socket.on('game:round_ended', (data: RoundEndPayload) => {
  setRoundEnd(data)
  setShowRoundEnd(true)
  addToScoreHistory(data)        // NEW
})

// In game:started handler — add alongside existing setGameState + navigate:
socket.on('game:started', ({ gameState }: { gameState: ClientGameState }) => {
  setGameState(gameState)
  clearScoreHistory()            // NEW
  navigate('/game')
})
```

Note: `addToScoreHistory` and `clearScoreHistory` must be destructured from `useGameStore()` at the top of `useSocket`, alongside existing destructured actions.

### Pattern 4: ScorePanel onClick Prop

**What:** `ScorePanel` is currently a pure display component with no interactivity. Add `onClick` and an `isOpen` indicator (chevron).

```typescript
// Modified ScorePanel props
interface ScorePanelProps {
  scores: TeamScores
  players: ClientPlayer[]
  myPlayerIndex: number
  gameMode: GameMode
  targetScore: number
  handNumber: number
  onClick?: () => void      // NEW — optional to keep backward compat
  isOpen?: boolean          // NEW — controls chevron rotation
}
```

The affordance (chevron) can be placed at the trailing edge of the score bar. Use `cursor-pointer` on the wrapper div when `onClick` is defined.

### Pattern 5: CSS Slide Animation

**What:** Use `max-height` transition (not `height: auto` which can't be transitioned) for the panel open/close.

```css
/* Add to index.css alongside existing animation definitions */
@keyframes panel-slide-down {
  from { opacity: 0; transform: translateY(-8px); }
  to   { opacity: 1; transform: translateY(0); }
}
```

```tsx
// In ScoreHistoryPanel.tsx — Tailwind max-height approach
// The panel is always rendered; CSS controls visibility
<div
  className={`overflow-hidden transition-all duration-300 ease-in-out ${
    isOpen ? 'max-h-48 opacity-100' : 'max-h-0 opacity-0'
  }`}
>
  {/* panel content */}
</div>
```

`max-h-48` = 12rem = ~192px. With rows of ~36px each, this shows roughly 3–5 rows — consistent with the locked decision of "~3 rows visible". Scrollable interior uses `overflow-y-auto scrollbar-none` (the `.scrollbar-none` class already exists in `index.css`).

Alternative: if the planner prefers unmounting instead of CSS hiding, use a conditional render with the `modal-enter` animation class (already defined in `index.css`). CSS `max-height` is recommended because it animates out on close without requiring JS timers.

### Pattern 6: ScoreHistoryPanel Row Layout

**What:** Each row maps one `RoundEndPayload` to the compact display format.

```tsx
// Source: RoundEndModal.tsx badge pattern + ScorePanel team label pattern
function ScoreHistoryRow({
  entry,
  handNumber,
  myPlayerIndex,
}: {
  entry: RoundEndPayload
  handNumber: number
  myPlayerIndex: number
}) {
  const myTeam = myPlayerIndex % 2 === 0 ? 0 : 1
  const winningLabel = entry.winningTeam === null
    ? 'Trancado'
    : entry.winningTeam === myTeam ? 'Nosotros' : 'Ellos'
  const winColor = entry.winningTeam === null
    ? '#F59E0B'  // amber — trancado
    : entry.winningTeam === myTeam ? '#22C55E' : '#F97316'

  return (
    <div className="flex items-center gap-2 px-3 py-2 border-b border-white/5 text-xs font-body">
      {/* Hand number */}
      <span className="text-white/40 w-10 shrink-0">Mano {handNumber}</span>
      {/* Winning side */}
      <span className="font-semibold w-16 shrink-0" style={{ color: winColor }}>
        {winningLabel}
      </span>
      {/* Points earned */}
      <span className="text-white font-bold w-10 shrink-0">
        +{entry.totalPointsScored}
      </span>
      {/* Running totals */}
      <span className="text-white/50 flex-1">
        {entry.scores.team0} | {entry.scores.team1}
      </span>
      {/* Special badges — compact version */}
      {entry.isCapicu && (
        <span className="bg-gold text-bg font-bold text-[10px] px-1.5 py-0.5 rounded-full shrink-0">
          Capicú
        </span>
      )}
      {entry.isChuchazo && (
        <span className="bg-accent text-white font-bold text-[10px] px-1.5 py-0.5 rounded-full shrink-0">
          Chuchazo
        </span>
      )}
      {entry.reason === 'blocked' && !entry.isCapicu && !entry.isChuchazo && (
        <span className="bg-amber-600 text-white font-bold text-[10px] px-1.5 py-0.5 rounded-full shrink-0">
          Trancado
        </span>
      )}
    </div>
  )
}
```

### Pattern 7: GameTable Integration

**What:** `GameTable.tsx` is the composition root. The panel goes between `<ScorePanel>` and the main table grid. No z-index required since it's in document flow.

```tsx
// In GameTable.tsx
const showScoreHistory = useUIStore(s => s.showScoreHistory)
const { setShowScoreHistory } = useUIStore()
const scoreHistory = useGameStore(s => s.scoreHistory)

const handleScoreBarClick = () => setShowScoreHistory(!showScoreHistory)

// Auto-close when round-end modal appears (Claude's Discretion)
const showRoundEnd = useUIStore(s => s.showRoundEnd)
useEffect(() => {
  if (showRoundEnd) setShowScoreHistory(false)
}, [showRoundEnd])

return (
  <div className="flex flex-col h-screen overflow-hidden select-none felt-table">
    <ScorePanel
      {...existingProps}
      onClick={handleScoreBarClick}
      isOpen={showScoreHistory}
    />
    <ScoreHistoryPanel
      isOpen={showScoreHistory}
      entries={scoreHistory}
      myPlayerIndex={myPlayerIndex}
    />
    {/* rest of table grid unchanged */}
  </div>
)
```

### Anti-Patterns to Avoid

- **Using `height: auto` for CSS transition:** Cannot be transitioned. Use `max-height` with a fixed value instead.
- **Storing `scoreHistory` in `uiStore`:** Data (game history) belongs in `gameStore`; visibility state belongs in `uiStore`. The CONTEXT.md is explicit about this.
- **Importing stores from each other:** CLAUDE.md states the three Zustand stores are "never imported across each other." `GameTable.tsx` is the correct place to read from both `gameStore` and `uiStore`.
- **Adding a new socket event for score history:** All data is already in `game:round_ended`. No server changes needed.
- **Using `fixed` positioning for this panel:** It is not a full-screen overlay. It belongs in document flow between the score bar and the board grid.
- **Clearing history on rematch:** CONTEXT.md is explicit — history resets on `game:started` (new game), not on "siguiente mano". Phase 3 (Rematch) will introduce a separate event if needed.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Smooth reveal animation | Custom JS-driven height calculation | CSS `max-height` transition | Native CSS handles it; no ResizeObserver, requestAnimationFrame, or setTimeout needed |
| Scrollable list | Custom scroll implementation | Native `overflow-y-auto` + `.scrollbar-none` | The utility class already exists in `index.css` |
| Team label localization | New translation system | Same `myTeam` pattern from `ScorePanel.tsx` and `RoundEndModal.tsx` | Already solved; copy the pattern verbatim |
| Badge styling | New badge component | Inline `className` strings matching `RoundEndModal.tsx` | Badges are one-off elements; no abstraction needed |

**Key insight:** This phase is entirely an assembly job — existing data types, existing store patterns, existing CSS utilities, and existing team-label logic. The only genuinely new code is `ScoreHistoryPanel.tsx` and the small additions to three existing files.

---

## Common Pitfalls

### Pitfall 1: `height: auto` CSS Transition
**What goes wrong:** Setting `height: auto` on the collapsed state and trying to transition to a fixed height — or vice versa — produces no animation. The browser cannot interpolate to/from `auto`.
**Why it happens:** Developers often try `height: 0 → height: auto`.
**How to avoid:** Use `max-height: 0 → max-height: Npx` (or a Tailwind `max-h-*` class). The tradeoff is choosing a generous-enough max to fit all realistic content.
**Warning signs:** Panel appears/disappears instantly with no animation.

### Pitfall 2: `handNumber` derivation in scoreHistory
**What goes wrong:** Using `scoreHistory.length` to compute the hand number shown in a row leads to off-by-one errors after `clearScoreHistory()`.
**Why it happens:** `scoreHistory` is an ordered array but index 0 is the newest entry (prepended). Index-based hand numbering is inverted.
**How to avoid:** Derive `handNumber` from position within the reversed display. Since entries are prepended (newest first), `handNumber = scoreHistory.length - index` when rendering (or capture `handNumber` from `gameState.handNumber` at the time of `addToScoreHistory`). Better approach: store `handNumber` on the entry itself by reading `gameState.handNumber` at the time `game:round_ended` fires.
**Warning signs:** Mano numbers skip or go backwards after multiple rounds.

**Resolution:** The `RoundEndPayload` type does not currently include `handNumber`. However, `gameStore.gameState.handNumber` is available when the `game:round_ended` event fires. In `useSocket.ts`, read `useGameStore.getState().gameState?.handNumber` at the time of the event to capture it, and include it when calling `addToScoreHistory`. Alternatively, extend `RoundEndPayload` on the server to include `handNumber` — but the CONTEXT.md says zero server changes, so the client-side read is the correct approach.

**Update to store action signature:**
```typescript
addToScoreHistory: (data: RoundEndPayload, handNumber: number) => void
// Or wrap: store RoundEndPayload + handNumber as a union type
```

### Pitfall 3: Panel open when RoundEnd modal appears
**What goes wrong:** Both the score history panel and the round-end modal are visible simultaneously, creating visual clutter. The round-end modal is already `z-40` fixed overlay, so it covers the panel, but the panel still "shows" under the modal.
**Why it happens:** The panel open state is managed independently.
**How to avoid:** Auto-close the panel when `showRoundEnd` becomes true. A `useEffect` in `GameTable.tsx` watching `showRoundEnd` and calling `setShowScoreHistory(false)` is the clean solution. (This is listed as Claude's Discretion — it should be implemented as the default behavior.)

### Pitfall 4: `useSocket.ts` stale closure
**What goes wrong:** If `addToScoreHistory` or `clearScoreHistory` are not added to the destructure at the top of `useSocket`, the functions referenced inside the `useEffect` will be stale.
**Why it happens:** React hooks and the empty `[]` dependency array mean all references captured at mount time.
**How to avoid:** Add both actions to the destructure from `useGameStore()` at the top of `useSocket`, same as existing actions. The Zustand store's action functions are stable references (not re-created on render), so they do not need to be added to the `useEffect` deps array.

### Pitfall 5: `overflow: hidden` on GameTable blocking the panel
**What goes wrong:** `GameTable.tsx` wraps everything in `overflow-hidden` (`div.flex-col.h-screen.overflow-hidden`). If `ScoreHistoryPanel` is inside this div, the panel will be clipped when it drops down.
**Why it happens:** `overflow-hidden` on the parent clips all children.
**How to avoid:** The panel must be a sibling of the main grid div (between `<ScorePanel />` and the main `<div className="flex-1 overflow-hidden">`), not nested inside the grid's overflow-hidden container. The current `GameTable.tsx` layout already works this way — `ScorePanel` is a direct child of the outer `flex-col` div, so inserting `ScoreHistoryPanel` immediately after it (before the grid div) keeps it outside the clipped zone.

**Confirm by reading current layout:**
```
div.flex-col.h-screen.overflow-hidden  ← outer wrapper
  <ScorePanel />                        ← direct child (not clipped)
  <ScoreHistoryPanel />                 ← INSERT HERE (not clipped)
  div.flex-1.overflow-hidden            ← grid (board, players)
  <TurnIndicator />                     ← overlay (fixed)
  <RoundEndModal />                     ← overlay (fixed)
  <GameEndModal />                      ← overlay (fixed)
```

---

## Code Examples

### Verified: Existing badge pattern (from RoundEndModal.tsx)
```tsx
{roundEndData.isCapicu && (
  <span className="bg-gold text-bg font-bold text-sm px-3 py-1 rounded-full">
    ¡Capicú! +100
  </span>
)}
{roundEndData.isChuchazo && (
  <span className="bg-accent text-white font-bold text-sm px-3 py-1 rounded-full">
    ¡Chuchazo! +100
  </span>
)}
```
Compact row badges should use `text-[10px] px-1.5 py-0.5` instead of `text-sm px-3 py-1` to fit the narrower row.

### Verified: Existing team label pattern (from ScorePanel.tsx)
```tsx
const myTeam = myPlayerIndex % 2 === 0 ? 0 : 1
const teamALabel = myTeam === 0 ? 'Nosotros' : 'Ellos'
const teamBLabel = myTeam === 1 ? 'Nosotros' : 'Ellos'
```
`ScoreHistoryPanel` will use this same derivation to label the winning team.

### Verified: Zustand action pattern (from gameStore.ts)
```typescript
resetGame: () => set({ gameState: null, roundEndData: null, gameEndData: null, lastTileSequence: null }),
```
Extend by adding `scoreHistory: []` to this `set()` call.

### Verified: scrollbar-none (from index.css)
```css
.scrollbar-none::-webkit-scrollbar { display: none; }
.scrollbar-none { -ms-overflow-style: none; scrollbar-width: none; }
```
Apply `scrollbar-none overflow-y-auto` to the scrollable list container inside `ScoreHistoryPanel`.

### Verified: CSS transition timing (from ScorePanel.tsx progress bars)
```tsx
className="h-full rounded-full transition-all duration-500"
```
Use `transition-all duration-300` for the panel (slightly faster than the 500ms bar fill — appropriate for a discrete open/close).

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| CSS `height: 0 → auto` | CSS `max-height: 0 → Npx` | CSS specification baseline | Enables smooth animated reveal without JS |
| JS-managed animation state | Tailwind conditional classes + CSS transition | Tailwind 3.x era | No JS timer or requestAnimationFrame needed |

**No deprecated patterns apply to this phase.** All libraries are current (React 18, Zustand 4, Tailwind 3, TypeScript 5).

---

## Open Questions

1. **`handNumber` field on `RoundEndPayload`**
   - What we know: `RoundEndPayload` does not include `handNumber`. `gameStore.gameState.handNumber` is available at event time.
   - What's unclear: Whether `gameState.handNumber` has already been updated by the time `game:round_ended` fires (server may have advanced the counter). Need to verify server sends the completed-hand number or the next-hand number.
   - Recommendation: Read `useGameStore.getState().gameState?.handNumber` in the `game:round_ended` handler and pass it as a second argument to `addToScoreHistory`. If the value is off by one, use `handNumber - 1` (if server increments before emitting) or `handNumber` (if server emits before incrementing). The planner should make the task verify this with a two-player test.

2. **Rematch vs new-game reset boundary**
   - What we know: History should NOT reset on rematch. CONTEXT.md says reset on `game:started`. Phase 3 has not yet defined the rematch socket event.
   - What's unclear: Whether Phase 3 will use `game:started` for rematch too, or a separate `game:rematch_started` event.
   - Recommendation: Implement reset on `game:started` as specified. When Phase 3 lands, if rematch uses `game:started`, a targeted fix will be needed (e.g., a flag on the payload distinguishing rematch from new game). Accept this as a known future touch-point.

---

## Validation Architecture

Nyquist validation is enabled (`workflow.nyquist_validation: true` in `.planning/config.json`).

### Test Framework

| Property | Value |
|----------|-------|
| Framework | None installed — no test runner in `client/package.json` or root `package.json` |
| Config file | None — Wave 0 must create test infrastructure or document manual-only plan |
| Quick run command | N/A — TypeScript strict mode (`npx tsc --noEmit`) is the primary automated check |
| Full suite command | `cd client && npx tsc --noEmit` |

**Note:** The project has no test runner (no Vitest, Jest, or equivalent). The `test/` directory contains a Flutter widget test (`widget_test.dart`) unrelated to the web client. All client-side validation is TypeScript strict-mode compilation plus manual functional testing.

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SCORE-01 | `addToScoreHistory` prepends entry; `clearScoreHistory` empties array; `resetGame` clears array | TypeScript compile check | `cd client && npx tsc --noEmit` | ❌ Store actions are new code |
| SCORE-01 | Panel renders correct team label (Nosotros/Ellos) relative to `myPlayerIndex` | Manual visual | Open game, complete 2+ hands, verify labels | N/A |
| SCORE-01 | Panel renders badge (Capicú/Chuchazo/Trancado) when `isCapicu`/`isChuchazo`/`reason === 'blocked'` | Manual visual | Play to a capicú end or blocked game | N/A |
| SCORE-02 | Clicking score bar toggles `showScoreHistory` | TypeScript compile check | `cd client && npx tsc --noEmit` | ❌ New onClick prop |
| SCORE-02 | Panel animates open and closed smoothly | Manual visual | Click score bar, verify slide animation | N/A |
| SCORE-02 | Panel auto-closes when round-end modal appears | Manual functional | Complete a round, verify panel closes before modal shows | N/A |
| SCORE-03 | `game:started` handler calls `clearScoreHistory()` | TypeScript compile check | `cd client && npx tsc --noEmit` | ❌ New handler call |
| SCORE-03 | History is empty at the start of a fresh game | Manual functional | Complete a game, start a new one, verify panel empty | N/A |

### Sampling Rate
- **Per task commit:** `cd client && npx tsc --noEmit` (catches type errors in store, hook, and component changes)
- **Per wave merge:** `cd client && npx tsc --noEmit && cd ../server && npx tsc --noEmit` (full type check both workspaces)
- **Phase gate:** Both TypeScript checks green + manual functional verification of all three requirements before `/gsd:verify-work`

### Wave 0 Gaps

The project has no JavaScript/TypeScript test runner. Rather than adding Vitest infrastructure as a Wave 0 prerequisite (which would add scope to this phase), the validation strategy is:

- TypeScript strict-mode compilation acts as the primary automated correctness gate
- Manual functional testing covers UI behavior that cannot be type-checked
- No Wave 0 test file scaffolding needed — `npx tsc --noEmit` requires no setup

If the planner chooses to add Vitest, the Wave 0 setup would be:
- [ ] `client/vitest.config.ts` — Vitest config with jsdom environment
- [ ] `client/src/store/__tests__/gameStore.test.ts` — covers `addToScoreHistory`, `clearScoreHistory`, `resetGame` clearing history
- [ ] `client/src/store/__tests__/uiStore.test.ts` — covers `showScoreHistory` toggle

This is optional for this phase given the existing project convention of TypeScript-only checking.

---

## Sources

### Primary (HIGH confidence)
- Direct code inspection of `client/src/store/gameStore.ts` — store shape, action patterns
- Direct code inspection of `client/src/store/uiStore.ts` — modal toggle pattern
- Direct code inspection of `client/src/hooks/useSocket.ts` — event handler pattern
- Direct code inspection of `client/src/components/game/ScorePanel.tsx` — props shape, Tailwind tokens
- Direct code inspection of `client/src/components/game/GameTable.tsx` — layout structure, overflow-hidden context
- Direct code inspection of `client/src/components/game/RoundEndModal.tsx` — badge CSS, team label convention
- Direct code inspection of `client/src/index.css` — animation keyframes, utility classes (`.scrollbar-none`, `.modal-enter`)
- Direct code inspection of `client/tailwind.config.ts` — design tokens: `primary`, `accent`, `gold`, `bg`, `surface`, `font-header`, `font-body`
- Direct code inspection of `client/src/types/game.ts` — `RoundEndPayload` fields confirmed

### Secondary (MEDIUM confidence)
- CSS `max-height` transition technique — well-established browser capability, no verification needed beyond project usage of `transition-all` in `ScorePanel.tsx`

### Tertiary (LOW confidence — needs manual verification)
- `handNumber` timing in server payloads — whether `gameState.handNumber` is pre/post-increment at the time `game:round_ended` fires requires a runtime check

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries already installed and verified in package.json
- Architecture: HIGH — patterns directly verified from existing source files; no assumptions
- Pitfalls: HIGH — derived from direct reading of existing code structure (overflow-hidden, stale closures, max-height CSS)
- Handedness of handNumber: LOW — requires runtime verification

**Research date:** 2026-03-06
**Valid until:** 2026-04-06 (stable dependencies; no fast-moving ecosystem concerns)

---

## RESEARCH COMPLETE

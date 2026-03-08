# Phase 3: Rematch Flow - Context

**Gathered:** 2026-03-08
**Status:** Ready for planning

<domain>
## Phase Boundary

After a game ends, all four players can vote "Revancha" in the game-end modal. When 4/4 agree, the game resets to 0-0 with same seats and teams — no one navigates away or re-enters a code. If a player disconnects during voting, rematch is cancelled and remaining players are notified and sent to lobby.

</domain>

<decisions>
## Implementation Decisions

### Vote UX in GameEndModal
- Replace existing host-only "Jugar de Nuevo" button with "Revancha" button visible to all 4 players
- Revancha button appears after a 2-3 second delay (let players absorb the result first)
- After tapping: button becomes disabled with a ✓ checkmark
- No explicit decline button — players who don't want to rematch just close/navigate away (triggers REM-06 disconnect cancel)
- Change team labels from "Equipo A/B" to "Nosotros/Ellos" (relative per player), matching ScoreHistoryPanel convention
- Player vote list appears below the Revancha button, showing all 4 names with checkmark/waiting status
- "X/4 listos" counter text appears as a summary header above the per-player list

### Live vote counter
- Each player row: name in neutral white/gray color (no team colors) + green ✓ when voted or subtle waiting indicator
- "X/4 listos" summary text above the list
- Checkmark appears with a subtle scale-in animation when a player votes (pop effect)
- Vote updates arrive in real time via socket events

### Disconnect cancellation
- Immediate cancel on disconnect — no grace period
- Toast notification: "[Player] se desconectó. Revancha cancelada." — brief, non-blocking
- Disconnected player shown briefly with ✕ / strikethrough in the vote list (~2 seconds visual closure)
- After brief display, all remaining players navigate to lobby
- Room persists — 4th player can rejoin and they can start fresh

### Transition to new game
- New `game:rematch` socket event (separate from existing `game:next_game`)
- Client emits `game:rematch_vote` → server tracks votes → when 4/4: server emits `game:rematch_accepted`
- On 4/4: modal shows "¡Revancha! 🔥" celebration text with scale-in animation for 1-2 seconds
- Then modal closes and new game starts (server emits `game:started` like normal)
- No countdown, no confetti — text + emoji only
- After rematch starts: just deal and go, existing turn indicator is sufficient

### Claude's Discretion
- Exact animation timing and easing for checkmark pop-in and "¡Revancha!" text
- Toast notification duration and positioning (existing PasoToast pattern available)
- Waiting indicator style (dots, spinner, or dimmed text)
- Server-side vote state structure and cleanup

</decisions>

<specifics>
## Specific Ideas

- User wants "cambiar equipo" option alongside Revancha — deferred to separate phase (see below)
- "¡Revancha! 🔥" celebration matches the existing 🏆/🤝 emoji pattern in GameEndModal
- Nosotros/Ellos labels should be consistent with ScoreHistoryPanel (Phase 2 convention)

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `GameEndModal.tsx`: Current modal with scores display — Revancha button and vote list will be added here
- `PasoToast.tsx`: Existing toast notification pattern — reuse for disconnect cancellation toast
- `uiStore.ts`: `showGameEnd` pattern — may need new state for rematch voting phase
- `socket.ts`: Existing socket instance used by GameEndModal for `game:next_game` — same pattern for `game:rematch_vote`

### Established Patterns
- `gameHandlers.ts` handles all game socket events — rematch events belong here
- `broadcastState()` / `broadcastStateWithAction()` for sending personalized state to all players
- `RoomManager.ts` manages room lifecycle — rematch vote state could live on the room or game state
- `game:started` event already handles full game reset — rematch just needs to trigger it after consensus

### Integration Points
- `GameEndModal.tsx`: Primary UI changes — add Revancha button, vote list, celebration transition
- `gameHandlers.ts`: New `game:rematch_vote` handler, vote tracking, `game:rematch_accepted` emission
- `GameState.ts`: May need `rematchVotes` field on ServerGameState or room-level state
- `useSocket.ts`: New handlers for `game:rematch_vote_update`, `game:rematch_accepted`, `game:rematch_cancelled`
- `gameStore.ts` or `roomStore.ts`: Client-side vote state (who has voted)

</code_context>

<deferred>
## Deferred Ideas

- "Cambiar equipo" (team shuffle/swap) option in game-end modal — new capability, belongs in its own phase
- Rematch win counter per session (SCORE-V2-02 in REQUIREMENTS.md) — v2 feature

</deferred>

---

*Phase: 03-rematch-flow*
*Context gathered: 2026-03-08*

# Project Research Summary

**Project:** Dominos PR — Social Features Milestone (Chat, Rematch, Score History)
**Domain:** Real-time multiplayer browser tile game — social layer additions
**Researched:** 2026-03-06
**Confidence:** HIGH

## Executive Summary

This milestone adds three social features — in-game chat, rematch flow, and score history panel — to a fully built Puerto Rican dominoes game running on Socket.io 4.7, React 18, Zustand 4.4, and Express 4. The verdict from all four research streams is consistent: zero new npm packages are required. Every feature fits cleanly within the existing stack's primitives. Chat uses the existing Socket.io room broadcast pattern with a new `chat:` event namespace. Rematch uses a server-side consensus state machine added to the `Room` object. Score history is a client-side accumulation of `game:round_ended` payloads the server already emits. The architecture for all three is additive — no existing code paths (GameEngine.ts, broadcastState, the three Zustand stores) need to change.

The recommended build sequence from architecture analysis is: **Score History first** (client-only, zero risk), then **Rematch** (server Room changes + modal updates), then **Chat** (largest surface area, most mobile layout risk). Two prerequisite bug fixes from CONCERNS.md must land before feature work begins: the `isHost` determination bug (seat-0 guess is wrong after host promotion) and the `selectedTileId` not-cleared-on-turn-change bug. Both bugs will break the rematch UI and the chat input respectively if left unaddressed.

The primary risks are not architectural — they are coordination and correctness risks in the rematch flow. A rematch race condition (two players click simultaneously, server runs reset twice) and the `isHost` bug are the two highest-severity issues. Both are fully preventable with explicit phase flags in the state machine and a server-authoritative `isHost` payload field. All other pitfalls are moderate or minor and have clear, low-effort mitigations documented in PITFALLS.md.

## Key Findings

### Recommended Stack

All three features build on the existing stack. Research confirmed no new packages are warranted at 4-player, in-memory scale. Chat that uses the existing Socket.io connection (same auth, same room lifecycle) is superior to a separate namespace or third-party service. Client-only score history accumulation avoids bloating every `game:state_snapshot` broadcast with display-only data. A new fourth Zustand store (`chatStore`) follows the exact isolation discipline of the existing three stores.

**Core technologies (all existing):**
- `socket.io` 4.7.2 (server + client): All real-time events — `chat:send`, `chat:message`, `game:rematch_vote`, `game:rematch_update`, `game:rematch_started`, `game:score_history`, `chat:history`
- `zustand` 4.4.7: New `chatStore` (fourth independent store); extend `gameStore` with `rematchVotes` + `scoreHistory`; extend `uiStore` with `showScoreHistory`
- `React` 18.2 + `Tailwind` 3.4: `ChatPanel`, `ChatToggleButton`, `ReactionPicker`, `ScoreHistoryPanel` components
- `TypeScript` strict mode: All new types added to `server/src/game/GameState.ts` and mirrored in `client/src/types/game.ts`

**New packages: none.**

### Expected Features

**Must have (table stakes):**
- **Rematch in same room** — after any multiplayer game, forcing players to re-share a room code is session-ending friction; this is the highest-priority gap in the current product
- **In-game chat (text + quick reactions)** — 4 friends playing together need communication; silence makes the game feel like playing against strangers; quick reactions (preset Spanish phrases) serve fast-paced play without typing

**Should have (differentiators for this milestone):**
- **Score history panel** — per-hand log lets players track "how did we get here?" during long Modo 500 games; client-only addition with data the server already sends
- **Disconnect/reconnect notification toasts** — the server already emits these events; client only does `console.log`; adding UI toast is very low effort, very high perceived quality

**Defer (v2+):**
- Per-seat reaction animations (medium layout complexity on mobile)
- Score history export (no demand signal yet)
- Spectator mode (requires architectural changes to seat assignment)
- Chat message persistence across sessions (requires database or Redis)
- Per-hand score charts (text table is sufficient; charting library is 50-200kB for zero added value)

### Architecture Approach

All three features are layered on top of the existing architecture without modifying its core paths. `GameEngine.ts` (pure functions) requires zero changes. `broadcastState` is unchanged — chat and rematch use direct `io.to(roomCode).emit(...)` rather than the personalized broadcast path. The `Room` interface gains three new fields (`chatHistory`, `scoreHistory`, `rematch`). The client gains one new store (`chatStore`) and two field additions to existing stores. `useSocket.ts` gains four new `socket.on(...)` registrations. All new server events follow the existing `namespace:action` naming convention (`chat:`, `game:rematch_*`).

**Major components:**
1. `chatHandlers.ts` (new server file) — registers `chat:send` handler; validates, stamps, and re-broadcasts `chat:message` to the room; rate-limits per socket
2. `chatStore.ts` (new client store) — `messages[]`, `unreadCount`, `isChatOpen`; cleared on game end; isolated from `gameStore`, `roomStore`, `uiStore`
3. `ChatPanel` + `ChatToggleButton` + `ReactionPicker` (new components) — slide-in overlay from right edge using `position: fixed`; does not displace the 3x3 GameTable grid
4. `ScoreHistoryPanel` (new component) — reads `gameStore.scoreHistory`; slide-in from top bar on ScorePanel tap
5. Rematch state machine in `gameHandlers.ts` — `rematch: { votes: Set<string>, expiresAt: number } | null` on Room; server-authoritative; emits `game:rematch_update` and `game:rematch_started`; `game:rematch_started` does NOT call `navigate('/game')` on the client (player is already there)

### Critical Pitfalls

1. **Rematch race condition** — two simultaneous votes trigger double reset, corrupting tile distribution. Prevention: add `rematchPhase: 'idle' | 'voting' | 'starting'` to Room; once `'starting'` is set, all subsequent votes are no-ops. Must be designed into the state machine before writing any handler code.

2. **`isHost` bug breaks rematch UI** — current code computes `isHost` as `players[0].connected && myPlayerIndex === 0`, which is wrong after host promotion. Any host-gated rematch button will never appear for the promoted host. Fix: expose `isHost: boolean` (or `hostSocketId`) from the server's room info payload. Must be fixed before rematch UI is built.

3. **Chat reconnect delivers no history** — reconnecting player sees an ongoing conversation without context. Prevention: maintain `chatHistory: ChatMessage[]` (capped at 50) on the `Room` object; send it via `chat:history` event in the reconnect path alongside the game state snapshot. Fix the dynamic `require` in `roomHandlers.ts:36` before touching the reconnect path.

4. **Rematch resets game score instead of accumulating it** — `game:start` logic initializes scores to 0-0; a naive rematch that reuses this path wipes the session record. Prevention: separate session score (`room.gameScore`) from per-game score (`game.scores`); rematch creates a fresh `ServerGameState` but preserves the session win record.

5. **`selectedTileId` interferes with chat input focus** — the existing bug where `selectedTileId` is not cleared on turn change can cause a keyboard Enter in the chat input to fire a board-end click handler. Prevention: fix the `selectedTileId` clear-on-turn-change bug first; also clear `selectedTileId` when chat input receives focus.

## Implications for Roadmap

Based on research, suggested phase structure:

### Phase 1: Prerequisite Bug Fixes
**Rationale:** Two existing bugs (isHost determination, selectedTileId leak) will directly break rematch UI and chat input if not fixed first. The animation bug fix (left-end tile sequence) should also land here in isolation to avoid bundling it with layout changes later. These are small, scoped fixes that de-risk all subsequent phases.
**Delivers:** Stable baseline for feature development; correct host-gated UI; animation regression guard
**Addresses:** CONCERNS.md — isHost bug, selectedTileId bug, left-end animation bug
**Avoids:** Pitfalls 5, 10, 11 (animation regression, isHost rematch failure, chat focus conflict)
**Research flag:** No research needed — fixes are documented in CONCERNS.md with clear remediation steps.

### Phase 2: Score History Panel
**Rationale:** Lowest risk of the three features — client-only, no new server events on the critical game path, no interaction with the other two features. Delivers visible value (per-hand log) while de-risking the `gameStore` extension pattern before rematch extends it further. The `ScorePanel` tap-to-expand UX also establishes the mobile overlay pattern that `ChatPanel` will reuse.
**Delivers:** Collapsible per-hand score log accessible from the score bar; `roundHistory: RoundEndPayload[]` in `gameStore`; `ScoreHistoryPanel` component
**Uses:** Existing `game:round_ended` payloads; Zustand `gameStore` extension; Tailwind table component
**Implements:** `ScoreHistoryPanel`, `uiStore.showScoreHistory`, `gameStore.addHandRecord`/`clearScoreHistory`
**Avoids:** Pitfalls 4, 9, 14 (score data freshness, unnecessary re-renders via selector subscription, stale data after server restart)
**Research flag:** No research needed — pattern is well-established; data source (existing `game:round_ended`) is confirmed.

### Phase 3: Rematch Flow
**Rationale:** Highest user value of the milestone — eliminates the biggest UX cliff. Must come after Phase 1 (isHost fix is a prerequisite) and ideally after Phase 2 (score history is visible in the GameEndModal before players decide to rematch). Server changes (Room rematch field, new events) are moderate but well-specified.
**Delivers:** "Revancha" button in GameEndModal; server-side vote consensus; `game:rematch_started` restarts the game without re-sharing the room code; `game:rematch_update` live vote counter (X/4 listos)
**Uses:** Socket.io room events; `gameStore.rematchVotes`; extended `Room` type; `resetGameForRematch()` server function
**Implements:** `game:rematch_vote` handler in `gameHandlers.ts`; rematch state machine on `Room`; modified `GameEndModal`
**Avoids:** Pitfalls 1, 6, 8, 13 (race condition via `rematchPhase` flag, score reset via session score separation, disconnect during vote via seat-index keying, server restart via `room:error` emission)
**Research flag:** No research needed — all patterns are grounded in direct codebase analysis. Rematch state machine is fully specified in ARCHITECTURE.md.

### Phase 4: In-Game Chat
**Rationale:** Largest surface area of the three features (new store, new server handler file, new components, reconnect replay, spam prevention, mobile layout). Coming last means the `position: fixed` overlay pattern is already proven by ScoreHistoryPanel (Phase 2), and the `useSocket.ts` extension pattern is proven by rematch (Phase 3). Mobile layout conflicts are the main risk — the GameTable 3x3 grid must not be disturbed.
**Delivers:** Slide-in chat panel from the right edge; quick reactions (6 preset Spanish phrases); unread badge in ScorePanel; chat history replay on reconnect; rate-limited message sending
**Uses:** New `chatHandlers.ts` server file; new `chatStore.ts` client store; `chat:send`/`chat:message`/`chat:history` events
**Implements:** `ChatPanel`, `ChatToggleButton`, `ReactionPicker` components; `chatStore`; server `chatHistory` on `Room`
**Avoids:** Pitfalls 2, 3, 7, 11, 12 (XSS via static emoji map, no reconnect history via chatHistory replay, spam via token bucket, selectedTileId leak via focus guard, out-of-order messages via server timestamp)
**Research flag:** Mobile layout for slide-in overlay on the GameTable may need iteration. Consider a quick prototype of the `position: fixed` right-panel approach on actual mobile dimensions before committing to the full implementation.

### Phase Ordering Rationale

- **Bugs before features:** Both the isHost and selectedTileId bugs directly block correct behavior in rematch and chat. Fixing them first avoids discovering the failure mid-feature-implementation.
- **Lowest risk first:** Score history is purely additive and client-only, making it the safest first feature to build. It validates the store extension pattern and establishes the overlay UX before more complex phases.
- **Dependency chain:** Phase 2 (score history) feeds meaningfully into Phase 3 (rematch) — players see the hand log before deciding to rematch. This is a soft dependency but produces better UX if respected.
- **Chat last:** Chat has the largest surface area and the most mobile layout risk. Building it after the overlay pattern is established (Phase 2) and the useSocket extension pattern is proven (Phase 3) reduces the chance of costly rework.
- **GameEngine.ts is never touched:** All four phases layer on top of the pure-function engine, preserving the core game logic invariant.

### Research Flags

Phases with standard patterns (skip research-phase):
- **Phase 1 (Bug Fixes):** All fixes are documented in CONCERNS.md with exact file locations and remediation steps. No research needed.
- **Phase 2 (Score History):** Client-only accumulation of existing server payloads. Zustand selector pattern is well-documented. No research needed.
- **Phase 3 (Rematch):** Fully specified in ARCHITECTURE.md including server state machine, new events, and anti-patterns. No research needed.

Phases that may benefit from a focused research spike:
- **Phase 4 (Chat) — mobile layout:** The `position: fixed` right-side overlay approach is the recommendation, but the GameTable's 3x3 grid has known fragility (pixel constants for SNAKE_CAP, dynamic row spacing). Test the overlay approach against actual iOS/Android viewport dimensions before committing to the full ChatPanel implementation. A 1-hour spike prototyping the layout is lower cost than a full rewrite if the overlay causes board reflow.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All three features verified against existing codebase; no external library docs needed; zero new packages is a firm conclusion |
| Features | HIGH | Rematch and score history are directly derived from codebase gaps; chat conventions are well-established multiplayer patterns; anti-features list is well-reasoned |
| Architecture | HIGH | All patterns derived from direct reading of production source files, not training data inference; event naming, store boundaries, and component placement are all grounded in existing code |
| Pitfalls | HIGH (codebase-grounded) / MEDIUM (general patterns) | Critical pitfalls 1-5 are directly derived from CONCERNS.md and codebase analysis; moderate/minor pitfalls draw on Socket.io multiplayer conventions from training data |

**Overall confidence:** HIGH

### Gaps to Address

- **Chat character/retention limits (200 chars, 50 messages):** These are industry conventions, not project-specific requirements. Validate with the project stakeholder before implementing server-side enforcement. If the limit is wrong, it is a one-line change but worth confirming early.
- **Quick reaction preset phrases:** The recommended set ("¡Capicú!", "¡Buena jugada!", "🤔", "😂", "🔥", "😤" or similar Spanish phrases) is a cultural/UX decision. Get stakeholder sign-off on the exact list before building the `ReactionPicker` component — changing the list after is trivial, but the server's reaction key allowlist must match.
- **Rematch score semantics (reset vs. accumulate):** PITFALLS.md flags this as a critical ambiguity. Confirm with the stakeholder: does "Revancha" start a brand new game (scores reset to 0-0) or continue a session (track wins across games)? The architectural answer differs. The recommendation is session-level win tracking (`room.gameScore`) but this needs explicit confirmation before the rematch reset logic is written.
- **`isHost` bug fix scope:** The fix requires exposing `isHost` (or `hostSocketId`) from the server's room info payload. Confirm whether this change should be made in the existing `connection:room_info` event payload or as a new event. Check `roomHandlers.ts` and `roomStore.ts` to understand the current payload shape before implementing.

## Sources

### Primary — HIGH confidence (direct codebase analysis)
- `server/src/socket/gameHandlers.ts` — broadcast patterns, event naming, game phase guards
- `server/src/socket/roomHandlers.ts` — reconnect path, room lifecycle, dynamic require bug
- `server/src/game/RoomManager.ts` — Room structure, lifecycle methods, cleanup interval
- `server/src/game/GameState.ts` — type definitions to extend
- `client/src/hooks/useSocket.ts` — client event registration pattern
- `client/src/store/{gameStore,roomStore,uiStore}.ts` — Zustand store discipline
- `client/src/components/game/{GameEndModal,RoundEndModal,ScorePanel,GameTable}.tsx` — components to modify
- `.planning/PROJECT.md` — scope constraints (no new frameworks, no persistence, table-only score history)
- `.planning/codebase/CONCERNS.md` — known bugs and tech debt (isHost, selectedTileId, animation bug, dynamic require)

### Secondary — MEDIUM confidence (training data on established patterns)
- Socket.io 4.x room broadcast API (`io.to(roomCode).emit(...)`) — stable since 4.0
- Zustand 4.x selector subscription pattern (`useStore(s => s.field)`) — standard optimization
- Multiplayer browser game UX conventions (skribbl.io, Boardgame Arena, Gartic Phone patterns) — rematch, chat, reaction conventions
- Token-bucket rate limiting for Socket.io event handlers — general pattern
- Puerto Rican dominoes cultural context — same seats for rematch is conventional

---
*Research completed: 2026-03-06*
*Ready for roadmap: yes*

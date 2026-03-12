# Roadmap: Dominos PR — Social Features Milestone

## Overview

This milestone layers three social features — score history, rematch, and in-game chat — onto a fully functional Puerto Rican dominoes game. Four prerequisite bug fixes land first to de-risk all subsequent phases. The work is additive: GameEngine.ts is never touched, and each phase delivers a coherent, independently verifiable capability.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 0.5: Game Flow Bugs** - Cuatro bugs críticos de flujo de juego arreglados: segundo juego bloqueado, turno inicial incorrecto, tablero no responsivo, ficha atascada en tablero vacío
- [ ] **Phase 1: Bug Fixes** - Fix four prerequisite bugs that block correct rematch UI, chat input, and animation behavior
- [x] **Phase 2: Score History** - Add a collapsible per-hand score log accessible from the score bar during a game (completed 2026-03-08)
- [x] **Phase 3: Rematch Flow** - Let all four players agree to rematch in the same room without re-sharing the code (completed 2026-03-08)
- [x] **Phase 4: In-Game Chat** - Add a slide-in chat panel with free text messages and quick reactions (completed 2026-03-10)

## Phase Details

### Phase 0.5: Game Flow Bugs ✓ COMPLETE (2026-03-08)
**Goal**: El juego fluye correctamente entre manos y partidas — el jugador correcto comienza, las fichas se pueden colocar siempre, y el tablero es visible en cualquier tamaño de pantalla
**Depends on**: Nothing
**Requirements**: BUG-05, BUG-06, BUG-07, BUG-08
**Success Criteria** (what must be TRUE):
  1. Al terminar un juego, el ganador puede iniciar el segundo juego tirando cualquier ficha (sin buscar el 6-6)
  2. Quien gana una mano tirando su última ficha es quien comienza la siguiente mano
  3. En tranque, quien tiene menos pips es quien comienza la siguiente mano
  4. El tablero escala para caber en cualquier tamaño de ventana (móvil, tablet, desktop)
  5. El primer tile de cualquier juego/mano siempre se puede colocar con un solo click
**Fixed files**:
  - `server/src/game/GameState.ts` — added `gameWinnerIndex` field
  - `server/src/game/GameEngine.ts` — `getValidPlays` returns all tiles freely when `forcedFirstTileId = ''`
  - `server/src/socket/gameHandlers.ts` — `game:next_game` uses winner; `played_out` updates `handStarterIndex`
  - `client/src/components/board/GameBoard.tsx` — scale transform for responsive board
  - `client/src/hooks/useGameActions.ts` — empty board plays directly to 'right'
  - `client/src/hooks/useSocket.ts` — clears `selectedTileId` on `game:started`

### Phase 1: Bug Fixes
**Goal**: The game has a stable, correct baseline that won't break rematch UI, chat input, or tile animations
**Depends on**: Nothing (first phase)
**Requirements**: BUG-01, BUG-02, BUG-03, BUG-04
**Success Criteria** (what must be TRUE):
  1. When a tile is played on the left end of the board, its animation flies to that tile — not to the last tile in the array
  2. The host indicator is correct after host promotion — the promoted player sees host-gated UI, the original seat-0 player does not
  3. When the turn passes to another player, any previously selected tile is deselected — no ghost selection persists
  4. The server starts cleanly with no dynamic-require warning; the reconnect path can be safely extended
**Plans**: 1 plans

Plans:
- [ ] 01-01-PLAN.md — Validate all four bug fixes (BUG-01 through BUG-04) via type-check and runtime smoke test

### Phase 2: Score History
**Goal**: Players can see the accumulated per-hand score log at any point during a game without leaving the game view
**Depends on**: Phase 1
**Requirements**: SCORE-01, SCORE-02, SCORE-03
**Success Criteria** (what must be TRUE):
  1. During a game, a player can tap the score bar to open a panel showing each completed hand's result (winner, points, running total per team)
  2. Tapping the score bar again (or a close button) dismisses the panel without disrupting the board or any game action
  3. Starting a new game (not a rematch) resets the history panel to empty
**Plans**: 5 plans

Plans:
- [ ] 02-01-PLAN.md — Extend gameStore and uiStore with scoreHistory state and showScoreHistory toggle
- [ ] 02-02-PLAN.md — Create ScoreHistoryPanel component and add onClick/isOpen affordance to ScorePanel
- [ ] 02-03-PLAN.md — Wire useSocket.ts and GameTable.tsx, human-verify full flow
- [ ] 02-04-PLAN.md — [GAP] Fix board tile dimensions (52→80px) and eliminate first-frame jitter
- [ ] 02-05-PLAN.md — [GAP] Fix next-game desync: add game:next_game server handler, update GameEndModal and useSocket

### Phase 3: Rematch Flow
**Goal**: After a game ends, all four players can agree to rematch and immediately start a new game in the same room without re-sharing the room code
**Depends on**: Phase 2
**Requirements**: REM-01, REM-02, REM-03, REM-04, REM-05, REM-06
**Success Criteria** (what must be TRUE):
  1. In the game-end modal, every player sees a "Revancha" button and can cast their vote
  2. Every player sees a live "X/4 listos" counter update in real time as votes come in
  3. When all four votes are cast, the game resets to 0-0 with the same seats and teams — no one needs to navigate away or re-enter a code
  4. If a player disconnects while voting, the rematch is cancelled and all remaining players see a notification
**Plans**: 2 plans

Plans:
- [ ] 03-01-PLAN.md — Server rematch vote consensus, client types/state, and socket event handlers
- [ ] 03-02-PLAN.md — GameEndModal UI with Revancha button, vote counter, celebration, and disconnect handling

### Phase 4: In-Game Chat
**Goal**: Players can send text messages and quick reactions to each other during a game, and reconnecting players receive recent chat history
**Depends on**: Phase 3
**Requirements**: CHAT-01, CHAT-02, CHAT-03, CHAT-04, CHAT-05, CHAT-06, CHAT-07
**Success Criteria** (what must be TRUE):
  1. A player can open a chat panel, type a message (up to 200 characters), send it, and all four players see it appear in real time
  2. A player can send a quick reaction ("¡Capicú!", "¡Trancado!", "¡Buena jugada!", "¡Mala suerte!", "🔥", "🤡") with a single tap — no typing required
  3. When the chat panel is closed, an unread-message badge shows the count of messages received since the panel was last open
  4. A player who reconnects mid-game sees the last 50 messages sent in the room — they are not dropped into a silent conversation
  5. The server silently enforces rate limiting (5 messages / 10 seconds) and sanitizes all message content before broadcast
**Plans**: 2 plans

Plans:
- [ ] 04-01-PLAN.md — Server chat handler + client state/socket wiring (rate limiting, sanitization, history, uiStore, useSocket)
- [ ] 04-02-PLAN.md — Chat UI components (ChatPanel, ChatButton, ReactionPicker) and GamePage integration

### Phase 6: Chat Bug Fixes & Verification
**Goal:** Close all audit gaps for Phase 4 — fix stale chat history bug, create missing VERIFICATION.md, and formally close provenance gaps for CHAT-03 and CHAT-04
**Gap Closure:** Closes gaps from v1.0 audit
**Depends on:** Phase 4
**Requirements:** CHAT-03, CHAT-04, CHAT-05
**Success Criteria** (what must be TRUE):
  1. `room.chatHistory = []` is set in both the `game:next_game` path and the rematch consensus path — a reconnecting player never sees messages from a previous game
  2. VERIFICATION.md exists for Phase 04 and confirms CHAT-01 through CHAT-07 satisfied
  3. CHAT-03 (ReactionPicker) and CHAT-04 (unread badge) are formally documented as complete with code evidence
**Plans:** 1 plan

Plans:
- [ ] 06-01-PLAN.md — Rewrite 04-VERIFICATION.md with correct requirement IDs and write Phase 06 VERIFICATION.md

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 0.5. Game Flow Bugs | 4/4 | ✓ Complete | 2026-03-08 |
| 1. Bug Fixes | 0/1 | Not started | - |
| 2. Score History | 5/5 | Complete   | 2026-03-08 |
| 3. Rematch Flow | 2/2 | Complete   | 2026-03-08 |
| 4. In-Game Chat | 2/2 | Complete   | 2026-03-10 |
| 5. Video & Audio Call | 5/5 | Complete   | 2026-03-10 |
| 6. Chat Bug Fixes & Verification | 0/1 | Not started | - |
| 7. Two-Player Mode with Boneyard | 0/4 | Not started | - |

### Phase 5: Video & Audio Call — Players can see and talk to each other in real time via WebRTC while playing

**Goal:** Players can see and hear each other via native WebRTC video/audio call running alongside the game — using existing player seat positions for video tiles, with camera/mic opt-in set in the lobby before the game starts
**Requirements**: CALL-01, CALL-02, CALL-03, CALL-04, CALL-05, CALL-06
**Depends on:** Phase 4
**Plans:** 5/5 plans complete

Plans:
- [ ] 05-01-PLAN.md — callStore (Zustand) + webrtcHandlers.ts signaling relay + register in handlers.ts
- [ ] 05-02-PLAN.md — Lobby opt-in toggles (camera/mic icons per player) + webrtc:lobby_updated socket wiring
- [ ] 05-03-PLAN.md — useWebRTC hook (Perfect Negotiation, getUserMedia, peer connections, cleanup)
- [ ] 05-04-PLAN.md — VideoTile component replacing PlayerSeat + GameTable integration + GamePage mount
- [ ] 05-05-PLAN.md — TypeScript compile check + human visual verification checkpoint

### Phase 7: Two-Player Mode with Boneyard

**Goal:** Support 2-player games where leftover tiles form a boneyard — players draw from the boneyard when they can't play, scoring is individual (no teams), and the layout adapts to show only two seats (bottom + top)
**Requirements**: TWO-01, TWO-02, TWO-03, TWO-04, TWO-05, TWO-06, TWO-07
**Depends on:** Phase 6
**Plans:** 4 plans

Plans:
- [ ] 07-01-PLAN.md — Server types (boneyard, playerCount) and GameEngine pure function parameterization
- [ ] 07-02-PLAN.md — Server handlers: game:start for 2 players, boneyard draw in processAutoPassCascade, dynamic rematch
- [ ] 07-03-PLAN.md — Client types, gameStore boneyard handler, useSocket wiring, usePlayerPositions 2-player layout
- [ ] 07-04-PLAN.md — Client UI: 2-seat GameTable, RoomLobby, ScorePanel/modals label adaptation, human verify

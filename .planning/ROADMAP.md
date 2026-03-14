# Roadmap: Dominos PR

## Milestones

- v1.0 Social Features + Two-Player Mode (shipped 2026-03-13)
- v1.1 Deploy & Polish (shipped 2026-03-13)
- v1.2 Sound & Audio (in progress)

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)
- v1.0 phases 0.5-9: shipped (see milestones/v1.0-ROADMAP.md)
- v1.1 phases 10-12: shipped (see milestones/v1.1-ROADMAP.md)
- v1.2 phases 13-15: current milestone

Decimal phases appear between their surrounding integers in numeric order.

<details>
<summary>v1.0 Social Features + Two-Player Mode (Phases 0.5-9) -- SHIPPED 2026-03-13</summary>

- [x] Phase 0.5: Game Flow Bugs (4/4 plans) -- completed 2026-03-08
- [x] Phase 1: Bug Fixes (1/1 plan) -- completed 2026-03-08
- [x] Phase 2: Score History (5/5 plans) -- completed 2026-03-08
- [x] Phase 3: Rematch Flow (2/2 plans) -- completed 2026-03-08
- [x] Phase 4: In-Game Chat (2/2 plans) -- completed 2026-03-10
- [x] Phase 5: Video & Audio Call (5/5 plans) -- completed 2026-03-10
- [x] Phase 6: Chat Bug Fixes & Verification (1/1 plan) -- completed 2026-03-12
- [x] Phase 7: Two-Player Mode with Boneyard (4/4 plans) -- completed 2026-03-13
- [x] Phase 8: Boneyard Visual & Draw Animation (2/2 plans) -- completed 2026-03-13
- [x] Phase 9: Camera & Mic for Duo Mode (1/1 plan) -- completed 2026-03-13

Full details: [milestones/v1.0-ROADMAP.md](milestones/v1.0-ROADMAP.md)

</details>

<details>
<summary>v1.1 Deploy & Polish (Phases 10-12) -- SHIPPED 2026-03-13</summary>

- [x] Phase 10: Cloud Deployment (2/2 plans) -- completed 2026-03-13
- [x] Phase 11: PWA Support (1/1 plan) -- completed 2026-03-13
- [x] Phase 12: Avatar Cameras (2/2 plans) -- completed 2026-03-13

Full details: [milestones/v1.1-ROADMAP.md](milestones/v1.1-ROADMAP.md)

</details>

### v1.2 Sound & Audio (In Progress)

**Milestone Goal:** Add audio feedback to make the game feel alive -- tile sounds, turn/pass notifications, and ambient lobby music.

- [x] **Phase 13: Audio Foundation** - Shared AudioContext singleton, autoplay unlock, uiStore audio preferences, PWA caching (completed 2026-03-14)
- [x] **Phase 14: Game Sound Effects** - Tile clack, turn notification, and pass sounds wired to socket events (completed 2026-03-14)
- [ ] **Phase 15: Background Music & Controls** - Lo-fi lobby music lifecycle and separate SFX/music toggle UI

## Phase Details

### Phase 13: Audio Foundation
**Goal**: The app has a working audio infrastructure that all sounds and music will build on -- shared AudioContext, autoplay compliance, and offline-ready audio caching
**Depends on**: Phase 12
**Requirements**: AUD-01, AUD-02, AUD-03
**Success Criteria** (what must be TRUE):
  1. A single AudioContext is shared between SFX playback and existing WebRTC speaking detection (no iOS AudioContext conflicts)
  2. Audio plays correctly even when the first sound trigger happens before any user gesture (autoplay unlock handles it transparently)
  3. Audio files load and play when the app is launched from the home screen in offline/airplane mode (PWA cache)
  4. Existing WebRTC speaking detection with green glow ring still works identically after the AudioContext refactor
**Plans:** 2/2 plans complete
Plans:
- [x] 13-01-PLAN.md -- AudioContext singleton, autoplay unlock, audio loader, useSpeakingDetection refactor, uiStore split toggles
- [x] 13-02-PLAN.md -- PWA workbox globPatterns update for MP3 caching

### Phase 14: Game Sound Effects
**Goal**: Players hear audio feedback for the three core gameplay events -- tile placement, turn start, and pass -- making the game feel alive without visual attention
**Depends on**: Phase 13
**Requirements**: SFX-01, SFX-02, SFX-03
**Success Criteria** (what must be TRUE):
  1. User hears a domino clack sound immediately when any player places a tile on the board
  2. User hears a notification sound when it becomes their turn (useful when tabbed away or distracted)
  3. User hears a distinct sound when any player passes, including during auto-pass cascades (rapid consecutive passes are debounced, not stacked)
  4. All three sounds play without delay or audio glitches on mobile Safari and Chrome
**Plans:** 1/1 plans complete
Plans:
- [ ] 14-01-PLAN.md -- Generate 3 SFX audio files, create sfx.ts module, wire triggers into useSocket.ts

### Phase 15: Background Music & Controls
**Goal**: Users enjoy ambient music in the lobby and have independent control over music and sound effects
**Depends on**: Phase 14
**Requirements**: MUS-01, MUS-02, CTL-01, CTL-02
**Success Criteria** (what must be TRUE):
  1. User hears lo-fi background music playing on the menu and lobby screens
  2. Background music stops when the game starts (no music competing with gameplay SFX or voice chat)
  3. User can toggle SFX off while keeping music on (and vice versa) using separate controls
  4. Audio toggle states are visible in the game UI and reflect the current on/off status
**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 13 -> 14 -> 15

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 0.5. Game Flow Bugs | v1.0 | 4/4 | Complete | 2026-03-08 |
| 1. Bug Fixes | v1.0 | 1/1 | Complete | 2026-03-08 |
| 2. Score History | v1.0 | 5/5 | Complete | 2026-03-08 |
| 3. Rematch Flow | v1.0 | 2/2 | Complete | 2026-03-08 |
| 4. In-Game Chat | v1.0 | 2/2 | Complete | 2026-03-10 |
| 5. Video & Audio Call | v1.0 | 5/5 | Complete | 2026-03-10 |
| 6. Chat Bug Fixes | v1.0 | 1/1 | Complete | 2026-03-12 |
| 7. Two-Player Mode | v1.0 | 4/4 | Complete | 2026-03-13 |
| 8. Boneyard Animation | v1.0 | 2/2 | Complete | 2026-03-13 |
| 9. Duo Camera/Mic | v1.0 | 1/1 | Complete | 2026-03-13 |
| 10. Cloud Deployment | v1.1 | 2/2 | Complete | 2026-03-13 |
| 11. PWA Support | v1.1 | 1/1 | Complete | 2026-03-13 |
| 12. Avatar Cameras | v1.1 | 2/2 | Complete | 2026-03-13 |
| 13. Audio Foundation | v1.2 | 2/2 | Complete | 2026-03-14 |
| 14. Game Sound Effects | 1/1 | Complete    | 2026-03-14 | - |
| 15. Background Music & Controls | v1.2 | 0/? | Not started | - |

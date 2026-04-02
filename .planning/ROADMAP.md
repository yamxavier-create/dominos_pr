# Roadmap: Dominos PR

## Milestones

- v1.0 Social Features + Two-Player Mode (shipped 2026-03-13)
- v1.1 Deploy & Polish (shipped 2026-03-13)
- v1.2 Sound & Audio (shipped 2026-03-14, Phase 15 deferred)
- v1.3 Social & Accounts (in progress)

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)
- v1.0 phases 0.5-9: shipped (see milestones/v1.0-ROADMAP.md)
- v1.1 phases 10-12: shipped (see milestones/v1.1-ROADMAP.md)
- v1.2 phases 13-15: shipped/deferred (see below)
- v1.3 phases 16-19: current milestone

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

<details>
<summary>v1.2 Sound & Audio (Phases 13-15) -- SHIPPED 2026-03-14 (Phase 15 deferred)</summary>

- [x] **Phase 13: Audio Foundation** - Shared AudioContext singleton, autoplay unlock, uiStore audio preferences, PWA caching (completed 2026-03-14)
- [x] **Phase 14: Game Sound Effects** - Tile clack, turn notification, and pass sounds wired to socket events (completed 2026-03-14)
- [ ] **Phase 15: Background Music & Controls** - Deferred from v1.2 (not blocking v1.3)

</details>

### v1.3 Social & Accounts (In Progress)

**Milestone Goal:** Add user accounts, friends list with request/accept, online presence, and direct join -- so players can find and play with friends without sharing lobby codes.

- [x] **Phase 16: Auth & Profile** - Complete Google OAuth, preserve guest mode, display name editing and avatar display (completed 2026-04-02)
- [ ] **Phase 17: Friends System** - Search, request, accept/reject, list, unfriend -- full friends CRUD with real-time notifications
- [ ] **Phase 18: Presence** - Online/in_lobby/in_game/offline tracking with multi-tab support and friend notifications
- [ ] **Phase 19: Social Integration** - Direct join from friends list and post-game "Add Friend" button

## Phase Details

### Phase 16: Auth & Profile
**Goal**: Users can log in with Google or continue as guests, and logged-in users have a visible identity with editable display name and avatar
**Depends on**: Phase 14 (last shipped phase)
**Requirements**: AUTH-01, AUTH-02, AUTH-03, PROF-01, PROF-02
**Success Criteria** (what must be TRUE):
  1. User can tap the Google login button, complete OAuth flow, and land back in the app as a logged-in user
  2. User can open the app and play immediately as a guest without being prompted to log in (current behavior unchanged)
  3. Logged-in user refreshes the browser and is still logged in (JWT persisted in localStorage)
  4. Logged-in user can edit their display name from a profile section
  5. Logged-in user sees their Google profile picture as their avatar (or a default placeholder if unavailable)
**Plans**: 2 plans

Plans:
- [ ] 16-01-PLAN.md -- Google OAuth client wiring, /api dev proxy, logout socket fix (AUTH-01, AUTH-02, AUTH-03)
- [ ] 16-02-PLAN.md -- Profile endpoint + ProfileSection UI with avatar and editable name (PROF-01, PROF-02)

### Phase 17: Friends System
**Goal**: Logged-in users can find other players by username, send/manage friend requests, and see a friends list -- the foundation for all social features
**Depends on**: Phase 16
**Requirements**: FRD-01, FRD-02, FRD-03, FRD-04, FRD-05
**Success Criteria** (what must be TRUE):
  1. User can search for another user by username and see matching results
  2. User can send a friend request to a found user and the recipient receives it in real-time
  3. User can accept or reject a pending friend request from their requests list
  4. User can view their friends list showing all accepted friends
  5. User can unfriend someone and they disappear from both users' lists
**Plans**: TBD

Plans:
- [ ] 17-01: Friends REST API + socket events (server-side CRUD, bidirectional race prevention)
- [ ] 17-02: socialStore + Friends UI (search, requests, friends list, unfriend)

### Phase 18: Presence
**Goal**: Logged-in users can see what their friends are doing in real-time -- online, in a lobby, in a game, or offline -- with correct multi-tab behavior
**Depends on**: Phase 17
**Requirements**: PRES-01, PRES-02, PRES-03
**Success Criteria** (what must be TRUE):
  1. User can see each friend's current status (online/in_lobby/in_game/offline) on the friends list and it updates in real-time
  2. User receives a real-time notification when a friend comes online or enters a lobby
  3. User with multiple tabs open is shown as online (not flickering offline) and only goes offline when ALL tabs are closed (grace period prevents flicker)
**Plans**: TBD

Plans:
- [ ] 18-01: PresenceManager server class + socket integration (Map<userId, Set<socketId>>, grace period, status computation)
- [ ] 18-02: Presence UI + friend notifications (status badges, online/lobby toast notifications)

### Phase 19: Social Integration
**Goal**: The social features connect to gameplay -- users can jump directly into a friend's lobby and add opponents as friends after a game
**Depends on**: Phase 18
**Requirements**: JOIN-01, JOIN-02, FRD-06
**Success Criteria** (what must be TRUE):
  1. User can tap "Join" on a friend who is in a lobby and enter that lobby directly (no room code needed)
  2. The "Join" button only appears when the friend is in a lobby that has available seats (not full, not in-game)
  3. User can tap "Add Friend" on the post-game screen next to any logged-in opponent and send a friend request
**Plans**: TBD

Plans:
- [ ] 19-01: Direct join flow (server-validated join via friend's userId, privacy-safe room resolution)
- [ ] 19-02: Post-game "Add Friend" button + end-to-end social integration testing

## Progress

**Execution Order:**
Phases execute in numeric order: 16 -> 17 -> 18 -> 19

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
| 14. Game Sound Effects | v1.2 | 1/1 | Complete | 2026-03-14 |
| 15. Background Music | v1.2 | 0/1 | Deferred | - |
| 16. Auth & Profile | 2/2 | Complete    | 2026-04-02 | - |
| 17. Friends System | v1.3 | 0/2 | Not started | - |
| 18. Presence | v1.3 | 0/2 | Not started | - |
| 19. Social Integration | v1.3 | 0/2 | Not started | - |

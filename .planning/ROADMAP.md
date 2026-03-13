# Roadmap: Dominos PR

## Milestones

- v1.0 Social Features + Two-Player Mode (shipped 2026-03-13)
- v1.1 Deploy & Polish - Phases 10-12 (in progress)

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)
- v1.0 phases 0.5-9: shipped (see milestones/v1.0-ROADMAP.md)

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

### v1.1 Deploy & Polish

- [x] **Phase 10: Cloud Deployment** - Deploy to Railway with HTTPS, WebSocket support, and auto-redeploy from main (completed 2026-03-13)
- [x] **Phase 11: PWA Support** - Make the app installable from browser with standalone mode and proper branding (completed 2026-03-13)
- [ ] **Phase 12: Avatar Cameras** - Replace initials avatars with circular live video feeds and inline call controls

## Phase Details

### Phase 10: Cloud Deployment
**Goal**: The app is permanently accessible at a public HTTPS URL that anyone can visit to play
**Depends on**: Nothing (first phase of v1.1; v1.0 complete)
**Requirements**: DEPLOY-01, DEPLOY-02, DEPLOY-03
**Success Criteria** (what must be TRUE):
  1. User can visit a public HTTPS URL and see the Dominos PR landing page
  2. Socket.io WebSocket connection upgrades successfully (not stuck on polling) when a user joins a room
  3. Two players on different networks can create a room, play a complete game, and use video calling
  4. Pushing a commit to main branch triggers automatic redeploy without manual intervention
  5. App supports configuration for a custom domain
**Plans**: 2 plans

Plans:
- [ ] 10-01-PLAN.md -- Prepare codebase for production (railway.toml, conditional CORS, health endpoint)
- [ ] 10-02-PLAN.md -- Deploy to Railway, verify live app, document custom domain setup

### Phase 11: PWA Support
**Goal**: Users can install the app to their home screen and launch it like a native app
**Depends on**: Phase 10 (HTTPS required for service worker registration)
**Requirements**: PWA-01, PWA-02, PWA-03
**Success Criteria** (what must be TRUE):
  1. Android/Chrome user sees install prompt and can add the app to their home screen
  2. Installed app launches in standalone mode with no browser chrome and a splash screen
  3. App icon on home screen shows Domino PR branding (not a generic browser icon)
  4. Socket.io connections work correctly after installing as PWA (service worker does not cache socket traffic)
**Plans**: 1 plan

Plans:
- [x] 11-01-PLAN.md -- Configure vite-plugin-pwa with manifest, icons, service worker, and verify installability

### Phase 12: Avatar Cameras
**Goal**: Players see each other's live video as circular avatars in their seat positions, with inline controls
**Depends on**: Phase 10 (real-device HTTPS testing required for getUserMedia)
**Requirements**: CAM-01, CAM-02, CAM-03, CAM-04, CAM-05
**Success Criteria** (what must be TRUE):
  1. When a player has their camera on, their live video feed displays as a circular avatar above their name in the game table
  2. When a player's camera is off or they have not joined the call, their seat shows the initials circle fallback
  3. Player can toggle mic and camera on/off during gameplay via visible controls
  4. The currently speaking player's avatar shows a visible glow or ring indicator
  5. Video calling works without the old side panel (VideoCallPanel removed, audio still plays)
**Plans**: TBD

Plans:
- [ ] 12-01: TBD
- [ ] 12-02: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 10 -> 11 -> 12

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
| 10. Cloud Deployment | 2/2 | Complete    | 2026-03-13 | - |
| 11. PWA Support | 1/1 | Complete    | 2026-03-13 | - |
| 12. Avatar Cameras | v1.1 | 0/? | Not started | - |

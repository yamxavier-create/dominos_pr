# Requirements: Dominos PR

**Defined:** 2026-03-13
**Core Value:** Friends can start and finish a complete game of Puerto Rican dominoes online, in real time, from any device -- without friction.

## v1.1 Requirements

Requirements for Deploy & Polish milestone. Each maps to roadmap phases.

### Deployment

- [x] **DEPLOY-01**: App is deployed to cloud hosting with HTTPS and permanent URL
- [x] **DEPLOY-02**: App supports custom domain configuration
- [x] **DEPLOY-03**: Push to main branch triggers automatic redeploy

### PWA

- [x] **PWA-01**: User can install the app from browser on phone or desktop
- [x] **PWA-02**: Installed app runs in standalone mode (no browser chrome, with splash screen)
- [x] **PWA-03**: App manifest includes proper icons and metadata for Domino PR branding

### Avatar Cameras

- [ ] **CAM-01**: Player's live video feed displays as a circular avatar above their name (replacing initials)
- [ ] **CAM-02**: Avatar falls back to initials circle when camera is off or not joined
- [ ] **CAM-03**: Player can toggle mic on/off during a game
- [ ] **CAM-04**: Player can toggle camera on/off during a game
- [ ] **CAM-05**: Active speaker shows a visual glow/ring around their avatar

## Future Requirements

### Native App

- **NATIVE-01**: App available on App Store
- **NATIVE-02**: App available on Google Play Store

## Out of Scope

| Feature | Reason |
|---------|--------|
| Persistent accounts / login | In-memory rooms sufficient for casual play |
| Offline gameplay | Real-time multiplayer is core value |
| TURN server (v1.1) | Monitor post-deploy; add only if users report connection failures |
| Persistent chat history | In-memory sufficient for session-based play |
| Spectator mode | Requires seat assignment architecture changes |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| DEPLOY-01 | Phase 10 | Complete |
| DEPLOY-02 | Phase 10 | Complete |
| DEPLOY-03 | Phase 10 | Complete |
| PWA-01 | Phase 11 | Complete |
| PWA-02 | Phase 11 | Complete |
| PWA-03 | Phase 11 | Complete |
| CAM-01 | Phase 12 | Pending |
| CAM-02 | Phase 12 | Pending |
| CAM-03 | Phase 12 | Pending |
| CAM-04 | Phase 12 | Pending |
| CAM-05 | Phase 12 | Pending |

**Coverage:**
- v1.1 requirements: 11 total
- Mapped to phases: 11
- Unmapped: 0

---
*Requirements defined: 2026-03-13*
*Last updated: 2026-03-13 after roadmap creation*

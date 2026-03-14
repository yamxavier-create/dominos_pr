# Requirements: Dominos PR

**Defined:** 2026-03-14
**Core Value:** Friends can start and finish a complete game of Puerto Rican dominoes online, in real time, from any device — without friction.

## v1.2 Requirements

Requirements for Sound & Audio milestone. Each maps to roadmap phases.

### Sound Effects

- [ ] **SFX-01**: User hears a clack sound when any player plays a tile on the board
- [ ] **SFX-02**: User hears a notification sound when it becomes their turn to play
- [ ] **SFX-03**: User hears a distinct sound when a player passes

### Background Music

- [ ] **MUS-01**: User hears lo-fi background music on the menu and lobby screens
- [ ] **MUS-02**: Background music stops when the game starts

### Audio Infrastructure

- [ ] **AUD-01**: Audio uses a shared AudioContext singleton (compatible with existing WebRTC speaking detection)
- [ ] **AUD-02**: Audio handles browser autoplay policy (unlocks on first user interaction)
- [x] **AUD-03**: Audio files are cached by PWA service worker for offline playback

### Audio Controls

- [ ] **CTL-01**: User can toggle SFX on/off independently from music
- [ ] **CTL-02**: User can toggle background music on/off independently from SFX

## Future Requirements

### Extended Sound Effects

- **SFX-04**: User hears a fanfare when a round ends
- **SFX-05**: User hears a distinct fanfare when a game ends
- **SFX-06**: User hears a draw sound when pulling from boneyard (2-player mode)
- **SFX-07**: User hears an accent sound on Capicú or Chuchazo
- **SFX-08**: User hears a ping when a chat message arrives

### Extended Controls

- **CTL-03**: User can adjust SFX volume with a slider
- **CTL-04**: User can adjust music volume with a slider
- **CTL-05**: Audio preferences persist across sessions via localStorage

### Extended Music

- **MUS-03**: Background music fades in/out smoothly on page transitions

## Out of Scope

| Feature | Reason |
|---------|--------|
| Music during gameplay | Conflicts with WebRTC voice chat; creates audio fatigue |
| Spatial audio / 3D positioning | Unnecessary complexity for a 2D board game |
| Multiple music tracks / playlist | Single loop sufficient for lobby; defer to future |
| Sound packs / themes | Over-engineering for current scope |
| iOS silent mode override | Impossible — platform limitation, not a bug |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| AUD-01 | Phase 13 | Pending |
| AUD-02 | Phase 13 | Pending |
| AUD-03 | Phase 13 | Complete |
| SFX-01 | Phase 14 | Pending |
| SFX-02 | Phase 14 | Pending |
| SFX-03 | Phase 14 | Pending |
| MUS-01 | Phase 15 | Pending |
| MUS-02 | Phase 15 | Pending |
| CTL-01 | Phase 15 | Pending |
| CTL-02 | Phase 15 | Pending |

**Coverage:**
- v1.2 requirements: 10 total
- Mapped to phases: 10
- Unmapped: 0

---
*Requirements defined: 2026-03-14*
*Last updated: 2026-03-14 after roadmap creation*

# Requirements: Dominos PR

**Defined:** 2026-03-25
**Core Value:** Friends can start and finish a complete game of Puerto Rican dominoes online, in real time, from any device -- without friction.

## v1.3 Requirements

Requirements for Social & Accounts milestone. Each maps to roadmap phases.

### Authentication

- [x] **AUTH-01**: User can complete Google OAuth login via the existing placeholder button
- [x] **AUTH-02**: User can play as guest without logging in (current behavior preserved)
- [x] **AUTH-03**: Logged-in user's identity persists across browser refresh (JWT + localStorage)

### Profile

- [x] **PROF-01**: User can edit their display name after registration
- [x] **PROF-02**: User's avatar displays from Google account or default placeholder

### Friends

- [x] **FRD-01**: User can search for other users by username
- [x] **FRD-02**: User can send a friend request to another user
- [x] **FRD-03**: User can accept or reject a pending friend request
- [x] **FRD-04**: User can view their friends list with online status
- [x] **FRD-05**: User can unfriend someone from their friends list
- [ ] **FRD-06**: User can send a friend request from the post-game screen

### Presence

- [ ] **PRES-01**: User can see if a friend is online, in a lobby, in a game, or offline
- [ ] **PRES-02**: User receives real-time notification when a friend comes online or enters a lobby
- [ ] **PRES-03**: Presence handles multi-tab correctly (offline only when ALL tabs close)

### Direct Join

- [ ] **JOIN-01**: User can join a friend's lobby directly from the friends list via "Join" button
- [ ] **JOIN-02**: Join button only appears when friend is in a lobby with available seats

## Deferred from v1.2

### Background Music (Phase 15 -- deferred)

- [ ] **MUS-01**: User hears lo-fi background music on the menu and lobby screens
- [ ] **MUS-02**: Background music stops when the game starts
- [ ] **CTL-01**: User can toggle SFX on/off independently from music
- [ ] **CTL-02**: User can toggle background music on/off independently from SFX

## Future Requirements

### Notifications

- **NOTIF-01**: User receives push notification when a friend invites them to play
- **NOTIF-02**: User receives notification for new friend requests when app is backgrounded

### Social

- **SOC-01**: User can invite a friend to their lobby (invitation system)
- **SOC-02**: User can share a lobby link that deep-links into the PWA

### Native App

- **NAT-01**: App published to App Store (iOS)
- **NAT-02**: App published to Google Play (Android)
- **NAT-03**: Native push notifications

## Out of Scope

| Feature | Reason |
|---------|--------|
| Matchmaking / random opponents | Changes social dynamic from friends-and-family to competitive |
| Direct messages / chat between friends | In-game chat exists; out-of-game DMs add complexity without value |
| Leaderboards | Competitive feature, not aligned with casual play core value |
| Block / report system | Not needed until public matchmaking exists |
| Friend count limit | Not critical at current scale |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| AUTH-01 | Phase 16 | Complete |
| AUTH-02 | Phase 16 | Complete |
| AUTH-03 | Phase 16 | Complete |
| PROF-01 | Phase 16 | Complete |
| PROF-02 | Phase 16 | Complete |
| FRD-01 | Phase 17 | Complete |
| FRD-02 | Phase 17 | Complete |
| FRD-03 | Phase 17 | Complete |
| FRD-04 | Phase 17 | Complete |
| FRD-05 | Phase 17 | Complete |
| FRD-06 | Phase 19 | Pending |
| PRES-01 | Phase 18 | Pending |
| PRES-02 | Phase 18 | Pending |
| PRES-03 | Phase 18 | Pending |
| JOIN-01 | Phase 19 | Pending |
| JOIN-02 | Phase 19 | Pending |

**Coverage:**
- v1.3 requirements: 16 total
- Mapped to phases: 16
- Unmapped: 0

---
*Requirements defined: 2026-03-25*
*Last updated: 2026-03-25 after roadmap creation*

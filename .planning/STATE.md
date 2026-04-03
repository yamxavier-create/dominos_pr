---
gsd_state_version: 1.0
milestone: v1.3
milestone_name: Social & Accounts
status: completed
stopped_at: Completed 18-02-PLAN.md (Client Presence Display)
last_updated: "2026-04-03T14:56:11.289Z"
last_activity: 2026-04-03 -- Completed 18-02 (Client Presence Display)
progress:
  total_phases: 4
  completed_phases: 3
  total_plans: 6
  completed_plans: 6
  percent: 100
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-25)

**Core value:** Friends can start and finish a complete game of Puerto Rican dominoes online, in real time, from any device -- without friction.
**Current focus:** v1.3 Social & Accounts -- Phase 18 (Presence)

## Current Position

Phase: 18 of 19 (Presence) -- third phase of v1.3
Plan: 2 of 2 in current phase (Phase 18 complete)
Status: Phase 18 complete
Last activity: 2026-04-03 -- Completed 18-02 (Client Presence Display)

Progress: [██████████] 100%

## Performance Metrics

**Velocity:**
- Total plans completed: 0 (v1.3)
- Average duration: --
- Total execution time: --

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 16-auth-profile | 2/2 | 5min | 2.5min |
| Phase 16-auth-profile P02 | 2min | 2 tasks | 4 files |
| Phase 17-friends-system P01 | 3min | 2 tasks | 4 files |
| Phase 17-friends-system P02 | 5min | 3 tasks | 7 files |
| Phase 18-presence P01 | 3min | 2 tasks | 6 files |
| Phase 18-presence P02 | 3min | 2 tasks | 5 files |

## Accumulated Context

### Decisions

See PROJECT.md Key Decisions table for full log.

- Custom Prisma + PostgreSQL + JWT auth (not Supabase) -- already built on feature/social-v2
- Guest + Login dual mode: guests play as before, login unlocks social features
- Friends use request/accept model (not direct add)
- Join via direct button (not invitation system)
- GoogleLogin component (not useGoogleLogin hook) for ID token flow matching server's verifyGoogleToken()
- Env-gated Google button: returns null without VITE_GOOGLE_CLIENT_ID, preserving guest-only mode
- Display name max 20 chars trimmed server-side; referrerPolicy no-referrer on Google avatar
- ProfileSection replaces old user badge with avatar + editable name + logout button
- [Phase 17-friends-system]: Reject deletes Friendship row (not REJECTED status) -- cleaner, no stale data
- [Phase 17-friends-system]: Reverse PENDING auto-accepts: if A requests B and B requests A, second request auto-accepts
- [Phase 17-friends-system]: Per-user socket room (user:{userId}) joined on connection for real-time social notifications
- [Phase 17-friends-system]: SocialPanel replaces MainMenu view when open (not overlay) -- clean mobile UX
- [Phase 17-friends-system]: socialStore uses getState() in socket listeners to avoid stale closures
- [Phase 17-friends-system]: Default social tab is "friends" (most frequent action), not search
- [Phase 18-presence]: Used room.players (with userId) for game:start presence notifications, not game.players (which omit userId)
- [Phase 18-presence]: presence.removeSocket fires before rooms.leaveRoom to ensure grace timer starts before room state changes
- [Phase 18-presence]: Friend status defaults to 'online' for socket-created objects (requests/acceptances) since those users are actively connected
- [Phase 18-presence]: Toast auto-dismisses after 4s, max 3 visible -- unobtrusive during gameplay

### Research Pitfalls (from research/SUMMARY.md)

- P1: Dual identity -- after login, disconnect + reconnect socket with token (no mid-game login)
- P2: Connection pool exhaustion -- cache auth results, throttle lastSeenAt writes
- P3: Bidirectional friend request race -- check BOTH directions before insert
- P4: Multi-tab presence flicker -- Map<userId, Set<socketId>> + 3-5s grace period
- P5: Direct join privacy -- don't expose room codes; server-validated join

### Pending Todos

None.

### Blockers/Concerns

- v1.2 Phase 15 (Background Music) deferred -- not blocking v1.3

## Session Continuity

Last session: 2026-04-03T14:56:11.278Z
Stopped at: Completed 18-02-PLAN.md (Client Presence Display)
Resume file: None

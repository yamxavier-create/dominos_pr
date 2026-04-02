---
gsd_state_version: 1.0
milestone: v1.3
milestone_name: Social & Accounts
status: completed
stopped_at: Completed 16-02-PLAN.md (Profile & Avatar) -- Phase 16 complete
last_updated: "2026-04-02T22:08:30.396Z"
last_activity: 2026-04-02 -- Completed 16-02 (Profile & Avatar)
progress:
  total_phases: 4
  completed_phases: 1
  total_plans: 2
  completed_plans: 2
  percent: 100
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-25)

**Core value:** Friends can start and finish a complete game of Puerto Rican dominoes online, in real time, from any device -- without friction.
**Current focus:** v1.3 Social & Accounts -- Phase 16 (Auth & Profile) COMPLETE

## Current Position

Phase: 16 of 19 (Auth & Profile) -- first phase of v1.3
Plan: 2 of 2 in current phase (PHASE COMPLETE)
Status: Phase 16 complete, ready for Phase 17
Last activity: 2026-04-02 -- Completed 16-02 (Profile & Avatar)

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

Last session: 2026-04-02T22:08:28.947Z
Stopped at: Completed 16-02-PLAN.md (Profile & Avatar) -- Phase 16 complete
Resume file: None

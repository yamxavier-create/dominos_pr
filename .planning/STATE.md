---
gsd_state_version: 1.0
milestone: v1.3
milestone_name: Social & Accounts
status: executing
stopped_at: Completed 16-01-PLAN.md
last_updated: "2026-04-02"
last_activity: 2026-04-02 -- Executed 16-01 (Google OAuth client wiring)
progress:
  total_phases: 4
  completed_phases: 0
  total_plans: 8
  completed_plans: 1
  percent: 12
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-25)

**Core value:** Friends can start and finish a complete game of Puerto Rican dominoes online, in real time, from any device -- without friction.
**Current focus:** v1.3 Social & Accounts -- Phase 16 (Auth & Profile) ready to plan

## Current Position

Phase: 16 of 19 (Auth & Profile) -- first phase of v1.3
Plan: 1 of 2 in current phase
Status: Executing
Last activity: 2026-04-02 -- Completed 16-01 (Google OAuth client wiring)

Progress: [█░░░░░░░░░] 12%

## Performance Metrics

**Velocity:**
- Total plans completed: 0 (v1.3)
- Average duration: --
- Total execution time: --

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 16-auth-profile | 1/2 | 3min | 3min |

## Accumulated Context

### Decisions

See PROJECT.md Key Decisions table for full log.

- Custom Prisma + PostgreSQL + JWT auth (not Supabase) -- already built on feature/social-v2
- Guest + Login dual mode: guests play as before, login unlocks social features
- Friends use request/accept model (not direct add)
- Join via direct button (not invitation system)
- GoogleLogin component (not useGoogleLogin hook) for ID token flow matching server's verifyGoogleToken()
- Env-gated Google button: returns null without VITE_GOOGLE_CLIENT_ID, preserving guest-only mode

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

Last session: 2026-04-02
Stopped at: Completed 16-01-PLAN.md (Google OAuth client wiring)
Resume file: .planning/phases/16-auth-profile/16-01-SUMMARY.md

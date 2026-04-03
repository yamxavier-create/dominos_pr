---
phase: 17-friends-system
plan: 01
subsystem: api
tags: [socket.io, prisma, express, friends, social, real-time]

# Dependency graph
requires:
  - phase: 16-auth-profile
    provides: JWT auth, User model, authMiddleware, getSocketUser
provides:
  - REST endpoints for user search, friends list, pending requests
  - Socket event handlers for friend_request, friend_accept, friend_reject, friend_remove
  - Per-user Socket.io room (user:{userId}) for real-time notifications
  - Bidirectional friend request race prevention
affects: [17-friends-system plan 02 (client UI)]

# Tech tracking
tech-stack:
  added: []
  patterns: [per-user socket room for notifications, bidirectional friendship queries, inline requireAuth helper]

key-files:
  created:
    - server/src/social/socialRoutes.ts
    - server/src/social/socialHandlers.ts
  modified:
    - server/src/socket/handlers.ts
    - server/src/index.ts

key-decisions:
  - "Reject deletes Friendship row instead of setting REJECTED status -- cleaner, no stale data"
  - "Reverse PENDING request auto-accepts instead of creating duplicate -- handles race condition elegantly"
  - "requireAuth is inline helper (not middleware) matching existing authRoutes pattern"
  - "Per-user room joined on connection, not on-demand -- always available for notifications"

patterns-established:
  - "Social handler pattern: registerSocialHandlers(socket, io) without rooms parameter"
  - "Per-user notification: io.to(`user:${userId}`).emit for real-time social events"
  - "Friendship annotation on search: friendshipStatus + friendshipDirection per result"

requirements-completed: [FRD-01, FRD-02, FRD-03, FRD-04, FRD-05]

# Metrics
duration: 3min
completed: 2026-04-03
---

# Phase 17 Plan 01: Server Friends System Summary

**Complete server-side friends CRUD with 3 REST endpoints, 4 socket handlers, bidirectional race prevention, rate limiting, and per-user real-time notifications**

## Performance

- **Duration:** 3 min
- **Started:** 2026-04-03T04:04:50Z
- **Completed:** 2026-04-03T04:08:10Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Three REST endpoints (search, friends, requests) with JWT auth and bidirectional queries
- Four socket event handlers (friend_request, accept, reject, remove) with auth guards
- Bidirectional race prevention: checks both directions before creating friendship, auto-accepts reverse PENDING
- Rate limiting: max 20 pending outgoing requests per user
- Per-user Socket.io room (`user:{userId}`) for real-time notification delivery

## Task Commits

Each task was committed atomically:

1. **Task 1: Create socialRoutes.ts with REST endpoints** - `001c9f9` (feat)
2. **Task 2: Create socialHandlers.ts, wire into handlers.ts and index.ts** - `1c84c13` (feat)

## Files Created/Modified
- `server/src/social/socialRoutes.ts` - REST endpoints: GET /search, GET /friends, GET /requests with JWT auth
- `server/src/social/socialHandlers.ts` - Socket handlers: friend_request, friend_accept, friend_reject, friend_remove
- `server/src/socket/handlers.ts` - Added registerSocialHandlers import and call
- `server/src/index.ts` - Mounted /api/social routes, added per-user socket room join on connection

## Decisions Made
- Reject deletes Friendship row instead of setting REJECTED status -- avoids accumulating stale rows
- Reverse PENDING request auto-accepts -- when A requests B and B requests A, the second request auto-accepts
- requireAuth is inline helper function (not Express middleware) matching existing authRoutes pattern
- Per-user room joined immediately on authenticated connection, always available for social notifications

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Server-side friends system fully operational, ready for client UI consumption (Plan 17-02)
- All socket events emit structured payloads with user data (id, username, displayName, avatarUrl)
- REST endpoints return annotated search results and categorized requests (incoming/outgoing)

## Self-Check: PASSED

All files verified present. All commits verified in git log.

---
*Phase: 17-friends-system*
*Completed: 2026-04-03*

---
phase: 19-social-integration
plan: 01
subsystem: social
tags: [socket.io, presence, friends, direct-join, privacy]

# Dependency graph
requires:
  - phase: 18-presence
    provides: PresenceManager with broadcastStatusToFriends and getStatus
  - phase: 17-friends-system
    provides: Friendship model, socialHandlers, socialRoutes, FriendsList component
provides:
  - social:join_friend socket handler for privacy-safe direct join
  - canJoin boolean replacing roomCode in all friend data paths
  - Real-time canJoin updates via presence broadcasts
affects: [19-social-integration]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Privacy-safe join: server resolves roomCode internally, never exposed to client"
    - "canJoin boolean pattern: computed server-side from room status + player count"

key-files:
  created: []
  modified:
    - server/src/social/socialHandlers.ts
    - server/src/social/socialRoutes.ts
    - server/src/presence/PresenceManager.ts
    - server/src/socket/handlers.ts
    - client/src/store/socialStore.ts
    - client/src/components/social/FriendsList.tsx
    - client/src/hooks/useSocket.ts

key-decisions:
  - "canJoin boolean replaces roomCode in all friend data paths -- room codes never leave the server"
  - "social:join_friend auto-leaves current waiting lobby before joining friend's room"
  - "In-game users get error instead of auto-leave when trying to join a friend"
  - "Presence broadcasts notify all room players on join so their friends see updated canJoin"

patterns-established:
  - "Privacy-safe join: client sends friendUserId, server resolves room internally"
  - "canJoin computed at three points: GET /friends, presence broadcasts, join_friend handler"

requirements-completed: [JOIN-01, JOIN-02]

# Metrics
duration: 3min
completed: 2026-04-03
---

# Phase 19 Plan 01: Direct Join from Friends List Summary

**Privacy-safe direct join via social:join_friend -- canJoin boolean replaces roomCode in REST, presence broadcasts, and client store**

## Performance

- **Duration:** 3 min
- **Started:** 2026-04-03T20:39:49Z
- **Completed:** 2026-04-03T20:43:29Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- Server-side social:join_friend handler with friendship verification, auto-leave lobby guard, in-game block, and standard room:joined flow
- Room codes completely removed from friend data -- replaced with canJoin boolean in GET /friends REST endpoint and presence:friend_status_changed broadcasts
- Client FriendsList emits social:join_friend with friendUserId instead of directly using room codes, with real-time canJoin updates from presence events

## Task Commits

Each task was committed atomically:

1. **Task 1: Server-side direct join handler + canJoin in presence broadcasts and REST** - `012da5b` (feat)
2. **Task 2: Client-side direct join -- socialStore canJoin, FriendsList socket join, useSocket listener** - `baa0f00` (feat)

## Files Created/Modified
- `server/src/social/socialHandlers.ts` - Added social:join_friend handler with friendship check, auto-leave, room resolution, join flow
- `server/src/social/socialRoutes.ts` - GET /friends returns canJoin boolean instead of roomCode
- `server/src/presence/PresenceManager.ts` - broadcastStatusToFriends emits canJoin in presence:friend_status_changed
- `server/src/socket/handlers.ts` - Passes presence to registerSocialHandlers
- `client/src/store/socialStore.ts` - Friend interface uses canJoin instead of roomCode, updateFriendStatus accepts canJoin param
- `client/src/components/social/FriendsList.tsx` - Uses canJoin for button visibility, emits social:join_friend instead of joinRoom
- `client/src/hooks/useSocket.ts` - Forwards canJoin from presence events to socialStore

## Decisions Made
- canJoin boolean replaces roomCode in all friend data paths -- room codes never leave the server for privacy
- social:join_friend auto-leaves current waiting lobby before joining friend's room (no manual leave required)
- In-game users receive an error message instead of auto-leave when trying to join a friend
- All room players get presence notifications on join so their friends see updated canJoin values

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Direct join flow complete and ready for integration testing
- Plan 19-02 can proceed with game invite toast and remaining social integration features

## Self-Check: PASSED

All 7 modified files verified present. Both task commits (012da5b, baa0f00) verified in git log.

---
*Phase: 19-social-integration*
*Completed: 2026-04-03*

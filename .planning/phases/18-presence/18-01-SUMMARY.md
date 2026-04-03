---
phase: 18-presence
plan: 01
subsystem: api
tags: [socket.io, presence, real-time, prisma]

requires:
  - phase: 17-friends-system
    provides: Friendship model, per-user socket rooms, socialRoutes with RoomManager ref
provides:
  - PresenceManager singleton class with multi-tab socket tracking
  - Grace period (5s) to prevent offline flicker
  - Status derivation from RoomManager (online/in_lobby/in_game/offline)
  - Real-time friend status broadcast via Socket.IO rooms
  - GET /friends extended with status field
  - Events -- presence:friend_status_changed, presence:friend_online, presence:friend_in_lobby
affects: [18-02-client-presence]

tech-stack:
  added: []
  patterns: [presence-manager-singleton, grace-period-disconnect, status-derivation-from-room-state]

key-files:
  created:
    - server/src/presence/PresenceManager.ts
  modified:
    - server/src/index.ts
    - server/src/social/socialRoutes.ts
    - server/src/socket/handlers.ts
    - server/src/socket/roomHandlers.ts
    - server/src/socket/gameHandlers.ts

key-decisions:
  - "Used room.players (which have userId) for game:start presence notifications instead of game.players (which may lack userId)"
  - "Presence removeSocket fires before rooms.leaveRoom in disconnect handler to ensure correct ordering"

patterns-established:
  - "PresenceManager pattern: constructor(io, rooms), injected into handler chain"
  - "setPresenceManager pattern: module-level ref setter for REST route access (same as setRoomManager)"

requirements-completed: [PRES-01, PRES-03]

duration: 3min
completed: 2026-04-03
---

# Phase 18 Plan 01: Server Presence Manager Summary

**In-memory PresenceManager with multi-tab socket tracking, 5s grace period, RoomManager-derived status, and real-time friend broadcast via Socket.IO**

## Performance

- **Duration:** 3 min
- **Started:** 2026-04-03T14:44:18Z
- **Completed:** 2026-04-03T14:48:11Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- PresenceManager class with Map<userId, Set<socketId>> for multi-tab tracking and 5s grace period
- Full integration into socket connect/disconnect lifecycle, room create/join/leave, and game:start
- GET /api/social/friends now returns status field (online/in_lobby/in_game/offline) per friend
- Guest sockets correctly excluded from presence system

## Task Commits

Each task was committed atomically:

1. **Task 1: Create PresenceManager class** - `20ca558` (feat)
2. **Task 2: Integrate PresenceManager into server socket lifecycle and room/game events** - `74fda5c` (feat)

## Files Created/Modified
- `server/src/presence/PresenceManager.ts` - Presence tracking singleton with socket maps, grace timers, status derivation, friend broadcast
- `server/src/index.ts` - PresenceManager instantiation, socket connect/disconnect hooks
- `server/src/social/socialRoutes.ts` - presenceRef + setPresenceManager, GET /friends extended with status
- `server/src/socket/handlers.ts` - Updated signature to pass presence to room/game handlers
- `server/src/socket/roomHandlers.ts` - Presence notifications on room create/join/leave
- `server/src/socket/gameHandlers.ts` - Presence notifications on game:start for all players

## Decisions Made
- Used `room.players` (which carry userId) for game:start presence notifications rather than `game.players` (which omit userId in the mapping)
- Presence removeSocket fires before rooms.leaveRoom in the disconnect handler to ensure the grace timer starts before room state changes

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Server presence infrastructure complete, ready for Plan 02 (client-side presence display)
- All three presence events emitted: friend_status_changed, friend_online, friend_in_lobby
- GET /friends already returns status for initial load

## Self-Check: PASSED

All files exist. All commits verified.

---
*Phase: 18-presence*
*Completed: 2026-04-03*

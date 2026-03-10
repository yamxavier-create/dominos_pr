---
phase: 05-video-audio-call-players-can-see-and-talk-to-each-other-in-real-time-via-webrtc-while-playing
plan: "01"
subsystem: ui
tags: [webrtc, zustand, socket.io, typescript]

requires: []
provides:
  - Zustand callStore with typed call state (streams, peer states, mute/cam)
  - Server-side webrtcHandlers relay for signal, toggle, and lobby_opt events
  - handlers.ts updated to register WebRTC handlers alongside game/room/chat
affects:
  - 05-02 (useWebRTC hook builds on callStore)
  - 05-03 (VideoTile component uses callStore remoteStreams)
  - 05-04 (Lobby opt-in UI reads lobbyOpts from callStore)

tech-stack:
  added: []
  patterns:
    - "callStore follows existing Zustand store pattern (create<Store>()((set) => ({...})))"
    - "Server relay handlers use room.game.players to map socketId to playerIndex"
    - "RTCSessionDescriptionInit/RTCIceCandidateInit typed as unknown on server (no browser types)"

key-files:
  created:
    - client/src/store/callStore.ts
    - server/src/socket/webrtcHandlers.ts
  modified:
    - server/src/socket/handlers.ts

key-decisions:
  - "RTCSessionDescriptionInit typed as unknown on server — server never interprets SDP/ICE, avoids browser DOM type dependency"
  - "webrtc:lobby_opt uses room.players (RoomPlayer[]) not room.game.players since lobby opt fires before game starts"

patterns-established:
  - "WebRTC signaling: server reads from/to playerIndex from room.game.players, forwards payload opaquely"
  - "Lobby opt broadcasts use room.players.seatIndex as playerIndex (pre-game)"

requirements-completed:
  - CALL-01
  - CALL-05

duration: 4min
completed: 2026-03-10
---

# Phase 05 Plan 01: WebRTC Foundation — Call Store and Signaling Relay Summary

**Typed Zustand call state store and Socket.io signaling relay for WebRTC peer connections — zero browser MediaStream logic on server**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-10T20:53:27Z
- **Completed:** 2026-03-10T20:57:00Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Created callStore.ts with full typed state for local/remote streams, peer connection states, mute/camera toggles, and lobby opt-ins
- Created webrtcHandlers.ts that relays webrtc:signal, webrtc:toggle, and webrtc:lobby_opt without interpreting SDP or ICE payloads
- Updated handlers.ts to register WebRTC handlers in the existing chain

## Task Commits

1. **Task 1: Create callStore (Zustand)** - `f5f33f7` (feat)
2. **Task 2: Create webrtcHandlers.ts and register in handlers.ts** - `f1ba8f0` (feat)

## Files Created/Modified
- `client/src/store/callStore.ts` - Zustand store for all WebRTC call state (streams, peer states, mute/cam, lobby opts)
- `server/src/socket/webrtcHandlers.ts` - Pure relay handlers for WebRTC signaling events
- `server/src/socket/handlers.ts` - Added import and call to registerWebRTCHandlers

## Decisions Made
- Used `unknown` type for `desc` and `candidate` fields in webrtcHandlers — server never interprets SDP/ICE content, and Node.js has no browser WebRTC DOM types
- webrtc:lobby_opt uses `room.players` (RoomPlayer array) with `seatIndex` as the player identifier since lobby opt fires before the game starts and `room.game` may be null

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] RTCSessionDescriptionInit/RTCIceCandidateInit not available in Node.js**
- **Found during:** Task 2 (webrtcHandlers TypeScript compile)
- **Issue:** Plan used browser WebRTC types that don't exist in Node.js tsconfig
- **Fix:** Changed `desc` and `candidate` parameter types to `unknown` — server relays opaquely, no interpretation needed
- **Files modified:** server/src/socket/webrtcHandlers.ts
- **Verification:** `server/npx tsc --noEmit` passes clean
- **Committed in:** f1ba8f0

---

**Total deviations:** 1 auto-fixed (type correction)
**Impact on plan:** Fix is semantically correct — server is a pure relay and should not depend on browser-specific types.

## Issues Encountered
None beyond the auto-fixed type issue above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- callStore exports all types needed by useWebRTC (plan 02) and VideoTile (plan 03)
- Server relay is live and ready to forward signals once peer connections are initiated
- Plan 02 can start immediately — useWebRTC hook reads/writes callStore and emits webrtc:signal

---
*Phase: 05-video-audio-call*
*Completed: 2026-03-10*

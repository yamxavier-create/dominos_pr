---
phase: 05-video-audio-call-players-can-see-and-talk-to-each-other-in-real-time-via-webrtc-while-playing
plan: "03"
subsystem: ui
tags: [webrtc, rtcpeerconnection, perfect-negotiation, socket.io, react]

requires:
  - phase: 05-01
    provides: callStore, webrtcHandlers server signaling relay
  - phase: 05-02
    provides: lobby opt-in UI, webrtc:lobby_updated socket event

provides:
  - useWebRTC hook with full RTCPeerConnection lifecycle (getUserMedia, offer/answer, ICE, cleanup)
  - signalHandlerRef module-level export for cross-hook signal routing
  - webrtc:signal and webrtc:peer_toggle routed in useSocket

affects:
  - 05-04 (VideoGrid/VideoTile reads remoteStreams from callStore which useWebRTC populates)

tech-stack:
  added: []
  patterns:
    - Perfect Negotiation pattern for WebRTC glare prevention (polite = myPlayerIndex > remoteIndex)
    - Module-level ref (signalHandlerRef) for routing socket events to hook instance without prop drilling

key-files:
  created:
    - client/src/hooks/useWebRTC.ts
  modified:
    - client/src/hooks/useSocket.ts

key-decisions:
  - "signalHandlerRef is a module-level exported ref so useSocket can call the useWebRTC instance without prop drilling or context"
  - "polite peer = higher player index; lower index = impolite (initiates offer on negotiationneeded)"
  - "15-second ICE timeout marks peer as failed if still connecting/checking"

patterns-established:
  - "Module-level signal handler ref pattern for cross-hook communication"
  - "getCallStore() helper calls useCallStore.getState() to avoid stale closure captures"

requirements-completed: [CALL-02, CALL-03]

duration: 5min
completed: 2026-03-10
---

# Phase 05 Plan 03: useWebRTC Hook Summary

**RTCPeerConnection mesh lifecycle hook with Perfect Negotiation pattern wired to existing Socket.io signaling relay**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-10T21:00:00Z
- **Completed:** 2026-03-10T21:05:00Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Created useWebRTC hook managing getUserMedia, peer connection creation, ICE, and cleanup for 4-player mesh
- Implemented Perfect Negotiation pattern to prevent offer glare when both peers connect simultaneously
- Wired webrtc:signal routing from useSocket to signalHandlerRef and webrtc:peer_toggle to callStore

## Task Commits

1. **Task 1: Create useWebRTC hook** - `89dae5e` (feat)
2. **Task 2: Wire webrtc:signal and webrtc:peer_toggle in useSocket** - `5850bee` (feat)

## Files Created/Modified
- `client/src/hooks/useWebRTC.ts` - Full RTCPeerConnection lifecycle; exports useWebRTC and signalHandlerRef
- `client/src/hooks/useSocket.ts` - Added webrtc:signal routing and webrtc:peer_toggle handler

## Decisions Made
- signalHandlerRef module-level export avoids prop drilling between useSocket and useWebRTC
- polite peer determined by higher playerIndex (impolite = initiator = lower index)
- 15-second connection timeout to detect ICE failures and update peerStates

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- useWebRTC hook is complete and ready to be mounted in the game route (Plan 04)
- callStore.remoteStreams will be populated once useWebRTC is mounted and peers connect
- VideoTile/VideoGrid (Plan 04) can read remoteStreams directly from callStore

---
*Phase: 05-video-audio-call-players-can-see-and-talk-to-each-other-in-real-time-via-webrtc-while-playing*
*Completed: 2026-03-10*

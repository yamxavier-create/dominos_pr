---
phase: 05-video-audio-call-players-can-see-and-talk-to-each-other-in-real-time-via-webrtc-while-playing
plan: "02"
subsystem: ui
tags: [react, webrtc, socket.io, zustand, lobby]

requires:
  - phase: 05-01
    provides: callStore with LobbyOpt type, setMyLobbyOpt, setPeerLobbyOpt actions

provides:
  - Per-player camera/mic toggle icons in lobby UI (RoomLobby.tsx)
  - webrtc:lobby_updated socket event handler in useSocket.ts that syncs peer opts to callStore

affects: [05-03-webrtc-peer-connections, any phase reading callStore.lobbyOpts]

tech-stack:
  added: []
  patterns:
    - "SVG inline icons for mic/camera with gold active state and 30% opacity inactive"
    - "e.stopPropagation() on icon buttons inside clickable seat cards"
    - "useCallStore.getState().action() for Zustand mutations inside socket handlers"

key-files:
  created: []
  modified:
    - client/src/components/lobby/RoomLobby.tsx
    - client/src/hooks/useSocket.ts

key-decisions:
  - "Mic/camera icons placed inside existing player row after name, before status dot — no layout breaks"
  - "Own icons use <button> with e.stopPropagation() to prevent seat-swap selection logic from firing"
  - "Read-only indicators for peers rendered as plain SVG (no button wrapper)"

patterns-established:
  - "Per-player icon toggles: clickable for self, read-only for others using isMe guard"

requirements-completed: [CALL-01]

duration: 5min
completed: 2026-03-10
---

# Phase 05 Plan 02: Lobby Camera/Mic Opt-In UI Summary

**Per-player SVG mic and camera icons in lobby with real-time broadcast via webrtc:lobby_opt socket event and incoming sync through webrtc:lobby_updated handler**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-03-10T21:00:00Z
- **Completed:** 2026-03-10T21:05:00Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Added mic and camera SVG toggle icons to every occupied player slot in RoomLobby.tsx
- Local player icons are clickable buttons that emit webrtc:lobby_opt and update callStore
- Other players' icons are read-only indicators showing their opt-in status from callStore.lobbyOpts
- Wired webrtc:lobby_updated in useSocket.ts to call setPeerLobbyOpt for real-time peer state sync

## Task Commits

1. **Task 1: Add lobby opt-in toggles to RoomLobby.tsx** - `ed8cf21` (feat)
2. **Task 2: Wire webrtc:lobby_updated in useSocket.ts** - `b4be0e4` (feat)

## Files Created/Modified

- `client/src/components/lobby/RoomLobby.tsx` - Added callStore imports, toggle handlers, and SVG icon buttons per player slot
- `client/src/hooks/useSocket.ts` - Added callStore import and webrtc:lobby_updated handler with cleanup

## Decisions Made

- SVG icons rendered inline with gold (#F5C518) when active, rgba(255,255,255,0.3) when inactive
- A diagonal slash line is drawn on inactive icons as a visual cross-out indicator
- Own player buttons use e.stopPropagation() to avoid triggering the host seat-swap click handler

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- callStore.lobbyOpts is populated in real time as players toggle preferences
- Ready for Phase 05-03 to read lobbyOpts and initiate WebRTC peer connections accordingly

---
*Phase: 05-video-audio-call-players-can-see-and-talk-to-each-other-in-real-time-via-webrtc-while-playing*
*Completed: 2026-03-10*

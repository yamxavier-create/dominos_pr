---
phase: 09-camera-and-microphone-for-2-player-duo-mode
plan: 01
subsystem: ui
tags: [webrtc, react, peer-connection, duo-mode]

requires:
  - phase: 05-video-audio-call
    provides: WebRTC peer connection infrastructure (useWebRTC, VideoCallPanel)
  - phase: 07-two-player-mode
    provides: playerCount field on ClientGameState
provides:
  - Dynamic player-count-aware WebRTC peer connections (2 or 4 players)
  - Dynamic video tile rendering based on actual player count
affects: []

tech-stack:
  added: []
  patterns: [gameStore.getState().gameState?.playerCount for runtime player count detection]

key-files:
  created: []
  modified:
    - client/src/hooks/useWebRTC.ts
    - client/src/components/game/VideoCallPanel.tsx

key-decisions:
  - "useWebRTC reads playerCount from gameStore with ?? 4 fallback for backward compatibility"
  - "VideoCallPanel derives playerCount from players.filter(Boolean).length -- no new imports needed"

patterns-established:
  - "WebRTC loops use dynamic playerCount instead of hardcoded 4"

requirements-completed: [DUO-CAM-01, DUO-CAM-02, DUO-CAM-03]

duration: 1min
completed: 2026-03-13
---

# Phase 9 Plan 1: Camera/Mic Duo Mode Summary

**WebRTC peer connections and video tiles dynamically sized by playerCount -- 2-player mode creates 1 connection instead of 3**

## Performance

- **Duration:** 1 min
- **Started:** 2026-03-13T01:23:18Z
- **Completed:** 2026-03-13T01:24:35Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Replaced all hardcoded `i < 4` loops in useWebRTC.ts with dynamic playerCount from gameStore
- Replaced hardcoded 4-element orderedIndices in VideoCallPanel.tsx with dynamic Array.from
- Zero phantom peer connections in 2-player mode; 4-player mode behavior unchanged

## Task Commits

Each task was committed atomically:

1. **Task 1: Make useWebRTC.ts player-count-aware** - `b7ea335` (feat)
2. **Task 2: Make VideoCallPanel.tsx player-count-aware** - `ad649b4` (feat)

## Files Created/Modified
- `client/src/hooks/useWebRTC.ts` - Added useGameStore import; joinCall and init loops use dynamic playerCount
- `client/src/components/game/VideoCallPanel.tsx` - orderedIndices computed from players.filter(Boolean).length

## Decisions Made
- useWebRTC reads playerCount via `useGameStore.getState().gameState?.playerCount ?? 4` -- defaults to 4 if gameState not yet loaded
- VideoCallPanel derives playerCount from `players.filter(Boolean).length || 4` -- uses existing prop, no new store imports

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- WebRTC video/audio calls now work correctly in both 2-player and 4-player modes
- No further camera/mic plans remain in phase 9

---
*Phase: 09-camera-and-microphone-for-2-player-duo-mode*
*Completed: 2026-03-13*

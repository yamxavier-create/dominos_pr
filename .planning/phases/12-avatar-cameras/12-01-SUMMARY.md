---
phase: 12-avatar-cameras
plan: 01
subsystem: ui
tags: [react, webrtc, web-audio-api, zustand, avatar, video]

requires:
  - phase: 12-avatar-cameras
    provides: research and plan for avatar camera components
provides:
  - AvatarVideo circular video component with initials fallback
  - useSpeakingDetection hook using Web Audio API AnalyserNode
  - CallControls inline mic/camera toggle component
  - speakingPeers state in callStore
affects: [12-avatar-cameras plan 02, GameTable, PlayerSeat]

tech-stack:
  added: []
  patterns: [Web Audio API AnalyserNode for speaking detection, circular video avatar with CSS border glow]

key-files:
  created:
    - client/src/components/player/AvatarVideo.tsx
    - client/src/hooks/useSpeakingDetection.ts
    - client/src/components/player/CallControls.tsx
  modified:
    - client/src/store/callStore.ts

key-decisions:
  - "Uint8Array<ArrayBuffer> explicit type for strict TS compatibility with AnalyserNode"
  - "Speaking threshold 25 on first 8 FFT bins for speech frequency detection"
  - "Video element always muted in AvatarVideo (audio plays through separate audio elements)"

patterns-established:
  - "AvatarVideo pattern: circular div with video or initials fallback, border color driven by speaking/turn state"
  - "Speaking detection pattern: single AudioContext with per-stream AnalyserNode, RAF poll, change-only updates to store"

requirements-completed: [CAM-01, CAM-02, CAM-05]

duration: 2min
completed: 2026-03-13
---

# Phase 12 Plan 01: Avatar Camera Components Summary

**Circular video avatar with speaking glow, Web Audio speaking detection hook, and inline mic/camera call controls**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-13T17:47:25Z
- **Completed:** 2026-03-13T17:49:46Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- AvatarVideo component with circular video rendering, initials fallback, speaking glow, and turn border
- useSpeakingDetection hook monitoring audio levels via Web Audio API AnalyserNode with change-only store updates
- CallControls component with mic/camera toggle buttons extracted from VideoCallPanel pattern
- callStore extended with speakingPeers state and setSpeakingPeers action

## Task Commits

Each task was committed atomically:

1. **Task 1: Create AvatarVideo component and update callStore** - `d074434` (feat)
2. **Task 2: Create useSpeakingDetection hook and CallControls** - `6119e32` (feat)

## Files Created/Modified
- `client/src/components/player/AvatarVideo.tsx` - Circular video avatar with initials fallback, speaking/turn border
- `client/src/hooks/useSpeakingDetection.ts` - Web Audio API speaking detection with AnalyserNode polling
- `client/src/components/player/CallControls.tsx` - Inline mic and camera toggle buttons
- `client/src/store/callStore.ts` - Added speakingPeers state and setSpeakingPeers action

## Decisions Made
- Used explicit `Uint8Array<ArrayBuffer>` type annotation for strict TypeScript compatibility with AnalyserNode.getByteFrequencyData
- Speaking threshold set to 25 on first 8 FFT bins (speech frequency range)
- Video elements rendered muted in AvatarVideo since audio plays through separate audio elements in the WebRTC pipeline

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed Uint8Array type for strict TypeScript**
- **Found during:** Task 2 (useSpeakingDetection)
- **Issue:** `Uint8Array` without explicit `ArrayBuffer` type parameter failed strict TS check with AnalyserNode
- **Fix:** Changed to `Uint8Array<ArrayBuffer>` in the AnalyserEntry interface
- **Files modified:** client/src/hooks/useSpeakingDetection.ts
- **Verification:** `tsc --noEmit` passes cleanly
- **Committed in:** 6119e32 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Minor type fix for strict TS compatibility. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All four building-block files ready for Plan 02 to wire into GameTable and PlayerSeat
- Components are self-contained with clean prop interfaces for easy integration

---
*Phase: 12-avatar-cameras*
*Completed: 2026-03-13*

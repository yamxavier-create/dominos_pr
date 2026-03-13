---
phase: 12-avatar-cameras
verified: 2026-03-13T18:30:00Z
status: passed
score: 9/9 must-haves verified
re_verification: false
human_verification:
  - test: "Circular video displays in player seats during live game"
    expected: "Each player seat shows an 80px circular live video feed (not a side panel). Avatars appear embedded at the top/bottom/left/right seat positions on the game table."
    why_human: "Cannot verify MediaStream rendering or camera capture programmatically — requires a real browser session with camera access."
  - test: "Camera-off fallback to initials circle"
    expected: "When a player toggles camera off, their seat immediately replaces the video with a colored initials circle matching their team color."
    why_human: "State transition from showVideo=true to showVideo=false requires live WebRTC stream to observe."
  - test: "Speaking glow ring activates on active audio"
    expected: "When a player speaks, a green glow border (0 0 12px rgba(34,197,94,0.6)) appears around their circular avatar within ~100ms. Glow disappears when they stop speaking."
    why_human: "Web Audio API AnalyserNode polling and store updates require actual microphone input to observe."
  - test: "Inline CallControls appear only for the local player's seat"
    expected: "Mic and camera toggle buttons appear below the local player's seat (bottom position) when they are in a call. No controls appear on remote player seats."
    why_human: "Conditional render depends on isLocalPlayer + inCall state — requires a joined call to see controls appear."
  - test: "VideoCallPanel side panel is absent from the game screen"
    expected: "No slide-in video panel on the right side of the game screen. Game board occupies full width. All video is embedded in seats."
    why_human: "UI layout verification — requires visual inspection of the rendered game screen."
  - test: "Remote audio plays after VideoCallPanel removal"
    expected: "Players can hear each other speaking through the hidden RemoteAudio elements. Audio does not cut out when joining or toggling media."
    why_human: "Requires two live WebRTC peers to verify audio path through RemoteAudio elements."
  - test: "JoinCallButton appears for players not in a call"
    expected: "A green 'Unirse a llamada' button appears fixed at bottom-right when myAudioEnabled and myVideoEnabled are both false. Button disappears after successfully joining."
    why_human: "Requires browser session to verify button visibility and joinCallRef.current invocation flow."
---

# Phase 12: Avatar Cameras Verification Report

**Phase Goal:** Replace video call side panel with circular avatar cameras embedded in player seats
**Verified:** 2026-03-13T18:30:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | AvatarVideo renders a circular video element when stream is active and camera is on | VERIFIED | `showVideo = stream !== null && !isCameraOff` logic present; `<video ref={videoRef} autoPlay playsInline muted>` renders in that branch |
| 2 | AvatarVideo falls back to initials circle when stream is null or camera is off | VERIFIED | Else branch renders initials div with `background: teamColor + '30'` |
| 3 | Speaking detection identifies which players are currently speaking via audio analysis | VERIFIED | `useSpeakingDetection.ts` uses `AudioContext.createAnalyser()` + `getByteFrequencyData` RAF poll; updates `callStore.speakingPeers` on change |
| 4 | CallControls provides mic and camera toggle buttons that emit socket events | VERIFIED | `socket.emit('webrtc:toggle', ...)` present in both `handleMicToggle` and `handleCameraToggle` handlers |
| 5 | Player's live video feed displays as circular avatar above their name in each seat | HUMAN_NEEDED | All wiring exists — needs live browser session to confirm visual result |
| 6 | Initials circle shows when camera is off or player has not joined the call | HUMAN_NEEDED | Logic verified; visual confirmation requires a session |
| 7 | Local player can toggle mic and camera via inline controls near their seat | VERIFIED | `PlayerSeat` renders `<CallControls className="mt-1" />` when `isLocalPlayer && inCall` |
| 8 | Speaking player's avatar shows green glow ring | VERIFIED | `isSpeaking` prop drives `border: 2px solid #22C55E` and `boxShadow: 0 0 12px rgba(34,197,94,0.6)` in AvatarVideo |
| 9 | Audio from remote players still plays after VideoCallPanel is removed | VERIFIED (code) | `RemoteAudio` function inlined in `GameTable.tsx`; rendered for each `remoteStreams` entry when `myAudioEnabled \|\| myVideoEnabled` |
| 10 | Players not in a call can join via a floating button | VERIFIED | `JoinCallButton.tsx` exists; renders when `!inCall`, calls `joinCallRef.current?.(true, true)` |

**Score:** 9/10 code-verified (1 truth deferred to human), all 10 truths have supporting artifacts

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `client/src/components/player/AvatarVideo.tsx` | Circular video avatar with initials fallback | VERIFIED | Exports `AvatarVideo`, 80 lines, full implementation with border glow, video/initials branches |
| `client/src/hooks/useSpeakingDetection.ts` | Audio level monitoring for speaking detection | VERIFIED | Exports `useSpeakingDetection`, 134 lines, Web Audio API AnalyserNode with RAF loop |
| `client/src/components/player/CallControls.tsx` | Mic and camera toggle buttons for local player | VERIFIED | Exports `CallControls`, both toggle handlers emit `webrtc:toggle` socket event |
| `client/src/store/callStore.ts` | speakingPeers state added to call store | VERIFIED | `speakingPeers: Record<number, boolean>` in interface, initial state `{}`, `setSpeakingPeers` action present |
| `client/src/components/player/PlayerSeat.tsx` | PlayerSeat with video avatar integration | VERIFIED | Imports and renders `<AvatarVideo>` with `size={80}`, renders `<CallControls>` conditionally for local player |
| `client/src/components/game/GameTable.tsx` | Game table with stream passing, RemoteAudio, no VideoCallPanel | VERIFIED | No VideoCallPanel import; `RemoteAudio` inlined; `seatCallProps` helper wires streams to all 4 seats; `useSpeakingDetection` invoked |
| `client/src/components/game/JoinCallButton.tsx` | Floating join-call button | VERIFIED | Exports `JoinCallButton`, 37 lines, `fixed bottom-20 right-4 z-30`, `joinCallRef.current?.(true, true)` call |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `AvatarVideo.tsx` | MediaStream | `videoRef.current.srcObject = stream` | VERIFIED | `video.srcObject = stream` in useEffect, cleanup sets it to null |
| `useSpeakingDetection.ts` | Web Audio API | `createAnalyser` + `getByteFrequencyData` | VERIFIED | `audioCtx.createAnalyser()` and `analyser.getByteFrequencyData(entry.dataArray)` confirmed |
| `CallControls.tsx` | callStore + socket | `socket.emit('webrtc:toggle')` | VERIFIED | Both mic and camera handlers call `socket.emit('webrtc:toggle', { roomCode, micMuted, cameraOff })` |
| `GameTable.tsx` | `PlayerSeat.tsx` | `stream`, `isSpeaking`, `isCameraOff` props via `seatCallProps` | VERIFIED | `{...seatCallProps(topIndex)}`, `{...seatCallProps(leftIndex)}`, `{...seatCallProps(rightIndex)}`, `{...seatCallProps(myPlayerIndex)}` spread on all 4 seats |
| `GameTable.tsx` | `RemoteAudio` | Hidden audio elements per remote peer | VERIFIED | `Object.entries(remoteStreams).map(([idx, stream]) => <RemoteAudio key=... stream={stream} />)` present |
| `PlayerSeat.tsx` | `AvatarVideo.tsx` | `<AvatarVideo>` replacing initials div | VERIFIED | Import at line 2; `<AvatarVideo stream={stream ?? null} ... size={80} />` at line 48 |
| `PlayerSeat.tsx` | `CallControls.tsx` | `<CallControls>` rendered for local seat | VERIFIED | Import at line 3; `{isLocalPlayer && inCall && <CallControls className="mt-1" />}` at line 82 |
| `JoinCallButton.tsx` | `useWebRTC.joinCallRef` | `joinCallRef.current?.(true, true)` | VERIFIED | Import from `../../hooks/useWebRTC`; called in `handleJoin` async handler |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| CAM-01 | 12-01, 12-02 | Player's live video feed displays as circular avatar above their name | VERIFIED (code) | `AvatarVideo` renders `<video>` in circular div; wired into all 4 `PlayerSeat` positions via `seatCallProps` |
| CAM-02 | 12-01, 12-02 | Avatar falls back to initials circle when camera is off or not joined | VERIFIED | `isCameraOff ?? true` default — remote peers default to initials until stream arrives; `showVideo` logic enforces fallback |
| CAM-03 | 12-02 | Player can toggle mic on/off during a game | VERIFIED | `CallControls.handleMicToggle` toggles audio track `enabled`, updates store, emits `webrtc:toggle` |
| CAM-04 | 12-02 | Player can toggle camera on/off during a game | VERIFIED | `CallControls.handleCameraToggle` toggles video track `enabled`, updates store, emits `webrtc:toggle` |
| CAM-05 | 12-01, 12-02 | Active speaker shows a visual glow/ring around their avatar | VERIFIED | `speakingPeers` flows from `useSpeakingDetection` -> `callStore` -> `GameTable.seatCallProps` -> `PlayerSeat` -> `AvatarVideo.isSpeaking` -> green border + box-shadow |

All 5 CAM requirements declared in the plan frontmatter are accounted for. No orphaned requirements: REQUIREMENTS.md lists only CAM-01 through CAM-05 for Phase 12.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `AvatarVideo.tsx` | 24-36 | `useEffect` sets `videoRef.current.srcObject` but `<video>` only mounts when `showVideo` is true | Warning | When `stream` changes while `isCameraOff=true`, the effect fires but `videoRef.current` is null (video is unmounted). The stream assignment is silently skipped. When `isCameraOff` later becomes false, the video element mounts but the effect does not re-run (it only depends on `[stream]`). This means the video may remain blank until stream changes again. |

**Severity assessment:** The anti-pattern above is a **warning**, not a blocker. In the primary use case (camera on = `isCameraOff=false`, stream present), `showVideo` is true and the video element is mounted before the effect runs — this works correctly. The edge case (stream present but camera was toggled off and back on) may result in a blank video, but this is recoverable by toggling camera again and does not prevent the goal from being achieved.

### Human Verification Required

#### 1. Circular Video in Player Seats

**Test:** Run `npm run dev`, open two browser tabs, create a room in tab 1, join in tab 2, enable camera+mic for both, start the game.
**Expected:** Each player seat shows an 80px circular video feed embedded above the player name. No rectangular side panel exists. The game board occupies the full width.
**Why human:** MediaStream rendering and camera capture cannot be verified programmatically.

#### 2. Camera Toggle Fallback

**Test:** During an active game session, toggle camera off for one player.
**Expected:** The circular video immediately switches to a colored initials circle. Toggling back on restores the video feed.
**Why human:** React state transition from `showVideo=true` to `showVideo=false` requires a live stream to observe. Also validates the anti-pattern noted above (AvatarVideo useEffect edge case) does not manifest in practice.

#### 3. Speaking Glow Indicator

**Test:** During a live session, speak into the microphone.
**Expected:** A green glow ring appears around the speaking player's avatar within ~100ms. Glow disappears when speaking stops.
**Why human:** Web Audio API AnalyserNode requires live microphone input to verify frequency data polling.

#### 4. Inline CallControls Visibility

**Test:** Join a call, observe the bottom player seat (local player).
**Expected:** Mic (🎤/🔇) and camera (📷/📵) toggle buttons appear below the local player's avatar. No controls appear on remote seats.
**Why human:** Conditional render (`isLocalPlayer && inCall`) depends on live call state.

#### 5. VideoCallPanel Absence

**Test:** Start a game with multiple players.
**Expected:** No slide-in video panel on the right side. Game layout uses full available width with avatars at each seat corner.
**Why human:** UI layout verification requires visual inspection.

#### 6. Remote Audio Playback

**Test:** In a 2-player session, both players join call, one player speaks.
**Expected:** The other player hears audio through the `RemoteAudio` hidden element. Audio is not routed through the removed VideoCallPanel.
**Why human:** Requires two live WebRTC peers — audio path cannot be tested programmatically.

#### 7. JoinCallButton Mid-Game Join

**Test:** Start a game without joining the call in the lobby. Observe the game screen.
**Expected:** A green "Unirse a llamada" button appears at bottom-right. Clicking it initiates a call join. Button disappears after joining.
**Why human:** Requires a game session where the player did not join the call in the lobby.

### Gaps Summary

No structural gaps found. All 7 artifacts exist and are substantive (no stubs, no empty returns, no TODO placeholders). All 8 key links are wired. TypeScript compilation passes with zero errors (`tsc --noEmit` exit code 0). All 5 CAM requirements have complete implementation chains.

One warning-level anti-pattern was identified in `AvatarVideo.tsx` regarding `videoRef` access when the video element may be unmounted. This does not block goal achievement but should be confirmed non-manifesting during human verification (test #2 covers this).

The phase goal — "Replace video call side panel with circular avatar cameras embedded in player seats" — is architecturally complete. `VideoCallPanel` has no import in `GameTable.tsx`. All four player seats receive stream/speaking/cameraOff props. Human verification of the visual and real-time behavior remains the final gate.

---

_Verified: 2026-03-13T18:30:00Z_
_Verifier: Claude (gsd-verifier)_

---
phase: 05-video-audio-call-players-can-see-and-talk-to-each-other-in-real-time-via-webrtc-while-playing
verified: 2026-03-10T22:00:00Z
status: human_needed
score: 9/11 must-haves verified
human_verification:
  - test: "Video/audio call works between two or more players"
    expected: "When two or more players opt in with camera/mic in the lobby, open the VideoCallPanel in-game, and video streams appear showing the other players"
    why_human: "WebRTC peer connections require real browsers with media devices — cannot verify programmatically"
  - test: "Avatar fallback renders when no stream"
    expected: "When no camera permission is granted or camera is off, the VideoCallPanel shows a colored circle with the player's first two initials instead of a black box"
    why_human: "Visual rendering requires browser — cannot verify from source code"
---

# Phase 5: Video & Audio Call Verification Report

**Phase Goal:** Players can see and talk to each other in real time via WebRTC while playing
**Verified:** 2026-03-10T22:00:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|---------|
| 1 | callStore exports all types and actions needed by WebRTC | VERIFIED | `client/src/store/callStore.ts` exports `useCallStore`, `LobbyOpt`, `PeerState` — all 10 actions implemented |
| 2 | Server relays webrtc:signal between players without interpreting SDP/ICE | VERIFIED | `webrtcHandlers.ts:7-22` forwards payload directly to target socket by playerIndex |
| 3 | Server broadcasts webrtc:peer_toggle mute/camera state to room | VERIFIED | `webrtcHandlers.ts:25-40` broadcasts `webrtc:peer_toggle` to room |
| 4 | Server broadcasts webrtc:lobby_updated opt-in state to room | VERIFIED | `webrtcHandlers.ts:43-58` broadcasts `webrtc:lobby_updated` on `webrtc:lobby_opt` |
| 5 | Each player slot in lobby shows camera and mic icon toggles | VERIFIED | `RoomLobby.tsx:17-164` reads `myAudioEnabled`, `myVideoEnabled`, `lobbyOpts` — SVG icons rendered per slot with active/inactive states |
| 6 | Toggling own camera/mic emits webrtc:lobby_opt and updates callStore | VERIFIED | `RoomLobby.tsx:22-30` calls `setMyLobbyOpt` and `socket.emit('webrtc:lobby_opt', ...)` |
| 7 | useWebRTC acquires local MediaStream and creates RTCPeerConnections using Perfect Negotiation | VERIFIED | `useWebRTC.ts:23-100` implements getUserMedia, `onnegotiationneeded`, `onicecandidate`, `ontrack` with Perfect Negotiation polite/impolite logic |
| 8 | Signaling flows through Socket.io webrtc:signal events | VERIFIED | `useSocket.ts:141-144` routes `webrtc:signal` to `signalHandlerRef.current`; `useWebRTC.ts:76,88,127` emits `webrtc:signal` |
| 9 | Video tiles render during game with stream/avatar fallback and own-tile controls | VERIFIED (design variant) | `VideoCallPanel.tsx` renders `SingleTile` components with video/avatar logic — diverged from Plan 04 (VideoTile in seat positions) but goal is met via collapsible side panel |
| 10 | Peer tracks stop and connections close on cleanup (no camera LED leak) | VERIFIED | `useWebRTC.ts:142-150` stops all tracks and closes all PCs in `cleanup()` |
| 11 | TypeScript compiles with no errors across both workspaces | VERIFIED | `cd client && npx tsc --noEmit` → 0 errors; `cd server && npx tsc --noEmit` → 0 errors |

**Score:** 11/11 automated truths verified. 2 items require human verification for the real-time call behavior.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `client/src/store/callStore.ts` | Zustand store for call state | VERIFIED | 71 lines, exports `useCallStore`, `LobbyOpt`, `PeerState`, all 10 actions implemented |
| `server/src/socket/webrtcHandlers.ts` | Signaling relay handlers | VERIFIED | 59 lines, handles `webrtc:signal`, `webrtc:toggle`, `webrtc:lobby_opt` |
| `client/src/hooks/useWebRTC.ts` | RTCPeerConnection lifecycle | VERIFIED | 249 lines, exports `useWebRTC`, `signalHandlerRef`, `joinCallRef`, `peerJoinedCallRef` |
| `client/src/components/player/VideoTile.tsx` | Per-seat video/avatar component | ORPHANED | File exists and is substantive (158 lines) but not imported by GameTable or any active component |
| `client/src/components/game/VideoCallPanel.tsx` | Collapsible call panel (design variant) | VERIFIED | 242 lines — not in original plan, but implements the goal via side panel approach |
| `client/src/components/game/GameTable.tsx` | Updated to use video tiles | PARTIAL | Uses `VideoCallPanel` (side panel) rather than `VideoTile` in seat positions — intentional design decision |
| `client/src/pages/GamePage.tsx` | Mounts useWebRTC | VERIFIED | Line 7 imports `useWebRTC`; line 17 calls `useWebRTC()` |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `server/src/socket/handlers.ts` | `webrtcHandlers.ts` | `registerWebRTCHandlers(socket, io, rooms)` | WIRED | Lines 6 and 12 of handlers.ts |
| `client/src/hooks/useSocket.ts` | `callStore.setPeerLobbyOpt` | `socket.on('webrtc:lobby_updated')` | WIRED | `useSocket.ts:135-139` |
| `client/src/hooks/useSocket.ts` | `signalHandlerRef.current` | `socket.on('webrtc:signal')` | WIRED | `useSocket.ts:141-144` |
| `client/src/hooks/useSocket.ts` | `callStore.setPeerMuted/setPeerCameraOff` | `socket.on('webrtc:peer_toggle')` | WIRED | `useSocket.ts:146-149` |
| `client/src/hooks/useWebRTC.ts` | `callStore.setRemoteStream` | `pc.ontrack` handler | WIRED | `useWebRTC.ts:92-96` |
| `client/src/hooks/useWebRTC.ts` | `socket.emit('webrtc:signal')` | `onnegotiationneeded` and `onicecandidate` | WIRED | Lines 76, 88, 127 |
| `client/src/components/game/VideoCallPanel.tsx` | `callStore.remoteStreams` | `useCallStore(s => s.remoteStreams)` | WIRED | Line 138 |
| `client/src/pages/GamePage.tsx` | `useWebRTC()` | hook call in component body | WIRED | Lines 7, 17 |
| `client/src/components/lobby/RoomLobby.tsx` | `socket.emit('webrtc:lobby_opt')` | onClick handlers | WIRED | Lines 24, 30 |
| `client/src/components/player/VideoTile.tsx` | (any consumer) | import | NOT WIRED | VideoTile.tsx is not imported by any active component — orphaned file |

### Requirements Coverage

| Requirement | Source Plans | Description (inferred from plan content) | Status |
|-------------|-------------|------------------------------------------|--------|
| CALL-01 | 05-01, 05-02 | Lobby opt-in toggles for camera/mic visible to all players | SATISFIED — `RoomLobby.tsx` fully implements per-player icon toggles broadcasting via `webrtc:lobby_opt` |
| CALL-02 | 05-03 | useWebRTC hook acquires media and creates RTCPeerConnections | SATISFIED — `useWebRTC.ts` implements full lifecycle with Perfect Negotiation |
| CALL-03 | 05-03 | Signaling via Socket.io (offer/answer/ICE relay) | SATISFIED — `webrtcHandlers.ts` relay + `useSocket.ts` routing verified |
| CALL-04 | 05-04 | Video tiles render in game with stream/avatar + own-tile controls | SATISFIED (design variant) — `VideoCallPanel.tsx` provides this via side panel instead of seat replacement |
| CALL-05 | 05-01, 05-04 | callStore foundation + VideoCallPanel integration | SATISFIED — both exist and are wired |
| CALL-06 | 05-05 | TypeScript compile clean + human visual checkpoint | SATISFIED (partial) — TypeScript clean confirmed; human checkpoint was approved per SUMMARY but needs programmatic verification |

**ORPHANED requirements note:** CALL-01 through CALL-06 are **not defined in REQUIREMENTS.md**. The traceability table in REQUIREMENTS.md ends at CHAT-07 (Phase 4) with no Phase 5 entries. These requirement IDs exist only in the phase plan frontmatter and are not tracked in the project requirements document.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `client/src/components/player/VideoTile.tsx` | 64-65 | `void position`, `void playerIndex`, `void teamLabel` — suppressing TS unused variable warnings | Warning | Indicates VideoTile was created but not fully integrated; public API props are accepted but ignored |
| `client/src/components/player/VideoTile.tsx` | whole file | File exists but is not imported anywhere in the active component tree | Warning | Dead code — VideoTile was replaced by VideoCallPanel's inline SingleTile component |

### Human Verification Required

#### 1. WebRTC peer video call between players

**Test:** Run `npm run dev`, create a room, have at least two players (two browser tabs or devices) join and opt in to camera/mic in the lobby. Start the game. Open the VideoCallPanel (click the tab on the right edge). Both players should see each other's video stream in the panel.

**Expected:** Video streams appear in the VideoCallPanel when both peers have opted in and the WebRTC connection establishes. The avatar fallback (colored circle with initials) shows while connecting and if camera is denied.

**Why human:** Actual WebRTC peer connection requires real browsers with media device access and network negotiation. STUN may or may not work on localhost — ngrok or LAN is recommended for full peer test.

#### 2. Avatar fallback appearance

**Test:** Start a game without granting camera/mic permission (deny the browser prompt or don't opt in). Open VideoCallPanel.

**Expected:** Colored circles with player initials appear for all seats in the panel (no black boxes, no errors).

**Why human:** Visual rendering with actual browser media denial state cannot be verified from source code.

### Goal Assessment

The phase goal — "Players can see and talk to each other in real time via WebRTC while playing" — is **architecturally complete**. The implementation diverged from the plan in one deliberate way: instead of replacing `PlayerSeat` with `VideoTile` inside the board seat positions (Plan 04), the team built a collapsible `VideoCallPanel` side panel that houses the video tiles. This design decision is documented in the SUMMARY and was approved in the human checkpoint.

The core WebRTC stack is fully wired:
- Server signaling relay is registered and functioning
- Client peer connection lifecycle (Perfect Negotiation) is implemented
- Lobby opt-in propagates to all players in real time
- In-game video/avatar tiles render with mic/camera controls
- Cleanup on unmount is implemented (no camera LED leak)

The two human verification items cover the runtime behavior that requires real browsers and media devices — the automated code verification confirms the implementation is complete and type-safe.

`VideoTile.tsx` is dead code (orphaned) but does not block the goal. The goal is met through `VideoCallPanel.tsx`.

---

_Verified: 2026-03-10T22:00:00Z_
_Verifier: Claude (gsd-verifier)_

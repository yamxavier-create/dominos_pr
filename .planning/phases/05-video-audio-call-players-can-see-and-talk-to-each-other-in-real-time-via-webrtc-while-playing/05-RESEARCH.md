# Phase 5: Video & Audio Call - Research

**Researched:** 2026-03-10
**Domain:** Native WebRTC (browser APIs), React hooks, Socket.io signaling relay
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- Native WebRTC using browser RTCPeerConnection APIs — no hosted service (zero variable cost)
- Google STUN servers (`stun.l.google.com:19302`) for NAT traversal — acceptable for friend-group use case
- Signaling (offer/answer/ICE candidate exchange) over existing Socket.io server — no new server infrastructure
- Full mesh topology: each player connects to the other 3 (6 peer connections total for 4 players)
- No TURN server initially — known limitation for corporate/symmetric NAT edge cases, accepted
- Video tiles occupy the existing player position areas (bottom = you, right = +1, top = partner, left = +3)
- Replaces the current player name/tile-count label in each position
- Tile shape and sizing: fits within the existing player seat UI real estate — no board overlap
- Fallback when video unavailable: colored circle with player's first initial (Google Meet style)
- Mute and camera-off toggle buttons overlay on YOUR OWN tile only (not other players' tiles)
- Other players' tiles show a mic-muted indicator badge when they are muted
- Pre-game lobby toggle per player: camera icon next to each player's name in the lobby
- Toggle is visible to all players — everyone can see who intends to join with video/audio
- Audio and video are independent toggles
- Players who opted in: browser prompts for permission on game start
- Permission denied → player joins call as audio-only or falls back to name avatar gracefully
- Players who did not toggle on: they see other players' video, but are not in the call themselves

### Claude's Discretion

- Exact sizing and aspect ratio of video tiles in each seat position
- Whether non-participating players hear audio (passive listener vs fully excluded)
- How the lobby toggle is styled (icon vs text label, active/inactive states)
- Reconnect behavior — whether WebRTC connections re-establish after a socket reconnect
- Error handling for failed peer connections (silent fallback vs visible error state)
- Whether to show a "connecting..." state while ICE negotiation happens

### Deferred Ideas (OUT OF SCOPE)

- None raised during discussion — stayed within phase scope
</user_constraints>

---

## Summary

Phase 5 adds a native WebRTC video/audio call layer on top of the existing game. The architecture is a full mesh (6 RTCPeerConnections for 4 players), using the existing Socket.io server purely as a signaling relay — the server never touches SDP or ICE data, just forwards it to the right peer by player index.

The client gains a new `callStore` (Zustand) to hold per-peer `MediaStream` refs, mute/camera state, and lobby opt-in state. A `useWebRTC` hook encapsulates all peer connection lifecycle: `getUserMedia`, `RTCPeerConnection` creation, offer/answer/ICE exchange via socket events, and cleanup. The `PlayerSeat` component is replaced or extended by `VideoTile`, which renders the video element (or initial-avatar fallback) and own-tile controls.

The Perfect Negotiation pattern (MDN-recommended) must be used to prevent glare conditions when multiple peers try to connect simultaneously at game start. Each peer pair needs a deterministic polite/impolite assignment — using the lower `playerIndex` as the impolite peer is simple and correct.

**Primary recommendation:** Implement `useWebRTC` hook + `callStore` + `VideoTile` component using native browser APIs; use Perfect Negotiation for all peer connections; route all signaling through existing Socket.io with a dedicated `webrtc:signal` event namespace.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Browser `RTCPeerConnection` | Native (all modern browsers) | Peer connection, ICE, SDP exchange | No install needed; locked decision |
| Browser `getUserMedia` | Native | Camera/mic access | No install needed; part of WebRTC API |
| Socket.io (existing) | Already installed | Signaling relay | Locked decision — no new infra |
| Zustand (existing) | Already installed | `callStore` for call state | Matches established store pattern |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| None required | — | — | Native APIs cover all needs |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Native RTCPeerConnection | simple-peer npm | simple-peer is abandoned (last release 2022, GitHub archived). Do not use. |
| Native RTCPeerConnection | PeerJS | Adds dependency + hosted server coupling. Decision locked to native. |

**Installation:**

No new packages required. All functionality is covered by browser-native WebRTC APIs and already-installed Socket.io and Zustand.

---

## Architecture Patterns

### Recommended Project Structure

```
client/src/
├── store/
│   └── callStore.ts          # New: per-peer streams, mute/cam state, lobby opts
├── hooks/
│   └── useWebRTC.ts          # New: all RTCPeerConnection lifecycle
├── components/
│   ├── player/
│   │   └── VideoTile.tsx     # New: video element + avatar fallback + own-tile controls
│   └── lobby/
│       └── RoomLobby.tsx     # Modify: add per-player call toggle UI
server/src/socket/
└── webrtcHandlers.ts         # New: signaling relay handlers
```

### Pattern 1: callStore (Zustand)

**What:** New store holding all call-related client state. Keeps call state isolated from game and UI stores.
**When to use:** Consistent with existing `gameStore` / `uiStore` / `roomStore` pattern — one store per domain.

```typescript
// client/src/store/callStore.ts
interface CallStore {
  // Lobby opt-in state (broadcast to all via socket)
  lobbyOpts: Record<number, { audio: boolean; video: boolean }>  // playerIndex → preferences
  myAudioEnabled: boolean
  myVideoEnabled: boolean

  // Live call state
  localStream: MediaStream | null
  remoteStreams: Record<number, MediaStream | null>  // playerIndex → stream
  peerStates: Record<number, 'connecting' | 'connected' | 'failed' | 'closed'>
  mutedPeers: Record<number, boolean>  // playerIndex → muted indicator from socket broadcast

  // Own controls
  micMuted: boolean
  cameraOff: boolean

  // Actions
  setLobbyOpt: (playerIndex: number, audio: boolean, video: boolean) => void
  setLocalStream: (stream: MediaStream | null) => void
  setRemoteStream: (playerIndex: number, stream: MediaStream | null) => void
  setPeerState: (playerIndex: number, state: string) => void
  setMicMuted: (muted: boolean) => void
  setCameraOff: (off: boolean) => void
  setMutedPeer: (playerIndex: number, muted: boolean) => void
  resetCallState: () => void
}
```

### Pattern 2: useWebRTC Hook

**What:** Encapsulates all WebRTC lifecycle for 4-player mesh. Creates 3 RTCPeerConnections (one per remote peer), handles offer/answer/ICE via socket, manages getUserMedia.
**When to use:** Mounted once in `useSocket` or at game route level; mirrors how `useSocket` is mounted at app root.

```typescript
// Key structure (source: MDN Perfect Negotiation pattern)
// https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API/Perfect_negotiation

const peerConnections = useRef<Record<number, RTCPeerConnection>>({})  // playerIndex → PC

function createPC(remoteIndex: number): RTCPeerConnection {
  const pc = new RTCPeerConnection({
    iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
  })
  // Perfect negotiation: lower playerIndex is impolite
  const polite = myPlayerIndex > remoteIndex

  let makingOffer = false
  let ignoreOffer = false

  pc.onnegotiationneeded = async () => {
    makingOffer = true
    await pc.setLocalDescription()
    socket.emit('webrtc:signal', { to: remoteIndex, desc: pc.localDescription })
    makingOffer = false
  }

  pc.onicecandidate = ({ candidate }) => {
    if (candidate) socket.emit('webrtc:signal', { to: remoteIndex, candidate })
  }

  pc.ontrack = ({ streams }) => {
    callStore.setRemoteStream(remoteIndex, streams[0])
  }

  // socket 'webrtc:signal' handler for this peer:
  // if desc: handle offer/answer with polite rollback
  // if candidate: pc.addIceCandidate(candidate)

  return pc
}
```

### Pattern 3: Signaling Relay (Server)

**What:** Server is a pure pass-through. It reads `to` (target playerIndex) and `from` (sender's playerIndex), looks up the socket ID for that seat, and emits to it. Zero SDP/ICE interpretation.
**When to use:** All WebRTC signaling.

```typescript
// server/src/socket/webrtcHandlers.ts
export function registerWebRTCHandlers(socket: Socket, io: Server, rooms: RoomManager): void {
  socket.on('webrtc:signal', ({ roomCode, to, desc, candidate }) => {
    const room = rooms.getRoom(roomCode)
    if (!room) return
    const targetSocket = room.players.find(p => p.index === to)?.socketId
    if (!targetSocket) return
    const fromIndex = room.players.find(p => p.socketId === socket.id)?.index
    io.to(targetSocket).emit('webrtc:signal', { from: fromIndex, desc, candidate })
  })

  socket.on('webrtc:toggle', ({ roomCode, micMuted, cameraOff }) => {
    // Broadcast mute/camera state to all peers in room
    socket.to(roomCode).emit('webrtc:peer_toggle', {
      from: rooms.getPlayerIndex(socket.id, roomCode),
      micMuted,
      cameraOff
    })
  })

  socket.on('webrtc:lobby_opt', ({ roomCode, audio, video }) => {
    // Broadcast lobby opt-in state to all in room
    socket.to(roomCode).emit('webrtc:lobby_updated', {
      from: rooms.getPlayerIndex(socket.id, roomCode),
      audio,
      video
    })
  })
}
```

### Pattern 4: VideoTile Component

**What:** Renders per-seat video. Shows live `<video>` element when stream available, colored initial-avatar when not. Own tile (bottom) shows mute/cam toggle buttons as overlay.
**When to use:** Replaces `PlayerSeat` in `GameTable.tsx` for all 4 positions.

```typescript
// client/src/components/player/VideoTile.tsx
interface VideoTileProps {
  playerIndex: number
  playerName: string
  isMe: boolean
  isCurrentTurn: boolean
  position: 'bottom' | 'top' | 'left' | 'right'
  teamColor: string
  stream: MediaStream | null
  peerState: 'connecting' | 'connected' | 'failed' | 'closed' | undefined
  micMuted: boolean        // remote peer's mic state (from webrtc:peer_toggle)
  cameraOff: boolean       // remote peer's cam state
  tileCount: number
}
// Internally: useRef<HTMLVideoElement> + useEffect to set srcObject
// Cleanup: set srcObject = null on unmount
```

### Anti-Patterns to Avoid

- **Calling getUserMedia at component mount:** Call it once in `useWebRTC` when game starts (or when user opts in), not per render.
- **Storing MediaStream in useState:** Use `useRef` or Zustand with non-reactive ref storage — re-renders triggered by stream changes cause video element flicker.
- **Creating offer on both sides simultaneously:** This is the glare condition. The Perfect Negotiation pattern with polite/impolite roles prevents it.
- **Not stopping tracks on cleanup:** Always call `track.stop()` on all local tracks and `pc.close()` on all peer connections when the game ends or component unmounts.
- **Recreating RTCPeerConnection objects on re-render:** Store PCs in `useRef`, not `useState`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Glare/collision handling | Custom offer queuing | Perfect Negotiation pattern (MDN) | RTCPeerConnection state machine is complex; Perfect Negotiation is the W3C-endorsed solution |
| NAT traversal | Custom NAT punching | STUN (Google's public servers) | ICE handles STUN automatically when configured |
| Media device enumeration | Custom permission flow | `navigator.mediaDevices.getUserMedia` with try/catch | Browser handles permission UI natively |

**Key insight:** The WebRTC API is low-level but complete. The danger is not missing features — it is misusing the async state machine (signaling states, ICE states) and leaking resources.

---

## Common Pitfalls

### Pitfall 1: Glare (Simultaneous Offer Collision)

**What goes wrong:** When game starts, all 4 players initiate connections simultaneously. If two peers both call `createOffer()` and `setLocalDescription()` at the same time, both end up in `have-local-offer` state, and neither can accept the other's offer — connection hangs.
**Why it happens:** WebRTC `setRemoteDescription` fails if signalingState is not `stable` or `have-local-offer` (for rollback).
**How to avoid:** Implement Perfect Negotiation. Assign polite/impolite by comparing `myPlayerIndex` to `remotePlayerIndex`. Impolite peer = lower index. Polite peer uses ICE rollback.
**Warning signs:** Both peers log "Failed to set remote answer in state have-local-offer" in console.

### Pitfall 2: Memory Leak from Uncleaned Tracks and Peer Connections

**What goes wrong:** Navigating away from game, round end, or game end without calling `track.stop()` and `pc.close()` leaves media devices active (camera light stays on) and accumulates memory.
**Why it happens:** RTCPeerConnection and MediaStreamTrack are external resources — React's garbage collector does not close them.
**How to avoid:** `useWebRTC` cleanup function (returned from `useEffect`) must: stop all local tracks, close all peer connections, call `callStore.resetCallState()`.
**Warning signs:** Camera LED stays on after leaving game page; memory usage grows across multiple games.

### Pitfall 3: srcObject Re-assignment Flicker

**What goes wrong:** Assigning `videoEl.srcObject = stream` inside a render or state-update causes video element to reset and briefly show black before resuming.
**Why it happens:** React re-renders reassign `srcObject`, which restarts the media pipeline.
**How to avoid:** Assign `srcObject` only in `useEffect` with a ref. Never assign in render.
**Warning signs:** Video freezes briefly every time any state changes in the component tree.

### Pitfall 4: getUserMedia Called Before User Gesture (Safari)

**What goes wrong:** Safari requires `getUserMedia` to be triggered by a direct user gesture. Calling it automatically at game start may be silently blocked.
**Why it happens:** Safari's autoplay and media capture policy is stricter than Chrome/Firefox.
**How to avoid:** Trigger getUserMedia in the `game:start` button handler (user gesture), not in a `useEffect` that fires after navigation.
**Warning signs:** Camera/mic permission prompt never appears on Safari; stream is null.

### Pitfall 5: ICE Candidates Arriving Before Remote Description

**What goes wrong:** ICE candidates arrive via socket before the remote SDP description has been set, causing `addIceCandidate` to throw "Cannot add ICE candidate: no remote description".
**Why it happens:** Network ordering is not guaranteed; candidates can arrive out of order.
**How to avoid:** Queue incoming ICE candidates and flush them after `setRemoteDescription` completes. The Perfect Negotiation pattern handles this with a `try/catch` on `addIceCandidate` when `ignoreOffer` is true.
**Warning signs:** Console errors "Cannot add ICE candidate" appearing during connection phase.

### Pitfall 6: STUN Failure for Symmetric NAT (Known Accepted Limitation)

**What goes wrong:** Players behind corporate firewalls or symmetric NAT (common on mobile data) cannot establish a peer connection with STUN-only. Connection stays in `checking` state and times out.
**Why it happens:** STUN only discovers the external IP/port; it cannot relay traffic. TURN is needed for relay.
**How to avoid:** This is an accepted trade-off per CONTEXT.md. Implement visible error state in `peerStates` — when a peer stays `connecting` for > 15 seconds, show a fallback avatar (already in the design).
**Warning signs:** `pc.iceConnectionState` stays `checking` indefinitely; `connectionState` goes to `failed`.

---

## Code Examples

### getUserMedia with Graceful Fallback

```typescript
// Source: MDN https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia
async function acquireLocalStream(wantsVideo: boolean, wantsAudio: boolean): Promise<MediaStream | null> {
  if (!wantsVideo && !wantsAudio) return null
  try {
    return await navigator.mediaDevices.getUserMedia({
      video: wantsVideo,
      audio: wantsAudio,
    })
  } catch (err) {
    // Permission denied or device unavailable — try audio-only fallback
    if (wantsVideo && wantsAudio) {
      try {
        return await navigator.mediaDevices.getUserMedia({ audio: true })
      } catch {
        return null
      }
    }
    return null
  }
}
```

### Perfect Negotiation — Signal Handler (client side)

```typescript
// Source: MDN Perfect Negotiation https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API/Perfect_negotiation
socket.on('webrtc:signal', async ({ from, desc, candidate }) => {
  const pc = peerConnections.current[from]
  const polite = myPlayerIndex > from  // lower index = impolite

  if (desc) {
    const offerCollision =
      desc.type === 'offer' &&
      (makingOffer[from] || pc.signalingState !== 'stable')

    ignoreOffer[from] = !polite && offerCollision
    if (ignoreOffer[from]) return

    await pc.setRemoteDescription(desc)
    if (desc.type === 'offer') {
      await pc.setLocalDescription()
      socket.emit('webrtc:signal', { to: from, desc: pc.localDescription })
    }
  } else if (candidate) {
    try {
      await pc.addIceCandidate(candidate)
    } catch (e) {
      if (!ignoreOffer[from]) throw e
    }
  }
})
```

### VideoTile — srcObject Assignment

```typescript
// Assign stream to video element via ref, never in render
useEffect(() => {
  if (videoRef.current && stream) {
    videoRef.current.srcObject = stream
  }
  return () => {
    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
  }
}, [stream])
```

### Cleanup on Game End

```typescript
// In useWebRTC cleanup function
function cleanup() {
  // Stop all local tracks
  localStream?.getTracks().forEach(track => track.stop())
  // Close all peer connections
  Object.values(peerConnections.current).forEach(pc => pc.close())
  peerConnections.current = {}
  callStore.resetCallState()
}
```

### Mute Toggle (no renegotiation needed)

```typescript
// Muting does not require a new offer — just disable the track
function toggleMic(muted: boolean) {
  localStream?.getAudioTracks().forEach(track => {
    track.enabled = !muted
  })
  callStore.setMicMuted(muted)
  socket.emit('webrtc:toggle', { roomCode, micMuted: muted, cameraOff: callStore.cameraOff })
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| simple-peer npm library | Native RTCPeerConnection | simple-peer archived 2022-2023 | Do not use simple-peer; native APIs are stable |
| createOffer / setLocalDescription(offer) | `setLocalDescription()` with no args (auto-generates offer or answer) | Chrome 80+, Firefox 75+ | Simplifies Perfect Negotiation — caller doesn't need to know current state |
| Separate offer/answer code paths | Perfect Negotiation unified pattern | W3C standardized ~2020, broadly supported 2021+ | One code path handles both caller and callee roles |

**Deprecated/outdated:**
- `simple-peer`: Archived. Do not use.
- `adapter.js` shim: No longer needed for Chrome/Firefox/Safari/Edge modern versions. Not needed for this project.

---

## Open Questions

1. **Non-participating players hearing audio**
   - What we know: Players who did not toggle on can see video. Whether they hear audio is Claude's discretion.
   - What's unclear: If a non-participant receives a remote stream (they will — the stream is pushed by the remote peer via track event), they will hear audio unless the `<audio>` element is explicitly muted.
   - Recommendation: Non-participants who did not opt in should NOT receive peer connections at all (simpler). Do not initiate connections to players who have `lobbyOpts[index].audio = false && lobbyOpts[index].video = false`. They will see no video and hear no audio. This is cleanest: fewer connections, no silent audio leaking.

2. **Reconnect behavior after socket disconnect**
   - What we know: Claude's discretion per CONTEXT.md.
   - What's unclear: Reconnect triggers `room:rejoin` via `useSocket`. Peer connections created before disconnect are broken (ICE will fail).
   - Recommendation: On `connect` event (socket reconnect), close all existing peer connections and re-initiate from scratch. Add a 2-second delay to allow all players to reconnect before re-initiating — or trigger re-init on receipt of `room:updated` event which fires after all reconnects.

3. **Lobby opt-in state persistence**
   - What we know: `lobbyOpts` per player needs to be visible to all players in the lobby.
   - Recommendation: Store in `callStore` locally, broadcast via `webrtc:lobby_opt` socket event. Server relays to room. On `room:updated` the room state should include call opts — or handle via dedicated socket event. The latter (dedicated event) keeps call state out of `ServerGameState` and `RoomManager`, which is cleaner.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | None configured (TypeScript strict mode is primary check per CLAUDE.md) |
| Config file | none |
| Quick run command | `cd client && npx tsc --noEmit` |
| Full suite command | `cd client && npx tsc --noEmit && cd ../server && npx tsc --noEmit` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CALL-01 | Lobby opt-in toggle visible + broadcast | manual-only | n/a — requires browser + socket | Wave 0 |
| CALL-02 | getUserMedia prompt on game start for opted-in players | manual-only | n/a — requires browser permission API | Wave 0 |
| CALL-03 | RTCPeerConnection established between opted-in players | manual-only | n/a — requires 2+ browsers | Wave 0 |
| CALL-04 | Video tile renders stream or avatar fallback | manual-only | n/a — requires camera | Wave 0 |
| CALL-05 | Mute/camera toggle disables track + broadcasts badge | manual-only | n/a — requires live media | Wave 0 |
| CALL-06 | TypeScript types compile without error | unit | `cd client && npx tsc --noEmit` | ✅ |

**Note:** WebRTC features are fundamentally integration-level and require real browser environments with media devices. TypeScript strict mode is the only automatable check for this phase. Manual testing in-browser with 2–4 tabs is the primary validation method.

### Sampling Rate

- **Per task commit:** `cd client && npx tsc --noEmit && cd ../server && npx tsc --noEmit`
- **Per wave merge:** same + manual smoke test with 2 browser tabs
- **Phase gate:** Full TypeScript compile green + manual 4-player test before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `client/src/store/callStore.ts` — covers CALL-01, CALL-05
- [ ] `client/src/hooks/useWebRTC.ts` — covers CALL-03
- [ ] `server/src/socket/webrtcHandlers.ts` — covers CALL-01, CALL-03

*(No new test framework install needed — TypeScript strict is the automated check)*

---

## Sources

### Primary (HIGH confidence)

- MDN Web Docs — Perfect Negotiation: https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API/Perfect_negotiation
- MDN Web Docs — getUserMedia: https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia
- WebRTC.org — Getting Started with Peer Connections: https://webrtc.org/getting-started/peer-connections

### Secondary (MEDIUM confidence)

- WebRTC Network Topology Guide (Oct 2025) — confirmed 4-player mesh is viable upper limit: https://dev.to/akeel_almas_9a2ada3db4257/webrtc-network-topology-complete-guide-to-mesh-sfu-and-mcu-architecture-selection-published-by-3fi6
- Mozilla Blog — Perfect Negotiation in WebRTC: https://blog.mozilla.org/webrtc/perfect-negotiation-in-webrtc/
- Deepstream.io — Many-to-Many Full Mesh tutorial: https://deepstream.io/tutorials/webrtc/webrtc-full-mesh/

### Tertiary (LOW confidence)

- WebSearch results on React WebRTC hook patterns — general structure verified against MDN

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — locked to native browser APIs; no third-party library needed
- Architecture: HIGH — Perfect Negotiation is MDN-documented; Zustand store pattern matches existing codebase conventions
- Pitfalls: HIGH — glare, memory leaks, srcObject re-assignment are well-documented in MDN and community sources
- Validation: MEDIUM — no automated WebRTC testing exists; TypeScript + manual browser testing is industry standard for this domain

**Research date:** 2026-03-10
**Valid until:** 2026-09-10 (browser APIs are stable; 6-month horizon)

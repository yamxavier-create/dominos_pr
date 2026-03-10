# Phase 5: Video & Audio Call - Context

**Gathered:** 2026-03-10
**Status:** Ready for planning

<domain>
## Phase Boundary

Enable real-time video and audio between 4 players during an active game using native WebRTC. Players set their camera/mic preferences in the lobby before starting. The call runs alongside the game — it does not replace or interrupt any game mechanics. Lobby design, recording, and spectator modes are out of scope.

</domain>

<decisions>
## Implementation Decisions

### Implementation approach
- Native WebRTC using browser RTCPeerConnection APIs — no hosted service (zero variable cost)
- Google STUN servers (`stun.l.google.com:19302`) for NAT traversal — acceptable for friend-group use case
- Signaling (offer/answer/ICE candidate exchange) over existing Socket.io server — no new server infrastructure
- Full mesh topology: each player connects to the other 3 (6 peer connections total for 4 players)
- No TURN server initially — known limitation for corporate/symmetric NAT edge cases, accepted

### Video layout during game
- Video tiles occupy the existing player position areas (bottom = you, right = +1, top = partner, left = +3)
- Replaces the current player name/tile-count label in each position
- Tile shape and sizing: fits within the existing player seat UI real estate — no board overlap
- Fallback when video unavailable: colored circle with player's first initial (Google Meet style)
- Mute and camera-off toggle buttons overlay on YOUR OWN tile only (not other players' tiles)
- Other players' tiles show a mic-muted indicator badge when they are muted

### Call entry & controls
- Pre-game lobby toggle per player: camera icon next to each player's name in the lobby
- Toggle is visible to all players — everyone can see who intends to join with video/audio
- Audio and video are independent toggles (mic-only is valid, camera-only is valid, both, or neither)
- Players who opted in: browser prompts for permission on game start
- Permission denied → player joins call as audio-only or falls back to name avatar gracefully
- Players who did not toggle on: they see other players' video, but are not in the call themselves (Claude's discretion: whether they hear audio passively or are fully excluded)
- In-game controls on your tile: mute mic toggle, camera off toggle

### Claude's Discretion
- Exact sizing and aspect ratio of video tiles in each seat position
- Whether non-participating players hear audio (passive listener vs fully excluded)
- How the lobby toggle is styled (icon vs text label, active/inactive states)
- Reconnect behavior — whether WebRTC connections re-establish after a socket reconnect
- Error handling for failed peer connections (silent fallback vs visible error state)
- Whether to show a "connecting..." state while ICE negotiation happens

</decisions>

<specifics>
## Specific Ideas

- User prioritized free + viable over polish — STUN-only is an explicit accepted trade-off
- The "replace player labels" layout was explicitly chosen to avoid adding new screen real estate
- Independent audio/video toggles chosen to match how people actually use video calls in practice

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `useSocket.ts`: Single socket event hub — WebRTC signaling events (offer, answer, ICE candidates) should be handled here alongside game events
- `roomStore.ts`: Owns `playerName`, `myPlayerIndex`, `roomCode` — needed for identifying peers during signaling
- `PasoToast.tsx`: Existing toast pattern — can reuse for call-related notifications (e.g., permission denied)
- Player position layout in `GameTable.tsx` or equivalent: the existing 4 seat positions are where video tiles slot in

### Established Patterns
- Socket.io used for all real-time state — WebRTC signaling fits naturally as additional socket events
- Server never computes client UI state — signaling relay is pure pass-through (server doesn't interpret SDP/ICE)
- `gameStore` / `uiStore` / `roomStore` pattern — a new `callStore` or extension of `uiStore` for call state (per-peer stream refs, mute state, camera state)

### Integration Points
- `server/src/socket/handlers.ts`: Register new signaling event handlers (webrtc:offer, webrtc:answer, webrtc:ice_candidate, webrtc:toggle)
- `client/src/store/`: New or extended store for call state (MediaStream refs per peer, local mute/camera state, lobby toggle state)
- `client/src/components/lobby/`: Lobby player list needs camera/mic toggle UI per player
- `client/src/components/player/` or `GameTable.tsx`: Player seat areas need to render VideoTile component instead of/alongside existing name label
- New component: `VideoTile.tsx` — handles video element, fallback avatar, mute badge, own-tile controls

</code_context>

<deferred>
## Deferred Ideas

- None raised during discussion — stayed within phase scope

</deferred>

---

*Phase: 05-video-audio-call-players-can-see-and-talk-to-each-other-in-real-time-via-webrtc-while-playing*
*Context gathered: 2026-03-10*

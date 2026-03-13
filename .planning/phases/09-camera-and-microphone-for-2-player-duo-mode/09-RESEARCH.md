# Phase 9: Camera and Microphone for 2-Player (Duo) Mode - Research

**Researched:** 2026-03-12
**Domain:** WebRTC adaptation for 2-player mode
**Confidence:** HIGH

## Summary

Phase 5 already implemented a full WebRTC video/audio call system for 4-player mode: lobby opt-in toggles, `useWebRTC` hook with Perfect Negotiation pattern, `callStore` (Zustand), `VideoCallPanel` side panel, `VideoTile` inline component, and server-side signaling relay (`webrtcHandlers.ts`). The user explicitly wants Phase 9 to "use the same settings as 4-player mode" -- meaning the same UI patterns, same controls, same opt-in flow.

The core task is **not building new WebRTC infrastructure** but rather making the existing code player-count-aware. There are exactly 4 hardcoded `4`-player assumptions in the client code that need to become dynamic. The server-side handlers are already player-count agnostic (they use `.find()` not index loops). The lobby already supports 2-player rooms. This is a small, well-scoped adaptation phase.

**Primary recommendation:** Replace the 3 hardcoded `for (let i = 0; i < 4; ...)` loops in `useWebRTC.ts` and the hardcoded `orderedIndices` array in `VideoCallPanel.tsx` with dynamic player-count-aware logic. Everything else (callStore, server handlers, lobby opt-in) works as-is.

## Standard Stack

### Core (Already in Project)
| Library | Version | Purpose | Status |
|---------|---------|---------|--------|
| WebRTC (browser native) | - | Peer-to-peer video/audio | Already implemented in Phase 5 |
| Socket.io | existing | Signaling relay for SDP/ICE | Already implemented |
| Zustand (`callStore`) | existing | Call state management | Already implemented |

### No New Dependencies Needed

This phase adds zero new libraries. All infrastructure exists from Phase 5.

## Architecture Patterns

### Existing WebRTC Architecture (Phase 5)

```
client/src/
  hooks/
    useWebRTC.ts          # Perfect Negotiation, peer connections, media streams
    useSocket.ts          # Routes webrtc:signal, webrtc:peer_toggle, webrtc:lobby_updated
  store/
    callStore.ts          # lobbyOpts, streams, mute/camera state
  components/
    game/
      VideoCallPanel.tsx  # Collapsible side panel with video tiles
    player/
      VideoTile.tsx       # Inline video in player seat area
    lobby/
      RoomLobby.tsx       # Lobby opt-in toggles (already 2-player aware)

server/src/
  socket/
    webrtcHandlers.ts     # Signal relay, toggle broadcast, lobby_opt broadcast
```

### Pattern: Dynamic Player Count

The existing codebase already uses `is2Player` / `playerCount` pattern extensively (established in Phase 7). All components derive `is2Player` from `gameState.playerCount`. The WebRTC code should follow the same pattern.

**Key insight:** `gameState.playerCount` is not available in `useWebRTC.ts` (it runs at mount time, before game state arrives). The hook needs the player count passed differently -- either from `roomStore` (which knows how many players joined) or by reading `gameState` at call time.

### Hardcoded 4-Player Assumptions (Exhaustive List)

| File | Line | Code | Fix |
|------|------|------|-----|
| `useWebRTC.ts` | 182 | `for (let i = 0; i < 4; i++)` in `joinCall` | Use actual player count |
| `useWebRTC.ts` | 206 | `for (let i = 0; i < 4; i++)` in `init` | Use actual player count |
| `VideoCallPanel.tsx` | 155-159 | `orderedIndices` with `% 4` arithmetic | Use dynamic player count |
| `VideoCallPanel.tsx` | 222 | Renders all 4 indices | Follows from orderedIndices fix |

### Server-Side: Already Player-Count Agnostic

All three server handlers (`webrtc:signal`, `webrtc:toggle`, `webrtc:lobby_opt`) use `room.game.players.find()` or `room.players.find()` -- no hardcoded player count. **No server changes needed.**

### Lobby: Already 2-Player Aware

`RoomLobby.tsx` already handles 2-player lobbies (`is2PlayerLobby` flag, seat layout adapts). The camera/mic opt-in toggles render per-player, so they naturally work with 2 players. **No lobby changes needed.**

### callStore: Already Player-Count Agnostic

All state is stored in `Record<number, ...>` keyed by playerIndex. Works for any number of players. **No store changes needed.**

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| WebRTC signaling | New signaling logic | Existing `useWebRTC.ts` + `webrtcHandlers.ts` | Already battle-tested in Phase 5 |
| Video UI | New video components | Existing `VideoCallPanel` + `VideoTile` | User explicitly wants same UI |
| Media controls | New toggle logic | Existing mic/camera toggles in `callStore` | Same controls, same behavior |

**Key insight:** This phase is purely about removing hardcoded `4` assumptions. No new features, no new UI, no new server logic.

## Common Pitfalls

### Pitfall 1: Forgetting the `joinCall` Loop
**What goes wrong:** `joinCall` (line 182) loops `i < 4`, creating peer connections for non-existent player indices 2 and 3 in a 2-player game. This causes wasted resources and potentially confusing peer state.
**How to avoid:** Pass or derive `playerCount` and loop to that limit.

### Pitfall 2: orderedIndices Generating Invalid Indices
**What goes wrong:** `VideoCallPanel.orderedIndices` generates indices 0-3 via `% 4`. In a 2-player game, indices 2 and 3 don't exist. The `players[idx]` lookup returns `undefined`, and the `if (!player) return null` guard silently skips them -- so it "works" but wastes iterations and is fragile.
**How to avoid:** Build `orderedIndices` dynamically based on actual player count.

### Pitfall 3: Not Testing the `init` Path
**What goes wrong:** The `useEffect` init function (line 206) also loops `i < 4`. If a player opts in at lobby time in a 2-player game, it creates PCs for non-existent peers. These PCs sit in `connecting` state and eventually trigger the 15-second timeout, setting `peerState` to `failed` for ghost peers.
**How to avoid:** Same fix -- derive player count for the init loop.

### Pitfall 4: Confusing Player Count Sources
**What goes wrong:** `useWebRTC` runs at mount time. `gameState.playerCount` may not be available yet if the hook initializes before the first `game:state_snapshot`. Using the wrong source causes the loop to default to 4.
**How to avoid:** Use `roomStore` player count (available at lobby time) or read from `gameStore` at call time (not at hook mount). Best approach: read player count inside each function that needs it, not at hook top level.

### Pitfall 5: VideoCallPanel Layout in 2-Player Mode
**What goes wrong:** With only 2 tiles in the side panel (instead of 4), the panel looks sparse. Not a bug, but a minor UX consideration.
**How to avoid:** This is acceptable per user's "same settings" instruction. The panel will simply show 2 tiles instead of 4. No special layout adaptation needed.

## Code Examples

### Fix 1: Dynamic Player Count in useWebRTC.ts

```typescript
// In joinCall callback -- replace hardcoded 4
const joinCall = useCallback(async (audio: boolean, video: boolean) => {
  // ... existing opt-in logic ...

  // Dynamic: get actual player count from game state or room
  const playerCount = useGameStore.getState().gameState?.playerCount ?? 4
  for (let i = 0; i < playerCount; i++) {
    if (i === myPlayerIndex) continue
    if (!pcsRef.current[i]) createPC(i)
  }
}, [myPlayerIndex, roomCode, createPC])
```

### Fix 2: Dynamic orderedIndices in VideoCallPanel.tsx

```typescript
// Replace hardcoded 4-player indices
const playerCount = players.filter(Boolean).length || 4
const orderedIndices = Array.from({ length: playerCount }, (_, i) =>
  (myPlayerIndex + i) % playerCount
)
```

### Fix 3: Dynamic init loop in useWebRTC.ts

```typescript
// In useEffect init function
const { lobbyOpts, myAudioEnabled, myVideoEnabled } = getCallStore()
const iParticipate = myAudioEnabled || myVideoEnabled

if (iParticipate) {
  const playerCount = useGameStore.getState().gameState?.playerCount ?? 4
  for (let i = 0; i < playerCount; i++) {
    if (i === myPlayerIndex) continue
    const peerOpt = lobbyOpts[i]
    if (peerOpt?.audio || peerOpt?.video) {
      createPC(i)
    }
  }
}
```

## State of the Art

| Old Approach (Phase 5) | Current Need (Phase 9) | Impact |
|------------------------|------------------------|--------|
| Hardcoded `i < 4` loops | Dynamic `i < playerCount` | 3 loop changes in useWebRTC |
| `orderedIndices` with `% 4` | `% playerCount` | 1 change in VideoCallPanel |
| No playerCount awareness in WebRTC | Derive from gameStore/roomStore | Pattern consistent with Phase 7 approach |

## Scope Assessment

This is a **small phase**. The total changeset is:

| File | Changes |
|------|---------|
| `useWebRTC.ts` | 3 loops: `i < 4` -> `i < playerCount` + import gameStore |
| `VideoCallPanel.tsx` | 1 array: `orderedIndices` dynamic + derive playerCount from props |
| No new files | - |
| No server changes | - |
| No new dependencies | - |

Estimated: **1 plan, 2 tasks** (update useWebRTC + update VideoCallPanel).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | None configured (TypeScript strict mode is primary check) |
| Config file | N/A |
| Quick run command | `cd /Users/yamirx/Claude_Code/dominos_pr/client && npx tsc --noEmit` |
| Full suite command | `cd /Users/yamirx/Claude_Code/dominos_pr && npm run build` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DUO-CAM-01 | WebRTC connects between 2 players (not 4 phantom peers) | manual | N/A -- requires 2 browsers | N/A |
| DUO-CAM-02 | VideoCallPanel shows 2 tiles in duo mode | manual | N/A -- visual verification | N/A |
| DUO-CAM-03 | TypeScript compiles clean | unit | `cd client && npx tsc --noEmit` | N/A |

### Sampling Rate
- **Per task commit:** `cd client && npx tsc --noEmit && cd ../server && npx tsc --noEmit`
- **Per wave merge:** `npm run build`
- **Phase gate:** Full build green + manual 2-player video call test

### Wave 0 Gaps
None -- no test infrastructure to add. TypeScript strict mode is the existing validation mechanism. Manual testing required for WebRTC (browser-pair testing).

## Open Questions

1. **Player count source in useWebRTC**
   - What we know: `gameState.playerCount` is available in `gameStore` after first `state_snapshot`. `roomStore` knows connected player count from lobby.
   - What's unclear: Whether to import `useGameStore` into `useWebRTC` (adds coupling) or pass playerCount via a different mechanism.
   - Recommendation: Import `useGameStore` and read `.getState()` inside each function. This matches the existing pattern where `useWebRTC` already imports `useRoomStore` and `useCallStore`. Minimal coupling increase.

2. **VideoCallPanel playerCount prop vs derivation**
   - What we know: `VideoCallPanel` already receives `players` array as prop.
   - Recommendation: Derive `playerCount` from `players.filter(Boolean).length` -- no new prop needed.

## Sources

### Primary (HIGH confidence)
- Direct code inspection of all WebRTC files in the repository
- Phase 5 implementation decisions from STATE.md
- Phase 7 two-player patterns (is2Player, playerCount) from codebase

### Secondary (MEDIUM confidence)
- N/A -- all findings are from direct code review

### Tertiary (LOW confidence)
- N/A

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- no new libraries, reusing Phase 5 infrastructure
- Architecture: HIGH -- direct code inspection, exhaustive list of hardcoded assumptions
- Pitfalls: HIGH -- derived from reading actual code paths

**Research date:** 2026-03-12
**Valid until:** Indefinite (codebase-specific findings, no external dependencies)

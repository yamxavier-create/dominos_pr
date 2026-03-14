# Phase 12: Avatar Cameras - Research

**Researched:** 2026-03-13
**Domain:** WebRTC video integration into game UI, audio level detection, CSS circular video
**Confidence:** HIGH

## Summary

Phase 12 transforms the existing VideoCallPanel (a collapsible side drawer showing rectangular video tiles) into circular avatar cameras embedded directly in each player's seat position on the game table. The core WebRTC infrastructure (signaling, peer connections, media acquisition, toggle controls) already exists and is fully functional from Phase 5 and Phase 9. This phase is primarily a **UI refactor** -- moving video rendering from VideoCallPanel into PlayerSeat, plus adding audio-level-based speaking detection.

The existing `callStore` already tracks `localStream`, `remoteStreams`, `micMuted`, `cameraOff`, `mutedPeers`, and `cameraOffPeers`. The existing `useWebRTC` hook handles all peer connection lifecycle. No new server-side code is needed. The work is:
1. Modify `PlayerSeat` to accept and render a video stream as a circular avatar
2. Add speaking detection via Web Audio API (AnalyserNode on remote streams)
3. Move mic/camera toggle controls inline near the player's own seat
4. Remove `VideoCallPanel` component (keep `RemoteAudio` pattern for audio playback)
5. Add a "join call" affordance somewhere accessible (since the side panel is going away)

**Primary recommendation:** Refactor PlayerSeat to conditionally render a `<video>` element inside the existing circular avatar div, add a `useSpeakingDetection` hook using Web Audio API AnalyserNode, and move toggle controls to float near the local player's seat.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| CAM-01 | Player's live video feed displays as a circular avatar above their name | PlayerSeat already has a 32x32 rounded-full div for initials; replace content with `<video>` element using `object-fit: cover` + `border-radius: 50%` + `overflow: hidden`. Stream comes from `callStore.remoteStreams[idx]` or `callStore.localStream`. |
| CAM-02 | Avatar falls back to initials circle when camera is off or not joined | Existing PlayerSeat already shows initials. Conditional rendering: if stream exists AND camera is on, show video; else show initials. Same logic as current VideoCallPanel's `showVideo`. |
| CAM-03 | Player can toggle mic on/off during a game | Toggle logic already exists in VideoCallPanel/VideoTile. Move the mic toggle button to render near the local player's PlayerSeat (bottom position). |
| CAM-04 | Player can toggle camera on/off during a game | Same as CAM-03 -- camera toggle logic exists. Move to inline position near local player's seat. |
| CAM-05 | Active speaker shows a visual glow/ring around their avatar | New feature: use Web Audio API AnalyserNode to detect audio levels on each remote stream, plus local stream. When level exceeds threshold, add a CSS glow ring (similar to existing `neon-glow` but green/speaking-colored). |
</phase_requirements>

## Standard Stack

### Core (Already in Project)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React | ^18.2.0 | UI framework | Already in use |
| Zustand | ^4.4.7 | State management (callStore) | Already in use |
| Tailwind CSS | ^3.4.0 | Styling | Already in use |
| Socket.io-client | ^4.7.2 | WebRTC signaling transport | Already in use |

### New (No Dependencies Needed)
| API | Purpose | Why |
|-----|---------|-----|
| Web Audio API (built-in) | Speaking detection via AnalyserNode | Browser-native, no library needed |
| CSS `object-fit: cover` + `border-radius: 50%` | Circular video cropping | Pure CSS, no library needed |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Web Audio API AnalyserNode | hark.js library | hark.js adds a dependency for ~30 lines of code we can write ourselves. Web Audio API is well-supported and simpler for this use case. |
| CSS circular crop | Canvas-based circular rendering | Canvas adds complexity; CSS `border-radius: 50%` + `overflow: hidden` on `<video>` is the standard approach and works everywhere. |

**Installation:** No new packages needed.

## Architecture Patterns

### Recommended Changes

```
client/src/
├── components/
│   ├── player/
│   │   ├── PlayerSeat.tsx        # MODIFY: accept stream prop, render video in avatar circle
│   │   ├── AvatarVideo.tsx       # NEW: circular video element with fallback
│   │   ├── CallControls.tsx      # NEW: mic/camera toggle buttons for local player
│   │   └── VideoTile.tsx         # DELETE or leave unused (replaced by AvatarVideo)
│   └── game/
│       ├── GameTable.tsx         # MODIFY: pass streams to PlayerSeat, add RemoteAudio, remove VideoCallPanel
│       ├── VideoCallPanel.tsx    # DELETE: replaced by inline avatars
│       └── JoinCallButton.tsx    # NEW: floating button to join call mid-game
├── hooks/
│   ├── useWebRTC.ts              # NO CHANGES needed
│   ├── useSpeakingDetection.ts   # NEW: audio level monitoring hook
│   └── useSocket.ts              # NO CHANGES needed
└── store/
    └── callStore.ts              # MODIFY: add speakingPeers state
```

### Pattern 1: Circular Video Avatar
**What:** Render a `<video>` element inside a circle using CSS, with initials fallback
**When to use:** Whenever a player has an active video stream and camera enabled
**Example:**
```typescript
// AvatarVideo.tsx
function AvatarVideo({ stream, initials, size, teamColor, isSpeaking, isCurrentTurn }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.srcObject = stream
      stream && videoRef.current.play().catch(() => {})
    }
    return () => { if (videoRef.current) videoRef.current.srcObject = null }
  }, [stream])

  const showVideo = stream !== null

  return (
    <div
      className="relative rounded-full overflow-hidden"
      style={{
        width: size, height: size,
        border: `2px solid ${isSpeaking ? '#22C55E' : isCurrentTurn ? teamColor : 'rgba(255,255,255,0.15)'}`,
        boxShadow: isSpeaking ? '0 0 12px rgba(34,197,94,0.6)' : undefined,
      }}
    >
      {showVideo ? (
        <video
          ref={videoRef}
          autoPlay playsInline muted
          className="w-full h-full object-cover"
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center font-header text-sm"
          style={{ background: teamColor + '30', color: 'white' }}>
          {initials}
        </div>
      )}
    </div>
  )
}
```

### Pattern 2: Speaking Detection via Web Audio API
**What:** Use AnalyserNode to monitor audio levels on MediaStreams and flag who is speaking
**When to use:** For each connected peer's remote stream + local stream
**Example:**
```typescript
// useSpeakingDetection.ts
function useSpeakingDetection(streams: Record<number, MediaStream | null>, localStream: MediaStream | null, myIndex: number) {
  const [speakingMap, setSpeakingMap] = useState<Record<number, boolean>>({})

  useEffect(() => {
    const audioCtx = new AudioContext()
    const analysers: { index: number; analyser: AnalyserNode; source: MediaStreamAudioSourceNode }[] = []

    // Setup analyser for each stream
    const allStreams = { ...streams, [myIndex]: localStream }
    for (const [idx, stream] of Object.entries(allStreams)) {
      if (!stream) continue
      const audioTracks = stream.getAudioTracks()
      if (audioTracks.length === 0) continue

      const source = audioCtx.createMediaStreamSource(stream)
      const analyser = audioCtx.createAnalyser()
      analyser.fftSize = 256
      analyser.smoothingTimeConstant = 0.5
      source.connect(analyser)
      // Do NOT connect to audioCtx.destination -- analysis only
      analysers.push({ index: Number(idx), analyser, source })
    }

    const dataArray = new Uint8Array(128)
    const THRESHOLD = 30 // Tunable: 0-255, higher = less sensitive

    let rafId: number
    function poll() {
      const newMap: Record<number, boolean> = {}
      for (const { index, analyser } of analysers) {
        analyser.getByteFrequencyData(dataArray)
        const avg = dataArray.reduce((a, b) => a + b, 0) / dataArray.length
        newMap[index] = avg > THRESHOLD
      }
      setSpeakingMap(prev => {
        // Only update if changed (avoid re-renders)
        const changed = Object.keys(newMap).some(k => prev[Number(k)] !== newMap[Number(k)])
        return changed ? newMap : prev
      })
      rafId = requestAnimationFrame(poll)
    }
    poll()

    return () => {
      cancelAnimationFrame(rafId)
      analysers.forEach(({ source }) => source.disconnect())
      audioCtx.close()
    }
  }, [streams, localStream, myIndex])

  return speakingMap
}
```

### Pattern 3: Remote Audio Playback (Preserved from VideoCallPanel)
**What:** Hidden `<audio>` elements for each remote stream so audio plays regardless of UI state
**When to use:** Always render for connected peers, even when video is off
**Example:**
```typescript
// Extracted from current VideoCallPanel -- move to GameTable
function RemoteAudio({ stream }: { stream: MediaStream | null }) {
  const audioRef = useRef<HTMLAudioElement>(null)
  useEffect(() => {
    if (!audioRef.current) return
    audioRef.current.srcObject = stream ?? null
    if (stream) audioRef.current.play().catch(e => console.warn('audio play blocked:', e))
    return () => { if (audioRef.current) audioRef.current.srcObject = null }
  }, [stream])
  return <audio ref={audioRef} autoPlay />
}
```

### Anti-Patterns to Avoid
- **Connecting AnalyserNode to destination:** This would cause echo/feedback. Only connect MediaStreamSource -> AnalyserNode, never -> audioCtx.destination.
- **Polling audio levels with setInterval:** Use `requestAnimationFrame` for smooth, battery-efficient polling that automatically pauses when tab is backgrounded.
- **Re-creating AudioContext per stream change:** Create one AudioContext and add/remove sources as streams change. AudioContext creation is expensive and browsers limit concurrent contexts.
- **Rendering `<video>` when stream is null:** This causes black rectangles. Always guard with conditional rendering.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Circular video | Canvas-based circle masking | CSS `border-radius: 50%` + `overflow: hidden` | Pure CSS, GPU-accelerated, zero JS overhead |
| Speaking detection | Voice Activity Detection (VAD) algorithm | Web Audio API AnalyserNode + frequency average | AnalyserNode is built-in, VAD adds complexity for marginal accuracy gain in a casual game |
| WebRTC connections | New signaling logic | Existing `useWebRTC.ts` hook | Already handles perfect negotiation, ICE, stream setup |
| Toggle controls | New toggle state management | Existing `callStore` mic/camera state + socket emit pattern | Already works in VideoCallPanel |

**Key insight:** This phase requires zero new networking or WebRTC code. Everything needed for peer connections, signaling, and media state already exists. The work is purely UI restructuring + adding the speaking detection feature.

## Common Pitfalls

### Pitfall 1: Video Element Sizing in Circle
**What goes wrong:** Video appears stretched or letterboxed inside the circular avatar
**Why it happens:** Default `<video>` sizing respects aspect ratio, creating gaps in a square/circle container
**How to avoid:** Always use `object-fit: cover` on the video element. This crops to fill the circle. The avatar is small enough (~40-48px) that cropping is imperceptible.
**Warning signs:** Black bars visible inside the circle, or the circle not being filled

### Pitfall 2: AudioContext Autoplay Policy
**What goes wrong:** `new AudioContext()` starts in "suspended" state on mobile browsers
**Why it happens:** Browsers require user gesture before allowing audio processing
**How to avoid:** Create AudioContext only after user clicks "Join Call" (which is already a user gesture). If suspended, call `audioCtx.resume()` on next user interaction.
**Warning signs:** Speaking indicators never activate on mobile

### Pitfall 3: Memory Leak from Unreleased Audio Sources
**What goes wrong:** Creating MediaStreamAudioSourceNode without disconnecting on cleanup leaks audio processing nodes
**Why it happens:** Each new source node holds a reference to the stream and AudioContext
**How to avoid:** Track all created sources and call `source.disconnect()` in the useEffect cleanup. Also close the AudioContext.
**Warning signs:** Increasing memory usage over long game sessions

### Pitfall 4: Excessive Re-renders from Speaking State
**What goes wrong:** Speaking detection updates state on every animation frame, causing React re-render storms
**Why it happens:** `setSpeakingMap` called 60 times/second with new objects
**How to avoid:** Compare previous and next speaking maps; only update state when a player's speaking status actually changes. Use refs for the polling data, only promote to state on transitions.
**Warning signs:** UI lag during video calls, React DevTools showing excessive PlayerSeat renders

### Pitfall 5: iOS PWA Camera Permissions
**What goes wrong:** Camera access fails silently in iOS PWA standalone mode
**Why it happens:** iOS limits getUserMedia in some WebView contexts; varies by iOS version
**How to avoid:** The initials fallback (CAM-02) naturally handles this. Ensure `getUserMedia` errors are caught gracefully and the UI shows initials instead of a broken state.
**Warning signs:** Works in Safari but not when launched from home screen (already noted in STATE.md blockers)

### Pitfall 6: Removing VideoCallPanel Breaks Audio
**What goes wrong:** Deleting VideoCallPanel also removes the RemoteAudio elements, killing all audio
**Why it happens:** RemoteAudio is currently rendered inside VideoCallPanel
**How to avoid:** Extract RemoteAudio rendering to GameTable level before deleting VideoCallPanel. Audio elements must always be in the DOM for connected peers.
**Warning signs:** Video works but no audio after removing the panel

## Code Examples

### Current PlayerSeat Avatar (to be modified)
```typescript
// Current: 32x32 initials circle
<div className="flex items-center justify-center w-8 h-8 rounded-full font-header text-sm">
  {initials}
</div>
```

### Target: PlayerSeat with Video Avatar
```typescript
// New: 40x40 circle with video or initials fallback
<div className="relative rounded-full overflow-hidden w-10 h-10"
  style={{
    border: `2px solid ${speakingBorder}`,
    boxShadow: isSpeaking ? '0 0 10px rgba(34,197,94,0.5)' : undefined
  }}>
  {showVideo ? (
    <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
  ) : (
    <div className="w-full h-full flex items-center justify-center font-header text-sm"
      style={{ background: teamColor + '30', color: 'white' }}>
      {initials}
    </div>
  )}
</div>
```

### Speaking Detection Threshold Tuning
```typescript
// Frequency analysis approach (more reliable than time-domain for speech)
analyser.getByteFrequencyData(dataArray)
// Average of frequency bins -- speech typically in 85-255Hz range
// With fftSize=256 and 48kHz sample rate, each bin is ~187Hz
// Bins 0-3 roughly cover speech fundamentals
const speechBins = dataArray.slice(0, 8)
const avg = speechBins.reduce((a, b) => a + b, 0) / speechBins.length
const isSpeaking = avg > 25 // Tune this threshold
```

### Join Call Button (replaces VideoCallPanel's join UI)
```typescript
// Floating button when not in call, rendered in GameTable
{!inCall && (
  <button onClick={() => joinCallRef.current?.(true, true)}
    className="fixed bottom-20 right-4 z-30 rounded-full bg-green-600 text-white px-4 py-2 shadow-lg">
    Unirse a llamada
  </button>
)}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Side panel with rectangular video tiles | Inline circular video avatars at seat positions | This phase | Video integrated into game layout, less UI clutter |
| No speaking detection | Web Audio API AnalyserNode for VAD | This phase | Visual feedback for who is talking |
| VideoCallPanel toggle drawer | Always-visible avatar + floating controls | This phase | Simpler UX, no hidden panel to discover |

## Open Questions

1. **Avatar size for mobile**
   - What we know: Current PlayerSeat avatar is 32x32 (w-8 h-8). Video needs slightly more space to be useful.
   - What's unclear: Whether 40x40 or 48x48 works on small mobile screens without overlapping the game board.
   - Recommendation: Start with 40x40 (w-10 h-10), test on mobile. The existing grid layout should accommodate this since PlayerSeat cells already have padding.

2. **Speaking detection polling rate**
   - What we know: requestAnimationFrame runs at ~60fps. Checking audio 60 times/second may be overkill.
   - What's unclear: Whether throttling to ~10fps would save meaningful battery on mobile.
   - Recommendation: Use requestAnimationFrame but only update React state on transitions (speaking -> not speaking or vice versa). The RAF polling itself is cheap; only state updates cause renders.

3. **Join call UX without VideoCallPanel**
   - What we know: Currently users join via lobby toggles or the VideoCallPanel's in-game join buttons.
   - What's unclear: Best placement for a "join call" button that doesn't clutter the game table.
   - Recommendation: A small floating action button in the bottom-right corner, visible only when not in a call. Disappears once joined.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | None configured (TypeScript strict mode is primary check) |
| Config file | N/A |
| Quick run command | `cd client && npx tsc --noEmit` |
| Full suite command | `cd client && npx tsc --noEmit && cd ../server && npx tsc --noEmit` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CAM-01 | Video displays in circular avatar | manual-only | N/A (requires camera + WebRTC) | N/A |
| CAM-02 | Initials fallback when camera off | manual-only | N/A (requires camera toggle) | N/A |
| CAM-03 | Mic toggle works during gameplay | manual-only | N/A (requires audio device) | N/A |
| CAM-04 | Camera toggle works during gameplay | manual-only | N/A (requires video device) | N/A |
| CAM-05 | Speaking glow indicator | manual-only | N/A (requires audio + WebRTC) | N/A |

**Justification for manual-only:** All requirements involve real hardware (camera, microphone) and peer-to-peer WebRTC connections. Type-checking via `tsc --noEmit` validates code correctness.

### Sampling Rate
- **Per task commit:** `cd client && npx tsc --noEmit`
- **Per wave merge:** Full suite `cd client && npx tsc --noEmit && cd ../server && npx tsc --noEmit`
- **Phase gate:** Full suite green + manual testing with camera/mic on deployed app

### Wave 0 Gaps
None -- no test infrastructure changes needed. TypeScript strict mode provides compile-time validation.

## Sources

### Primary (HIGH confidence)
- Existing codebase: `useWebRTC.ts`, `callStore.ts`, `VideoCallPanel.tsx`, `VideoTile.tsx`, `PlayerSeat.tsx`, `GameTable.tsx` -- direct code analysis
- MDN Web Audio API: AnalyserNode, createMediaStreamSource -- standard browser API

### Secondary (MEDIUM confidence)
- Web Audio API speaking detection pattern is widely used (Google Meet, Jitsi, Discord web all use AnalyserNode for VAD)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - no new dependencies, all code exists in project
- Architecture: HIGH - straightforward UI refactor of existing working code
- Pitfalls: HIGH - well-known WebRTC/Web Audio patterns, documented from Phase 5/9 experience
- Speaking detection: MEDIUM - threshold tuning will need real-device testing

**Research date:** 2026-03-13
**Valid until:** 2026-04-13 (stable -- no fast-moving dependencies)

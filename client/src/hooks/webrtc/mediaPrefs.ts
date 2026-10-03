/** Minimal track/stream shapes so this logic runs (and is tested) outside a browser. */
export interface TrackLike {
  kind: string
  enabled: boolean
  stop(): void
}
export interface StreamLike<T extends TrackLike = TrackLike> {
  getTracks(): T[]
  getAudioTracks(): T[]
  getVideoTracks(): T[]
}

export interface MediaPrefs {
  micMuted: boolean
  cameraOff: boolean
}

/**
 * Enforce the player's current mute/camera choice on a stream. Every stream
 * we publish passes through here, so a recovered or re-acquired stream can
 * never transmit something the UI shows as off.
 */
export function applyMediaPrefs(stream: StreamLike, prefs: MediaPrefs) {
  for (const t of stream.getAudioTracks()) t.enabled = !prefs.micMuted
  for (const t of stream.getVideoTracks()) t.enabled = !prefs.cameraOff
}

/** What a stream can actually send (the audio-only fallback may drop video). */
export function capabilitiesOf(stream: StreamLike): { audio: boolean; video: boolean } {
  return { audio: stream.getAudioTracks().length > 0, video: stream.getVideoTracks().length > 0 }
}

export function stopStream(stream: StreamLike | null | undefined) {
  stream?.getTracks().forEach(t => t.stop())
}

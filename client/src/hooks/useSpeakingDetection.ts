import { useEffect, useRef } from 'react'
import { useCallStore } from '../store/callStore'
import { getAudioContext } from '../audio/audioContext'

interface AnalyserEntry {
  playerIndex: number
  analyser: AnalyserNode
  source: MediaStreamAudioSourceNode
  dataArray: Uint8Array<ArrayBuffer>
}

const SPEAKING_THRESHOLD = 25
const SPEECH_BINS = 8

export function useSpeakingDetection(
  remoteStreams: Record<number, MediaStream | null>,
  localStream: MediaStream | null,
  myIndex: number
): void {
  const prevSpeakingRef = useRef<Record<number, boolean>>({})
  const prevStreamIdsRef = useRef<string>('')
  const analysersRef = useRef<AnalyserEntry[]>([])
  const rafRef = useRef<number>(0)

  useEffect(() => {
    // Build a map of all streams keyed by player index
    const allStreams: Record<number, MediaStream> = {}
    for (const [key, stream] of Object.entries(remoteStreams)) {
      if (stream) allStreams[Number(key)] = stream
    }
    if (localStream) allStreams[myIndex] = localStream

    // Check if streams actually changed by comparing stream IDs
    const streamIdKey = Object.entries(allStreams)
      .sort(([a], [b]) => Number(a) - Number(b))
      .map(([idx, s]) => `${idx}:${s.id}`)
      .join('|')

    if (streamIdKey === prevStreamIdsRef.current) return
    prevStreamIdsRef.current = streamIdKey

    // Cleanup previous
    cancelAnimationFrame(rafRef.current)
    analysersRef.current.forEach(entry => {
      try { entry.source.disconnect() } catch {}
    })
    analysersRef.current = []

    // If no streams, clear speaking state
    if (Object.keys(allStreams).length === 0) {
      if (Object.keys(prevSpeakingRef.current).length > 0) {
        prevSpeakingRef.current = {}
        useCallStore.getState().setSpeakingPeers({})
      }
      return
    }

    // Use shared AudioContext singleton
    const audioCtx = getAudioContext()

    // Create analysers for each stream with audio tracks
    const entries: AnalyserEntry[] = []
    for (const [idxStr, stream] of Object.entries(allStreams)) {
      if (stream.getAudioTracks().length === 0) continue

      const source = audioCtx.createMediaStreamSource(stream)
      const analyser = audioCtx.createAnalyser()
      analyser.fftSize = 256
      analyser.smoothingTimeConstant = 0.5
      source.connect(analyser)
      // Do NOT connect to destination (would cause echo)

      entries.push({
        playerIndex: Number(idxStr),
        analyser,
        source,
        dataArray: new Uint8Array(analyser.frequencyBinCount),
      })
    }
    analysersRef.current = entries

    // Poll loop
    function poll() {
      const newSpeaking: Record<number, boolean> = {}
      let changed = false

      for (const entry of analysersRef.current) {
        entry.analyser.getByteFrequencyData(entry.dataArray)

        // Average of first SPEECH_BINS bins (speech frequencies)
        let sum = 0
        for (let i = 0; i < SPEECH_BINS; i++) {
          sum += entry.dataArray[i]
        }
        const avg = sum / SPEECH_BINS
        const speaking = avg > SPEAKING_THRESHOLD

        newSpeaking[entry.playerIndex] = speaking

        if (prevSpeakingRef.current[entry.playerIndex] !== speaking) {
          changed = true
        }
      }

      if (changed) {
        prevSpeakingRef.current = newSpeaking
        useCallStore.getState().setSpeakingPeers(newSpeaking)
      }

      rafRef.current = requestAnimationFrame(poll)
    }

    rafRef.current = requestAnimationFrame(poll)

    return () => {
      cancelAnimationFrame(rafRef.current)
      entries.forEach(entry => {
        try { entry.source.disconnect() } catch {}
      })
      prevStreamIdsRef.current = ''
    }
  }, [remoteStreams, localStream, myIndex])
}

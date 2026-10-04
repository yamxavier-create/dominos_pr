import { useEffect, useRef } from 'react'
import { useWebRTC } from '../../hooks/useWebRTC'
import { useSpeakingDetection } from '../../hooks/useSpeakingDetection'
import { useCallStore } from '../../store/callStore'
import { useRoomStore } from '../../store/roomStore'

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

/**
 * The room's video call, alive from the lobby through every game until the
 * player leaves the room. Pages only draw the streams; the audio plays here,
 * so nobody goes silent while the screen changes.
 */
export function CallHost() {
  useWebRTC()
  const localStream = useCallStore(s => s.localStream)
  const remoteStreams = useCallStore(s => s.remoteStreams)
  const inCall = useCallStore(s => s.myAudioEnabled || s.myVideoEnabled)
  const myPlayerIndex = useRoomStore(s => s.myPlayerIndex) ?? 0

  useSpeakingDetection(remoteStreams, localStream, myPlayerIndex)

  if (!inCall) return null
  return (
    <>
      {Object.entries(remoteStreams).map(([idx, stream]) => (
        <RemoteAudio key={`audio-${idx}`} stream={stream} />
      ))}
    </>
  )
}

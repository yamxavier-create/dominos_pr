import { useRef, useEffect, RefObject } from 'react'

/** Attach a MediaStream to a <video> and keep it playing (iOS pauses it on background). */
export function useVideoStream(videoRef: RefObject<HTMLVideoElement>, stream: MediaStream | null, active: boolean) {
  useEffect(() => {
    const video = videoRef.current
    if (!video || !active) return

    video.srcObject = stream
    if (stream) {
      video.play().catch(() => {})
    }

    // Recovery: if video pauses/stalls, re-play
    const handlePause = () => {
      if (stream && stream.active) {
        video.play().catch(() => {})
      }
    }

    video.addEventListener('pause', handlePause)

    return () => {
      video.removeEventListener('pause', handlePause)
      video.srcObject = null
    }
  }, [stream, active, videoRef])
}

interface AvatarVideoProps {
  stream: MediaStream | null
  initials: string
  teamColor: string     // camera background when it's off
  isCurrentTurn: boolean
  isSpeaking: boolean
  isCameraOff: boolean
  size?: number
}

/** Square camera tile used by the side seats (landscape and desktop layouts). */
export function AvatarVideo({
  stream,
  initials,
  teamColor,
  isCurrentTurn,
  isSpeaking,
  isCameraOff,
  size = 40,
}: AvatarVideoProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const showVideo = stream !== null && !isCameraOff
  useVideoStream(videoRef, stream, showVideo)

  // Turn = brass, speaking = cream, otherwise a quiet cream edge
  const borderColor = isCurrentTurn ? '#C9A24A' : isSpeaking ? '#F1E3C2' : 'rgba(241, 227, 194, 0.45)'

  return (
    <div
      className="overflow-hidden flex-shrink-0"
      style={{
        width: size,
        height: size,
        borderRadius: 8,
        border: `${isCurrentTurn ? 3 : 2}px solid ${borderColor}`,
        background: teamColor,
        transition: 'border-color 0.3s',
      }}
    >
      {showVideo ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="w-full h-full object-cover"
        />
      ) : (
        <div
          className="w-full h-full flex items-center justify-center font-club font-bold text-club-text"
          style={{ fontSize: size * 0.32 }}
        >
          {initials}
        </div>
      )}
    </div>
  )
}

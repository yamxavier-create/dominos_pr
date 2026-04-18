import { useRef, useEffect } from 'react'

interface AvatarVideoProps {
  stream: MediaStream | null
  initials: string
  teamColor: string
  isCurrentTurn: boolean
  isSpeaking: boolean
  isCameraOff: boolean
  size?: number
}

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

  useEffect(() => {
    const video = videoRef.current
    if (!video) return

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
  }, [stream])

  const showVideo = stream !== null && !isCameraOff

  const borderColor = isCurrentTurn
    ? '#EAB308'
    : isSpeaking
      ? '#22C55E'
      : 'rgba(255,255,255,0.15)'

  // When it's the player's turn, the CSS animation drives box-shadow;
  // don't set it inline or we override the pulse.
  const inlineShadow = isCurrentTurn
    ? undefined
    : isSpeaking
      ? '0 0 12px rgba(34,197,94,0.6)'
      : 'none'

  return (
    <div
      className={`rounded-full overflow-hidden flex-shrink-0 ${isCurrentTurn ? 'avatar-turn-pulse' : ''}`}
      style={{
        width: size,
        height: size,
        border: `2px solid ${borderColor}`,
        ...(inlineShadow !== undefined ? { boxShadow: inlineShadow } : {}),
        transition: 'border-color 0.3s, box-shadow 0.3s',
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
          className="w-full h-full flex items-center justify-center text-white font-bold"
          style={{
            background: teamColor + '30',
            fontSize: size * 0.35,
          }}
        >
          {initials}
        </div>
      )}
    </div>
  )
}

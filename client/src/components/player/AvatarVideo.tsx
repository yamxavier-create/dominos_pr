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

    return () => {
      video.srcObject = null
    }
  }, [stream])

  const showVideo = stream !== null && !isCameraOff

  const borderColor = isSpeaking
    ? '#22C55E'
    : isCurrentTurn
      ? teamColor
      : 'rgba(255,255,255,0.15)'

  const boxShadow = isSpeaking ? '0 0 12px rgba(34,197,94,0.6)' : 'none'

  return (
    <div
      className="rounded-full overflow-hidden flex-shrink-0"
      style={{
        width: size,
        height: size,
        border: `2px solid ${borderColor}`,
        boxShadow,
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

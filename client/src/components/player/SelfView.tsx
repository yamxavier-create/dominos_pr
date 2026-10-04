import { useRef } from 'react'
import { useCallStore } from '../../store/callStore'
import { useVideoStream } from './AvatarVideo'

/**
 * Your own camera, small, in the button row (phone portrait, where your seat
 * isn't drawn). Mirrored like a selfie. Only takes room while the camera is on.
 */
export function SelfView({ size = 46 }: { size?: number }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const localStream = useCallStore(s => s.localStream)
  const cameraOff = useCallStore(s => s.cameraOff)
  const hasVideo = useCallStore(s => (s.localStream?.getVideoTracks().length ?? 0) > 0)
  const show = !!localStream && hasVideo && !cameraOff
  useVideoStream(videoRef, localStream, show)

  if (!show) return null
  return (
    <div
      className="shrink-0 overflow-hidden bg-club-strip"
      style={{ width: size, height: size, borderRadius: 6, border: '2px solid #C9A24A', boxShadow: '0 3px 0 #07160E' }}
      aria-label="Tu cámara"
      role="img"
    >
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="w-full h-full object-cover"
        style={{ transform: 'scaleX(-1)' }}
      />
    </div>
  )
}

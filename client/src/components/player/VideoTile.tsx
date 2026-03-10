import { useEffect, useRef } from 'react'
import { ClientPlayer } from '../../types/game'
import { useCallStore } from '../../store/callStore'
import { socket } from '../../socket'
import { useRoomStore } from '../../store/roomStore'

interface VideoTileProps {
  player: ClientPlayer
  playerIndex: number
  isMe: boolean
  isCurrentTurn: boolean
  position: 'bottom' | 'top' | 'left' | 'right'
  teamLabel: string
  teamColor: string
  stream: MediaStream | null
  micMuted: boolean
  cameraOff: boolean  // remote peer's camera state
}

export function VideoTile({
  player, playerIndex, isMe, isCurrentTurn, position,
  teamLabel, teamColor, stream, micMuted, cameraOff,
}: VideoTileProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const ownMicMuted = useCallStore(s => s.micMuted)
  const ownCameraOff = useCallStore(s => s.cameraOff)
  const roomCode = useRoomStore(s => s.roomCode)

  // Assign srcObject via ref — never in render
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.srcObject = stream ?? null
    }
    return () => {
      if (videoRef.current) {
        videoRef.current.srcObject = null
      }
    }
  }, [stream])

  const handleToggleMic = (e: React.MouseEvent) => {
    e.stopPropagation()
    const newMuted = !ownMicMuted
    useCallStore.getState().setMicMuted(newMuted)
    // Disable actual track — no renegotiation needed
    const localStream = useCallStore.getState().localStream
    localStream?.getAudioTracks().forEach(t => { t.enabled = !newMuted })
    socket.emit('webrtc:toggle', { roomCode, micMuted: newMuted, cameraOff: ownCameraOff })
  }

  const handleToggleCamera = (e: React.MouseEvent) => {
    e.stopPropagation()
    const newOff = !ownCameraOff
    useCallStore.getState().setCameraOff(newOff)
    const localStream = useCallStore.getState().localStream
    localStream?.getVideoTracks().forEach(t => { t.enabled = !newOff })
    socket.emit('webrtc:toggle', { roomCode, micMuted: ownMicMuted, cameraOff: newOff })
  }

  const initials = player.name.slice(0, 2).toUpperCase()
  const showVideo = stream !== null && !(isMe ? ownCameraOff : cameraOff)

  // Suppress unused variable warning — position is part of the public API contract
  void position
  void playerIndex
  void teamLabel

  return (
    <div
      className="relative flex flex-col items-center gap-1"
      style={{ minWidth: 56 }}
    >
      {/* Video / Avatar container */}
      <div
        className="relative overflow-hidden rounded-xl"
        style={{
          width: 56,
          height: 42,
          border: `2px solid ${isCurrentTurn ? teamColor : 'rgba(255,255,255,0.15)'}`,
          boxShadow: isCurrentTurn ? `0 0 8px ${teamColor}80` : undefined,
          background: '#111',
        }}
      >
        {showVideo ? (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted={isMe}  // mute own video to prevent feedback; others auto-play with audio
            className="w-full h-full object-cover"
          />
        ) : (
          <div
            className="w-full h-full flex items-center justify-center font-bold text-sm"
            style={{ background: teamColor + '40', color: 'white' }}
          >
            {initials}
          </div>
        )}

        {/* Mic-muted badge for other players */}
        {!isMe && micMuted && (
          <div
            className="absolute bottom-1 right-1 rounded-full bg-red-600 text-white"
            style={{ fontSize: 8, padding: '1px 3px' }}
            title="Mic muted"
          >
            M
          </div>
        )}

        {/* Own-tile controls: mic and camera toggles */}
        {isMe && (
          <div className="absolute bottom-1 right-1 flex gap-1">
            <button
              onClick={handleToggleMic}
              className="rounded-full flex items-center justify-center text-white"
              style={{
                width: 16, height: 16, fontSize: 8,
                background: ownMicMuted ? 'rgba(220,38,38,0.85)' : 'rgba(0,0,0,0.6)',
              }}
              title={ownMicMuted ? 'Unmute mic' : 'Mute mic'}
            >
              {ownMicMuted ? 'M' : 'U'}
            </button>
            <button
              onClick={handleToggleCamera}
              className="rounded-full flex items-center justify-center text-white"
              style={{
                width: 16, height: 16, fontSize: 8,
                background: ownCameraOff ? 'rgba(220,38,38,0.85)' : 'rgba(0,0,0,0.6)',
              }}
              title={ownCameraOff ? 'Turn camera on' : 'Turn camera off'}
            >
              {ownCameraOff ? 'C' : 'V'}
            </button>
          </div>
        )}
      </div>

      {/* Player name + tile count — preserved from PlayerSeat */}
      <div className="flex items-center gap-1">
        <span
          className="font-body text-xs truncate max-w-[52px]"
          style={{ color: isCurrentTurn ? teamColor : 'rgba(255,255,255,0.6)' }}
        >
          {player.name}
        </span>
        <span
          className="font-body text-xs opacity-60"
          style={{ color: isCurrentTurn ? teamColor : 'rgba(255,255,255,0.6)' }}
        >
          {player.tileCount}
        </span>
      </div>
    </div>
  )
}

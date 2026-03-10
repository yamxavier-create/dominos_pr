import { useEffect, useRef, useState } from 'react'
import { useCallStore } from '../../store/callStore'
import { useRoomStore } from '../../store/roomStore'
import { socket } from '../../socket'
import { ClientPlayer } from '../../types/game'
import { joinCallRef } from '../../hooks/useWebRTC'

interface VideoCallPanelProps {
  players: (ClientPlayer | undefined)[]
  myPlayerIndex: number
  currentPlayerIndex: number
}

function teamColor(playerIndex: number): string {
  return playerIndex % 2 === 0 ? '#22C55E' : '#F97316'
}

interface SingleTileProps {
  player: ClientPlayer
  playerIndex: number
  isMe: boolean
  isCurrentTurn: boolean
  stream: MediaStream | null
  micMuted: boolean
  cameraOff: boolean
}

function SingleTile({ player, playerIndex, isMe, isCurrentTurn, stream, micMuted, cameraOff }: SingleTileProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const ownMicMuted = useCallStore(s => s.micMuted)
  const ownCameraOff = useCallStore(s => s.cameraOff)
  const roomCode = useRoomStore(s => s.roomCode)
  const color = teamColor(playerIndex)

  useEffect(() => {
    if (!videoRef.current) return
    // React doesn't sync the `muted` prop to the DOM attribute — set it imperatively
    videoRef.current.muted = isMe
    videoRef.current.srcObject = stream ?? null
    if (stream) videoRef.current.play().catch(() => {})
    return () => { if (videoRef.current) videoRef.current.srcObject = null }
  }, [stream, isMe])

  const handleToggleMic = (e: React.MouseEvent) => {
    e.stopPropagation()
    const newMuted = !ownMicMuted
    useCallStore.getState().setMicMuted(newMuted)
    useCallStore.getState().localStream?.getAudioTracks().forEach(t => { t.enabled = !newMuted })
    socket.emit('webrtc:toggle', { roomCode, micMuted: newMuted, cameraOff: ownCameraOff })
  }

  const handleToggleCamera = (e: React.MouseEvent) => {
    e.stopPropagation()
    const newOff = !ownCameraOff
    useCallStore.getState().setCameraOff(newOff)
    useCallStore.getState().localStream?.getVideoTracks().forEach(t => { t.enabled = !newOff })
    socket.emit('webrtc:toggle', { roomCode, micMuted: ownMicMuted, cameraOff: newOff })
  }

  const initials = player.name.slice(0, 2).toUpperCase()
  const showVideo = stream !== null && !(isMe ? ownCameraOff : cameraOff)

  return (
    <div className="flex flex-col gap-1">
      {/* Video container */}
      <div
        className="relative overflow-hidden rounded-lg"
        style={{
          width: 160,
          height: 120,
          border: `2px solid ${isCurrentTurn ? color : 'rgba(255,255,255,0.12)'}`,
          boxShadow: isCurrentTurn ? `0 0 10px ${color}60` : undefined,
          background: '#0a0a0a',
        }}
      >
        {showVideo ? (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            className="w-full h-full object-cover"
          />
        ) : (
          <div
            className="w-full h-full flex items-center justify-center font-bold text-2xl"
            style={{ background: color + '20', color: 'white' }}
          >
            {initials}
          </div>
        )}

        {/* Player name overlay */}
        <div
          className="absolute bottom-0 left-0 right-0 px-2 py-1"
          style={{ background: 'linear-gradient(transparent, rgba(0,0,0,0.75))' }}
        >
          <span className="text-white text-xs font-bold truncate block">{player.name}</span>
        </div>

        {/* Mic muted badge (other players) */}
        {!isMe && micMuted && (
          <div className="absolute top-1.5 right-1.5 bg-red-600 rounded-full px-1.5 py-0.5 text-white text-xs font-bold">
            🔇
          </div>
        )}

        {/* Own controls */}
        {isMe && (
          <div className="absolute top-1.5 right-1.5 flex gap-1">
            <button
              onClick={handleToggleMic}
              className="w-7 h-7 rounded-full flex items-center justify-center text-sm text-white transition-colors"
              style={{ background: ownMicMuted ? 'rgba(220,38,38,0.9)' : 'rgba(0,0,0,0.6)' }}
              title={ownMicMuted ? 'Activar mic' : 'Silenciar mic'}
            >
              {ownMicMuted ? '🔇' : '🎤'}
            </button>
            <button
              onClick={handleToggleCamera}
              className="w-7 h-7 rounded-full flex items-center justify-center text-sm text-white transition-colors"
              style={{ background: ownCameraOff ? 'rgba(220,38,38,0.9)' : 'rgba(0,0,0,0.6)' }}
              title={ownCameraOff ? 'Activar cámara' : 'Apagar cámara'}
            >
              {ownCameraOff ? '📵' : '📷'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export function VideoCallPanel({ players, myPlayerIndex, currentPlayerIndex }: VideoCallPanelProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [joining, setJoining] = useState(false)
  const localStream = useCallStore(s => s.localStream)
  const remoteStreams = useCallStore(s => s.remoteStreams)
  const mutedPeers = useCallStore(s => s.mutedPeers)
  const cameraOffPeers = useCallStore(s => s.cameraOffPeers)
  const myAudioEnabled = useCallStore(s => s.myAudioEnabled)
  const myVideoEnabled = useCallStore(s => s.myVideoEnabled)

  const inCall = myAudioEnabled || myVideoEnabled

  const handleJoin = async (audio: boolean, video: boolean) => {
    setJoining(true)
    try {
      await joinCallRef.current?.(audio, video)
    } finally {
      setJoining(false)
    }
  }

  // Order: me first, then others in seat order
  const orderedIndices = [
    myPlayerIndex,
    (myPlayerIndex + 1) % 4,
    (myPlayerIndex + 2) % 4,
    (myPlayerIndex + 3) % 4,
  ]

  return (
    <div
      className="fixed right-0 top-1/2 z-40 flex items-center"
      style={{ transform: 'translateY(-50%)' }}
    >
      {/* Toggle tab */}
      <button
        onClick={() => setIsOpen(v => !v)}
        className="flex items-center justify-center rounded-l-lg text-white text-sm font-bold transition-colors hover:bg-black/70"
        style={{
          width: 24,
          height: 64,
          background: 'rgba(0,0,0,0.55)',
          backdropFilter: 'blur(4px)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRight: 'none',
          writingMode: 'vertical-rl',
          letterSpacing: 1,
        }}
        title={isOpen ? 'Ocultar cámaras' : 'Mostrar cámaras'}
      >
        {isOpen ? '▶' : '◀'}
      </button>

      {/* Panel */}
      <div
        className="flex flex-col gap-2 p-2 overflow-hidden transition-all duration-300"
        style={{
          width: isOpen ? 180 : 0,
          opacity: isOpen ? 1 : 0,
          background: 'rgba(0,0,0,0.6)',
          backdropFilter: 'blur(8px)',
          borderLeft: isOpen ? '1px solid rgba(255,255,255,0.1)' : 'none',
          pointerEvents: isOpen ? 'auto' : 'none',
        }}
      >
        {isOpen && !inCall && (
          <div className="flex flex-col gap-2 py-2">
            <p className="text-white/60 text-xs text-center leading-snug px-1">
              No te uniste a la llamada en el lobby
            </p>
            <button
              onClick={() => handleJoin(true, true)}
              disabled={joining}
              className="w-full rounded-lg py-2 text-white text-xs font-bold transition-colors disabled:opacity-50"
              style={{ background: '#22C55E' }}
            >
              {joining ? 'Conectando...' : '📷 Cámara + Mic'}
            </button>
            <button
              onClick={() => handleJoin(true, false)}
              disabled={joining}
              className="w-full rounded-lg py-2 text-white text-xs font-bold transition-colors disabled:opacity-50"
              style={{ background: 'rgba(255,255,255,0.12)' }}
            >
              {joining ? 'Conectando...' : '🎤 Solo Mic'}
            </button>
          </div>
        )}

        {isOpen && inCall && orderedIndices.map(idx => {
          const player = players[idx]
          if (!player) return null
          const isMe = idx === myPlayerIndex
          return (
            <SingleTile
              key={idx}
              player={player}
              playerIndex={idx}
              isMe={isMe}
              isCurrentTurn={currentPlayerIndex === idx}
              stream={isMe ? localStream : (remoteStreams[idx] ?? null)}
              micMuted={mutedPeers[idx] ?? false}
              cameraOff={cameraOffPeers[idx] ?? false}
            />
          )
        })}
      </div>
    </div>
  )
}

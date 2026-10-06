import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useRoomStore } from '../store/roomStore'
import { leaveRoomLocally } from '../store/leaveRoom'
import { socket } from '../socket'
import { RoomLobby } from '../components/lobby/RoomLobby'
import { AudioControls } from '../components/game/AudioControls'

export function LobbyPage() {
  const room = useRoomStore(s => s.room)
  const navigate = useNavigate()

  useEffect(() => {
    if (!room) {
      navigate('/')
    }
  }, [room, navigate])

  // Nothing is lost before the first game, so leave without asking
  const handleBack = () => {
    socket.emit('room:leave')
    leaveRoomLocally()
    navigate('/')
  }

  return (
    <div className="fixed inset-0 felt-table flex items-center justify-center px-4 py-4 overflow-y-auto">
      <button
        type="button"
        onClick={handleBack}
        className="fixed left-4 z-30 font-body text-white/40 hover:text-white/70 text-sm transition-colors"
        style={{ top: 'max(16px, env(safe-area-inset-top))' }}
      >
        ← Menú
      </button>
      <RoomLobby />
      <AudioControls />
    </div>
  )
}

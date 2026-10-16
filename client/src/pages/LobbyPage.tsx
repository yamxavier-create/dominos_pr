import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useRoomStore } from '../store/roomStore'
import { leaveRoomLocally } from '../store/leaveRoom'
import { socket } from '../socket'
import { RoomLobby } from '../components/lobby/RoomLobby'
import { AudioControls } from '../components/game/AudioControls'
import { StageBackdrop } from '../components/ui/Escenario'

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
    // my-auto rather than items-center: a lobby taller than the screen scrolls from its top instead of being cut off
    <div
      className="fixed inset-0 felt-table flex flex-col items-center px-4 pb-4 overflow-y-auto"
      style={{ paddingTop: 'max(16px, env(safe-area-inset-top))' }}
    >
      <StageBackdrop still />
      <div className="relative my-auto w-full max-w-sm flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={handleBack}
            className="btn-outline-shine rounded-xl px-3 py-1.5 font-chunky text-base tracking-wide mm-stroke"
          >
            ‹ Menú
          </button>
          <AudioControls />
        </div>
        <RoomLobby />
      </div>
    </div>
  )
}

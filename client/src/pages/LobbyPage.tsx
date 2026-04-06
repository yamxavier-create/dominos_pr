import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useRoomStore } from '../store/roomStore'
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

  return (
    <div className="fixed inset-0 felt-table flex flex-col items-center justify-center px-4 py-8 overflow-y-auto">
      <div className="m-auto">
        <RoomLobby />
      </div>
      <AudioControls />
    </div>
  )
}

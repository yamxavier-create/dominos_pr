import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useRoomStore } from '../store/roomStore'
import { RoomLobby } from '../components/lobby/RoomLobby'

export function LobbyPage() {
  const room = useRoomStore(s => s.room)
  const navigate = useNavigate()

  useEffect(() => {
    if (!room) {
      navigate('/')
    }
  }, [room, navigate])

  return (
    <div className="min-h-screen felt-table flex items-center justify-center p-4">
      <RoomLobby />
    </div>
  )
}

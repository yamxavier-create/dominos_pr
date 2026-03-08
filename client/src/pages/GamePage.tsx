import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useGameStore } from '../store/gameStore'
import { useRoomStore } from '../store/roomStore'
import { useUIStore } from '../store/uiStore'
import { GameTable } from '../components/game/GameTable'
import { ChatButton } from '../components/chat/ChatButton'
import { ChatPanel } from '../components/chat/ChatPanel'

export function GamePage() {
  const gameState = useGameStore(s => s.gameState)
  const room = useRoomStore(s => s.room)
  const chatOpen = useUIStore(s => s.chatOpen)
  const navigate = useNavigate()

  useEffect(() => {
    // If there's no room and no game state, redirect home
    if (!room && !gameState) {
      navigate('/')
    }
  }, [room, gameState, navigate])

  return (
    <>
      <GameTable />
      <ChatButton />
      {chatOpen && <ChatPanel />}
    </>
  )
}

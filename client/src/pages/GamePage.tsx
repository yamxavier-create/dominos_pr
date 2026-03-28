import { Component, useEffect, type ReactNode, type ErrorInfo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useGameStore } from '../store/gameStore'
import { useRoomStore } from '../store/roomStore'
import { useUIStore } from '../store/uiStore'
import { GameTable } from '../components/game/GameTable'
import { useWebRTC } from '../hooks/useWebRTC'
import { ChatButton } from '../components/chat/ChatButton'
import { ChatPanel } from '../components/chat/ChatPanel'

// Error boundary prevents a crash from showing the raw green background.
// Instead it shows a recovery UI that lets the player get back to the lobby.
class GameErrorBoundary extends Component<
  { children: ReactNode; onReset: () => void },
  { hasError: boolean }
> {
  state = { hasError: false }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[GamePage] Render crash caught by error boundary:', error, info.componentStack)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center h-screen felt-table gap-4 p-6 text-center">
          <p className="text-4xl">😵</p>
          <h2 className="font-header text-2xl text-gold">Algo salio mal</h2>
          <p className="font-body text-white/60 text-sm">
            El juego tuvo un error inesperado.
          </p>
          <button
            onClick={() => {
              this.setState({ hasError: false })
              this.props.onReset()
            }}
            className="px-6 py-3 rounded-xl font-body font-bold text-white"
            style={{ background: 'linear-gradient(135deg, #22C55E, #16a34a)' }}
          >
            Volver al lobby
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

export function GamePage() {
  const gameState = useGameStore(s => s.gameState)
  const room = useRoomStore(s => s.room)
  const chatOpen = useUIStore(s => s.chatOpen)
  const navigate = useNavigate()

  useWebRTC()

  useEffect(() => {
    if (!room && !gameState) {
      navigate('/')
    }
  }, [room, gameState, navigate])

  const handleErrorReset = () => {
    navigate('/lobby')
  }

  return (
    <GameErrorBoundary onReset={handleErrorReset}>
      <GameTable />
      <ChatButton />
      {chatOpen && <ChatPanel />}
    </GameErrorBoundary>
  )
}

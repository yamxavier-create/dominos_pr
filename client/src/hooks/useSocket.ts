import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { socket } from '../socket'
import { useGameStore } from '../store/gameStore'
import { useRoomStore } from '../store/roomStore'
import { useUIStore } from '../store/uiStore'
import { ClientGameState, RoundEndPayload, GameEndPayload, PassPayload } from '../types/game'

export function useSocket() {
  const navigate = useNavigate()
  const { setGameState, setRoundEnd, setGameEnd, setLastTileSequence } = useGameStore()
  const { setRoom, setMyPlayerIndex, setError, setRoomCode } = useRoomStore()
  const { addPasoNotification, setShowRoundEnd, setShowGameEnd, setSelectedTile } = useUIStore()

  useEffect(() => {
    if (!socket.connected) socket.connect()

    socket.on('room:created', ({ roomCode, room, myPlayerIndex }: {
      roomCode: string; room: any; myPlayerIndex: number
    }) => {
      setRoom(room)
      setRoomCode(roomCode)
      setMyPlayerIndex(myPlayerIndex)
      navigate('/lobby')
    })

    socket.on('room:joined', ({ roomCode, room, myPlayerIndex }: {
      roomCode: string; room: any; myPlayerIndex: number
    }) => {
      setRoom(room)
      setRoomCode(roomCode)
      setMyPlayerIndex(myPlayerIndex)
      navigate('/lobby')
    })

    socket.on('room:updated', ({ room }: { room: any }) => {
      setRoom(room)
    })

    socket.on('room:error', ({ message }: { message: string }) => {
      setError(message)
    })

    socket.on('game:started', ({ gameState }: { gameState: ClientGameState }) => {
      setGameState(gameState)
      navigate('/game')
    })

    socket.on('game:state_snapshot', ({
      gameState,
      lastAction,
    }: { gameState: ClientGameState; lastAction: any }) => {
      setGameState(gameState)
      // BUG-03: clear ghost tile selection when turn passes
      if (!gameState.isMyTurn) setSelectedTile(null)
      // BUG-01: use sequence to find newest tile, not array position (left-end plays land at index 0)
      if (lastAction?.type === 'play_tile' && gameState.board.tiles.length > 0) {
        const last = gameState.board.tiles.reduce((a, b) => a.sequence > b.sequence ? a : b)
        setLastTileSequence(last.sequence)
        setTimeout(() => setLastTileSequence(null), 500)
      }
    })

    socket.on('game:player_passed', (payload: PassPayload) => {
      addPasoNotification(payload)
      setTimeout(() => {
        useUIStore.getState().removePasoNotification(payload.playerIndex)
      }, 2500)
    })

    socket.on('game:round_ended', (data: RoundEndPayload) => {
      setRoundEnd(data)
      setShowRoundEnd(true)
    })

    socket.on('game:game_ended', (data: GameEndPayload) => {
      setGameEnd(data)
      setShowGameEnd(true)
    })

    socket.on('connection:player_disconnected', ({ playerIndex, playerName }: { playerIndex: number; playerName: string }) => {
      console.log(`Player ${playerName} (${playerIndex}) disconnected`)
    })

    socket.on('connection:player_reconnected', ({ playerIndex, playerName }: { playerIndex: number; playerName: string }) => {
      console.log(`Player ${playerName} (${playerIndex}) reconnected`)
    })

    return () => {
      socket.off('room:created')
      socket.off('room:joined')
      socket.off('room:updated')
      socket.off('room:error')
      socket.off('game:started')
      socket.off('game:state_snapshot')
      socket.off('game:player_passed')
      socket.off('game:round_ended')
      socket.off('game:game_ended')
      socket.off('connection:player_disconnected')
      socket.off('connection:player_reconnected')
    }
  }, [])
}

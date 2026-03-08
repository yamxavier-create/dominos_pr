import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { socket } from '../socket'
import { useGameStore } from '../store/gameStore'
import { useRoomStore } from '../store/roomStore'
import { useUIStore } from '../store/uiStore'
import { ClientGameState, RoundEndPayload, GameEndPayload, PassPayload, RematchVoteUpdate, RematchCancelled } from '../types/game'

export function useSocket() {
  const navigate = useNavigate()
  const { setGameState, setRoundEnd, setGameEnd, setLastTileSequence, addToScoreHistory, clearScoreHistory } = useGameStore()
  const { setRoom, setMyPlayerIndex, setError, setRoomCode } = useRoomStore()
  const { addPasoNotification, setShowRoundEnd, setShowGameEnd, setSelectedTile, setRematchVotes, setRematchCancelled, clearRematchState } = useUIStore()

  useEffect(() => {
    if (!socket.connected) socket.connect()

    // Re-join room after socket reconnection (new socket ID needs to be registered)
    socket.on('connect', () => {
      const roomCode = useRoomStore.getState().roomCode
      const playerName = useRoomStore.getState().playerName
      if (roomCode && playerName) {
        socket.emit('room:rejoin', { roomCode, playerName })
      }
    })

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

    socket.on('room:seat_swapped', ({ room, myPlayerIndex }: { room: any; myPlayerIndex: number }) => {
      setRoom(room)
      setMyPlayerIndex(myPlayerIndex)
    })

    socket.on('room:error', ({ message }: { message: string }) => {
      setError(message)
    })

    socket.on('game:started', ({ gameState }: { gameState: ClientGameState }) => {
      setGameState(gameState)
      // Clear any stale end-of-game state (handles both initial start and next-game)
      setShowGameEnd(false)
      setShowRoundEnd(false)
      setSelectedTile(null)
      useGameStore.getState().clearGameEnd()
      useGameStore.getState().clearRoundEnd()
      clearScoreHistory()
      clearRematchState()
      navigate('/game')
    })

    socket.on('game:state_snapshot', ({
      gameState,
      lastAction,
    }: { gameState: ClientGameState; lastAction: any }) => {
      setGameState(gameState)
      // Dismiss round-end modal when new hand starts (non-host players)
      if (gameState.phase === 'playing') {
        setShowRoundEnd(false)
        useGameStore.getState().clearRoundEnd()
      }
      // New game started — dismiss game-end modal and reset history
      if (gameState.phase === 'playing' && gameState.handNumber === 1) {
        setShowGameEnd(false)
        useGameStore.getState().clearGameEnd()
        clearScoreHistory()
      }
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
      const handNumber = useGameStore.getState().gameState?.handNumber ?? 0
      addToScoreHistory(data, handNumber)
    })

    socket.on('game:game_ended', (data: GameEndPayload) => {
      setGameEnd(data)
      setShowGameEnd(true)
    })

    socket.on('game:rematch_vote_update', (data: RematchVoteUpdate) => {
      setRematchVotes(data.votes, data.playerNames)
    })

    socket.on('game:rematch_accepted', () => {
      // Server will emit game:started after 2s delay — no action needed here
    })

    socket.on('game:rematch_cancelled', (data: RematchCancelled) => {
      setRematchCancelled({ playerIndex: data.disconnectedPlayerIndex, playerName: data.disconnectedPlayerName })
      setTimeout(() => {
        useUIStore.getState().clearRematchState()
        navigate('/lobby')
      }, 2500)
    })

    socket.on('connection:player_disconnected', ({ playerIndex, playerName }: { playerIndex: number; playerName: string }) => {
      console.log(`Player ${playerName} (${playerIndex}) disconnected`)
    })

    socket.on('connection:player_reconnected', ({ playerIndex, playerName }: { playerIndex: number; playerName: string }) => {
      console.log(`Player ${playerName} (${playerIndex}) reconnected`)
    })

    return () => {
      socket.off('connect')
      socket.off('room:created')
      socket.off('room:joined')
      socket.off('room:updated')
      socket.off('room:seat_swapped')
      socket.off('room:error')
      socket.off('game:started')
      socket.off('game:state_snapshot')
      socket.off('game:player_passed')
      socket.off('game:round_ended')
      socket.off('game:game_ended')
      socket.off('game:rematch_vote_update')
      socket.off('game:rematch_accepted')
      socket.off('game:rematch_cancelled')
      socket.off('connection:player_disconnected')
      socket.off('connection:player_reconnected')
    }
  }, [])
}

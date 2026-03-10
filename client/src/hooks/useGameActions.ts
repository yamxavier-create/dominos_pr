import { useCallback } from 'react'
import { socket } from '../socket'
import { useRoomStore } from '../store/roomStore'
import { useUIStore } from '../store/uiStore'
import { useGameStore } from '../store/gameStore'
import { GameMode } from '../types/game'

export function useGameActions() {
  const roomCode = useRoomStore(s => s.roomCode)
  const { setSelectedTile, selectedTileId } = useUIStore()
  const gameState = useGameStore(s => s.gameState)

  const selectTile = useCallback((tileId: string) => {
    if (!gameState?.isMyTurn) return
    const validPlays = gameState.validPlays

    // How many valid ends does this tile have?
    const playsForTile = validPlays.filter(vp => vp.tileId === tileId)
    if (playsForTile.length === 0) return

    // Empty board = first tile of the game, only one place to play (no ends exist yet)
    if (gameState.board.tiles.length === 0) {
      socket.emit('game:play_tile', { roomCode, tileId, targetEnd: 'right' })
      setSelectedTile(null)
      return
    }

    if (playsForTile.length === 1) {
      // Only one valid end — play immediately
      socket.emit('game:play_tile', {
        roomCode,
        tileId,
        targetEnd: playsForTile[0].targetEnd,
      })
      setSelectedTile(null)
    } else {
      // Two valid ends — select tile and let player choose end
      setSelectedTile(tileId === selectedTileId ? null : tileId)
    }
  }, [gameState, roomCode, selectedTileId, setSelectedTile])

  const playTileOnEnd = useCallback((targetEnd: 'left' | 'right') => {
    if (!selectedTileId || !gameState?.isMyTurn) return
    socket.emit('game:play_tile', {
      roomCode,
      tileId: selectedTileId,
      targetEnd,
    })
    setSelectedTile(null)
  }, [selectedTileId, gameState, roomCode, setSelectedTile])

  const startNextHand = useCallback(() => {
    socket.emit('game:next_hand', { roomCode })
  }, [roomCode])

  const startGame = useCallback(() => {
    socket.emit('game:start', { roomCode })
  }, [roomCode])

  const createRoom = useCallback((playerName: string, gameMode: GameMode) => {
    socket.emit('room:create', { playerName, gameMode })
  }, [])

  const joinRoom = useCallback((roomCodeArg: string, playerName: string) => {
    socket.emit('room:join', { roomCode: roomCodeArg, playerName })
  }, [])

  return { selectTile, playTileOnEnd, startNextHand, startGame, createRoom, joinRoom }
}

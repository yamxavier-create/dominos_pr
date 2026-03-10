import { create } from 'zustand'
import { RoomInfo, GameMode } from '../types/game'

interface RoomStore {
  room: RoomInfo | null
  roomCode: string
  playerName: string
  myPlayerIndex: number | null
  gameMode: GameMode
  error: string | null

  setRoom: (room: RoomInfo) => void
  setRoomCode: (code: string) => void
  setPlayerName: (name: string) => void
  setMyPlayerIndex: (index: number) => void
  setGameMode: (mode: GameMode) => void
  setError: (error: string | null) => void
  clearError: () => void
  clearRoom: () => void
}

export const useRoomStore = create<RoomStore>(set => ({
  room: null,
  roomCode: '',
  playerName: '',
  myPlayerIndex: null,
  gameMode: 'modo200',
  error: null,

  setRoom: room => set({ room }),
  setRoomCode: roomCode => set({ roomCode }),
  setPlayerName: playerName => set({ playerName }),
  setMyPlayerIndex: myPlayerIndex => set({ myPlayerIndex }),
  setGameMode: gameMode => set({ gameMode }),
  setError: error => set({ error }),
  clearError: () => set({ error: null }),
  clearRoom: () => set({ room: null, myPlayerIndex: null, error: null }),
}))

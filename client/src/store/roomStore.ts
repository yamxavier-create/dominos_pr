import { create } from 'zustand'
import { RoomInfo, GameMode } from '../types/game'

// The server's per-seat reconnect token is the only proof of seat ownership for
// guests, so keep it across reloads, keyed by room code.
const tokenKey = (roomCode: string) => `reconnect_token:${roomCode.toUpperCase()}`

export function loadReconnectToken(roomCode: string): string | undefined {
  try {
    return localStorage.getItem(tokenKey(roomCode)) ?? undefined
  } catch {
    return undefined
  }
}

export function saveReconnectToken(roomCode: string, token: string) {
  try {
    localStorage.setItem(tokenKey(roomCode), token)
  } catch {
    // Storage unavailable: the token still lives in memory for this session
  }
}

interface RoomStore {
  room: RoomInfo | null
  roomCode: string
  playerName: string
  reconnectToken: string
  myPlayerIndex: number | null
  gameMode: GameMode
  error: string | null

  setRoom: (room: RoomInfo) => void
  setRoomCode: (code: string) => void
  setPlayerName: (name: string) => void
  setReconnectToken: (roomCode: string, token: string) => void
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
  reconnectToken: '',
  myPlayerIndex: null,
  gameMode: 'modo200',
  error: null,

  setRoom: room => set({ room }),
  setRoomCode: roomCode => set({ roomCode }),
  setPlayerName: playerName => set({ playerName }),
  setReconnectToken: (roomCode, reconnectToken) => {
    saveReconnectToken(roomCode, reconnectToken)
    set({ reconnectToken })
  },
  setMyPlayerIndex: myPlayerIndex => set({ myPlayerIndex }),
  setGameMode: gameMode => set({ gameMode }),
  setError: error => set({ error }),
  clearError: () => set({ error: null }),
  clearRoom: () => set({ room: null, myPlayerIndex: null, error: null }),
}))

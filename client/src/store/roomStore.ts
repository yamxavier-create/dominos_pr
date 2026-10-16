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

function forgetReconnectToken(roomCode: string) {
  try {
    localStorage.removeItem(tokenKey(roomCode))
  } catch {
    // Storage unavailable: nothing to forget
  }
}

export function saveReconnectToken(roomCode: string, token: string) {
  try {
    localStorage.setItem(tokenKey(roomCode), token)
  } catch {
    // Storage unavailable: the token still lives in memory for this session
  }
}

// The room this device last sat in, so reopening the app puts the player back
// in their seat. Only recent ones: an old room is gone or the game is over.
const ACTIVE_ROOM_KEY = 'active_room'
const RESUME_WINDOW_MS = 30 * 60_000

/** Note that this device is (still) seated in the room, as of now. */
export function rememberActiveRoom(roomCode: string) {
  try {
    localStorage.setItem(ACTIVE_ROOM_KEY, JSON.stringify({ roomCode, at: Date.now() }))
  } catch {
    // Storage unavailable: a reopened app starts at the menu
  }
}

/** The room to go back to on launch, if this device left it recently. */
export function loadResumableRoom(): string | undefined {
  try {
    const saved = JSON.parse(localStorage.getItem(ACTIVE_ROOM_KEY) ?? 'null')
    if (typeof saved?.roomCode === 'string' && Date.now() - saved.at < RESUME_WINDOW_MS) return saved.roomCode
  } catch {
    // Unreadable: nothing to resume
  }
  return undefined
}

function forgetActiveRoom() {
  try {
    localStorage.removeItem(ACTIVE_ROOM_KEY)
  } catch {
    // Storage unavailable: nothing to forget
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
  /** Forget the room entirely so focus/reconnect never rejoins it. */
  exitRoom: () => void
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
  setRoomCode: roomCode => {
    rememberActiveRoom(roomCode)
    set({ roomCode })
  },
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
  exitRoom: () => set(state => {
    if (state.roomCode) forgetReconnectToken(state.roomCode)
    forgetActiveRoom()
    return { room: null, roomCode: '', reconnectToken: '', myPlayerIndex: null }
  }),
}))

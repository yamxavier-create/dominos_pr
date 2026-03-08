import { create } from 'zustand'
import { PassPayload } from '../types/game'

export interface ChatMessage {
  id: string
  playerIndex: number
  playerName: string
  content: string
  type: 'text' | 'reaction'
  timestamp: number
}

interface UIStore {
  // Tile selection (two-step placement)
  selectedTileId: string | null
  // Notifications
  pasoNotifications: PassPayload[]
  // Modals
  showRoundEnd: boolean
  showGameEnd: boolean
  showScoreHistory: boolean
  // Sound
  soundEnabled: boolean
  // Rematch voting
  rematchVotes: number[]
  rematchPlayerNames: string[]
  rematchCancelled: { playerIndex: number; playerName: string } | null
  // Chat
  chatMessages: ChatMessage[]
  chatOpen: boolean
  unreadCount: number

  setSelectedTile: (id: string | null) => void
  addPasoNotification: (payload: PassPayload) => void
  removePasoNotification: (playerIndex: number) => void
  setShowRoundEnd: (v: boolean) => void
  setShowGameEnd: (v: boolean) => void
  setShowScoreHistory: (v: boolean) => void
  toggleSound: () => void
  setRematchVotes: (votes: number[], playerNames: string[]) => void
  setRematchCancelled: (data: { playerIndex: number; playerName: string } | null) => void
  clearRematchState: () => void
  addChatMessage: (msg: ChatMessage) => void
  setChatMessages: (msgs: ChatMessage[]) => void
  setChatOpen: (open: boolean) => void
  clearChatState: () => void
}

export const useUIStore = create<UIStore>(set => ({
  selectedTileId: null,
  pasoNotifications: [],
  showRoundEnd: false,
  showGameEnd: false,
  showScoreHistory: false,
  soundEnabled: true,
  rematchVotes: [],
  rematchPlayerNames: [],
  rematchCancelled: null,
  chatMessages: [],
  chatOpen: false,
  unreadCount: 0,

  setSelectedTile: selectedTileId => set({ selectedTileId }),

  addPasoNotification: payload =>
    set(state => ({
      pasoNotifications: [...state.pasoNotifications, payload].slice(-3),
    })),

  removePasoNotification: playerIndex =>
    set(state => ({
      pasoNotifications: state.pasoNotifications.filter(n => n.playerIndex !== playerIndex),
    })),

  setShowRoundEnd: showRoundEnd => set({ showRoundEnd }),
  setShowGameEnd: showGameEnd => set({ showGameEnd }),
  setShowScoreHistory: showScoreHistory => set({ showScoreHistory }),
  toggleSound: () => set(state => ({ soundEnabled: !state.soundEnabled })),
  setRematchVotes: (votes, playerNames) => set({ rematchVotes: votes, rematchPlayerNames: playerNames }),
  setRematchCancelled: rematchCancelled => set({ rematchCancelled }),
  clearRematchState: () => set({ rematchVotes: [], rematchPlayerNames: [], rematchCancelled: null }),
  addChatMessage: msg =>
    set(state => ({
      chatMessages: [...state.chatMessages, msg].slice(-50),
      unreadCount: state.chatOpen ? state.unreadCount : state.unreadCount + 1,
    })),
  setChatMessages: msgs => set({ chatMessages: msgs }),
  setChatOpen: open => set({ chatOpen: open, ...(open ? { unreadCount: 0 } : {}) }),
  clearChatState: () => set({ chatMessages: [], chatOpen: false, unreadCount: 0 }),
}))

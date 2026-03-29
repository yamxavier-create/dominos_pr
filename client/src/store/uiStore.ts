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

export interface ActiveReaction {
  id: string
  playerIndex: number
  emoji: string
}

export interface FlyingTile {
  playerIndex: number
  tileId: string
  pip1: number
  pip2: number
  targetEnd: 'left' | 'right'
}

interface UIStore {
  // Tile selection (two-step placement)
  selectedTileId: string | null
  // Drag state
  draggingTileId: string | null
  // Notifications
  pasoNotifications: PassPayload[]
  // Modals
  showRoundEnd: boolean
  showGameEnd: boolean
  showScoreHistory: boolean
  // Sound
  sfxEnabled: boolean
  musicEnabled: boolean
  // Rematch voting
  rematchVotes: number[]
  rematchPlayerNames: string[]
  rematchCancelled: { playerIndex: number; playerName: string } | null
  // Chat
  chatMessages: ChatMessage[]
  chatOpen: boolean
  unreadCount: number
  // Emoji reactions (avatar-level)
  activeReactions: ActiveReaction[]
  emojiBarOpen: boolean
  // Tile fly animation
  flyingTile: FlyingTile | null

  setSelectedTile: (id: string | null) => void
  setDraggingTileId: (id: string | null) => void
  addPasoNotification: (payload: PassPayload) => void
  removePasoNotification: (playerIndex: number) => void
  setShowRoundEnd: (v: boolean) => void
  setShowGameEnd: (v: boolean) => void
  setShowScoreHistory: (v: boolean) => void
  toggleSfx: () => void
  toggleMusic: () => void
  setRematchVotes: (votes: number[], playerNames: string[]) => void
  setRematchCancelled: (data: { playerIndex: number; playerName: string } | null) => void
  clearRematchState: () => void
  addChatMessage: (msg: ChatMessage) => void
  setChatMessages: (msgs: ChatMessage[]) => void
  setChatOpen: (open: boolean) => void
  clearChatState: () => void
  addActiveReaction: (r: ActiveReaction) => void
  removeActiveReaction: (id: string) => void
  setEmojiBarOpen: (v: boolean) => void
  setFlyingTile: (v: FlyingTile | null) => void
}

export const useUIStore = create<UIStore>(set => ({
  selectedTileId: null,
  draggingTileId: null,
  pasoNotifications: [],
  showRoundEnd: false,
  showGameEnd: false,
  showScoreHistory: false,
  sfxEnabled: true,
  musicEnabled: true,
  rematchVotes: [],
  rematchPlayerNames: [],
  rematchCancelled: null,
  chatMessages: [],
  chatOpen: false,
  unreadCount: 0,
  activeReactions: [],
  emojiBarOpen: false,
  flyingTile: null,

  setSelectedTile: selectedTileId => set({ selectedTileId }),
  setDraggingTileId: draggingTileId => set({ draggingTileId }),

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
  toggleSfx: () => set(state => ({ sfxEnabled: !state.sfxEnabled })),
  toggleMusic: () => set(state => ({ musicEnabled: !state.musicEnabled })),
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
  addActiveReaction: r =>
    set(state => ({
      activeReactions: [...state.activeReactions, r].slice(-8),
    })),
  removeActiveReaction: id =>
    set(state => ({
      activeReactions: state.activeReactions.filter(r => r.id !== id),
    })),
  setEmojiBarOpen: emojiBarOpen => set({ emojiBarOpen }),
  setFlyingTile: flyingTile => set({ flyingTile }),
}))

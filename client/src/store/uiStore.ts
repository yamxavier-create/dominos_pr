import { create } from 'zustand'
import { PassPayload } from '../types/game'

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

  setSelectedTile: (id: string | null) => void
  addPasoNotification: (payload: PassPayload) => void
  removePasoNotification: (playerIndex: number) => void
  setShowRoundEnd: (v: boolean) => void
  setShowGameEnd: (v: boolean) => void
  setShowScoreHistory: (v: boolean) => void
  toggleSound: () => void
}

export const useUIStore = create<UIStore>(set => ({
  selectedTileId: null,
  pasoNotifications: [],
  showRoundEnd: false,
  showGameEnd: false,
  showScoreHistory: false,
  soundEnabled: true,

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
}))

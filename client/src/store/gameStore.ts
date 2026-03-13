import { create } from 'zustand'
import { ClientGameState, RoundEndPayload, GameEndPayload, BoneyardDrawPayload } from '../types/game'

interface ScoreHistoryEntry {
  data: RoundEndPayload
  handNumber: number
}

interface GameStore {
  gameState: ClientGameState | null
  roundEndData: RoundEndPayload | null
  gameEndData: GameEndPayload | null
  lastTileSequence: number | null  // sequence of newest board tile (for animation)
  scoreHistory: ScoreHistoryEntry[]
  boneyardDrawQueue: BoneyardDrawPayload[]

  setGameState: (state: ClientGameState) => void
  setRoundEnd: (data: RoundEndPayload) => void
  setGameEnd: (data: GameEndPayload) => void
  clearRoundEnd: () => void
  clearGameEnd: () => void
  setLastTileSequence: (seq: number | null) => void
  resetGame: () => void
  addToScoreHistory: (data: RoundEndPayload, handNumber: number) => void
  clearScoreHistory: () => void
  handleBoneyardDraw: (payload: BoneyardDrawPayload, myPlayerIndex: number) => void
  queueBoneyardDraw: (payload: BoneyardDrawPayload) => void
  shiftBoneyardDraw: () => void
  clearBoneyardDrawQueue: () => void
}

export type { ScoreHistoryEntry }

export const useGameStore = create<GameStore>(set => ({
  gameState: null,
  roundEndData: null,
  gameEndData: null,
  lastTileSequence: null,
  scoreHistory: [],
  boneyardDrawQueue: [],

  setGameState: gameState => set({ gameState }),
  setRoundEnd: roundEndData => set({ roundEndData }),
  setGameEnd: gameEndData => set({ gameEndData }),
  clearRoundEnd: () => set({ roundEndData: null }),
  clearGameEnd: () => set({ gameEndData: null }),
  setLastTileSequence: lastTileSequence => set({ lastTileSequence }),
  resetGame: () => set({ gameState: null, roundEndData: null, gameEndData: null, lastTileSequence: null, scoreHistory: [], boneyardDrawQueue: [] }),
  addToScoreHistory: (data, handNumber) => set(state => ({ scoreHistory: [{ data, handNumber }, ...state.scoreHistory] })),
  clearScoreHistory: () => set({ scoreHistory: [] }),
  queueBoneyardDraw: (payload) => set(state => ({ boneyardDrawQueue: [...state.boneyardDrawQueue, payload] })),
  shiftBoneyardDraw: () => set(state => ({ boneyardDrawQueue: state.boneyardDrawQueue.slice(1) })),
  clearBoneyardDrawQueue: () => set({ boneyardDrawQueue: [] }),
  handleBoneyardDraw: (payload, myPlayerIndex) => set(state => {
    if (!state.gameState) return state
    const players = state.gameState.players.map((p, i) => {
      if (payload.tile !== null && i === myPlayerIndex) {
        // I am the drawing player — add the tile to my hand
        return { ...p, tiles: [...(p.tiles ?? []), payload.tile], tileCount: p.tileCount + 1 }
      }
      if (i === payload.playerIndex) {
        // Opponent drew — increment their visible tile count
        return { ...p, tileCount: p.tileCount + 1 }
      }
      return p
    })
    return {
      gameState: {
        ...state.gameState,
        players,
        boneyardCount: payload.boneyardRemaining,
      },
    }
  }),
}))

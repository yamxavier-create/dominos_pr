// Mirror of server GameState types (client-filtered subset)

export type PipValue = 0 | 1 | 2 | 3 | 4 | 5 | 6
export type GameMode = 'modo200' | 'modo500'
export type GamePhase = 'waiting' | 'playing' | 'round_end' | 'game_end'

export interface Tile {
  id: string
  high: number
  low: number
  isDouble: boolean
}

export interface BoardTile {
  tile: Tile
  orientation: 'horizontal' | 'vertical'
  leftPip: number
  rightPip: number
  playedByIndex: number
  sequence: number
}

export interface BoardState {
  tiles: BoardTile[]
  leftEnd: number | null
  rightEnd: number | null
}

export interface ClientPlayer {
  index: number
  name: string
  tileCount: number
  connected: boolean
  isMe: boolean
  tiles?: Tile[]  // only for local player
  userId?: string // set for authenticated users
}

export interface TeamScores {
  team0: number
  team1: number
}

export interface ClientGameState {
  roomCode: string
  gameMode: GameMode
  targetScore: 20 | 500
  phase: GamePhase
  handNumber: number
  myPlayerIndex: number
  players: ClientPlayer[]
  board: BoardState
  currentPlayerIndex: number
  consecutivePasses: number
  scores: TeamScores
  isMyTurn: boolean
  validPlays: Array<{ tileId: string; targetEnd: 'left' | 'right' }>
  forcedFirstTileId: string | null
  boneyardCount: number             // tiles remaining in boneyard. Always 0 in 4-player
  playerCount: number               // 2 or 4. Client uses this for layout mode and label changes
  awaitingBoneyardDraw: boolean     // current player must draw before playing (2-player only)
}

export interface RoomInfo {
  roomCode: string
  hostSocketId: string
  gameMode: GameMode
  players: Array<{ index: number; name: string; connected: boolean; userId?: string }>
  status: 'waiting' | 'in_game'
}

// ─── Round & Game End Payloads ────────────────────────────────────────────────

export interface RemainingTileInfo {
  playerIndex: number
  playerName: string
  tiles: Tile[]
  pipSum: number
}

export interface RoundEndPayload {
  reason: 'played_out' | 'blocked'
  winnerIndex: number | null
  winningTeam: 0 | 1 | null
  rawPipCount?: number
  pointsFromPips: number
  bonusPoints: number
  totalPointsScored: number
  remainingTiles: RemainingTileInfo[]
  isCapicu: boolean
  isChuchazo: boolean
  scores: TeamScores
  nextStarterIndex: number
}

export interface GameEndPayload {
  winningTeam: 0 | 1
  finalScores: TeamScores
  totalRounds: number
}

// ─── Rematch Payloads ─────────────────────────────────────────────────────────

export interface RematchVoteUpdate {
  votes: number[]
  playerNames: string[]
}

export interface RematchCancelled {
  disconnectedPlayerIndex: number
  disconnectedPlayerName: string
}

export interface PassPayload {
  playerIndex: number
  playerName: string
  passBonusAwarded: number | null
}

export interface BoneyardDrawPayload {
  tile: Tile | null  // non-null for the drawing player, null for opponents
  boneyardRemaining: number
  playerIndex: number
}

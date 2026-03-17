// ─── Tile ─────────────────────────────────────────────────────────────────────

export type PipValue = 0 | 1 | 2 | 3 | 4 | 5 | 6

export interface Tile {
  id: string       // canonical "low-high", e.g. "3-6"
  high: PipValue
  low: PipValue
  isDouble: boolean
}

// ─── Board ────────────────────────────────────────────────────────────────────

export interface BoardTile {
  tile: Tile
  orientation: 'horizontal' | 'vertical' // vertical = double
  leftPip: PipValue   // pip on the visual left  (or top  for vertical)
  rightPip: PipValue  // pip on the visual right (or bottom for vertical)
  playedByIndex: number
  sequence: number    // 0-based play order (for animation)
}

export interface BoardState {
  tiles: BoardTile[]
  leftEnd: PipValue | null
  rightEnd: PipValue | null
}

// ─── Players & Room ───────────────────────────────────────────────────────────

export type GameMode = 'modo200' | 'modo500'
export type GamePhase = 'waiting' | 'playing' | 'round_end' | 'game_end'

export interface PlayerState {
  index: number
  socketId: string
  name: string
  tiles: Tile[]
  connected: boolean
}

export interface TeamScores {
  team0: number  // players 0 + 2
  team1: number  // players 1 + 3
}

// ─── Full Server Game State ───────────────────────────────────────────────────

export interface ServerGameState {
  roomCode: string
  gameMode: GameMode
  targetScore: 20 | 500
  phase: GamePhase
  handNumber: number        // 1-indexed count of hands in current game
  players: PlayerState[]
  board: BoardState
  currentPlayerIndex: number
  consecutivePasses: number // resets to 0 on any tile placement
  handPassCount: number     // passes this hand (resets each hand)
  gamePassCount: number     // total passes entire game (Modo 200: first=+2, rest=+1, never resets)
  scores: TeamScores
  handStarterIndex: number  // who started this hand (plays first)
  firstPlayMade: boolean    // whether the opening tile has been placed
  forcedFirstTileId: string // the 6-6 (or fallback) that MUST be played first
  gameWinnerIndex: number   // player who won the last game (starts the next one)
  boneyard: Tile[]          // tiles remaining in draw pile. Empty [] in 4-player; 14 tiles in 2-player
  awaitingBoneyardDraw: boolean  // true when current player must draw before playing (2-player only)
}

// ─── Room ─────────────────────────────────────────────────────────────────────

export interface RoomPlayer {
  socketId: string
  name: string
  seatIndex: number
  connected: boolean
}

export interface Room {
  roomCode: string
  hostSocketId: string
  gameMode: GameMode
  players: RoomPlayer[]       // up to 4 entries, indexed by seat
  status: 'waiting' | 'in_game'
  game: ServerGameState | null
  lastActivity: number        // Date.now() for cleanup
  rematchVotes: number[]      // playerIndex values who voted for rematch
  chatHistory: ChatMessage[]  // last 50 messages, cleared on game start
}

// ─── Chat ────────────────────────────────────────────────────────────────────

export interface ChatMessage {
  id: string
  playerIndex: number
  playerName: string
  content: string
  type: 'text' | 'reaction'
  timestamp: number
}

// ─── Socket Payloads (Server → Client) ────────────────────────────────────────

export interface ClientPlayer {
  index: number
  name: string
  tileCount: number
  connected: boolean
  isMe: boolean
  tiles?: Tile[]  // only populated for the receiving player's own hand
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
  forcedFirstTileId: string | null  // non-null only before first play
  boneyardCount: number             // tiles remaining in boneyard. Always 0 in 4-player
  playerCount: number               // 2 or 4. Client uses this for layout mode and label changes
  awaitingBoneyardDraw: boolean     // current player must draw before playing (2-player only)
}

export type GameAction =
  | { type: 'play_tile'; playerIndex: number; tile: Tile; targetEnd: 'left' | 'right' }
  | { type: 'pass'; playerIndex: number }
  | { type: 'round_end'; reason: 'played_out' | 'blocked' }
  | { type: 'game_end' }

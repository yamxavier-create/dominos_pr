import { randomUUID, timingSafeEqual } from 'crypto'
import { Room, GameMode, RoomPlayer } from './GameState'
import { generateBotName, generateBotSocketId } from './BotPlayer'

const PR_WORDS = ['COQUI', 'PALMA', 'FARO', 'PONCE', 'GALLO', 'CEIBA', 'PLAYA', 'MONTE', 'SALSA', 'BOMBA']

function generateRoomCode(existing: Set<string>): string {
  let code: string
  do {
    const word = PR_WORDS[Math.floor(Math.random() * PR_WORDS.length)]
    const digits = Math.floor(1000 + Math.random() * 9000)
    code = `${word}-${digits}`
  } while (existing.has(code))
  return code
}

/** Proof of seat ownership: the authenticated userId or the seat's secret reconnect token. */
export interface SeatCredentials {
  userId?: string
  reconnectToken?: string
}

function tokensMatch(expected: string | undefined, given: string | undefined): boolean {
  if (!expected || typeof given !== 'string') return false
  const a = Buffer.from(expected)
  const b = Buffer.from(given)
  return a.length === b.length && timingSafeEqual(a, b)
}

/** A player name is never proof of identity — only the seat's userId or reconnect token is. */
function ownsSeat(rp: RoomPlayer, creds: SeatCredentials): boolean {
  if (rp.isBot || rp.abandoned) return false
  if (tokensMatch(rp.reconnectToken, creds.reconnectToken)) return true
  return !!rp.userId && rp.userId === creds.userId
}

function isHuman(rp: RoomPlayer): boolean {
  return !rp.isBot
}

export interface RoomLifecycleHooks {
  /** A lobby seat was released or reindexed: every human needs their new seat index. */
  onLobbyChanged?: (room: Room) => void
  /** A disconnected player's grace period ran out mid-game: a bot should take the seat. */
  onSeatExpired?: (room: Room, seatIndex: number) => void
  /** The host moved to another player mid-game. */
  onHostChanged?: (room: Room) => void
  /** An idle room with connected players is about to be deleted. */
  onRoomClosed?: (room: Room) => void
}

export interface RoomManagerOptions {
  /** How long a disconnected human keeps their seat before it's released (lobby) or handed to a bot (game). */
  reconnectGraceMs?: number
  /** A room with no connected humans is deleted once it has been inactive this long. */
  emptyRoomTtlMs?: number
  /** A room with connected humans but no activity is closed after this long. */
  idleRoomTtlMs?: number
  /** 0 disables the periodic sweep (tests call cleanup() directly). */
  cleanupIntervalMs?: number
}

export interface LeaveResult {
  roomCode: string
  /** null when the room was deleted because no humans are left */
  room: Room | null
  seatIndex: number
}

export class RoomManager {
  private rooms = new Map<string, Room>()
  private socketToRoom = new Map<string, string>() // socketId → roomCode
  private userToRoom = new Map<string, string>()   // userId → roomCode (latest room the user sat in)
  private graceTimers = new Map<RoomPlayer, NodeJS.Timeout>()
  private cleanupInterval: NodeJS.Timeout | null = null
  private hooks: RoomLifecycleHooks = {}
  readonly reconnectGraceMs: number
  private emptyRoomTtlMs: number
  private idleRoomTtlMs: number

  constructor(options: RoomManagerOptions = {}) {
    this.reconnectGraceMs = options.reconnectGraceMs ?? 60_000
    this.emptyRoomTtlMs = options.emptyRoomTtlMs ?? 10 * 60_000
    this.idleRoomTtlMs = options.idleRoomTtlMs ?? 3 * 60 * 60_000
    const interval = options.cleanupIntervalMs ?? 60_000
    if (interval > 0) {
      this.cleanupInterval = setInterval(() => this.cleanup(), interval)
      this.cleanupInterval.unref()
    }
  }

  setHooks(hooks: RoomLifecycleHooks) {
    this.hooks = hooks
  }

  createRoom(socketId: string, playerName: string, gameMode: GameMode, userId?: string): Room {
    // Callers release the previous membership first (with broadcasts); this is the safety net
    this.leaveRoom(socketId)
    const roomCode = generateRoomCode(new Set(this.rooms.keys()))
    const room: Room = {
      roomCode,
      hostSocketId: socketId,
      gameMode,
      players: [{ socketId, name: playerName, seatIndex: 0, connected: true, userId, reconnectToken: randomUUID() }],
      status: 'waiting',
      game: null,
      lastActivity: Date.now(),
      rematchVotes: [],
      chatHistory: [],
    }
    this.rooms.set(roomCode, room)
    this.socketToRoom.set(socketId, roomCode)
    if (userId) this.userToRoom.set(userId, roomCode)
    return room
  }

  /**
   * Join a lobby, or reclaim an existing seat with credentials. Mid-game joins
   * are reconnections only.
   */
  joinRoom(
    socketId: string,
    roomCode: string,
    playerName: string,
    userId?: string,
    reconnectToken?: string,
  ): { room: Room; seatIndex: number; reclaimed: boolean; oldSocketId?: string } | null {
    const room = this.rooms.get(roomCode)
    if (!room) return null

    const reclaimed = this.reclaimSeat(socketId, roomCode, { userId, reconnectToken })
    if (reclaimed) return { ...reclaimed, reclaimed: true }

    if (room.status === 'in_game') return null
    if (room.players.length >= 4) return null
    if (room.players.some(p => p.name === playerName)) return null

    if (this.socketToRoom.get(socketId) !== roomCode) this.leaveRoom(socketId)

    const seatIndex = room.players.length
    const rp: RoomPlayer = { socketId, name: playerName, seatIndex, connected: true, userId, reconnectToken: randomUUID() }
    room.players.push(rp)
    this.socketToRoom.set(socketId, roomCode)
    if (userId) this.userToRoom.set(userId, roomCode)
    room.lastActivity = Date.now()
    return { room, seatIndex, reclaimed: false }
  }

  /**
   * Move a seat to a new socket after a reconnect. Every path that replaces a
   * player's socketId must go through here so ownership is always checked.
   */
  reclaimSeat(
    socketId: string,
    roomCode: string,
    creds: SeatCredentials,
  ): { room: Room; seatIndex: number; oldSocketId: string } | null {
    const room = this.rooms.get(roomCode)
    if (!room) return null
    const rp = room.players.find(p => ownsSeat(p, creds))
    if (!rp) return null

    // One room per socket: a socket reclaiming here leaves wherever else it was
    if (this.socketToRoom.has(socketId) && this.socketToRoom.get(socketId) !== roomCode) {
      this.leaveRoom(socketId)
    }

    this.cancelGrace(rp)
    const oldSocketId = rp.socketId
    rp.socketId = socketId
    rp.connected = true

    if (room.game) {
      const gp = room.game.players.find(p => p.index === rp.seatIndex)
      if (gp) {
        gp.socketId = socketId
        gp.connected = true
        if (gp.substitutedByBot) {
          gp.isBot = false
          gp.substitutedByBot = false
        }
      }
    }

    if (room.hostSocketId === oldSocketId) room.hostSocketId = socketId
    // Mid-game, if the host is gone for good and nobody could inherit it, the
    // first player back takes it so next_hand/next_game aren't stuck
    const host = room.players.find(p => p.socketId === room.hostSocketId)
    if (room.status === 'in_game' && (!host || host.abandoned || (!host.connected && !this.graceTimers.has(host)))) {
      room.hostSocketId = socketId
    }
    if (oldSocketId !== socketId && this.socketToRoom.get(oldSocketId) === roomCode) {
      this.socketToRoom.delete(oldSocketId)
    }
    this.socketToRoom.set(socketId, roomCode)
    if (rp.userId) this.userToRoom.set(rp.userId, roomCode)
    room.lastActivity = Date.now()
    return { room, seatIndex: rp.seatIndex, oldSocketId }
  }

  /** The secret a seat owner needs to reclaim the seat. Send it only to that owner. */
  getReconnectToken(room: Room, seatIndex: number): string | undefined {
    return room.players.find(p => p.seatIndex === seatIndex)?.reconnectToken
  }

  /**
   * The socket dropped. The seat is kept for the grace period so the owner can
   * reclaim it; after that it's released (lobby) or handed to a bot (game).
   */
  disconnect(socketId: string): LeaveResult | null {
    const located = this.locate(socketId)
    if (!located) return null
    const { room, rp } = located
    this.socketToRoom.delete(socketId)

    rp.connected = false
    const gp = room.game?.players.find(p => p.index === rp.seatIndex)
    if (gp) gp.connected = false
    room.lastActivity = Date.now()

    this.startGrace(room, rp)
    return { roomCode: room.roomCode, room, seatIndex: rp.seatIndex }
  }

  /**
   * The player left on purpose. A lobby seat is freed now; a game seat is
   * abandoned (never reclaimable) and handed to a bot by the caller.
   */
  leaveRoom(socketId: string): LeaveResult | null {
    const located = this.locate(socketId)
    if (!located) return null
    const { room, rp } = located
    this.socketToRoom.delete(socketId)
    this.cancelGrace(rp)
    const seatIndex = rp.seatIndex

    if (room.status === 'waiting') {
      this.removeLobbySeat(room, rp)
    } else {
      rp.abandoned = true
      rp.connected = false
      rp.reconnectToken = undefined
      const gp = room.game?.players.find(p => p.index === rp.seatIndex)
      if (gp) gp.connected = false
      if (room.hostSocketId === socketId) this.transferHost(room)
    }
    this.releaseUser(rp.userId, room.roomCode)

    room.lastActivity = Date.now()
    if (!room.players.some(p => isHuman(p) && !p.abandoned)) {
      this.deleteRoom(room.roomCode)
      return { roomCode: room.roomCode, room: null, seatIndex }
    }
    return { roomCode: room.roomCode, room, seatIndex }
  }

  addBot(roomCode: string): { room: Room; seatIndex: number } | null {
    const room = this.rooms.get(roomCode)
    if (!room || room.status !== 'waiting' || room.players.length >= 4) return null
    const seatIndex = room.players.length
    const botSocketId = generateBotSocketId(seatIndex)
    const rp: RoomPlayer = {
      socketId: botSocketId,
      name: generateBotName(),
      seatIndex,
      connected: true,
      isBot: true,
    }
    room.players.push(rp)
    room.lastActivity = Date.now()
    return { room, seatIndex }
  }

  removeBot(roomCode: string, seatIndex: number): Room | null {
    const room = this.rooms.get(roomCode)
    if (!room || room.status !== 'waiting') return null
    const player = room.players.find(p => p.seatIndex === seatIndex && p.isBot)
    if (!player) return null
    room.players = room.players.filter(p => p.seatIndex !== seatIndex)
    room.players.forEach((p, i) => { p.seatIndex = i })
    room.lastActivity = Date.now()
    return room
  }

  getRoom(roomCode: string): Room | undefined {
    return this.rooms.get(roomCode)
  }

  getRoomBySocket(socketId: string): Room | undefined {
    const roomCode = this.socketToRoom.get(socketId)
    if (!roomCode) return undefined
    return this.rooms.get(roomCode)
  }

  getRoomCodeBySocket(socketId: string): string | undefined {
    return this.socketToRoom.get(socketId)
  }

  swapSeats(socketId: string, seatA: number, seatB: number): Room | null {
    const room = this.getRoomBySocket(socketId)
    if (!room) return null
    if (room.status !== 'waiting') return null
    if (room.hostSocketId !== socketId) return null
    if (seatA === seatB) return null

    const playerA = room.players.find(p => p.seatIndex === seatA)
    const playerB = room.players.find(p => p.seatIndex === seatB)
    if (!playerA || !playerB) return null

    playerA.seatIndex = seatB
    playerB.seatIndex = seatA
    // Keep host reference pointing to seat 0
    const newSeat0 = room.players.find(p => p.seatIndex === 0)
    if (newSeat0) room.hostSocketId = newSeat0.socketId

    room.lastActivity = Date.now()
    return room
  }

  getRoomInfo(room: Room) {
    return {
      roomCode: room.roomCode,
      hostSocketId: room.hostSocketId,
      gameMode: room.gameMode,
      players: room.players.map(p => ({
        index: p.seatIndex,
        name: p.name,
        connected: p.connected,
        userId: p.userId,
        isBot: p.isBot || false,
      })),
      status: room.status,
    }
  }

  /** Get the roomCode a userId is currently in (lobby or game) */
  getRoomCodeByUserId(userId: string): string | undefined {
    return this.userToRoom.get(userId)
  }

  /**
   * Delete rooms nobody is coming back to. A room with no connected humans
   * goes after emptyRoomTtlMs of inactivity; a room with connected humans is
   * only closed (with notice) after idleRoomTtlMs.
   */
  cleanup(now = Date.now()) {
    for (const [code, room] of this.rooms) {
      const idleFor = now - room.lastActivity
      const anyoneConnected = room.players.some(p => isHuman(p) && p.connected)
      if (!anyoneConnected && idleFor >= this.emptyRoomTtlMs) {
        this.deleteRoom(code)
      } else if (anyoneConnected && idleFor >= this.idleRoomTtlMs) {
        this.hooks.onRoomClosed?.(room)
        this.deleteRoom(code)
      }
    }
  }

  destroy() {
    if (this.cleanupInterval) clearInterval(this.cleanupInterval)
    for (const timer of this.graceTimers.values()) clearTimeout(timer)
    this.graceTimers.clear()
  }

  // ─── Internals ──────────────────────────────────────────────────────────────

  private locate(socketId: string): { room: Room; rp: RoomPlayer } | null {
    const roomCode = this.socketToRoom.get(socketId)
    if (!roomCode) return null
    const room = this.rooms.get(roomCode)
    const rp = room?.players.find(p => p.socketId === socketId)
    if (!room || !rp) {
      this.socketToRoom.delete(socketId)
      return null
    }
    return { room, rp }
  }

  private startGrace(room: Room, rp: RoomPlayer) {
    this.cancelGrace(rp)
    const timer = setTimeout(() => {
      this.graceTimers.delete(rp)
      this.expireSeat(room, rp)
    }, this.reconnectGraceMs)
    timer.unref()
    this.graceTimers.set(rp, timer)
  }

  private cancelGrace(rp: RoomPlayer) {
    const timer = this.graceTimers.get(rp)
    if (timer) clearTimeout(timer)
    this.graceTimers.delete(rp)
  }

  private expireSeat(room: Room, rp: RoomPlayer) {
    if (this.rooms.get(room.roomCode) !== room || rp.connected) return
    if (room.status === 'waiting') {
      this.removeLobbySeat(room, rp)
      this.releaseUser(rp.userId, room.roomCode)
      if (!room.players.some(isHuman)) {
        this.deleteRoom(room.roomCode)
        return
      }
      this.hooks.onLobbyChanged?.(room)
    } else {
      if (room.hostSocketId === rp.socketId && this.transferHost(room)) {
        this.hooks.onHostChanged?.(room)
      }
      this.hooks.onSeatExpired?.(room, rp.seatIndex)
    }
  }

  /** Remove a lobby seat, close the gap and keep a connected human as host on seat 0. */
  private removeLobbySeat(room: Room, rp: RoomPlayer) {
    room.players = room.players.filter(p => p !== rp)
    room.players.sort((a, b) => a.seatIndex - b.seatIndex).forEach((p, i) => { p.seatIndex = i })
    if (room.hostSocketId !== rp.socketId) return

    // The lobby UI treats seat 0 as host, so move the new host there
    const nextHost = room.players.find(p => isHuman(p) && p.connected) ?? room.players.find(isHuman)
    if (!nextHost) return
    const seat0 = room.players.find(p => p.seatIndex === 0)
    if (seat0 && seat0 !== nextHost) {
      seat0.seatIndex = nextHost.seatIndex
      nextHost.seatIndex = 0
    }
    room.hostSocketId = nextHost.socketId
  }

  /** Mid-game: hand host rights to the first connected human. Returns whether it moved. */
  private transferHost(room: Room): boolean {
    const next = [...room.players]
      .sort((a, b) => a.seatIndex - b.seatIndex)
      .find(p => isHuman(p) && p.connected && !p.abandoned && p.socketId !== room.hostSocketId)
    if (!next) return false
    room.hostSocketId = next.socketId
    return true
  }

  private releaseUser(userId: string | undefined, roomCode: string) {
    if (userId && this.userToRoom.get(userId) === roomCode) this.userToRoom.delete(userId)
  }

  private deleteRoom(roomCode: string) {
    const room = this.rooms.get(roomCode)
    if (!room) return
    for (const p of room.players) {
      this.cancelGrace(p)
      if (this.socketToRoom.get(p.socketId) === roomCode) this.socketToRoom.delete(p.socketId)
      this.releaseUser(p.userId, roomCode)
    }
    this.rooms.delete(roomCode)
  }
}

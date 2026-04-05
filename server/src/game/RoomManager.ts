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

export class RoomManager {
  private rooms = new Map<string, Room>()
  private socketToRoom = new Map<string, string>() // socketId → roomCode
  private userToRoom = new Map<string, string>()   // userId → roomCode
  private cleanupInterval: NodeJS.Timeout

  constructor() {
    // Clean up idle rooms every 10 minutes
    this.cleanupInterval = setInterval(() => this.cleanup(), 10 * 60 * 1000)
  }

  createRoom(socketId: string, playerName: string, gameMode: GameMode, userId?: string): Room {
    const roomCode = generateRoomCode(new Set(this.rooms.keys()))
    const room: Room = {
      roomCode,
      hostSocketId: socketId,
      gameMode,
      players: [{ socketId, name: playerName, seatIndex: 0, connected: true, userId }],
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

  joinRoom(socketId: string, roomCode: string, playerName: string, userId?: string): { room: Room; seatIndex: number } | null {
    const room = this.rooms.get(roomCode)
    if (!room) return null
    if (room.status === 'in_game') {
      // Reconnect attempt: match by userId first (more reliable), then by name
      if (room.game) {
        const player = room.game.players.find(p =>
          !p.connected && ((userId && p.userId === userId) || p.name === playerName)
        )
        if (player) {
          player.socketId = socketId
          player.connected = true
          if (userId) player.userId = userId
          const rp = room.players.find(p => p.seatIndex === player.index)
          if (rp) { rp.socketId = socketId; rp.connected = true; if (userId) rp.userId = userId }
          this.socketToRoom.set(socketId, roomCode)
          room.lastActivity = Date.now()
          return { room, seatIndex: player.index }
        }
      }
      return null
    }
    if (room.players.length >= 4) return null
    if (room.players.some(p => p.name === playerName)) return null

    const seatIndex = room.players.length
    const rp: RoomPlayer = { socketId, name: playerName, seatIndex, connected: true, userId }
    room.players.push(rp)
    this.socketToRoom.set(socketId, roomCode)
    if (userId) this.userToRoom.set(userId, roomCode)
    room.lastActivity = Date.now()
    return { room, seatIndex }
  }

  leaveRoom(socketId: string): { roomCode: string; room: Room } | null {
    const roomCode = this.socketToRoom.get(socketId)
    if (!roomCode) return null
    const room = this.rooms.get(roomCode)
    if (!room) return null

    this.socketToRoom.delete(socketId)

    // Clean up userId mapping for lobby leaves
    const leavingPlayer = room.players.find(p => p.socketId === socketId)
    if (leavingPlayer?.userId && room.status === 'waiting') {
      this.userToRoom.delete(leavingPlayer.userId)
    }

    if (room.status === 'waiting') {
      // Remove the player from lobby
      room.players = room.players.filter(p => p.socketId !== socketId)
      // Re-index remaining seats
      room.players.forEach((p, i) => { p.seatIndex = i })
      if (room.players.length === 0) {
        this.rooms.delete(roomCode)
        return null
      }
      // Transfer host if needed
      if (room.hostSocketId === socketId) {
        room.hostSocketId = room.players[0].socketId
      }
    } else if (room.game) {
      // Mark as disconnected mid-game
      const player = room.game.players.find(p => p.socketId === socketId)
      if (player) player.connected = false
      const rp = room.players.find(p => p.socketId === socketId)
      if (rp) rp.connected = false
    }

    room.lastActivity = Date.now()
    return { roomCode, room }
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

  registerSocket(socketId: string, roomCode: string) {
    this.socketToRoom.set(socketId, roomCode)
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

  private cleanup() {
    const cutoff = Date.now() - 60 * 60 * 1000 // 1 hour
    for (const [code, room] of this.rooms) {
      if (room.lastActivity < cutoff) {
        for (const p of room.players) {
          this.socketToRoom.delete(p.socketId)
          if (p.userId) this.userToRoom.delete(p.userId)
        }
        this.rooms.delete(code)
      }
    }
  }

  destroy() {
    clearInterval(this.cleanupInterval)
  }
}

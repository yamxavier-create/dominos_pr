import { Room, GameMode, RoomPlayer } from './GameState'

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
  private cleanupInterval: NodeJS.Timeout

  constructor() {
    // Clean up idle rooms every 10 minutes
    this.cleanupInterval = setInterval(() => this.cleanup(), 10 * 60 * 1000)
  }

  createRoom(socketId: string, playerName: string, gameMode: GameMode): Room {
    const roomCode = generateRoomCode(new Set(this.rooms.keys()))
    const room: Room = {
      roomCode,
      hostSocketId: socketId,
      gameMode,
      players: [{ socketId, name: playerName, seatIndex: 0, connected: true }],
      status: 'waiting',
      game: null,
      lastActivity: Date.now(),
    }
    this.rooms.set(roomCode, room)
    this.socketToRoom.set(socketId, roomCode)
    return room
  }

  joinRoom(socketId: string, roomCode: string, playerName: string): { room: Room; seatIndex: number } | null {
    const room = this.rooms.get(roomCode)
    if (!room) return null
    if (room.status === 'in_game') {
      // Reconnect attempt: find matching disconnected player by name
      if (room.game) {
        const player = room.game.players.find(p => p.name === playerName && !p.connected)
        if (player) {
          player.socketId = socketId
          player.connected = true
          const rp = room.players.find(p => p.seatIndex === player.index)
          if (rp) { rp.socketId = socketId; rp.connected = true }
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
    const rp: RoomPlayer = { socketId, name: playerName, seatIndex, connected: true }
    room.players.push(rp)
    this.socketToRoom.set(socketId, roomCode)
    room.lastActivity = Date.now()
    return { room, seatIndex }
  }

  leaveRoom(socketId: string): { roomCode: string; room: Room } | null {
    const roomCode = this.socketToRoom.get(socketId)
    if (!roomCode) return null
    const room = this.rooms.get(roomCode)
    if (!room) return null

    this.socketToRoom.delete(socketId)

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

  getRoomInfo(room: Room) {
    return {
      roomCode: room.roomCode,
      hostSocketId: room.hostSocketId,
      gameMode: room.gameMode,
      players: room.players.map(p => ({
        index: p.seatIndex,
        name: p.name,
        connected: p.connected,
      })),
      status: room.status,
    }
  }

  private cleanup() {
    const cutoff = Date.now() - 60 * 60 * 1000 // 1 hour
    for (const [code, room] of this.rooms) {
      if (room.lastActivity < cutoff) {
        for (const p of room.players) this.socketToRoom.delete(p.socketId)
        this.rooms.delete(code)
      }
    }
  }

  destroy() {
    clearInterval(this.cleanupInterval)
  }
}

import { Socket, Server } from 'socket.io'
import { RoomManager } from '../game/RoomManager'
import { ChatMessage } from '../game/GameState'
import { randomUUID } from 'crypto'

const RATE_LIMIT_WINDOW = 10_000 // 10 seconds
const RATE_LIMIT_MAX = 15

// Rate limiter: socket.id -> timestamps of recent messages
const rateLimits = new Map<string, number[]>()

export function registerChatHandlers(socket: Socket, io: Server, rooms: RoomManager) {

  socket.on('chat:send', ({ message, type }: { message: string; type: 'text' | 'reaction' }) => {
    const roomCode = rooms.getRoomCodeBySocket(socket.id)
    if (!roomCode) return
    const room = rooms.getRoom(roomCode)
    if (!room) return

    // Find player in room
    const roomPlayer = room.players.find(p => p.socketId === socket.id)
    if (!roomPlayer) return

    // Rate limiting
    const now = Date.now()
    const timestamps = (rateLimits.get(socket.id) ?? []).filter(t => now - t < RATE_LIMIT_WINDOW)
    if (timestamps.length >= RATE_LIMIT_MAX) {
      return socket.emit('chat:error', { message: 'Demasiados mensajes. Espera un momento.' })
    }
    timestamps.push(now)
    rateLimits.set(socket.id, timestamps)

    // Sanitize content
    let content = message.replace(/<[^>]*>/g, '').trim().slice(0, 200)
    if (!content) return


    const chatMessage: ChatMessage = {
      id: randomUUID(),
      playerIndex: roomPlayer.seatIndex,
      playerName: roomPlayer.name,
      content,
      type,
      timestamp: now,
    }

    // Store in history (cap at 50)
    room.chatHistory.push(chatMessage)
    if (room.chatHistory.length > 50) {
      room.chatHistory = room.chatHistory.slice(-50)
    }

    // Broadcast to room
    io.to(roomCode).emit('chat:message', chatMessage)
  })

  socket.on('disconnect', () => {
    rateLimits.delete(socket.id)
  })
}

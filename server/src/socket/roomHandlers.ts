import { Socket, Server } from 'socket.io'
import { RoomManager } from '../game/RoomManager'
import { PresenceManager } from '../presence/PresenceManager'
import { GameMode, Room } from '../game/GameState'
import { buildClientGameState } from '../game/GameEngine'
import { getSocketUser } from './authMiddleware'
import { isNonEmptyString } from './payloadGuard'
import { announceLeave, detachReplacedSocket, emitLobbyState, leaveCurrentRoom } from './roomEvents'

const GAME_MODES: readonly GameMode[] = ['modo200', 'modo500']

function optionalString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined
}

export function registerRoomHandlers(socket: Socket, io: Server, rooms: RoomManager, presence: PresenceManager) {

  /** Resync a socket that just took (or retook) a seat, and tell the room. */
  const sendSeat = (room: Room, seatIndex: number, oldSocketId?: string) => {
    socket.join(room.roomCode)
    if (oldSocketId) detachReplacedSocket(io, oldSocketId, socket.id, room.roomCode)
    const rp = room.players.find(p => p.seatIndex === seatIndex)!
    socket.emit('room:joined', {
      roomCode: room.roomCode,
      room: rooms.getRoomInfo(room),
      myPlayerIndex: seatIndex,
      reconnectToken: rp.reconnectToken,
    })

    if (room.status === 'in_game' && room.game) {
      socket.emit('game:state_snapshot', {
        gameState: buildClientGameState(room.game, seatIndex),
        lastAction: null,
      })
      io.to(room.roomCode).emit('room:updated', { room: rooms.getRoomInfo(room) })
      if (oldSocketId !== undefined && oldSocketId !== socket.id) {
        io.to(room.roomCode).emit('connection:player_reconnected', { playerIndex: seatIndex, playerName: rp.name })
      }
    } else {
      emitLobbyState(io, rooms, room)
    }

    if (room.chatHistory?.length) {
      socket.emit('chat:history', { messages: room.chatHistory })
    }
  }

  socket.on('room:create', ({ playerName, gameMode }: { playerName?: unknown; gameMode?: unknown }) => {
    const socketUser = getSocketUser(socket)
    const name = optionalString(playerName)?.trim() || socketUser.user?.displayName
    if (!name) {
      return socket.emit('room:error', { code: 'INVALID_NAME', message: 'Nombre inválido' })
    }
    if (!GAME_MODES.includes(gameMode as GameMode)) {
      return socket.emit('room:error', { code: 'INVALID_MODE', message: 'Modo de juego inválido' })
    }
    leaveCurrentRoom(socket, io, rooms)
    const userId = socketUser.user?.id
    const room = rooms.createRoom(socket.id, name, gameMode as GameMode, userId)
    socket.join(room.roomCode)
    socket.emit('room:created', {
      roomCode: room.roomCode,
      room: rooms.getRoomInfo(room),
      myPlayerIndex: 0,
      reconnectToken: rooms.getReconnectToken(room, 0),
    })
    if (userId) presence.notifyStatusChange(userId)
  })

  socket.on('room:join', ({ roomCode, playerName, reconnectToken }: {
    roomCode?: unknown
    playerName?: unknown
    reconnectToken?: unknown
  }) => {
    const socketUser = getSocketUser(socket)
    const name = optionalString(playerName)?.trim() || socketUser.user?.displayName
    if (!name) {
      return socket.emit('room:error', { code: 'INVALID_NAME', message: 'Nombre inválido' })
    }
    if (!isNonEmptyString(roomCode)) {
      return socket.emit('room:error', { code: 'ROOM_NOT_FOUND', message: 'Sala no encontrada o llena' })
    }
    const code = roomCode.toUpperCase()
    if (!rooms.getRoom(code)) {
      return socket.emit('room:error', { code: 'ROOM_NOT_FOUND', message: 'Sala no encontrada o llena' })
    }
    leaveCurrentRoom(socket, io, rooms, code)
    const userId = socketUser.user?.id
    const result = rooms.joinRoom(socket.id, code, name, userId, optionalString(reconnectToken))
    if (!result) {
      return socket.emit('room:error', {
        code: 'ROOM_NOT_FOUND',
        message: 'Sala no encontrada o llena',
      })
    }
    sendSeat(result.room, result.seatIndex, result.reclaimed ? result.oldSocketId : undefined)
    if (userId) presence.notifyStatusChange(userId)
  })

  // Lightweight reconnection: update socket ID in room/game state and re-join Socket.IO room.
  // Triggered by client on socket reconnect (new socket ID after transport close) and on
  // focus. The seat is matched by userId or reconnect token — never by name.
  socket.on('room:rejoin', ({ roomCode, reconnectToken }: { roomCode?: unknown; reconnectToken?: unknown }) => {
    if (!isNonEmptyString(roomCode)) return
    const result = rooms.reclaimSeat(socket.id, roomCode, {
      userId: getSocketUser(socket).user?.id,
      reconnectToken: optionalString(reconnectToken),
    })
    if (!result) {
      // Seat expired, abandoned or room gone: the client must stop trying
      return socket.emit('room:rejoin_failed', { roomCode })
    }
    const { room, seatIndex, oldSocketId } = result
    console.log(`[room:rejoin] seat ${seatIndex} reconnected to ${roomCode}: ${oldSocketId} → ${socket.id}`)
    sendSeat(room, seatIndex, oldSocketId)
  })

  socket.on('room:swap_seats', ({ seatA, seatB }: { seatA?: unknown; seatB?: unknown }) => {
    if (!Number.isInteger(seatA) || !Number.isInteger(seatB)) return
    const room = rooms.swapSeats(socket.id, seatA as number, seatB as number)
    if (!room) return
    // Notify all players of updated room info AND their new seat index
    for (const p of room.players) {
      io.to(p.socketId).emit('room:seat_swapped', {
        room: rooms.getRoomInfo(room),
        myPlayerIndex: p.seatIndex,
      })
    }
  })

  socket.on('room:add_bot', () => {
    const roomCode = rooms.getRoomCodeBySocket(socket.id)
    if (!roomCode) return
    const room = rooms.getRoom(roomCode)
    if (!room || room.hostSocketId !== socket.id) return
    const result = rooms.addBot(roomCode)
    if (!result) return
    io.to(roomCode).emit('room:updated', { room: rooms.getRoomInfo(room) })
  })

  socket.on('room:remove_bot', ({ seatIndex }: { seatIndex?: unknown }) => {
    if (!Number.isInteger(seatIndex)) return
    const roomCode = rooms.getRoomCodeBySocket(socket.id)
    if (!roomCode) return
    const room = rooms.getRoom(roomCode)
    if (!room || room.hostSocketId !== socket.id) return
    const updated = rooms.removeBot(roomCode, seatIndex as number)
    if (!updated) return
    io.to(roomCode).emit('room:updated', { room: rooms.getRoomInfo(updated) })
  })

  // Leaving on purpose: a lobby seat is freed now, a game seat is abandoned to a bot
  socket.on('room:leave', () => {
    const result = rooms.leaveRoom(socket.id)
    if (!result) return
    socket.leave(result.roomCode)
    announceLeave(io, rooms, result)
    const socketUser = getSocketUser(socket)
    if (socketUser.user) presence.notifyStatusChange(socketUser.user.id)
  })
}

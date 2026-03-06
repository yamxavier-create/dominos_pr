import { Socket, Server } from 'socket.io'
import { RoomManager } from '../game/RoomManager'
import { GameMode } from '../game/GameState'
import { buildClientGameState } from '../game/GameEngine'

export function registerRoomHandlers(socket: Socket, io: Server, rooms: RoomManager) {

  socket.on('room:create', ({ playerName, gameMode }: { playerName: string; gameMode: GameMode }) => {
    if (!playerName?.trim()) {
      return socket.emit('room:error', { code: 'INVALID_NAME', message: 'Nombre inválido' })
    }
    const room = rooms.createRoom(socket.id, playerName.trim(), gameMode)
    socket.join(room.roomCode)
    socket.emit('room:created', {
      roomCode: room.roomCode,
      room: rooms.getRoomInfo(room),
      myPlayerIndex: 0,
    })
  })

  socket.on('room:join', ({ roomCode, playerName }: { roomCode: string; playerName: string }) => {
    if (!playerName?.trim()) {
      return socket.emit('room:error', { code: 'INVALID_NAME', message: 'Nombre inválido' })
    }
    const result = rooms.joinRoom(socket.id, roomCode?.toUpperCase(), playerName.trim())
    if (!result) {
      return socket.emit('room:error', {
        code: 'ROOM_NOT_FOUND',
        message: 'Sala no encontrada o llena',
      })
    }
    const { room, seatIndex } = result
    socket.join(room.roomCode)

    if (room.status === 'in_game' && room.game) {
      // Reconnect: send current game state
      socket.emit('room:joined', { roomCode: room.roomCode, room: rooms.getRoomInfo(room), myPlayerIndex: seatIndex })
      socket.emit('game:state_snapshot', {
        gameState: buildClientGameState(room.game, seatIndex),
        lastAction: null,
      })
      io.to(room.roomCode).emit('connection:player_reconnected', {
        playerIndex: seatIndex,
        playerName: playerName.trim(),
      })
    } else {
      socket.emit('room:joined', { roomCode: room.roomCode, room: rooms.getRoomInfo(room), myPlayerIndex: seatIndex })
      io.to(room.roomCode).emit('room:updated', { room: rooms.getRoomInfo(room) })
    }
  })

  socket.on('room:leave', () => {
    const result = rooms.leaveRoom(socket.id)
    if (!result) return
    const { roomCode, room } = result
    socket.leave(roomCode)
    io.to(roomCode).emit('room:updated', { room: rooms.getRoomInfo(room) })
  })
}

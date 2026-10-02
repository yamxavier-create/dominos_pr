import { Server, Socket } from 'socket.io'
import { Room } from '../game/GameState'
import { RoomManager, LeaveResult } from '../game/RoomManager'
import { handOverSeatToBot } from './gameHandlers'

/**
 * Lobby seats get reindexed when someone leaves, so each human gets the room
 * plus their own seat index (the lobby UI treats seat 0 as host).
 */
export function emitLobbyState(io: Server, rooms: RoomManager, room: Room) {
  const info = rooms.getRoomInfo(room)
  for (const p of room.players) {
    if (p.isBot || !p.connected) continue
    io.to(p.socketId).emit('room:updated', { room: info, myPlayerIndex: p.seatIndex })
  }
}

/** Tell everyone about a player who left on purpose. */
export function announceLeave(io: Server, rooms: RoomManager, result: LeaveResult) {
  const { room, seatIndex } = result
  if (!room) return
  if (room.status === 'waiting') {
    emitLobbyState(io, rooms, room)
    return
  }
  // Host may have moved; the round-end modal compares hostSocketId to its own socket
  io.to(room.roomCode).emit('room:updated', { room: rooms.getRoomInfo(room) })
  handOverSeatToBot(io, rooms, room, seatIndex)
}

/** One room per socket: leave the current one (with broadcasts) before joining another. */
export function leaveCurrentRoom(socket: Socket, io: Server, rooms: RoomManager, unlessRoomCode?: string) {
  const current = rooms.getRoomCodeBySocket(socket.id)
  if (!current || current === unlessRoomCode) return
  const result = rooms.leaveRoom(socket.id)
  socket.leave(current)
  if (result) announceLeave(io, rooms, result)
}

/** The seat moved to a new socket (another tab or device): detach the old one. */
export function detachReplacedSocket(io: Server, oldSocketId: string, newSocketId: string, roomCode: string) {
  if (oldSocketId === newSocketId) return
  const old = io.sockets.sockets.get(oldSocketId)
  if (!old) return
  old.leave(roomCode)
  old.emit('room:session_replaced', { roomCode })
}

export function installRoomLifecycleHooks(io: Server, rooms: RoomManager) {
  rooms.setHooks({
    onLobbyChanged: room => emitLobbyState(io, rooms, room),
    onSeatExpired: (room, seatIndex) => handOverSeatToBot(io, rooms, room, seatIndex),
    onHostChanged: room => io.to(room.roomCode).emit('room:updated', { room: rooms.getRoomInfo(room) }),
    onRoomClosed: room => {
      io.to(room.roomCode).emit('room:closed', { roomCode: room.roomCode, reason: 'idle' })
      io.in(room.roomCode).socketsLeave(room.roomCode)
    },
  })
}

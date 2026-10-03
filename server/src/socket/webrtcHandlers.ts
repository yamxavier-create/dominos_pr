import { Socket, Server } from 'socket.io'
import { RoomManager } from '../game/RoomManager'
import { Room, PlayerState } from '../game/GameState'
import { isNonEmptyString } from './payloadGuard'

/**
 * A seat can take part in the call only while a connected human holds it.
 * A seat abandoned or handed to a bot keeps its old socketId in game.players,
 * so matching on socketId alone would let that socket keep signaling.
 */
function callSeat(room: Room, player: PlayerState | undefined): PlayerState | undefined {
  if (!player || player.isBot || !player.connected) return undefined
  const rp = room.players.find(p => p.seatIndex === player.index)
  if (!rp || rp.abandoned || rp.isBot || !rp.connected || rp.socketId !== player.socketId) return undefined
  return player
}

export function registerWebRTCHandlers(socket: Socket, io: Server, rooms: RoomManager): void {

  /** The room this socket currently sits in, only if it matches the claimed roomCode. */
  const myRoom = (roomCode: unknown): Room | undefined => {
    if (!isNonEmptyString(roomCode)) return undefined
    if (rooms.getRoomCodeBySocket(socket.id) !== roomCode) return undefined
    return rooms.getRoom(roomCode)
  }

  socket.on('webrtc:signal', ({ roomCode, to, desc, candidate }: {
    roomCode?: unknown
    to?: unknown
    desc?: unknown
    candidate?: unknown
  }) => {
    const room = myRoom(roomCode)
    if (!room?.game) {
      socket.emit('webrtc:error', { reason: 'not_in_game', to })
      return
    }
    const from = callSeat(room, room.game.players.find(p => p.socketId === socket.id))
    if (!from) {
      socket.emit('webrtc:error', { reason: 'sender_not_in_call', to })
      return
    }
    const target = Number.isInteger(to) ? callSeat(room, room.game.players.find(p => p.index === to)) : undefined
    if (!target || target.index === from.index) {
      socket.emit('webrtc:error', { reason: 'target_not_in_call', to })
      return
    }
    io.to(target.socketId).emit('webrtc:signal', { from: from.index, desc, candidate })
  })

  socket.on('webrtc:toggle', ({ roomCode, micMuted, cameraOff }: {
    roomCode?: unknown
    micMuted?: unknown
    cameraOff?: unknown
  }) => {
    const room = myRoom(roomCode)
    if (!room?.game) return
    const from = callSeat(room, room.game.players.find(p => p.socketId === socket.id))
    if (!from) return
    socket.to(room.roomCode).emit('webrtc:peer_toggle', {
      from: from.index,
      micMuted: micMuted === true,
      cameraOff: cameraOff === true,
    })
  })

  socket.on('webrtc:lobby_opt', ({ roomCode, audio, video }: {
    roomCode?: unknown
    audio?: unknown
    video?: unknown
  }) => {
    const room = myRoom(roomCode)
    if (!room) return
    const fromPlayer = room.players.find(p => p.socketId === socket.id && !p.abandoned)
    if (!fromPlayer) return
    socket.to(room.roomCode).emit('webrtc:lobby_updated', {
      from: fromPlayer.seatIndex,
      audio: audio === true,
      video: video === true,
    })
  })
}

/** Tell the room a seat left the call (bot took it, or the player abandoned) so peers close its connection. */
export function announcePeerLeft(io: Server, roomCode: string, playerIndex: number) {
  io.to(roomCode).emit('webrtc:peer_left', { playerIndex })
}

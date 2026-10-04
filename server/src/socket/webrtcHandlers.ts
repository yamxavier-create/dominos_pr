import { Socket, Server } from 'socket.io'
import { RoomManager } from '../game/RoomManager'
import { Room, PlayerState, RoomPlayer } from '../game/GameState'
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

/** In the room (no game yet, or back from one) the call runs on the room seats. */
function lobbySeat(rp: RoomPlayer | undefined): number | undefined {
  if (!rp || rp.isBot || rp.abandoned || !rp.connected) return undefined
  return rp.seatIndex
}

/** The call seat of a socket, or of a seat index, in this room right now. */
function seatOfSocket(room: Room, socketId: string): number | undefined {
  if (room.game) return callSeat(room, room.game.players.find(p => p.socketId === socketId))?.index
  return lobbySeat(room.players.find(p => p.socketId === socketId))
}

function socketOfSeat(room: Room, index: unknown): string | undefined {
  if (!Number.isInteger(index)) return undefined
  if (room.game) return callSeat(room, room.game.players.find(p => p.index === index))?.socketId
  const rp = room.players.find(p => p.seatIndex === index)
  return lobbySeat(rp) === undefined ? undefined : rp!.socketId
}

export function registerWebRTCHandlers(socket: Socket, io: Server, rooms: RoomManager): void {

  /** The room this socket currently sits in, only if it matches the claimed roomCode. */
  const myRoom = (roomCode: unknown): Room | undefined => {
    if (!isNonEmptyString(roomCode)) return undefined
    if (rooms.getRoomCodeBySocket(socket.id) !== roomCode) return undefined
    return rooms.getRoom(roomCode)
  }

  socket.on('webrtc:signal', ({ roomCode, to, desc, candidate, epoch }: {
    roomCode?: unknown
    to?: unknown
    desc?: unknown
    candidate?: unknown
    epoch?: unknown
  }) => {
    const room = myRoom(roomCode)
    if (!room) {
      socket.emit('webrtc:error', { reason: 'not_in_room', to })
      return
    }
    // Sent before the sender learned about a seat change: it was meant for
    // whoever sat at that index then, and the sender is already rebuilding
    if (epoch !== undefined && epoch !== room.callEpoch) return
    const from = seatOfSocket(room, socket.id)
    if (from === undefined) {
      socket.emit('webrtc:error', { reason: 'sender_not_in_call', to })
      return
    }
    const target = socketOfSeat(room, to)
    if (!target || to === from) {
      socket.emit('webrtc:error', { reason: 'target_not_in_call', to })
      return
    }
    io.to(target).emit('webrtc:signal', { from, desc, candidate })
  })

  socket.on('webrtc:toggle', ({ roomCode, micMuted, cameraOff }: {
    roomCode?: unknown
    micMuted?: unknown
    cameraOff?: unknown
  }) => {
    const room = myRoom(roomCode)
    if (!room) return
    const from = seatOfSocket(room, socket.id)
    if (from === undefined) return
    socket.to(room.roomCode).emit('webrtc:peer_toggle', {
      from,
      micMuted: micMuted === true,
      cameraOff: cameraOff === true,
    })
  })

  // Joining the call (or leaving it with both false). The room remembers it so
  // late joiners and seat changes know who is in the call.
  socket.on('webrtc:lobby_opt', ({ roomCode, audio, video }: {
    roomCode?: unknown
    audio?: unknown
    video?: unknown
  }) => {
    const room = myRoom(roomCode)
    if (!room) return
    const fromPlayer = room.players.find(p => p.socketId === socket.id && !p.abandoned)
    if (!fromPlayer) return
    const media = { audio: audio === true, video: video === true }
    fromPlayer.call = media.audio || media.video ? media : undefined
    socket.to(room.roomCode).emit('webrtc:lobby_updated', { from: fromPlayer.seatIndex, ...media })
  })
}

/** Tell the room a seat left the call (bot took it, or the player abandoned) so peers close its connection. */
export function announcePeerLeft(io: Server, room: Room, playerIndex: number) {
  const rp = room.players.find(p => p.seatIndex === playerIndex)
  if (rp) rp.call = undefined
  io.to(room.roomCode).emit('webrtc:peer_left', { playerIndex })
}

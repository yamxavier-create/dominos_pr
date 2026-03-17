import { Socket, Server } from 'socket.io'
import { RoomManager } from '../game/RoomManager'

export function registerWebRTCHandlers(socket: Socket, io: Server, rooms: RoomManager): void {

  socket.on('webrtc:signal', ({ roomCode, to, desc, candidate }: {
    roomCode: string
    to: number
    desc?: unknown
    candidate?: unknown
  }) => {
    const room = rooms.getRoom(roomCode)
    if (!room) { console.log('[WebRTC-Server] signal: room not found', roomCode); return }
    if (!room.game) { console.log('[WebRTC-Server] signal: no game in room'); return }
    const fromPlayer = room.game.players.find(p => p.socketId === socket.id)
    if (fromPlayer === undefined) { console.log('[WebRTC-Server] signal: sender not found, socketId=', socket.id); return }
    const fromIndex = fromPlayer.index
    const targetPlayer = room.game.players.find(p => p.index === to)
    if (!targetPlayer?.socketId) { console.log('[WebRTC-Server] signal: target not found, to=', to); return }
    console.log(`[WebRTC-Server] signal: ${fromIndex} → ${to} (${desc ? 'SDP' : 'ICE'})`)
    io.to(targetPlayer.socketId).emit('webrtc:signal', { from: fromIndex, desc, candidate })
  })

  socket.on('webrtc:toggle', ({ roomCode, micMuted, cameraOff }: {
    roomCode: string
    micMuted: boolean
    cameraOff: boolean
  }) => {
    const room = rooms.getRoom(roomCode)
    if (!room) return
    if (!room.game) return
    const fromPlayer = room.game.players.find(p => p.socketId === socket.id)
    if (fromPlayer === undefined) return
    socket.to(roomCode).emit('webrtc:peer_toggle', {
      from: fromPlayer.index,
      micMuted,
      cameraOff,
    })
  })

  socket.on('webrtc:lobby_opt', ({ roomCode, audio, video }: {
    roomCode: string
    audio: boolean
    video: boolean
  }) => {
    const room = rooms.getRoom(roomCode)
    if (!room) { console.log('[WebRTC-Server] lobby_opt: room not found'); return }
    const fromPlayer = room.players.find(p => p.socketId === socket.id)
    if (fromPlayer === undefined) { console.log('[WebRTC-Server] lobby_opt: player not found, socketId=', socket.id); return }
    console.log(`[WebRTC-Server] lobby_opt: player ${fromPlayer.seatIndex} (${fromPlayer.name}) → audio=${audio} video=${video}`)
    socket.to(roomCode).emit('webrtc:lobby_updated', {
      from: fromPlayer.seatIndex,
      audio,
      video,
    })
  })
}

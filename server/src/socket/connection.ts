import { Server } from 'socket.io'
import { RoomManager } from '../game/RoomManager'
import { PresenceManager } from '../presence/PresenceManager'
import { buildClientGameState } from '../game/GameEngine'
import { registerHandlers } from './handlers'
import { checkRematchCancellation } from './gameHandlers'
import { getSocketUser } from './authMiddleware'
import { guardSocket } from './payloadGuard'
import { attachSocketServer, endSocketSession } from '../auth/sessionRevocation'
import { emitLobbyState, installRoomLifecycleHooks } from './roomEvents'

export function registerConnectionHandler(io: Server, rooms: RoomManager, presence: PresenceManager): void {
  installRoomLifecycleHooks(io, rooms)
  attachSocketServer(io)

  io.on('connection', socket => {
    console.log(`[socket] connected: ${socket.id}`)

    // Must run before any socket.on so every handler is covered
    guardSocket(socket)

    // Join per-user room for real-time social notifications
    const userData = getSocketUser(socket)

    // The session was checked once at handshake; end the socket when it expires
    let sessionTimer: NodeJS.Timeout | undefined
    if (userData.sessionExpiresAt) {
      const MAX_TIMEOUT = 2 ** 31 - 1
      const ms = Math.min(Math.max(userData.sessionExpiresAt - Date.now(), 0), MAX_TIMEOUT)
      sessionTimer = setTimeout(() => endSocketSession(socket, 'expired'), ms)
    }
    if (userData.user) {
      socket.join(`user:${userData.user.id}`)
      presence.addSocket(userData.user.id, socket.id)
    }

    registerHandlers(socket, io, rooms, presence)

    socket.on('disconnect', reason => {
      console.log(`[socket] disconnected: ${socket.id} — ${reason}`)
      clearTimeout(sessionTimer)

      // Remove socket from presence tracking (starts grace period if last socket)
      if (userData.user) {
        presence.removeSocket(userData.user.id, socket.id)
      }

      // Keeps the seat for the grace period; a bot or seat release follows if they don't come back
      const result = rooms.disconnect(socket.id)
      if (!result?.room) {
        // Even without a room, presence may have changed (online -> offline)
        if (userData.user) {
          presence.notifyStatusChange(userData.user.id)
        }
        return
      }

      const { roomCode, room } = result

      // Cancel rematch voting if disconnecting player was part of it
      checkRematchCancellation(io, room, socket.id)

      if (room.status === 'in_game' && room.game) {
        const player = room.game.players.find(p => p.socketId === socket.id)
        if (player) {
          io.to(roomCode).emit('connection:player_disconnected', {
            playerIndex: player.index,
            playerName: player.name,
          })
          // Broadcast updated state so other players see the disconnected indicator
          for (const p of room.game.players) {
            if (p.connected) {
              io.to(p.socketId).emit('game:state_snapshot', {
                gameState: buildClientGameState(room.game, p.index),
                lastAction: null,
              })
            }
          }
        }
      } else {
        emitLobbyState(io, rooms, room)
      }

      // Notify friends about status change (room leave)
      if (userData.user) {
        presence.notifyStatusChange(userData.user.id)
      }
    })
  })
}

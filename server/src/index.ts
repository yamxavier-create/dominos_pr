import express from 'express'
import { createServer } from 'http'
import { Server } from 'socket.io'
import cors from 'cors'
import path from 'path'
import { config, APP_VERSION } from './config'
import { RoomManager } from './game/RoomManager'
import { registerHandlers } from './socket/handlers'
import { buildClientGameState } from './game/GameEngine'
import { checkRematchCancellation } from './socket/gameHandlers'
import authRoutes from './auth/authRoutes'
import socialRoutes, { setRoomManager, setPresenceManager } from './social/socialRoutes'
import { PresenceManager } from './presence/PresenceManager'
import { authMiddleware, getSocketUser } from './socket/authMiddleware'

const app = express()
const httpServer = createServer(app)

if (config.NODE_ENV !== 'production') {
  app.use(cors({ origin: config.CLIENT_ORIGIN }))
}
app.use(express.json())

// Auth REST API
app.use('/api/auth', authRoutes)

// Social REST API (friends, search, requests)
app.use('/api/social', socialRoutes)

const io = new Server(httpServer, {
  cors: config.NODE_ENV !== 'production'
    ? { origin: config.CLIENT_ORIGIN, methods: ['GET', 'POST'] }
    : undefined,
  pingTimeout: 60000,
  pingInterval: 25000,
})

// Socket.io auth middleware — identifies user or marks as guest
io.use(authMiddleware)

const rooms = new RoomManager()
setRoomManager(rooms)

const presence = new PresenceManager(io, rooms)
setPresenceManager(presence)

// Health check for Railway
app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok' })
})

// Serve built client files in production
if (config.NODE_ENV === 'production') {
  const clientBuild = path.join(__dirname, '../../client/dist')
  app.use(express.static(clientBuild))
  app.get('*', (_req, res) => res.sendFile(path.join(clientBuild, 'index.html')))
}

io.on('connection', socket => {
  console.log(`[socket] connected: ${socket.id}`)

  // Join per-user room for real-time social notifications
  const userData = getSocketUser(socket)
  if (userData.user) {
    socket.join(`user:${userData.user.id}`)
    presence.addSocket(userData.user.id, socket.id)
  }

  registerHandlers(socket, io, rooms, presence)

  socket.on('disconnect', reason => {
    console.log(`[socket] disconnected: ${socket.id} — ${reason}`)

    // Remove socket from presence tracking (starts grace period if last socket)
    if (userData.user) {
      presence.removeSocket(userData.user.id, socket.id)
    }

    const result = rooms.leaveRoom(socket.id)
    if (!result) {
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
      io.to(roomCode).emit('room:updated', { room: rooms.getRoomInfo(room) })
    }

    // Notify friends about status change (room leave)
    if (userData.user) {
      presence.notifyStatusChange(userData.user.id)
    }
  })
})

httpServer.listen(config.PORT, () => {
  console.log(`🎲 Dominó PR v${APP_VERSION} running on port ${config.PORT}`)
})

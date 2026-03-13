import express from 'express'
import { createServer } from 'http'
import { Server } from 'socket.io'
import cors from 'cors'
import path from 'path'
import { config } from './config'
import { RoomManager } from './game/RoomManager'
import { registerHandlers } from './socket/handlers'
import { buildClientGameState } from './game/GameEngine'
import { checkRematchCancellation } from './socket/gameHandlers'

const app = express()
const httpServer = createServer(app)

if (config.NODE_ENV !== 'production') {
  app.use(cors({ origin: config.CLIENT_ORIGIN }))
}
app.use(express.json())

const io = new Server(httpServer, {
  cors: config.NODE_ENV !== 'production'
    ? { origin: config.CLIENT_ORIGIN, methods: ['GET', 'POST'] }
    : undefined,
  pingTimeout: 60000,
  pingInterval: 25000,
})

const rooms = new RoomManager()

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

  registerHandlers(socket, io, rooms)

  socket.on('disconnect', reason => {
    console.log(`[socket] disconnected: ${socket.id} — ${reason}`)

    const result = rooms.leaveRoom(socket.id)
    if (!result) return

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
  })
})

httpServer.listen(config.PORT, () => {
  console.log(`🎲 Dominó PR server running on port ${config.PORT}`)
})

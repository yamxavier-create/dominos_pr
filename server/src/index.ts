import express from 'express'
import { createServer } from 'http'
import { Server } from 'socket.io'
import cors from 'cors'
import path from 'path'
import { config, APP_VERSION } from './config'
import { RoomManager } from './game/RoomManager'
import { registerConnectionHandler } from './socket/connection'
import authRoutes from './auth/authRoutes'
import socialRoutes, { setRoomManager, setPresenceManager } from './social/socialRoutes'
import statsRoutes from './stats/statsRoutes'
import { PresenceManager } from './presence/PresenceManager'
import { authMiddleware } from './socket/authMiddleware'

const app = express()
const httpServer = createServer(app)

if (config.NODE_ENV !== 'production') {
  app.use(cors({ origin: config.CLIENT_ORIGIN }))
}
// Railway puts one proxy hop in front; auth rate limits need the client's real IP
if (config.NODE_ENV === 'production') app.set('trust proxy', 1)
app.use(express.json({ limit: '10kb' }))

// Auth REST API
app.use('/api/auth', authRoutes)

// Social REST API (friends, search, requests)
app.use('/api/social', socialRoutes)

// Stats REST API (history, leaderboard)
app.use('/api/stats', statsRoutes)

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

registerConnectionHandler(io, rooms, presence)

httpServer.listen(config.PORT, () => {
  console.log(`🎲 Dominó PR v${APP_VERSION} running on port ${config.PORT}`)
})

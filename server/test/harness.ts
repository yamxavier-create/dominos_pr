/**
 * Shared test harness: a real Socket.io server in-process with the production
 * connection handler, plus helpers to drive it with real clients.
 */
import './env' // must stay first: points Prisma at an unreachable DB

import { before, after, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { createServer, Server as HttpServer } from 'http'
import { AddressInfo } from 'net'
import { Server } from 'socket.io'
import { io as ioc, Socket as ClientSocket } from 'socket.io-client'
import { RoomManager, RoomManagerOptions } from '../src/game/RoomManager'
import { PresenceManager } from '../src/presence/PresenceManager'
import { registerConnectionHandler } from '../src/socket/connection'
import { SocketUserData } from '../src/socket/authMiddleware'

export type { ClientSocket }

export function waitFor<T = any>(socket: ClientSocket, event: string, ms = 2000): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`timed out waiting for "${event}"`)), ms)
    socket.once(event, (data: T) => {
      clearTimeout(timer)
      resolve(data)
    })
  })
}

/** Wait for an event whose payload matches. */
export function waitUntil<T = any>(
  socket: ClientSocket,
  event: string,
  match: (data: T) => boolean,
  ms = 2000,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const listener = (data: T) => {
      if (!match(data)) return
      clearTimeout(timer)
      socket.off(event, listener)
      resolve(data)
    }
    const timer = setTimeout(() => {
      socket.off(event, listener)
      reject(new Error(`timed out waiting for a matching "${event}"`))
    }, ms)
    socket.on(event, listener)
  })
}

/** Resolves with every event the socket received during the window. */
export function collect(socket: ClientSocket, ms = 300): Promise<string[]> {
  const seen: string[] = []
  const listener = (event: string) => { seen.push(event) }
  socket.onAny(listener)
  return new Promise(resolve => setTimeout(() => {
    socket.offAny(listener)
    resolve(seen)
  }, ms))
}

export const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

export interface Seat {
  socket: ClientSocket
  name: string
  userId?: string
  reconnectToken: string
}

export interface SeatSpec {
  name: string
  userId?: string
}

/** Seats 0 and 1 are authenticated, 2 and 3 are guests. */
export const FOUR_PLAYERS: SeatSpec[] = [
  { name: 'Ana', userId: 'user-ana' },
  { name: 'Beto', userId: 'user-beto' },
  { name: 'Carla' },
  { name: 'Dani' },
]

// Presence talks to the DB; the socket rules under test don't depend on it.
const presenceStub = {
  addSocket() {},
  removeSocket() {},
  notifyStatusChange() {},
} as unknown as PresenceManager

/** Registers before/after hooks for the calling test file. */
export function setupTestServer(roomOptions: RoomManagerOptions = {}) {
  let httpServer: HttpServer
  let io: Server
  let rooms: RoomManager
  let url = ''
  const clients: ClientSocket[] = []
  const processErrors: unknown[] = []
  const onProcessError = (err: unknown) => { processErrors.push(err) }

  before(async () => {
    process.on('uncaughtException', onProcessError)
    process.on('unhandledRejection', onProcessError)

    httpServer = createServer()
    io = new Server(httpServer)
    // Test auth: trust handshake.auth.testUserId instead of a JWT
    io.use((socket, next) => {
      const id = socket.handshake.auth?.testUserId as string | undefined
      ;(socket.data as SocketUserData) = id
        ? { user: { id, username: id, displayName: id }, guest: false }
        : { guest: true }
      next()
    })
    rooms = new RoomManager({ cleanupIntervalMs: 0, ...roomOptions })
    registerConnectionHandler(io, rooms, presenceStub)
    await new Promise<void>(resolve => httpServer.listen(0, resolve))
    url = `http://127.0.0.1:${(httpServer.address() as AddressInfo).port}`
  })

  afterEach(() => {
    while (clients.length) clients.pop()!.disconnect()
  })

  after(async () => {
    rooms.destroy()
    io.close()
    await new Promise(resolve => httpServer.close(resolve))
    process.off('uncaughtException', onProcessError)
    process.off('unhandledRejection', onProcessError)
  })

  async function connect(testUserId?: string): Promise<ClientSocket> {
    const socket = ioc(url, {
      transports: ['websocket'],
      forceNew: true,
      reconnection: false,
      auth: testUserId ? { testUserId } : {},
    })
    clients.push(socket)
    await waitFor(socket, 'connect')
    return socket
  }

  /** A lobby with these players seated in order; the first one is host. */
  async function createLobby(specs: SeatSpec[] = FOUR_PLAYERS, gameMode = 'modo500') {
    const seats: Seat[] = []
    const host = await connect(specs[0].userId)
    host.emit('room:create', { playerName: specs[0].name, gameMode })
    const created = await waitFor(host, 'room:created')
    const roomCode: string = created.roomCode
    seats.push({ socket: host, ...specs[0], reconnectToken: created.reconnectToken })

    for (const spec of specs.slice(1)) {
      const socket = await connect(spec.userId)
      socket.emit('room:join', { roomCode, playerName: spec.name })
      const joined = await waitFor(socket, 'room:joined')
      seats.push({ socket, ...spec, reconnectToken: joined.reconnectToken })
    }
    return { roomCode, room: rooms.getRoom(roomCode)!, seats }
  }

  async function startFourPlayerGame(specs: SeatSpec[] = FOUR_PLAYERS) {
    const { roomCode, seats } = await createLobby(specs)
    const started = seats.map(s => waitFor(s.socket, 'game:started'))
    seats[0].socket.emit('game:start', { roomCode })
    await Promise.all(started)

    const room = rooms.getRoom(roomCode)!
    assert.equal(room.game?.phase, 'playing')
    return { roomCode, room, seats }
  }

  async function dropSeat(seat: Seat) {
    seat.socket.disconnect()
    await sleep(100)
  }

  return {
    get io() { return io },
    get rooms() { return rooms },
    processErrors,
    connect,
    createLobby,
    startFourPlayerGame,
    dropSeat,
  }
}

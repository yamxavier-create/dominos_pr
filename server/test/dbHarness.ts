/**
 * Shared harness for tests that need the real local test database: the auth,
 * social and stats routers plus Socket.io with the real auth middleware.
 * Each test file runs in its own process, so module-level state is per file.
 *
 * Test files import, in this order:
 *   import './env-db'
 *   import './env'
 *   import { setupDbServer, ... } from './dbHarness'
 */
import { test, before, after, beforeEach, TestContext } from 'node:test'
import assert from 'node:assert/strict'
import { createServer, Server as HttpServer } from 'http'
import { AddressInfo } from 'net'
import express from 'express'
import { Server } from 'socket.io'
import { io as ioc, Socket as ClientSocket } from 'socket.io-client'
import prisma from '../src/db/prisma'
import authRoutes from '../src/auth/authRoutes'
import { authMiddleware } from '../src/socket/authMiddleware'
import { registerConnectionHandler } from '../src/socket/connection'
import { RoomManager, RoomManagerOptions } from '../src/game/RoomManager'
import { PresenceManager } from '../src/presence/PresenceManager'
import { setEmailTransport, OutgoingEmail } from '../src/auth/emailService'
import { resetRateLimits } from '../src/auth/rateLimit'
import socialRoutes, { setRoomManager } from '../src/social/socialRoutes'
import statsRoutes from '../src/stats/statsRoutes'

let httpServer: HttpServer
let io: Server
export let rooms: RoomManager
let base = ''
let dbReady = false
const sockets: ClientSocket[] = []
export const outbox: OutgoingEmail[] = []

const presenceStub = { addSocket() {}, removeSocket() {}, notifyStatusChange() {} } as unknown as PresenceManager

/** Registers the before/after hooks for the calling test file. */
export function setupDbServer(label: string, roomOptions: RoomManagerOptions = {}) {
  before(async () => {
    try {
      // Fails until every migration these tests rely on is applied
      await prisma.$queryRaw`SELECT 1 FROM "EmailVerification" LIMIT 1`
      await prisma.$queryRaw`SELECT "matchId", "ranked" FROM "GameHistory" LIMIT 1`
      dbReady = true
    } catch {
      console.warn(`[${label}] local test DB unavailable — run \`npm run test:db:setup\`. Skipping.`)
    }

    const app = express()
    app.use(express.json({ limit: '10kb' }))
    app.use('/api/auth', authRoutes)
    app.use('/api/social', socialRoutes)
    app.use('/api/stats', statsRoutes)
    httpServer = createServer(app)
    io = new Server(httpServer)
    io.use(authMiddleware) // the real one: JWT + Session row
    rooms = new RoomManager({ cleanupIntervalMs: 0, ...roomOptions })
    setRoomManager(rooms)
    registerConnectionHandler(io, rooms, presenceStub)
    await new Promise<void>(resolve => httpServer.listen(0, resolve))
    base = `http://127.0.0.1:${(httpServer.address() as AddressInfo).port}`
    setEmailTransport(async email => { outbox.push(email) })
  })

  beforeEach(async () => {
    while (sockets.length) sockets.pop()!.disconnect()
    outbox.length = 0
    resetRateLimits()
    if (dbReady) {
      await prisma.$executeRawUnsafe(
        'TRUNCATE "User", "Session", "PasswordReset", "EmailVerification", "UserStats", "Friendship", "GameHistory", "GameParticipant" CASCADE',
      )
    }
  })

  after(async () => {
    while (sockets.length) sockets.pop()!.disconnect()
    setEmailTransport(null)
    rooms.destroy()
    io.close()
    await new Promise(resolve => httpServer.close(resolve))
    await prisma.$disconnect()
  })
}

/** Like test(), but skipped when the local test DB isn't set up. */
export function dbTest(name: string, fn: (t: TestContext) => Promise<void>) {
  test(name, async t => {
    if (!dbReady) return t.skip('local test DB unavailable')
    await fn(t)
  })
}

/** Call an API route; paths are relative to /api (e.g. /auth/login). */
export async function api(path: string, body?: unknown, opts: { method?: string; token?: string } = {}) {
  const res = await fetch(`${base}/api${path}`, {
    method: opts.method ?? (body === undefined ? 'GET' : 'POST'),
    headers: {
      'Content-Type': 'application/json',
      ...(opts.token ? { Authorization: `Bearer ${opts.token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  return { status: res.status, body: await res.json().catch(() => ({})), headers: res.headers }
}

export async function register(username: string, password = 'secret123', email?: string) {
  const res = await api('/auth/register', { username, password, email })
  assert.equal(res.status, 201, JSON.stringify(res.body))
  return res.body as { token: string; user: { id: string; email: string | null; pendingEmail: string | null } }
}

export async function connectAs(token: string): Promise<ClientSocket> {
  const socket = ioc(base, { transports: ['websocket'], forceNew: true, reconnection: false, auth: { token } })
  sockets.push(socket)
  await new Promise<void>((resolve, reject) => {
    socket.once('connect', () => resolve())
    socket.once('connect_error', reject)
  })
  return socket
}

export function waitFor<T = any>(socket: ClientSocket, event: string, ms = 2000): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`timed out waiting for "${event}"`)), ms)
    socket.once(event, (data: T) => { clearTimeout(timer); resolve(data) })
  })
}

export const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

/** The token inside the last captured link of this kind. */
export function lastLinkToken(kind: OutgoingEmail['kind'], to?: string): string {
  const email = [...outbox].reverse().find(e => e.kind === kind && (!to || e.to === to))
  assert.ok(email?.link, `no ${kind} email captured`)
  return new URL(email.link).searchParams.get('token')!
}

export const deliveries = async () => { await sleep(20); return outbox } // emails go out in the background


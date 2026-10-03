import { Server, Socket } from 'socket.io'
import prisma from '../db/prisma'
import { getSocketUser } from '../socket/authMiddleware'

/**
 * Revoking a session must also cut the sockets opened with it: the socket
 * authenticated once at handshake and would otherwise keep acting as the user.
 */
let io: Server | null = null

export function attachSocketServer(server: Server) {
  io = server
}

type SessionFilter = { jti: string } | { userId: string }

export async function revokeSessions(filter: SessionFilter) {
  await prisma.session.deleteMany({ where: 'jti' in filter ? { token: filter.jti } : { userId: filter.userId } })
  disconnectSessionSockets(filter)
}

/** Disconnect sockets for sessions already deleted (e.g. inside a transaction). */
export function disconnectSessionSockets(filter: SessionFilter) {
  if (!io) return
  for (const socket of io.sockets.sockets.values()) {
    const data = getSocketUser(socket)
    const matches = 'jti' in filter ? data.sessionJti === filter.jti : data.user?.id === filter.userId
    if (matches) endSocketSession(socket, 'revoked')
  }
}

/** Tell the client to drop its token, then cut the socket. The client reconnects as a guest. */
export function endSocketSession(socket: Socket, reason: 'revoked' | 'expired') {
  socket.emit('auth:session_ended', { reason })
  socket.disconnect(true)
}

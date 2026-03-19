import { Socket } from 'socket.io'
import { verifyToken, JWTPayload } from '../auth/jwt'
import prisma from '../db/prisma'

export interface SocketUserData {
  user?: { id: string; username: string; displayName: string }
  guest: boolean
}

export async function authMiddleware(socket: Socket, next: (err?: Error) => void): Promise<void> {
  const token = socket.handshake.auth?.token as string | undefined

  if (!token) {
    // No token = guest mode. Always allow connection.
    ;(socket.data as SocketUserData) = { guest: true }
    next()
    return
  }

  try {
    const payload: JWTPayload = verifyToken(token)

    // Check session not revoked
    const session = await prisma.session.findUnique({ where: { token: payload.jti } })
    if (!session || session.expiresAt < new Date()) {
      ;(socket.data as SocketUserData) = { guest: true }
      next()
      return
    }

    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, username: true, displayName: true },
    })

    if (!user) {
      ;(socket.data as SocketUserData) = { guest: true }
      next()
      return
    }

    ;(socket.data as SocketUserData) = {
      user: { id: user.id, username: user.username, displayName: user.displayName },
      guest: false,
    }

    // Update lastSeenAt (non-critical)
    await prisma.user.update({
      where: { id: user.id },
      data: { lastSeenAt: new Date() },
    }).catch(() => {})

    next()
  } catch {
    // Invalid token — allow as guest, don't reject
    ;(socket.data as SocketUserData) = { guest: true }
    next()
  }
}

// Helper to get typed socket data
export function getSocketUser(socket: Socket): SocketUserData {
  return (socket.data as SocketUserData) || { guest: true }
}

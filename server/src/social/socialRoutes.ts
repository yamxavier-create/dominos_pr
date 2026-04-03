import { Router, Request, Response } from 'express'
import prisma from '../db/prisma'
import { verifyToken } from '../auth/jwt'
import { RoomManager } from '../game/RoomManager'
import { PresenceManager } from '../presence/PresenceManager'

let roomManagerRef: RoomManager | null = null
let presenceRef: PresenceManager | null = null

export function setRoomManager(rm: RoomManager) {
  roomManagerRef = rm
}

export function setPresenceManager(pm: PresenceManager) {
  presenceRef = pm
}

const router = Router()

/** Extract authenticated userId from Bearer token, or send 401 */
async function requireAuth(req: Request, res: Response): Promise<string | null> {
  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Authentication required' })
    return null
  }
  try {
    const payload = verifyToken(authHeader.slice(7))
    return payload.sub
  } catch {
    res.status(401).json({ error: 'Invalid token' })
    return null
  }
}

const userSelect = { id: true, username: true, displayName: true, avatarUrl: true } as const

// GET /search?q=xxx — search users by username prefix, annotated with friendship status
router.get('/search', async (req: Request, res: Response) => {
  try {
    const userId = await requireAuth(req, res)
    if (!userId) return

    const q = (req.query.q as string || '').trim().toLowerCase()
    if (q.length < 2) {
      res.json({ users: [] })
      return
    }

    const users = await prisma.user.findMany({
      where: {
        username: { startsWith: q, mode: 'insensitive' },
        id: { not: userId },
      },
      select: userSelect,
      take: 10,
    })

    if (users.length === 0) {
      res.json({ users: [] })
      return
    }

    // Fetch existing friendships between current user and each result
    const userIds = users.map(u => u.id)
    const friendships = await prisma.friendship.findMany({
      where: {
        OR: [
          { requesterId: userId, targetId: { in: userIds } },
          { requesterId: { in: userIds }, targetId: userId },
        ],
      },
    })

    // Build lookup: otherUserId -> friendship
    const friendshipMap = new Map<string, typeof friendships[0]>()
    for (const f of friendships) {
      const otherId = f.requesterId === userId ? f.targetId : f.requesterId
      friendshipMap.set(otherId, f)
    }

    const annotated = users.map(u => {
      const f = friendshipMap.get(u.id)
      return {
        ...u,
        friendshipStatus: f ? f.status : null,
        friendshipDirection: f
          ? f.requesterId === userId ? 'outgoing' as const : 'incoming' as const
          : null,
      }
    })

    res.json({ users: annotated })
  } catch (err) {
    console.error('[Social] Search error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// GET /friends — list all accepted friends (both directions)
router.get('/friends', async (req: Request, res: Response) => {
  try {
    const userId = await requireAuth(req, res)
    if (!userId) return

    const friendships = await prisma.friendship.findMany({
      where: {
        status: 'ACCEPTED',
        OR: [{ requesterId: userId }, { targetId: userId }],
      },
      include: {
        requester: { select: userSelect },
        target: { select: userSelect },
      },
    })

    const friends = friendships.map(f => {
      const friend = f.requesterId === userId ? f.target : f.requester
      const roomCode = roomManagerRef?.getRoomCodeByUserId(friend.id)
      const room = roomCode ? roomManagerRef?.getRoom(roomCode) : undefined
      const canJoin = !!(room && room.status === 'waiting' && room.players.length < 4)
      const status = presenceRef?.getStatus(friend.id) ?? 'offline'
      return {
        ...friend,
        canJoin,
        status,
      }
    })

    res.json({ friends })
  } catch (err) {
    console.error('[Social] Friends error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// GET /requests — list incoming and outgoing pending friend requests
router.get('/requests', async (req: Request, res: Response) => {
  try {
    const userId = await requireAuth(req, res)
    if (!userId) return

    const [incoming, outgoing] = await Promise.all([
      prisma.friendship.findMany({
        where: { targetId: userId, status: 'PENDING' },
        include: { requester: { select: userSelect } },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.friendship.findMany({
        where: { requesterId: userId, status: 'PENDING' },
        include: { target: { select: userSelect } },
        orderBy: { createdAt: 'desc' },
      }),
    ])

    const requests = [
      ...incoming.map(f => ({ requestId: f.id, user: f.requester, direction: 'incoming' as const })),
      ...outgoing.map(f => ({ requestId: f.id, user: f.target, direction: 'outgoing' as const })),
    ]

    res.json({ requests })
  } catch (err) {
    console.error('[Social] Requests error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

export default router

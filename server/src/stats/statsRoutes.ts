import { Router, Request, Response } from 'express'
import prisma from '../db/prisma'
import { verifyToken } from '../auth/jwt'

const router = Router()

// Helper: extract userId from Bearer token
function getUserId(req: Request): string | null {
  const auth = req.headers.authorization
  if (!auth?.startsWith('Bearer ')) return null
  try {
    const payload = verifyToken(auth.slice(7))
    return payload.sub
  } catch {
    return null
  }
}

// GET /api/stats/me — my stats
router.get('/me', async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req)
    if (!userId) { res.status(401).json({ error: 'Not authenticated' }); return }

    const stats = await prisma.userStats.findUnique({ where: { userId } })
    const totalGames = stats?.gamesPlayed ?? 0
    const totalWins = stats?.gamesWon ?? 0
    const winRate = totalGames > 0 ? Math.round((totalWins / totalGames) * 100) : 0

    res.json({
      gamesPlayed: totalGames,
      gamesWon: totalWins,
      winRate,
    })
  } catch (err) {
    console.error('[Stats] Error fetching stats:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// GET /api/stats/history?limit=20&offset=0 — my game history
router.get('/history', async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req)
    if (!userId) { res.status(401).json({ error: 'Not authenticated' }); return }

    const limit = Math.min(parseInt(req.query.limit as string) || 20, 50)
    const offset = parseInt(req.query.offset as string) || 0

    const participations = await prisma.gameParticipant.findMany({
      where: { userId },
      orderBy: { gameHistory: { endedAt: 'desc' } },
      take: limit,
      skip: offset,
      include: {
        gameHistory: {
          include: {
            participants: {
              select: { playerName: true, playerIndex: true, team: true, won: true },
            },
          },
        },
      },
    })

    const games = participations.map((p) => ({
      id: p.gameHistory.id,
      gameMode: p.gameHistory.gameMode,
      won: p.won,
      team: p.team,
      winningTeam: p.gameHistory.winningTeam,
      scoreTeam0: p.gameHistory.scoreTeam0,
      scoreTeam1: p.gameHistory.scoreTeam1,
      totalRounds: p.gameHistory.totalRounds,
      playerCount: p.gameHistory.playerCount,
      endedAt: p.gameHistory.endedAt,
      players: p.gameHistory.participants.map((part) => ({
        name: part.playerName,
        index: part.playerIndex,
        team: part.team,
        won: part.won,
      })),
    }))

    res.json({ games })
  } catch (err) {
    console.error('[Stats] Error fetching history:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// GET /api/stats/leaderboard?limit=50 — top players by wins
router.get('/leaderboard', async (req: Request, res: Response) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100)

    const leaders = await prisma.userStats.findMany({
      where: { gamesPlayed: { gte: 1 } },
      orderBy: { gamesWon: 'desc' },
      take: limit,
      include: {
        user: {
          select: { id: true, username: true, displayName: true, avatarUrl: true },
        },
      },
    })

    const leaderboard = leaders.map((s, i) => ({
      rank: i + 1,
      userId: s.user.id,
      username: s.user.username,
      displayName: s.user.displayName,
      avatarUrl: s.user.avatarUrl,
      gamesPlayed: s.gamesPlayed,
      gamesWon: s.gamesWon,
      winRate: s.gamesPlayed > 0 ? Math.round((s.gamesWon / s.gamesPlayed) * 100) : 0,
    }))

    res.json({ leaderboard })
  } catch (err) {
    console.error('[Stats] Error fetching leaderboard:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

export default router

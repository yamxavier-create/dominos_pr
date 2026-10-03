import { Prisma } from '@prisma/client'
import prisma from '../db/prisma'
import { ServerGameState } from '../game/GameState'

/** Everything needed to record a finished game, copied out of the live state. */
export interface MatchResult {
  matchId: string
  roomCode: string
  gameMode: string
  ranked: boolean
  winningTeam: number
  totalRounds: number
  scoreTeam0: number
  scoreTeam1: number
  playerCount: number
  startedAt: Date
  participants: Array<{
    userId: string | null
    playerName: string
    playerIndex: number
    team: number
    won: boolean
    replacedByBot: boolean
  }>
}

/**
 * Snapshot the result right away: the same game object is reused (and reset)
 * by next_game/rematch, possibly while an earlier save is still retrying.
 */
export function matchResultFrom(game: ServerGameState, winningTeam: number): MatchResult {
  return {
    matchId: game.matchId,
    roomCode: game.roomCode,
    gameMode: game.gameMode,
    ranked: game.ranked,
    winningTeam,
    totalRounds: game.handNumber,
    scoreTeam0: game.scores.team0,
    scoreTeam1: game.scores.team1,
    playerCount: game.players.length,
    startedAt: new Date(game.startedAt),
    participants: game.players.map(p => ({
      // Lobby bots have no account; a human replaced by a bot keeps theirs for history
      userId: p.userId ?? null,
      playerName: p.name,
      playerIndex: p.index,
      team: p.index % 2,
      won: p.index % 2 === winningTeam,
      replacedByBot: !!p.replacedByBot,
    })),
  }
}

/**
 * Record the game and, if ranked, every player's stats as one transaction.
 * The unique matchId makes a repeat a no-op instead of a double count.
 */
export async function saveMatchResult(result: MatchResult): Promise<'saved' | 'duplicate'> {
  try {
    await prisma.$transaction(async tx => {
      await tx.gameHistory.create({
        data: {
          matchId: result.matchId,
          ranked: result.ranked,
          roomCode: result.roomCode,
          gameMode: result.gameMode,
          winningTeam: result.winningTeam,
          totalRounds: result.totalRounds,
          scoreTeam0: result.scoreTeam0,
          scoreTeam1: result.scoreTeam1,
          playerCount: result.playerCount,
          startedAt: result.startedAt,
          participants: { create: result.participants },
        },
      })
      if (!result.ranked) return

      const counted = new Set<string>()
      for (const p of result.participants) {
        if (!p.userId || counted.has(p.userId)) continue
        counted.add(p.userId)
        await tx.userStats.upsert({
          where: { userId: p.userId },
          create: { userId: p.userId, gamesPlayed: 1, gamesWon: p.won ? 1 : 0 },
          update: { gamesPlayed: { increment: 1 }, ...(p.won ? { gamesWon: { increment: 1 } } : {}) },
        })
      }
    })
    return 'saved'
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') return 'duplicate'
    throw err
  }
}

// Delays before each retry. Kept in memory: a server restart drops pending saves.
let retryDelaysMs = [5_000, 30_000, 2 * 60_000, 10 * 60_000]

/** Tests shorten the retry schedule. */
export function setRetryDelaysForTests(delays: number[]) {
  retryDelaysMs = delays
}

/** Save in the background, retrying failures; never throws into the game loop. */
export function persistMatchResult(result: MatchResult, attempt = 0): Promise<void> {
  return saveMatchResult(result).then(
    outcome => {
      console.log(`[Game] Match ${result.matchId} ${outcome}${result.ranked ? '' : ' (unranked)'} — team ${result.winningTeam} won`)
    },
    err => {
      const delay = retryDelaysMs[attempt]
      if (delay === undefined) {
        console.error(`[Game] Gave up saving match ${result.matchId}:`, err)
        return
      }
      console.error(`[Game] Saving match ${result.matchId} failed, retry ${attempt + 1} in ${delay}ms:`, err?.message ?? err)
      return new Promise<void>(resolve => {
        setTimeout(() => resolve(persistMatchResult(result, attempt + 1)), delay).unref()
      })
    },
  )
}

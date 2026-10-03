/**
 * Ranking integrity (bots, substitutions, atomic and idempotent saves) and
 * social spam controls (atomic request quota, rejection cooldown, invite limits).
 *
 * Needs the local test database: `npm run test:db:setup` once.
 */
import './env-db'
import './env'

import { describe } from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'crypto'
import prisma from '../src/db/prisma'
import { signToken } from '../src/auth/jwt'
import { saveMatchResult, persistMatchResult, setRetryDelaysForTests, MatchResult } from '../src/stats/persistMatch'
import { setupDbServer, dbTest, api, connectAs, waitFor, sleep, rooms, ClientSocket } from './dbHarness'

const GRACE = 300
setupDbServer('socialStats.test', { reconnectGraceMs: GRACE })

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** An account with a live session, created directly (no register rate limit). */
async function makeUser(name: string) {
  const user = await prisma.user.create({
    data: { username: name.toLowerCase(), displayName: name, passwordHash: 'x', stats: { create: {} } },
  })
  const { token, jti, expiresAt } = signToken(user.id, user.username)
  await prisma.session.create({ data: { userId: user.id, token: jti, expiresAt } })
  return { id: user.id, name, token }
}

async function statsOf(userId: string) {
  const s = await prisma.userStats.findUnique({ where: { userId } })
  return { played: s?.gamesPlayed ?? 0, won: s?.gamesWon ?? 0 }
}

function result(players: Array<{ id: string; name: string }>, overrides: Partial<MatchResult> = {}): MatchResult {
  return {
    matchId: randomUUID(),
    roomCode: 'TEST-0001',
    gameMode: 'modo500',
    ranked: true,
    winningTeam: 0,
    totalRounds: 3,
    scoreTeam0: 510,
    scoreTeam1: 200,
    playerCount: players.length,
    startedAt: new Date(),
    participants: players.map((p, i) => ({
      userId: p.id, playerName: p.name, playerIndex: i, team: i % 2, won: i % 2 === 0, replacedByBot: false,
    })),
    ...overrides,
  }
}

/** Four logged-in players in a started game; returns their sockets in seat order. */
async function startGame(users: Array<{ token: string; name: string }>) {
  const sockets: ClientSocket[] = []
  for (const u of users) sockets.push(await connectAs(u.token))
  sockets[0].emit('room:create', { playerName: users[0].name, gameMode: 'modo500' })
  const { roomCode } = await waitFor(sockets[0], 'room:created')
  for (let i = 1; i < users.length; i++) {
    sockets[i].emit('room:join', { roomCode, playerName: users[i].name })
    await waitFor(sockets[i], 'room:joined')
  }
  const started = sockets.map(s => waitFor(s, 'game:started'))
  sockets[0].emit('game:start', { roomCode })
  await Promise.all(started)
  return { roomCode, room: rooms.getRoom(roomCode)!, sockets }
}

/** Every social:* event the socket gets during the window. */
function socialEvents(socket: ClientSocket, ms = 800): Promise<Array<{ event: string; data: any }>> {
  const seen: Array<{ event: string; data: any }> = []
  const listener = (event: string, data: any) => { if (event.startsWith('social:')) seen.push({ event, data }) }
  socket.onAny(listener)
  return new Promise(resolve => setTimeout(() => { socket.offAny(listener); resolve(seen) }, ms))
}

// ─── 1. Only all-human games count ────────────────────────────────────────────

describe('ranking eligibility', () => {
  dbTest('a game with a lobby bot is unranked from the start', async () => {
    const ana = await makeUser('Ana')
    const socket = await connectAs(ana.token)
    socket.emit('room:create', { playerName: 'Ana', gameMode: 'modo500' })
    const { roomCode } = await waitFor(socket, 'room:created')
    for (let i = 0; i < 3; i++) {
      socket.emit('room:add_bot')
      await waitFor(socket, 'room:updated')
    }
    socket.emit('game:start', { roomCode })
    await waitFor(socket, 'game:started')
    assert.equal(rooms.getRoom(roomCode)!.game!.ranked, false)
  })

  dbTest('an all-human game is ranked until a bot takes a seat', async () => {
    const users = await Promise.all(['Ana', 'Beto', 'Carla', 'Dani'].map(makeUser))
    const { room, sockets } = await startGame(users)
    assert.equal(room.game!.ranked, true)

    const replaced = waitFor(sockets[0], 'connection:player_replaced')
    sockets[2].emit('room:leave') // abandons; a bot plays the seat
    await replaced
    assert.equal(room.game!.ranked, false)
    assert.equal(room.game!.players[2].replacedByBot, true)
  })

  dbTest('a disconnect past the grace period also makes the game unranked', async () => {
    const users = await Promise.all(['Ana', 'Beto', 'Carla', 'Dani'].map(makeUser))
    const { room, sockets } = await startGame(users)
    const replaced = waitFor(sockets[0], 'connection:player_replaced', GRACE + 1500)
    sockets[3].disconnect()
    await replaced
    assert.equal(room.game!.ranked, false)
  })

  dbTest('the next game is ranked again only if every seat is human again', async () => {
    const users = await Promise.all(['Ana', 'Beto', 'Carla', 'Dani'].map(makeUser))
    const { roomCode, room, sockets } = await startGame(users)
    const game = room.game!

    // Carla drops, a bot covers her, she comes back
    const replaced = waitFor(sockets[0], 'connection:player_replaced', GRACE + 1500)
    sockets[2].disconnect()
    await replaced
    const carla = await connectAs(users[2].token)
    carla.emit('room:rejoin', { roomCode })
    await waitFor(carla, 'room:joined')
    assert.equal(game.ranked, false, 'the current game stays unranked after she returns')

    const firstMatch = game.matchId
    game.phase = 'game_end'
    const next = waitFor(sockets[0], 'game:started')
    sockets[0].emit('game:next_game', { roomCode })
    await next
    assert.notEqual(game.matchId, firstMatch)
    assert.equal(game.ranked, true)
    assert.ok(game.players.every(p => !p.replacedByBot))

    // An abandoned seat stays a bot, so the following game is unranked
    sockets[3].emit('room:leave')
    await waitFor(sockets[0], 'connection:player_replaced')
    game.phase = 'game_end'
    const third = waitFor(sockets[0], 'game:started')
    sockets[0].emit('game:next_game', { roomCode })
    await third
    assert.equal(game.ranked, false)
  })

  dbTest('an unranked game is kept in history but never counted in stats', async () => {
    const users = await Promise.all(['Ana', 'Beto', 'Carla', 'Dani'].map(makeUser))
    const r = result(users, { ranked: false })
    r.participants[2].replacedByBot = true
    assert.equal(await saveMatchResult(r), 'saved')

    for (const u of users) assert.deepEqual(await statsOf(u.id), { played: 0, won: 0 })
    const history = await prisma.gameHistory.findUnique({ where: { matchId: r.matchId }, include: { participants: true } })
    assert.equal(history?.ranked, false)
    assert.equal(history?.participants.find(p => p.playerIndex === 2)?.replacedByBot, true)

    // The player's history labels it, and the leaderboard ignores it
    const mine = await api('/stats/history', undefined, { token: users[0].token })
    assert.equal(mine.body.games[0].ranked, false)
    const board = await api('/stats/leaderboard')
    assert.deepEqual(board.body.leaderboard, [])
  })
})

// ─── 2. Saving a result is atomic and idempotent ──────────────────────────────

describe('match persistence', () => {
  dbTest('a ranked game counts once per player, even if saved twice', async () => {
    const users = await Promise.all(['Ana', 'Beto', 'Carla', 'Dani'].map(makeUser))
    const r = result(users)
    assert.equal(await saveMatchResult(r), 'saved')
    assert.equal(await saveMatchResult(r), 'duplicate')
    assert.deepEqual(await statsOf(users[0].id), { played: 1, won: 1 })
    assert.deepEqual(await statsOf(users[1].id), { played: 1, won: 0 })
    assert.equal(await prisma.gameHistory.count({ where: { matchId: r.matchId } }), 1)
  })

  dbTest('a failure partway through saves nothing, and a retry saves it once', async () => {
    const users = await Promise.all(['Ana', 'Beto', 'Carla', 'Dani'].map(makeUser))
    // Make the third player's stats update fail inside the transaction
    await prisma.$executeRawUnsafe(`
      CREATE OR REPLACE FUNCTION test_fail_stats() RETURNS trigger AS $$
      BEGIN RAISE EXCEPTION 'injected failure'; END $$ LANGUAGE plpgsql`)
    await prisma.$executeRawUnsafe(`
      CREATE TRIGGER test_fail_stats BEFORE UPDATE ON "UserStats"
      FOR EACH ROW WHEN (NEW."userId" = '${users[2].id}') EXECUTE FUNCTION test_fail_stats()`)
    try {
      const r = result(users)
      await assert.rejects(saveMatchResult(r), /injected failure/)
      assert.equal(await prisma.gameHistory.count(), 0, 'history saved without stats')
      assert.deepEqual(await statsOf(users[0].id), { played: 0, won: 0 }, 'earlier stats kept after rollback')

      // Background save: fails, then succeeds once the fault is gone
      setRetryDelaysForTests([150, 150])
      const saving = persistMatchResult(r)
      await sleep(50)
      await prisma.$executeRawUnsafe('DROP TRIGGER test_fail_stats ON "UserStats"')
      await saving
      assert.equal(await prisma.gameHistory.count({ where: { matchId: r.matchId } }), 1)
      for (const u of users) assert.equal((await statsOf(u.id)).played, 1)
    } finally {
      await prisma.$executeRawUnsafe('DROP TRIGGER IF EXISTS test_fail_stats ON "UserStats"')
      await prisma.$executeRawUnsafe('DROP FUNCTION IF EXISTS test_fail_stats()')
    }
  })
})

// ─── 3. Social spam controls ──────────────────────────────────────────────────

describe('friend requests', () => {
  dbTest('a burst of concurrent requests cannot overshoot the pending quota', async () => {
    const ana = await makeUser('Ana')
    const targets = await Promise.all(Array.from({ length: 25 }, (_, i) => makeUser(`Target${i}`)))
    // 15 already pending; 10 more fired at once must stop at the cap of 20
    await prisma.friendship.createMany({ data: targets.slice(0, 15).map(t => ({ requesterId: ana.id, targetId: t.id })) })
    const socket = await connectAs(ana.token)
    const events = socialEvents(socket, 1500)
    for (const t of targets.slice(15)) socket.emit('social:friend_request', { targetUserId: t.id })
    const seen = await events
    assert.equal(await prisma.friendship.count({ where: { requesterId: ana.id, status: 'PENDING' } }), 20)
    assert.equal(seen.filter(e => e.event === 'social:friend_request_sent').length, 5)
  })

  dbTest('simultaneous requests in both directions end as one friendship', async () => {
    const [ana, beto] = await Promise.all([makeUser('Ana'), makeUser('Beto')])
    const [a, b] = await Promise.all([connectAs(ana.token), connectAs(beto.token)])
    a.emit('social:friend_request', { targetUserId: beto.id })
    b.emit('social:friend_request', { targetUserId: ana.id })
    await sleep(800)
    const rows = await prisma.friendship.findMany()
    assert.equal(rows.length, 1)
    assert.equal(rows[0].status, 'ACCEPTED')
  })

  dbTest('a rejected request cannot be resent until the cooldown passes', async () => {
    const [ana, beto] = await Promise.all([makeUser('Ana'), makeUser('Beto')])
    const [a, b] = await Promise.all([connectAs(ana.token), connectAs(beto.token)])
    a.emit('social:friend_request', { targetUserId: beto.id })
    const { requestId } = await waitFor(b, 'social:friend_request_received')
    b.emit('social:friend_reject', { requestId })
    await waitFor(a, 'social:friend_rejected')

    a.emit('social:friend_request', { targetUserId: beto.id })
    assert.match((await waitFor(a, 'social:error')).message, /yet/)
    assert.equal((await prisma.friendship.findUnique({ where: { id: requestId } }))?.status, 'REJECTED')

    // The rejection isn't shown as a relation in search
    const search = await api('/social/search?q=beto', undefined, { token: ana.token })
    assert.equal(search.body.users[0].friendshipStatus, null)

    // The person who rejected can still reach out
    b.emit('social:friend_request', { targetUserId: ana.id })
    await waitFor(b, 'social:friend_request_sent')
    const row = await prisma.friendship.findUnique({ where: { id: requestId } })
    assert.deepEqual([row?.requesterId, row?.status], [beto.id, 'PENDING'])
  })

  dbTest('after the cooldown the same person can ask again', async () => {
    const [ana, beto] = await Promise.all([makeUser('Ana'), makeUser('Beto')])
    await prisma.$executeRawUnsafe(
      `INSERT INTO "Friendship" (id, "requesterId", "targetId", status, "createdAt", "updatedAt")
       VALUES ('old', '${ana.id}', '${beto.id}', 'REJECTED', now() - interval '8 days', now() - interval '8 days')`,
    )
    const a = await connectAs(ana.token)
    a.emit('social:friend_request', { targetUserId: beto.id })
    await waitFor(a, 'social:friend_request_sent')
    assert.equal((await prisma.friendship.findUnique({ where: { id: 'old' } }))?.status, 'PENDING')
  })

  dbTest('requests are rate limited per user before touching the DB', async () => {
    const ana = await makeUser('Ana')
    const targets = await Promise.all(Array.from({ length: 11 }, (_, i) => makeUser(`T${i}`)))
    const socket = await connectAs(ana.token)
    const events = socialEvents(socket, 1500)
    for (const t of targets) socket.emit('social:friend_request', { targetUserId: t.id })
    const seen = await events
    assert.equal(seen.filter(e => e.event === 'social:friend_request_sent').length, 10)
    assert.ok(seen.some(e => e.event === 'social:error' && /Too many requests/.test(e.data.message)))
  })
})

describe('game invites', () => {
  dbTest('a friend can be invited once every 30 seconds', async () => {
    const [ana, beto] = await Promise.all([makeUser('Ana'), makeUser('Beto')])
    await prisma.friendship.create({ data: { requesterId: ana.id, targetId: beto.id, status: 'ACCEPTED' } })
    const [a, b] = await Promise.all([connectAs(ana.token), connectAs(beto.token)])
    a.emit('room:create', { playerName: 'Ana', gameMode: 'modo200' })
    await waitFor(a, 'room:created')

    const received = socialEvents(b, 1000)
    const sent = socialEvents(a, 1000)
    for (let i = 0; i < 5; i++) a.emit('social:invite_to_game', { friendUserId: beto.id })
    assert.equal((await received).filter(e => e.event === 'social:game_invite').length, 1)
    assert.ok((await sent).some(e => e.event === 'social:error' && /Too many requests/.test(e.data.message)))
  })
})

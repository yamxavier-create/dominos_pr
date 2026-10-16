/**
 * Hand scoring that depends on how the hand closes.
 */
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { setupTestServer, waitFor, collect, sleep } from './harness'
import { Tile, PipValue, ServerGameState } from '../src/game/GameState'
import { HouseRules, TORNEO_TIME_LIMIT_MS } from '../src/game/rules'

const h = setupTestServer()
const { startFourPlayerGame, createLobby } = h

function tile(a: PipValue, b: PipValue): Tile {
  const low = Math.min(a, b) as PipValue
  const high = Math.max(a, b) as PipValue
  return { id: `${low}-${high}`, low, high, isDouble: low === high }
}

describe('tranque (Modo 200)', () => {
  test('the passes that close a tranque award no bonus; the tranque is +2 and then the pips', async () => {
    const { roomCode, room, seats } = await startFourPlayerGame(undefined, 'modo200')
    const game = room.game!
    assert.equal(game.players[0].socketId, seats[0].socket.id)

    // Board ends 6 and 1. Seat 0 plays 1-3 on the right: the ends become 6 and 3,
    // and nobody holds a 6 or a 3.
    game.board = {
      tiles: [{ tile: tile(1, 6), orientation: 'horizontal', leftPip: 6, rightPip: 1, playedByIndex: 1, sequence: 0 }],
      leftEnd: 6,
      rightEnd: 1,
    }
    game.firstPlayMade = true
    game.forcedFirstTileId = ''
    game.boneyard = []
    game.players[0].tiles = [tile(1, 3), tile(0, 0)]  // 0 pips left
    game.players[1].tiles = [tile(0, 1), tile(1, 1)]  // 3
    game.players[2].tiles = [tile(0, 2), tile(2, 2)]  // 6
    game.players[3].tiles = [tile(1, 2), tile(4, 4)]  // 11
    game.currentPlayerIndex = 0
    game.consecutivePasses = 0
    game.gamePassCount = 1
    game.passPointsThisHand = 0
    // Ellos are one point from 20: a pass bonus for seat 0's own pass would end the game for them
    game.scores = { team0: 10, team1: 19 }

    const events = collect(seats[0].socket, 500)
    const ended = waitFor(seats[0].socket, 'game:round_ended')
    seats[0].socket.emit('game:play_tile', { roomCode, tileId: '1-3', targetEnd: 'right' })
    const result = await ended

    assert.equal(result.reason, 'blocked')
    assert.equal(result.bonusPoints, 2)
    assert.equal(result.winnerIndex, 0)
    // 3 + 6 + 11 = 20 pips → 2 points
    assert.equal(result.pointsFromPips, 2)
    assert.equal(result.passPointsThisHand, 0)
    assert.deepEqual(result.scores, { team0: 14, team1: 19 })
    assert.deepEqual(game.scores, { team0: 14, team1: 19 })
    assert.equal(game.phase, 'round_end')
    assert.equal(game.gamePassCount, 1)
    assert.ok(!(await events).includes('game:game_ended'))
  })
})

/**
 * Board ends 6 and 1, nobody can draw. Seat 0 holds 1-3 plus `seat0Rest` and
 * plays 1-3 on the right; the other seats hold `hands`.
 */
function rigHand(game: ServerGameState, seat0Rest: Tile[], hands: [Tile[], Tile[], Tile[]]) {
  game.board = {
    tiles: [{ tile: tile(1, 6), orientation: 'horizontal', leftPip: 6, rightPip: 1, playedByIndex: 1, sequence: 0 }],
    leftEnd: 6,
    rightEnd: 1,
  }
  game.firstPlayMade = true
  game.forcedFirstTileId = ''
  game.boneyard = []
  game.players[0].tiles = [tile(1, 3), ...seat0Rest]
  game.players[1].tiles = hands[0]
  game.players[2].tiles = hands[1]
  game.players[3].tiles = hands[2]
  game.currentPlayerIndex = 0
  game.handStarterIndex = 0
  game.consecutivePasses = 0
  game.gamePassCount = 0
  game.passPointsThisHand = 0
  game.scores = { team0: 0, team1: 0 }
}

async function startWithRules(gameMode: string, rules: Partial<HouseRules>) {
  const { roomCode, room, seats } = await createLobby(undefined, gameMode)
  if (Object.keys(rules).length) {
    const updated = waitFor(seats[0].socket, 'room:updated')
    seats[0].socket.emit('room:set_rules', { rules })
    await updated
  }
  const started = seats.map(s => waitFor(s.socket, 'game:started'))
  seats[0].socket.emit('game:start', { roomCode })
  await Promise.all(started)
  return { roomCode, room, seats, game: room.game! }
}

async function playAndWaitForHandEnd(seat: { socket: any }, roomCode: string) {
  const ended = waitFor(seat.socket, 'game:round_ended')
  seat.socket.emit('game:play_tile', { roomCode, tileId: '1-3', targetEnd: 'right' })
  return ended
}

describe('house rules', () => {
  test('tranque en pareja: the lighter team sum wins, not the lightest hand', async () => {
    const { roomCode, seats, game } = await startWithRules('modo200', { tranque: 'pareja', blockBonus: false })
    // Seat 1 has the lightest hand (1), but team 0 (seats 0+2) is lighter: 4+4=8 vs 1+12=13
    rigHand(game, [tile(0, 4)], [[tile(0, 1)], [tile(2, 2)], [tile(0, 5), tile(2, 5), tile(0, 0)]])
    const result = await playAndWaitForHandEnd(seats[0], roomCode)
    assert.equal(result.reason, 'blocked')
    assert.equal(result.winningTeam, 0)
    // Pareja scores the other team's pips: 13 → 1 point in tens
    assert.equal(result.rawPipCount, 13)
    assert.deepEqual(game.scores, { team0: 1, team1: 0 })
  })

  test('a tied tranque goes to the team that led the hand when the table plays it that way', async () => {
    const { roomCode, seats, game } = await startWithRules('modo500', { tiedTranque: 'salida' })
    // Team sums tie at 8; seat 1 led the hand
    rigHand(game, [tile(0, 4)], [[tile(0, 4)], [tile(2, 2)], [tile(2, 2)]])
    game.handStarterIndex = 1
    const result = await playAndWaitForHandEnd(seats[0], roomCode)
    assert.equal(result.winningTeam, 1)
    assert.equal(result.rawPipCount, 8)
    assert.deepEqual(game.scores, { team0: 0, team1: 8 })
  })

  test('with the default, a tied tranque scores nothing', async () => {
    const { roomCode, seats, game } = await startWithRules('modo500', {})
    rigHand(game, [tile(0, 4)], [[tile(0, 4)], [tile(2, 2)], [tile(2, 2)]])
    const result = await playAndWaitForHandEnd(seats[0], roomCode)
    assert.equal(result.winningTeam, null)
    assert.deepEqual(game.scores, { team0: 0, team1: 0 })
  })

  test('passes score only when the table plays pass points', async () => {
    for (const passPoints of [true, false]) {
      const { roomCode, seats, game } = await startWithRules('modo200', { passPoints })
      // Seat 1 (next) has nothing for 6 or 3 and passes; seat 2 can play 3-4
      rigHand(game, [tile(0, 0)], [[tile(0, 1)], [tile(3, 4)], [tile(3, 5)]])
      const passed = waitFor(seats[0].socket, 'game:player_passed')
      seats[0].socket.emit('game:play_tile', { roomCode, tileId: '1-3', targetEnd: 'right' })
      assert.equal((await passed).playerIndex, 1)
      await sleep(50)
      assert.deepEqual(game.scores, passPoints ? { team0: 2, team1: 0 } : { team0: 0, team1: 0 })
    }
  })
})

describe('Torneo', () => {
  test('counts pips as they are, to 200, and the next hand rotates', async () => {
    const { roomCode, seats, game } = await startWithRules('torneo', {})
    assert.equal(game.targetScore, 200)
    assert.deepEqual(game.rules, { tranque: 'pareja', passPoints: false, blockBonus: false, tiedTranque: 'nadie' })
    rigHand(game, [], [[tile(6, 5)], [tile(6, 6)], [tile(4, 5)]])  // seat 0 plays out
    game.handStarterIndex = 2
    const result = await playAndWaitForHandEnd(seats[0], roomCode)
    assert.equal(result.reason, 'played_out')
    assert.equal(result.pointsFromPips, 32)
    assert.equal(result.bonusPoints, 0)
    assert.deepEqual(game.scores, { team0: 32, team1: 0 })
    // Rotation from the hand's leader (seat 2 → seat 3), not the winner
    assert.equal(result.nextStarterIndex, 3)
    assert.equal(game.phase, 'round_end')
  })

  test('after 35 minutes the hand in play finishes and the team ahead wins', async () => {
    const { roomCode, seats, game } = await startWithRules('torneo', {})
    game.startedAt = Date.now() - TORNEO_TIME_LIMIT_MS - 1000
    rigHand(game, [], [[tile(0, 1)], [tile(0, 2)], [tile(0, 3)]])
    game.scores = { team0: 10, team1: 40 }
    const gameEnded = waitFor(seats[0].socket, 'game:game_ended')
    await playAndWaitForHandEnd(seats[0], roomCode)
    // 10 + 6 = 16 still behind 40: the other team wins on time
    assert.equal((await gameEnded).winningTeam, 1)
    assert.equal(game.phase, 'game_end')
  })

  test('a tie when time runs out plays another hand', async () => {
    const { roomCode, seats, game } = await startWithRules('torneo', {})
    game.startedAt = Date.now() - TORNEO_TIME_LIMIT_MS - 1000
    rigHand(game, [], [[tile(0, 1)], [tile(0, 2)], [tile(0, 3)]])
    game.scores = { team0: 34, team1: 40 }
    const events = collect(seats[0].socket, 300)
    await playAndWaitForHandEnd(seats[0], roomCode)
    assert.deepEqual(game.scores, { team0: 40, team1: 40 })
    assert.equal(game.phase, 'round_end')
    assert.ok(!(await events).includes('game:game_ended'))
  })

  test('its rules cannot be changed', async () => {
    const { seats, room } = await createLobby(undefined, 'torneo')
    seats[0].socket.emit('room:set_rules', { rules: { tranque: 'individual' } })
    assert.equal((await waitFor(seats[0].socket, 'room:error')).code, 'INVALID_RULES')
    assert.equal(room.rules.tranque, 'pareja')
  })
})

describe('room:set_rules', () => {
  test('only the host, only rules the mode allows, only valid values', async () => {
    const { seats, room } = await createLobby(undefined, 'modo500')
    const before = { ...room.rules }

    seats[1].socket.emit('room:set_rules', { rules: { tranque: 'individual' } })
    await sleep(100)
    assert.deepEqual(room.rules, before)

    for (const rules of [{ passPoints: true }, { tranque: 'nadie' }, { tiedTranque: true }, 'pareja', null]) {
      seats[0].socket.emit('room:set_rules', { rules })
      assert.equal((await waitFor(seats[0].socket, 'room:error')).code, 'INVALID_RULES')
    }
    assert.deepEqual(room.rules, before)

    const updated = waitFor(seats[2].socket, 'room:updated')
    seats[0].socket.emit('room:set_rules', { rules: { tranque: 'individual' } })
    assert.equal((await updated).room.rules.tranque, 'individual')
  })
})

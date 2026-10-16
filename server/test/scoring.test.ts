/**
 * Hand scoring that depends on how the hand closes.
 */
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { setupTestServer, waitFor, collect } from './harness'
import { Tile, PipValue } from '../src/game/GameState'

const h = setupTestServer()
const { startFourPlayerGame } = h

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

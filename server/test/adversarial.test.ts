/**
 * Adversarial tests for the socket layer: seat hijacking on reconnect,
 * restarting a live game, and malformed payloads.
 *
 * Runs a real Socket.io server in-process with the production connection
 * handler. Run with `npm test` from the repo root.
 */
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { setupTestServer, waitFor, collect, sleep, ClientSocket } from './harness'

const h = setupTestServer()
const { connect, startFourPlayerGame, dropSeat } = h

// ─── 1. Reconnection must prove seat ownership ────────────────────────────────

describe('reconnection', () => {
  test('every seat gets a distinct token that is never broadcast', async () => {
    const { room, seats } = await startFourPlayerGame()
    const tokens = seats.map(s => s.reconnectToken)
    assert.ok(tokens.every(t => typeof t === 'string' && t.length >= 32))
    assert.equal(new Set(tokens).size, 4)
    const info = JSON.stringify(h.rooms.getRoomInfo(room))
    for (const t of tokens) assert.ok(!info.includes(t), 'room info leaks a reconnect token')
  })

  test('another account cannot take a disconnected authenticated seat by name', async () => {
    const { roomCode, room, seats } = await startFourPlayerGame()
    const victim = seats[1]
    await dropSeat(victim)

    for (const attacker of [await connect('user-mallory'), await connect()]) {
      attacker.emit('room:join', { roomCode, playerName: victim.name })
      const error = await waitFor(attacker, 'room:error')
      assert.equal(error.code, 'ROOM_NOT_FOUND')
    }
    assert.equal(room.game!.players[1].connected, false)
  })

  test('room:rejoin by name alone does not move a seat, connected or not', async () => {
    const { roomCode, room, seats } = await startFourPlayerGame()
    await dropSeat(seats[2]) // disconnected guest
    const connectedSocketId = room.game!.players[3].socketId

    const attacker = await connect()
    for (const victim of [seats[2], seats[3]]) {
      const events = collect(attacker)
      attacker.emit('room:rejoin', { roomCode, playerName: victim.name })
      assert.deepEqual(await events, ['room:rejoin_failed'])
    }
    const events = collect(attacker)
    attacker.emit('room:rejoin', { roomCode, reconnectToken: 'not-the-token' })
    assert.deepEqual(await events, ['room:rejoin_failed'])

    assert.equal(room.game!.players[2].connected, false)
    assert.equal(room.game!.players[3].socketId, connectedSocketId)
    assert.ok(!room.game!.players.some(p => p.socketId === attacker.id))
  })

  test('a seat token cannot be reused for a different seat', async () => {
    const { roomCode, room, seats } = await startFourPlayerGame()
    await dropSeat(seats[3])
    // Carla (seat 2) is connected and tries her own token to grab Dani's seat
    const carla = await connect()
    carla.emit('room:rejoin', { roomCode, reconnectToken: seats[2].reconnectToken })
    const joined = await waitFor(carla, 'room:joined')
    assert.equal(joined.myPlayerIndex, 2)
    assert.equal(room.game!.players[3].connected, false)
  })

  test('the real owner reconnects with userId or token', async () => {
    const { roomCode, room, seats } = await startFourPlayerGame()

    // Authenticated: userId is enough, even with a different display name
    await dropSeat(seats[1])
    const beto = await connect('user-beto')
    beto.emit('room:join', { roomCode, playerName: 'otro nombre' })
    const betoJoined = await waitFor(beto, 'room:joined')
    assert.equal(betoJoined.myPlayerIndex, 1)
    assert.equal(betoJoined.reconnectToken, seats[1].reconnectToken)
    assert.equal(room.game!.players[1].socketId, beto.id)

    // Guest: token via room:rejoin (socket reconnect) ...
    await dropSeat(seats[2])
    const carla = await connect()
    const snapshot = waitFor(carla, 'game:state_snapshot')
    carla.emit('room:rejoin', { roomCode, reconnectToken: seats[2].reconnectToken })
    assert.equal((await waitFor(carla, 'room:joined')).myPlayerIndex, 2)
    assert.equal((await snapshot).gameState.myPlayerIndex, 2)

    // ... and via room:join (page reload, typed the code again)
    await dropSeat(seats[3])
    const dani = await connect()
    dani.emit('room:join', { roomCode, playerName: 'Dani', reconnectToken: seats[3].reconnectToken })
    assert.equal((await waitFor(dani, 'room:joined')).myPlayerIndex, 3)
    assert.equal(room.game!.players[3].connected, true)
  })

  test('a reconnecting host keeps host rights', async () => {
    const { roomCode, room, seats } = await startFourPlayerGame()
    await dropSeat(seats[0])
    const ana = await connect('user-ana')
    ana.emit('room:rejoin', { roomCode })
    await waitFor(ana, 'room:joined')
    assert.equal(room.hostSocketId, ana.id)
  })
})

// ─── 2. game:start cannot reset a live game ───────────────────────────────────

describe('game:start during a game', () => {
  test('is rejected while playing and while between hands', async () => {
    const { roomCode, room, seats } = await startFourPlayerGame()
    const game = room.game!
    game.scores = { team0: 120, team1: 450 }
    game.handNumber = 5

    for (const phase of ['playing', 'round_end'] as const) {
      game.phase = phase
      seats[0].socket.emit('game:start', { roomCode })
      const error = await waitFor(seats[0].socket, 'room:error')
      assert.equal(error.code, 'GAME_IN_PROGRESS')
      assert.equal(room.game, game, 'game object was replaced')
      assert.deepEqual(game.scores, { team0: 120, team1: 450 })
      assert.equal(game.handNumber, 5)
      assert.equal(game.phase, phase)
    }
  })

  test('a non-host cannot start either', async () => {
    const { roomCode, room, seats } = await startFourPlayerGame()
    const game = room.game!
    seats[1].socket.emit('game:start', { roomCode })
    assert.equal((await waitFor(seats[1].socket, 'room:error')).code, 'NOT_HOST')
    assert.equal(room.game, game)
  })

  test('is allowed again once the game has ended', async () => {
    const { roomCode, room, seats } = await startFourPlayerGame()
    const finished = room.game!
    finished.phase = 'game_end'
    const started = waitFor(seats[0].socket, 'game:started')
    seats[0].socket.emit('game:start', { roomCode })
    await started
    assert.notEqual(room.game, finished)
    assert.equal(room.game!.handNumber, 1)
  })
})

// ─── 3. Malformed payloads never crash the server ─────────────────────────────

const RESERVED = new Set(['disconnect', 'disconnecting', 'error', 'connect', 'newListener', 'removeListener'])

const BAD_PAYLOADS: unknown[][] = [
  [],                    // no payload at all
  [null],
  [undefined],
  [42],
  ['GALLO-1234'],
  [true],
  [[]],
  [[1, 2, 3]],
  [{ roomCode: {}, tileId: 5, targetEnd: 'up', playerName: 7, gameMode: 'modo9000',
     reconnectToken: {}, seatA: '0', seatB: null, seatIndex: 'x', message: 9, type: [],
     userIds: 'nope', friendUserId: 1, requestId: [], targetUserId: null, to: 'x' }],
]

async function fuzzAllEvents(socket: ClientSocket, extra: Record<string, unknown> = {}, skip: string[] = []) {
  const serverSocket = h.io.sockets.sockets.get(socket.id!)
  assert.ok(serverSocket, 'server socket not found')
  const events = serverSocket.eventNames().map(String).filter(e => !RESERVED.has(e) && !skip.includes(e))
  assert.ok(events.includes('game:play_tile') && events.includes('room:join'), 'handlers not registered')

  for (const event of events) {
    for (const args of BAD_PAYLOADS) {
      socket.emit(event, ...args)
      socket.emit(event, ...args, () => {}) // with an ack callback
    }
    // Right types, wrong values, aimed at a real room
    socket.emit(event, { roomCode: 'NOPE-0000', tileId: '9-9', targetEnd: 'left', ...extra })
  }
  return events
}

describe('malformed payloads', () => {
  test('every registered event survives garbage from a guest outside any room', async () => {
    const socket = await connect()
    await fuzzAllEvents(socket)
    await sleep(500)
    assert.deepEqual(h.processErrors, [])
    assert.ok(socket.connected)
  })

  test('every registered event survives garbage from players inside a live game', async () => {
    const { roomCode, room, seats } = await startFourPlayerGame()
    const before = JSON.stringify(room.game)
    // Host (authenticated) and a guest, both seated in a real game. room:leave
    // takes no payload and legitimately marks the seat disconnected, so skip it.
    await fuzzAllEvents(seats[0].socket, { roomCode }, ['room:leave'])
    await fuzzAllEvents(seats[2].socket, { roomCode }, ['room:leave'])
    await sleep(800)
    assert.deepEqual(h.processErrors, [])
    assert.equal(JSON.stringify(room.game), before, 'garbage payloads changed game state')
  })

  test('the server keeps serving after the fuzzing', async () => {
    const socket = await connect()
    socket.emit('room:create', { playerName: 'Eva', gameMode: 'modo200' })
    const created = await waitFor(socket, 'room:created')
    assert.match(created.roomCode, /^[A-Z]+-\d{4}$/)
    assert.deepEqual(h.processErrors, [])
  })

  test('room:create rejects an unknown game mode', async () => {
    const socket = await connect()
    socket.emit('room:create', { playerName: 'Eva', gameMode: 'modo9000' })
    assert.equal((await waitFor(socket, 'room:error')).code, 'INVALID_MODE')
  })
})

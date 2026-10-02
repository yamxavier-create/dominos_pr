/**
 * Room and seat lifecycle: disconnects during a turn, host handover, lobby
 * seats, one room per socket, multiple devices and the cleanup sweep.
 *
 * The reconnect grace period is shortened so timeouts run in milliseconds.
 */
import { test, describe, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { setupTestServer, waitFor, waitUntil, collect, sleep, Seat, FOUR_PLAYERS } from './harness'

const GRACE = 300
const EMPTY_TTL = 10 * 60_000
const IDLE_TTL = 3 * 60 * 60_000
const BOT_TURN = 4000 // BOT_THINK_DELAY is 2.5s

const h = setupTestServer({ reconnectGraceMs: GRACE, emptyRoomTtlMs: EMPTY_TTL, idleRoomTtlMs: IDLE_TTL })
const { connect, createLobby, startFourPlayerGame, dropSeat } = h

// Rooms outlive their sockets for the grace period; drop them so leftover
// grace and bot timers from one test can't touch the next.
afterEach(async () => {
  await sleep(50)
  h.rooms.cleanup(Number.POSITIVE_INFINITY)
})

/** Reconnect a seat from a fresh socket, the way the client does after a drop. */
async function reconnect(roomCode: string, seat: Seat) {
  const socket = await connect(seat.userId)
  const joined = waitFor(socket, 'room:joined')
  socket.emit('room:rejoin', { roomCode, reconnectToken: seat.reconnectToken })
  return { socket, joined: await joined }
}

// ─── 1. A disconnect never freezes the game ───────────────────────────────────

describe('disconnect during a game', () => {
  test('a player who drops on their turn is covered by a bot after the grace period', async () => {
    const { room, seats } = await startFourPlayerGame()
    const game = room.game!
    const current = game.currentPlayerIndex
    const watcher = seats[(current + 1) % 4].socket

    const replaced = waitUntil(watcher, 'connection:player_replaced', d => d.playerIndex === current, GRACE + 1000)
    const played = waitUntil(watcher, 'game:state_snapshot', d => d.gameState.board.tiles.length === 1, GRACE + BOT_TURN)
    await dropSeat(seats[current])

    await replaced
    await played
    assert.notEqual(game.currentPlayerIndex, current)
    assert.equal(game.players[current].substitutedByBot, true)
  })

  test('coming back inside the grace period keeps the seat and the turn', async () => {
    const { roomCode, room, seats } = await startFourPlayerGame()
    const game = room.game!
    const current = game.currentPlayerIndex
    const watcher = seats[(current + 1) % 4].socket

    await dropSeat(seats[current])
    const { socket } = await reconnect(roomCode, seats[current])
    const quiet = collect(watcher, GRACE + 200)
    assert.ok(!(await quiet).includes('connection:player_replaced'))
    assert.equal(game.players[current].isBot, false)

    const played = waitUntil(socket, 'game:state_snapshot', d => d.gameState.board.tiles.length === 1)
    socket.emit('game:play_tile', { roomCode, tileId: game.forcedFirstTileId, targetEnd: 'right' })
    await played
  })

  test('the owner takes the seat back from the bot', async () => {
    const { roomCode, room, seats } = await startFourPlayerGame()
    const game = room.game!
    const idle = (game.currentPlayerIndex + 2) % 4 // not on turn, so the bot won't move for it
    const watcher = seats[game.currentPlayerIndex].socket

    const replaced = waitUntil(watcher, 'connection:player_replaced', d => d.playerIndex === idle, GRACE + 1000)
    await dropSeat(seats[idle])
    await replaced
    assert.equal(game.players[idle].isBot, true)

    const { socket, joined } = await reconnect(roomCode, seats[idle])
    assert.equal(joined.myPlayerIndex, idle)
    const player = game.players[idle]
    assert.deepEqual(
      { isBot: player.isBot, substitutedByBot: player.substitutedByBot, connected: player.connected, socketId: player.socketId },
      { isBot: false, substitutedByBot: false, connected: true, socketId: socket.id },
    )
  })
})

// ─── 2. Host rights never get stuck on a missing player ───────────────────────

describe('host leaving a game', () => {
  test('host rights move to a connected player when the host does not come back', async () => {
    const { roomCode, room, seats } = await startFourPlayerGame()
    const heir = seats[1].socket // first connected human after seat 0

    const handover = waitUntil(heir, 'room:updated', d => d.room.hostSocketId === heir.id, GRACE + 1000)
    await dropSeat(seats[0])
    await handover
    assert.equal(room.hostSocketId, heir.id)

    room.game!.phase = 'round_end'
    const nextHand = waitUntil(heir, 'game:state_snapshot', d => d.gameState.handNumber === 2)
    heir.emit('game:next_hand', { roomCode })
    await nextHand
  })

  test('a host who leaves on purpose hands over at once and cannot come back', async () => {
    const { roomCode, room, seats } = await startFourPlayerGame()
    const heir = seats[1].socket

    const handover = waitUntil(heir, 'room:updated', d => d.room.hostSocketId === heir.id, GRACE / 2)
    const replaced = waitUntil(heir, 'connection:player_replaced', d => d.playerIndex === 0, GRACE / 2)
    seats[0].socket.emit('room:leave')
    await handover
    await replaced

    const back = await connect('user-ana')
    back.emit('room:rejoin', { roomCode, reconnectToken: seats[0].reconnectToken })
    await waitFor(back, 'room:rejoin_failed')
    assert.equal(room.players[0].abandoned, true)
    assert.equal(room.hostSocketId, heir.id)
  })

  test('if nobody could inherit host, the first player back gets it', async () => {
    const { roomCode, room, seats } = await startFourPlayerGame()
    await Promise.all(seats.slice(1).map(dropSeat))
    seats[0].socket.emit('room:leave')
    await sleep(GRACE + 200)

    const { socket } = await reconnect(roomCode, seats[2])
    assert.equal(room.hostSocketId, socket.id)
  })
})

// ─── 3. Lobby seats survive short drops and stay in sync ──────────────────────

describe('lobby', () => {
  const THREE = [FOUR_PLAYERS[0], FOUR_PLAYERS[2], FOUR_PLAYERS[3]] // Ana (auth), Carla, Dani

  test('a lobby seat survives a short disconnect', async () => {
    const { roomCode, room, seats } = await createLobby(THREE)
    const host = seats[0].socket

    const shownOffline = waitUntil(host, 'room:updated', d => d.room.players[1].connected === false)
    await dropSeat(seats[1])
    await shownOffline

    const { joined } = await reconnect(roomCode, seats[1])
    assert.equal(joined.myPlayerIndex, 1)
    assert.equal(room.players.length, 3)
    assert.equal(room.players[1].connected, true)
  })

  test('after the grace period the seat is released and everyone gets their new index', async () => {
    const { roomCode, room, seats } = await createLobby(THREE)
    const [ana, carla, dani] = seats

    const carlaUpdate = waitUntil(carla.socket, 'room:updated', d => d.myPlayerIndex === 0, GRACE + 1000)
    const daniUpdate = waitUntil(dani.socket, 'room:updated', d => d.myPlayerIndex === 1, GRACE + 1000)
    await dropSeat(ana)
    const update = await carlaUpdate
    await daniUpdate

    assert.equal(update.room.hostSocketId, carla.socket.id)
    assert.equal(room.hostSocketId, carla.socket.id)
    assert.deepEqual(room.players.map(p => [p.seatIndex, p.name]).sort(), [[0, 'Carla'], [1, 'Dani']])

    const back = await connect('user-ana')
    back.emit('room:rejoin', { roomCode, reconnectToken: ana.reconnectToken })
    await waitFor(back, 'room:rejoin_failed')
  })

  test('when the host leaves, a human takes seat 0 even if a bot sat next', async () => {
    const { roomCode, room, seats } = await createLobby([FOUR_PLAYERS[0]])
    seats[0].socket.emit('room:add_bot')
    await waitFor(seats[0].socket, 'room:updated')
    const carla = await connect()
    carla.emit('room:join', { roomCode, playerName: 'Carla' })
    await waitFor(carla, 'room:joined')

    const update = waitUntil(carla, 'room:updated', d => d.myPlayerIndex === 0)
    seats[0].socket.emit('room:leave')
    await update
    const seat0 = room.players.find(p => p.seatIndex === 0)!
    assert.equal(seat0.name, 'Carla')
    assert.equal(room.hostSocketId, carla.id)
  })
})

// ─── 4. One room per socket ───────────────────────────────────────────────────

describe('room membership', () => {
  test('creating another room releases the previous lobby seat', async () => {
    const { roomCode, room, seats } = await createLobby([FOUR_PLAYERS[0], FOUR_PLAYERS[2]])
    const [ana, carla] = seats

    const shrunk = waitUntil(ana.socket, 'room:updated', d => d.room.players.length === 1)
    carla.socket.emit('room:create', { playerName: 'Carla', gameMode: 'modo200' })
    const created = await waitFor(carla.socket, 'room:created')
    await shrunk

    assert.equal(h.rooms.getRoomCodeBySocket(carla.socket.id!), created.roomCode)
    carla.socket.disconnect()
    await sleep(GRACE + 200)
    assert.deepEqual(room.players.map(p => p.name), ['Ana'], 'ghost seat left in the old room')
    assert.ok(h.rooms.getRoom(roomCode))
  })

  test('joining another room mid-game abandons the old seat to a bot', async () => {
    const { room, seats } = await startFourPlayerGame()
    const replaced = waitUntil(seats[0].socket, 'connection:player_replaced', d => d.playerIndex === 2, GRACE / 2)
    seats[2].socket.emit('room:create', { playerName: 'Carla', gameMode: 'modo200' })
    await waitFor(seats[2].socket, 'room:created')
    await replaced

    assert.equal(room.players[2].abandoned, true)
    assert.equal(room.game!.players[2].isBot, true)
  })

  test('a second device takes over the seat and the first one is detached', async () => {
    const { roomCode, room, seats } = await startFourPlayerGame()
    const oldDevice = seats[1].socket
    const kicked = waitFor(oldDevice, 'room:session_replaced')

    const newDevice = await connect('user-beto')
    newDevice.emit('room:rejoin', { roomCode })
    assert.equal((await waitFor(newDevice, 'room:joined')).myPlayerIndex, 1)
    await kicked
    assert.equal(room.game!.players[1].socketId, newDevice.id)

    // The old socket no longer gets room broadcasts
    const oldSees = collect(oldDevice)
    const chat = waitFor(newDevice, 'chat:message')
    seats[0].socket.emit('chat:send', { message: 'hola', type: 'text' })
    await chat
    assert.ok(!(await oldSees).includes('chat:message'))
  })

  test('rejoining from the same socket (focus) does not detach it', async () => {
    const { roomCode, seats } = await startFourPlayerGame()
    const events = collect(seats[2].socket)
    seats[2].socket.emit('room:rejoin', { roomCode, reconnectToken: seats[2].reconnectToken })
    const seen = await events
    assert.ok(seen.includes('room:joined'))
    assert.ok(!seen.includes('room:session_replaced'))
  })

  test('a user mapped to a newer room keeps that mapping when an older room goes away', async () => {
    const device1 = await connect('user-ana')
    device1.emit('room:create', { playerName: 'Ana', gameMode: 'modo200' })
    const roomA = (await waitFor(device1, 'room:created')).roomCode
    const device2 = await connect('user-ana')
    device2.emit('room:create', { playerName: 'Ana', gameMode: 'modo200' })
    const roomB = (await waitFor(device2, 'room:created')).roomCode

    device1.emit('room:leave')
    await sleep(100)
    assert.equal(h.rooms.getRoom(roomA), undefined)
    assert.equal(h.rooms.getRoomCodeByUserId('user-ana'), roomB)
  })
})

// ─── 5. Leaving on purpose ────────────────────────────────────────────────────

describe('explicit leave', () => {
  test('a seat abandoned mid-game cannot be reclaimed with its old token or account', async () => {
    const { roomCode, seats } = await startFourPlayerGame()
    for (const seat of [seats[1], seats[3]]) {
      seat.socket.emit('room:leave')
      await sleep(50)
      const back = await connect(seat.userId)
      back.emit('room:rejoin', { roomCode, reconnectToken: seat.reconnectToken })
      await waitFor(back, 'room:rejoin_failed')
    }
  })

  test('the room is deleted once every human has abandoned it', async () => {
    const { roomCode, seats } = await startFourPlayerGame()
    for (const seat of seats) seat.socket.emit('room:leave')
    await sleep(100)
    assert.equal(h.rooms.getRoom(roomCode), undefined)
    assert.equal(h.rooms.getRoomCodeByUserId('user-ana'), undefined)
  })
})

// ─── 6. Cleanup only removes rooms nobody is using ────────────────────────────

describe('cleanup', () => {
  test('a connected game is kept even after the empty-room TTL', async () => {
    const { roomCode } = await startFourPlayerGame()
    h.rooms.cleanup(Date.now() + EMPTY_TTL + 1)
    assert.ok(h.rooms.getRoom(roomCode))
  })

  test('a room with nobody connected is deleted after the empty-room TTL', async () => {
    const { roomCode, seats } = await startFourPlayerGame()
    await Promise.all(seats.map(dropSeat))
    h.rooms.cleanup(Date.now() + EMPTY_TTL - 60_000)
    assert.ok(h.rooms.getRoom(roomCode), 'deleted too early')
    h.rooms.cleanup(Date.now() + EMPTY_TTL + 1)
    assert.equal(h.rooms.getRoom(roomCode), undefined)
    assert.equal(h.rooms.getRoomCodeByUserId('user-beto'), undefined)
  })

  test('a connected room idle past the idle TTL is closed with notice', async () => {
    const { roomCode, seats } = await startFourPlayerGame()
    const notices = seats.map(s => waitFor(s.socket, 'room:closed'))
    h.rooms.cleanup(Date.now() + IDLE_TTL + 1)
    const [notice] = await Promise.all(notices)
    assert.equal(notice.reason, 'idle')
    assert.equal(h.rooms.getRoom(roomCode), undefined)
  })
})

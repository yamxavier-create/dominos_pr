/**
 * Call signaling authority: only connected humans holding a current seat in
 * the same room (lobby or game) can send or receive WebRTC signals.
 */
import { test, describe, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { setupTestServer, waitFor, waitUntil, collect, sleep, FOUR_PLAYERS as FOUR } from './harness'

const GRACE = 300
const h = setupTestServer({ reconnectGraceMs: GRACE })
const { connect, createLobby, startFourPlayerGame, dropSeat } = h

afterEach(async () => {
  await sleep(50)
  h.rooms.cleanup(Number.POSITIVE_INFINITY)
})

const OFFER = { type: 'offer', sdp: 'v=0 fake' }

describe('signaling between seats', () => {
  test('a seated player reaches another seated player, tagged with their own seat', async () => {
    const { roomCode, seats } = await startFourPlayerGame()
    const got = waitFor(seats[2].socket, 'webrtc:signal')
    seats[0].socket.emit('webrtc:signal', { roomCode, to: 2, desc: OFFER })
    assert.deepEqual(await got, { from: 0, desc: OFFER })
  })

  test('an abandoned seat can neither send nor receive signals', async () => {
    const { roomCode, seats } = await startFourPlayerGame()
    const quitter = seats[1].socket
    const left = waitUntil(seats[0].socket, 'webrtc:peer_left', d => d.playerIndex === 1)
    quitter.emit('room:leave')
    await left

    // Still connected, still the socketId stored in game.players
    const othersHear = Promise.all([0, 2, 3].map(i => collect(seats[i].socket)))
    const errors = collect(quitter)
    for (const to of [0, 2, 3]) quitter.emit('webrtc:signal', { roomCode, to, desc: OFFER })
    for (const heard of await othersHear) assert.ok(!heard.includes('webrtc:signal'))
    assert.ok((await errors).includes('webrtc:error'))

    const quitterHears = collect(quitter)
    const rejected = waitFor(seats[0].socket, 'webrtc:error')
    seats[0].socket.emit('webrtc:signal', { roomCode, to: 1, desc: OFFER })
    assert.equal((await rejected).reason, 'target_not_in_call')
    assert.ok(!(await quitterHears).includes('webrtc:signal'))
  })

  test('after joining another room, the old seat stays out of the call', async () => {
    const { roomCode, seats } = await startFourPlayerGame()
    seats[3].socket.emit('room:create', { playerName: 'Dani', gameMode: 'modo200' })
    await waitFor(seats[3].socket, 'room:created')

    const heard = collect(seats[0].socket)
    seats[3].socket.emit('webrtc:signal', { roomCode, to: 0, desc: OFFER })
    assert.ok(!(await heard).includes('webrtc:signal'))
  })

  test('a seat played by a bot after a disconnect is not a call target', async () => {
    const { roomCode, seats } = await startFourPlayerGame()
    const left = waitUntil(seats[0].socket, 'webrtc:peer_left', d => d.playerIndex === 2, GRACE + 1500)
    await dropSeat(seats[2])
    await left
    const rejected = waitFor(seats[0].socket, 'webrtc:error')
    seats[0].socket.emit('webrtc:signal', { roomCode, to: 2, desc: OFFER })
    assert.equal((await rejected).reason, 'target_not_in_call')
  })

  test('a player who reclaims their seat is back in the call', async () => {
    const { roomCode, seats } = await startFourPlayerGame()
    await dropSeat(seats[2])
    const back = await connect()
    back.emit('room:rejoin', { roomCode, reconnectToken: seats[2].reconnectToken })
    await waitFor(back, 'room:joined')
    const got = waitFor(back, 'webrtc:signal')
    seats[0].socket.emit('webrtc:signal', { roomCode, to: 2, desc: OFFER })
    assert.equal((await got).from, 0)
  })

  test('signals naming a room the sender is not in are refused', async () => {
    const game1 = await startFourPlayerGame()
    const outsider = await connect()
    outsider.emit('room:create', { playerName: 'Eva', gameMode: 'modo200' })
    await waitFor(outsider, 'room:created')

    const heard = collect(game1.seats[0].socket)
    const refused = waitFor(outsider, 'webrtc:error')
    outsider.emit('webrtc:signal', { roomCode: game1.roomCode, to: 0, desc: OFFER })
    assert.equal((await refused).reason, 'not_in_room')
    assert.ok(!(await heard).includes('webrtc:signal'))
  })

  test('nobody can signal themselves or a bot seat', async () => {
    const { roomCode, seats } = await startFourPlayerGame()
    for (const to of [0, 7, -1, '1', null]) {
      const refused = waitFor(seats[0].socket, 'webrtc:error')
      seats[0].socket.emit('webrtc:signal', { roomCode, to, desc: OFFER })
      assert.equal((await refused).reason, 'target_not_in_call', `to=${String(to)}`)
    }
  })
})

describe('call state broadcasts', () => {
  test('toggle and lobby_opt are only relayed for current members', async () => {
    const { roomCode, seats } = await startFourPlayerGame()
    seats[1].socket.emit('room:leave')
    await sleep(100)

    const heard = collect(seats[0].socket)
    seats[1].socket.emit('webrtc:toggle', { roomCode, micMuted: true, cameraOff: true })
    seats[1].socket.emit('webrtc:lobby_opt', { roomCode, audio: true, video: true })
    const events = await heard
    assert.ok(!events.includes('webrtc:peer_toggle'))
    assert.ok(!events.includes('webrtc:lobby_updated'))

    const relayed = waitFor(seats[0].socket, 'webrtc:peer_toggle')
    seats[2].socket.emit('webrtc:toggle', { roomCode, micMuted: 'yes', cameraOff: true })
    assert.deepEqual(await relayed, { from: 2, micMuted: false, cameraOff: true })
  })
})

describe('call in the room before the game', () => {
  test('seated players reach each other in the lobby, tagged with their seat', async () => {
    const { roomCode, seats } = await createLobby()
    const got = waitFor(seats[3].socket, 'webrtc:signal')
    seats[1].socket.emit('webrtc:signal', { roomCode, to: 3, desc: OFFER, epoch: 0 })
    assert.deepEqual(await got, { from: 1, desc: OFFER })
  })

  test('a bot seat in the lobby is not a call target', async () => {
    const { roomCode, seats } = await createLobby(FOUR.slice(0, 3))
    seats[0].socket.emit('room:add_bot')
    await waitUntil(seats[0].socket, 'room:updated', d => d.room.players.length === 4)
    const refused = waitFor(seats[0].socket, 'webrtc:error')
    seats[0].socket.emit('webrtc:signal', { roomCode, to: 3, desc: OFFER })
    assert.equal((await refused).reason, 'target_not_in_call')
  })

  test('the room remembers who is in the call, so late joiners see it', async () => {
    const { roomCode, seats } = await createLobby(FOUR.slice(0, 2))
    const heard = waitFor(seats[1].socket, 'webrtc:lobby_updated')
    seats[0].socket.emit('webrtc:lobby_opt', { roomCode, audio: true, video: false })
    assert.deepEqual(await heard, { from: 0, audio: true, video: false })

    const late = await connect()
    late.emit('room:join', { roomCode, playerName: 'Carla' })
    const joined = await waitFor(late, 'room:joined')
    assert.deepEqual(joined.room.players.map((p: any) => p.call), [{ audio: true, video: false }, null, null])

    seats[0].socket.emit('webrtc:lobby_opt', { roomCode, audio: false, video: false })
    await sleep(50)
    assert.equal(h.rooms.getRoom(roomCode)!.players[0].call, undefined)
  })

  test('a seat swap starts a new call epoch and drops signals from the old one', async () => {
    const { roomCode, seats } = await createLobby()
    const swapped = waitFor(seats[2].socket, 'room:seat_swapped')
    seats[0].socket.emit('room:swap_seats', { seatA: 1, seatB: 2 })
    const { room, myPlayerIndex } = await swapped
    assert.equal(room.callEpoch, 1)
    assert.equal(myPlayerIndex, 1)

    // Sent before Ana saw the swap: meant for whoever sat at 2 then
    const heard = collect(seats[1].socket)
    seats[0].socket.emit('webrtc:signal', { roomCode, to: 2, desc: OFFER, epoch: 0 })
    assert.ok(!(await heard).includes('webrtc:signal'))

    const got = waitFor(seats[1].socket, 'webrtc:signal')
    seats[0].socket.emit('webrtc:signal', { roomCode, to: 2, desc: OFFER, epoch: 1 })
    assert.equal((await got).from, 0)
  })

  test('a bot taking a seat mid-game takes it out of the call', async () => {
    const { roomCode, room, seats } = await startFourPlayerGame()
    seats[2].socket.emit('webrtc:lobby_opt', { roomCode, audio: true, video: true })
    await sleep(50)
    assert.ok(room.players.find(p => p.seatIndex === 2)!.call)
    const left = waitUntil(seats[0].socket, 'webrtc:peer_left', d => d.playerIndex === 2)
    seats[2].socket.emit('room:leave')
    await left
    assert.equal(room.players.find(p => p.seatIndex === 2)!.call, undefined)
  })
})

describe('back to the room after a game', () => {
  async function finishedGame() {
    const game = await startFourPlayerGame()
    game.room.game!.phase = 'game_end'
    return game
  }

  test('only the host can bring everyone back, and only once the game is over', async () => {
    const { roomCode, room, seats } = await startFourPlayerGame()
    seats[0].socket.emit('room:back_to_lobby', { roomCode })
    await sleep(80)
    assert.equal(room.status, 'in_game')

    room.game!.phase = 'game_end'
    seats[1].socket.emit('room:back_to_lobby', { roomCode })
    await sleep(80)
    assert.equal(room.status, 'in_game')
  })

  test('everyone lands in the room with the call kept and the seats unchanged', async () => {
    const { roomCode, room, seats } = await finishedGame()
    seats[1].socket.emit('webrtc:lobby_opt', { roomCode, audio: true, video: true })
    await sleep(50)
    const back = seats.map(s => waitFor(s.socket, 'room:back_to_lobby'))
    const updated = waitFor(seats[3].socket, 'room:updated')
    seats[0].socket.emit('room:back_to_lobby', { roomCode })
    await Promise.all(back)
    const { room: info, myPlayerIndex } = await updated

    assert.equal(room.status, 'waiting')
    assert.equal(room.game, null)
    assert.equal(info.status, 'waiting')
    assert.equal(info.callEpoch, 0)
    assert.equal(myPlayerIndex, 3)
    assert.deepEqual(info.players[1].call, { audio: true, video: true })

    // The call keeps working in the room, and a new game can start from here
    const got = waitFor(seats[2].socket, 'webrtc:signal')
    seats[1].socket.emit('webrtc:signal', { roomCode, to: 2, desc: OFFER, epoch: 0 })
    assert.equal((await got).from, 1)

    const started = seats.map(s => waitFor(s.socket, 'game:started'))
    seats[0].socket.emit('game:start', { roomCode })
    await Promise.all(started)
  })

  test('a seat that left mid-game is released, and the host is back on seat 0', async () => {
    const { roomCode, room, seats } = await startFourPlayerGame()
    // Ana (host) leaves: Beto inherits host; Ana's seat is abandoned
    seats[0].socket.emit('room:leave')
    await sleep(80)
    room.game!.phase = 'game_end'

    const updated = waitFor(seats[2].socket, 'room:updated')
    seats[1].socket.emit('room:back_to_lobby', { roomCode })
    const { room: info, myPlayerIndex } = await updated

    assert.deepEqual(info.players.map((p: any) => p.name), ['Beto', 'Carla', 'Dani'])
    assert.equal(myPlayerIndex, 1)
    assert.equal(info.callEpoch, 1)
    assert.equal(room.hostSocketId, seats[1].socket.id)
  })
})

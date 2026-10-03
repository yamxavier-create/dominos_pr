/**
 * Call signaling authority: only connected humans holding a current seat in
 * the same game can send or receive WebRTC signals.
 */
import { test, describe, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { setupTestServer, waitFor, waitUntil, collect, sleep } from './harness'

const GRACE = 300
const h = setupTestServer({ reconnectGraceMs: GRACE })
const { connect, startFourPlayerGame, dropSeat } = h

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
    assert.equal((await refused).reason, 'not_in_game')
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

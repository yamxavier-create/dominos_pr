/**
 * Pure call logic from useWebRTC, tested without a browser: mute/camera
 * enforcement, session staleness and the reconnect timers.
 */
import { test, describe, mock } from 'node:test'
import assert from 'node:assert/strict'
import { applyMediaPrefs, capabilitiesOf, stopStream, TrackLike } from '../src/hooks/webrtc/mediaPrefs'
import { CallSession } from '../src/hooks/webrtc/callSession'
import { createReconnectScheduler } from '../src/hooks/webrtc/reconnectScheduler'

function fakeTrack(kind: 'audio' | 'video'): TrackLike & { stopped: boolean } {
  return { kind, enabled: true, stopped: false, stop() { this.stopped = true } }
}
function fakeStream(...kinds: Array<'audio' | 'video'>) {
  const tracks = kinds.map(fakeTrack)
  return {
    tracks,
    getTracks: () => tracks,
    getAudioTracks: () => tracks.filter(t => t.kind === 'audio'),
    getVideoTracks: () => tracks.filter(t => t.kind === 'video'),
  }
}

describe('media prefs', () => {
  test('a re-acquired stream obeys the current mute and camera choice', () => {
    const fresh = fakeStream('audio', 'video')
    applyMediaPrefs(fresh, { micMuted: true, cameraOff: true })
    assert.deepEqual(fresh.tracks.map(t => [t.kind, t.enabled]), [['audio', false], ['video', false]])

    applyMediaPrefs(fresh, { micMuted: false, cameraOff: true })
    assert.deepEqual(fresh.tracks.map(t => [t.kind, t.enabled]), [['audio', true], ['video', false]])
  })

  test('capabilities reflect the audio-only fallback', () => {
    assert.deepEqual(capabilitiesOf(fakeStream('audio')), { audio: true, video: false })
    assert.deepEqual(capabilitiesOf(fakeStream('audio', 'video')), { audio: true, video: true })
  })

  test('stopStream stops every track and tolerates null', () => {
    const s = fakeStream('audio', 'video')
    stopStream(s)
    assert.ok(s.tracks.every(t => t.stopped))
    stopStream(null)
  })
})

describe('call session', () => {
  test('a continuation started before cleanup is stale afterwards', () => {
    const session = new CallSession()
    const id = session.begin()
    assert.ok(session.isCurrent(id))
    session.end()
    assert.equal(session.isCurrent(id), false)
  })

  test('a new mount does not revive the old session', () => {
    const session = new CallSession()
    const first = session.begin()
    session.end()
    const second = session.begin()
    assert.equal(session.isCurrent(first), false)
    assert.ok(session.isCurrent(second))
  })

  test('nothing is current before begin()', () => {
    const session = new CallSession()
    assert.equal(session.isCurrent(session.current()), false)
  })
})

describe('reconnect scheduler', () => {
  function setup() {
    mock.timers.enable({ apis: ['setTimeout'] })
    const state = { active: true, pcs: {} as Record<number, object>, reconnected: [] as number[] }
    const scheduler = createReconnectScheduler<object>({
      isActive: () => state.active,
      currentPc: peer => state.pcs[peer],
      reconnect: peer => { state.reconnected.push(peer) },
    })
    return { state, scheduler }
  }

  test('reconnects the failed connection after the delay', () => {
    const { state, scheduler } = setup()
    const failed = {}
    state.pcs[1] = failed
    scheduler.schedule(1, failed, 1000)
    mock.timers.tick(999)
    assert.deepEqual(state.reconnected, [])
    mock.timers.tick(1)
    assert.deepEqual(state.reconnected, [1])
    mock.timers.reset()
  })

  test('cleanup cancels pending timers: no connection after leaving', () => {
    const { state, scheduler } = setup()
    const failed = {}
    state.pcs[2] = failed
    scheduler.schedule(2, failed, 1000)
    scheduler.cancelAll()
    state.active = false
    mock.timers.tick(5000)
    assert.deepEqual(state.reconnected, [])
    assert.equal(scheduler.pending(), 0)
    mock.timers.reset()
  })

  test('a timer that survived anyway does nothing once the session ended', () => {
    const { state, scheduler } = setup()
    const failed = {}
    state.pcs[2] = failed
    scheduler.schedule(2, failed, 1000)
    state.active = false
    mock.timers.tick(1000)
    assert.deepEqual(state.reconnected, [])
    mock.timers.reset()
  })

  test('a healthy replacement is never closed by the old failure\'s timer', () => {
    const { state, scheduler } = setup()
    const failed = {}
    state.pcs[3] = failed
    scheduler.schedule(3, failed, 1000)
    state.pcs[3] = {} // replaced by a fresh connection meanwhile
    mock.timers.tick(1000)
    assert.deepEqual(state.reconnected, [])
    mock.timers.reset()
  })

  test('rescheduling the same peer keeps a single timer', () => {
    const { state, scheduler } = setup()
    const failed = {}
    state.pcs[1] = failed
    scheduler.schedule(1, failed, 500)
    scheduler.schedule(1, failed, 1000)
    assert.equal(scheduler.pending(), 1)
    mock.timers.tick(1000)
    assert.deepEqual(state.reconnected, [1])
    mock.timers.reset()
  })
})

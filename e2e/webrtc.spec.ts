/**
 * Video call in a real browser with fake media devices: a recovered stream
 * keeps mute/camera off, leaving during the permission prompt leaves no
 * capture running, and a denied permission can be retried.
 */
import { test, expect, Page } from '@playwright/test'

declare global {
  interface Window {
    __domino: { callStore: any; roomStore: any; socket: any }
    __media: { hold: boolean; deny: boolean; release: (() => void) | null; streams: MediaStream[] }
  }
}

// Wrap getUserMedia so tests can hold the permission prompt open, deny it,
// and see every stream the page ever obtained.
test.beforeEach(async ({ page }) => {
  page.on('console', m => { if (/WebRTC|rror/.test(m.text())) console.log(`[browser] ${m.text()}`) })
  page.on('pageerror', e => console.log(`[pageerror] ${e.message}`))
  await page.addInitScript(() => {
    try { localStorage.setItem('onboarding_done', '1') } catch {}
    const real = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices)
    window.__media = { hold: false, deny: false, release: null, streams: [] }
    navigator.mediaDevices.getUserMedia = async constraints => {
      if (window.__media.deny) throw new DOMException('Permission denied', 'NotAllowedError')
      if (window.__media.hold) await new Promise<void>(resolve => { window.__media.release = resolve })
      const stream = await real(constraints)
      window.__media.streams.push(stream)
      return stream
    }
  })
})

/** Host a 4-seat game against 3 bots and land on the game screen. */
async function startBotGame(page: Page) {
  await page.goto('/')
  await page.waitForFunction(() => window.__domino?.socket?.connected)
  await page.evaluate(() => window.__domino.socket.emit('room:create', { playerName: 'Tester', gameMode: 'modo200' }))
  await page.waitForURL('**/lobby')
  for (let i = 0; i < 3; i++) await page.evaluate(() => window.__domino.socket.emit('room:add_bot'))
  await page.waitForFunction(() => window.__domino.roomStore.getState().room?.players.length === 4)
  await page.evaluate(() => {
    window.__domino.socket.emit('game:start', { roomCode: window.__domino.roomStore.getState().roomCode })
  })
  await page.waitForURL('**/game')
}

const callState = (page: Page) => page.evaluate(() => {
  const s = window.__domino.callStore.getState()
  return {
    inCall: s.myAudioEnabled || s.myVideoEnabled,
    streamId: s.localStream?.id ?? null,
    tracks: (s.localStream?.getTracks() ?? []).map((t: MediaStreamTrack) => ({ kind: t.kind, enabled: t.enabled, state: t.readyState })),
    error: s.callError,
  }
})

test('a recovered stream keeps the mic muted and the camera off', async ({ page }) => {
  await startBotGame(page)
  await page.getByRole('button', { name: 'Unirse a la llamada' }).click()
  await expect.poll(async () => (await callState(page)).tracks.length).toBe(2)

  await page.getByRole('button', { name: 'Silenciar mic' }).click()
  await page.getByRole('button', { name: 'Apagar camara' }).click()
  const before = await callState(page)
  expect(before.tracks.every(t => !t.enabled)).toBe(true)

  // The OS kills the mic (iOS background, device unplugged): the hook re-acquires
  await page.evaluate(() => {
    window.__domino.callStore.getState().localStream.getAudioTracks()[0].dispatchEvent(new Event('ended'))
  })
  await expect.poll(async () => (await callState(page)).streamId).not.toBe(before.streamId)

  const after = await callState(page)
  expect(after.tracks).toHaveLength(2)
  expect(after.tracks.every(t => !t.enabled && t.state === 'live')).toBe(true)
  // The replaced stream's surviving tracks were stopped, not leaked
  const oldTracks = await page.evaluate(id => {
    const old = window.__media.streams.find(s => s.id === id)!
    return old.getTracks().map(t => t.readyState)
  }, before.streamId)
  expect(oldTracks.every(s => s === 'ended')).toBe(true)
})

test('leaving while the permission prompt is open leaves no capture running', async ({ page }) => {
  await startBotGame(page)
  await page.evaluate(() => { window.__media.hold = true })
  await page.getByRole('button', { name: 'Unirse a la llamada' }).click()
  await expect.poll(() => page.evaluate(() => !!window.__media.release)).toBe(true)

  await page.getByRole('button', { name: 'Salir del juego' }).click()
  await page.getByRole('button', { name: 'Salir', exact: true }).click()
  await page.waitForURL(url => new URL(url).pathname === '/')

  // The player allows access only now
  await page.evaluate(() => window.__media.release!())
  // The late stream really was created (otherwise this test would pass vacuously)...
  await expect.poll(() => page.evaluate(() => window.__media.streams.length)).toBe(1)
  await page.waitForTimeout(500)
  // ...and was stopped instead of left capturing
  const leftover = await page.evaluate(() =>
    window.__media.streams.flatMap(s => s.getTracks()).filter(t => t.readyState === 'live').map(t => t.kind))
  expect(leftover).toEqual([])
  expect((await callState(page)).streamId).toBeNull()
})

test('a denied permission shows why and keeps the join button to retry', async ({ page }) => {
  await startBotGame(page)
  await page.evaluate(() => { window.__media.deny = true })
  const join = page.getByRole('button', { name: /Unirse a la llamada|Toca para reintentar/ })
  await join.click()

  await expect(page.getByRole('alert')).toContainText('No se pudo usar la cámara')
  expect((await callState(page)).inCall).toBe(false)
  await expect(join).toBeVisible()

  // Access allowed in settings: the same button now works
  await page.evaluate(() => { window.__media.deny = false })
  await join.click()
  await expect.poll(async () => (await callState(page)).inCall).toBe(true)
  await expect(page.getByRole('alert')).toHaveCount(0)
  await expect(page.getByRole('button', { name: /Unirse a la llamada/ })).toHaveCount(0)
})

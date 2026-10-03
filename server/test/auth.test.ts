/**
 * Auth hardening: Google account linking, socket revocation, rate limits,
 * single-use reset links, hashed tokens and email enumeration.
 *
 * Needs the local test database: `npm run test:db:setup` once. Without it,
 * every test here is skipped with a notice.
 */
import './env-db'
import './env'

import { describe } from 'node:test'
import assert from 'node:assert/strict'
import prisma from '../src/db/prisma'
import { resolveGoogleUser, GoogleLinkConflictError } from '../src/auth/googleAccount'
import { digestToken } from '../src/auth/tokens'
import {
  setupDbServer, dbTest, api as rootApi, register, connectAs, waitFor, sleep, lastLinkToken, deliveries,
} from './dbHarness'

setupDbServer('auth.test')

/** Auth routes only: paths relative to /api/auth */
const api = (path: string, body?: unknown, opts?: { method?: string; token?: string }) => rootApi(`/auth${path}`, body, opts)

const googleProfile = (overrides: Partial<{ googleId: string; email: string; name: string }> = {}) => ({
  googleId: 'google-victim',
  email: 'victim@example.com',
  name: 'Victim',
  ...overrides,
})

// ─── 1. Google linking can't be pre-hijacked ──────────────────────────────────

describe('Google account linking', () => {
  dbTest('registering with someone else\'s email does not capture their Google login', async () => {
    const attacker = await register('attacker', 'attackerpw', 'victim@example.com')
    assert.equal(attacker.user.email, null, 'email saved before confirmation')

    const victim = await resolveGoogleUser(googleProfile())
    assert.notEqual(victim.id, attacker.user.id)
    assert.equal(victim.email, 'victim@example.com')
    assert.equal(victim.emailVerified, true)

    // The attacker's credentials and session reach only the attacker's own account
    const login = await api('/login', { username: 'attacker', password: 'attackerpw' })
    assert.equal(login.body.user.id, attacker.user.id)
  })

  dbTest('an old unconfirmed email claim is dropped instead of linked', async () => {
    const squatter = await register('squatter')
    await prisma.user.update({ where: { id: squatter.user.id }, data: { email: 'victim@example.com', emailVerified: false } })

    const victim = await resolveGoogleUser(googleProfile())
    assert.notEqual(victim.id, squatter.user.id)
    const after = await prisma.user.findUnique({ where: { id: squatter.user.id } })
    assert.equal(after?.email, null)
  })

  dbTest('a confirmed email links to the existing account', async () => {
    const owner = await register('owner')
    await prisma.user.update({ where: { id: owner.user.id }, data: { email: 'victim@example.com', emailVerified: true } })
    const linked = await resolveGoogleUser(googleProfile())
    assert.equal(linked.id, owner.user.id)
    assert.equal(linked.googleId, 'google-victim')
  })

  dbTest('an email already linked to another Google identity is refused', async () => {
    await resolveGoogleUser(googleProfile({ googleId: 'google-original' }))
    await assert.rejects(resolveGoogleUser(googleProfile({ googleId: 'google-impostor' })), GoogleLinkConflictError)
  })

  dbTest('the same Google identity always returns the same account', async () => {
    const first = await resolveGoogleUser(googleProfile())
    const second = await resolveGoogleUser(googleProfile({ email: 'changed@example.com' }))
    assert.equal(second.id, first.id)
  })
})

// ─── 2. Revoked or expired sessions lose their sockets ────────────────────────

describe('socket sessions', () => {
  dbTest('logout disconnects the socket opened with that session', async () => {
    const { token } = await register('ana')
    const socket = await connectAs(token)
    const ended = waitFor(socket, 'auth:session_ended')
    const gone = waitFor(socket, 'disconnect')
    await api('/logout', {}, { token })
    assert.equal((await ended).reason, 'revoked')
    await gone
  })

  dbTest('a password reset disconnects every session of that user and only that user', async () => {
    await register('ana', 'secret123')
    await prisma.user.update({ where: { username: 'ana' }, data: { email: 'ana@example.com' } })
    const phone = await connectAs((await api('/login', { username: 'ana', password: 'secret123' })).body.token)
    const laptop = await connectAs((await api('/login', { username: 'ana', password: 'secret123' })).body.token)
    const other = await connectAs((await register('beto')).token)

    await api('/request-reset', { email: 'ana@example.com' })
    await deliveries()
    const phoneGone = waitFor(phone, 'disconnect')
    const laptopGone = waitFor(laptop, 'disconnect')
    assert.equal((await api('/reset-password', { token: lastLinkToken('password_reset'), password: 'newsecret1' })).status, 200)
    await phoneGone
    await laptopGone
    await sleep(100)
    assert.ok(other.connected)
  })

  dbTest('a socket is cut when its session expires', async () => {
    const { token, user } = await register('ana')
    await prisma.session.updateMany({ where: { userId: user.id }, data: { expiresAt: new Date(Date.now() + 400) } })
    const socket = await connectAs(token)
    const ended = await waitFor(socket, 'auth:session_ended', 2000)
    assert.equal(ended.reason, 'expired')
  })
})

// ─── 3. Rate limits answer 429 before any DB or bcrypt work ───────────────────

describe('rate limits', () => {
  dbTest('login is limited per username', async () => {
    await register('ana')
    for (let i = 0; i < 10; i++) {
      assert.equal((await api('/login', { username: 'ana', password: 'wrong-pass' })).status, 401)
    }
    const blocked = await api('/login', { username: 'ANA ', password: 'secret123' })
    assert.equal(blocked.status, 429)
    assert.ok(Number(blocked.headers.get('retry-after')) > 0)
    // Other accounts from the same IP still work
    await register('beto')
    assert.equal((await api('/login', { username: 'beto', password: 'secret123' })).status, 200)
  })

  dbTest('password reset requests are limited per email', async () => {
    await register('ana')
    await prisma.user.update({ where: { username: 'ana' }, data: { email: 'ana@example.com' } })
    for (let i = 0; i < 3; i++) assert.equal((await api('/request-reset', { email: 'ana@example.com' })).status, 200)
    assert.equal((await api('/request-reset', { email: 'Ana@Example.com' })).status, 429)
    assert.equal((await deliveries()).filter(e => e.kind === 'password_reset').length, 3)
  })

  dbTest('registration is limited per IP', async () => {
    for (let i = 0; i < 10; i++) await register(`user${i}`)
    assert.equal((await api('/register', { username: 'user10', password: 'secret123' })).status, 429)
  })
})

// ─── 4. Reset links are single-use and atomic ─────────────────────────────────

describe('password reset', () => {
  async function resetLinkFor(username: string) {
    await register(username)
    await prisma.user.update({ where: { username }, data: { email: `${username}@example.com` } })
    await api('/request-reset', { email: `${username}@example.com` })
    await deliveries()
    return lastLinkToken('password_reset', `${username}@example.com`)
  }

  dbTest('concurrent redemptions of the same link: exactly one wins', async () => {
    const token = await resetLinkFor('ana')
    // Enough parallel requests that the transactions overlap after bcrypt
    const passwords = Array.from({ length: 8 }, (_, i) => `password-${i}`)
    const results = await Promise.all(passwords.map(password => api('/reset-password', { token, password })))
    const winners = passwords.filter((_, i) => results[i].status === 200)
    assert.equal(winners.length, 1, `expected one winner, got ${winners.length}`)
    assert.ok(results.every(r => r.status === 200 || r.status === 400))
    assert.equal((await api('/login', { username: 'ana', password: winners[0] })).status, 200)
  })

  dbTest('an invalid password does not burn the link', async () => {
    const token = await resetLinkFor('ana')
    for (const password of [1234567, ['x'], 'short', 'x'.repeat(200)]) {
      assert.equal((await api('/reset-password', { token, password })).status, 400)
    }
    assert.equal((await api('/reset-password', { token, password: 'valid-pass' })).status, 200)
  })

  dbTest('a reset revokes every existing session', async () => {
    const token = await resetLinkFor('ana')
    const session = (await api('/login', { username: 'ana', password: 'secret123' })).body.token
    assert.equal((await api('/me', undefined, { token: session })).status, 200)
    await api('/reset-password', { token, password: 'valid-pass' })
    assert.equal((await api('/me', undefined, { token: session })).status, 401)
  })

  dbTest('a new request does not invalidate an older link, but using one voids the rest', async () => {
    const first = await resetLinkFor('ana')
    await api('/request-reset', { email: 'ana@example.com' })
    await deliveries()
    const second = lastLinkToken('password_reset')
    assert.notEqual(first, second)
    assert.equal((await api('/reset-password', { token: first, password: 'valid-pass' })).status, 200)
    assert.equal((await api('/reset-password', { token: second, password: 'other-pass' })).status, 400)
  })

  dbTest('reset tokens are stored only as SHA-256 digests', async () => {
    const token = await resetLinkFor('ana')
    const rows = await prisma.passwordReset.findMany()
    assert.equal(rows.length, 1)
    assert.notEqual(rows[0].token, token)
    assert.equal(rows[0].token, digestToken(token))
  })

  dbTest('a redeemed reset link confirms the email only if it is still the account email', async () => {
    const token = await resetLinkFor('ana')
    await api('/reset-password', { token, password: 'valid-pass' })
    assert.equal((await prisma.user.findUnique({ where: { username: 'ana' } }))?.emailVerified, true)

    const other = await resetLinkFor('beto')
    await prisma.user.update({ where: { username: 'beto' }, data: { email: 'swapped@example.com' } })
    await api('/reset-password', { token: other, password: 'valid-pass' })
    assert.equal((await prisma.user.findUnique({ where: { username: 'beto' } }))?.emailVerified, false)
  })
})

// ─── 5. Emails are saved only after confirmation, and never enumerable ────────

describe('email ownership', () => {
  dbTest('register answers the same for a free email and a confirmed one', async () => {
    const owner = await register('owner')
    await prisma.user.update({ where: { id: owner.user.id }, data: { email: 'taken@example.com', emailVerified: true } })

    const free = await api('/register', { username: 'newbie1', password: 'secret123', email: 'free@example.com' })
    const taken = await api('/register', { username: 'newbie2', password: 'secret123', email: 'taken@example.com' })
    assert.equal(free.status, taken.status)
    const shape = (b: any) => ({ keys: Object.keys(b.user).sort(), email: b.user.email, pending: !!b.user.pendingEmail })
    assert.deepEqual(shape(free.body), shape(taken.body))

    // Same on /me afterwards
    const meFree = await api('/me', undefined, { token: free.body.token })
    const meTaken = await api('/me', undefined, { token: taken.body.token })
    assert.deepEqual(
      { email: meFree.body.user.email, pending: !!meFree.body.user.pendingEmail },
      { email: meTaken.body.user.email, pending: !!meTaken.body.user.pendingEmail },
    )

    // Only the inboxes see the difference
    const sent = await deliveries()
    assert.ok(sent.some(e => e.to === 'free@example.com' && e.kind === 'verify_email'))
    assert.ok(sent.some(e => e.to === 'taken@example.com' && e.kind === 'email_in_use'))
  })

  dbTest('changing to a confirmed email elsewhere is a normal 200, never 409', async () => {
    const owner = await register('owner')
    await prisma.user.update({ where: { id: owner.user.id }, data: { email: 'taken@example.com', emailVerified: true } })
    const { token } = await register('probe')
    const res = await api('/profile', { email: 'taken@example.com' }, { method: 'PATCH', token })
    assert.equal(res.status, 200)
    assert.equal(res.body.user.email, null)
    assert.equal(res.body.user.pendingEmail, 'taken@example.com')
  })

  dbTest('the confirmation link saves and verifies the email, once', async () => {
    const { token } = await register('ana', 'secret123', 'ana@example.com')
    await deliveries()
    const link = lastLinkToken('verify_email')
    assert.equal((await api('/verify-email', { token: link })).status, 200)
    const me = (await api('/me', undefined, { token })).body.user
    assert.deepEqual([me.email, me.emailVerified, me.pendingEmail], ['ana@example.com', true, null])
    assert.equal((await api('/verify-email', { token: link })).status, 400)
  })

  dbTest('confirming takes the address from an unconfirmed claim but not from a confirmed one', async () => {
    const squatter = await register('squatter')
    await prisma.user.update({ where: { id: squatter.user.id }, data: { email: 'ana@example.com' } })
    await register('ana', 'secret123', 'ana@example.com')
    await deliveries()
    assert.equal((await api('/verify-email', { token: lastLinkToken('verify_email') })).status, 200)
    assert.equal((await prisma.user.findUnique({ where: { id: squatter.user.id } }))?.email, null)

    // A pending link can't override an address confirmed in the meantime
    const { token } = await register('late')
    await api('/profile', { email: 'beto@example.com' }, { method: 'PATCH', token })
    await deliveries()
    const lateLink = lastLinkToken('verify_email', 'beto@example.com')
    const beto = await register('beto')
    await prisma.user.update({ where: { id: beto.user.id }, data: { email: 'beto@example.com', emailVerified: true } })
    assert.equal((await api('/verify-email', { token: lateLink })).status, 409)
  })
})

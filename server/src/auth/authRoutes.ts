import { Router, Request, Response } from 'express'
import prisma from '../db/prisma'
import { hashPassword, comparePassword } from './passwordUtils'
import { signToken, verifyToken, verifySession } from './jwt'
import { verifyGoogleToken, isGoogleConfigured, GoogleTokenError } from './google'
import { resolveGoogleUser, GoogleLinkConflictError } from './googleAccount'
import { deliverInBackground, sendPasswordResetEmail } from './emailService'
import { requestEmailChange, pendingEmailFor, confirmEmail } from './emailOwnership'
import { revokeSessions, disconnectSessionSockets } from './sessionRevocation'
import { newEmailToken, digestToken, isEmailToken } from './tokens'
import { authLimits } from './rateLimit'

const router = Router()

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PASSWORD_MIN = 6
const PASSWORD_MAX = 128 // bcrypt only reads 72 bytes; this also caps hashing cost
const RESET_TTL_MS = 60 * 60_000

const PUBLIC_USER = { id: true, username: true, displayName: true, avatarUrl: true, email: true, emailVerified: true } as const

// Returns the normalized email, null when empty, or undefined when invalid
function normalizeEmail(raw: unknown): string | null | undefined {
  if (raw === undefined || raw === null) return null
  if (typeof raw !== 'string') return undefined
  const email = raw.trim().toLowerCase()
  if (!email) return null
  if (email.length > 254 || !EMAIL_RE.test(email)) return undefined
  return email
}

function isPassword(value: unknown): value is string {
  return typeof value === 'string' && value.length >= PASSWORD_MIN && value.length <= PASSWORD_MAX
}

async function startSession(userId: string, username: string) {
  const { token, jti, expiresAt } = signToken(userId, username)
  await prisma.session.create({ data: { userId, token: jti, expiresAt } })
  return token
}

// POST /api/auth/register
router.post('/register', ...authLimits.register, async (req: Request, res: Response) => {
  try {
    const { username, password, displayName } = req.body
    const email = normalizeEmail(req.body.email)

    if (typeof username !== 'string' || !username || typeof password !== 'string' || !password) {
      res.status(400).json({ error: 'Username and password are required' })
      return
    }
    if (username.length < 3 || username.length > 20) {
      res.status(400).json({ error: 'Username must be 3-20 characters' })
      return
    }
    if (!isPassword(password)) {
      res.status(400).json({ error: `Password must be ${PASSWORD_MIN}-${PASSWORD_MAX} characters` })
      return
    }
    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      res.status(400).json({ error: 'Username can only contain letters, numbers, and underscores' })
      return
    }
    if (displayName !== undefined && displayName !== null && typeof displayName !== 'string') {
      res.status(400).json({ error: 'Invalid display name' })
      return
    }
    if (email === undefined) {
      res.status(400).json({ error: 'Invalid email' })
      return
    }

    const existing = await prisma.user.findUnique({ where: { username: username.toLowerCase() } })
    if (existing) {
      res.status(409).json({ error: 'Username already taken' })
      return
    }

    // The email is only saved once confirmed, so the answer never depends on whether it's taken
    const passwordHash = await hashPassword(password)
    const user = await prisma.user.create({
      data: {
        username: username.toLowerCase(),
        displayName: displayName?.trim().slice(0, 20) || username,
        passwordHash,
        stats: { create: {} },
      },
      select: { ...PUBLIC_USER, createdAt: true },
    })
    if (email) await requestEmailChange(user.id, email)

    const token = await startSession(user.id, user.username)
    res.status(201).json({ token, user: { ...user, pendingEmail: email } })
  } catch (err) {
    console.error('[Auth] Register error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// POST /api/auth/login
router.post('/login', ...authLimits.login, async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body

    if (typeof username !== 'string' || !username || typeof password !== 'string' || !password) {
      res.status(400).json({ error: 'Username and password are required' })
      return
    }
    if (username.length > 254 || password.length > PASSWORD_MAX) {
      res.status(401).json({ error: 'Invalid username or password' })
      return
    }

    // Usernames can't contain "@", so an "@" means the user typed their email
    const identifier = username.trim().toLowerCase()
    const user = await prisma.user.findUnique({
      where: identifier.includes('@') ? { email: identifier } : { username: identifier },
      select: { ...PUBLIC_USER, passwordHash: true },
    })

    if (!user || !user.passwordHash) {
      res.status(401).json({ error: 'Invalid username or password' })
      return
    }

    const valid = await comparePassword(password, user.passwordHash)
    if (!valid) {
      res.status(401).json({ error: 'Invalid username or password' })
      return
    }

    const token = await startSession(user.id, user.username)
    await prisma.user.update({ where: { id: user.id }, data: { lastSeenAt: new Date() } })

    const { passwordHash: _, ...safeUser } = user
    res.json({ token, user: { ...safeUser, pendingEmail: await pendingEmailFor(user.id) } })
  } catch (err) {
    console.error('[Auth] Login error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// POST /api/auth/google
router.post('/google', ...authLimits.google, async (req: Request, res: Response) => {
  try {
    const { idToken } = req.body
    if (typeof idToken !== 'string' || !idToken || idToken.length > 4096) {
      res.status(400).json({ error: 'Google ID token is required' })
      return
    }
    if (!isGoogleConfigured()) {
      res.status(503).json({ error: 'Google login is not configured' })
      return
    }

    const profile = await verifyGoogleToken(idToken)
    const account = await resolveGoogleUser(profile)
    const token = await startSession(account.id, account.username)

    const user = await prisma.user.findUnique({ where: { id: account.id }, select: PUBLIC_USER })
    res.json({ token, user: { ...user, pendingEmail: await pendingEmailFor(account.id) } })
  } catch (err) {
    if (err instanceof GoogleTokenError) {
      res.status(401).json({ error: 'Invalid Google token' })
      return
    }
    if (err instanceof GoogleLinkConflictError) {
      res.status(409).json({ error: 'This email is linked to a different Google account' })
      return
    }
    console.error('[Auth] Google auth error:', err)
    res.status(500).json({ error: 'Google auth failed' })
  }
})

// GET /api/auth/me
router.get('/me', async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization
    if (!authHeader?.startsWith('Bearer ')) {
      res.status(401).json({ error: 'No token provided' })
      return
    }

    const payload = await verifySession(authHeader.slice(7))
    if (!payload) {
      res.status(401).json({ error: 'Session expired' })
      return
    }

    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        ...PUBLIC_USER, createdAt: true,
        stats: { select: { gamesPlayed: true, gamesWon: true } },
      },
    })

    if (!user) {
      res.status(404).json({ error: 'User not found' })
      return
    }

    res.json({ user: { ...user, pendingEmail: await pendingEmailFor(user.id) } })
  } catch {
    res.status(401).json({ error: 'Invalid token' })
  }
})

// POST /api/auth/logout
router.post('/logout', async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization
    if (!authHeader?.startsWith('Bearer ')) {
      res.status(200).json({ ok: true })
      return
    }

    const payload = verifyToken(authHeader.slice(7))
    await revokeSessions({ jti: payload.jti })
    res.json({ ok: true })
  } catch {
    res.status(200).json({ ok: true })
  }
})

// PATCH /api/auth/profile
router.patch('/profile', ...authLimits.profile, async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization
    if (!authHeader?.startsWith('Bearer ')) {
      res.status(401).json({ error: 'No token provided' })
      return
    }

    const payload = await verifySession(authHeader.slice(7))
    if (!payload) {
      res.status(401).json({ error: 'Session expired' })
      return
    }

    const { displayName } = req.body
    const data: { displayName?: string; email?: null; emailVerified?: false } = {}
    let newEmail: string | null = null

    if (displayName !== undefined) {
      if (typeof displayName !== 'string') {
        res.status(400).json({ error: 'Display name is required' })
        return
      }
      const sanitized = displayName.trim().slice(0, 20)
      if (sanitized.length < 1) {
        res.status(400).json({ error: 'Display name too short' })
        return
      }
      data.displayName = sanitized
    }

    if (req.body.email !== undefined) {
      const email = normalizeEmail(req.body.email)
      if (email === undefined) {
        res.status(400).json({ error: 'Invalid email' })
        return
      }
      if (email) {
        newEmail = email
      } else {
        data.email = null
        data.emailVerified = false
      }
    }

    if (Object.keys(data).length === 0 && !newEmail) {
      res.status(400).json({ error: 'Nothing to update' })
      return
    }

    if (Object.keys(data).length > 0) {
      await prisma.user.update({ where: { id: payload.sub }, data })
    }
    // A new address is only saved once the owner confirms it from that inbox
    if (newEmail) await requestEmailChange(payload.sub, newEmail)

    const user = await prisma.user.findUnique({ where: { id: payload.sub }, select: PUBLIC_USER })
    res.json({ user: { ...user, pendingEmail: await pendingEmailFor(payload.sub) } })
  } catch (err) {
    console.error('[Auth] Profile update error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// POST /api/auth/verify-email
router.post('/verify-email', ...authLimits.redeemToken, async (req: Request, res: Response) => {
  try {
    if (!isEmailToken(req.body.token)) {
      res.status(400).json({ error: 'Invalid or expired link' })
      return
    }
    const result = await confirmEmail(req.body.token)
    if (!result.ok) {
      res.status(result.reason === 'taken' ? 409 : 400).json({
        error: result.reason === 'taken' ? 'Email already confirmed on another account' : 'Invalid or expired link',
      })
      return
    }
    res.json({ ok: true, email: result.email })
  } catch (err) {
    console.error('[Auth] Email verification error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// POST /api/auth/request-reset
router.post('/request-reset', ...authLimits.requestReset, async (req: Request, res: Response) => {
  try {
    const email = normalizeEmail(req.body.email)
    if (!email) {
      res.status(400).json({ error: 'Email is required' })
      return
    }

    // Same answer and timing whether or not the email has an account
    const user = await prisma.user.findUnique({ where: { email }, select: { id: true } })
    if (user) {
      // Older links stay valid until they expire, so a flood of requests can't block recovery
      const { token, digest } = newEmailToken()
      await prisma.passwordReset.create({
        data: { userId: user.id, token: digest, email, expiresAt: new Date(Date.now() + RESET_TTL_MS) },
      })
      deliverInBackground(sendPasswordResetEmail(email, token))
    }
    res.json({ ok: true })
  } catch (err) {
    console.error('[Auth] Password reset request error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// POST /api/auth/reset-password
router.post('/reset-password', ...authLimits.redeemToken, async (req: Request, res: Response) => {
  try {
    const { token, password } = req.body
    if (!isEmailToken(token)) {
      res.status(400).json({ error: 'Invalid or expired reset link' })
      return
    }
    if (!isPassword(password)) {
      res.status(400).json({ error: `Password must be ${PASSWORD_MIN}-${PASSWORD_MAX} characters` })
      return
    }

    // Hash first: a failure here must not burn the link
    const passwordHash = await hashPassword(password)

    // Consume the link, change the password and revoke every session as one unit.
    // The conditional update makes the link single-use even under concurrent requests.
    const userId = await prisma.$transaction(async tx => {
      const record = await tx.passwordReset.findUnique({ where: { token: digestToken(token) } })
      if (!record) return null
      const consumed = await tx.passwordReset.updateMany({
        where: { id: record.id, used: false, expiresAt: { gt: new Date() } },
        data: { used: true },
      })
      if (consumed.count !== 1) return null

      const user = await tx.user.findUnique({ where: { id: record.userId }, select: { email: true } })
      // The link reached this inbox, which proves the address if it's still the account's email
      const provesEmail = !!record.email && record.email === user?.email
      await tx.user.update({
        where: { id: record.userId },
        data: { passwordHash, ...(provesEmail ? { emailVerified: true } : {}) },
      })
      await tx.passwordReset.updateMany({ where: { userId: record.userId, used: false }, data: { used: true } })
      await tx.session.deleteMany({ where: { userId: record.userId } })
      return record.userId
    })

    if (!userId) {
      res.status(400).json({ error: 'Invalid or expired reset link' })
      return
    }
    disconnectSessionSockets({ userId })
    res.json({ ok: true })
  } catch (err) {
    console.error('[Auth] Password reset error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

export default router

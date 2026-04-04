import { Router, Request, Response } from 'express'
import crypto from 'crypto'
import prisma from '../db/prisma'
import { hashPassword, comparePassword } from './passwordUtils'
import { signToken, verifyToken } from './jwt'
import { verifyGoogleToken } from './google'
import { sendPasswordResetEmail } from './emailService'

const router = Router()

// POST /api/auth/register
router.post('/register', async (req: Request, res: Response) => {
  try {
    const { username, password, displayName } = req.body

    if (!username || !password) {
      res.status(400).json({ error: 'Username and password are required' })
      return
    }
    if (username.length < 3 || username.length > 20) {
      res.status(400).json({ error: 'Username must be 3-20 characters' })
      return
    }
    if (password.length < 6) {
      res.status(400).json({ error: 'Password must be at least 6 characters' })
      return
    }
    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      res.status(400).json({ error: 'Username can only contain letters, numbers, and underscores' })
      return
    }

    const existing = await prisma.user.findUnique({ where: { username: username.toLowerCase() } })
    if (existing) {
      res.status(409).json({ error: 'Username already taken' })
      return
    }

    const passwordHash = await hashPassword(password)
    const user = await prisma.user.create({
      data: {
        username: username.toLowerCase(),
        displayName: displayName || username,
        passwordHash,
        stats: { create: {} },
      },
      select: { id: true, username: true, displayName: true, avatarUrl: true, createdAt: true },
    })

    const { token, jti, expiresAt } = signToken(user.id, user.username)
    await prisma.session.create({ data: { userId: user.id, token: jti, expiresAt } })

    res.status(201).json({ token, user })
  } catch (err) {
    console.error('[Auth] Register error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// POST /api/auth/login
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body

    if (!username || !password) {
      res.status(400).json({ error: 'Username and password are required' })
      return
    }

    const user = await prisma.user.findUnique({
      where: { username: username.toLowerCase() },
      select: { id: true, username: true, displayName: true, avatarUrl: true, passwordHash: true },
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

    const { token, jti, expiresAt } = signToken(user.id, user.username)
    await prisma.session.create({ data: { userId: user.id, token: jti, expiresAt } })
    await prisma.user.update({ where: { id: user.id }, data: { lastSeenAt: new Date() } })

    const { passwordHash: _, ...safeUser } = user
    res.json({ token, user: safeUser })
  } catch (err) {
    console.error('[Auth] Login error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// POST /api/auth/google
router.post('/google', async (req: Request, res: Response) => {
  try {
    const { idToken } = req.body
    if (!idToken) {
      res.status(400).json({ error: 'Google ID token is required' })
      return
    }

    const profile = await verifyGoogleToken(idToken)

    // Find by googleId or email
    let user = await prisma.user.findFirst({
      where: { OR: [{ googleId: profile.googleId }, { email: profile.email }] },
    })

    if (user) {
      // Update Google ID if they previously registered with email/password
      if (!user.googleId) {
        user = await prisma.user.update({
          where: { id: user.id },
          data: { googleId: profile.googleId, avatarUrl: user.avatarUrl || profile.picture },
        })
      }
      await prisma.user.update({ where: { id: user.id }, data: { lastSeenAt: new Date() } })
    } else {
      // Create new account from Google
      const baseUsername = profile.name.toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 16)
      let username = baseUsername
      let counter = 1
      while (await prisma.user.findUnique({ where: { username } })) {
        username = `${baseUsername}${counter++}`
      }

      user = await prisma.user.create({
        data: {
          username,
          displayName: profile.name,
          email: profile.email,
          googleId: profile.googleId,
          avatarUrl: profile.picture,
          stats: { create: {} },
        },
      })
    }

    const { token, jti, expiresAt } = signToken(user.id, user.username)
    await prisma.session.create({ data: { userId: user.id, token: jti, expiresAt } })

    const { passwordHash: _, ...safeUser } = user
    res.json({ token, user: safeUser })
  } catch (err: any) {
    console.error('[Auth] Google auth error:', err?.message || err)
    const isTokenError = err?.message?.includes('token') || err?.message?.includes('Token')
    res.status(isTokenError ? 401 : 500).json({ error: err?.message || 'Google auth failed' })
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

    const token = authHeader.slice(7)
    const payload = verifyToken(token)

    // Check session exists (not revoked)
    const session = await prisma.session.findUnique({ where: { token: payload.jti } })
    if (!session || session.expiresAt < new Date()) {
      res.status(401).json({ error: 'Session expired' })
      return
    }

    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true, username: true, displayName: true, avatarUrl: true, email: true, createdAt: true,
        stats: { select: { gamesPlayed: true, gamesWon: true } },
      },
    })

    if (!user) {
      res.status(404).json({ error: 'User not found' })
      return
    }

    res.json({ user })
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

    const token = authHeader.slice(7)
    const payload = verifyToken(token)
    await prisma.session.deleteMany({ where: { token: payload.jti } })
    res.json({ ok: true })
  } catch {
    res.status(200).json({ ok: true })
  }
})

// PATCH /api/auth/profile
router.patch('/profile', async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization
    if (!authHeader?.startsWith('Bearer ')) {
      res.status(401).json({ error: 'No token provided' })
      return
    }

    const token = authHeader.slice(7)
    const payload = verifyToken(token)

    const { displayName } = req.body
    if (!displayName || typeof displayName !== 'string') {
      res.status(400).json({ error: 'Display name is required' })
      return
    }

    const sanitized = displayName.trim().slice(0, 20)
    if (sanitized.length < 1) {
      res.status(400).json({ error: 'Display name too short' })
      return
    }

    const user = await prisma.user.update({
      where: { id: payload.sub },
      data: { displayName: sanitized },
      select: { id: true, username: true, displayName: true, avatarUrl: true },
    })

    res.json({ user })
  } catch (err) {
    console.error('[Auth] Profile update error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// POST /api/auth/request-reset
router.post('/request-reset', async (req: Request, res: Response) => {
  try {
    const { email } = req.body
    if (!email || typeof email !== 'string') {
      res.status(400).json({ error: 'Email is required' })
      return
    }

    // Always return success to prevent email enumeration
    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } })
    if (!user) {
      res.json({ ok: true })
      return
    }

    // Invalidate any existing reset tokens for this user
    await prisma.passwordReset.updateMany({
      where: { userId: user.id, used: false },
      data: { used: true },
    })

    // Create new reset token (1 hour expiry)
    const token = crypto.randomBytes(32).toString('hex')
    await prisma.passwordReset.create({
      data: {
        userId: user.id,
        token,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      },
    })

    await sendPasswordResetEmail(email, token)
    res.json({ ok: true })
  } catch (err) {
    console.error('[Auth] Password reset request error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// POST /api/auth/reset-password
router.post('/reset-password', async (req: Request, res: Response) => {
  try {
    const { token, password } = req.body
    if (!token || !password) {
      res.status(400).json({ error: 'Token and password are required' })
      return
    }
    if (password.length < 6) {
      res.status(400).json({ error: 'Password must be at least 6 characters' })
      return
    }

    const resetRecord = await prisma.passwordReset.findUnique({ where: { token } })
    if (!resetRecord || resetRecord.used || resetRecord.expiresAt < new Date()) {
      res.status(400).json({ error: 'Invalid or expired reset link' })
      return
    }

    // Mark token as used
    await prisma.passwordReset.update({
      where: { id: resetRecord.id },
      data: { used: true },
    })

    // Update password
    const passwordHash = await hashPassword(password)
    await prisma.user.update({
      where: { id: resetRecord.userId },
      data: { passwordHash },
    })

    // Invalidate all existing sessions (force re-login)
    await prisma.session.deleteMany({ where: { userId: resetRecord.userId } })

    res.json({ ok: true })
  } catch (err) {
    console.error('[Auth] Password reset error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

export default router

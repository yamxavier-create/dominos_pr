import jwt from 'jsonwebtoken'
import crypto from 'crypto'
import prisma from '../db/prisma'

// The dev fallback is public in the repo, so production must never use it
const JWT_SECRET = process.env.JWT_SECRET
  || (process.env.NODE_ENV === 'production' ? '' : 'dev-secret-change-in-production')
if (!JWT_SECRET) {
  throw new Error('JWT_SECRET must be set in production')
}
const TOKEN_EXPIRY = '7d'

export interface JWTPayload {
  sub: string       // userId
  username: string
  jti: string       // unique token id for revocation
  iat: number
  exp: number
}

export function signToken(userId: string, username: string): { token: string; jti: string; expiresAt: Date } {
  const jti = crypto.randomUUID()
  const token = jwt.sign(
    { sub: userId, username, jti },
    JWT_SECRET,
    { expiresIn: TOKEN_EXPIRY }
  )

  const decoded = jwt.decode(token) as JWTPayload
  const expiresAt = new Date(decoded.exp * 1000)

  return { token, jti, expiresAt }
}

export function verifyToken(token: string): JWTPayload {
  return jwt.verify(token, JWT_SECRET) as JWTPayload
}

/**
 * Verify the signature AND that the token's session still exists (not logged out,
 * not revoked by a password reset, not expired). Returns null when the token is
 * not usable; database errors propagate so routes answer 500, not 401.
 */
export async function verifySession(token: string): Promise<JWTPayload | null> {
  let payload: JWTPayload
  try {
    payload = verifyToken(token)
  } catch {
    return null
  }
  const session = await prisma.session.findUnique({ where: { token: payload.jti } })
  if (!session || session.expiresAt < new Date()) return null
  return payload
}

/** Read the Bearer token from an Authorization header and verify its session */
export async function verifyBearer(authHeader: string | undefined): Promise<JWTPayload | null> {
  if (!authHeader?.startsWith('Bearer ')) return null
  return verifySession(authHeader.slice(7))
}

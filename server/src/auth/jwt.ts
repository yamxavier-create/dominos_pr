import jwt from 'jsonwebtoken'
import crypto from 'crypto'

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production'
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

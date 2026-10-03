import crypto from 'crypto'

/**
 * Single-use tokens sent by email (password reset, email confirmation). Only
 * the SHA-256 digest is stored, so a database leak can't be replayed.
 */
export function newEmailToken(): { token: string; digest: string } {
  const token = crypto.randomBytes(32).toString('hex')
  return { token, digest: digestToken(token) }
}

export function digestToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex')
}

/** Shape check before touching the DB: 64 lowercase hex chars. */
export function isEmailToken(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9a-f]{64}$/.test(value)
}

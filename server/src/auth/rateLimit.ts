import { Request, Response, NextFunction, RequestHandler } from 'express'

/**
 * In-memory fixed-window limits. One server instance, so memory is enough;
 * a restart resets the counters. Runs before any DB query or bcrypt work.
 */
interface Window { count: number; resetAt: number }
const windows = new Map<string, Window>()

/** Count a hit. Returns 0 when allowed, or the ms until the window resets. */
export function hit(key: string, max: number, windowMs: number, now = Date.now()): number {
  let w = windows.get(key)
  if (!w || w.resetAt <= now) {
    w = { count: 0, resetAt: now + windowMs }
    windows.set(key, w)
  }
  w.count++
  return w.count > max ? w.resetAt - now : 0
}

export function resetRateLimits() {
  windows.clear()
}

const sweep = setInterval(() => {
  const now = Date.now()
  for (const [key, w] of windows) if (w.resetAt <= now) windows.delete(key)
}, 5 * 60_000)
sweep.unref()

const MINUTE = 60_000
const HOUR = 60 * MINUTE

/**
 * Express middleware. `keyOf` picks what to count (IP, normalized username,
 * email); returning undefined skips that limit for the request.
 */
export function rateLimit(
  name: string,
  max: number,
  windowMs: number,
  keyOf: (req: Request) => string | undefined,
): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    const key = keyOf(req)
    if (key === undefined) return next()
    const retryMs = hit(`${name}:${key}`, max, windowMs)
    if (retryMs === 0) return next()
    res.setHeader('Retry-After', Math.ceil(retryMs / 1000).toString())
    res.status(429).json({ error: 'Demasiados intentos. Intenta de nuevo más tarde.' })
  }
}

const byIp = (req: Request) => req.ip ?? 'unknown'
const bodyString = (field: string) => (req: Request) => {
  const value = req.body?.[field]
  return typeof value === 'string' ? value.trim().toLowerCase().slice(0, 254) : undefined
}

export const authLimits = {
  login: [
    rateLimit('login-ip', 30, 15 * MINUTE, byIp),
    rateLimit('login-id', 10, 15 * MINUTE, bodyString('username')),
  ],
  register: [rateLimit('register-ip', 10, HOUR, byIp)],
  google: [rateLimit('google-ip', 30, 15 * MINUTE, byIp)],
  requestReset: [
    rateLimit('reset-ip', 10, HOUR, byIp),
    rateLimit('reset-email', 3, HOUR, bodyString('email')),
  ],
  redeemToken: [rateLimit('redeem-ip', 20, 15 * MINUTE, byIp)],
  profile: [rateLimit('profile-ip', 20, 15 * MINUTE, byIp)],
}

/** Per-recipient cap for confirmation emails; over the cap the email is silently skipped. */
export function allowEmailTo(address: string): boolean {
  return hit(`mail:${address}`, 3, HOUR) === 0
}

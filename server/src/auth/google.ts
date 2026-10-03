import { OAuth2Client } from 'google-auth-library'

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || ''

const client = new OAuth2Client(GOOGLE_CLIENT_ID)

export interface GoogleProfile {
  googleId: string
  email: string  // lowercased, and verified by Google
  name: string
  picture?: string
}

/** Thrown for anything wrong with the token itself: answer 401, never 500. */
export class GoogleTokenError extends Error {}

export function isGoogleConfigured(): boolean {
  return GOOGLE_CLIENT_ID.length > 0
}

export async function verifyGoogleToken(idToken: string): Promise<GoogleProfile> {
  let payload
  try {
    const ticket = await client.verifyIdToken({ idToken, audience: GOOGLE_CLIENT_ID })
    payload = ticket.getPayload()
  } catch {
    throw new GoogleTokenError('Invalid Google token')
  }

  if (!payload || !payload.sub || !payload.email) {
    throw new GoogleTokenError('Invalid Google token payload')
  }
  // An unverified Google email proves nothing and must never link to an account
  if (payload.email_verified !== true) {
    throw new GoogleTokenError('Google email not verified')
  }

  return {
    googleId: payload.sub,
    email: payload.email.toLowerCase(),
    name: payload.name || payload.email.split('@')[0],
    picture: payload.picture,
  }
}

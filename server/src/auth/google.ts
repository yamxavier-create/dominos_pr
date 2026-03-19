import { OAuth2Client } from 'google-auth-library'

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || ''

const client = new OAuth2Client(GOOGLE_CLIENT_ID)

export interface GoogleProfile {
  googleId: string
  email: string
  name: string
  picture?: string
}

export async function verifyGoogleToken(idToken: string): Promise<GoogleProfile> {
  const ticket = await client.verifyIdToken({
    idToken,
    audience: GOOGLE_CLIENT_ID,
  })

  const payload = ticket.getPayload()
  if (!payload || !payload.sub || !payload.email) {
    throw new Error('Invalid Google token payload')
  }

  return {
    googleId: payload.sub,
    email: payload.email,
    name: payload.name || payload.email.split('@')[0],
    picture: payload.picture,
  }
}

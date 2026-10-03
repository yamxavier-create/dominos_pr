import { User } from '@prisma/client'
import prisma from '../db/prisma'
import { GoogleProfile } from './google'

/** The Google email belongs to an account already linked to a different Google identity. */
export class GoogleLinkConflictError extends Error {}

/**
 * Find or create the account for a verified Google identity.
 *
 * 1. Same googleId: that account.
 * 2. Same email, confirmed, not linked: link it (both sides proved the address).
 * 3. Same email, never confirmed: the claimant never proved it and Google just
 *    did, so the claim is dropped and the Google user gets a fresh account. This
 *    is what stops pre-registering someone else's email to capture their login.
 * 4. Otherwise: new account.
 */
export async function resolveGoogleUser(profile: GoogleProfile): Promise<User> {
  return prisma.$transaction(async tx => {
    const linked = await tx.user.findUnique({ where: { googleId: profile.googleId } })
    if (linked) {
      return tx.user.update({ where: { id: linked.id }, data: { lastSeenAt: new Date() } })
    }

    const holder = await tx.user.findUnique({ where: { email: profile.email } })
    if (holder?.googleId) throw new GoogleLinkConflictError('Email linked to another Google account')

    if (holder?.emailVerified) {
      return tx.user.update({
        where: { id: holder.id },
        data: { googleId: profile.googleId, avatarUrl: holder.avatarUrl || profile.picture, lastSeenAt: new Date() },
      })
    }

    if (holder) {
      await tx.user.update({ where: { id: holder.id }, data: { email: null, emailVerified: false } })
    }

    const baseUsername = profile.name.toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 16) || 'jugador'
    let username = baseUsername
    let counter = 1
    while (await tx.user.findUnique({ where: { username } })) {
      username = `${baseUsername}${counter++}`
    }

    return tx.user.create({
      data: {
        username,
        displayName: profile.name.slice(0, 20),
        email: profile.email,
        emailVerified: true,
        googleId: profile.googleId,
        avatarUrl: profile.picture,
        stats: { create: {} },
      },
    })
  })
}

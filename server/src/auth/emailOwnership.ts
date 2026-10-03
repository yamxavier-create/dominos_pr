import prisma from '../db/prisma'
import { newEmailToken, digestToken } from './tokens'
import { allowEmailTo } from './rateLimit'
import { deliverInBackground, sendVerifyEmail, sendEmailInUseNotice } from './emailService'

const VERIFY_TTL_MS = 24 * 60 * 60_000

/**
 * Start moving a user to a new email. Nothing is saved on the account until the
 * owner clicks the link, and the caller's response is identical whether the
 * address is free, unconfirmed elsewhere or confirmed elsewhere, so this can't
 * be used to discover which emails have accounts.
 */
export async function requestEmailChange(userId: string, email: string): Promise<void> {
  const holder = await prisma.user.findUnique({ where: { email }, select: { id: true, emailVerified: true } })
  if (holder?.id === userId && holder.emailVerified) return

  // Always record the pending address, even when it can never be confirmed,
  // so pendingEmail in /me looks the same either way
  const { token, digest } = newEmailToken()
  await prisma.emailVerification.create({
    data: { userId, email, token: digest, expiresAt: new Date(Date.now() + VERIFY_TTL_MS) },
  })

  if (!allowEmailTo(email)) return
  if (holder && holder.id !== userId && holder.emailVerified) {
    deliverInBackground(sendEmailInUseNotice(email))
  } else {
    deliverInBackground(sendVerifyEmail(email, token))
  }
}

/** The address a user is waiting to confirm, if any. */
export async function pendingEmailFor(userId: string): Promise<string | null> {
  const pending = await prisma.emailVerification.findFirst({
    where: { userId, used: false, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: 'desc' },
    select: { email: true },
  })
  return pending?.email ?? null
}

export type ConfirmResult =
  | { ok: true; userId: string; email: string }
  | { ok: false; reason: 'invalid' | 'taken' }

/**
 * Redeem a confirmation link. Single use even under concurrent requests: the
 * token is consumed with a conditional update inside the transaction.
 */
export async function confirmEmail(rawToken: string): Promise<ConfirmResult> {
  const digest = digestToken(rawToken)
  return prisma.$transaction(async (tx): Promise<ConfirmResult> => {
    const record = await tx.emailVerification.findUnique({ where: { token: digest } })
    if (!record) return { ok: false, reason: 'invalid' }
    const consumed = await tx.emailVerification.updateMany({
      where: { id: record.id, used: false, expiresAt: { gt: new Date() } },
      data: { used: true },
    })
    if (consumed.count !== 1) return { ok: false, reason: 'invalid' }

    const holder = await tx.user.findUnique({ where: { email: record.email } })
    if (holder && holder.id !== record.userId) {
      if (holder.emailVerified) return { ok: false, reason: 'taken' }
      // An unproven claim loses to a proven one
      await tx.user.update({ where: { id: holder.id }, data: { email: null, emailVerified: false } })
    }

    await tx.user.update({ where: { id: record.userId }, data: { email: record.email, emailVerified: true } })
    // Other pending links and any reset link sent to the old address are void now
    await tx.emailVerification.updateMany({ where: { userId: record.userId, used: false }, data: { used: true } })
    await tx.passwordReset.updateMany({ where: { userId: record.userId, used: false }, data: { used: true } })
    return { ok: true, userId: record.userId, email: record.email }
  })
}

import { Resend } from 'resend'
import { config } from '../config'

const resend = config.RESEND_API_KEY ? new Resend(config.RESEND_API_KEY) : null

export type EmailKind = 'password_reset' | 'verify_email' | 'email_in_use'

export interface OutgoingEmail {
  kind: EmailKind
  to: string
  subject: string
  html: string
  /** The single-use link, if any. Never logged in production. */
  link?: string
}

type Transport = (email: OutgoingEmail) => Promise<void>

const defaultTransport: Transport = async email => {
  if (resend) {
    await resend.emails.send({ from: 'Dominó PR <noreply@dominopr.app>', to: email.to, subject: email.subject, html: email.html })
    return
  }
  if (config.NODE_ENV === 'production') {
    // A link in the logs is a working credential, so production never prints it
    console.warn(`[Email] RESEND_API_KEY missing: ${email.kind} email not sent`)
    return
  }
  console.log(`[DEV] ${email.kind} for ${email.to}: ${email.link ?? '(no link)'}`)
}

let transport: Transport = defaultTransport

/** Tests capture outgoing email here instead of sending it. Pass null to restore. */
export function setEmailTransport(custom: Transport | null) {
  transport = custom ?? defaultTransport
}

function layout(body: string, button?: { href: string; label: string }, footer?: string) {
  return `
    <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 32px; background: #0A1A0F; color: #fff; border-radius: 16px;">
      <h1 style="color: #EAB308; font-size: 28px; margin-bottom: 8px;">Dominó PR</h1>
      <p style="color: rgba(255,255,255,0.7); font-size: 14px; margin-bottom: 24px;">${body}</p>
      ${button ? `<a href="${button.href}" style="display: inline-block; background: linear-gradient(135deg, #22C55E, #16a34a); color: white; padding: 12px 32px; border-radius: 12px; text-decoration: none; font-weight: bold; font-size: 16px;">${button.label}</a>` : ''}
      ${footer ? `<p style="color: rgba(255,255,255,0.4); font-size: 12px; margin-top: 24px;">${footer}</p>` : ''}
    </div>
  `
}

export async function sendPasswordResetEmail(email: string, resetToken: string) {
  const link = `${config.APP_URL}/reset-password?token=${resetToken}`
  await transport({
    kind: 'password_reset',
    to: email,
    subject: 'Restablecer tu contraseña — Dominó PR',
    link,
    html: layout(
      'Recibimos una solicitud para restablecer tu contraseña.',
      { href: link, label: 'Restablecer Contraseña' },
      'Este enlace expira en 1 hora. Si no solicitaste esto, ignora este correo.',
    ),
  })
}

export async function sendVerifyEmail(email: string, verifyToken: string) {
  const link = `${config.APP_URL}/verify-email?token=${verifyToken}`
  await transport({
    kind: 'verify_email',
    to: email,
    subject: 'Confirma tu email — Dominó PR',
    link,
    html: layout(
      'Confirma que este email es tuyo para usarlo en tu cuenta de Dominó PR.',
      { href: link, label: 'Confirmar Email' },
      'Este enlace expira en 24 horas. Si no fuiste tú, ignora este correo y no se guardará.',
    ),
  })
}

/** Sent instead of a confirmation link when the address already belongs to a confirmed account. */
export async function sendEmailInUseNotice(email: string) {
  await transport({
    kind: 'email_in_use',
    to: email,
    subject: 'Tu email ya tiene una cuenta — Dominó PR',
    html: layout(
      'Alguien intentó usar este email en una cuenta nueva de Dominó PR, pero ya está confirmado en tu cuenta. No cambiamos nada.',
      { href: `${config.APP_URL}/auth`, label: 'Ir a Dominó PR' },
      'Si olvidaste tu contraseña, usa "¿Olvidaste tu contraseña?" al iniciar sesión.',
    ),
  })
}

/** Fire and forget: the HTTP response never waits on (or reveals) email delivery. */
export function deliverInBackground(send: Promise<void>) {
  send.catch(err => console.error('[Email] delivery failed:', err?.message ?? err))
}

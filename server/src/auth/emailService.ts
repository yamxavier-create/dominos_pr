import { Resend } from 'resend'
import { config } from '../config'

const resend = config.RESEND_API_KEY ? new Resend(config.RESEND_API_KEY) : null

export async function sendPasswordResetEmail(email: string, resetToken: string) {
  const resetUrl = `${config.APP_URL}/reset-password?token=${resetToken}`

  if (!resend) {
    // Dev fallback — log to console
    console.log(`[DEV] Password reset for ${email}: ${resetUrl}`)
    return
  }

  await resend.emails.send({
    from: 'Dominó PR <noreply@dominopr.app>',
    to: email,
    subject: 'Restablecer tu contraseña — Dominó PR',
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 32px; background: #0A1A0F; color: #fff; border-radius: 16px;">
        <h1 style="color: #EAB308; font-size: 28px; margin-bottom: 8px;">Dominó PR</h1>
        <p style="color: rgba(255,255,255,0.7); font-size: 14px; margin-bottom: 24px;">
          Recibimos una solicitud para restablecer tu contraseña.
        </p>
        <a href="${resetUrl}" style="display: inline-block; background: linear-gradient(135deg, #22C55E, #16a34a); color: white; padding: 12px 32px; border-radius: 12px; text-decoration: none; font-weight: bold; font-size: 16px;">
          Restablecer Contraseña
        </a>
        <p style="color: rgba(255,255,255,0.4); font-size: 12px; margin-top: 24px;">
          Este enlace expira en 1 hora. Si no solicitaste esto, ignora este correo.
        </p>
      </div>
    `,
  })
}

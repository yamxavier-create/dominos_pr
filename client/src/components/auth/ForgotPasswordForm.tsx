import { useState } from 'react'
import { API_BASE } from '../../apiBase'

interface Props {
  onBack: () => void
}

export function ForgotPasswordForm({ onBack }: Props) {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim()) return

    setLoading(true)
    setError('')
    try {
      const res = await fetch(`${API_BASE}/api/auth/request-reset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Error al enviar')
      }
      setSent(true)
    } catch (err: any) {
      setError(err.message || 'Error al enviar')
    } finally {
      setLoading(false)
    }
  }

  if (sent) {
    return (
      <div className="flex flex-col gap-4 items-center text-center">
        <div className="text-4xl">📧</div>
        <h3 className="font-header text-2xl text-gold">Revisa tu correo</h3>
        <p className="font-body text-white/60 text-sm">
          Si existe una cuenta con <span className="text-white/80">{email}</span>, recibirás un enlace para restablecer tu contraseña.
        </p>
        <button
          onClick={onBack}
          className="font-body text-primary hover:text-primary/80 text-sm transition-colors mt-2"
        >
          Volver al inicio de sesión
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="text-center">
        <h3 className="font-header text-2xl text-gold">Restablecer Contraseña</h3>
        <p className="font-body text-white/50 text-xs mt-1">
          Ingresa el correo asociado a tu cuenta
        </p>
      </div>

      <div className="flex flex-col gap-1">
        <label className="font-body text-white/70 text-sm">Correo electrónico</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="tu@correo.com"
          className="bg-bg border rounded-xl px-4 py-3 font-body text-white text-base placeholder:text-white/30 outline-none border-border focus:border-primary transition-colors"
          required
        />
      </div>

      {error && <p className="font-body text-accent text-sm text-center">{error}</p>}

      <button
        type="submit"
        disabled={loading || !email.trim()}
        className="w-full font-body font-bold py-3 rounded-2xl text-white text-base active:scale-95 disabled:opacity-40 btn-glow"
      >
        {loading ? 'Enviando...' : 'Enviar enlace'}
      </button>

      <button
        type="button"
        onClick={onBack}
        className="font-body text-white/40 hover:text-white/70 text-sm transition-colors"
      >
        ← Volver
      </button>
    </form>
  )
}

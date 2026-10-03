import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { API_BASE } from '../apiBase'
import { useAuth } from '../hooks/useAuth'

type Status = 'checking' | 'done' | 'taken' | 'invalid'

const MESSAGES: Record<Exclude<Status, 'checking'>, { title: string; body: string }> = {
  done: { title: 'Email confirmado', body: 'Ya puedes usarlo para iniciar sesión y recuperar tu contraseña.' },
  taken: { title: 'Email en uso', body: 'Ese email ya está confirmado en otra cuenta.' },
  invalid: { title: 'Enlace inválido', body: 'Este enlace de confirmación no es válido o ha expirado.' },
}

export function VerifyEmailPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { refreshUser } = useAuth()
  const token = searchParams.get('token')
  const [status, setStatus] = useState<Status>(token ? 'checking' : 'invalid')
  const sent = useRef(false)

  useEffect(() => {
    // Links are single use: guard against the effect running twice in dev
    if (!token || sent.current) return
    sent.current = true
    fetch(`${API_BASE}/api/auth/verify-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    })
      .then(res => {
        setStatus(res.ok ? 'done' : res.status === 409 ? 'taken' : 'invalid')
        if (res.ok) refreshUser().catch(() => {})
      })
      .catch(() => setStatus('invalid'))
  }, [token])

  const message = status === 'checking' ? { title: 'Confirmando…', body: '' } : MESSAGES[status]

  return (
    <div className="min-h-screen felt-table flex items-center justify-center p-4">
      <div className="menu-card text-center max-w-xs">
        <h2 className={`font-header text-2xl mb-3 ${status === 'done' ? 'text-gold' : status === 'checking' ? 'text-white' : 'text-accent'}`}>
          {message.title}
        </h2>
        {message.body && <p className="font-body text-white/50 text-sm mb-4">{message.body}</p>}
        {status !== 'checking' && (
          <button
            onClick={() => navigate('/')}
            className="font-body text-primary hover:text-primary/80 text-sm transition-colors"
          >
            Ir al inicio
          </button>
        )}
      </div>
    </div>
  )
}

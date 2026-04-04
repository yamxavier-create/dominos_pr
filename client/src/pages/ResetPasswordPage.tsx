import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { API_BASE } from '../apiBase'

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const token = searchParams.get('token')

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  if (!token) {
    return (
      <div className="min-h-screen felt-table flex items-center justify-center p-4">
        <div className="menu-card text-center max-w-xs">
          <h2 className="font-header text-2xl text-accent mb-3">Enlace inválido</h2>
          <p className="font-body text-white/50 text-sm mb-4">
            Este enlace de restablecimiento no es válido o ha expirado.
          </p>
          <button
            onClick={() => navigate('/')}
            className="font-body text-primary hover:text-primary/80 text-sm transition-colors"
          >
            Ir al inicio
          </button>
        </div>
      </div>
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres')
      return
    }
    if (password !== confirm) {
      setError('Las contraseñas no coinciden')
      return
    }

    setLoading(true)
    try {
      const res = await fetch(`${API_BASE}/api/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error al restablecer')
      setSuccess(true)
    } catch (err: any) {
      setError(err.message || 'Error al restablecer')
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="min-h-screen felt-table flex items-center justify-center p-4">
        <div className="menu-card flex flex-col items-center gap-4 max-w-xs text-center">
          <div className="text-4xl">✅</div>
          <h2 className="font-header text-2xl text-gold">Contraseña actualizada</h2>
          <p className="font-body text-white/60 text-sm">
            Tu contraseña ha sido restablecida. Ya puedes iniciar sesión.
          </p>
          <button
            onClick={() => navigate('/auth')}
            className="w-full font-body font-bold py-3 rounded-2xl text-white text-base active:scale-95 btn-glow"
          >
            Iniciar Sesión
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen felt-table flex items-center justify-center p-4">
      <form onSubmit={handleSubmit} className="menu-card flex flex-col gap-4 w-full max-w-xs">
        <div className="text-center">
          <h2 className="font-header text-2xl text-gold mb-1">Nueva Contraseña</h2>
          <p className="font-body text-white/50 text-xs">Ingresa tu nueva contraseña</p>
        </div>

        <div className="flex flex-col gap-1">
          <label className="font-body text-white/70 text-sm">Nueva contraseña</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Mínimo 6 caracteres"
            className="bg-bg border rounded-xl px-4 py-3 font-body text-white text-base placeholder:text-white/30 outline-none border-border focus:border-primary transition-colors"
            minLength={6}
            required
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="font-body text-white/70 text-sm">Confirmar contraseña</label>
          <input
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="Repite tu contrase��a"
            className="bg-bg border rounded-xl px-4 py-3 font-body text-white text-base placeholder:text-white/30 outline-none border-border focus:border-primary transition-colors"
            minLength={6}
            required
          />
        </div>

        {error && <p className="font-body text-accent text-sm text-center">{error}</p>}

        <button
          type="submit"
          disabled={loading || !password || !confirm}
          className="w-full font-body font-bold py-3 rounded-2xl text-white text-base active:scale-95 disabled:opacity-40 btn-glow"
        >
          {loading ? 'Guardando...' : 'Restablecer Contraseña'}
        </button>
      </form>
    </div>
  )
}

import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { API_BASE } from '../apiBase'
import { StageBackdrop } from '../components/ui/Escenario'

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
        <StageBackdrop still />
        <div className="mm-pop relative menu-card text-center w-full max-w-xs">
          <h2 className="mm-title !text-[#FF8A80] text-[1.7rem] leading-tight mb-3">Enlace inválido</h2>
          <p className="font-body font-semibold text-white/80 text-sm mb-5">
            Este enlace de restablecimiento no es válido o ha expirado.
          </p>
          <button
            onClick={() => navigate('/')}
            className="mm-btn-gold mm-stroke"
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
        <StageBackdrop still />
        <div className="mm-pop relative menu-card flex flex-col items-center gap-4 w-full max-w-xs text-center">
          <div className="text-4xl">✅</div>
          <h2 className="mm-title text-[1.7rem] leading-tight">Contraseña actualizada</h2>
          <p className="font-body font-semibold text-white/80 text-sm">
            Tu contraseña ha sido restablecida. Ya puedes iniciar sesión.
          </p>
          <button
            onClick={() => navigate('/auth')}
            className="mm-btn-gold mm-stroke"
          >
            Iniciar Sesión
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen felt-table flex items-center justify-center p-4">
      <StageBackdrop still />
      <form onSubmit={handleSubmit} className="mm-rise relative menu-card flex flex-col gap-4 w-full max-w-xs">
        <div className="text-center">
          <h2 className="mm-title text-[1.9rem] leading-tight mb-1">Nueva Contraseña</h2>
          <p className="font-body font-semibold text-white/70 text-xs">Ingresa tu nueva contraseña</p>
        </div>

        <div className="flex flex-col gap-1">
          <label className="font-body font-extrabold text-white/85 text-sm">Nueva contraseña</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Mínimo 6 caracteres"
            className="mm-input"
            minLength={6}
            required
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="font-body font-extrabold text-white/85 text-sm">Confirmar contraseña</label>
          <input
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="Repite tu contraseña"
            className="mm-input"
            minLength={6}
            required
          />
        </div>

        {error && <p className="font-body font-bold text-[#FF8A80] text-sm text-center">{error}</p>}

        <button
          type="submit"
          disabled={loading || !password || !confirm}
          className="mm-btn-gold mm-stroke"
        >
          {loading ? 'Guardando...' : 'Restablecer Contraseña'}
        </button>
      </form>
    </div>
  )
}

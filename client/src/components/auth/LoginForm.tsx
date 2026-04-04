import { useState } from 'react'
import { Input } from '../ui/Input'

interface LoginFormProps {
  onLogin: (username: string, password: string) => Promise<void>
  onSwitchToRegister: () => void
  onForgotPassword?: () => void
  error: string | null
}

export function LoginForm({ onLogin, onSwitchToRegister, onForgotPassword, error }: LoginFormProps) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async () => {
    if (!username.trim() || !password) return
    setLoading(true)
    try {
      await onLogin(username.trim(), password)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col gap-5 w-full">
      <div className="text-center">
        <h2 className="font-header text-4xl text-gold">Iniciar Sesión</h2>
        <p className="font-body text-white/50 text-sm mt-1">Entra con tu cuenta</p>
      </div>

      <Input
        label="Usuario"
        placeholder="tu_usuario"
        value={username}
        onChange={e => setUsername(e.target.value)}
        maxLength={20}
        onKeyDown={e => e.key === 'Enter' && handleSubmit()}
      />

      <div>
        <label className="font-body text-white/60 text-xs mb-1 block">Contraseña</label>
        <input
          type="password"
          placeholder="••••••"
          value={password}
          onChange={e => setPassword(e.target.value)}
          maxLength={64}
          onKeyDown={e => e.key === 'Enter' && handleSubmit()}
          className="w-full font-body text-white bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-green-500/50 transition-colors placeholder:text-white/20"
        />
      </div>

      {error && <p className="font-body text-red-400 text-sm text-center">{error}</p>}

      <button
        onClick={handleSubmit}
        disabled={!username.trim() || !password || loading}
        className="w-full font-body font-bold py-3.5 rounded-2xl text-white text-base transition-all hover:opacity-90 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
        style={{ background: 'linear-gradient(135deg, #22C55E, #16a34a)' }}
      >
        {loading ? 'Entrando...' : 'Entrar'}
      </button>

      <div className="flex flex-col items-center gap-2">
        <p className="font-body text-white/40 text-sm">
          ¿No tienes cuenta?{' '}
          <button onClick={onSwitchToRegister} className="text-green-400 hover:text-green-300 transition-colors">
            Regístrate
          </button>
        </p>
        {onForgotPassword && (
          <button onClick={onForgotPassword} className="font-body text-white/30 hover:text-white/50 text-xs transition-colors">
            ¿Olvidaste tu contraseña?
          </button>
        )}
      </div>
    </div>
  )
}

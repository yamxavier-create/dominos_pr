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
        <h2 className="font-chunky text-4xl leading-none mm-stroke !text-[#FDD04B]">Iniciar Sesión</h2>
        <p className="font-body text-white/50 text-sm mt-1">Entra con tu cuenta</p>
      </div>

      <Input
        label="Usuario o email"
        placeholder="tu_usuario o tu@email.com"
        value={username}
        onChange={e => setUsername(e.target.value)}
        maxLength={254}
        autoComplete="username"
        onKeyDown={e => e.key === 'Enter' && handleSubmit()}
      />

      <div>
        <label className="font-body font-extrabold text-white/85 text-sm mb-1 block">Contraseña</label>
        <input
          type="password"
          placeholder="••••••"
          value={password}
          onChange={e => setPassword(e.target.value)}
          maxLength={64}
          onKeyDown={e => e.key === 'Enter' && handleSubmit()}
          className="mm-input"
        />
      </div>

      {error && <p className="font-body text-red-400 text-sm text-center">{error}</p>}

      <button
        onClick={handleSubmit}
        disabled={!username.trim() || !password || loading}
        className="mm-btn-gold mm-stroke"
      >
        {loading ? 'Entrando...' : 'Entrar'}
      </button>

      <div className="flex flex-col items-center gap-2">
        <p className="font-body text-white/40 text-sm">
          ¿No tienes cuenta?{' '}
          <button onClick={onSwitchToRegister} className="font-extrabold text-[#FDD04B] hover:text-[#FDE68A] transition-colors">
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

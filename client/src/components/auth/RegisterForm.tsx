import { useState } from 'react'
import { Input } from '../ui/Input'

interface RegisterFormProps {
  onRegister: (username: string, password: string, displayName?: string) => Promise<void>
  onSwitchToLogin: () => void
  error: string | null
}

export function RegisterForm({ onRegister, onSwitchToLogin, error }: RegisterFormProps) {
  const [username, setUsername] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)

  const handleSubmit = async () => {
    setLocalError(null)
    if (!username.trim() || !password) return
    if (password !== confirmPassword) {
      setLocalError('Las contraseñas no coinciden')
      return
    }
    if (password.length < 6) {
      setLocalError('La contraseña debe tener al menos 6 caracteres')
      return
    }

    setLoading(true)
    try {
      await onRegister(username.trim(), password, displayName.trim() || undefined)
    } finally {
      setLoading(false)
    }
  }

  const displayError = localError || error

  return (
    <div className="flex flex-col gap-4 w-full">
      <div className="text-center">
        <h2 className="font-header text-4xl text-gold">Crear Cuenta</h2>
        <p className="font-body text-white/50 text-sm mt-1">Únete al dominó</p>
      </div>

      <Input
        label="Usuario"
        placeholder="tu_usuario"
        value={username}
        onChange={e => setUsername(e.target.value.replace(/[^a-zA-Z0-9_]/g, ''))}
        maxLength={20}
      />

      <Input
        label="Nombre para mostrar (opcional)"
        placeholder="Tu Nombre"
        value={displayName}
        onChange={e => setDisplayName(e.target.value)}
        maxLength={20}
      />

      <div>
        <label className="font-body text-white/60 text-xs mb-1 block">Contraseña</label>
        <input
          type="password"
          placeholder="Mínimo 6 caracteres"
          value={password}
          onChange={e => setPassword(e.target.value)}
          maxLength={64}
          className="w-full font-body text-white bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-green-500/50 transition-colors placeholder:text-white/20"
        />
      </div>

      <div>
        <label className="font-body text-white/60 text-xs mb-1 block">Confirmar contraseña</label>
        <input
          type="password"
          placeholder="Repite la contraseña"
          value={confirmPassword}
          onChange={e => setConfirmPassword(e.target.value)}
          maxLength={64}
          onKeyDown={e => e.key === 'Enter' && handleSubmit()}
          className="w-full font-body text-white bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-green-500/50 transition-colors placeholder:text-white/20"
        />
      </div>

      {displayError && <p className="font-body text-red-400 text-sm text-center">{displayError}</p>}

      <button
        onClick={handleSubmit}
        disabled={!username.trim() || !password || !confirmPassword || loading}
        className="w-full font-body font-bold py-3.5 rounded-2xl text-white text-base transition-all hover:opacity-90 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
        style={{ background: 'linear-gradient(135deg, #22C55E, #16a34a)' }}
      >
        {loading ? 'Creando...' : 'Crear Cuenta'}
      </button>

      <p className="font-body text-white/40 text-sm text-center">
        ¿Ya tienes cuenta?{' '}
        <button onClick={onSwitchToLogin} className="text-green-400 hover:text-green-300 transition-colors">
          Inicia sesión
        </button>
      </p>
    </div>
  )
}

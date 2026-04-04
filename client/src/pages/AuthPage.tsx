import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { LoginForm } from '../components/auth/LoginForm'
import { RegisterForm } from '../components/auth/RegisterForm'
import { GoogleLoginButton } from '../components/auth/GoogleLoginButton'
import { ForgotPasswordForm } from '../components/auth/ForgotPasswordForm'
import { useAuth } from '../hooks/useAuth'

type AuthView = 'login' | 'register' | 'forgot'

export function AuthPage() {
  const [view, setView] = useState<AuthView>('login')
  const [error, setError] = useState<string | null>(null)
  const { register, login, loginWithGoogle } = useAuth()
  const navigate = useNavigate()

  const handleLogin = async (username: string, password: string) => {
    setError(null)
    try {
      await login(username, password)
      navigate('/')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al iniciar sesión')
    }
  }

  const handleRegister = async (username: string, password: string, displayName?: string) => {
    setError(null)
    try {
      await register(username, password, displayName)
      navigate('/')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al registrar')
    }
  }

  const handleGoogleLogin = async (idToken: string) => {
    setError(null)
    try {
      await loginWithGoogle(idToken)
      navigate('/')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error con Google')
    }
  }

  return (
    <div className="min-h-dvh bg-felt flex flex-col items-center justify-center px-6 py-10">
      <div className="w-full max-w-sm flex flex-col gap-6">
        {/* Logo */}
        <div className="text-center mb-2">
          <div className="text-5xl mb-2" style={{ filter: 'drop-shadow(0 0 20px rgba(34,197,94,0.4))' }}>🁣</div>
          <h1
            className="font-header leading-none text-5xl"
            style={{
              color: '#EAB308',
              textShadow: '0 0 30px rgba(234,179,8,0.4), 0 2px 8px rgba(0,0,0,0.6)',
            }}
          >
            Dominó PR
          </h1>
        </div>

        {/* Auth Form */}
        {view === 'forgot' ? (
          <ForgotPasswordForm onBack={() => { setView('login'); setError(null) }} />
        ) : view === 'login' ? (
          <LoginForm
            onLogin={handleLogin}
            onSwitchToRegister={() => { setView('register'); setError(null) }}
            onForgotPassword={() => { setView('forgot'); setError(null) }}
            error={error}
          />
        ) : (
          <RegisterForm
            onRegister={handleRegister}
            onSwitchToLogin={() => { setView('login'); setError(null) }}
            error={error}
          />
        )}

        {/* Divider + Google (hide on forgot view) */}
        {view !== 'forgot' && (
          <>
            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-white/10" />
              <span className="font-body text-white/30 text-xs">o</span>
              <div className="flex-1 h-px bg-white/10" />
            </div>

            <GoogleLoginButton onGoogleLogin={handleGoogleLogin} />
          </>
        )}

        {/* Guest option */}
        <button
          onClick={() => navigate('/')}
          className="font-body text-white/40 hover:text-white/60 text-sm text-center transition-colors"
        >
          Continuar como invitado →
        </button>
      </div>
    </div>
  )
}

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { LoginForm } from '../components/auth/LoginForm'
import { RegisterForm } from '../components/auth/RegisterForm'
import { GoogleLoginButton } from '../components/auth/GoogleLoginButton'
import { ForgotPasswordForm } from '../components/auth/ForgotPasswordForm'
import { useAuth } from '../hooks/useAuth'
import { DominoTile } from '../components/domino/DominoTile'
import { GoldPlate, StageBackdrop } from '../components/ui/Escenario'

type AuthView = 'login' | 'register' | 'forgot'

export function AuthPage() {
  const [view, setView] = useState<AuthView>('login')
  const [error, setError] = useState<string | null>(null)
  const [sentTo, setSentTo] = useState<string | null>(null)
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

  const handleRegister = async (username: string, password: string, displayName?: string, email?: string) => {
    setError(null)
    try {
      const pendingEmail = await register(username, password, displayName, email)
      if (pendingEmail) setSentTo(pendingEmail)
      else navigate('/')
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

  if (sentTo) {
    return (
      <div className="fixed inset-0 felt-table flex items-center justify-center p-4">
        <StageBackdrop still />
        <div className="mm-pop relative menu-card text-center max-w-xs">
          <h2 className="font-chunky text-2xl mm-stroke !text-[#FDD04B] mb-3">Revisa tu email</h2>
          <p className="font-body text-white/60 text-sm mb-4">
            Te enviamos un enlace a <span className="text-white">{sentTo}</span>. Tu email se guarda cuando lo confirmes.
          </p>
          <button onClick={() => navigate('/')} className="mm-btn-gold mm-stroke">
            Continuar
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 felt-table flex flex-col items-center px-5 py-6 overflow-y-auto">
      <StageBackdrop />
      {/* my-auto: centered when it fits, scrolls from the top when the register form is taller than the screen */}
      <div className="relative my-auto w-full max-w-sm flex flex-col gap-5">
        {/* Logo: the double six floating over the name plate */}
        <div className="mm-drop flex flex-col items-center">
          <div className="mm-float w-14 -mb-3 relative z-10" style={{ filter: 'drop-shadow(0 10px 14px rgba(0,0,0,0.5))' }}>
            <DominoTile pip1={6} pip2={6} orientation="vertical" style={{ width: '100%', height: 'auto' }} />
          </div>
          <GoldPlate className="w-[78%]">
            <h1 className="font-chunky text-[2.1rem] leading-none mm-stroke tracking-wide">Dominó PR</h1>
          </GoldPlate>
        </div>

        <div className="mm-rise menu-card flex flex-col gap-5">
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
              <div className="flex-1 h-0.5 rounded bg-[#EAB308]/30" />
              <span className="font-chunky text-[#FDE68A] text-sm">o</span>
              <div className="flex-1 h-0.5 rounded bg-[#EAB308]/30" />
            </div>

            <GoogleLoginButton onGoogleLogin={handleGoogleLogin} />
          </>
        )}

        </div>

        {/* Guest option */}
        <button
          onClick={() => navigate('/')}
          className="font-chunky text-base text-center mm-stroke tracking-wide"
        >
          Continuar como invitado ›
        </button>
      </div>
    </div>
  )
}

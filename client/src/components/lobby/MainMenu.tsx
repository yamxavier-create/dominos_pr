import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { GameMode } from '../../types/game'
import { Input } from '../ui/Input'
import { useRoomStore } from '../../store/roomStore'
import { useAuthStore } from '../../store/authStore'
import { useGameActions } from '../../hooks/useGameActions'

type View = 'home' | 'create' | 'join'

const GreenBtn = ({ children, onClick, disabled }: { children: React.ReactNode; onClick?: () => void; disabled?: boolean }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className="w-full font-body font-bold py-3.5 rounded-2xl text-white text-base transition-all hover:opacity-90 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
    style={{ background: 'linear-gradient(135deg, #22C55E, #16a34a)' }}
  >
    {children}
  </button>
)

const OutlineBtn = ({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) => (
  <button
    onClick={onClick}
    className="w-full font-body font-bold py-3.5 rounded-2xl text-white text-base transition-all hover:bg-white/10 active:scale-95"
    style={{ border: '1.5px solid rgba(255,255,255,0.20)' }}
  >
    {children}
  </button>
)

export function MainMenu() {
  const [view, setView] = useState<View>('home')
  const { isAuthenticated, user } = useAuthStore()
  const [playerName, setPlayerName] = useState(user?.displayName || '')
  const [roomCode, setRoomCode] = useState('')
  const [selectedMode, setSelectedMode] = useState<GameMode>('modo200')
  const navigate = useNavigate()

  const { createRoom, joinRoom } = useGameActions()
  const error = useRoomStore(s => s.error)
  const { clearError } = useRoomStore()

  // Auto-fill name when user logs in
  const effectiveName = playerName || user?.displayName || ''

  const handleCreate = () => {
    if (!playerName.trim()) return
    clearError()
    createRoom(playerName.trim(), selectedMode)
  }

  const handleJoin = () => {
    if (!playerName.trim() || !roomCode.trim()) return
    clearError()
    joinRoom(roomCode.trim().toUpperCase(), playerName.trim())
  }

  if (view === 'create') {
    return (
      <div className="flex flex-col gap-5 w-full max-w-sm">
        <button
          onClick={() => { setView('home'); clearError() }}
          className="font-body text-white/40 hover:text-white/70 text-sm self-start transition-colors"
        >
          ← Volver
        </button>

        <div className="text-center">
          <h2 className="font-header text-4xl text-gold">Crear Sala</h2>
          <p className="font-body text-white/50 text-sm mt-1">Elige el modo de juego</p>
        </div>

        <Input
          label="Tu nombre"
          placeholder="Jugador"
          value={playerName}
          onChange={e => setPlayerName(e.target.value)}
          maxLength={16}
          onKeyDown={e => e.key === 'Enter' && handleCreate()}
        />

        {/* Mode selector */}
        <div className="flex gap-3">
          {(['modo200', 'modo500'] as GameMode[]).map(mode => {
            const active = selectedMode === mode
            return (
              <button
                key={mode}
                onClick={() => setSelectedMode(mode)}
                className="flex-1 rounded-2xl p-4 text-center transition-all"
                style={{
                  background: active ? 'rgba(34,197,94,0.15)' : 'rgba(255,255,255,0.04)',
                  border: `1.5px solid ${active ? '#22C55E' : 'rgba(255,255,255,0.12)'}`,
                }}
              >
                <p className="font-header text-2xl text-gold">{mode === 'modo200' ? 'M·200' : 'M·500'}</p>
                <p className="font-body text-white/60 text-xs mt-1">
                  {mode === 'modo200' ? 'Hasta 20 pts' : 'Hasta 500 pts'}
                </p>
                <p className="font-body text-white/35 text-xs">
                  {mode === 'modo200' ? 'Bonus por pase' : 'Capicú + Chuchazo'}
                </p>
              </button>
            )
          })}
        </div>

        {error && <p className="font-body text-accent text-sm text-center">{error}</p>}

        <GreenBtn onClick={handleCreate} disabled={!playerName.trim()}>
          Crear Sala
        </GreenBtn>
      </div>
    )
  }

  if (view === 'join') {
    return (
      <div className="flex flex-col gap-5 w-full max-w-sm">
        <button
          onClick={() => { setView('home'); clearError() }}
          className="font-body text-white/40 hover:text-white/70 text-sm self-start transition-colors"
        >
          ← Volver
        </button>

        <div className="text-center">
          <h2 className="font-header text-4xl text-gold">Unirse a Sala</h2>
          <p className="font-body text-white/50 text-sm mt-1">Ingresa el código de sala</p>
        </div>

        <Input
          label="Tu nombre"
          placeholder="Jugador"
          value={playerName}
          onChange={e => setPlayerName(e.target.value)}
          maxLength={16}
        />

        <Input
          label="Código de sala"
          placeholder="COQUI-1234"
          value={roomCode}
          onChange={e => setRoomCode(e.target.value.toUpperCase())}
          maxLength={10}
          onKeyDown={e => e.key === 'Enter' && handleJoin()}
        />

        {error && <p className="font-body text-accent text-sm text-center">{error}</p>}

        <GreenBtn onClick={handleJoin} disabled={!playerName.trim() || !roomCode.trim()}>
          Unirse
        </GreenBtn>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center gap-10 w-full max-w-sm">
      {/* User badge (logged in) or login link */}
      {isAuthenticated && user ? (
        <div className="w-full flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-green-500/20 border border-green-500/40 flex items-center justify-center text-xs font-bold text-green-400">
              {user.displayName[0]?.toUpperCase()}
            </div>
            <span className="font-body text-white/70 text-sm">{user.displayName}</span>
          </div>
          <button
            onClick={() => navigate('/auth')}
            className="font-body text-white/30 hover:text-white/50 text-xs transition-colors"
          >
            Cambiar cuenta
          </button>
        </div>
      ) : (
        <button
          onClick={() => navigate('/auth')}
          className="font-body text-green-400/70 hover:text-green-400 text-sm transition-colors"
        >
          Iniciar sesión / Crear cuenta
        </button>
      )}

      {/* Logo */}
      <div className="text-center">
        <div className="text-7xl mb-4" style={{ filter: 'drop-shadow(0 0 20px rgba(34,197,94,0.4))' }}>🁣</div>
        <h1
          className="font-header leading-none"
          style={{
            fontSize: '4.5rem',
            color: '#EAB308',
            textShadow: '0 0 30px rgba(234,179,8,0.4), 0 2px 8px rgba(0,0,0,0.6)',
          }}
        >
          Dominó PR
        </h1>
        <p className="font-body mt-2 text-base" style={{ color: '#22C55E' }}>
          Doble Seis Puertorriqueño
        </p>
      </div>

      <div className="flex flex-col gap-3 w-full">
        <GreenBtn onClick={() => setView('create')}>Crear Sala</GreenBtn>
        <OutlineBtn onClick={() => setView('join')}>Unirse a Sala</OutlineBtn>
      </div>

      <p className="font-body text-white/20 text-xs text-center">
        4 jugadores · Equipos · En línea
      </p>
    </div>
  )
}

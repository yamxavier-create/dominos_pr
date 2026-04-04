import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { GameMode } from '../../types/game'
import { Input } from '../ui/Input'
import { useRoomStore } from '../../store/roomStore'
import { useAuthStore } from '../../store/authStore'
import { useGameActions } from '../../hooks/useGameActions'
import { ProfileSection } from '../auth/ProfileSection'
import { SocialPanel } from '../social/SocialPanel'
import { useSocialStore } from '../../store/socialStore'

type View = 'home' | 'create' | 'join'

const GreenBtn = ({ children, onClick, disabled }: { children: React.ReactNode; onClick?: () => void; disabled?: boolean }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className="w-full font-body font-bold py-3 sm:py-4 rounded-2xl text-white text-base sm:text-lg active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed btn-glow"
  >
    {children}
  </button>
)

const OutlineBtn = ({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) => (
  <button
    onClick={onClick}
    className="w-full font-body font-bold py-3 sm:py-4 rounded-2xl text-white text-base sm:text-lg active:scale-95 btn-outline-shine"
  >
    {children}
  </button>
)

/* Decorative SVG domino tile — replaces the emoji for a polished look */
function DominoLogo() {
  return (
    <svg width="72" height="72" viewBox="0 0 72 72" fill="none" xmlns="http://www.w3.org/2000/svg"
      style={{ filter: 'drop-shadow(0 0 24px rgba(34,197,94,0.35))' }}
    >
      {/* Tile body — rotated 12deg for dynamism */}
      <g transform="rotate(-12 36 36)">
        <rect x="14" y="4" width="44" height="64" rx="6" fill="#FFFBF0" stroke="#8899aa" strokeWidth="1.5" />
        {/* Center divider */}
        <line x1="18" y1="36" x2="54" y2="36" stroke="#bbb" strokeWidth="1" />
        {/* Top pips: 6 */}
        <circle cx="24" cy="14" r="3.5" fill="#1a1a2e" />
        <circle cx="24" cy="22" r="3.5" fill="#1a1a2e" />
        <circle cx="24" cy="30" r="3.5" fill="#1a1a2e" />
        <circle cx="48" cy="14" r="3.5" fill="#1a1a2e" />
        <circle cx="48" cy="22" r="3.5" fill="#1a1a2e" />
        <circle cx="48" cy="30" r="3.5" fill="#1a1a2e" />
        {/* Bottom pips: 5 */}
        <circle cx="24" cy="44" r="3.5" fill="#1a1a2e" />
        <circle cx="24" cy="58" r="3.5" fill="#1a1a2e" />
        <circle cx="48" cy="44" r="3.5" fill="#1a1a2e" />
        <circle cx="48" cy="58" r="3.5" fill="#1a1a2e" />
        <circle cx="36" cy="51" r="3.5" fill="#1a1a2e" />
      </g>
    </svg>
  )
}

export function MainMenu() {
  const [view, setView] = useState<View>('home')
  const [showSocial, setShowSocial] = useState(false)
  const { isAuthenticated, user } = useAuthStore()
  const incomingRequestCount = useSocialStore((s) => s.requests.filter((r) => r.direction === 'incoming').length)
  const [playerName, setPlayerName] = useState(user?.displayName || '')
  const [roomCode, setRoomCode] = useState('')
  const [selectedMode, setSelectedMode] = useState<GameMode>('modo200')
  const navigate = useNavigate()

  const { createRoom, joinRoom } = useGameActions()
  const error = useRoomStore(s => s.error)
  const { clearError } = useRoomStore()

  // Auto-fill name when user logs in (user may load after mount)
  useEffect(() => {
    if (user?.displayName && !playerName) {
      setPlayerName(user.displayName)
    }
  }, [user?.displayName])

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
      <div className="menu-card menu-reveal flex flex-col gap-4 sm:gap-5 w-full max-w-xs sm:max-w-sm md:max-w-md">
        <button
          onClick={() => { setView('home'); clearError() }}
          className="font-body text-white/40 hover:text-white/70 text-sm self-start transition-colors"
        >
          ← Volver
        </button>

        <div className="text-center">
          <h2 className="font-header text-3xl sm:text-4xl text-gold tracking-wide">Crear Sala</h2>
          <p className="font-body text-white/50 text-xs sm:text-sm mt-1">Elige el modo de juego</p>
        </div>

        <div className="gold-divider" />

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
                  background: active ? 'rgba(34,197,94,0.12)' : 'rgba(255,255,255,0.03)',
                  border: `1.5px solid ${active ? '#22C55E' : 'rgba(255,255,255,0.10)'}`,
                  boxShadow: active ? '0 0 16px rgba(34,197,94,0.15), inset 0 1px 0 rgba(255,255,255,0.05)' : 'inset 0 1px 0 rgba(255,255,255,0.03)',
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
      <div className="menu-card menu-reveal flex flex-col gap-4 sm:gap-5 w-full max-w-xs sm:max-w-sm md:max-w-md">
        <button
          onClick={() => { setView('home'); clearError() }}
          className="font-body text-white/40 hover:text-white/70 text-sm self-start transition-colors"
        >
          ← Volver
        </button>

        <div className="text-center">
          <h2 className="font-header text-3xl sm:text-4xl text-gold tracking-wide">Unirse a Sala</h2>
          <p className="font-body text-white/50 text-xs sm:text-sm mt-1">Ingresa el código de sala</p>
        </div>

        <div className="gold-divider" />

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

  if (showSocial && isAuthenticated) {
    return (
      <div className="flex flex-col items-center w-full max-w-xs sm:max-w-sm md:max-w-md">
        <SocialPanel onClose={() => setShowSocial(false)} />
      </div>
    )
  }

  return (
    <div className="menu-card menu-reveal flex flex-col items-center gap-6 sm:gap-8 w-full max-w-xs sm:max-w-sm md:max-w-md">
      {/* Top bar: profile pill + social icon */}
      {isAuthenticated && user ? (
        <div className="w-full flex items-center justify-between">
          {/* Profile pill — avatar + name */}
          <ProfileSection />

          {/* Right cluster: friends icon */}
          <button
            onClick={() => setShowSocial(true)}
            className="relative w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center transition-colors hover:bg-white/10"
            style={{ border: '1.5px solid rgba(255,255,255,0.15)' }}
            title="Amigos"
          >
            <svg className="w-[18px] h-[18px] sm:w-[22px] sm:h-[22px]" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
            {incomingRequestCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-primary text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                {incomingRequestCount}
              </span>
            )}
          </button>
        </div>
      ) : (
        <button
          onClick={() => navigate('/auth')}
          className="font-body text-green-400/70 hover:text-green-400 text-sm sm:text-base transition-colors"
        >
          Iniciar sesion / Crear cuenta
        </button>
      )}

      {/* Logo */}
      <div className="text-center flex flex-col items-center">
        <DominoLogo />
        <h1
          className="font-header leading-none text-[3.5rem] sm:text-[4.5rem] md:text-[5.5rem] mt-3"
          style={{
            color: '#EAB308',
            textShadow: '0 0 40px rgba(234,179,8,0.3), 0 2px 8px rgba(0,0,0,0.6)',
            letterSpacing: '0.04em',
          }}
        >
          Dominó PR
        </h1>
        <p className="font-body mt-1.5 sm:mt-2 text-sm sm:text-base tracking-widest uppercase" style={{ color: '#22C55E', letterSpacing: '0.2em' }}>
          Doble Seis
        </p>
      </div>

      <div className="gold-divider w-full" />

      <div className="flex flex-col gap-2.5 sm:gap-3 w-full">
        <GreenBtn onClick={() => setView('create')}>Crear Sala</GreenBtn>
        <OutlineBtn onClick={() => setView('join')}>Unirse a Sala</OutlineBtn>
        {isAuthenticated && (
          <button
            onClick={() => navigate('/stats')}
            className="w-full font-body text-sm py-2.5 rounded-xl text-white/50 hover:text-white/70 transition-all hover:bg-white/5"
            style={{ border: '1px solid rgba(255,255,255,0.08)' }}
          >
            📊 Estadísticas y Ranking
          </button>
        )}
      </div>

      <div className="flex flex-col items-center gap-1">
        <p className="font-body text-white/25 text-[10px] sm:text-xs text-center tracking-wider">
          4 jugadores · Equipos · En línea
        </p>
        <div className="flex gap-3 font-body text-white/20 text-[10px]">
          <Link to="/privacy" className="hover:text-white/40 transition-colors">Privacidad</Link>
          <span>·</span>
          <Link to="/terms" className="hover:text-white/40 transition-colors">Términos</Link>
        </div>
      </div>
    </div>
  )
}

import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { GameMode } from '../../types/game'
import { Input } from '../ui/Input'
import { useRoomStore } from '../../store/roomStore'
import { useAuthStore, AuthUser } from '../../store/authStore'
import { useGameActions } from '../../hooks/useGameActions'
import { useAuth } from '../../hooks/useAuth'
import { useUIStore } from '../../store/uiStore'
import { SocialPanel } from '../social/SocialPanel'
import { useSocialStore } from '../../store/socialStore'
import { DominoTile } from '../domino/DominoTile'
import { GoldCTA, GoldCaption, Starburst as SharedStarburst } from '../ui/GoldCTA'

type View = 'home' | 'create' | 'join'

/* Avatar pill for logged-in users — avatar circle + name */
function ProfilePill({ user, onClick }: { user: AuthUser; onClick: () => void }) {
  const initial = user.displayName[0]?.toUpperCase() ?? '?'
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2.5 pr-4 pl-1 py-1 rounded-full active:scale-95 transition-transform"
      style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
    >
      {user.avatarUrl ? (
        <img src={user.avatarUrl} alt={user.displayName} className="w-9 h-9 rounded-full object-cover" referrerPolicy="no-referrer" />
      ) : (
        <div
          className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-white"
          style={{ background: 'linear-gradient(135deg, #22C55E, #16a34a)' }}
        >
          {initial}
        </div>
      )}
      <span className="font-body text-white text-sm font-semibold truncate max-w-[110px]">{user.displayName}</span>
    </button>
  )
}

/* Settings gear — opens a dropdown with audio + account options */
function SettingsButton({ onClick, open }: { onClick: () => void; open: boolean }) {
  return (
    <button
      onClick={onClick}
      aria-label="Ajustes"
      className="w-10 h-10 rounded-full flex items-center justify-center active:scale-95 transition-transform"
      style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.10)' }}
    >
      <svg
        className={`w-5 h-5 transition-transform duration-300 ${open ? 'rotate-45' : ''}`}
        viewBox="0 0 24 24"
        fill="none"
        stroke="rgba(255,255,255,0.75)"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
      </svg>
    </button>
  )
}

/* Dropdown rendered from the gear button */
function SettingsDropdown({ onClose }: { onClose: () => void }) {
  const sfxEnabled = useUIStore(s => s.sfxEnabled)
  const musicEnabled = useUIStore(s => s.musicEnabled)
  const toggleSfx = useUIStore(s => s.toggleSfx)
  const toggleMusic = useUIStore(s => s.toggleMusic)
  const { user } = useAuthStore()
  const { logout } = useAuth()
  const [editing, setEditing] = useState(false)

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div
        className="absolute top-14 right-0 z-50 w-60 rounded-2xl py-2 shadow-2xl"
        style={{ background: 'rgba(15,35,24,0.96)', border: '1px solid rgba(255,255,255,0.10)', backdropFilter: 'blur(16px)' }}
      >
        {user && (
          <div className="px-4 pt-1 pb-2 border-b border-white/10 mb-1">
            <p className="font-body text-white text-sm font-semibold truncate">{user.displayName}</p>
            <p className="font-body text-white/40 text-[11px]">{user.email}</p>
          </div>
        )}

        <div className="px-2">
          <ToggleRow label="Sonido" enabled={sfxEnabled} onToggle={toggleSfx} />
          <ToggleRow label="Música" enabled={musicEnabled} onToggle={toggleMusic} />
        </div>

        {user && (
          <>
            <div className="h-px bg-white/10 my-1 mx-2" />
            <button
              onClick={() => { setEditing(true); onClose() }}
              className="w-full text-left px-4 py-2 font-body text-white/75 hover:bg-white/5 text-sm rounded-lg"
            >
              Editar nombre
            </button>
            <button
              onClick={() => { logout(); onClose() }}
              className="w-full text-left px-4 py-2 font-body text-red-400/80 hover:bg-white/5 text-sm rounded-lg"
            >
              Cerrar sesión
            </button>
          </>
        )}
      </div>

      {editing && user && <EditNameModal onClose={() => setEditing(false)} />}
    </>
  )
}

function ToggleRow({ label, enabled, onToggle }: { label: string; enabled: boolean; onToggle: () => void }) {
  return (
    <button onClick={onToggle} className="w-full flex items-center justify-between px-2 py-2 rounded-lg hover:bg-white/5">
      <span className="font-body text-white/80 text-sm">{label}</span>
      <span
        className="relative inline-flex w-10 h-6 rounded-full transition-colors"
        style={{ background: enabled ? '#22C55E' : 'rgba(255,255,255,0.15)' }}
      >
        <span
          className="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all"
          style={{ left: enabled ? '18px' : '2px' }}
        />
      </span>
    </button>
  )
}

function EditNameModal({ onClose }: { onClose: () => void }) {
  const { user } = useAuthStore()
  const { updateProfile } = useAuth()
  const [name, setName] = useState(user?.displayName ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const save = async () => {
    const trimmed = name.trim()
    if (!trimmed || trimmed === user?.displayName) { onClose(); return }
    setSaving(true)
    setError(null)
    try {
      await updateProfile(trimmed)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={onClose}>
      <div
        className="w-full max-w-xs rounded-2xl p-5"
        style={{ background: '#0F2318', border: '1px solid rgba(255,255,255,0.10)' }}
        onClick={e => e.stopPropagation()}
      >
        <p className="font-body text-white/60 text-xs mb-2 uppercase tracking-wider">Tu nombre</p>
        <input
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') onClose() }}
          maxLength={20}
          autoFocus
          className="w-full font-body text-white bg-white/5 border border-white/15 rounded-xl px-3 py-2 outline-none focus:border-primary/60"
        />
        {error && <p className="font-body text-accent text-xs mt-2">{error}</p>}
        <div className="flex gap-2 mt-4">
          <button onClick={onClose} className="flex-1 font-body text-white/60 py-2.5 rounded-xl hover:bg-white/5 text-sm">Cancelar</button>
          <button
            onClick={save}
            disabled={saving || !name.trim()}
            className="flex-1 font-body text-white font-bold py-2.5 rounded-xl disabled:opacity-50 text-sm"
            style={{ background: 'linear-gradient(135deg, #22C55E, #16a34a)' }}
          >
            {saving ? '...' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  )
}

/* Sparkle dots scattered around the hero */
function SparkleDots() {
  const dots = [
    { top: '35%', left: '8%', color: '#22C55E', size: 6 },
    { top: '70%', left: '18%', color: '#EAB308', size: 4 },
    { top: '50%', right: '10%', color: '#EAB308', size: 5 },
    { top: '78%', right: '22%', color: '#F97316', size: 5 },
    { top: '22%', right: '22%', color: '#EAB308', size: 3 },
  ]
  return (
    <>
      {dots.map((d, i) => (
        <span
          key={i}
          className="absolute rounded-full"
          style={{
            top: d.top,
            left: d.left,
            right: d.right,
            width: d.size,
            height: d.size,
            background: d.color,
            boxShadow: `0 0 ${d.size * 2}px ${d.color}`,
            opacity: 0.85,
          }}
        />
      ))}
    </>
  )
}

/* Three floating dominoes: center upright 6|6, flanked by tilted tiles */
function FloatingDominoes() {
  return (
    <div className="relative w-full h-full flex items-center justify-center">
      <div
        className="absolute"
        style={{
          transform: 'translate(-58%, 8%) rotate(-18deg)',
          filter: 'drop-shadow(0 10px 18px rgba(0,0,0,0.5))',
          width: '34%',
        }}
      >
        <DominoTile pip1={5} pip2={3} orientation="vertical" style={{ width: '100%', height: 'auto' }} />
      </div>
      <div
        className="absolute"
        style={{
          transform: 'translate(0%, -6%)',
          filter: 'drop-shadow(0 14px 22px rgba(0,0,0,0.6))',
          width: '42%',
        }}
      >
        <DominoTile pip1={6} pip2={6} orientation="vertical" style={{ width: '100%', height: 'auto' }} />
      </div>
      <div
        className="absolute"
        style={{
          transform: 'translate(58%, 14%) rotate(16deg)',
          filter: 'drop-shadow(0 10px 18px rgba(0,0,0,0.5))',
          width: '32%',
        }}
      >
        <DominoTile pip1={5} pip2={4} orientation="vertical" style={{ width: '100%', height: 'auto' }} />
      </div>
    </div>
  )
}

/* Small action card — icon + label + optional badge */
function ActionCard({ icon, label, badge, onClick }: { icon: string; label: string; badge?: number; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="relative rounded-2xl py-3 px-2 flex flex-col items-center gap-1.5 active:scale-95 transition-transform"
      style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
    >
      <span className="text-2xl leading-none">{icon}</span>
      <span className="font-body text-white/80 text-xs font-bold tracking-wider">{label}</span>
      {badge !== undefined && badge > 0 && (
        <span
          className="absolute -top-1.5 -right-1.5 min-w-[20px] h-5 px-1.5 rounded-full flex items-center justify-center text-[11px] font-bold text-white"
          style={{ background: '#F97316', boxShadow: '0 0 10px rgba(249,115,22,0.5)' }}
        >
          {badge}
        </span>
      )}
    </button>
  )
}

export function MainMenu() {
  const [view, setView] = useState<View>('home')
  const [showSocial, setShowSocial] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const { isAuthenticated, user } = useAuthStore()
  const incomingRequestCount = useSocialStore((s) => s.requests.filter((r) => r.direction === 'incoming').length)
  const [playerName, setPlayerName] = useState(user?.displayName || '')
  const [roomCode, setRoomCode] = useState('')
  const [selectedMode, setSelectedMode] = useState<GameMode>('modo200')
  const navigate = useNavigate()

  const { createRoom, joinRoom } = useGameActions()
  const error = useRoomStore(s => s.error)
  const { clearError } = useRoomStore()

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

  const handleQuickPlay = () => {
    const name = (playerName.trim() || user?.displayName?.trim() || '')
    if (!name) { setView('create'); return }
    clearError()
    createRoom(name, 'modo200')
  }

  if (view === 'create') {
    return (
      <div className="menu-reveal flex flex-col gap-4 sm:gap-5 w-full max-w-xs sm:max-w-sm md:max-w-md">
        <button
          onClick={() => { setView('home'); clearError() }}
          className="font-body text-white/40 hover:text-white/70 text-sm self-start transition-colors"
        >
          ← Volver
        </button>

        <div className="text-center flex flex-col items-center gap-1.5">
          <GoldCaption>Crear Sala</GoldCaption>
          <h2
            className="font-header text-white leading-[0.9] text-4xl sm:text-5xl"
            style={{ letterSpacing: '0.02em', textShadow: '0 2px 8px rgba(0,0,0,0.5)' }}
          >
            Nueva Mesa
          </h2>
          <p className="font-body text-white/50 text-xs sm:text-sm">Elige el modo de juego</p>
        </div>

        <Input
          label="Tu nombre"
          placeholder="Jugador"
          value={playerName}
          onChange={e => setPlayerName(e.target.value)}
          maxLength={16}
          onKeyDown={e => e.key === 'Enter' && handleCreate()}
        />

        <div className="flex gap-3">
          {(['modo200', 'modo500'] as GameMode[]).map(mode => {
            const active = selectedMode === mode
            return (
              <button
                key={mode}
                onClick={() => setSelectedMode(mode)}
                className="flex-1 rounded-2xl p-4 text-center transition-all active:scale-[0.98]"
                style={{
                  background: active ? 'rgba(234,179,8,0.10)' : 'rgba(255,255,255,0.03)',
                  border: `1.5px solid ${active ? '#EAB308' : 'rgba(255,255,255,0.10)'}`,
                  boxShadow: active ? '0 0 20px rgba(234,179,8,0.20), inset 0 1px 0 rgba(255,255,255,0.08)' : 'inset 0 1px 0 rgba(255,255,255,0.03)',
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

        <GoldCTA onClick={handleCreate} disabled={!playerName.trim()} size="md">
          CREAR SALA
        </GoldCTA>
      </div>
    )
  }

  if (view === 'join') {
    return (
      <div className="menu-reveal flex flex-col gap-4 sm:gap-5 w-full max-w-xs sm:max-w-sm md:max-w-md">
        <button
          onClick={() => { setView('home'); clearError() }}
          className="font-body text-white/40 hover:text-white/70 text-sm self-start transition-colors"
        >
          ← Volver
        </button>

        <div className="text-center flex flex-col items-center gap-1.5">
          <GoldCaption>Unirse a Sala</GoldCaption>
          <h2
            className="font-header text-white leading-[0.9] text-4xl sm:text-5xl"
            style={{ letterSpacing: '0.02em', textShadow: '0 2px 8px rgba(0,0,0,0.5)' }}
          >
            Ingresa Código
          </h2>
          <p className="font-body text-white/50 text-xs sm:text-sm">Te invitaron a una mesa</p>
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

        <GoldCTA onClick={handleJoin} disabled={!playerName.trim() || !roomCode.trim()} size="md">
          UNIRSE
        </GoldCTA>
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
    <div className="relative flex flex-col w-full max-w-sm mx-auto h-full min-h-[600px]">
      {/* Top bar */}
      <div className="flex items-center justify-between w-full">
        {isAuthenticated && user ? (
          <ProfilePill user={user} onClick={() => setShowSettings(true)} />
        ) : (
          <button
            onClick={() => navigate('/auth')}
            className="font-body text-white/80 hover:text-white text-sm px-4 py-2 rounded-full"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.10)' }}
          >
            Iniciar sesión
          </button>
        )}
        <div className="relative">
          <SettingsButton onClick={() => setShowSettings(s => !s)} open={showSettings} />
          {showSettings && <SettingsDropdown onClose={() => setShowSettings(false)} />}
        </div>
      </div>

      {/* Hero */}
      <div className="flex-1 flex flex-col items-center justify-center relative py-4 sm:py-6">
        <div className="mb-1.5">
          <GoldCaption>Mesa de la Isla</GoldCaption>
        </div>
        <h1
          className="font-header text-white leading-[0.88] text-[3.2rem] sm:text-[4rem]"
          style={{ letterSpacing: '0.015em', textShadow: '0 2px 8px rgba(0,0,0,0.6)' }}
        >
          DOMINÓ
        </h1>
        <h1
          className="font-header leading-[0.88] text-[3.8rem] sm:text-[5rem] mt-1"
          style={{
            color: '#EAB308',
            letterSpacing: '0.05em',
            textShadow: '0 0 60px rgba(234,179,8,0.4), 0 2px 8px rgba(0,0,0,0.6)',
          }}
        >
          PR
        </h1>

        {/* Dominoes scene */}
        <div className="relative mt-2 sm:mt-4 w-full max-w-[300px] aspect-[6/5] flex items-center justify-center">
          <SharedStarburst />
          <SparkleDots />
          <FloatingDominoes />
        </div>
      </div>

      {/* Big CTA */}
      <div className="mb-2.5">
        <GoldCTA onClick={handleQuickPlay} subtitle="Crear sala rápida">
          JUGAR
        </GoldCTA>
      </div>

      {/* 3-button grid */}
      <div className="grid grid-cols-3 gap-2">
        <ActionCard icon="🔑" label="CREAR" onClick={() => setView('create')} />
        <ActionCard icon="🎟️" label="CÓDIGO" onClick={() => setView('join')} />
        <ActionCard
          icon="👥"
          label="AMIGOS"
          badge={incomingRequestCount}
          onClick={() => isAuthenticated ? setShowSocial(true) : navigate('/auth')}
        />
      </div>

      {/* Stats / footer links */}
      <div className="flex flex-col items-center gap-1 mt-3 pt-1">
        {isAuthenticated && (
          <button
            onClick={() => navigate('/stats')}
            className="font-body text-white/40 hover:text-white/70 text-xs transition-colors"
          >
            📊 Estadísticas y Ranking
          </button>
        )}
        <div className="flex gap-3 font-body text-white/20 text-[10px]">
          <Link to="/privacy" className="hover:text-white/40 transition-colors">Privacidad</Link>
          <span>·</span>
          <Link to="/terms" className="hover:text-white/40 transition-colors">Términos</Link>
        </div>
      </div>
    </div>
  )
}

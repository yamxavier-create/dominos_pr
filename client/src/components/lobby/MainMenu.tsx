import { useState, useEffect, type ReactNode } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { GameMode } from '../../types/game'
import { MODE_NAMES, MODE_SHORT, MODE_SUMMARY } from '../../rules'
import { Input } from '../ui/Input'
import { useRoomStore } from '../../store/roomStore'
import { useAuthStore, AuthUser } from '../../store/authStore'
import { useGameActions } from '../../hooks/useGameActions'
import { useAuth } from '../../hooks/useAuth'
import { useUIStore } from '../../store/uiStore'
import { SocialPanel } from '../social/SocialPanel'
import { useSocialStore } from '../../store/socialStore'
import { DominoTile } from '../domino/DominoTile'
import { GoldCTA, GoldCaption } from '../ui/GoldCTA'
import { INK, StageBackdrop } from '../ui/Escenario'

type View = 'home' | 'create' | 'join'

/* Dropdown rendered from the gear button */
function SettingsDropdown({ onClose }: { onClose: () => void }) {
  const sfxEnabled = useUIStore(s => s.sfxEnabled)
  const musicEnabled = useUIStore(s => s.musicEnabled)
  const toggleSfx = useUIStore(s => s.toggleSfx)
  const toggleMusic = useUIStore(s => s.toggleMusic)
  const { user } = useAuthStore()
  const { logout } = useAuth()
  const [editing, setEditing] = useState<ProfileField | null>(null)

  // The modal lives inside this dropdown, so keep it mounted and hide the menu instead of closing
  if (editing && user) {
    return <EditProfileModal field={editing} onClose={() => { setEditing(null); onClose() }} />
  }

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div
        className="mm-pop mm-panel absolute top-16 right-0 z-50 w-60 !rounded-2xl py-2"
      >
        {user && (
          <div className="px-4 pt-1 pb-2 border-b-2 border-[#06140B] mb-1">
            <p className="font-chunky text-[#FDD04B] text-base tracking-wide truncate">{user.displayName}</p>
            {user.email && (
              <p className="font-body font-bold text-white/70 text-[11px] truncate">
                {user.email}{user.emailVerified === false && ' · sin confirmar'}
              </p>
            )}
            {user.pendingEmail && user.pendingEmail !== user.email && (
              <p className="font-body font-bold text-[#FDE68A] text-[11px] leading-snug mt-0.5">Confirma {user.pendingEmail} desde tu correo</p>
            )}
          </div>
        )}

        <div className="px-2">
          <ToggleRow label="Sonido" enabled={sfxEnabled} onToggle={toggleSfx} />
          <ToggleRow label="Música" enabled={musicEnabled} onToggle={toggleMusic} />
        </div>

        {user && (
          <>
            <div className="h-0.5 bg-[#06140B] my-1 mx-2 rounded" />
            <button
              onClick={() => setEditing('displayName')}
              className="w-full text-left px-4 py-2 font-body font-extrabold text-white/85 hover:bg-black/20 text-sm rounded-lg"
            >
              Editar nombre
            </button>
            <button
              onClick={() => setEditing('email')}
              className="w-full text-left px-4 py-2 font-body font-extrabold text-white/85 hover:bg-black/20 text-sm rounded-lg"
            >
              {user.email ? 'Cambiar email' : 'Agregar email'}
            </button>
            <button
              onClick={() => { logout(); onClose() }}
              className="w-full text-left px-4 py-2 font-body font-extrabold text-[#FF8A80] hover:bg-black/20 text-sm rounded-lg"
            >
              Cerrar sesión
            </button>
          </>
        )}
      </div>
    </>
  )
}

function ToggleRow({ label, enabled, onToggle }: { label: string; enabled: boolean; onToggle: () => void }) {
  return (
    <button onClick={onToggle} className="w-full flex items-center justify-between px-2 py-2 rounded-lg hover:bg-black/20">
      <span className="font-body font-extrabold text-white/85 text-sm">{label}</span>
      <span
        className="relative inline-flex w-11 h-6 rounded-full transition-colors"
        style={{
          background: enabled ? 'linear-gradient(180deg, #2E9A57, #124E2B)' : 'rgba(6,20,11,0.7)',
          border: '2px solid #06140B',
          boxShadow: 'inset 0 2px 0 rgba(0,0,0,0.3)',
        }}
      >
        <span
          className="absolute top-[1px] w-[18px] h-[18px] rounded-full transition-all"
          style={{
            left: enabled ? '20px' : '2px',
            background: enabled ? 'linear-gradient(180deg, #FFE27A, #F2B51C)' : 'linear-gradient(180deg, #fff, #cbd5c0)',
            border: '2px solid #06140B',
          }}
        />
      </span>
    </button>
  )
}

type ProfileField = 'displayName' | 'email'

function EditProfileModal({ field, onClose }: { field: ProfileField; onClose: () => void }) {
  const { user } = useAuthStore()
  const { updateProfile } = useAuth()
  const isEmail = field === 'email'
  const current = (isEmail ? user?.email : user?.displayName) ?? ''
  const [value, setValue] = useState(current)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sentTo, setSentTo] = useState<string | null>(null)

  const save = async () => {
    const trimmed = value.trim()
    if (trimmed === current || (!isEmail && !trimmed)) { onClose(); return }
    if (isEmail && trimmed && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setError('El email no es válido')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const pendingEmail = await updateProfile({ [field]: trimmed })
      // A new email is saved only after the owner clicks the link we sent
      if (isEmail && trimmed && pendingEmail) setSentTo(pendingEmail)
      else onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center mm-modal-backdrop p-4" onClick={onClose}>
      <div
        className="mm-pop mm-panel w-full max-w-xs p-5"
        onClick={e => e.stopPropagation()}
      >
        {sentTo ? (
          <>
            <p className="font-body font-bold text-white/85 text-sm">
              Te enviamos un enlace a <span className="text-[#FDD04B]">{sentTo}</span>. El email se guarda cuando lo confirmes.
            </p>
            <button onClick={onClose} className="mm-btn-gold mm-stroke mt-4">
              Listo
            </button>
          </>
        ) : (
        <>
        <p className="mm-title text-lg mb-2 uppercase tracking-wider">{isEmail ? 'Tu email' : 'Tu nombre'}</p>
        <input
          type={isEmail ? 'email' : 'text'}
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') onClose() }}
          maxLength={isEmail ? 254 : 20}
          placeholder={isEmail ? 'tu@email.com' : undefined}
          autoComplete={isEmail ? 'email' : undefined}
          autoFocus
          className="mm-input"
        />
        {isEmail && <p className="font-body font-bold text-white/70 text-xs mt-2">Lo usamos solo para recuperar tu contraseña. Te enviaremos un enlace para confirmarlo.</p>}
        {error && <p className="font-body font-bold text-[#FF8A80] text-xs mt-2">{error}</p>}
        <div className="flex gap-2 mt-4">
          <button onClick={onClose} className="flex-1 btn-outline-shine rounded-2xl font-chunky text-lg tracking-wide mm-stroke py-1.5">Cancelar</button>
          <button
            onClick={save}
            disabled={saving || (!isEmail && !value.trim())}
            className="flex-1 mm-btn-gold mm-stroke !text-lg !py-1.5"
          >
            {saving ? '...' : 'Guardar'}
          </button>
        </div>
        </>
        )}
      </div>
    </div>
  )
}

/* ─── Home «Escenario»: glow stage, floating tiles, play dock ─── */

const MODES: GameMode[] = ['modo200', 'modo500', 'torneo']
const MODE_STORAGE_KEY = 'menu_mode'

function loadMode(): GameMode {
  try {
    const saved = localStorage.getItem(MODE_STORAGE_KEY) as GameMode | null
    if (saved && MODES.includes(saved)) return saved
  } catch { /* storage blocked: default mode */ }
  return 'modo200'
}

function saveMode(mode: GameMode) {
  try { localStorage.setItem(MODE_STORAGE_KEY, mode) } catch { /* storage blocked */ }
}

const FAN = [
  { pip1: 5, pip2: 3, angle: -22, x: -40, delay: '0.4s' },
  { pip1: 5, pip2: 4, angle: 22, x: 40, delay: '1.1s' },
  { pip1: 6, pip2: 6, angle: 0, x: 0, delay: '0s' },
] as const

const SPARKS = [
  { left: '22%', delay: '0s', size: 5 },
  { left: '36%', delay: '1.6s', size: 4 },
  { left: '50%', delay: '0.8s', size: 6 },
  { left: '63%', delay: '2.4s', size: 4 },
  { left: '76%', delay: '3.1s', size: 5 },
  { left: '44%', delay: '3.7s', size: 3 },
]

/* The centerpiece: a felt table with the hand floating over it and the name plate in front */
function HeroStage() {
  return (
    <div className="mm-pop relative w-full max-w-[360px] aspect-[1/1.02]">
      {/* Table: wood edge under a felt top with a gold rim */}
      <div
        className="absolute left-[6%] right-[6%] bottom-[13%] h-[30%] rounded-[50%]"
        style={{ background: '#3E2413', transform: 'translateY(14px)', boxShadow: '0 24px 40px rgba(0,0,0,0.5)' }}
      />
      <div
        className="absolute left-[6%] right-[6%] bottom-[13%] h-[30%] rounded-[50%]"
        style={{
          background: 'radial-gradient(ellipse at 50% 40%, #1E8A4C 0%, #126B39 55%, #0B4A27 100%)',
          border: '7px solid #7A4A2B',
          boxShadow: '0 0 0 2px #EAB308, inset 0 6px 18px rgba(0,0,0,0.45), 0 0 50px rgba(253,208,75,0.25)',
        }}
      />

      {/* Shadows the floating tiles cast on the felt */}
      {FAN.map(t => (
        <div
          key={`s-${t.pip1}${t.pip2}`}
          className="mm-shadow absolute bottom-[25%] left-1/2 w-[22%] h-[7%] rounded-[50%]"
          style={{ marginLeft: `calc(-11% + ${t.x * 1.4}px)`, background: 'rgba(0,0,0,0.45)', filter: 'blur(4px)', animationDelay: t.delay }}
        />
      ))}

      {/* Sparks rising off the table */}
      {SPARKS.map((s, i) => (
        <span
          key={i}
          className="mm-spark absolute bottom-[34%] rounded-full"
          style={{ left: s.left, width: s.size, height: s.size, background: '#FDE68A', boxShadow: '0 0 8px #FDD04B', animationDelay: s.delay }}
        />
      ))}

      {/* The hand: three tiles fanned around a pivot below them, each floating on its own phase */}
      <div className="absolute inset-x-0 top-[4%] bottom-[30%]">
        {FAN.map(({ pip1, pip2, angle, delay }) => (
          <div
            key={`${pip1}-${pip2}`}
            className="absolute left-1/2 top-1/2"
            style={{ width: '23%', transform: `translate(-50%, -50%) rotate(${angle}deg)`, transformOrigin: '50% 140%' }}
          >
            <div className="mm-float" style={{ animationDelay: delay, filter: 'drop-shadow(0 12px 18px rgba(0,0,0,0.5))' }}>
              <DominoTile pip1={pip1} pip2={pip2} orientation="vertical" style={{ width: '100%', height: 'auto' }} />
            </div>
          </div>
        ))}
      </div>

      {/* Name plate, like a league banner */}
      <div className="absolute left-1/2 bottom-[3%] -translate-x-1/2 w-[78%]">
        <div
          className="relative py-2 text-center"
          style={{
            background: 'linear-gradient(180deg, #FDE68A 0%, #FDD04B 30%, #E4A918 65%, #B8830F 100%)',
            clipPath: 'polygon(6% 0, 94% 0, 100% 50%, 94% 100%, 6% 100%, 0 50%)',
            filter: `drop-shadow(0 4px 0 ${INK})`,
          }}
        >
          <h1 className="font-chunky text-[2.1rem] leading-none mm-stroke tracking-wide">
            Dominó <span style={{ color: '#FFF7D6' }}>PR</span>
          </h1>
        </div>
      </div>
    </div>
  )
}

/* Square 3D button for the top bar */
function SquareButton({ label, badge, onClick, children }: { label: string; badge?: number; onClick: () => void; children: ReactNode }) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className="mm-press relative w-12 h-12 rounded-xl flex items-center justify-center"
      style={{
        background: 'linear-gradient(180deg, #23824A 0%, #15592F 100%)',
        border: `2px solid ${INK}`,
        boxShadow: `0 4px 0 ${INK}, inset 0 2px 0 rgba(255,255,255,0.22), inset 0 -3px 0 rgba(0,0,0,0.2)`,
      }}
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="#FDD04B" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6" aria-hidden>
        {children}
      </svg>
      {badge !== undefined && badge > 0 && (
        <span
          className="absolute -top-2 -right-2 min-w-[22px] h-[22px] px-1 rounded-full flex items-center justify-center font-chunky text-[12px] text-white"
          style={{ background: '#E5322D', border: '2px solid #fff', boxShadow: `0 2px 0 ${INK}` }}
        >
          {badge}
        </span>
      )}
    </button>
  )
}

/* Identity banner: avatar with a gold rim, the name in gold, slanted like a shield banner */
function ProfileBanner({ user, onClick }: { user: AuthUser | null; onClick: () => void }) {
  const initial = user?.displayName[0]?.toUpperCase() ?? '?'
  return (
    <button onClick={onClick} className="mm-press flex items-center min-w-0 text-left">
      <span
        className="relative z-10 w-14 h-14 shrink-0 rounded-full p-[3px]"
        style={{ background: 'linear-gradient(180deg, #FDE68A, #B8830F)', boxShadow: `0 3px 0 ${INK}` }}
      >
        {user?.avatarUrl ? (
          <img src={user.avatarUrl} alt="" className="w-full h-full rounded-full object-cover" referrerPolicy="no-referrer" />
        ) : (
          <span
            className="w-full h-full rounded-full flex items-center justify-center font-chunky text-2xl mm-stroke"
            style={{ background: 'linear-gradient(135deg, #22C55E, #15803D)' }}
          >
            {user ? initial : '?'}
          </span>
        )}
      </span>
      <span
        className="-ml-4 pl-6 pr-6 py-1.5 min-w-0"
        style={{
          background: 'linear-gradient(180deg, rgba(14,58,33,0.95), rgba(8,32,17,0.95))',
          clipPath: 'polygon(0 0, 100% 0, 88% 100%, 0 100%)',
          borderBottom: '2px solid #EAB308',
        }}
      >
        <span className="block font-chunky text-[19px] leading-tight truncate max-w-[150px] mm-stroke" style={{ color: '#FDD04B' }}>
          {user ? user.displayName : 'Invitado'}
        </span>
        <span className="block font-body font-extrabold text-[11px] tracking-wider uppercase whitespace-nowrap text-white/85">
          {user ? 'Mesa de la Isla' : 'Iniciar sesión ›'}
        </span>
      </span>
    </button>
  )
}

/* Round gold-rimmed button on each side of JUGAR */
function DockButton({ label, onClick, ariaLabel, children }: { label: string; onClick: () => void; ariaLabel: string; children: ReactNode }) {
  return (
    <button onClick={onClick} aria-label={ariaLabel} className="mm-press shrink-0 flex flex-col items-center gap-1">
      <span
        className="w-[66px] h-[66px] rounded-full p-[3px]"
        style={{ background: 'linear-gradient(180deg, #FDE68A, #B8830F)', boxShadow: `0 4px 0 ${INK}` }}
      >
        <span
          className="w-full h-full rounded-full flex items-center justify-center overflow-hidden"
          style={{
            background: 'radial-gradient(circle at 50% 30%, #2BA25C, #12552E 75%)',
            boxShadow: 'inset 0 3px 0 rgba(255,255,255,0.2), inset 0 -4px 0 rgba(0,0,0,0.25)',
            perspective: 200,
          }}
        >
          {children}
        </span>
      </span>
      <span className="font-chunky text-[12px] leading-none mm-stroke tracking-wide">{label}</span>
    </button>
  )
}

/* The play button: thick gold slab, a gloss that sweeps across it and a ring that pulses out */
function PlayButton({ mode, onClick }: { mode: GameMode; onClick: () => void }) {
  return (
    <button onClick={onClick} className="mm-press mm-ring relative flex-1 min-w-0 rounded-2xl">
      <span
        className="relative block overflow-hidden rounded-2xl px-2 pt-2 pb-2.5"
        style={{
          background: 'linear-gradient(180deg, #FFE27A 0%, #FDD04B 28%, #F2B51C 60%, #D18F0E 100%)',
          border: `3px solid ${INK}`,
          boxShadow: `0 5px 0 ${INK}, inset 0 3px 0 rgba(255,255,255,0.6), inset 0 -5px 0 rgba(120,70,0,0.35)`,
        }}
      >
        <span className="mm-shine absolute inset-y-0 left-0 w-1/3 pointer-events-none" style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.65), transparent)' }} />
        <span className="relative block font-chunky text-[2.4rem] leading-none mm-stroke tracking-wide">Jugar</span>
        <span key={mode} className="mm-flip relative block font-body font-extrabold text-[12px] leading-tight mt-1 truncate" style={{ color: '#4A2A00' }}>
          {MODE_NAMES[mode]} · {MODE_SUMMARY[mode][0]}
        </span>
      </span>
    </button>
  )
}

const MODE_BADGE: Record<GameMode, string> = { modo200: '200', modo500: '500', torneo: '' }

function ModeFace({ mode }: { mode: GameMode }) {
  return (
    <span key={mode} className="mm-flip flex flex-col items-center">
      {mode === 'torneo' ? (
        <svg viewBox="0 0 24 24" className="w-8 h-8" fill="#FDD04B" stroke={INK} strokeWidth={1.4} strokeLinejoin="round" aria-hidden>
          <path d="M7 3h10v4a5 5 0 0 1-10 0V3z" />
          <path d="M7 5H4a3 3 0 0 0 3 4M17 5h3a3 3 0 0 1-3 4" fill="none" stroke="#FDD04B" strokeWidth={2} />
          <path d="M10 12h4v4h-4zM7.5 20h9l-1-4h-7z" />
        </svg>
      ) : (
        <span className="font-chunky text-[24px] leading-none mm-stroke">{MODE_BADGE[mode]}</span>
      )}
      <span className="mt-0.5 text-[11px] leading-none" style={{ color: '#FDE68A' }} aria-hidden>↻</span>
    </span>
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
  const [selectedMode, setSelectedMode] = useState<GameMode>(loadMode)
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
    createRoom(name, selectedMode)
  }

  if (view === 'create') {
    // The backdrop sits outside the revealed column: its children animate a transform, which would trap a fixed layer
    return (
      <>
      <StageBackdrop still />
      <div className="menu-reveal relative z-10 flex flex-col gap-4 sm:gap-5 w-full max-w-xs sm:max-w-sm md:max-w-md min-h-full">
        <button
          onClick={() => { setView('home'); clearError() }}
          className="relative self-start btn-outline-shine rounded-xl px-3 py-1.5 font-chunky text-base tracking-wide mm-stroke"
        >
          ‹ Volver
        </button>

        {/* Spacers center the form vertically (a bit above middle), Volver stays on top */}
        <div className="flex-1" />

        <div className="relative text-center flex flex-col items-center gap-1.5">
          <GoldCaption>Crear Sala</GoldCaption>
          <h2 className="font-chunky leading-none text-[2.6rem] sm:text-5xl mm-stroke tracking-wide">
            Nueva Mesa
          </h2>
          <p className="font-body font-bold text-white/75 text-xs sm:text-sm">Elige el modo de juego</p>
        </div>

        <Input
          label="Tu nombre"
          placeholder="Jugador"
          value={playerName}
          onChange={e => setPlayerName(e.target.value)}
          maxLength={16}
          onKeyDown={e => e.key === 'Enter' && handleCreate()}
        />

        <div className="relative flex gap-2">
          {(['modo200', 'modo500', 'torneo'] as GameMode[]).map(mode => {
            const active = selectedMode === mode
            const [target, extra] = MODE_SUMMARY[mode]
            return (
              <button
                key={mode}
                onClick={() => setSelectedMode(mode)}
                aria-pressed={active}
                className="mm-press flex-1 min-w-0 rounded-2xl px-1.5 py-3 text-center"
                style={{
                  background: active
                    ? 'linear-gradient(180deg, #FFE27A 0%, #F2B51C 100%)'
                    : 'linear-gradient(180deg, rgba(18,70,40,0.96), rgba(8,32,17,0.96))',
                  border: '3px solid #06140B',
                  boxShadow: active
                    ? '0 0 0 2px #FDE68A, 0 5px 0 #06140B, inset 0 3px 0 rgba(255,255,255,0.5)'
                    : '0 0 0 2px rgba(234,179,8,0.35), 0 5px 0 #06140B, inset 0 2px 0 rgba(255,255,255,0.08)',
                }}
              >
                <p className={`font-chunky text-xl sm:text-2xl leading-none mm-stroke ${active ? '' : '!text-[#FDD04B]'}`}>{MODE_SHORT[mode]}</p>
                <p className={`font-body font-extrabold text-[11px] sm:text-xs mt-1.5 leading-tight ${active ? 'text-[#4A2A00]' : 'text-white/85'}`}>{target}</p>
                <p className={`font-body font-bold text-[11px] sm:text-xs leading-tight mt-0.5 ${active ? 'text-[#4A2A00]/80' : 'text-white/70'}`}>{extra}</p>
              </button>
            )
          })}
        </div>
        <p className="relative font-body font-bold text-white/70 text-xs text-center -mt-1">
          {selectedMode === 'torneo' ? 'Reglas fijas del torneo.' : 'Puedes ajustar las reglas en la sala.'}
        </p>

        {error && <p className="relative font-body font-bold text-[#FF8A80] text-sm text-center">{error}</p>}

        <GoldCTA onClick={handleCreate} disabled={!playerName.trim()} size="md">
          CREAR SALA
        </GoldCTA>
        <div className="flex-[1.4]" />
      </div>
      </>
    )
  }

  if (view === 'join') {
    // The backdrop sits outside the revealed column: its children animate a transform, which would trap a fixed layer
    return (
      <>
      <StageBackdrop still />
      <div className="menu-reveal relative z-10 flex flex-col gap-4 sm:gap-5 w-full max-w-xs sm:max-w-sm md:max-w-md min-h-full">
        <button
          onClick={() => { setView('home'); clearError() }}
          className="relative self-start btn-outline-shine rounded-xl px-3 py-1.5 font-chunky text-base tracking-wide mm-stroke"
        >
          ‹ Volver
        </button>

        {/* Spacers center the form vertically (a bit above middle), Volver stays on top */}
        <div className="flex-1" />

        <div className="relative text-center flex flex-col items-center gap-1.5">
          <GoldCaption>Unirse a Sala</GoldCaption>
          <h2 className="font-chunky leading-none text-[2.6rem] sm:text-5xl mm-stroke tracking-wide">
            Ingresa Código
          </h2>
          <p className="font-body font-bold text-white/75 text-xs sm:text-sm">Te invitaron a una mesa</p>
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
          placeholder="COQUI123"
          value={roomCode}
          onChange={e => setRoomCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
          maxLength={8}
          autoCapitalize="characters"
          autoCorrect="off"
          spellCheck={false}
          onKeyDown={e => e.key === 'Enter' && handleJoin()}
        />

        {error && <p className="relative font-body font-bold text-[#FF8A80] text-sm text-center">{error}</p>}

        <GoldCTA onClick={handleJoin} disabled={!playerName.trim() || !roomCode.trim()} size="md">
          UNIRSE
        </GoldCTA>
        <div className="flex-[1.4]" />
      </div>
      </>
    )
  }

  if (showSocial && isAuthenticated) {
    return (
      <>
      <StageBackdrop still />
      <div className="mm-rise relative z-10 flex flex-col items-center w-full max-w-xs sm:max-w-sm md:max-w-md">
        <SocialPanel onClose={() => setShowSocial(false)} />
      </div>
      </>
    )
  }

  const cycleMode = () => {
    const next = MODES[(MODES.indexOf(selectedMode) + 1) % MODES.length]
    setSelectedMode(next)
    saveMode(next)
  }
  const needsAccount = (go: () => void) => () => (isAuthenticated ? go() : navigate('/auth'))

  return (
    <div className="relative flex flex-col w-full max-w-sm mx-auto h-full min-h-[600px]">
      <StageBackdrop />

      {/* Top bar: who you are on the left, ranking, friends and settings on the right */}
      <div className="mm-drop relative z-30 flex items-start justify-between gap-2 w-full">
        <ProfileBanner
          user={isAuthenticated ? user : null}
          onClick={() => (isAuthenticated ? setShowSettings(true) : navigate('/auth'))}
        />
        <div className="relative flex gap-2 pt-1 shrink-0">
          <SquareButton label="Estadísticas y ranking" onClick={needsAccount(() => navigate('/stats'))}>
            <path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4z" />
            <path d="M7 6H4a3 3 0 0 0 3 4M17 6h3a3 3 0 0 1-3 4" />
          </SquareButton>
          <SquareButton label="Amigos" badge={incomingRequestCount} onClick={needsAccount(() => setShowSocial(true))}>
            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
          </SquareButton>
          <SquareButton label="Ajustes" onClick={() => setShowSettings(s => !s)}>
            <line x1="4" y1="7" x2="20" y2="7" />
            <line x1="4" y1="12" x2="20" y2="12" />
            <line x1="4" y1="17" x2="20" y2="17" />
          </SquareButton>
          {showSettings && <SettingsDropdown onClose={() => setShowSettings(false)} />}
        </div>
      </div>

      {/* Stage */}
      <div className="relative z-10 flex-1 flex items-center justify-center py-3">
        <HeroStage />
      </div>

      {error && <p className="relative z-10 font-body font-bold text-accent text-sm text-center mb-2">{error}</p>}

      {/* Play dock: mode on the left, JUGAR in the middle, join by code on the right */}
      <div
        className="mm-rise relative z-10 flex items-center gap-2 rounded-[40px] p-2.5"
        style={{
          background: 'linear-gradient(180deg, rgba(16,64,36,0.96), rgba(7,30,16,0.96))',
          border: `3px solid ${INK}`,
          boxShadow: `0 0 0 2px rgba(234,179,8,0.45), 0 10px 30px rgba(0,0,0,0.5), inset 0 2px 0 rgba(255,255,255,0.08)`,
        }}
      >
        <DockButton label="Modo" ariaLabel={`Cambiar modo. Ahora: ${MODE_NAMES[selectedMode]}`} onClick={cycleMode}>
          <ModeFace mode={selectedMode} />
        </DockButton>
        <PlayButton mode={selectedMode} onClick={handleQuickPlay} />
        <DockButton label="Código" ariaLabel="Unirse con código" onClick={() => setView('join')}>
          <svg viewBox="0 0 24 24" fill="none" stroke="#FDD04B" strokeWidth={2.6} strokeLinecap="round" className="w-7 h-7" aria-hidden>
            <line x1="4" y1="9" x2="20" y2="9" />
            <line x1="4" y1="15" x2="20" y2="15" />
            <line x1="10" y1="3" x2="8" y2="21" />
            <line x1="16" y1="3" x2="14" y2="21" />
          </svg>
        </DockButton>
      </div>

      <div className="relative z-10 flex justify-center gap-3 mt-3 font-body text-white/30 text-[10px]">
        <Link to="/privacy" className="hover:text-white/50 transition-colors">Privacidad</Link>
        <span>·</span>
        <Link to="/terms" className="hover:text-white/50 transition-colors">Términos</Link>
      </div>
    </div>
  )
}

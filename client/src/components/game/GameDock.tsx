import { useState, useRef, ReactNode } from 'react'
import { socket } from '../../socket'
import { useUIStore } from '../../store/uiStore'
import { useCallStore } from '../../store/callStore'
import { joinCallRef } from '../../hooks/useWebRTC'
import { useCallToggles, MicIcon, CameraIcon } from '../player/CallControls'

/*
 * In-game controls: cream square buttons with a wood border («mesa de club»).
 * Social (chat, reactions) on the left, media (call, sound) on the right.
 * Phone portrait lays each group out in a row under the hand; landscape and
 * desktop keep them stacked in the bottom corners of the table grid.
 */

const REACTIONS = [
  '🔥', '😂', '💀', '🫡', '👏', '😤',
  '🤙', '😎', '🎯', '🤡', '💯', '😈',
] as const

export type DockDirection = 'row' | 'column'

function Icon({ children }: { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="w-[48%] h-[48%]"
      aria-hidden
    >
      {children}
    </svg>
  )
}

function DockButton({ label, size, onClick, disabled, pressed, badge, children }: {
  label: string
  size: number
  onClick: () => void
  disabled?: boolean
  /** On/off state for toggles (open panel, muted mic): shown in brass */
  pressed?: boolean
  badge?: number
  children: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      aria-pressed={pressed}
      title={label}
      className="club-btn relative"
      style={{ width: size, height: size }}
    >
      {children}
      {badge !== undefined && badge > 0 && (
        <span
          className="absolute -top-2 -right-2 min-w-[20px] h-5 px-1 rounded-full flex items-center justify-center font-club font-bold text-[11px] text-club-text"
          style={{ background: '#B3261E', border: '2px solid #F1E3C2' }}
        >
          {badge > 9 ? '9+' : badge}
        </span>
      )}
    </button>
  )
}

function Group({ direction, children }: { direction: DockDirection; children: ReactNode }) {
  return <div className={`flex ${direction === 'row' ? 'flex-row' : 'flex-col'} gap-2`}>{children}</div>
}

/** Left corner: chat + reactions */
export function SocialDock({ size = 46, direction = 'row' }: { size?: number; direction?: DockDirection }) {
  const chatOpen = useUIStore(s => s.chatOpen)
  const unreadCount = useUIStore(s => s.unreadCount)
  const reactionsOpen = useUIStore(s => s.emojiBarOpen)
  const [cooldown, setCooldown] = useState(false)
  const dockRef = useRef<HTMLDivElement>(null)

  const ui = useUIStore.getState
  const toggleChat = () => { ui().setEmojiBarOpen(false); ui().setChatOpen(!chatOpen) }
  const toggleReactions = () => ui().setEmojiBarOpen(!reactionsOpen)

  const sendReaction = (emoji: string) => {
    if (cooldown) return
    socket.emit('chat:send', { message: emoji, type: 'reaction' })
    setCooldown(true)
    ui().setEmojiBarOpen(false)
    setTimeout(() => setCooldown(false), 800)
  }

  // The dock sits in a narrow, overflow-hidden grid cell, so the panel is fixed
  // to the viewport and anchored just above the dock
  const anchor = dockRef.current?.getBoundingClientRect()

  return (
    <div ref={dockRef}>
      {reactionsOpen && anchor && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => ui().setEmojiBarOpen(false)} />
          <div
            className="emoji-bar-in fixed z-50 w-max grid grid-cols-4 gap-1 p-2 club-sign"
            style={{
              left: anchor.left,
              bottom: window.innerHeight - anchor.top + 10,
            }}
          >
            {REACTIONS.map(emoji => (
              <button
                key={emoji}
                type="button"
                onClick={() => sendReaction(emoji)}
                disabled={cooldown}
                aria-label={`Reaccionar ${emoji}`}
                className="club-focus w-10 h-10 rounded-md flex items-center justify-center text-2xl hover:bg-club-ink/10 active:scale-90 transition-transform duration-150 disabled:opacity-40"
              >
                {emoji}
              </button>
            ))}
          </div>
        </>
      )}
      <Group direction={direction}>
        <DockButton label={chatOpen ? 'Cerrar chat' : 'Abrir chat'} size={size} pressed={chatOpen} onClick={toggleChat} badge={chatOpen ? 0 : unreadCount}>
          <Icon><path d="M4 5h16v11H9l-5 4z" /></Icon>
        </DockButton>
        <DockButton label={reactionsOpen ? 'Cerrar reacciones' : 'Enviar reacción'} size={size} pressed={reactionsOpen} onClick={toggleReactions}>
          <Icon>
            <circle cx="12" cy="12" r="8.5" />
            <path d="M8.5 14c1 1.4 2.1 2 3.5 2s2.5-.6 3.5-2" />
            <path d="M9 10h.01M15 10h.01" />
          </Icon>
        </DockButton>
      </Group>
    </div>
  )
}

/**
 * Right group: join the call (or, once in it, mic and camera when the seat
 * that normally holds them isn't on screen) and sound.
 */
export function MediaDock({ size = 46, direction = 'row', callControls = false }: {
  size?: number
  direction?: DockDirection
  /** Phone portrait: the player's own seat isn't drawn, so mic/camera live here */
  callControls?: boolean
}) {
  const sfxEnabled = useUIStore(s => s.sfxEnabled)
  const musicEnabled = useUIStore(s => s.musicEnabled)
  const inCall = useCallStore(s => s.myAudioEnabled || s.myVideoEnabled)
  const callError = useCallStore(s => s.callError)
  const [joining, setJoining] = useState(false)
  const { micMuted, cameraOff, toggleMic, toggleCamera } = useCallToggles()

  const soundOn = sfxEnabled || musicEnabled
  const toggleSound = () => {
    const { toggleSfx, toggleMusic } = useUIStore.getState()
    // One switch for both: any sound on → mute all, all off → turn all on
    if (sfxEnabled === soundOn) toggleSfx()
    if (musicEnabled === soundOn) toggleMusic()
  }

  const joinCall = async () => {
    setJoining(true)
    try {
      await joinCallRef.current?.(true, true)
    } finally {
      setJoining(false)
    }
  }

  return (
    <>
    {callError && !inCall && (
      // Fixed, not anchored to the dock: the dock's grid cell clips overflow
      <button
        type="button"
        onClick={() => useCallStore.getState().setCallError(null)}
        className="club-sign club-focus fixed top-16 left-1/2 -translate-x-1/2 z-50 max-w-[18rem] px-4 py-2.5 text-left font-club font-semibold text-sm"
        style={{ borderColor: '#B3261E' }}
        role="alert"
      >
        {callError}
      </button>
    )}
    <Group direction={direction}>
      {!inCall && (
        <DockButton
          label={joining ? 'Conectando…' : callError ? `${callError} Toca para reintentar.` : 'Unirse a la llamada'}
          size={size}
          onClick={joinCall}
          disabled={joining}
        >
          {joining ? (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} className="w-[44%] h-[44%] animate-spin" aria-hidden>
              <path d="M12 3a9 9 0 0 1 9 9" strokeLinecap="round" />
            </svg>
          ) : (
            <Icon><path d="M3 7h11v10H3z" /><path d="M14 10.5l7-3.5v10l-7-3.5" /></Icon>
          )}
        </DockButton>
      )}
      {inCall && callControls && (
        <>
          <DockButton label={micMuted ? 'Activar mic' : 'Silenciar mic'} size={size} pressed={micMuted} onClick={toggleMic}>
            <Icon><MicIcon muted={micMuted} /></Icon>
          </DockButton>
          <DockButton label={cameraOff ? 'Activar camara' : 'Apagar camara'} size={size} pressed={cameraOff} onClick={toggleCamera}>
            <Icon><CameraIcon off={cameraOff} /></Icon>
          </DockButton>
        </>
      )}
      <DockButton label={soundOn ? 'Silenciar sonido' : 'Activar sonido'} size={size} pressed={!soundOn} onClick={toggleSound}>
        <Icon>
          <path d="M4 9h4l5-4v14l-5-4H4z" />
          {soundOn ? <path d="M17 9a4 4 0 0 1 0 6" /> : <path d="M16 9l5 6M21 9l-5 6" />}
        </Icon>
      </DockButton>
    </Group>
    </>
  )
}

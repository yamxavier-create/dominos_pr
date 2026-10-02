import { useState, useRef, ReactNode } from 'react'
import { socket } from '../../socket'
import { useUIStore } from '../../store/uiStore'
import { useCallStore } from '../../store/callStore'
import { joinCallRef } from '../../hooks/useWebRTC'

/*
 * In-game controls live in two matching capsules in the bottom corners of the
 * table grid, beside the player's hand: social (chat, reactions) on the left,
 * media (call, sound) on the right. One shape, one icon style, one active state.
 */

const REACTIONS = [
  '🔥', '😂', '💀', '🫡', '👏', '😤',
  '🤙', '😎', '🎯', '🤡', '💯', '😈',
] as const

type Tone = 'default' | 'active' | 'call' | 'muted'

const ICON_COLOR: Record<Tone, string> = {
  default: 'rgba(255,255,255,0.85)',
  active: '#EAB308',
  call: '#4ADE80',
  muted: 'rgba(255,255,255,0.35)',
}

function Icon({ children, tone }: { children: ReactNode; tone: Tone }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke={ICON_COLOR[tone]}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="w-[55%] h-[55%]"
      aria-hidden
    >
      {children}
    </svg>
  )
}

function DockButton({ label, tone = 'default', size, onClick, disabled, badge, children }: {
  label: string
  tone?: Tone
  size: number
  onClick: () => void
  disabled?: boolean
  badge?: number
  children: ReactNode
}) {
  const bg = tone === 'active'
    ? 'rgba(234,179,8,0.14)'
    : tone === 'call'
      ? 'rgba(34,197,94,0.14)'
      : 'transparent'
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className="relative rounded-full flex items-center justify-center transition-colors duration-150 hover:bg-white/[0.07] active:scale-90 disabled:opacity-50"
      style={{ width: size, height: size, background: bg, touchAction: 'manipulation' }}
    >
      {children}
      {badge !== undefined && badge > 0 && (
        <span
          className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full flex items-center justify-center font-body font-bold text-[10px] text-white"
          style={{ background: '#F97316', boxShadow: '0 0 0 2px #0A1A0F' }}
        >
          {badge > 9 ? '9+' : badge}
        </span>
      )}
    </button>
  )
}

function Capsule({ children }: { children: ReactNode }) {
  return (
    <div
      className="flex flex-col items-center gap-1 p-1 rounded-full"
      style={{
        background: 'linear-gradient(180deg, rgba(15,35,24,0.92), rgba(8,22,13,0.92))',
        border: '1px solid rgba(234,179,8,0.18)',
        boxShadow: '0 8px 20px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.05)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
      }}
    >
      {children}
    </div>
  )
}

/** Left corner: chat + reactions */
export function SocialDock({ size = 40 }: { size?: number }) {
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
            className="emoji-bar-in fixed z-50 w-max grid grid-cols-4 gap-1 p-2 rounded-2xl"
            style={{
              left: anchor.left,
              bottom: window.innerHeight - anchor.top + 8,
              background: 'linear-gradient(180deg, rgba(15,35,24,0.96), rgba(8,22,13,0.96))',
              border: '1px solid rgba(234,179,8,0.18)',
              boxShadow: '0 12px 28px rgba(0,0,0,0.45)',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
            }}
          >
            {REACTIONS.map(emoji => (
              <button
                key={emoji}
                onClick={() => sendReaction(emoji)}
                disabled={cooldown}
                className="w-10 h-10 rounded-xl flex items-center justify-center text-2xl hover:bg-white/[0.07] active:scale-90 transition-transform duration-150 disabled:opacity-40"
              >
                {emoji}
              </button>
            ))}
          </div>
        </>
      )}
      <Capsule>
        <DockButton label="Chat" size={size} tone={chatOpen ? 'active' : 'default'} onClick={toggleChat} badge={chatOpen ? 0 : unreadCount}>
          <Icon tone={chatOpen ? 'active' : 'default'}>
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </Icon>
        </DockButton>
        <DockButton label={reactionsOpen ? 'Cerrar reacciones' : 'Reacciones'} size={size} tone={reactionsOpen ? 'active' : 'default'} onClick={toggleReactions}>
          <Icon tone={reactionsOpen ? 'active' : 'default'}>
            <circle cx="12" cy="12" r="10" />
            <path d="M8 14s1.5 2 4 2 4-2 4-2" />
            <line x1="9" y1="9" x2="9.01" y2="9" />
            <line x1="15" y1="9" x2="15.01" y2="9" />
          </Icon>
        </DockButton>
      </Capsule>
    </div>
  )
}

/** Right corner: join call + sound */
export function MediaDock({ size = 40 }: { size?: number }) {
  const sfxEnabled = useUIStore(s => s.sfxEnabled)
  const musicEnabled = useUIStore(s => s.musicEnabled)
  const inCall = useCallStore(s => s.myAudioEnabled || s.myVideoEnabled)
  const [joining, setJoining] = useState(false)

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
    <Capsule>
      {/* Once in the call, mic/camera controls live on the player's own seat */}
      {!inCall && (
        <DockButton label={joining ? 'Conectando…' : 'Unirse a la llamada'} size={size} tone="call" onClick={joinCall} disabled={joining}>
          {joining ? (
            <svg viewBox="0 0 24 24" fill="none" stroke={ICON_COLOR.call} strokeWidth={2.5} className="w-[50%] h-[50%] animate-spin" aria-hidden>
              <path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round" />
            </svg>
          ) : (
            <Icon tone="call">
              <polygon points="23 7 16 12 23 17 23 7" />
              <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
            </Icon>
          )}
        </DockButton>
      )}
      <DockButton label={soundOn ? 'Silenciar' : 'Activar sonido'} size={size} tone={soundOn ? 'default' : 'muted'} onClick={toggleSound}>
        <Icon tone={soundOn ? 'default' : 'muted'}>
          <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
          {soundOn ? (
            <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
          ) : (
            <>
              <line x1="22" y1="9" x2="16" y2="15" />
              <line x1="16" y1="9" x2="22" y2="15" />
            </>
          )}
        </Icon>
      </DockButton>
    </Capsule>
  )
}

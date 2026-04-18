import { useState } from 'react'
import { socket } from '../../socket'
import { useUIStore } from '../../store/uiStore'

const EMOJIS = [
  '🔥', '😂', '💀', '🫡', '👏', '😤',
  '🤙', '😎', '🎯', '🤡', '💯', '😈',
] as const

export function EmojiBar() {
  const emojiBarOpen = useUIStore(s => s.emojiBarOpen)
  const [cooldown, setCooldown] = useState(false)

  const toggle = () => useUIStore.getState().setEmojiBarOpen(!emojiBarOpen)

  const sendReaction = (emoji: string) => {
    if (cooldown) return
    socket.emit('chat:send', { message: emoji, type: 'reaction' })
    setCooldown(true)
    useUIStore.getState().setEmojiBarOpen(false)
    setTimeout(() => setCooldown(false), 800)
  }

  return (
    <div className="fixed left-4 bottom-[128px] z-30 flex flex-col items-start gap-1">
      {emojiBarOpen && (
        <div className="emoji-bar-in grid grid-cols-4 gap-1.5 bg-black/80 backdrop-blur-md rounded-2xl px-2.5 py-2 shadow-2xl border border-white/10 mb-1">
          {EMOJIS.map(emoji => (
            <button
              key={emoji}
              onClick={() => sendReaction(emoji)}
              disabled={cooldown}
              className="text-2xl w-10 h-10 flex items-center justify-center hover:scale-125 active:scale-90 transition-transform duration-150 disabled:opacity-40 rounded-lg hover:bg-white/10"
            >
              {emoji}
            </button>
          ))}
        </div>
      )}
      <button
        onClick={toggle}
        className="w-10 h-10 rounded-full flex items-center justify-center active:scale-90 transition-all duration-200"
        style={{
          background: 'rgba(0,0,0,0.55)',
          border: '1px solid rgba(255,255,255,0.12)',
          backdropFilter: 'blur(8px)',
          boxShadow: '0 4px 12px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.08)',
        }}
        aria-label={emojiBarOpen ? 'Cerrar reacciones' : 'Reacciones'}
      >
        {emojiBarOpen ? (
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        ) : (
          <span className="text-lg leading-none" style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.5))' }}>😂</span>
        )}
      </button>
    </div>
  )
}

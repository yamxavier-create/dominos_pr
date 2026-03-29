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
        className="w-10 h-10 rounded-full bg-black/60 hover:bg-black/80 backdrop-blur-sm flex items-center justify-center shadow-lg transition-all duration-200 border border-white/10"
      >
        <span className={`text-lg transition-transform duration-200 ${emojiBarOpen ? 'scale-110' : ''}`}>
          {emojiBarOpen ? '✕' : '😂'}
        </span>
      </button>
    </div>
  )
}

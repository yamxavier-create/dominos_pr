import { useEffect, useState } from 'react'
import { ChatMessage } from '../../store/uiStore'

interface FloatingChatBubbleProps {
  message: ChatMessage
}

export function FloatingChatBubble({ message }: FloatingChatBubbleProps) {
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    const timer = setTimeout(() => setVisible(false), 4000)
    return () => clearTimeout(timer)
  }, [message.id])

  if (!visible) return null

  const isReaction = message.type === 'reaction'

  return (
    <div className="chat-bubble pointer-events-none z-30 whitespace-nowrap max-w-[200px]">
      {isReaction ? (
        <span className="text-2xl drop-shadow-lg">{message.content}</span>
      ) : (
        <span className="club-sign block font-body font-extrabold text-sm line-clamp-2 whitespace-normal !rounded-xl px-2.5 py-1" style={{ borderWidth: 2 }}>
          {message.content}
        </span>
      )}
    </div>
  )
}

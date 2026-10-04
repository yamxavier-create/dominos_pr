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
        <span className="block font-club font-semibold text-sm text-club-ink bg-club-cream line-clamp-2 whitespace-normal rounded-md px-2 py-1" style={{ border: '2px solid #5A351E', boxShadow: '0 2px 0 #07160E' }}>
          {message.content}
        </span>
      )}
    </div>
  )
}

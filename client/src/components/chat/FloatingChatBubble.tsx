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
        <span className="font-body text-sm text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.8)] line-clamp-2 bg-black/30 backdrop-blur-sm rounded-lg px-2 py-1">
          {message.content}
        </span>
      )}
    </div>
  )
}

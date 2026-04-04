import { useEffect, useRef, useState } from 'react'
import { useUIStore, ChatMessage } from '../../store/uiStore'
import { useRoomStore } from '../../store/roomStore'
import { socket } from '../../socket'
import { ReactionPicker } from './ReactionPicker'

const PLAYER_COLORS = [
  'text-blue-400',
  'text-red-400',
  'text-green-400',
  'text-yellow-400',
]

function formatTime(timestamp: number): string {
  const d = new Date(timestamp)
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function MessageBubble({ msg, myIndex }: { msg: ChatMessage; myIndex: number }) {
  const isMine = msg.playerIndex === myIndex
  const isReaction = msg.type === 'reaction'

  return (
    <div className={`flex flex-col ${isMine ? 'items-end' : 'items-start'} mb-2`}>
      {!isMine && (
        <span className={`text-xs font-semibold ${PLAYER_COLORS[msg.playerIndex] ?? 'text-gray-400'} mb-0.5`}>
          {msg.playerName}
        </span>
      )}
      <div
        className={`rounded-lg px-3 py-1.5 max-w-[85%] break-words ${
          isMine ? 'bg-blue-600 text-white' : 'bg-white/15 text-white'
        } ${isReaction ? 'text-xl' : 'text-sm'}`}
      >
        {msg.content}
      </div>
      <span className="text-[10px] text-gray-500 mt-0.5">{formatTime(msg.timestamp)}</span>
    </div>
  )
}

export function ChatPanel() {
  const chatOpen = useUIStore(s => s.chatOpen)
  const chatMessages = useUIStore(s => s.chatMessages)
  const myIndex = useRoomStore(s => s.myPlayerIndex)
  const [input, setInput] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatMessages])

  // Focus input when panel opens
  useEffect(() => {
    if (chatOpen) {
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [chatOpen])

  if (!chatOpen) return null

  const handleSend = () => {
    const trimmed = input.trim()
    if (!trimmed) return
    socket.emit('chat:send', { message: trimmed, type: 'text' })
    setInput('')
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    e.stopPropagation()
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 z-50"
        onClick={() => useUIStore.getState().setChatOpen(false)}
      />

      {/* Panel */}
      <div className="fixed right-0 top-0 bottom-0 w-80 bg-gray-900 z-50 flex flex-col shadow-2xl animate-slide-in-right">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
          <h2 className="text-white font-semibold text-lg">Chat</h2>
          <button
            onClick={() => useUIStore.getState().setChatOpen(false)}
            className="text-gray-400 hover:text-white transition-colors text-xl leading-none"
            aria-label="Close chat"
          >
            &times;
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-3 py-2">
          {chatMessages.length === 0 && (
            <div className="text-center mt-8">
              <p className="text-2xl mb-1">💬</p>
              <p className="font-body text-white/30 text-xs">Envía un mensaje a tus oponentes</p>
            </div>
          )}
          {chatMessages.map(msg => (
            <MessageBubble key={msg.id} msg={msg} myIndex={myIndex ?? -1} />
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Reaction picker */}
        <ReactionPicker />

        {/* Input */}
        <div className="flex items-center gap-2 px-3 py-2 border-t border-white/10">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            maxLength={200}
            placeholder="Escribe un mensaje..."
            className="flex-1 bg-white/10 text-white rounded-lg px-3 py-2 text-sm outline-none placeholder-gray-500 focus:ring-1 focus:ring-blue-500"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim()}
            className="px-3 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg text-white text-sm transition-colors"
          >
            Enviar
          </button>
        </div>
      </div>
    </>
  )
}

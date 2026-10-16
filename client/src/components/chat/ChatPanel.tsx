import { useEffect, useRef, useState } from 'react'
import { useUIStore, ChatMessage } from '../../store/uiStore'
import { useRoomStore } from '../../store/roomStore'
import { socket } from '../../socket'
import { ReactionPicker } from './ReactionPicker'

const PLAYER_COLORS = [
  'text-[#5BEA9B]',
  'text-[#FFA270]',
  'text-[#86EFAC]',
  'text-[#FF8A80]',
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
        <span className={`font-chunky text-xs tracking-wide ${PLAYER_COLORS[msg.playerIndex] ?? 'text-white/70'} mb-0.5`}>
          {msg.playerName}
        </span>
      )}
      <div
        className={`rounded-xl px-3 py-1.5 max-w-[85%] break-words font-body font-bold ${
          isMine ? 'text-[#2B1B12]' : 'text-white'
        } ${isReaction ? 'text-xl' : 'text-sm'}`}
        style={{
          background: isMine ? 'linear-gradient(180deg, #FFE27A, #F2B51C)' : 'linear-gradient(180deg, #23824A, #15592F)',
          border: '2px solid #06140B',
          boxShadow: '0 3px 0 #06140B',
        }}
      >
        {msg.content}
      </div>
      <span className="font-body font-semibold text-[10px] text-white/60 mt-1">{formatTime(msg.timestamp)}</span>
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
        className="fixed inset-0 mm-modal-backdrop z-50"
        onClick={() => useUIStore.getState().setChatOpen(false)}
      />

      {/* Panel */}
      <div
        className="fixed right-0 top-0 bottom-0 w-80 z-50 flex flex-col animate-slide-in-right"
        style={{
          background: 'linear-gradient(180deg, #124628 0%, #08200F 100%)',
          borderLeft: '3px solid #06140B',
          boxShadow: '-2px 0 0 rgba(234,179,8,0.45), -12px 0 30px rgba(0,0,0,0.5)',
          paddingTop: 'var(--safe-top)',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b-2 border-[#06140B]">
          <h2 className="mm-title text-2xl leading-none">Chat</h2>
          <button
            onClick={() => useUIStore.getState().setChatOpen(false)}
            className="club-btn w-9 h-9 text-xl leading-none"
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
              <p className="font-body font-bold text-white/70 text-xs">Envía un mensaje a tus oponentes</p>
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
        <div className="flex items-center gap-2 px-3 py-2.5 border-t-2 border-[#06140B]" style={{ paddingBottom: 'calc(0.625rem + env(safe-area-inset-bottom))' }}>
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            maxLength={200}
            placeholder="Escribe un mensaje..."
            className="mm-input flex-1 !w-auto min-w-0 !py-2 !text-sm"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim()}
            className="mm-btn-gold mm-stroke !w-auto !text-base !px-3 !py-2 !rounded-xl"
          >
            Enviar
          </button>
        </div>
      </div>
    </>
  )
}

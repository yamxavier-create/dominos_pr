import { useRef, useState, useCallback, useEffect } from 'react'
import { useUIStore } from '../../store/uiStore'

const STORAGE_KEY = 'chatButtonPos'
const DRAG_THRESHOLD = 8

function loadPosition(): { x: number; y: number } | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw)
  } catch { /* ignore */ }
  return null
}

function savePosition(x: number, y: number) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ x, y })) } catch { /* ignore */ }
}

export function ChatButton() {
  const chatOpen = useUIStore(s => s.chatOpen)
  const unreadCount = useUIStore(s => s.unreadCount)

  // Position state — default bottom-right, above hand
  const [pos, setPos] = useState<{ x: number; y: number }>(() => {
    const saved = loadPosition()
    if (saved) return saved
    return { x: 12, y: window.innerHeight * 0.65 }
  })

  const draggingRef = useRef(false)
  const startRef = useRef({ x: 0, y: 0, posX: 0, posY: 0 })
  const movedRef = useRef(false)
  const latestPosRef = useRef(pos)
  latestPosRef.current = pos
  const btnRef = useRef<HTMLButtonElement>(null)

  const clamp = useCallback((x: number, y: number) => {
    const size = 48
    return {
      x: Math.max(4, Math.min(window.innerWidth - size - 4, x)),
      y: Math.max(4, Math.min(window.innerHeight - size - 4, y)),
    }
  }, [])

  // Re-clamp on resize
  useEffect(() => {
    const handler = () => setPos(p => clamp(p.x, p.y))
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [clamp])

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    draggingRef.current = true
    movedRef.current = false
    startRef.current = { x: e.clientX, y: e.clientY, posX: pos.x, posY: pos.y }
    btnRef.current?.setPointerCapture(e.pointerId)
  }, [pos])

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!draggingRef.current) return
    const dx = e.clientX - startRef.current.x
    const dy = e.clientY - startRef.current.y
    if (!movedRef.current && Math.abs(dx) + Math.abs(dy) < DRAG_THRESHOLD) return
    movedRef.current = true
    const newPos = clamp(startRef.current.posX + dx, startRef.current.posY + dy)
    setPos(newPos)
  }, [clamp])

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    draggingRef.current = false
    btnRef.current?.releasePointerCapture(e.pointerId)
    if (movedRef.current) {
      savePosition(latestPosRef.current.x, latestPosRef.current.y)
      return // was a drag, don't toggle chat
    }
    // It was a tap — toggle chat
    const { chatOpen: isOpen, setChatOpen } = useUIStore.getState()
    setChatOpen(!isOpen)
  }, [])

  return (
    <button
      ref={btnRef}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      className="fixed z-40 w-12 h-12 rounded-full game-btn-circle flex items-center justify-center touch-none"
      style={{ left: pos.x, top: pos.y }}
      aria-label="Toggle chat"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="white"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="w-6 h-6"
      >
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      </svg>

      {unreadCount > 0 && (
        <span className="absolute -top-1 -right-1 min-w-5 h-5 flex items-center justify-center rounded-full bg-accent text-white text-xs font-bold px-1 shadow-md">
          {unreadCount > 9 ? '9+' : unreadCount}
        </span>
      )}
    </button>
  )
}

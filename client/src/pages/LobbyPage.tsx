import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useRoomStore } from '../store/roomStore'
import { leaveRoomLocally } from '../store/leaveRoom'
import { socket } from '../socket'
import { RoomLobby, LobbyStartBar } from '../components/lobby/RoomLobby'
import { AudioControls } from '../components/game/AudioControls'
import { StageBackdrop } from '../components/ui/Escenario'

// TEMP (2026-10-16): measure the lobby's bottom bar on the iOS home-screen app; remove once it sits right
function ViewportProbe() {
  const [text, setText] = useState('')
  useEffect(() => {
    if (!document.documentElement.classList.contains('standalone')) return
    const read = () => {
      const r = (s: string) => document.querySelector(s)?.getBoundingClientRect()
      const bar = document.querySelector('[data-start-bar]') as HTMLElement | null
      const btn = bar?.querySelector('button')?.getBoundingClientRect()
      setText([
        `in ${innerHeight}`, `cli ${document.documentElement.clientHeight}`,
        `app ${document.documentElement.style.getPropertyValue('--app-h')}`,
        `box ${Math.round(r('.felt-table')?.bottom ?? 0)}`,
        `bar ${Math.round(bar?.getBoundingClientRect().top ?? 0)}-${Math.round(bar?.getBoundingClientRect().bottom ?? 0)}`,
        `pad ${bar ? getComputedStyle(bar).paddingBottom : '-'}`,
        `btn ${Math.round(btn?.bottom ?? 0)}`,
        `motion ${matchMedia('(prefers-reduced-motion: reduce)').matches ? 'reduce' : 'ok'}`,
      ].join(' · '))
    }
    read()
    const t = setInterval(read, 1000)
    return () => clearInterval(t)
  }, [])
  if (!text) return null
  return <p className="fixed left-0 right-0 z-[60] text-center font-mono text-[10px] text-white bg-black/80 py-0.5" style={{ top: 'var(--safe-top)' }}>{text}</p>
}

export function LobbyPage() {
  const room = useRoomStore(s => s.room)
  const navigate = useNavigate()

  useEffect(() => {
    if (!room) {
      navigate('/')
    }
  }, [room, navigate])

  // Nothing is lost before the first game, so leave without asking
  const handleBack = () => {
    socket.emit('room:leave')
    leaveRoomLocally()
    navigate('/')
  }

  return (
    // A column: the lobby scrolls, the start bar stays at the bottom of the screen.
    // Not position:sticky — iOS stops a sticky bottom at the home-indicator inset.
    <div className="fixed inset-0 felt-table flex flex-col">
      <StageBackdrop still />
      <ViewportProbe />
      {/* my-auto rather than items-center: a lobby taller than the screen scrolls from its top instead of being cut off */}
      <div
        className="relative flex-1 min-h-0 overflow-y-auto flex flex-col items-center px-4 pb-3"
        style={{ paddingTop: 'max(16px, env(safe-area-inset-top))' }}
      >
      <div className="relative my-auto w-full max-w-sm flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={handleBack}
            className="btn-outline-shine rounded-xl px-3 py-1.5 font-chunky text-base tracking-wide mm-stroke"
          >
            ‹ Menú
          </button>
          <AudioControls />
        </div>
        <RoomLobby />
      </div>
      </div>
      {/* The home indicator needs ~20pt of its 34pt inset; the bar's own top padding covers the rest */}
      <div
        data-start-bar
        className="relative flex justify-center px-4 pt-3 border-t-2 border-[rgba(234,179,8,0.35)]"
        style={{
          paddingBottom: 'max(0.75rem, calc(env(safe-area-inset-bottom, 0px) - 0.5rem))',
          background: 'linear-gradient(180deg, rgba(7,30,16,0.96), #0A1A0F)',
        }}
      >
        <div className="w-full max-w-sm">
          <LobbyStartBar />
        </div>
      </div>
    </div>
  )
}

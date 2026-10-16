import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useRoomStore } from '../store/roomStore'
import { leaveRoomLocally } from '../store/leaveRoom'
import { socket } from '../socket'
import { RoomLobby } from '../components/lobby/RoomLobby'
import { AudioControls } from '../components/game/AudioControls'
import { StageBackdrop } from '../components/ui/Escenario'

// TEMP (2026-10-16): measure the iOS home-screen viewport on the device; remove once the bottom gap is settled
function ViewportProbe() {
  const [text, setText] = useState('')
  useEffect(() => {
    if (!document.documentElement.classList.contains('standalone')) return
    const probe = document.createElement('div')
    probe.style.cssText = 'position:fixed;left:0;top:0;width:1px;height:1px;visibility:hidden;padding-bottom:env(safe-area-inset-bottom);padding-top:env(safe-area-inset-top)'
    document.body.appendChild(probe)
    const read = () => {
      const cs = getComputedStyle(probe)
      const root = document.documentElement
      const scroller = document.querySelector('.felt-table')?.getBoundingClientRect()
      const sticky = document.querySelector('[data-lobby-start]')?.getBoundingClientRect()
      setText([
        `in ${innerHeight}x${innerWidth}`, `scr ${screen.height}x${screen.width}`,
        `vv ${Math.round(visualViewport?.height ?? 0)}`, `cli ${root.clientHeight}`,
        `app ${root.style.getPropertyValue('--app-h')}`, `env ${cs.paddingTop}/${cs.paddingBottom}`,
        `box ${Math.round(scroller?.bottom ?? 0)}`, `start ${Math.round(sticky?.bottom ?? 0)}`,
      ].join(' · '))
    }
    read()
    const t = setInterval(read, 1000)
    return () => { clearInterval(t); probe.remove() }
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
    // my-auto rather than items-center: a lobby taller than the screen scrolls from its top instead of being cut off
    <div
      className="fixed inset-0 felt-table flex flex-col items-center px-4 overflow-y-auto"
      style={{ paddingTop: 'max(16px, env(safe-area-inset-top))' }}
    >
      <StageBackdrop still />
      <ViewportProbe />
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
  )
}

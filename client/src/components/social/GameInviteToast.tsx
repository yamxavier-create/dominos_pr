import { useEffect, useState } from 'react'
import { useSocialStore } from '../../store/socialStore'
import { useGameActions } from '../../hooks/useGameActions'
import { useAuthStore } from '../../store/authStore'
import { useRoomStore } from '../../store/roomStore'

export function GameInviteToast() {
  const invite = useSocialStore((s) => s.gameInvite)
  const setGameInvite = useSocialStore((s) => s.setGameInvite)
  const playerName = useAuthStore((s) => s.user?.displayName || '')
  const currentRoom = useRoomStore((s) => s.roomCode)
  const { joinRoom } = useGameActions()
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!invite) { setVisible(false); return }
    // Don't show if already in a room
    if (currentRoom) { setGameInvite(null); return }
    setVisible(true)
    const timer = setTimeout(() => {
      setVisible(false)
      setGameInvite(null)
    }, 15000)
    return () => clearTimeout(timer)
  }, [invite])

  const handleJoin = () => {
    if (!invite || !playerName) return
    joinRoom(invite.roomCode, playerName)
    setVisible(false)
    setGameInvite(null)
  }

  const handleDismiss = () => {
    setVisible(false)
    setGameInvite(null)
  }

  if (!visible || !invite) return null

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-[90%] max-w-sm animate-slide-down">
      <div
        className="rounded-2xl p-4 shadow-2xl flex items-center gap-3"
        style={{ background: 'rgba(15,35,24,0.95)', border: '1px solid rgba(34,197,94,0.3)', backdropFilter: 'blur(12px)' }}
      >
        <div className="flex-1 min-w-0">
          <p className="font-body text-white text-sm font-semibold truncate">
            {invite.from.displayName} te invita a jugar
          </p>
          <p className="font-body text-white/50 text-xs mt-0.5">
            {invite.playerCount}/4 jugadores · {invite.gameMode === 'modo200' ? 'Modo 200' : 'Modo 500'}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleJoin}
            className="font-body text-xs font-bold px-4 py-2 rounded-xl text-white transition-all hover:opacity-90 active:scale-95"
            style={{ background: 'linear-gradient(135deg, #22C55E, #16a34a)' }}
          >
            Unirse
          </button>
          <button
            onClick={handleDismiss}
            className="text-white/30 hover:text-white/60 transition-colors text-lg leading-none"
          >
            ×
          </button>
        </div>
      </div>
    </div>
  )
}

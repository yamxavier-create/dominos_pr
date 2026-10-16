import { useEffect, useState } from 'react'
import { useSocialStore } from '../../store/socialStore'
import { useGameActions } from '../../hooks/useGameActions'
import { useAuthStore } from '../../store/authStore'
import { useRoomStore } from '../../store/roomStore'
import { MODE_NAMES } from '../../rules'
import { GameMode } from '../../types/game'

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
        className="mm-panel p-4 flex items-center gap-3"
      >
        <div className="flex-1 min-w-0">
          <p className="font-chunky text-white text-base tracking-wide truncate">
            {invite.from.displayName} te invita a jugar
          </p>
          <p className="font-body font-bold text-white/75 text-xs mt-0.5">
            {invite.playerCount}/4 jugadores · {MODE_NAMES[invite.gameMode as GameMode] ?? invite.gameMode}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleJoin}
            className="mm-btn-gold !w-auto !text-sm !px-3 !py-1.5 !rounded-xl mm-stroke mm-ring"
          >
            Unirse
          </button>
          <button
            onClick={handleDismiss}
            aria-label="Cerrar"
            className="font-chunky text-white/75 hover:text-white transition-colors text-2xl leading-none px-1"
          >
            ×
          </button>
        </div>
      </div>
    </div>
  )
}

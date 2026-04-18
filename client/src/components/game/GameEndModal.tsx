import { useState, useEffect } from 'react'
import { useGameStore } from '../../store/gameStore'
import { useUIStore } from '../../store/uiStore'
import { useRoomStore } from '../../store/roomStore'
import { useAuthStore } from '../../store/authStore'
import { socket } from '../../socket'
import { GoldCTA, GoldCaption } from '../ui/GoldCTA'

export function GameEndModal() {
  const gameEndData = useGameStore(s => s.gameEndData)
  const gameState = useGameStore(s => s.gameState)
  const showGameEnd = useUIStore(s => s.showGameEnd)
  const rematchVotes = useUIStore(s => s.rematchVotes)
  const rematchPlayerNames = useUIStore(s => s.rematchPlayerNames)
  const rematchCancelled = useUIStore(s => s.rematchCancelled)
  const myPlayerIndex = useRoomStore(s => s.myPlayerIndex)
  const roomCode = useRoomStore(s => s.roomCode)

  const isAuthenticated = useAuthStore(s => s.isAuthenticated)
  const authUserId = useAuthStore(s => s.user?.id)
  const [opponentStatuses, setOpponentStatuses] = useState<Record<string, { status: string; direction: string | null }> | null>(null)
  const [sentRequests, setSentRequests] = useState<Set<string>>(new Set())

  const [showRevancha, setShowRevancha] = useState(false)
  const [peek, setPeek] = useState(false)

  useEffect(() => {
    if (!showGameEnd) {
      setShowRevancha(false)
      setPeek(false)
      return
    }
    const timer = setTimeout(() => setShowRevancha(true), 2500)
    return () => clearTimeout(timer)
  }, [showGameEnd])

  // Fetch friendship statuses when game end modal shows
  useEffect(() => {
    if (!showGameEnd || !isAuthenticated || !gameEndData) return
    const gameState = useGameStore.getState().gameState
    if (!gameState) return

    const playerUserIds = gameState.players
      .filter(p => !p.isMe && p.userId && p.userId !== authUserId)
      .map(p => p.userId!)

    if (playerUserIds.length === 0) {
      setOpponentStatuses({})
      return
    }

    socket.emit('social:check_users', { userIds: playerUserIds }, (res: { users: Record<string, { status: string; direction: string | null }> }) => {
      setOpponentStatuses(res.users)
    })

    // Reset sent requests tracking
    setSentRequests(new Set())
  }, [showGameEnd, isAuthenticated, gameEndData, authUserId])

  if (!showGameEnd || !gameEndData) return null

  const playerCount = gameState?.playerCount ?? 4
  const is2Player = playerCount === 2

  const myTeam = (myPlayerIndex ?? 0) % 2 === 0 ? 0 : 1
  const weWon = gameEndData.winningTeam === myTeam
  const winTeamColor = gameEndData.winningTeam === 0 ? '#22C55E' : '#F97316'

  const hasVoted = rematchVotes.includes(myPlayerIndex ?? -1)
  const allVoted = rematchVotes.length === playerCount

  const handleRematchVote = () => {
    socket.emit('game:rematch_vote', { roomCode })
  }

  const handleAddFriend = (targetUserId: string) => {
    socket.emit('social:friend_request', { targetUserId })
    setSentRequests(prev => new Set(prev).add(targetUserId))
  }

  // Team labels relative to player
  const team0Label = is2Player
    ? (rematchPlayerNames[0] ?? gameState?.players[0]?.name ?? 'J1')
    : myTeam === 0 ? 'Nosotros' : 'Ellos'
  const team1Label = is2Player
    ? (rematchPlayerNames[1] ?? gameState?.players[1]?.name ?? 'J2')
    : myTeam === 1 ? 'Nosotros' : 'Ellos'
  const winnerText = is2Player
    ? (weWon ? '¡Ganaste el partido!' : 'Perdiste el partido')
    : (weWon ? 'Nosotros ganamos el partido' : 'Ellos ganaron el partido')

  if (peek) {
    return (
      <button
        onClick={() => setPeek(false)}
        className="fixed z-50 bottom-6 left-1/2 -translate-x-1/2 px-5 py-3 rounded-full font-body font-bold text-white shadow-xl active:scale-95 transition-transform"
        style={{
          background: 'linear-gradient(135deg, #22C55E, #16a34a)',
          paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom))',
        }}
      >
        Ver resumen
      </button>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      {/* Peek button — hides modal to reveal the final board */}
      <button
        onClick={() => setPeek(true)}
        className="absolute top-4 right-4 w-10 h-10 rounded-full flex items-center justify-center bg-black/40 border border-white/20 text-white/80 active:scale-95 transition-transform"
        style={{ backdropFilter: 'blur(8px)' }}
        aria-label="Ver mesa"
      >
        👁
      </button>
      {/* Animated gradient border wrapper */}
      <div
        className="modal-enter p-0.5 rounded-2xl w-full max-w-sm"
        style={{
          background: `linear-gradient(135deg, ${winTeamColor}, #EAB308, ${winTeamColor})`,
          backgroundSize: '200% 200%',
          animation: 'gradient-border 3s ease infinite',
        }}
      >
        <div className="rounded-2xl overflow-hidden text-center" style={{ background: '#0F2318' }}>
          {/* Header */}
          <div
            className="px-6 pt-8 pb-6 flex flex-col items-center gap-2"
            style={{ background: `linear-gradient(to bottom, ${winTeamColor}25, transparent)` }}
          >
            <GoldCaption>Fin de Partida</GoldCaption>
            <div className="text-6xl mb-1">{weWon ? '🏆' : '🤝'}</div>
            <h1
              className="font-header leading-[0.9] text-[3.4rem]"
              style={{
                color: weWon ? '#EAB308' : '#FFFFFF',
                letterSpacing: '0.04em',
                textShadow: weWon
                  ? '0 0 50px rgba(234,179,8,0.45), 0 2px 8px rgba(0,0,0,0.5)'
                  : '0 2px 8px rgba(0,0,0,0.5)',
              }}
            >
              {weWon ? (is2Player ? '¡GANASTE!' : '¡GANAMOS!') : (is2Player ? 'PERDISTE' : 'PERDIMOS')}
            </h1>
            <p className="font-body text-white/60 mt-1 text-sm">
              {winnerText}
            </p>
          </div>

          {/* Final Scores */}
          <div className="px-6 py-5 border-t border-white/10">
            <p className="font-body text-white/40 text-xs mb-4 uppercase tracking-wider">Marcador Final</p>
            <div className="flex justify-around items-center">
              <div className="text-center">
                <p className="font-body text-sm mb-1" style={{ color: '#22C55E' }}>{team0Label}</p>
                <p className={`font-header text-5xl leading-none ${gameEndData.winningTeam === 0 ? 'text-gold' : 'text-white/40'}`}>
                  {gameEndData.finalScores.team0}
                </p>
              </div>
              <div className="font-body text-white/20 text-2xl">vs</div>
              <div className="text-center">
                <p className="font-body text-sm mb-1" style={{ color: '#F97316' }}>{team1Label}</p>
                <p className={`font-header text-5xl leading-none ${gameEndData.winningTeam === 1 ? 'text-gold' : 'text-white/40'}`}>
                  {gameEndData.finalScores.team1}
                </p>
              </div>
            </div>
            <p className="font-body text-white/30 text-xs mt-4">
              {gameEndData.totalRounds} {gameEndData.totalRounds === 1 ? 'mano' : 'manos'} jugadas
            </p>
          </div>

          {/* Rematch voting section */}
          <div className="px-6 pb-8 pt-2">
            {/* Revancha button */}
            <div
              className="transition-opacity duration-500"
              style={{ opacity: showRevancha ? 1 : 0, pointerEvents: showRevancha ? 'auto' : 'none' }}
            >
              <GoldCTA
                onClick={handleRematchVote}
                disabled={hasVoted || allVoted || !!rematchCancelled}
                size="md"
              >
                {hasVoted ? '✓ LISTO' : 'REVANCHA'}
              </GoldCTA>
            </div>

            {/* Vote counter and player list */}
            {rematchVotes.length > 0 && !allVoted && (
              <div className="mt-4">
                <p className="font-body text-white/60 text-sm mb-2">
                  {rematchVotes.length}/{playerCount} listos
                </p>
                <div className="space-y-1">
                  {rematchPlayerNames.map((name, idx) => {
                    const voted = rematchVotes.includes(idx)
                    const disconnected = rematchCancelled?.playerIndex === idx
                    return (
                      <div key={idx} className="flex items-center justify-between px-4 py-1">
                        <span className="font-body text-white/70 text-sm">{name}</span>
                        {disconnected ? (
                          <span className="text-red-400 font-bold">✕</span>
                        ) : voted ? (
                          <span
                            className="transition-transform duration-200 inline-block text-green-400 font-bold"
                            style={{ transform: 'scale(1)' }}
                          >
                            ✓
                          </span>
                        ) : (
                          <span className="text-white/30 text-sm">...</span>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Celebration */}
            {allVoted && !rematchCancelled && (
              <div className="mt-4">
                <p
                  className="font-header text-3xl text-gold transition-transform duration-300"
                  style={{ animation: 'scale-in 300ms ease-out forwards' }}
                >
                  ¡Revancha! 🔥
                </p>
                <style>{`
                  @keyframes scale-in {
                    from { transform: scale(0); opacity: 0; }
                    to { transform: scale(1); opacity: 1; }
                  }
                `}</style>
              </div>
            )}

            {/* Disconnect cancellation */}
            {rematchCancelled && (
              <div className="mt-4 bg-red-900/40 border border-red-500/30 rounded-lg px-4 py-3">
                <p className="font-body text-red-300 text-sm">
                  {rematchCancelled.playerName} se desconecto. Revancha cancelada.
                </p>
              </div>
            )}
          </div>

          {/* Add Friend section -- only for authenticated users */}
          {isAuthenticated && opponentStatuses && Object.keys(opponentStatuses).length > 0 && (
            <div className="px-6 pb-4 border-t border-white/10 pt-3">
              <p className="font-body text-white/40 text-xs mb-2 uppercase tracking-wider">
                Agregar Amigo
              </p>
              {gameState?.players
                .filter(p => !p.isMe && p.userId && p.userId !== authUserId)
                .map(p => {
                  const friendStatus = opponentStatuses[p.userId!]
                  if (!friendStatus) return null
                  const isFriend = friendStatus.status === 'ACCEPTED'
                  const isPending = friendStatus.status === 'PENDING' || sentRequests.has(p.userId!)
                  return (
                    <div key={p.index} className="flex items-center justify-between py-1.5">
                      <span className="font-body text-white/70 text-sm">{p.name}</span>
                      {isFriend ? (
                        <span className="font-body text-green-400 text-xs">Amigos</span>
                      ) : isPending ? (
                        <span className="font-body text-white/40 text-xs">Pendiente</span>
                      ) : (
                        <button
                          onClick={() => handleAddFriend(p.userId!)}
                          className="font-body text-xs font-bold px-3 py-1 rounded-lg bg-green-500/20 text-green-400 hover:bg-green-500/30 transition-colors"
                        >
                          Agregar
                        </button>
                      )}
                    </div>
                  )
                })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

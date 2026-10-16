import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useGameStore } from '../../store/gameStore'
import { useUIStore } from '../../store/uiStore'
import { useRoomStore } from '../../store/roomStore'
import { useAuthStore } from '../../store/authStore'
import { socket } from '../../socket'
import { GoldCTA, GoldCaption } from '../ui/GoldCTA'
import { leaveRoomLocally } from '../../store/leaveRoom'

export function GameEndModal() {
  const gameEndData = useGameStore(s => s.gameEndData)
  const gameState = useGameStore(s => s.gameState)
  const showGameEnd = useUIStore(s => s.showGameEnd)
  const rematchVotes = useUIStore(s => s.rematchVotes)
  const rematchPlayerNames = useUIStore(s => s.rematchPlayerNames)
  const rematchCancelled = useUIStore(s => s.rematchCancelled)
  const myPlayerIndex = useRoomStore(s => s.myPlayerIndex)
  const roomCode = useRoomStore(s => s.roomCode)
  // Compare to the live socket: the host may have moved mid-game
  const isHost = useRoomStore(s => s.room?.hostSocketId === socket.id)

  const isAuthenticated = useAuthStore(s => s.isAuthenticated)
  const authUserId = useAuthStore(s => s.user?.id)
  const [opponentStatuses, setOpponentStatuses] = useState<Record<string, { status: string; direction: string | null }> | null>(null)
  const [sentRequests, setSentRequests] = useState<Set<string>>(new Set())

  const navigate = useNavigate()
  // The game is over: leaving now costs nobody anything, so no confirmation
  const goToMenu = () => {
    socket.emit('room:leave')
    leaveRoomLocally()
    navigate('/')
  }

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
        className="mm-btn-gold mm-stroke mm-rise fixed z-50 left-1/2 -translate-x-1/2 !w-auto px-6"
        style={{ bottom: 'calc(1.5rem + env(safe-area-inset-bottom) - var(--vp-gap))' }}
      >
        Ver resumen
      </button>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex overflow-y-auto mm-modal-backdrop p-4">
      {/* Peek button — hides modal to reveal the final board */}
      <button
        onClick={() => setPeek(true)}
        className="club-btn absolute right-4 gap-1.5 px-3 h-10 font-chunky text-sm tracking-wide"
        style={{ top: 'calc(16px + var(--safe-top))' }}
        aria-label="Ver mesa"
      >
        <span>👁</span>
        <span>Ver mesa</span>
      </button>
      <div className="mm-pop m-auto w-full max-w-sm">
        <div className="mm-panel overflow-hidden text-center">
          {/* Header */}
          <div
            className="px-6 pt-8 pb-6 flex flex-col items-center gap-2"
            style={{ background: `linear-gradient(to bottom, ${winTeamColor}25, transparent)` }}
          >
            <GoldCaption>Fin de Partida</GoldCaption>
            <div className="text-6xl mb-1">{weWon ? '🏆' : '🤝'}</div>
            <h1
              className={`font-chunky leading-[0.9] text-[3rem] tracking-wide ${weWon ? 'mm-title' : 'mm-stroke'}`}
            >
              {weWon ? (is2Player ? '¡GANASTE!' : '¡GANAMOS!') : (is2Player ? 'PERDISTE' : 'PERDIMOS')}
            </h1>
            <p className="font-body font-bold text-white/80 mt-1 text-sm">
              {winnerText}
            </p>
          </div>

          {/* Final Scores */}
          <div className="mm-well mx-4 px-4 py-4">
            <p className="font-chunky text-[#FDE68A] text-sm mb-3 uppercase tracking-wider">Marcador Final</p>
            <div className="flex justify-around items-center">
              <div className="text-center">
                <p className="font-body font-extrabold text-sm mb-1" style={{ color: '#5BEA9B' }}>{team0Label}</p>
                <p className={`font-chunky text-5xl leading-none ${gameEndData.winningTeam === 0 ? 'mm-title' : 'mm-stroke opacity-70'}`}>
                  {gameEndData.finalScores.team0}
                </p>
              </div>
              <div className="font-chunky text-white/60 text-2xl">vs</div>
              <div className="text-center">
                <p className="font-body font-extrabold text-sm mb-1" style={{ color: '#FFA270' }}>{team1Label}</p>
                <p className={`font-chunky text-5xl leading-none ${gameEndData.winningTeam === 1 ? 'mm-title' : 'mm-stroke opacity-70'}`}>
                  {gameEndData.finalScores.team1}
                </p>
              </div>
            </div>
            <p className="font-body font-bold text-white/70 text-xs mt-3">
              {gameEndData.totalRounds} {gameEndData.totalRounds === 1 ? 'mano' : 'manos'} jugadas
            </p>
          </div>

          {/* Rematch voting section */}
          <div className="px-6 pb-8 pt-4">
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
              {/* Back to the room: the call stays up; change seats or bots, then play again */}
              {isHost ? (
                <button
                  type="button"
                  onClick={() => socket.emit('room:back_to_lobby', { roomCode })}
                  disabled={allVoted && !rematchCancelled}
                  className="w-full mt-3 font-chunky text-lg tracking-wide py-2 rounded-xl mm-stroke btn-outline-shine disabled:opacity-40"
                >
                  Volver a la sala
                </button>
              ) : (
                <p className="font-body font-bold text-white/70 text-xs mt-3">El host puede llevarlos de vuelta a la sala</p>
              )}
              <button
                type="button"
                onClick={goToMenu}
                className="w-full mt-2 font-chunky text-base tracking-wide py-2 rounded-xl text-white/80 mm-stroke hover:text-white"
              >
                Menú principal
              </button>
            </div>

            {/* Vote counter and player list */}
            {rematchVotes.length > 0 && !allVoted && (
              <div className="mt-4">
                <p className="font-chunky text-white text-base mb-2 mm-stroke">
                  {rematchVotes.length}/{playerCount} listos
                </p>
                <div className="mm-well space-y-1 py-1">
                  {rematchPlayerNames.map((name, idx) => {
                    const voted = rematchVotes.includes(idx)
                    const disconnected = rematchCancelled?.playerIndex === idx
                    return (
                      <div key={idx} className="flex items-center justify-between px-4 py-1">
                        <span className="font-body font-extrabold text-white/85 text-sm">{name}</span>
                        {disconnected ? (
                          <span className="font-chunky text-[#FF8A80]">✕</span>
                        ) : voted ? (
                          <span
                            className="transition-transform duration-200 inline-block font-chunky text-[#5BEA9B]"
                            style={{ transform: 'scale(1)' }}
                          >
                            ✓
                          </span>
                        ) : (
                          <span className="text-white/60 font-bold text-sm">...</span>
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
                  className="mm-title text-3xl transition-transform duration-300"
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
              <div className="mt-4 rounded-xl px-4 py-3" style={{ background: 'linear-gradient(180deg, #C2392F, #8E2A22)', border: '2px solid #06140B', boxShadow: '0 4px 0 #06140B' }}>
                <p className="font-body font-extrabold text-white text-sm">
                  {rematchCancelled.playerName} se desconecto. Revancha cancelada.
                </p>
              </div>
            )}
          </div>

          {/* Add Friend section -- only for authenticated users */}
          {isAuthenticated && opponentStatuses && Object.keys(opponentStatuses).length > 0 && (
            <div className="mm-well mx-4 mb-4 px-4 pb-2 pt-3">
              <p className="font-chunky text-[#FDE68A] text-sm mb-2 uppercase tracking-wider">
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
                      <span className="font-body font-extrabold text-white/85 text-sm">{p.name}</span>
                      {isFriend ? (
                        <span className="mm-chip" style={{ background: 'linear-gradient(180deg, #5BEA9B, #1FB862)' }}>Amigos</span>
                      ) : isPending ? (
                        <span className="font-body font-bold text-white/70 text-xs">Pendiente</span>
                      ) : (
                        <button
                          onClick={() => handleAddFriend(p.userId!)}
                          className="mm-btn-green mm-stroke !w-auto !text-sm !px-3 !py-1 !rounded-xl"
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

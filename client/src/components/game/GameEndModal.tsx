import { useState, useEffect } from 'react'
import { useGameStore } from '../../store/gameStore'
import { useUIStore } from '../../store/uiStore'
import { useRoomStore } from '../../store/roomStore'
import { socket } from '../../socket'

export function GameEndModal() {
  const gameEndData = useGameStore(s => s.gameEndData)
  const showGameEnd = useUIStore(s => s.showGameEnd)
  const rematchVotes = useUIStore(s => s.rematchVotes)
  const rematchPlayerNames = useUIStore(s => s.rematchPlayerNames)
  const rematchCancelled = useUIStore(s => s.rematchCancelled)
  const myPlayerIndex = useRoomStore(s => s.myPlayerIndex)
  const roomCode = useRoomStore(s => s.roomCode)

  const [showRevancha, setShowRevancha] = useState(false)

  useEffect(() => {
    if (!showGameEnd) {
      setShowRevancha(false)
      return
    }
    const timer = setTimeout(() => setShowRevancha(true), 2500)
    return () => clearTimeout(timer)
  }, [showGameEnd])

  if (!showGameEnd || !gameEndData) return null

  const gameState = useGameStore(s => s.gameState)
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
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
            className="px-6 pt-8 pb-6"
            style={{ background: `linear-gradient(to bottom, ${winTeamColor}25, transparent)` }}
          >
            <div className="text-6xl mb-3">{weWon ? '🏆' : '🤝'}</div>
            <h1 className="font-header text-5xl text-gold leading-none">
              {weWon ? (is2Player ? '¡Ganaste!' : '¡Ganamos!') : (is2Player ? 'Perdiste' : 'Perdimos')}
            </h1>
            <p className="font-body text-white/60 mt-2 text-sm">
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
              <button
                onClick={handleRematchVote}
                disabled={hasVoted || allVoted || !!rematchCancelled}
                className="w-full text-white font-body font-bold py-4 rounded-xl transition-all hover:opacity-90 active:scale-95 text-lg disabled:opacity-60 disabled:cursor-default disabled:active:scale-100"
                style={{ background: 'linear-gradient(135deg, #22C55E, #16a34a)' }}
              >
                {hasVoted ? '✓ Listo' : 'Revancha'}
              </button>
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
        </div>
      </div>
    </div>
  )
}

import { useGameStore } from '../../store/gameStore'
import { useUIStore } from '../../store/uiStore'
import { useRoomStore } from '../../store/roomStore'
import { socket } from '../../socket'

export function GameEndModal() {
  const gameEndData = useGameStore(s => s.gameEndData)
  const showGameEnd = useUIStore(s => s.showGameEnd)
  const myPlayerIndex = useRoomStore(s => s.myPlayerIndex)
  const roomCode = useRoomStore(s => s.roomCode)
  const room = useRoomStore(s => s.room)
  const isHost = room?.hostSocketId === socket.id

  if (!showGameEnd || !gameEndData) return null

  const myTeam = (myPlayerIndex ?? 0) % 2 === 0 ? 0 : 1
  const weWon = gameEndData.winningTeam === myTeam
  const winTeamColor = gameEndData.winningTeam === 0 ? '#22C55E' : '#F97316'

  const handlePlayAgain = () => {
    socket.emit('game:next_game', { roomCode })
    // Modal will close when state_snapshot with phase=playing arrives in useSocket
  }

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
              {weWon ? '¡Ganamos!' : 'Perdimos'}
            </h1>
            <p className="font-body text-white/60 mt-2 text-sm">
              {gameEndData.winningTeam === 0 ? 'Equipo A' : 'Equipo B'} ganó el partido
            </p>
          </div>

          {/* Final Scores */}
          <div className="px-6 py-5 border-t border-white/10">
            <p className="font-body text-white/40 text-xs mb-4 uppercase tracking-wider">Marcador Final</p>
            <div className="flex justify-around items-center">
              <div className="text-center">
                <p className="font-body text-sm mb-1" style={{ color: '#22C55E' }}>Equipo A</p>
                <p className={`font-header text-5xl leading-none ${gameEndData.winningTeam === 0 ? 'text-gold' : 'text-white/40'}`}>
                  {gameEndData.finalScores.team0}
                </p>
              </div>
              <div className="font-body text-white/20 text-2xl">vs</div>
              <div className="text-center">
                <p className="font-body text-sm mb-1" style={{ color: '#F97316' }}>Equipo B</p>
                <p className={`font-header text-5xl leading-none ${gameEndData.winningTeam === 1 ? 'text-gold' : 'text-white/40'}`}>
                  {gameEndData.finalScores.team1}
                </p>
              </div>
            </div>
            <p className="font-body text-white/30 text-xs mt-4">
              {gameEndData.totalRounds} {gameEndData.totalRounds === 1 ? 'mano' : 'manos'} jugadas
            </p>
          </div>

          {/* Play again */}
          <div className="px-6 pb-8 pt-2">
            {isHost ? (
              <button
                onClick={handlePlayAgain}
                className="w-full text-white font-body font-bold py-4 rounded-xl transition-all hover:opacity-90 active:scale-95 text-lg"
                style={{ background: 'linear-gradient(135deg, #22C55E, #16a34a)' }}
              >
                Jugar de Nuevo
              </button>
            ) : (
              <p className="text-center font-body text-white/40 text-sm py-4">
                Esperando al host...
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

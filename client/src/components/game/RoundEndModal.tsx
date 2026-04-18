import { useEffect, useState } from 'react'
import { useGameStore } from '../../store/gameStore'
import { useUIStore } from '../../store/uiStore'
import { useRoomStore } from '../../store/roomStore'
import { useGameActions } from '../../hooks/useGameActions'
import { DominoTile } from '../domino/DominoTile'
import { socket } from '../../socket'

export function RoundEndModal() {
  const roundEndData = useGameStore(s => s.roundEndData)
  const gameEndData = useGameStore(s => s.gameEndData)
  const gameState = useGameStore(s => s.gameState)
  const showRoundEnd = useUIStore(s => s.showRoundEnd)
  const { setShowRoundEnd } = useUIStore()
  const { clearRoundEnd } = useGameStore()
  const myPlayerIndex = useRoomStore(s => s.myPlayerIndex)
  const room = useRoomStore(s => s.room)
  const { startNextHand } = useGameActions()

  const [peek, setPeek] = useState(false)
  useEffect(() => {
    if (!showRoundEnd) setPeek(false)
  }, [showRoundEnd])

  if (!showRoundEnd || !roundEndData || gameEndData) return null

  // BUG-02: compare hostSocketId to live socket.id — correct after host promotion
  const isHost = room?.hostSocketId === socket.id
  const isModo200 = gameState?.gameMode === 'modo200'

  const handleNextHand = () => {
    startNextHand()
    setShowRoundEnd(false)
    clearRoundEnd()
  }

  const playerCount = gameState?.playerCount ?? 4
  const is2Player = playerCount === 2
  const myTeam = (myPlayerIndex ?? 0) % 2 === 0 ? 0 : 1
  const weWon = roundEndData.winningTeam === myTeam
  const blocked = roundEndData.reason === 'blocked'

  const headerGradient = blocked
    ? 'from-amber-900/40 to-transparent'
    : weWon
    ? 'from-primary/25 to-transparent'
    : 'from-accent/15 to-transparent'

  if (peek) {
    return (
      <button
        onClick={() => setPeek(false)}
        className="fixed z-40 bottom-6 left-1/2 -translate-x-1/2 px-5 py-3 rounded-full font-body font-bold text-white shadow-xl active:scale-95 transition-transform"
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
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
      <button
        onClick={() => setPeek(true)}
        className="absolute top-4 right-4 w-10 h-10 rounded-full flex items-center justify-center bg-black/40 border border-white/20 text-white/80 active:scale-95 transition-transform z-10"
        style={{ backdropFilter: 'blur(8px)' }}
        aria-label="Ver mesa"
      >
        👁
      </button>
      <div className="modal-enter w-full max-w-sm shadow-2xl overflow-hidden rounded-2xl"
        style={{ background: '#0F2318', border: '1px solid rgba(255,255,255,0.10)' }}
      >
        {/* Header */}
        <div className={`px-6 pt-6 pb-4 text-center bg-gradient-to-b ${headerGradient}`}>
          {blocked ? (
            <>
              <div className="text-4xl mb-1">🔒</div>
              <h2 className="font-header text-3xl text-gold">¡Trancado!</h2>
              <p className="font-body text-white/60 text-sm mt-1">Nadie puede jugar</p>
            </>
          ) : weWon ? (
            <>
              <div className="text-4xl mb-1">🎉</div>
              <h2 className="font-header text-3xl text-gold">
                {is2Player ? '¡Ganaste esta mano!' : '¡Ganamos esta mano!'}
              </h2>
            </>
          ) : (
            <>
              <div className="text-4xl mb-1">😤</div>
              <h2 className="font-header text-3xl text-accent">
                {is2Player ? 'Perdiste esta mano' : 'Perdimos esta mano'}
              </h2>
            </>
          )}
        </div>

        {/* Special badges */}
        {roundEndData.reason === 'blocked' && (
          <div className="flex justify-center px-6 py-2">
            <span className="bg-white/10 text-white/70 font-bold text-sm px-3 py-1 rounded-full border border-white/20">
              ¡Trancado!
            </span>
          </div>
        )}
        {!isModo200 && (roundEndData.isCapicu || roundEndData.isChuchazo) && (
          <div className="flex justify-center gap-2 px-6 py-2">
            {roundEndData.isCapicu && (
              <span className="bg-gold text-bg font-bold text-sm px-3 py-1 rounded-full">
                ¡Capicú! +100
              </span>
            )}
            {roundEndData.isChuchazo && (
              <span className="bg-accent text-white font-bold text-sm px-3 py-1 rounded-full">
                ¡Chuchazo! +100
              </span>
            )}
          </div>
        )}

        {/* Points breakdown */}
        <div className="px-6 py-3 border-t border-white/10">
          <div className="flex justify-between items-center text-sm font-body mb-1">
            <span className="text-white/60">
              {roundEndData.reason === 'blocked' ? 'Trancado' : 'Fichas'}
              {isModo200 && roundEndData.rawPipCount !== undefined && ` (${roundEndData.rawPipCount} pips)`}
            </span>
            <span className="text-white font-bold">+{roundEndData.pointsFromPips}</span>
          </div>
          {isModo200 && (roundEndData.passPointsThisHand ?? 0) > 0 && (
            <div className="flex justify-between items-center text-sm font-body mb-1">
              <span className="text-white/60">Pases</span>
              <span className="text-white font-bold">+{roundEndData.passPointsThisHand}</span>
            </div>
          )}
          {roundEndData.bonusPoints > 0 && (
            <div className="flex justify-between items-center text-sm font-body mb-1">
              <span className="text-gold">Bonificación</span>
              <span className="text-gold font-bold">+{roundEndData.bonusPoints}</span>
            </div>
          )}
          <div className="flex justify-between items-center font-body border-t border-white/10 pt-1.5 mt-1.5">
            <span className="text-white font-semibold">Total ganado</span>
            <span className="font-header text-2xl text-white leading-none">+{roundEndData.totalPointsScored + (roundEndData.passPointsThisHand ?? 0)}</span>
          </div>
        </div>

        {/* Remaining tiles */}
        <div className="px-6 py-3 border-t border-white/10">
          <p className="font-body text-white/40 text-xs mb-2 uppercase tracking-wider">Fichas restantes</p>
          <div className="space-y-1.5">
            {roundEndData.remainingTiles.map(rt => (
              <div key={rt.playerIndex} className="flex items-center gap-2">
                <span className="font-body text-white/70 text-xs w-20 truncate">{rt.playerName}</span>
                <div className="flex gap-0.5 flex-wrap flex-1">
                  {rt.tiles.length === 0 ? (
                    <span className="text-primary text-xs font-body">Sin fichas ✓</span>
                  ) : (
                    rt.tiles.slice(0, 7).map(t => (
                      <DominoTile
                        key={t.id}
                        pip1={t.low}
                        pip2={t.high}
                        orientation="vertical"
                        style={{ width: 14, height: 28 }}
                      />
                    ))
                  )}
                </div>
                {rt.tiles.length > 0 && (
                  <span className="font-body text-white/50 text-xs shrink-0">{rt.pipSum}</span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Scores summary */}
        <div className="px-6 py-3 border-t border-white/10 bg-black/20">
          <div className="flex justify-around text-center">
            <div>
              <p className="font-body text-xs mb-0.5" style={{ color: '#22C55E' }}>
                {is2Player ? (gameState?.players[0]?.name ?? 'J1') : 'Equipo A'}
              </p>
              <p className="font-header text-2xl text-white">{roundEndData.scores.team0}</p>
            </div>
            <div className="text-white/20 font-body self-center">vs</div>
            <div>
              <p className="font-body text-xs mb-0.5" style={{ color: '#F97316' }}>
                {is2Player ? (gameState?.players[1]?.name ?? 'J2') : 'Equipo B'}
              </p>
              <p className="font-header text-2xl text-white">{roundEndData.scores.team1}</p>
            </div>
          </div>
        </div>

        {/* Next hand button */}
        <div className="px-6 pb-6 pt-3">
          {isHost ? (
            <button
              onClick={handleNextHand}
              className="w-full text-white font-body font-bold py-3 rounded-xl transition-all hover:opacity-90 active:scale-95"
              style={{ background: 'linear-gradient(135deg, #22C55E, #16a34a)' }}
            >
              Siguiente Mano →
            </button>
          ) : (
            <p className="text-center font-body text-white/40 text-sm">Esperando al host...</p>
          )}
        </div>
      </div>
    </div>
  )
}

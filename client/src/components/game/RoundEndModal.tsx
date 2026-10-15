import { useEffect, useState } from 'react'
import { useGameStore } from '../../store/gameStore'
import { useUIStore } from '../../store/uiStore'
import { useRoomStore } from '../../store/roomStore'
import { useGameActions } from '../../hooks/useGameActions'
import { DominoTile } from '../domino/DominoTile'
import { socket } from '../../socket'
import { GoldCTA, GoldCaption } from '../ui/GoldCTA'

export function RoundEndModal() {
  const roundEndData = useGameStore(s => s.roundEndData)
  const gameEndData = useGameStore(s => s.gameEndData)
  const gameState = useGameStore(s => s.gameState)
  const showRoundEnd = useUIStore(s => s.showRoundEnd)
  const showGameEnd = useUIStore(s => s.showGameEnd)
  const { setShowRoundEnd, setShowGameEnd } = useUIStore()
  const { clearRoundEnd } = useGameStore()
  const myPlayerIndex = useRoomStore(s => s.myPlayerIndex)
  const room = useRoomStore(s => s.room)
  const { startNextHand } = useGameActions()

  // The hand opens on the table, not the summary: everyone sees how it ended
  // and opens the summary when ready
  const [peek, setPeek] = useState(true)
  useEffect(() => {
    if (showRoundEnd) setPeek(true)
  }, [showRoundEnd])

  // The last hand of a game gets its summary too, before the final result
  if (!showRoundEnd || !roundEndData || showGameEnd) return null
  const isFinalHand = gameEndData !== null

  // BUG-02: compare hostSocketId to live socket.id — correct after host promotion
  const isHost = room?.hostSocketId === socket.id
  const isModo200 = gameState?.gameMode === 'modo200'

  const handleNextHand = () => {
    startNextHand()
    setShowRoundEnd(false)
    clearRoundEnd()
  }

  const handleShowResult = () => {
    setShowRoundEnd(false)
    setShowGameEnd(true)
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

  const outcome = blocked ? 'Trancado' : weWon ? (is2Player ? 'Ganaste' : 'Ganamos') : (is2Player ? 'Perdiste' : 'Perdimos')
  const handPoints = roundEndData.totalPointsScored + (roundEndData.passPointsThisHand ?? 0)

  if (peek) {
    return (
      <div
        // A full-width band over the bottom button row (over the score sign on a
        // phone held sideways, where the bottom row is your hand)
        className="hand-end-bar fixed inset-x-0 z-40 flex justify-center px-3 pointer-events-none"
      >
        <div
          className="pointer-events-auto flex items-center justify-between gap-3 w-full max-w-lg pl-4 pr-2 py-2 rounded-lg bg-club-strip font-club"
          style={{ border: '2px solid #C9A24A', boxShadow: '0 6px 18px rgba(0,0,0,0.45)' }}
          role="status"
        >
          <div className="min-w-0 leading-tight">
            <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-club-muted">
              {isFinalHand ? 'Última mano' : 'Fin de mano'}
            </p>
            <p className="text-base font-bold text-club-text truncate">
              {outcome}{handPoints > 0 && <span className="text-club-brass"> · +{handPoints}</span>}
            </p>
          </div>
          <button
            onClick={() => setPeek(false)}
            className="club-btn shrink-0 h-10 whitespace-nowrap font-club font-bold text-sm"
            style={{ paddingInline: 18 }}
          >
            Ver resumen
          </button>
        </div>
      </div>
    )
  }

  return (
    // Scrolls when the card is taller than the screen (phone landscape)
    <div className="fixed inset-0 z-40 flex overflow-y-auto bg-black/75 backdrop-blur-sm p-4">
      <div className="modal-enter m-auto w-full max-w-sm shadow-2xl overflow-hidden rounded-2xl"
        style={{ background: '#0F2318', border: '1px solid rgba(255,255,255,0.10)' }}
      >
        {/* Header */}
        <div className={`px-6 pt-6 pb-4 text-center bg-gradient-to-b ${headerGradient} flex flex-col items-center gap-1.5`}>
          <GoldCaption>{isFinalHand ? 'Última mano' : 'Fin de Mano'}</GoldCaption>
          {blocked ? (
            <>
              <div className="text-4xl mb-0.5">🔒</div>
              <h2
                className="font-header text-[2rem] sm:text-[2.3rem] leading-[0.95] text-white"
                style={{ letterSpacing: '0.02em', textShadow: '0 2px 8px rgba(0,0,0,0.5)' }}
              >
                ¡Trancado!
              </h2>
              <p className="font-body text-white/60 text-sm">Nadie puede jugar</p>
            </>
          ) : weWon ? (
            <>
              <div className="text-4xl mb-0.5">🎉</div>
              <h2
                className="font-header text-[2rem] sm:text-[2.3rem] leading-[0.95] text-white"
                style={{ letterSpacing: '0.02em', textShadow: '0 2px 8px rgba(0,0,0,0.5)' }}
              >
                {is2Player ? '¡Ganaste!' : '¡Ganamos!'}
              </h2>
            </>
          ) : (
            <>
              <div className="text-4xl mb-0.5">😤</div>
              <h2
                className="font-header text-[2rem] sm:text-[2.3rem] leading-[0.95]"
                style={{ color: '#F97316', letterSpacing: '0.02em', textShadow: '0 2px 8px rgba(0,0,0,0.5)' }}
              >
                {is2Player ? 'Perdiste' : 'Perdimos'}
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

        {/* Next hand (or the final result), and back to the table */}
        <div className="px-6 pb-6 pt-3 flex flex-col gap-3">
          {isFinalHand ? (
            <GoldCTA onClick={handleShowResult} size="md">
              VER RESULTADO
            </GoldCTA>
          ) : isHost ? (
            <GoldCTA onClick={handleNextHand} size="md">
              SIGUIENTE MANO
            </GoldCTA>
          ) : (
            <p className="text-center font-body text-white/40 text-sm">Esperando al host...</p>
          )}
          <button
            onClick={() => setPeek(true)}
            className="club-btn h-10 w-full font-club font-bold text-sm"
          >
            Ver mesa
          </button>
        </div>
      </div>
    </div>
  )
}

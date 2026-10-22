import { useEffect, useState } from 'react'
import { useGameStore } from '../../store/gameStore'
import { useUIStore } from '../../store/uiStore'
import { useRoomStore } from '../../store/roomStore'
import { useGameActions } from '../../hooks/useGameActions'
import { DominoTile } from '../domino/DominoTile'
import { socket } from '../../socket'
import { GoldCTA, GoldCaption } from '../ui/GoldCTA'
import { closedByLine } from './handClose'

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
    ? 'from-amber-500/25 to-transparent'
    : weWon
    ? 'from-[#5BEA9B]/30 to-transparent'
    : 'from-[#E5534A]/30 to-transparent'

  const outcome = blocked ? 'Trancado' : weWon ? (is2Player ? 'Ganaste' : 'Ganamos') : (is2Player ? 'Perdiste' : 'Perdimos')
  // "Trancó Bebo" / "Dominaste": who placed the last tile
  const closing = closedByLine(roundEndData.reason, roundEndData.closedByIndex, gameState?.players ?? [], myPlayerIndex)
  // Only what the hand's close scored. Pass points (Modo 200) already went
  // onto the scoreboard as each pass happened, so they stay out of this total.
  const handPoints = roundEndData.totalPointsScored

  if (peek) {
    return (
      <div
        // A full-width band over the bottom button row (over the score sign on a
        // phone held sideways, where the bottom row is your hand)
        className="hand-end-bar fixed inset-0 z-40 flex flex-col items-center px-3 pointer-events-none"
      >
        <div
          className="mm-rise mm-panel pointer-events-auto flex items-center justify-between gap-3 w-full max-w-lg pl-4 pr-2 py-2 font-club"
          style={{ borderRadius: 16 }}
          role="status"
        >
          <div className="min-w-0 leading-tight">
            <p className="font-body text-[11px] font-extrabold uppercase tracking-[0.08em] text-white/75">
              {isFinalHand ? 'Última mano' : 'Fin de mano'}{closing && ` · ${closing}`}
            </p>
            <p className="font-chunky text-lg tracking-wide mm-stroke truncate">
              {outcome}{handPoints > 0 && <span style={{ color: '#FDD04B' }}> · +{handPoints}</span>}
            </p>
          </div>
          <button
            onClick={() => setPeek(false)}
            className="club-btn shrink-0 h-10 whitespace-nowrap font-chunky text-base tracking-wide"
            style={{ paddingInline: 18, background: 'linear-gradient(180deg, #FFE27A 0%, #F2B51C 100%)', color: '#2B1B12' }}
          >
            Ver resumen
          </button>
        </div>
      </div>
    )
  }

  return (
    // Scrolls when the card is taller than the screen (phone landscape)
    <div className="fixed inset-0 z-40 flex overflow-y-auto mm-modal-backdrop p-4">
      <div className="mm-pop mm-panel m-auto w-full max-w-sm overflow-hidden">
        {/* Header */}
        <div className={`px-6 pt-6 pb-4 text-center bg-gradient-to-b ${headerGradient} flex flex-col items-center gap-1.5`}>
          <GoldCaption>{isFinalHand ? 'Última mano' : 'Fin de Mano'}</GoldCaption>
          {blocked ? (
            <>
              <div className="text-4xl mb-0.5">🔒</div>
              <h2
                className="font-chunky text-[2.2rem] sm:text-[2.5rem] leading-[0.95] tracking-wide mm-stroke"
              >
                ¡Trancado!
              </h2>
              <p className="font-body font-bold text-white/75 text-sm">{closing ? `${closing} · nadie puede jugar` : 'Nadie puede jugar'}</p>
            </>
          ) : weWon ? (
            <>
              <div className="text-4xl mb-0.5">🎉</div>
              <h2
                className="font-chunky text-[2.2rem] sm:text-[2.5rem] leading-[0.95] tracking-wide mm-stroke"
              >
                {is2Player ? '¡Ganaste!' : '¡Ganamos!'}
              </h2>
              {closing && <p className="font-body font-bold text-white/75 text-sm">{closing}</p>}
            </>
          ) : (
            <>
              <div className="text-4xl mb-0.5">😤</div>
              <h2
                className="font-chunky text-[2.2rem] sm:text-[2.5rem] leading-[0.95] tracking-wide mm-stroke"
                style={{ color: '#FF8A80' }}
              >
                {is2Player ? 'Perdiste' : 'Perdimos'}
              </h2>
              {closing && <p className="font-body font-bold text-white/75 text-sm">{closing}</p>}
            </>
          )}
        </div>

        {/* Special badges */}
        {roundEndData.reason === 'blocked' && (
          <div className="flex justify-center px-6 py-2">
            <span className="mm-chip text-sm" style={{ background: 'linear-gradient(180deg, #F3EAD3, #C9B98F)' }}>
              ¡Trancado!
            </span>
          </div>
        )}
        {gameState?.gameMode === 'modo500' && (roundEndData.isCapicu || roundEndData.isChuchazo) && (
          <div className="flex justify-center gap-2 px-6 py-2">
            {roundEndData.isCapicu && (
              <span className="mm-chip text-sm">
                ¡Capicú! +100
              </span>
            )}
            {roundEndData.isChuchazo && (
              <span className="mm-chip text-sm text-white" style={{ background: 'linear-gradient(180deg, #E5534A, #8E2A22)' }}>
                ¡Chuchazo! +100
              </span>
            )}
          </div>
        )}

        {/* Points breakdown */}
        <div className="mm-well mx-4 my-2 px-4 py-3">
          <div className="flex justify-between items-center text-sm font-body font-bold mb-1">
            <span className="text-white/75">
              {roundEndData.reason === 'blocked' ? 'Trancado' : 'Fichas'}
              {isModo200 && roundEndData.rawPipCount !== undefined && ` (${roundEndData.rawPipCount} pips)`}
            </span>
            <span className="font-chunky text-base text-white">+{roundEndData.pointsFromPips}</span>
          </div>
          {roundEndData.bonusPoints > 0 && (
            <div className="flex justify-between items-center text-sm font-body font-bold mb-1">
              <span style={{ color: '#FDD04B' }}>{roundEndData.reason === 'blocked' ? 'Bono por trancar' : 'Bonificación'}</span>
              <span className="font-chunky text-base" style={{ color: '#FDD04B' }}>+{roundEndData.bonusPoints}</span>
            </div>
          )}
          <div className="flex justify-between items-center font-body border-t-2 border-[#06140B] pt-1.5 mt-1.5">
            <span className="text-white font-extrabold">Total ganado</span>
            <span className="font-chunky text-3xl leading-none mm-stroke !text-[#FDD04B]">+{handPoints}</span>
          </div>
        </div>

        {/* Remaining tiles */}
        <div className="px-6 py-3">
          <p className="font-chunky text-[#FDE68A] text-sm mb-2 uppercase tracking-wider">Fichas restantes</p>
          <div className="space-y-1.5">
            {roundEndData.remainingTiles.map(rt => (
              <div key={rt.playerIndex} className="flex items-center gap-2">
                <span className="font-body font-extrabold text-white/85 text-xs w-20 truncate">{rt.playerName}</span>
                <div className="flex gap-0.5 flex-wrap flex-1">
                  {rt.tiles.length === 0 ? (
                    <span className="text-[#5BEA9B] text-xs font-body font-extrabold">Sin fichas ✓</span>
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
                  <span className="font-chunky text-white text-sm shrink-0">{rt.pipSum}</span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Scores summary */}
        <div className="mm-well mx-4 my-1 px-4 py-2.5">
          <div className="flex justify-around text-center">
            <div>
              <p className="font-body font-extrabold text-xs mb-0.5" style={{ color: '#5BEA9B' }}>
                {is2Player ? (gameState?.players[0]?.name ?? 'J1') : 'Equipo A'}
              </p>
              <p className="font-chunky text-3xl leading-none mm-stroke">{roundEndData.scores.team0}</p>
            </div>
            <div className="text-white/60 font-chunky self-center">vs</div>
            <div>
              <p className="font-body font-extrabold text-xs mb-0.5" style={{ color: '#FFA270' }}>
                {is2Player ? (gameState?.players[1]?.name ?? 'J2') : 'Equipo B'}
              </p>
              <p className="font-chunky text-3xl leading-none mm-stroke">{roundEndData.scores.team1}</p>
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
            <p className="text-center font-body font-bold text-white/75 text-sm">Esperando al host...</p>
          )}
          <button
            onClick={() => setPeek(true)}
            className="club-btn h-11 w-full font-chunky text-base tracking-wide"
          >
            Ver mesa
          </button>
        </div>
      </div>
    </div>
  )
}

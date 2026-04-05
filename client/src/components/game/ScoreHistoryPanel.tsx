import { type ScoreHistoryEntry } from '../../store/gameStore'

interface ScoreHistoryPanelProps {
  isOpen: boolean
  entries: ScoreHistoryEntry[]
  myPlayerIndex: number
  playerCount?: number
  playerNames?: string[]
  gameMode?: string
}

export function ScoreHistoryPanel({ isOpen, entries, myPlayerIndex, playerCount = 4, playerNames, gameMode }: ScoreHistoryPanelProps) {
  const is2Player = playerCount === 2
  const myTeam = myPlayerIndex % 2 === 0 ? 0 : 1

  return (
    <div
      className={`overflow-hidden transition-all duration-300 ease-in-out backdrop-blur-md bg-black/60 border-b border-white/10 ${
        isOpen ? 'max-h-48 opacity-100' : 'max-h-0 opacity-0'
      }`}
    >
      <div className="overflow-y-auto scrollbar-none max-h-48">
        {entries.length === 0 ? (
          <p className="font-body text-white/30 text-xs text-center py-3">Sin manos todavía</p>
        ) : (
          entries.map(entry => {
            const winLabel =
              entry.data.winningTeam === null
                ? 'Trancado'
                : is2Player
                ? (playerNames?.[entry.data.winningTeam] ?? 'Ganador')
                : entry.data.winningTeam === myTeam
                ? 'Nosotros'
                : 'Ellos'
            const winColor =
              entry.data.winningTeam === null
                ? '#F59E0B'
                : entry.data.winningTeam === myTeam
                ? '#22C55E'
                : '#F97316'

            return (
              <div
                key={entry.handNumber}
                className="flex items-center gap-2 px-3 py-2 border-b border-white/5 text-xs font-body"
              >
                <span className="text-white/40 w-10 shrink-0">Mano {entry.handNumber}</span>
                <span className="font-semibold w-16 shrink-0" style={{ color: winColor }}>
                  {winLabel}
                </span>
                <span className="text-white font-bold w-10 shrink-0">+{entry.data.totalPointsScored}</span>
                <span className="text-white/50 flex-1 font-header text-sm">
                  {entry.data.scores.team0} | {entry.data.scores.team1}
                </span>
                {entry.data.reason === 'blocked' && (
                  <span className="bg-amber-600 text-white font-bold text-[10px] px-1.5 py-0.5 rounded-full shrink-0">
                    Trancado
                  </span>
                )}
                {gameMode !== 'modo200' && entry.data.isCapicu && (
                  <span className="bg-gold text-bg font-bold text-[10px] px-1.5 py-0.5 rounded-full shrink-0">
                    Capicú
                  </span>
                )}
                {gameMode !== 'modo200' && entry.data.isChuchazo && (
                  <span className="bg-accent text-white font-bold text-[10px] px-1.5 py-0.5 rounded-full shrink-0">
                    Chuchazo
                  </span>
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}

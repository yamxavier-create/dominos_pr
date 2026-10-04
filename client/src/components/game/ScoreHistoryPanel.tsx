import { type ScoreHistoryEntry } from '../../store/gameStore'
import { teamNames } from './ScorePanel'

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
      className={`overflow-hidden transition-all duration-300 ease-in-out bg-club-strip border-b-2 border-club-brass/50 ${
        isOpen ? 'max-h-48 opacity-100' : 'max-h-0 opacity-0'
      }`}
    >
      <div className="overflow-y-auto scrollbar-none max-h-48">
        {/* Who's on each team — the score bar only says Nosotros / Ellos on phones */}
        {!is2Player && playerNames && (
          <div className="flex items-center gap-3 px-3 py-2 border-b border-club-text/10 text-xs font-club">
            <span className="min-w-0 truncate" style={{ color: '#9BD3AE' }}>
              <span className="font-semibold">Nosotros:</span> <span className="text-club-muted">{teamNames(playerNames.map(name => ({ name })), myTeam as 0 | 1)}</span>
            </span>
            <span className="min-w-0 truncate" style={{ color: '#F0A49B' }}>
              <span className="font-semibold">Ellos:</span> <span className="text-club-muted">{teamNames(playerNames.map(name => ({ name })), (1 - myTeam) as 0 | 1)}</span>
            </span>
          </div>
        )}
        {entries.length === 0 ? (
          <p className="font-club text-club-muted text-xs text-center py-3">Sin manos todavía</p>
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
                ? '#C9A24A'
                : entry.data.winningTeam === myTeam
                ? '#9BD3AE'
                : '#F0A49B'

            return (
              <div
                key={entry.handNumber}
                className="flex items-center gap-2 px-3 py-2 border-b border-club-text/10 text-xs font-club"
              >
                <span className="text-club-muted w-10 shrink-0">Mano {entry.handNumber}</span>
                <span className="font-semibold w-16 shrink-0" style={{ color: winColor }}>
                  {winLabel}
                </span>
                <span className="text-club-text font-bold w-10 shrink-0">+{entry.data.totalPointsScored}</span>
                <span className="text-club-muted flex-1 font-club-display text-sm tabular-nums">
                  {entry.data.scores.team0} | {entry.data.scores.team1}
                </span>
                {entry.data.reason === 'blocked' && (
                  <span className="bg-club-brass text-club-ink font-bold text-[10px] px-1.5 py-0.5 rounded shrink-0">
                    Trancado
                  </span>
                )}
                {gameMode !== 'modo200' && entry.data.isCapicu && (
                  <span className="bg-gold text-bg font-bold text-[10px] px-1.5 py-0.5 rounded-full shrink-0">
                    Capicú
                  </span>
                )}
                {gameMode !== 'modo200' && entry.data.isChuchazo && (
                  <span className="bg-accent text-club-text font-bold text-[10px] px-1.5 py-0.5 rounded-full shrink-0">
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

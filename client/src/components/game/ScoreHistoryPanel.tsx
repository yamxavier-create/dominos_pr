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
      style={{ background: 'linear-gradient(180deg, rgba(18,70,40,0.98), rgba(8,32,17,0.98))', boxShadow: '0 4px 0 #06140B, inset 0 -2px 0 rgba(234,179,8,0.45)' }}
      className={`overflow-hidden transition-all duration-300 ease-in-out border-b-[3px] border-[#06140B] ${
        isOpen ? 'max-h-48 opacity-100' : 'max-h-0 opacity-0'
      }`}
    >
      <div className="overflow-y-auto scrollbar-none max-h-48">
        {/* Who's on each team — the score bar only says Nosotros / Ellos on phones */}
        {!is2Player && playerNames && (
          <div className="flex items-center gap-3 px-3 py-2 border-b-2 border-[#06140B]/70 text-xs font-club">
            <span className="min-w-0 truncate" style={{ color: '#9BD3AE' }}>
              <span className="font-chunky tracking-wide">Nosotros:</span> <span className="text-club-muted">{teamNames(playerNames.map(name => ({ name })), myTeam as 0 | 1)}</span>
            </span>
            <span className="min-w-0 truncate" style={{ color: '#F0A49B' }}>
              <span className="font-chunky tracking-wide">Ellos:</span> <span className="text-club-muted">{teamNames(playerNames.map(name => ({ name })), (1 - myTeam) as 0 | 1)}</span>
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
                ? '#FDD04B'
                : entry.data.winningTeam === myTeam
                ? '#9BD3AE'
                : '#F0A49B'

            return (
              <div
                key={entry.handNumber}
                className="flex items-center gap-2 px-3 py-2 border-b-2 border-[#06140B]/70 text-xs font-club"
              >
                <span className="text-club-muted font-semibold w-10 shrink-0">Mano {entry.handNumber}</span>
                <span className="font-chunky tracking-wide w-16 shrink-0" style={{ color: winColor }}>
                  {winLabel}
                </span>
                <span className="font-chunky text-white w-10 shrink-0">+{entry.data.totalPointsScored}</span>
                <span className="flex-1 font-club-display text-sm tabular-nums mm-stroke">
                  {entry.data.scores.team0} | {entry.data.scores.team1}
                </span>
                {entry.data.reason === 'blocked' && (
                  <span className="mm-chip !text-[10px] shrink-0" style={{ background: 'linear-gradient(180deg, #F3EAD3, #C9B98F)' }}>
                    Trancado
                  </span>
                )}
                {gameMode === 'modo500' && entry.data.isCapicu && (
                  <span className="mm-chip !text-[10px] shrink-0">
                    Capicú
                  </span>
                )}
                {gameMode === 'modo500' && entry.data.isChuchazo && (
                  <span className="mm-chip !text-[10px] shrink-0 text-white" style={{ background: 'linear-gradient(180deg, #E5534A, #8E2A22)' }}>
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

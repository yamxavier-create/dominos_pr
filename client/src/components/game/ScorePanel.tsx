import { TeamScores, ClientPlayer, GameMode } from '../../types/game'

interface ScorePanelProps {
  scores: TeamScores
  players: ClientPlayer[]
  myPlayerIndex: number
  gameMode: GameMode
  targetScore: number
  handNumber: number
  onClick?: () => void
  isOpen?: boolean
}

export function ScorePanel({ scores, players, myPlayerIndex, gameMode, targetScore, handNumber, onClick, isOpen }: ScorePanelProps) {
  const is2Player = players.length === 2

  const teamA = is2Player ? [players[0]].filter(Boolean) : [players[0], players[2]].filter(Boolean)
  const teamB = is2Player ? [players[1]].filter(Boolean) : [players[1], players[3]].filter(Boolean)

  const myTeam = myPlayerIndex % 2 === 0 ? 0 : 1
  const teamALabel = is2Player
    ? (players[0]?.name ?? 'J1')
    : myTeam === 0 ? 'Nosotros' : 'Ellos'
  const teamBLabel = is2Player
    ? (players[1]?.name ?? 'J2')
    : myTeam === 1 ? 'Nosotros' : 'Ellos'

  const pctA = Math.min((scores.team0 / targetScore) * 100, 100)
  const pctB = Math.min((scores.team1 / targetScore) * 100, 100)

  return (
    <div
      className={`backdrop-blur-md bg-black/40 border-b border-white/10 px-3 py-2 flex items-center gap-3${onClick ? ' cursor-pointer' : ''}`}
      onClick={onClick}
    >
      {/* Mode pill badge */}
      <span
        className="font-header text-sm px-2.5 py-0.5 rounded-full shrink-0"
        style={{ background: 'linear-gradient(135deg, #22C55E, #16a34a)', color: '#fff' }}
      >
        {gameMode === 'modo200' ? 'M·200' : 'M·500'}
      </span>

      {/* Hand number */}
      <span className="font-body text-white/40 text-xs shrink-0">#{handNumber}</span>

      {/* Team A Score */}
      <div className="flex-1 min-w-0">
        <div className="flex justify-between items-center mb-1">
          <span className="font-body text-xs font-semibold truncate" style={{ color: '#22C55E' }}>
            {is2Player ? teamALabel : `${teamALabel}: ${teamA.map(p => p?.name).filter(Boolean).join(' & ')}`}
          </span>
          <span className="font-header text-xl text-white ml-2 shrink-0 leading-none">{scores.team0}</span>
        </div>
        <div className="h-2 bg-white/10 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${pctA}%`, background: 'linear-gradient(90deg, #16a34a, #22C55E)' }}
          />
        </div>
      </div>

      <span className="text-white/20 font-body text-xs shrink-0">vs</span>

      {/* Team B Score */}
      <div className="flex-1 min-w-0">
        <div className="flex justify-between items-center mb-1">
          <span className="font-body text-xs font-semibold truncate" style={{ color: '#F97316' }}>
            {is2Player ? teamBLabel : `${teamBLabel}: ${teamB.map(p => p?.name).filter(Boolean).join(' & ')}`}
          </span>
          <span className="font-header text-xl text-white ml-2 shrink-0 leading-none">{scores.team1}</span>
        </div>
        <div className="h-2 bg-white/10 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${pctB}%`, background: 'linear-gradient(90deg, #ea580c, #F97316)' }}
          />
        </div>
      </div>

      {/* Target */}
      <span className="font-body text-white/30 text-xs shrink-0">/{targetScore}</span>

      {/* Chevron indicator */}
      {onClick && (
        <svg
          className={`w-3 h-3 text-white/40 shrink-0 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      )}
    </div>
  )
}

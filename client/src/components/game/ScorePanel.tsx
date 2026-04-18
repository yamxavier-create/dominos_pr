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
  compact?: boolean
}

export function ScorePanel({ scores, players, myPlayerIndex, gameMode, targetScore, handNumber, onClick, isOpen, compact }: ScorePanelProps) {
  const is2Player = players.length === 2

  const myTeam = myPlayerIndex % 2 === 0 ? 0 : 1
  const teamALabel = is2Player
    ? (players[0]?.name ?? 'J1')
    : myTeam === 0 ? 'Nosotros' : 'Ellos'
  const teamBLabel = is2Player
    ? (players[1]?.name ?? 'J2')
    : myTeam === 1 ? 'Nosotros' : 'Ellos'

  const modeLabel = gameMode === 'modo200' ? 'M·200' : 'M·500'

  return (
    <div
      className={`game-glass-panel flex items-center ${compact ? 'px-3 pb-1 gap-2' : 'px-3 pb-2 gap-3'}${onClick ? ' cursor-pointer' : ''}`}
      style={{ paddingTop: `calc(${compact ? '0.25rem' : '0.5rem'} + var(--safe-top))` }}
      onClick={onClick}
    >
      {/* Mode pill */}
      <span
        className={`font-header rounded-full shrink-0 ${compact ? 'text-xs px-1.5 py-0.5' : 'text-sm px-2.5 py-0.5'}`}
        style={{ background: 'linear-gradient(135deg, #22C55E, #16a34a)', color: '#fff' }}
      >
        {modeLabel}
      </span>

      {/* Hand number */}
      <span className={`font-body text-white/40 shrink-0 ${compact ? 'text-[10px]' : 'text-xs'}`}>#{handNumber}</span>

      {/* Scores */}
      {compact ? (
        <>
          <span className="font-body text-xs font-semibold" style={{ color: '#22C55E' }}>{teamALabel}</span>
          <span className="font-header text-base text-white shrink-0 leading-none" style={{ textShadow: '0 0 12px rgba(234,179,8,0.35)' }}>{scores.team0}</span>
          <span className="text-white/20 font-body text-[10px] shrink-0">vs</span>
          <span className="font-header text-base text-white shrink-0 leading-none" style={{ textShadow: '0 0 12px rgba(234,179,8,0.35)' }}>{scores.team1}</span>
          <span className="font-body text-xs font-semibold" style={{ color: '#F97316' }}>{teamBLabel}</span>
        </>
      ) : (
        <>
          <TeamScore
            label={is2Player ? teamALabel : `${teamALabel}: ${[players[0], players[2]].filter(Boolean).map(p => p?.name).filter(Boolean).join(' & ')}`}
            score={scores.team0}
            pct={Math.min((scores.team0 / targetScore) * 100, 100)}
            color="#22C55E"
            gradient="linear-gradient(90deg, #16a34a, #22C55E)"
          />
          <span className="text-white/20 font-body text-xs shrink-0">vs</span>
          <TeamScore
            label={is2Player ? teamBLabel : `${teamBLabel}: ${[players[1], players[3]].filter(Boolean).map(p => p?.name).filter(Boolean).join(' & ')}`}
            score={scores.team1}
            pct={Math.min((scores.team1 / targetScore) * 100, 100)}
            color="#F97316"
            gradient="linear-gradient(90deg, #ea580c, #F97316)"
          />
        </>
      )}

      {/* Target */}
      <span className={`font-body text-white/30 shrink-0 ${compact ? 'text-[10px]' : 'text-xs'}`}>/{targetScore}</span>

      {/* Chevron */}
      {onClick && (
        <svg
          className={`w-3 h-3 text-white/40 shrink-0 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      )}
    </div>
  )
}

function TeamScore({ label, score, pct, color, gradient }: {
  label: string; score: number; pct: number; color: string; gradient: string
}) {
  return (
    <div className="flex-1 min-w-0">
      <div className="flex justify-between items-center mb-1">
        <span className="font-body text-xs font-semibold truncate" style={{ color }}>{label}</span>
        <span className="font-header text-xl text-white ml-2 shrink-0 leading-none" style={{ textShadow: '0 0 14px rgba(234,179,8,0.4)' }}>{score}</span>
      </div>
      <div className="h-2 bg-white/5 rounded-full overflow-hidden border border-white/5">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, background: gradient }}
        />
      </div>
    </div>
  )
}

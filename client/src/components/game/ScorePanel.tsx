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
  showTeamNames?: boolean  // wide screens only; on phones the names live in the history panel
}

/**
 * The score sign: a cream strip with a wood border. Our side always reads on
 * the left and theirs on the right; the target and hand number sit between.
 * Tapping it opens the hand-by-hand history.
 */
export function ScorePanel({ scores, players, myPlayerIndex, targetScore, handNumber, onClick, isOpen, compact, showTeamNames }: ScorePanelProps) {
  const is2Player = players.length === 2
  const myTeam = myPlayerIndex % 2 === 0 ? 0 : 1
  const theirTeam = myTeam === 0 ? 1 : 0
  const ourScore = myTeam === 0 ? scores.team0 : scores.team1
  const theirScore = myTeam === 0 ? scores.team1 : scores.team0

  // 2 players: each side is one person, so show names instead of Nosotros/Ellos
  const ourLabel = is2Player ? (players[myPlayerIndex]?.name ?? 'Tú') : 'Nosotros'
  const theirLabel = is2Player ? (players[(myPlayerIndex + 1) % 2]?.name ?? 'Rival') : 'Ellos'
  const ourNames = !is2Player && showTeamNames ? teamNames(players, myTeam) : null
  const theirNames = !is2Player && showTeamNames ? teamNames(players, theirTeam) : null

  const numberSize = compact ? 'text-xl' : 'text-[28px]'
  const labelSize = compact ? 'text-[10px]' : 'text-xs'

  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={onClick ? !!isOpen : undefined}
      aria-label={`${ourLabel} ${ourScore}, ${theirLabel} ${theirScore}. A ${targetScore}, mano ${handNumber}. ${isOpen ? 'Cerrar' : 'Ver'} historial`}
      className={`club-sign club-focus w-full min-w-0 flex items-center justify-between gap-2 font-club ${compact ? 'px-2 py-0.5' : 'px-3 py-1.5'}`}
      style={{ cursor: onClick ? 'pointer' : 'default' }}
    >
      <span className="flex items-baseline gap-1.5 min-w-0">
        <span className={`${labelSize} font-bold uppercase tracking-[0.06em] truncate`}>
          {ourLabel}
          {ourNames && <span className="normal-case tracking-normal font-semibold opacity-80"> · {ourNames}</span>}
        </span>
        <span className={`font-club-display ${numberSize} leading-none text-club-us tabular-nums`}>{ourScore}</span>
      </span>

      <span className={`flex items-center gap-1 shrink-0 font-bold ${compact ? 'text-[11px]' : 'text-[13px]'}`}>
        A {targetScore} · Mano {handNumber}
        {onClick && (
          <svg
            className={`w-3 h-3 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        )}
      </span>

      <span className="flex items-baseline gap-1.5 min-w-0 justify-end">
        <span className={`font-club-display ${numberSize} leading-none text-club-them tabular-nums`}>{theirScore}</span>
        <span className={`${labelSize} font-bold uppercase tracking-[0.06em] truncate`}>
          {theirNames && <span className="normal-case tracking-normal font-semibold opacity-80">{theirNames} · </span>}
          {theirLabel}
        </span>
      </span>
    </button>
  )
}

/** "Ana & Beto" for team 0 (seats 0, 2) or team 1 (seats 1, 3) */
export function teamNames(players: { name: string }[], team: 0 | 1): string {
  return [players[team], players[team + 2]].filter(Boolean).map(p => p.name).join(' & ')
}

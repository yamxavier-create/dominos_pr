import { TurnClock } from './TurnStatus'

interface TurnIndicatorProps {
  playerName: string
  isMyTurn: boolean
  /** Torneo: seconds left to play; null without a turn clock */
  secondsLeft?: number | null
}

/** Turn tag on the table corner (landscape and desktop; phone portrait uses TurnStatus). */
export function TurnIndicator({ playerName, isMyTurn, secondsLeft }: TurnIndicatorProps) {
  return (
    <div
      className={`absolute top-2 right-2 z-20 flex items-center gap-1.5 px-2.5 py-1 rounded-md pointer-events-none whitespace-nowrap font-club font-bold text-xs leading-none
        ${isMyTurn ? 'bg-club-ink text-club-cream' : 'bg-club-strip text-club-muted'}`}
      style={{ boxShadow: '0 2px 0 rgba(60, 40, 20, 0.45)' }}
      role="status"
      aria-live="polite"
    >
      {isMyTurn ? <span className="font-club-display text-sm font-normal">Te toca</span> : `Juega ${playerName}`}
      {secondsLeft != null && <TurnClock seconds={secondsLeft} />}
    </div>
  )
}

interface TurnIndicatorProps {
  playerName: string
  isMyTurn: boolean
}

/** Turn tag on the table corner (landscape and desktop; phone portrait uses TurnStatus). */
export function TurnIndicator({ playerName, isMyTurn }: TurnIndicatorProps) {
  return (
    <div
      className={`absolute top-2 right-2 z-20 px-2.5 py-1 rounded-md pointer-events-none whitespace-nowrap font-club font-bold text-xs leading-none
        ${isMyTurn ? 'bg-club-cream text-club-ink' : 'bg-club-strip text-club-muted'}`}
      style={{ boxShadow: '0 2px 0 rgba(7, 22, 14, 0.9)' }}
      role="status"
      aria-live="polite"
    >
      {isMyTurn ? <span className="font-club-display text-sm font-normal">Te toca</span> : `Juega ${playerName}`}
    </div>
  )
}

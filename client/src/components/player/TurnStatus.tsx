interface TurnStatusProps {
  isMyTurn: boolean
  currentPlayerName: string
  nextPlayerName: string
  leftEnd: number | null
  rightEnd: number | null
  /** Torneo: seconds left to play; null without a turn clock */
  secondsLeft?: number | null
}

/** Torneo's turn clock: a gold chip that turns red for the last 3 seconds */
export function TurnClock({ seconds }: { seconds: number }) {
  const urgent = seconds <= 3
  return (
    <span
      className={`inline-flex items-center justify-center min-w-[2.2em] px-1.5 rounded-full font-club-display text-base leading-tight tabular-nums ${urgent ? 'turn-clock-urgent text-white' : 'text-club-ink'}`}
      style={{
        background: urgent ? 'linear-gradient(180deg, #E5534A, #8E2A22)' : 'linear-gradient(180deg, #FFE27A, #F2B51C)',
        border: '2px solid #06140B',
        boxShadow: '0 2px 0 #06140B',
      }}
      aria-label={`${seconds} segundos para jugar`}
    >
      {seconds}s
    </span>
  )
}

/**
 * The line between the table and the hand (phone portrait): whose turn it is,
 * the open ends, and who plays next — which also replaces the left/right cue
 * lost when all three other players sit in the row above.
 */
export function TurnStatus({ isMyTurn, currentPlayerName, nextPlayerName, leftEnd, rightEnd, secondsLeft }: TurnStatusProps) {
  const ends = leftEnd !== null && rightEnd !== null ? `Puntas: ${leftEnd} y ${rightEnd}` : 'Mesa vacía'

  return (
    <div className="flex items-baseline justify-center gap-2 px-3 min-w-0 font-club" role="status" aria-live="polite">
      {secondsLeft != null && <span className="self-center shrink-0"><TurnClock seconds={secondsLeft} /></span>}
      <span className="font-club-display text-[22px] leading-tight shrink-0 mm-stroke" style={{ color: isMyTurn ? '#FDD04B' : '#fff' }}>
        {isMyTurn ? 'Te toca' : `Juega ${currentPlayerName}`}
      </span>
      <span className="text-sm text-club-muted truncate">
        {ends} · después juega {nextPlayerName}
      </span>
    </div>
  )
}

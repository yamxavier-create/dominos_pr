interface TurnStatusProps {
  isMyTurn: boolean
  currentPlayerName: string
  nextPlayerName: string
  leftEnd: number | null
  rightEnd: number | null
}

/**
 * The line between the table and the hand (phone portrait): whose turn it is,
 * the open ends, and who plays next — which also replaces the left/right cue
 * lost when all three other players sit in the row above.
 */
export function TurnStatus({ isMyTurn, currentPlayerName, nextPlayerName, leftEnd, rightEnd }: TurnStatusProps) {
  const ends = leftEnd !== null && rightEnd !== null ? `Puntas: ${leftEnd} y ${rightEnd}` : 'Mesa vacía'

  return (
    <div className="flex items-baseline justify-center gap-2 px-3 min-w-0 font-club" role="status" aria-live="polite">
      <span className="font-club-display text-xl leading-tight text-club-cream shrink-0">
        {isMyTurn ? 'Te toca' : `Juega ${currentPlayerName}`}
      </span>
      <span className="text-sm text-club-muted truncate">
        {ends} · después juega {nextPlayerName}
      </span>
    </div>
  )
}

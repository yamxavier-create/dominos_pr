interface TurnIndicatorProps {
  playerName: string
  isMyTurn: boolean
}

export function TurnIndicator({ playerName, isMyTurn }: TurnIndicatorProps) {
  return (
    <div
      className={`
        absolute top-2 right-2 z-20
        px-3 py-1 rounded-full font-body text-xs font-bold
        transition-all duration-300 pointer-events-none whitespace-nowrap
        ${isMyTurn
          ? 'bg-gold text-bg shadow-lg shadow-gold/50 bounce-slow'
          : 'bg-surface/80 text-white/70 border border-border'
        }
      `}
    >
      {isMyTurn ? '¡Tu turno!' : `Turno de ${playerName}`}
    </div>
  )
}

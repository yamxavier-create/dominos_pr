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
          ? 'bg-gradient-to-r from-gold to-amber-500 text-bg shadow-lg shadow-gold/40 border border-gold/30 bounce-slow'
          : 'game-glass-card text-white/60 border border-gold/8'
        }
      `}
    >
      {isMyTurn ? '¡Tu turno!' : `Turno de ${playerName}`}
    </div>
  )
}

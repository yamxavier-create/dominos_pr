interface TurnIndicatorProps {
  playerName: string
  isMyTurn: boolean
}

export function TurnIndicator({ playerName, isMyTurn }: TurnIndicatorProps) {
  return (
    <div
      className={`
        absolute top-2 right-2 z-20
        px-4 py-1.5 rounded-full font-body text-sm font-bold
        transition-all duration-300 pointer-events-none
        ${isMyTurn
          ? 'bg-gold text-bg shadow-lg shadow-gold/50 animate-bounce-slow'
          : 'bg-surface/80 text-white/70 border border-border'
        }
      `}
    >
      {isMyTurn ? '¡Tu turno!' : `Turno de ${playerName}`}
    </div>
  )
}

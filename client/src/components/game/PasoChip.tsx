interface PasoChipProps {
  show: boolean
  playerName: string
  bonusPoints: number | null
}

export function PasoChip({ show, playerName, bonusPoints }: PasoChipProps) {
  if (!show) return null

  return (
    <div className="paso-toast flex items-center gap-1.5 bg-surface/95 border border-border rounded-full px-3 py-1.5 shadow-xl pointer-events-none z-30 whitespace-nowrap">
      <span className="font-body font-bold text-white text-xs">{playerName}</span>
      <span className="font-body text-white/70 text-xs">pasa</span>
      {bonusPoints !== null && (
        <span className="bg-primary text-white text-xs font-bold rounded-full px-1.5 py-0.5">
          +{bonusPoints}pts
        </span>
      )}
    </div>
  )
}

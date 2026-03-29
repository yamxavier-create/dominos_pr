interface PasoChipProps {
  show: boolean
  playerName: string
  bonusPoints: number | null
}

export function PasoChip({ show, playerName, bonusPoints }: PasoChipProps) {
  if (!show) return null

  return (
    <div className="paso-toast flex items-center gap-2 bg-red-900/90 border-2 border-red-500/60 rounded-full px-4 py-2 shadow-2xl pointer-events-none z-30 whitespace-nowrap">
      <span className="text-base">✋</span>
      <span className="font-body font-bold text-white text-sm">{playerName}</span>
      <span className="font-body text-white/80 text-sm font-semibold">PASA</span>
      {bonusPoints !== null && (
        <span className="bg-primary text-white text-xs font-bold rounded-full px-2 py-0.5">
          +{bonusPoints}pts
        </span>
      )}
    </div>
  )
}

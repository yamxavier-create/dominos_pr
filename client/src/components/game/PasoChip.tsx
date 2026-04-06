interface PasoChipProps {
  show: boolean
  playerName: string
  bonusPoints: number | null
  seat: 'top' | 'bottom' | 'left' | 'right'
}

const wrapperStyles: Record<string, string> = {
  top: 'fixed top-[28%] inset-x-0 flex justify-center',
  bottom: 'fixed bottom-[15%] inset-x-0 flex justify-center',
  left: 'fixed inset-y-0 left-16 flex items-center',
  right: 'fixed inset-y-0 right-16 flex items-center',
}

export function PasoChip({ show, playerName, bonusPoints, seat }: PasoChipProps) {
  if (!show) return null

  return (
    <div className={`${wrapperStyles[seat]} z-30 pointer-events-none`}>
      <div className="paso-toast flex items-center gap-2 bg-gradient-to-r from-red-900/90 to-red-800/85 border-2 border-red-500/50 rounded-full px-4 py-2 shadow-2xl shadow-red-900/30 backdrop-blur-sm whitespace-nowrap">
        <span className="text-base">✋</span>
        <span className="font-body font-bold text-white text-sm">{playerName}</span>
        <span className="font-body text-white/80 text-sm font-semibold">PASA</span>
        {bonusPoints !== null && (
          <span className="bg-primary text-white text-xs font-bold rounded-full px-2 py-0.5">
            +{bonusPoints}pts
          </span>
        )}
      </div>
    </div>
  )
}

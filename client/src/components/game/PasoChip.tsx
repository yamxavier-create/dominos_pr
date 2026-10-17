interface PasoChipProps {
  show: boolean
  playerName: string
  bonusPoints: number | null
  seat: 'top' | 'bottom' | 'left' | 'right'
  /** Rendered inside the seat's own overlay (phone portrait) instead of at a fixed screen spot */
  anchored?: boolean
}

const wrapperStyles: Record<string, string> = {
  top: 'fixed top-[28%] inset-x-0 flex justify-center',
  bottom: 'fixed bottom-[15%] inset-x-0 flex justify-center',
  left: 'fixed inset-y-0 left-16 flex items-center',
  right: 'fixed inset-y-0 right-16 flex items-center',
}

export function PasoChip({ show, playerName, bonusPoints, seat, anchored }: PasoChipProps) {
  if (!show) return null

  return (
    <div className={`${anchored ? 'flex justify-center' : wrapperStyles[seat]} z-30 pointer-events-none`} role="status">
      <div className={`paso-toast club-sign flex items-baseline py-1 whitespace-nowrap font-club ${anchored ? 'gap-1 px-2' : 'gap-1.5 px-3'}`}>
        {/* Hanging from the player's own box, which already shows the name: short
            enough to fit its width, so two passes in a row never overlap */}
        {!anchored && <span className="font-body font-extrabold text-sm">{playerName}</span>}
        <span className="font-club-display text-base text-club-them">pasa</span>
        {bonusPoints !== null && (
          <span className="mm-chip">
            +{bonusPoints}
          </span>
        )}
      </div>
    </div>
  )
}

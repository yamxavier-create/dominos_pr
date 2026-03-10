import { useUIStore } from '../../store/uiStore'

export function PasoToast() {
  const notifications = useUIStore(s => s.pasoNotifications)

  if (notifications.length === 0) return null

  return (
    <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 flex flex-col items-center gap-1 pointer-events-none">
      {notifications.map((n, i) => (
        <div
          key={`${n.playerIndex}-${i}`}
          className="paso-toast flex items-center gap-2 bg-surface/95 border border-border rounded-full px-4 py-2 shadow-xl"
        >
          <span className="font-body font-bold text-white text-sm">{n.playerName}</span>
          <span className="font-body text-white/70 text-sm">pasa</span>
          {n.passBonusAwarded !== null && (
            <span className="bg-primary text-white text-xs font-bold rounded-full px-2 py-0.5">
              +{n.passBonusAwarded} pts
            </span>
          )}
        </div>
      ))}
    </div>
  )
}

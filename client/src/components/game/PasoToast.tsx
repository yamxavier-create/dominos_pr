import { useUIStore } from '../../store/uiStore'

export function PasoToast() {
  const notifications = useUIStore(s => s.pasoNotifications)

  if (notifications.length === 0) return null

  return (
    <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 flex flex-col items-center gap-1 pointer-events-none">
      {notifications.map((n, i) => (
        <div
          key={`${n.playerIndex}-${i}`}
          className="paso-toast club-sign flex items-center gap-2 !rounded-full px-4 py-2"
        >
          <span className="font-body font-extrabold text-sm">{n.playerName}</span>
          <span className="font-chunky text-base text-club-them">pasa</span>
          {n.passBonusAwarded !== null && (
            <span className="mm-chip">
              +{n.passBonusAwarded} pts
            </span>
          )}
        </div>
      ))}
    </div>
  )
}

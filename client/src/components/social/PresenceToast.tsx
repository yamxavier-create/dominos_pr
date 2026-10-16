import { useEffect } from 'react'
import { useSocialStore } from '../../store/socialStore'

export function PresenceToast() {
  const notifications = useSocialStore((s) => s.presenceNotifications)
  const removeNotification = useSocialStore((s) => s.removePresenceNotification)

  useEffect(() => {
    // Auto-dismiss after 4 seconds
    if (notifications.length === 0) return
    const latest = notifications[notifications.length - 1]
    const timer = setTimeout(() => {
      removeNotification(latest.id)
    }, 4000)
    return () => clearTimeout(timer)
  }, [notifications.length])

  if (notifications.length === 0) return null

  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
      {notifications.slice(-3).map((n) => (
        <div
          key={n.id}
          className="mm-drop mm-panel !rounded-2xl px-4 py-3 pointer-events-auto"
        >
          <p className="font-body font-bold text-white/85 text-sm">
            <span className="font-chunky text-[#FDD04B] tracking-wide">{n.displayName}</span>
            {' '}
            {n.type === 'online' ? 'esta en linea' : 'entro a una sala'}
          </p>
        </div>
      ))}
    </div>
  )
}

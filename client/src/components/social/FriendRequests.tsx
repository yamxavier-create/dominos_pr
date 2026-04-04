import { useEffect } from 'react'
import { useAuthStore } from '../../store/authStore'
import { useSocialStore, FriendRequest } from '../../store/socialStore'
import { socket } from '../../socket'
import { API_BASE } from '../../apiBase'

export function FriendRequests() {
  const token = useAuthStore((s) => s.token)
  const requests = useSocialStore((s) => s.requests)
  const setRequests = useSocialStore((s) => s.setRequests)

  useEffect(() => {
    if (!token) return
    fetch(`${API_BASE}/api/social/requests`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => {
        if (!res.ok) throw new Error('Failed to fetch requests')
        return res.json()
      })
      .then((data) => setRequests(data.requests))
      .catch(() => {})
  }, [token])

  const incoming = requests.filter((r) => r.direction === 'incoming')
  const outgoing = requests.filter((r) => r.direction === 'outgoing')

  const acceptRequest = (requestId: string) => {
    socket.emit('social:friend_accept', { requestId })
  }

  const rejectRequest = (requestId: string) => {
    socket.emit('social:friend_reject', { requestId })
  }

  if (requests.length === 0) {
    return (
      <p className="font-body text-white/40 text-sm text-center py-4">
        No hay solicitudes pendientes
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {incoming.length > 0 && (
        <div className="flex flex-col gap-2">
          <h3 className="font-header text-white/60 text-xs uppercase tracking-wider">
            Solicitudes recibidas
          </h3>
          {incoming.map((req: FriendRequest) => (
            <div
              key={req.requestId}
              className="flex items-center gap-3 bg-white/5 rounded-xl p-3"
            >
              {req.user.avatarUrl ? (
                <img
                  src={req.user.avatarUrl}
                  referrerPolicy="no-referrer"
                  className="w-8 h-8 rounded-full object-cover"
                  alt={req.user.displayName}
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-green-600 flex items-center justify-center text-white font-bold text-sm">
                  {req.user.displayName[0]?.toUpperCase()}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="font-body text-white text-sm truncate">{req.user.displayName}</p>
                <p className="font-body text-white/50 text-xs truncate">@{req.user.username}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => acceptRequest(req.requestId)}
                  className="font-body text-green-400 hover:text-green-300 text-xs font-bold transition-colors"
                >
                  Aceptar
                </button>
                <button
                  onClick={() => rejectRequest(req.requestId)}
                  className="font-body text-red-400/60 hover:text-red-400 text-xs transition-colors"
                >
                  Rechazar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {outgoing.length > 0 && (
        <div className="flex flex-col gap-2">
          <h3 className="font-header text-white/60 text-xs uppercase tracking-wider">
            Solicitudes enviadas
          </h3>
          {outgoing.map((req: FriendRequest) => (
            <div
              key={req.requestId}
              className="flex items-center gap-3 bg-white/5 rounded-xl p-3"
            >
              {req.user.avatarUrl ? (
                <img
                  src={req.user.avatarUrl}
                  referrerPolicy="no-referrer"
                  className="w-8 h-8 rounded-full object-cover"
                  alt={req.user.displayName}
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-green-600 flex items-center justify-center text-white font-bold text-sm">
                  {req.user.displayName[0]?.toUpperCase()}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="font-body text-white text-sm truncate">{req.user.displayName}</p>
                <p className="font-body text-white/50 text-xs truncate">@{req.user.username}</p>
              </div>
              <span className="font-body text-white/40 text-xs shrink-0">Pendiente</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

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
      <p className="font-body font-bold text-white/75 text-sm text-center py-4">
        No hay solicitudes pendientes
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {incoming.length > 0 && (
        <div className="flex flex-col gap-2">
          <h3 className="mm-title text-sm uppercase tracking-wider">
            Solicitudes recibidas
          </h3>
          {incoming.map((req: FriendRequest) => (
            <div
              key={req.requestId}
              className="mm-well flex items-center gap-3 p-3"
            >
              {req.user.avatarUrl ? (
                <img
                  src={req.user.avatarUrl}
                  referrerPolicy="no-referrer"
                  className="w-9 h-9 rounded-full object-cover" style={{ border: '2px solid #EAB308', boxShadow: '0 2px 0 #06140B' }}
                  alt={req.user.displayName}
                />
              ) : (
                <div className="w-9 h-9 rounded-full flex items-center justify-center font-chunky text-base mm-stroke" style={{ background: 'linear-gradient(135deg, #22C55E, #15803D)', border: '2px solid #EAB308', boxShadow: '0 2px 0 #06140B' }}>
                  {req.user.displayName[0]?.toUpperCase()}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="font-chunky text-white text-base tracking-wide truncate">{req.user.displayName}</p>
                <p className="font-body font-bold text-white/70 text-xs truncate">@{req.user.username}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => acceptRequest(req.requestId)}
                  className="mm-btn-green !w-auto !text-sm !px-3 !py-1.5 !rounded-xl mm-stroke"
                >
                  Aceptar
                </button>
                <button
                  onClick={() => rejectRequest(req.requestId)}
                  className="font-body font-extrabold text-[#FF8A80] text-xs transition-colors"
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
          <h3 className="mm-title text-sm uppercase tracking-wider">
            Solicitudes enviadas
          </h3>
          {outgoing.map((req: FriendRequest) => (
            <div
              key={req.requestId}
              className="mm-well flex items-center gap-3 p-3"
            >
              {req.user.avatarUrl ? (
                <img
                  src={req.user.avatarUrl}
                  referrerPolicy="no-referrer"
                  className="w-9 h-9 rounded-full object-cover" style={{ border: '2px solid #EAB308', boxShadow: '0 2px 0 #06140B' }}
                  alt={req.user.displayName}
                />
              ) : (
                <div className="w-9 h-9 rounded-full flex items-center justify-center font-chunky text-base mm-stroke" style={{ background: 'linear-gradient(135deg, #22C55E, #15803D)', border: '2px solid #EAB308', boxShadow: '0 2px 0 #06140B' }}>
                  {req.user.displayName[0]?.toUpperCase()}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="font-chunky text-white text-base tracking-wide truncate">{req.user.displayName}</p>
                <p className="font-body font-bold text-white/70 text-xs truncate">@{req.user.username}</p>
              </div>
              <span className="mm-chip shrink-0">Pendiente</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

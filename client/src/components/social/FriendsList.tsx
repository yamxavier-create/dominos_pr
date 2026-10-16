import { useEffect } from 'react'
import { useAuthStore } from '../../store/authStore'
import { useSocialStore, Friend, PresenceStatus } from '../../store/socialStore'
import { socket } from '../../socket'
import { API_BASE } from '../../apiBase'

export function FriendsList() {
  const token = useAuthStore((s) => s.token)
  const friends = useSocialStore((s) => s.friends)
  const setFriends = useSocialStore((s) => s.setFriends)

  const statusConfig: Record<PresenceStatus, { color: string; label: string }> = {
    online: { color: 'bg-green-500', label: 'En linea' },
    in_lobby: { color: 'bg-blue-500', label: 'En sala' },
    in_game: { color: 'bg-yellow-500', label: 'En juego' },
    offline: { color: 'bg-gray-500', label: 'Desconectado' },
  }

  const sortedFriends = [...friends].sort((a, b) => {
    const order: Record<PresenceStatus, number> = { in_lobby: 0, in_game: 1, online: 2, offline: 3 }
    return (order[a.status] ?? 3) - (order[b.status] ?? 3)
  })

  useEffect(() => {
    if (!token) return
    fetch(`${API_BASE}/api/social/friends`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => {
        if (!res.ok) throw new Error('Failed to fetch friends')
        return res.json()
      })
      .then((data) => setFriends(data.friends))
      .catch(() => {})
  }, [token])

  const removeFriend = (friendUserId: string) => {
    socket.emit('social:friend_remove', { friendUserId })
  }

  const handleJoinFriend = (friendUserId: string) => {
    socket.emit('social:join_friend', { friendUserId })
  }

  if (friends.length === 0) {
    return (
      <div className="text-center py-6">
        <p className="text-4xl mb-2">👥</p>
        <p className="font-chunky text-lg tracking-wide mm-stroke">Aún no tienes amigos</p>
        <p className="font-body font-bold text-white/70 text-xs mt-1">Busca jugadores y envíales solicitud</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      {sortedFriends.map((friend: Friend) => (
        <div
          key={friend.id}
          className="mm-well flex items-center gap-3 p-3"
        >
          <div className="relative">
            {friend.avatarUrl ? (
              <img
                src={friend.avatarUrl}
                referrerPolicy="no-referrer"
                className="w-9 h-9 rounded-full object-cover" style={{ border: '2px solid #EAB308', boxShadow: '0 2px 0 #06140B' }}
                alt={friend.displayName}
              />
            ) : (
              <div className="w-9 h-9 rounded-full flex items-center justify-center font-chunky text-base mm-stroke" style={{ background: 'linear-gradient(135deg, #22C55E, #15803D)', border: '2px solid #EAB308', boxShadow: '0 2px 0 #06140B' }}>
                {friend.displayName[0]?.toUpperCase()}
              </div>
            )}
            <span
              className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-[#06140B] ${statusConfig[friend.status ?? 'offline'].color}`}
            />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-chunky text-white text-base tracking-wide truncate">{friend.displayName}</p>
            <p className={`font-body font-extrabold text-xs truncate ${
              friend.status === 'offline' ? 'text-white/60' :
              friend.status === 'in_lobby' ? 'text-sky-300' :
              friend.status === 'in_game' ? 'text-[#FDD04B]' :
              'text-[#5BEA9B]'
            }`}>
              {statusConfig[friend.status ?? 'offline'].label}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {friend.canJoin && (
              <button
                onClick={() => handleJoinFriend(friend.id)}
                className="mm-btn-gold !w-auto !text-sm !px-3 !py-1.5 !rounded-xl mm-stroke"
              >
                Unirse
              </button>
            )}
            <button
              onClick={() => removeFriend(friend.id)}
              className="font-body font-extrabold text-[#FF8A80] text-xs transition-colors"
            >
              Eliminar
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}

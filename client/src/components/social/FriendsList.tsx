import { useEffect } from 'react'
import { useAuthStore } from '../../store/authStore'
import { useSocialStore, Friend, PresenceStatus } from '../../store/socialStore'
import { socket } from '../../socket'

const API_BASE = import.meta.env.VITE_API_URL || ''

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
      <p className="font-body text-white/40 text-sm text-center py-4">
        Agrega amigos para jugar juntos
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      {sortedFriends.map((friend: Friend) => (
        <div
          key={friend.id}
          className="flex items-center gap-3 bg-white/5 rounded-xl p-3"
        >
          <div className="relative">
            {friend.avatarUrl ? (
              <img
                src={friend.avatarUrl}
                referrerPolicy="no-referrer"
                className="w-8 h-8 rounded-full object-cover"
                alt={friend.displayName}
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-green-600 flex items-center justify-center text-white font-bold text-sm">
                {friend.displayName[0]?.toUpperCase()}
              </div>
            )}
            <span
              className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-green-950 ${statusConfig[friend.status ?? 'offline'].color}`}
            />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-body text-white text-sm truncate">{friend.displayName}</p>
            <p className={`font-body text-xs truncate ${
              friend.status === 'offline' ? 'text-white/30' :
              friend.status === 'in_lobby' ? 'text-blue-400' :
              friend.status === 'in_game' ? 'text-yellow-400' :
              'text-green-400'
            }`}>
              {statusConfig[friend.status ?? 'offline'].label}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {friend.canJoin && (
              <button
                onClick={() => handleJoinFriend(friend.id)}
                className="font-body text-xs font-bold px-3 py-1.5 rounded-lg transition-all hover:opacity-90 active:scale-95 text-white"
                style={{ background: 'linear-gradient(135deg, #22C55E, #16a34a)' }}
              >
                Unirse
              </button>
            )}
            <button
              onClick={() => removeFriend(friend.id)}
              className="font-body text-red-400/60 hover:text-red-400 text-xs transition-colors"
            >
              Eliminar
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}

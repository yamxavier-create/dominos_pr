import { useEffect } from 'react'
import { useAuthStore } from '../../store/authStore'
import { useSocialStore, Friend } from '../../store/socialStore'
import { socket } from '../../socket'

const API_BASE = import.meta.env.VITE_API_URL || ''

export function FriendsList() {
  const token = useAuthStore((s) => s.token)
  const friends = useSocialStore((s) => s.friends)
  const setFriends = useSocialStore((s) => s.setFriends)

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

  if (friends.length === 0) {
    return (
      <p className="font-body text-white/40 text-sm text-center py-4">
        Agrega amigos para jugar juntos
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      {friends.map((friend: Friend) => (
        <div
          key={friend.id}
          className="flex items-center gap-3 bg-white/5 rounded-xl p-3"
        >
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
          <div className="flex-1 min-w-0">
            <p className="font-body text-white text-sm truncate">{friend.displayName}</p>
            <p className="font-body text-white/50 text-xs truncate">@{friend.username}</p>
          </div>
          <button
            onClick={() => removeFriend(friend.id)}
            className="font-body text-red-400/60 hover:text-red-400 text-xs transition-colors shrink-0"
          >
            Eliminar
          </button>
        </div>
      ))}
    </div>
  )
}

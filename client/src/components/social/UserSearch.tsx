import { useState, useEffect } from 'react'
import { useAuthStore } from '../../store/authStore'
import { useSocialStore, SearchResult } from '../../store/socialStore'
import { socket } from '../../socket'

const API_BASE = import.meta.env.VITE_API_URL || ''

export function UserSearch() {
  const token = useAuthStore((s) => s.token)
  const searchResults = useSocialStore((s) => s.searchResults)
  const setSearchResults = useSocialStore((s) => s.setSearchResults)
  const [query, setQuery] = useState('')
  const [searching, setSearching] = useState(false)

  useEffect(() => {
    if (query.length < 2) {
      setSearchResults([])
      return
    }

    setSearching(true)
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `${API_BASE}/api/social/search?q=${encodeURIComponent(query)}`,
          { headers: { Authorization: `Bearer ${token}` } }
        )
        if (!res.ok) throw new Error('Search failed')
        const data = await res.json()
        setSearchResults(data.users)
      } catch {
        setSearchResults([])
      } finally {
        setSearching(false)
      }
    }, 300)

    return () => clearTimeout(timer)
  }, [query, token])

  const sendRequest = (userId: string) => {
    socket.emit('social:friend_request', { targetUserId: userId })
  }

  return (
    <div className="flex flex-col gap-3">
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Buscar por nombre de usuario..."
        className="font-body text-sm text-white bg-white/10 border border-white/20 rounded-xl px-3 py-2.5 w-full outline-none focus:border-green-500/50 placeholder:text-white/30"
      />

      {searching && query.length >= 2 && (
        <p className="font-body text-white/40 text-xs text-center">Buscando...</p>
      )}

      {searchResults.length > 0 && (
        <div className="flex flex-col gap-2">
          {searchResults.map((user: SearchResult) => (
            <div
              key={user.id}
              className="flex items-center gap-3 bg-white/5 rounded-xl p-3"
            >
              {user.avatarUrl ? (
                <img
                  src={user.avatarUrl}
                  referrerPolicy="no-referrer"
                  className="w-8 h-8 rounded-full object-cover"
                  alt={user.displayName}
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-green-600 flex items-center justify-center text-white font-bold text-sm">
                  {user.displayName[0]?.toUpperCase()}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="font-body text-white text-sm truncate">{user.displayName}</p>
                <p className="font-body text-white/50 text-xs truncate">@{user.username}</p>
              </div>
              <div className="shrink-0">
                {user.friendshipStatus === 'ACCEPTED' ? (
                  <span className="font-body text-white/40 text-xs">Amigos</span>
                ) : user.friendshipStatus === 'PENDING' ? (
                  <span className="font-body text-white/40 text-xs">Pendiente</span>
                ) : (
                  <button
                    onClick={() => sendRequest(user.id)}
                    className="font-body text-green-400 hover:text-green-300 text-xs font-bold transition-colors"
                  >
                    Agregar
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {!searching && query.length >= 2 && searchResults.length === 0 && (
        <p className="font-body text-white/40 text-xs text-center">No se encontraron usuarios</p>
      )}
    </div>
  )
}

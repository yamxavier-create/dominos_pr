import { useState, useEffect } from 'react'
import { useAuthStore } from '../../store/authStore'
import { useSocialStore, SearchResult } from '../../store/socialStore'
import { socket } from '../../socket'
import { API_BASE } from '../../apiBase'

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
        className="mm-input"
      />

      {searching && query.length >= 2 && (
        <p className="font-body font-bold text-white/70 text-xs text-center">Buscando...</p>
      )}

      {searchResults.length > 0 && (
        <div className="flex flex-col gap-2">
          {searchResults.map((user: SearchResult) => (
            <div
              key={user.id}
              className="mm-well flex items-center gap-3 p-3"
            >
              {user.avatarUrl ? (
                <img
                  src={user.avatarUrl}
                  referrerPolicy="no-referrer"
                  className="w-9 h-9 rounded-full object-cover" style={{ border: '2px solid #EAB308', boxShadow: '0 2px 0 #06140B' }}
                  alt={user.displayName}
                />
              ) : (
                <div className="w-9 h-9 rounded-full flex items-center justify-center font-chunky text-base mm-stroke" style={{ background: 'linear-gradient(135deg, #22C55E, #15803D)', border: '2px solid #EAB308', boxShadow: '0 2px 0 #06140B' }}>
                  {user.displayName[0]?.toUpperCase()}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="font-chunky text-white text-base tracking-wide truncate">{user.displayName}</p>
                <p className="font-body font-bold text-white/70 text-xs truncate">@{user.username}</p>
              </div>
              <div className="shrink-0">
                {user.friendshipStatus === 'ACCEPTED' ? (
                  <span className="mm-chip">Amigos</span>
                ) : user.friendshipStatus === 'PENDING' ? (
                  <span className="mm-chip">Pendiente</span>
                ) : (
                  <button
                    onClick={() => sendRequest(user.id)}
                    className="mm-btn-green !w-auto !text-sm !px-3 !py-1.5 !rounded-xl mm-stroke"
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
        <p className="font-body font-bold text-white/70 text-xs text-center">No se encontraron usuarios</p>
      )}
    </div>
  )
}

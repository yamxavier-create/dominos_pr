import { useState } from 'react'
import { useAuthStore, AuthUser } from '../../store/authStore'
import { useAuth } from '../../hooks/useAuth'

function Avatar({ user, size = 40 }: { user: AuthUser; size?: number }) {
  if (user.avatarUrl) {
    return (
      <img
        src={user.avatarUrl}
        alt={user.displayName}
        className="rounded-full object-cover"
        style={{ width: size, height: size }}
        referrerPolicy="no-referrer"
      />
    )
  }
  return (
    <div
      className="rounded-full bg-green-500/20 border border-green-500/40 flex items-center justify-center font-bold text-green-400"
      style={{ width: size, height: size, fontSize: size * 0.4 }}
    >
      {user.displayName[0]?.toUpperCase()}
    </div>
  )
}

export function ProfileSection() {
  const { user } = useAuthStore()
  const { updateProfile, logout } = useAuth()
  const [editing, setEditing] = useState(false)
  const [editName, setEditName] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!user) return null

  const startEditing = () => {
    setEditName(user.displayName)
    setEditing(true)
    setError(null)
  }

  const cancelEditing = () => {
    setEditing(false)
    setError(null)
  }

  const saveName = async () => {
    const trimmed = editName.trim()
    if (!trimmed || trimmed === user.displayName) {
      setEditing(false)
      return
    }
    setSaving(true)
    setError(null)
    try {
      await updateProfile(trimmed)
      setEditing(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al actualizar')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="w-full flex items-center gap-3 px-1">
      <Avatar user={user} size={40} />
      <div className="flex-1 min-w-0">
        {editing ? (
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') saveName()
                if (e.key === 'Escape') cancelEditing()
              }}
              maxLength={20}
              autoFocus
              className="font-body text-sm text-white bg-white/10 border border-white/20 rounded-lg px-2 py-1 w-full outline-none focus:border-green-500/50"
            />
            <button
              onClick={saveName}
              disabled={saving}
              className="font-body text-xs text-green-400 hover:text-green-300 transition-colors shrink-0"
            >
              {saving ? '...' : 'OK'}
            </button>
            <button
              onClick={cancelEditing}
              className="font-body text-xs text-white/30 hover:text-white/50 transition-colors shrink-0"
            >
              X
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <span className="font-body text-white/80 text-sm truncate">{user.displayName}</span>
            <button
              onClick={startEditing}
              className="font-body text-white/30 hover:text-white/50 text-xs transition-colors shrink-0"
            >
              editar
            </button>
          </div>
        )}
        {error && <p className="font-body text-accent text-xs mt-0.5">{error}</p>}
      </div>
      <button
        onClick={logout}
        className="font-body text-white/30 hover:text-white/50 text-xs transition-colors shrink-0"
      >
        Salir
      </button>
    </div>
  )
}

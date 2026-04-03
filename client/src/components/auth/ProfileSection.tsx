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
  const [showMenu, setShowMenu] = useState(false)

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
    <div className="relative">
      {/* Gear icon button */}
      <button
        onClick={() => setShowMenu(!showMenu)}
        className="w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center transition-colors hover:bg-white/10"
        style={{ border: '1.5px solid rgba(255,255,255,0.15)' }}
        title="Cuenta"
      >
        <svg className="w-[18px] h-[18px] sm:w-[22px] sm:h-[22px]" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
      </button>

      {/* Dropdown menu */}
      {showMenu && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />
          <div
            className="absolute top-full left-0 mt-2 z-50 rounded-xl py-1.5 min-w-[160px] shadow-xl"
            style={{ background: 'rgba(15,35,24,0.95)', border: '1px solid rgba(255,255,255,0.10)', backdropFilter: 'blur(12px)' }}
          >
            {/* User info header */}
            <div className="px-4 py-2 border-b border-white/10 mb-1">
              <p className="font-body text-white/90 text-sm font-semibold truncate">{user.displayName}</p>
            </div>
            {!editing ? (
              <button
                onClick={() => { startEditing(); setShowMenu(false) }}
                className="w-full text-left px-4 py-2 font-body text-white/70 hover:text-white hover:bg-white/5 text-xs sm:text-sm transition-colors"
              >
                Editar nombre
              </button>
            ) : null}
            <button
              onClick={() => { logout(); setShowMenu(false) }}
              className="w-full text-left px-4 py-2 font-body text-red-400/70 hover:text-red-400 hover:bg-white/5 text-xs sm:text-sm transition-colors"
            >
              Cerrar sesión
            </button>
          </div>
        </>
      )}

      {/* Edit name inline (shown when editing) */}
      {editing && (
        <>
          <div className="fixed inset-0 z-40" onClick={cancelEditing} />
          <div
            className="absolute top-full left-0 mt-2 z-50 rounded-xl p-3 shadow-xl flex items-center gap-2"
            style={{ background: 'rgba(15,35,24,0.95)', border: '1px solid rgba(255,255,255,0.10)', backdropFilter: 'blur(12px)' }}
          >
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
              className="font-body text-sm text-white bg-white/10 border border-white/20 rounded-lg px-2.5 py-1.5 w-32 sm:w-40 outline-none focus:border-green-500/50"
            />
            <button onClick={saveName} disabled={saving} className="font-body text-xs text-green-400 hover:text-green-300 transition-colors">
              {saving ? '...' : '✓'}
            </button>
            <button onClick={cancelEditing} className="font-body text-xs text-white/30 hover:text-white/50 transition-colors">
              ✕
            </button>
            {error && <p className="font-body text-accent text-[10px]">{error}</p>}
          </div>
        </>
      )}
    </div>
  )
}

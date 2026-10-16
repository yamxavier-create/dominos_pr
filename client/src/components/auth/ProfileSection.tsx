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
        style={{ width: size, height: size, border: '2px solid #EAB308', boxShadow: '0 2px 0 #06140B' }}
        referrerPolicy="no-referrer"
      />
    )
  }
  return (
    <div
      className="rounded-full flex items-center justify-center font-chunky mm-stroke"
      style={{ width: size, height: size, fontSize: size * 0.45, background: 'linear-gradient(135deg, #22C55E, #15803D)', border: '2px solid #EAB308', boxShadow: '0 2px 0 #06140B' }}
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
      await updateProfile({ displayName: trimmed })
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
        className="club-btn w-10 h-10 sm:w-12 sm:h-12"
        title="Cuenta"
      >
        <svg className="w-[18px] h-[18px] sm:w-[22px] sm:h-[22px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
      </button>

      {/* Dropdown menu */}
      {showMenu && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />
          <div
            className="mm-pop mm-panel absolute top-full left-0 mt-3 z-50 !rounded-2xl py-1.5 min-w-[170px]"
          >
            {/* User info header */}
            <div className="px-4 py-2 border-b-2 border-[#06140B] mb-1">
              <p className="font-chunky text-[#FDD04B] text-base tracking-wide truncate">{user.displayName}</p>
            </div>
            {!editing ? (
              <button
                onClick={() => { startEditing(); setShowMenu(false) }}
                className="w-full text-left px-4 py-2 font-body font-extrabold text-white/85 hover:text-white hover:bg-black/20 text-xs sm:text-sm transition-colors"
              >
                Editar nombre
              </button>
            ) : null}
            <button
              onClick={() => { logout(); setShowMenu(false) }}
              className="w-full text-left px-4 py-2 font-body font-extrabold text-[#FF8A80] hover:bg-black/20 text-xs sm:text-sm transition-colors"
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
            className="mm-pop mm-panel absolute top-full left-0 mt-3 z-50 !rounded-2xl p-3 flex items-center gap-2"
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
              className="mm-input !w-32 sm:!w-40 !px-2.5 !py-1.5 !text-sm"
            />
            <button onClick={saveName} disabled={saving} className="mm-btn-green !w-auto !text-base !px-2.5 !py-1 !rounded-lg mm-stroke">
              {saving ? '...' : '✓'}
            </button>
            <button onClick={cancelEditing} className="font-chunky text-base text-white/75 hover:text-white transition-colors px-1">
              ✕
            </button>
            {error && <p className="font-body font-bold text-[#FF8A80] text-[11px]">{error}</p>}
          </div>
        </>
      )}
    </div>
  )
}

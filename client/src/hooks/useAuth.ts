import { useEffect } from 'react'
import { useAuthStore, getStoredToken } from '../store/authStore'
import { setSocketAuth, socket } from '../socket'
import { API_BASE } from '../apiBase'

async function apiCall(path: string, options: RequestInit = {}) {
  // headers go last: spreading options after them would drop Content-Type whenever
  // a caller passes its own headers (Authorization), and the server would see no body
  const res = await fetch(`${API_BASE}/api/auth${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options.headers },
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Request failed')
  return data
}

export function useAuth() {
  const { setAuth, logout, setLoading, token, isAuthenticated, user } = useAuthStore()

  // Auto-login from stored token on mount
  useEffect(() => {
    getStoredToken().then((savedToken) => {
      if (!savedToken) {
        setLoading(false)
        return
      }

      apiCall('/me', {
        headers: { Authorization: `Bearer ${savedToken}` },
      })
        .then(({ user }) => {
          setAuth(user, savedToken)
          setSocketAuth(savedToken)
          // Reconnect socket with auth if already connected
          if (socket.connected) {
            socket.disconnect()
            socket.connect()
          }
        })
        .catch(() => {
          // Token invalid — clear it
          useAuthStore.getState().logout()
        })
    })
  }, [])

  /** Returns the address the confirmation link went to, if an email was given */
  const register = async (username: string, password: string, displayName?: string, email?: string): Promise<string | null> => {
    const { token, user } = await apiCall('/register', {
      method: 'POST',
      body: JSON.stringify({ username, password, displayName, email }),
    })
    setAuth(user, token)
    setSocketAuth(token)
    return user.pendingEmail ?? null
  }

  const login = async (username: string, password: string) => {
    const { token, user } = await apiCall('/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    })
    setAuth(user, token)
    setSocketAuth(token)
  }

  const loginWithGoogle = async (idToken: string) => {
    const { token, user } = await apiCall('/google', {
      method: 'POST',
      body: JSON.stringify({ idToken }),
    })
    setAuth(user, token)
    setSocketAuth(token)
  }

  const handleLogout = async () => {
    if (token) {
      await apiCall('/logout', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      }).catch(() => {})
    }
    logout()
    setSocketAuth(null)
    // Reconnect socket without auth token so server sees guest identity
    if (socket.connected) {
      socket.disconnect()
      socket.connect()
    }
  }

  const updateProfile = async (changes: { displayName?: string; email?: string }): Promise<string | null> => {
    const { user: updatedUser } = await apiCall('/profile', {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify(changes),
    })
    // A new email isn't saved yet: it shows up as pendingEmail until confirmed
    const { updateUser } = useAuthStore.getState()
    updateUser({
      displayName: updatedUser.displayName,
      email: updatedUser.email,
      emailVerified: updatedUser.emailVerified,
      pendingEmail: updatedUser.pendingEmail,
    })
    return updatedUser.pendingEmail as string | null
  }

  /** Re-read the profile, e.g. after confirming an email in another tab */
  const refreshUser = async () => {
    const current = useAuthStore.getState().token
    if (!current) return
    const { user: fresh } = await apiCall('/me', { headers: { Authorization: `Bearer ${current}` } })
    useAuthStore.getState().updateUser(fresh)
  }

  return { register, login, loginWithGoogle, logout: handleLogout, updateProfile, refreshUser, isAuthenticated, user, token }
}

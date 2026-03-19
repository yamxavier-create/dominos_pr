import { useEffect } from 'react'
import { useAuthStore } from '../store/authStore'
import { setSocketAuth, socket } from '../socket'

const API_BASE = import.meta.env.VITE_API_URL || ''

async function apiCall(path: string, options: RequestInit = {}) {
  const res = await fetch(`${API_BASE}/api/auth${path}`, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Request failed')
  return data
}

export function useAuth() {
  const { setAuth, logout, setLoading, token, isAuthenticated, user } = useAuthStore()

  // Auto-login from stored token on mount
  useEffect(() => {
    const savedToken = localStorage.getItem('auth_token')
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
        localStorage.removeItem('auth_token')
        setLoading(false)
      })
  }, [])

  const register = async (username: string, password: string, displayName?: string) => {
    const { token, user } = await apiCall('/register', {
      method: 'POST',
      body: JSON.stringify({ username, password, displayName }),
    })
    setAuth(user, token)
    setSocketAuth(token)
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
  }

  return { register, login, loginWithGoogle, logout: handleLogout, isAuthenticated, user, token }
}

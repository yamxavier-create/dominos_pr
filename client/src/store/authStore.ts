import { create } from 'zustand'

export interface AuthUser {
  id: string
  username: string
  displayName: string
  avatarUrl: string | null
  email?: string | null
  stats?: { gamesPlayed: number; gamesWon: number }
}

interface AuthState {
  user: AuthUser | null
  token: string | null
  isAuthenticated: boolean
  loading: boolean

  setAuth: (user: AuthUser, token: string) => void
  logout: () => void
  setLoading: (loading: boolean) => void
  updateUser: (partial: Partial<AuthUser>) => void
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  isAuthenticated: false,
  loading: true,

  setAuth: (user, token) => {
    localStorage.setItem('auth_token', token)
    set({ user, token, isAuthenticated: true, loading: false })
  },

  logout: () => {
    localStorage.removeItem('auth_token')
    set({ user: null, token: null, isAuthenticated: false, loading: false })
  },

  setLoading: (loading) => set({ loading }),

  updateUser: (partial) =>
    set((state) => ({
      user: state.user ? { ...state.user, ...partial } : null,
    })),
}))

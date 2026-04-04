import { create } from 'zustand'
import { Capacitor } from '@capacitor/core'
import { Preferences } from '@capacitor/preferences'

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

// Unified token storage — Capacitor Preferences on native, localStorage on web
const isNative = Capacitor.isNativePlatform()

export async function getStoredToken(): Promise<string | null> {
  if (isNative) {
    const { value } = await Preferences.get({ key: 'auth_token' })
    return value
  }
  return localStorage.getItem('auth_token')
}

async function storeToken(token: string) {
  if (isNative) {
    await Preferences.set({ key: 'auth_token', value: token })
  } else {
    localStorage.setItem('auth_token', token)
  }
}

async function removeToken() {
  if (isNative) {
    await Preferences.remove({ key: 'auth_token' })
  } else {
    localStorage.removeItem('auth_token')
  }
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  isAuthenticated: false,
  loading: true,

  setAuth: (user, token) => {
    storeToken(token)
    set({ user, token, isAuthenticated: true, loading: false })
  },

  logout: () => {
    removeToken()
    set({ user: null, token: null, isAuthenticated: false, loading: false })
  },

  setLoading: (loading) => set({ loading }),

  updateUser: (partial) =>
    set((state) => ({
      user: state.user ? { ...state.user, ...partial } : null,
    })),
}))

import { create } from 'zustand'

export type PresenceStatus = 'online' | 'in_lobby' | 'in_game' | 'offline'

export interface Friend {
  id: string
  username: string
  displayName: string
  avatarUrl: string | null
  roomCode?: string | null
  status: PresenceStatus
}

export interface PresenceNotification {
  id: string
  userId: string
  displayName: string
  type: 'online' | 'in_lobby'
  timestamp: number
}

export interface GameInvite {
  roomCode: string
  from: { id: string; displayName: string }
  playerCount: number
  gameMode: string
  timestamp: number
}

export interface FriendRequest {
  requestId: string
  user: Friend
  direction: 'incoming' | 'outgoing'
}

export interface SearchResult extends Friend {
  friendshipStatus: 'PENDING' | 'ACCEPTED' | null
  friendshipDirection: 'incoming' | 'outgoing' | null
}

interface SocialState {
  friends: Friend[]
  requests: FriendRequest[]
  searchResults: SearchResult[]
  gameInvite: GameInvite | null
  presenceNotifications: PresenceNotification[]
  loading: boolean

  setFriends: (friends: Friend[]) => void
  setRequests: (requests: FriendRequest[]) => void
  setSearchResults: (results: SearchResult[]) => void
  addFriend: (friend: Friend) => void
  removeFriend: (userId: string) => void
  addRequest: (request: FriendRequest) => void
  removeRequest: (requestId: string) => void
  setGameInvite: (invite: GameInvite | null) => void
  updateFriendStatus: (userId: string, status: PresenceStatus) => void
  addPresenceNotification: (notification: PresenceNotification) => void
  removePresenceNotification: (id: string) => void
  setLoading: (loading: boolean) => void
  reset: () => void
}

const initialState = {
  friends: [] as Friend[],
  requests: [] as FriendRequest[],
  searchResults: [] as SearchResult[],
  gameInvite: null as GameInvite | null,
  presenceNotifications: [] as PresenceNotification[],
  loading: false,
}

export const useSocialStore = create<SocialState>((set) => ({
  ...initialState,

  setFriends: (friends) => set({ friends }),
  setRequests: (requests) => set({ requests }),
  setSearchResults: (results) => set({ searchResults: results }),

  addFriend: (friend) =>
    set((state) => ({
      friends: state.friends.some((f) => f.id === friend.id)
        ? state.friends
        : [...state.friends, friend],
    })),

  removeFriend: (userId) =>
    set((state) => ({
      friends: state.friends.filter((f) => f.id !== userId),
    })),

  addRequest: (request) =>
    set((state) => ({
      requests: state.requests.some((r) => r.requestId === request.requestId)
        ? state.requests
        : [...state.requests, request],
    })),

  removeRequest: (requestId) =>
    set((state) => ({
      requests: state.requests.filter((r) => r.requestId !== requestId),
    })),

  setGameInvite: (invite) => set({ gameInvite: invite }),

  updateFriendStatus: (userId, status) =>
    set((state) => ({
      friends: state.friends.map((f) =>
        f.id === userId ? { ...f, status } : f
      ),
    })),

  addPresenceNotification: (notification) =>
    set((state) => ({
      presenceNotifications: [...state.presenceNotifications, notification],
    })),

  removePresenceNotification: (id) =>
    set((state) => ({
      presenceNotifications: state.presenceNotifications.filter((n) => n.id !== id),
    })),

  setLoading: (loading) => set({ loading }),

  reset: () => set(initialState),
}))

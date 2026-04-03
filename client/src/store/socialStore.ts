import { create } from 'zustand'

export interface Friend {
  id: string
  username: string
  displayName: string
  avatarUrl: string | null
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
  loading: boolean

  setFriends: (friends: Friend[]) => void
  setRequests: (requests: FriendRequest[]) => void
  setSearchResults: (results: SearchResult[]) => void
  addFriend: (friend: Friend) => void
  removeFriend: (userId: string) => void
  addRequest: (request: FriendRequest) => void
  removeRequest: (requestId: string) => void
  setLoading: (loading: boolean) => void
  reset: () => void
}

const initialState = {
  friends: [] as Friend[],
  requests: [] as FriendRequest[],
  searchResults: [] as SearchResult[],
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

  setLoading: (loading) => set({ loading }),

  reset: () => set(initialState),
}))

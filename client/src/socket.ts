import { io, Socket } from 'socket.io-client'
import { Capacitor } from '@capacitor/core'

// In dev, Vite proxies /socket.io → localhost:3001
// In production web, Express serves everything on same origin
// On native (Capacitor), connect to the deployed server directly
const SOCKET_URL = Capacitor.isNativePlatform()
  ? 'https://server-production-b2a8.up.railway.app'
  : '/'

export const socket: Socket = io(SOCKET_URL, {
  autoConnect: false,
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
  transports: ['websocket', 'polling'],
})

// Update auth token on socket (call before connecting or reconnecting)
export function setSocketAuth(token: string | null) {
  socket.auth = token ? { token } : {}
}

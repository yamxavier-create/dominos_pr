import { io, Socket } from 'socket.io-client'

// In dev, Vite proxies /socket.io → localhost:3001
// In production, the Express server handles everything on the same origin
const SOCKET_URL = '/'

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

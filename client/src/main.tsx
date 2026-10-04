import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { GoogleOAuthProvider } from '@react-oauth/google'
import './index.css'
import App from './App'

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || ''

// Dev only (stripped from production builds): lets browser tests read call state
// and drive the socket. See e2e/webrtc.spec.ts.
if (import.meta.env.DEV) {
  Promise.all([import('./store/callStore'), import('./store/roomStore'), import('./store/gameStore'), import('./socket')])
    .then(([{ useCallStore }, { useRoomStore }, { useGameStore }, { socket }]) => {
      ;(window as unknown as { __domino: unknown }).__domino = {
        callStore: useCallStore, roomStore: useRoomStore, gameStore: useGameStore, socket,
      }
    })
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <App />
    </GoogleOAuthProvider>
  </StrictMode>
)

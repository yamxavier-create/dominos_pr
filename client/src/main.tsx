import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { GoogleOAuthProvider } from '@react-oauth/google'
import './index.css'
import App from './App'

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || ''

// iOS home-screen app: the viewport comes up one status bar short and leaves an
// empty strip at the bottom. Measure the screen and publish the shortfall as
// --vp-gap; full-screen layers reach down by it (index.css). Same fix as tren-mexicano.
function fitStandalone() {
  const standalone = matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone
  if (!standalone) return
  const fit = () => {
    const portrait = innerHeight > innerWidth
    const full = portrait ? Math.max(screen.width, screen.height) : Math.min(screen.width, screen.height)
    document.documentElement.style.setProperty('--vp-gap', `${Math.max(0, full - innerHeight)}px`)
  }
  fit()
  addEventListener('resize', fit)
  addEventListener('orientationchange', () => setTimeout(fit, 300))
}
fitStandalone()

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

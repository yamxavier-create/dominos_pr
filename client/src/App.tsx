import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useSocket } from './hooks/useSocket'
import { useBackgroundMusic } from './hooks/useBackgroundMusic'
import { useAuth } from './hooks/useAuth'
import { MenuPage } from './pages/MenuPage'
import { LobbyPage } from './pages/LobbyPage'
import { GamePage } from './pages/GamePage'
import { AuthPage } from './pages/AuthPage'
import { PrivacyPage } from './pages/PrivacyPage'
import { TermsPage } from './pages/TermsPage'
import { ResetPasswordPage } from './pages/ResetPasswordPage'
import { VerifyEmailPage } from './pages/VerifyEmailPage'
import { StatsPage } from './pages/StatsPage'
import { GameInviteToast } from './components/social/GameInviteToast'
import { PresenceToast } from './components/social/PresenceToast'
import { ConnectionStatus } from './components/ui/ConnectionStatus'
import { CallHost } from './components/call/CallHost'
import { useRoomStore } from './store/roomStore'

function AppRoutes() {
  useSocket()
  useBackgroundMusic()
  useAuth() // Auto-login from stored token
  const roomCode = useRoomStore(s => s.roomCode)

  return (
    <>
      {/* One call per room: it starts in the lobby and survives every game */}
      {roomCode && <CallHost key={roomCode} />}
      <ConnectionStatus />
      <GameInviteToast />
      <PresenceToast />
      <Routes>
        <Route path="/" element={<MenuPage />} />
        <Route path="/auth" element={<AuthPage />} />
        <Route path="/lobby" element={<LobbyPage />} />
        <Route path="/game" element={<GamePage />} />
        <Route path="/stats" element={<StatsPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/verify-email" element={<VerifyEmailPage />} />
        <Route path="/privacy" element={<PrivacyPage />} />
        <Route path="/terms" element={<TermsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  )
}

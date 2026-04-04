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
import { StatsPage } from './pages/StatsPage'
import { GameInviteToast } from './components/social/GameInviteToast'
import { PresenceToast } from './components/social/PresenceToast'
import { ConnectionStatus } from './components/ui/ConnectionStatus'

function AppRoutes() {
  useSocket()
  useBackgroundMusic()
  useAuth() // Auto-login from stored token

  return (
    <>
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

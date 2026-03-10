import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useSocket } from './hooks/useSocket'
import { MenuPage } from './pages/MenuPage'
import { LobbyPage } from './pages/LobbyPage'
import { GamePage } from './pages/GamePage'

function AppRoutes() {
  useSocket()

  return (
    <Routes>
      <Route path="/" element={<MenuPage />} />
      <Route path="/lobby" element={<LobbyPage />} />
      <Route path="/game" element={<GamePage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  )
}

import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { API_BASE } from '../apiBase'

type Tab = 'stats' | 'history' | 'leaderboard'

interface MyStats {
  gamesPlayed: number
  gamesWon: number
  winRate: number
}

interface GameRecord {
  id: string
  gameMode: string
  won: boolean
  team: number
  winningTeam: number
  scoreTeam0: number
  scoreTeam1: number
  totalRounds: number
  playerCount: number
  endedAt: string
  players: { name: string; index: number; team: number; won: boolean }[]
}

interface LeaderEntry {
  rank: number
  userId: string
  displayName: string
  avatarUrl: string | null
  gamesPlayed: number
  gamesWon: number
  winRate: number
}

export function StatsPage() {
  const navigate = useNavigate()
  const { token, isAuthenticated, user } = useAuthStore()
  const [tab, setTab] = useState<Tab>('stats')
  const [stats, setStats] = useState<MyStats | null>(null)
  const [history, setHistory] = useState<GameRecord[]>([])
  const [leaderboard, setLeaderboard] = useState<LeaderEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!isAuthenticated) return
    setLoading(true)

    if (tab === 'stats') {
      fetch(`${API_BASE}/api/stats/me`, { headers: { Authorization: `Bearer ${token}` } })
        .then(r => r.json())
        .then(setStats)
        .catch(() => {})
        .finally(() => setLoading(false))
    } else if (tab === 'history') {
      fetch(`${API_BASE}/api/stats/history?limit=20`, { headers: { Authorization: `Bearer ${token}` } })
        .then(r => r.json())
        .then(d => setHistory(d.games || []))
        .catch(() => {})
        .finally(() => setLoading(false))
    } else {
      fetch(`${API_BASE}/api/stats/leaderboard?limit=50`)
        .then(r => r.json())
        .then(d => setLeaderboard(d.leaderboard || []))
        .catch(() => {})
        .finally(() => setLoading(false))
    }
  }, [tab, isAuthenticated, token])

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen felt-table flex items-center justify-center p-4">
        <div className="menu-card text-center max-w-xs">
          <h2 className="font-header text-2xl text-gold mb-3">Inicia sesión</h2>
          <p className="font-body text-white/50 text-sm mb-4">Necesitas una cuenta para ver estadísticas.</p>
          <button onClick={() => navigate('/auth')} className="font-body text-primary text-sm">Iniciar sesión</button>
        </div>
      </div>
    )
  }

  const tabClass = (t: Tab) =>
    `flex-1 py-2 text-center font-body text-sm rounded-xl transition-all ${
      tab === t ? 'bg-white/10 text-gold font-bold' : 'text-white/40 hover:text-white/60'
    }`

  return (
    <div className="min-h-screen felt-table overflow-y-auto">
      <div className="max-w-md mx-auto px-4 py-6">
        <button
          onClick={() => navigate('/')}
          className="font-body text-white/40 hover:text-white/70 text-sm mb-4 transition-colors"
        >
          ← Menú
        </button>

        <h1 className="font-header text-3xl text-gold mb-4">Estadísticas</h1>

        {/* Tabs */}
        <div className="flex gap-1 p-1 rounded-2xl mb-5" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
          <button className={tabClass('stats')} onClick={() => setTab('stats')}>Mis Stats</button>
          <button className={tabClass('history')} onClick={() => setTab('history')}>Historial</button>
          <button className={tabClass('leaderboard')} onClick={() => setTab('leaderboard')}>Ranking</button>
        </div>

        {loading ? (
          <p className="font-body text-white/30 text-sm text-center py-8">Cargando...</p>
        ) : tab === 'stats' && stats ? (
          <div className="grid grid-cols-3 gap-3">
            <StatCard label="Jugadas" value={stats.gamesPlayed} />
            <StatCard label="Ganadas" value={stats.gamesWon} color="#22C55E" />
            <StatCard label="Win Rate" value={`${stats.winRate}%`} color="#EAB308" />
          </div>
        ) : tab === 'history' ? (
          history.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-3xl mb-3">🎲</p>
              <p className="font-body text-white/40 text-sm">Juega tu primera partida para ver tu historial</p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {history.map((g) => (
                <div
                  key={g.id}
                  className="rounded-xl p-3 flex items-center justify-between"
                  style={{
                    background: 'rgba(255,255,255,0.04)',
                    border: `1px solid ${g.won ? 'rgba(34,197,94,0.2)' : 'rgba(255,255,255,0.06)'}`,
                  }}
                >
                  <div>
                    <p className="font-body text-white text-sm font-semibold">
                      {g.won ? '✓ Victoria' : '✗ Derrota'}
                      <span className="text-white/30 font-normal ml-2">{g.gameMode === 'modo200' ? 'M·200' : 'M·500'}</span>
                    </p>
                    <p className="font-body text-white/30 text-xs mt-0.5">
                      {g.scoreTeam0} - {g.scoreTeam1} · {g.totalRounds} rondas · {g.playerCount}P
                    </p>
                  </div>
                  <p className="font-body text-white/20 text-xs">
                    {new Date(g.endedAt).toLocaleDateString('es-PR', { month: 'short', day: 'numeric' })}
                  </p>
                </div>
              ))}
            </div>
          )
        ) : tab === 'leaderboard' ? (
          leaderboard.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-3xl mb-3">🏆</p>
              <p className="font-body text-white/40 text-sm">Aún no hay jugadores en el ranking</p>
            </div>
          ) : (
            <div className="flex flex-col gap-1.5">
              {leaderboard.map((entry) => (
                <div
                  key={entry.userId}
                  className="rounded-xl px-3 py-2.5 flex items-center gap-3"
                  style={{
                    background: entry.userId === user?.id ? 'rgba(234,179,8,0.08)' : 'rgba(255,255,255,0.03)',
                    border: entry.userId === user?.id ? '1px solid rgba(234,179,8,0.2)' : '1px solid rgba(255,255,255,0.05)',
                  }}
                >
                  <span className="font-header text-lg w-8 text-center" style={{ color: entry.rank <= 3 ? '#EAB308' : 'rgba(255,255,255,0.3)' }}>
                    {entry.rank}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="font-body text-white text-sm font-semibold truncate">{entry.displayName}</p>
                    <p className="font-body text-white/30 text-xs">{entry.gamesWon}W · {entry.winRate}%</p>
                  </div>
                  <span className="font-header text-lg text-primary">{entry.gamesWon}</span>
                </div>
              ))}
            </div>
          )
        ) : null}
      </div>
    </div>
  )
}

function StatCard({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <div className="rounded-xl p-4 text-center" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
      <p className="font-header text-2xl" style={{ color: color || '#fff' }}>{value}</p>
      <p className="font-body text-white/40 text-xs mt-1">{label}</p>
    </div>
  )
}

import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { API_BASE } from '../apiBase'
import { MODE_SHORT } from '../rules'
import { GameMode } from '../types/game'
import { StageBackdrop } from '../components/ui/Escenario'

type Tab = 'stats' | 'history' | 'leaderboard'

interface MyStats {
  gamesPlayed: number
  gamesWon: number
  winRate: number
}

interface GameRecord {
  id: string
  gameMode: string
  ranked: boolean
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
        <StageBackdrop still />
        <div className="mm-pop relative menu-card text-center max-w-xs">
          <h2 className="mm-title text-2xl mb-3">Inicia sesión</h2>
          <p className="font-body font-bold text-white/75 text-sm mb-4">Necesitas una cuenta para ver estadísticas.</p>
          <button onClick={() => navigate('/auth')} className="mm-btn-gold mm-stroke">Iniciar sesión</button>
        </div>
      </div>
    )
  }


  return (
    <div className="min-h-screen felt-table overflow-y-auto">
      <StageBackdrop still />
      <div className="relative max-w-md mx-auto px-4 py-6" style={{ paddingTop: 'max(24px, env(safe-area-inset-top))' }}>
        <button
          onClick={() => navigate('/')}
          className="btn-outline-shine rounded-xl px-3 py-1.5 font-chunky text-base tracking-wide mm-stroke mb-4"
        >
          ‹ Menú
        </button>

        <h1 className="mm-drop mm-title text-4xl mb-4">Estadísticas</h1>

        {/* Tabs */}
        <div className="mm-tabs mb-5">
          <button className="mm-tab" aria-pressed={tab === 'stats'} onClick={() => setTab('stats')}>Mis Stats</button>
          <button className="mm-tab" aria-pressed={tab === 'history'} onClick={() => setTab('history')}>Historial</button>
          <button className="mm-tab" aria-pressed={tab === 'leaderboard'} onClick={() => setTab('leaderboard')}>Ranking</button>
        </div>

        {loading ? (
          <p className="font-body font-bold text-white/70 text-sm text-center py-8">Cargando...</p>
        ) : tab === 'stats' && stats ? (
          <div className="grid grid-cols-3 gap-3">
            <StatCard label="Jugadas" value={stats.gamesPlayed} />
            <StatCard label="Ganadas" value={stats.gamesWon} color="#5BEA9B" />
            <StatCard label="Win Rate" value={`${stats.winRate}%`} color="#FDD04B" />
          </div>
        ) : tab === 'history' ? (
          history.length === 0 ? (
            <div className="mm-panel text-center py-10 px-4">
              <p className="text-4xl mb-3">🎲</p>
              <p className="font-body font-bold text-white/75 text-sm">Juega tu primera partida para ver tu historial</p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {history.map((g) => (
                <div
                  key={g.id}
                  className="mm-well p-3 flex items-center justify-between gap-3"
                  style={{ borderLeft: `6px solid ${g.won ? '#2E9A57' : '#C2392F'}` }}
                >
                  <div className="min-w-0">
                    <p className="text-sm">
                      <span className="font-chunky text-base tracking-wide mm-stroke" style={{ color: g.won ? '#5BEA9B' : '#FF8A80' }}>
                        {g.won ? '✓ Victoria' : '✗ Derrota'}
                      </span>
                      <span className="font-body font-bold text-white/70 ml-2">{MODE_SHORT[g.gameMode as GameMode] ?? g.gameMode}</span>
                      {g.ranked === false && <span className="font-body font-bold text-white/70 ml-2">· Práctica (no cuenta)</span>}
                    </p>
                    <p className="font-body font-bold text-white/70 text-xs mt-0.5">
                      <span className="font-chunky text-white">{g.scoreTeam0} - {g.scoreTeam1}</span> · {g.totalRounds} rondas · {g.playerCount}P
                    </p>
                  </div>
                  <p className="font-body font-bold text-white/70 text-xs shrink-0">
                    {new Date(g.endedAt).toLocaleDateString('es-PR', { month: 'short', day: 'numeric' })}
                  </p>
                </div>
              ))}
            </div>
          )
        ) : tab === 'leaderboard' ? (
          leaderboard.length === 0 ? (
            <div className="mm-panel text-center py-10 px-4">
              <p className="text-4xl mb-3">🏆</p>
              <p className="font-body font-bold text-white/75 text-sm">Aún no hay jugadores en el ranking</p>
            </div>
          ) : (
            <div className="flex flex-col gap-1.5">
              {leaderboard.map((entry) => (
                <div
                  key={entry.userId}
                  className="mm-well px-3 py-2.5 flex items-center gap-3"
                  style={entry.userId === user?.id ? { boxShadow: 'inset 0 3px 0 rgba(0,0,0,0.3), 0 0 0 2px #FDD04B' } : undefined}
                >
                  <RankMedal rank={entry.rank} />
                  <div className="flex-1 min-w-0">
                    <p className="font-chunky text-white text-base tracking-wide truncate">{entry.displayName}</p>
                    <p className="font-body font-bold text-white/70 text-xs">{entry.gamesWon}W · {entry.winRate}%</p>
                  </div>
                  <span className="font-chunky text-xl mm-stroke" style={{ color: '#5BEA9B' }}>{entry.gamesWon}</span>
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
    <div className="mm-pop mm-panel p-4 text-center">
      <p className="font-chunky text-3xl leading-none mm-stroke" style={{ color: color || '#fff' }}>{value}</p>
      <p className="font-body font-extrabold text-white/75 text-xs mt-1.5">{label}</p>
    </div>
  )
}

const MEDALS: Record<number, [string, string]> = {
  1: ['#FFE27A', '#D18F0E'],
  2: ['#F1F5F9', '#94A3B8'],
  3: ['#F4B583', '#A0582A'],
}

/** Gold, silver and bronze medallions for the top three, a plain number after */
function RankMedal({ rank }: { rank: number }) {
  const medal = MEDALS[rank]
  if (!medal) {
    return <span className="font-chunky text-lg w-9 text-center text-white/70 shrink-0">{rank}</span>
  }
  return (
    <span
      className="w-9 h-9 shrink-0 rounded-full flex items-center justify-center font-chunky text-lg text-[#2B1B12]"
      style={{
        background: `linear-gradient(180deg, ${medal[0]}, ${medal[1]})`,
        border: '2px solid #06140B',
        boxShadow: '0 3px 0 #06140B, inset 0 2px 0 rgba(255,255,255,0.6)',
      }}
    >
      {rank}
    </span>
  )
}

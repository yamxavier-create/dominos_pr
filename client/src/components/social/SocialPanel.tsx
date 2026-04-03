import { useState } from 'react'
import { useSocialStore } from '../../store/socialStore'
import { UserSearch } from './UserSearch'
import { FriendRequests } from './FriendRequests'
import { FriendsList } from './FriendsList'

type Tab = 'search' | 'requests' | 'friends'

export function SocialPanel({ onClose }: { onClose: () => void }) {
  const [activeTab, setActiveTab] = useState<Tab>('friends')
  const requests = useSocialStore((s) => s.requests)
  const incomingCount = requests.filter((r) => r.direction === 'incoming').length

  const tabs: { key: Tab; label: string; badge?: number }[] = [
    { key: 'search', label: 'Buscar' },
    { key: 'requests', label: 'Solicitudes', badge: incomingCount > 0 ? incomingCount : undefined },
    { key: 'friends', label: 'Amigos' },
  ]

  return (
    <div className="flex flex-col gap-4 w-full max-w-sm">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="font-header text-2xl text-gold">Amigos</h2>
        <button
          onClick={onClose}
          className="font-body text-white/40 hover:text-white/70 text-sm transition-colors"
        >
          Cerrar
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-white/5 rounded-xl p-1">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex-1 font-body text-xs py-2 rounded-lg transition-all relative ${
              activeTab === tab.key
                ? 'bg-green-500/20 text-green-400 font-bold'
                : 'text-white/40 hover:text-white/60'
            }`}
          >
            {tab.label}
            {tab.badge !== undefined && (
              <span className="absolute -top-1 -right-1 bg-green-500 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                {tab.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="min-h-[200px]">
        {activeTab === 'search' && <UserSearch />}
        {activeTab === 'requests' && <FriendRequests />}
        {activeTab === 'friends' && <FriendsList />}
      </div>
    </div>
  )
}

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
        <h2 className="mm-title text-3xl">Amigos</h2>
        <button
          onClick={onClose}
          className="btn-outline-shine rounded-xl px-3 py-1.5 font-chunky text-base tracking-wide mm-stroke"
        >
          Cerrar
        </button>
      </div>

      {/* Tabs */}
      <div className="mm-tabs">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            aria-pressed={activeTab === tab.key}
            className="mm-tab relative"
          >
            {tab.label}
            {tab.badge !== undefined && (
              <span
                className="absolute -top-2 -right-1.5 min-w-[20px] h-5 px-1 rounded-full flex items-center justify-center font-chunky text-[11px] text-white"
                style={{ background: '#E5322D', border: '2px solid #fff', boxShadow: '0 2px 0 #06140B' }}
              >
                {tab.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="mm-panel p-3 min-h-[200px]">
        {activeTab === 'search' && <UserSearch />}
        {activeTab === 'requests' && <FriendRequests />}
        {activeTab === 'friends' && <FriendsList />}
      </div>
    </div>
  )
}

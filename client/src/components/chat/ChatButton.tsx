import { useUIStore } from '../../store/uiStore'

export function ChatButton() {
  const chatOpen = useUIStore(s => s.chatOpen)
  const unreadCount = useUIStore(s => s.unreadCount)

  const toggle = () => {
    useUIStore.getState().setChatOpen(!chatOpen)
  }

  return (
    <button
      onClick={toggle}
      className="fixed bottom-20 right-4 z-40 w-12 h-12 rounded-full bg-blue-600 hover:bg-blue-500 transition-colors shadow-lg flex items-center justify-center"
      aria-label="Toggle chat"
    >
      {/* Chat bubble icon */}
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="white"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="w-6 h-6"
      >
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      </svg>

      {/* Unread badge */}
      {unreadCount > 0 && (
        <span className="absolute -top-1 -right-1 min-w-5 h-5 flex items-center justify-center rounded-full bg-red-500 text-white text-xs font-bold px-1">
          {unreadCount > 9 ? '9+' : unreadCount}
        </span>
      )}
    </button>
  )
}

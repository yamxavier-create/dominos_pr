import { useState } from 'react'
import { joinCallRef } from '../../hooks/useWebRTC'
import { useCallStore } from '../../store/callStore'

interface JoinCallButtonProps {
  className?: string
}

export function JoinCallButton({ className }: JoinCallButtonProps) {
  const [joining, setJoining] = useState(false)
  const inCall = useCallStore(s => s.myAudioEnabled || s.myVideoEnabled)

  if (inCall) return null

  const handleJoin = async () => {
    setJoining(true)
    try {
      await joinCallRef.current?.(true, true)
    } finally {
      setJoining(false)
    }
  }

  return (
    <button
      onClick={handleJoin}
      disabled={joining}
      className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5
        text-white font-body text-xs font-bold
        disabled:opacity-50 disabled:cursor-not-allowed
        active:scale-95 transition-all duration-200
        ${className ?? ''}`}
      style={{
        background: 'linear-gradient(135deg, #22C55E, #16a34a)',
        boxShadow: '0 4px 14px rgba(34,197,94,0.35), inset 0 1px 0 rgba(255,255,255,0.35), inset 0 -1px 0 rgba(0,0,0,0.2)',
      }}
    >
      {joining ? (
        <>
          <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round" />
          </svg>
          Conectando
        </>
      ) : (
        <>
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="23 7 16 12 23 17 23 7" />
            <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
          </svg>
          Llamada
        </>
      )}
    </button>
  )
}

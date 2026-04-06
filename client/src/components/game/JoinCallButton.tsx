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
      className={`rounded-full px-3 py-1.5
        btn-glow text-white font-body text-xs font-bold
        disabled:opacity-50 disabled:cursor-not-allowed
        transition-all duration-200
        ${className ?? ''}`}
    >
      {joining ? 'Conectando...' : '📹 Llamada'}
    </button>
  )
}

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
      className={`fixed bottom-20 right-4 z-30 rounded-full shadow-lg px-4 py-2
        bg-green-600 hover:bg-green-700 text-white font-body text-sm
        disabled:opacity-50 disabled:cursor-not-allowed
        transition-colors duration-200
        ${className ?? ''}`}
    >
      {joining ? 'Conectando...' : '\uD83D\uDCF7 Unirse a llamada'}
    </button>
  )
}

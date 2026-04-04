import { useState, useEffect } from 'react'
import { socket } from '../../socket'

export function ConnectionStatus() {
  const [disconnected, setDisconnected] = useState(false)
  const [reconnecting, setReconnecting] = useState(false)

  useEffect(() => {
    const onDisconnect = () => {
      setDisconnected(true)
      setReconnecting(true)
    }
    const onConnect = () => {
      setDisconnected(false)
      setReconnecting(false)
    }
    const onReconnectFailed = () => {
      setReconnecting(false)
    }

    socket.on('disconnect', onDisconnect)
    socket.on('connect', onConnect)
    socket.io.on('reconnect_failed', onReconnectFailed)

    return () => {
      socket.off('disconnect', onDisconnect)
      socket.off('connect', onConnect)
      socket.io.off('reconnect_failed', onReconnectFailed)
    }
  }, [])

  if (!disconnected) return null

  return (
    <div className="fixed top-0 left-0 right-0 z-50 flex items-center justify-center py-2 px-4"
      style={{ background: 'rgba(239, 68, 68, 0.9)', backdropFilter: 'blur(8px)' }}
    >
      <p className="font-body text-white text-sm font-semibold">
        {reconnecting ? (
          <>
            <span className="inline-block animate-spin mr-2">⟳</span>
            Reconectando...
          </>
        ) : (
          <>
            Conexión perdida — <button onClick={() => socket.connect()} className="underline">Reintentar</button>
          </>
        )}
      </p>
    </div>
  )
}

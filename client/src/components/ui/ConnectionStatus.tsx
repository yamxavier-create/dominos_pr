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
    <div className="mm-drop fixed top-0 left-0 right-0 z-50 flex items-center justify-center py-2 px-4"
      style={{
        background: 'linear-gradient(180deg, #E5534A 0%, #C2392F 55%, #8E2A22 100%)',
        borderBottom: '3px solid #06140B',
        boxShadow: '0 4px 0 #06140B',
        paddingTop: 'calc(0.5rem + var(--safe-top))',
      }}
    >
      <p className="font-chunky text-white text-base tracking-wide mm-stroke">
        {reconnecting ? (
          <>
            <span className="inline-block animate-spin mr-2">⟳</span>
            Reconectando...
          </>
        ) : (
          <>
            Conexión perdida — <button onClick={() => socket.connect()} className="mm-chip ml-1 !text-sm">Reintentar</button>
          </>
        )}
      </p>
    </div>
  )
}

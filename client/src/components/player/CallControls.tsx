import { useCallStore } from '../../store/callStore'
import { useRoomStore } from '../../store/roomStore'
import { socket } from '../../socket'

interface CallControlsProps {
  className?: string
}

export function CallControls({ className }: CallControlsProps) {
  const micMuted = useCallStore(s => s.micMuted)
  const cameraOff = useCallStore(s => s.cameraOff)
  const localStream = useCallStore(s => s.localStream)
  const roomCode = useRoomStore(s => s.roomCode)

  const handleMicToggle = (e: React.MouseEvent) => {
    e.stopPropagation()
    const newMuted = !micMuted
    useCallStore.getState().setMicMuted(newMuted)
    localStream?.getAudioTracks().forEach(t => { t.enabled = !newMuted })
    socket.emit('webrtc:toggle', {
      roomCode,
      micMuted: newMuted,
      cameraOff,
    })
  }

  const handleCameraToggle = (e: React.MouseEvent) => {
    e.stopPropagation()
    const newOff = !cameraOff
    useCallStore.getState().setCameraOff(newOff)
    localStream?.getVideoTracks().forEach(t => { t.enabled = !newOff })
    socket.emit('webrtc:toggle', {
      roomCode,
      micMuted,
      cameraOff: newOff,
    })
  }

  const offBg = 'rgba(220,38,38,0.92)'
  const onBg = 'rgba(0,0,0,0.55)'
  const offShadow = '0 0 10px rgba(220,38,38,0.45), inset 0 1px 0 rgba(255,255,255,0.15)'
  const onShadow = 'inset 0 1px 0 rgba(255,255,255,0.08)'

  return (
    <div className={`flex gap-1 ${className ?? ''}`}>
      <button
        onClick={handleMicToggle}
        className="w-7 h-7 rounded-full flex items-center justify-center active:scale-90 transition-transform"
        style={{
          background: micMuted ? offBg : onBg,
          border: '1px solid rgba(255,255,255,0.12)',
          boxShadow: micMuted ? offShadow : onShadow,
        }}
        title={micMuted ? 'Activar mic' : 'Silenciar mic'}
        aria-label={micMuted ? 'Activar mic' : 'Silenciar mic'}
      >
        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
          <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
          <line x1="12" y1="19" x2="12" y2="23" />
          <line x1="8" y1="23" x2="16" y2="23" />
          {micMuted && <line x1="3" y1="3" x2="21" y2="21" stroke="white" strokeWidth="2.2" />}
        </svg>
      </button>
      <button
        onClick={handleCameraToggle}
        className="w-7 h-7 rounded-full flex items-center justify-center active:scale-90 transition-transform"
        style={{
          background: cameraOff ? offBg : onBg,
          border: '1px solid rgba(255,255,255,0.12)',
          boxShadow: cameraOff ? offShadow : onShadow,
        }}
        title={cameraOff ? 'Activar camara' : 'Apagar camara'}
        aria-label={cameraOff ? 'Activar camara' : 'Apagar camara'}
      >
        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="23 7 16 12 23 17 23 7" />
          <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
          {cameraOff && <line x1="3" y1="3" x2="21" y2="21" stroke="white" strokeWidth="2.2" />}
        </svg>
      </button>
    </div>
  )
}

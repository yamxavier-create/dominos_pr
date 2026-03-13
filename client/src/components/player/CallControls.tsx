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

  return (
    <div className={`flex gap-1 ${className ?? ''}`}>
      <button
        onClick={handleMicToggle}
        className="w-7 h-7 rounded-full flex items-center justify-center text-xs"
        style={{
          background: micMuted ? 'rgba(220,38,38,0.9)' : 'rgba(0,0,0,0.6)',
        }}
        title={micMuted ? 'Activar mic' : 'Silenciar mic'}
      >
        {micMuted ? '\u{1F507}' : '\u{1F3A4}'}
      </button>
      <button
        onClick={handleCameraToggle}
        className="w-7 h-7 rounded-full flex items-center justify-center text-xs"
        style={{
          background: cameraOff ? 'rgba(220,38,38,0.9)' : 'rgba(0,0,0,0.6)',
        }}
        title={cameraOff ? 'Activar camara' : 'Apagar camara'}
      >
        {cameraOff ? '\u{1F4F5}' : '\u{1F4F7}'}
      </button>
    </div>
  )
}

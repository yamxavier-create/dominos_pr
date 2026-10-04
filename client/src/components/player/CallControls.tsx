import { useCallStore } from '../../store/callStore'
import { useRoomStore } from '../../store/roomStore'
import { socket } from '../../socket'

/** Mic and camera switches for the local player, shared by the seat and the dock. */
export function useCallToggles() {
  const micMuted = useCallStore(s => s.micMuted)
  const cameraOff = useCallStore(s => s.cameraOff)
  const localStream = useCallStore(s => s.localStream)
  const roomCode = useRoomStore(s => s.roomCode)

  const toggleMic = () => {
    const newMuted = !micMuted
    useCallStore.getState().setMicMuted(newMuted)
    localStream?.getAudioTracks().forEach(t => { t.enabled = !newMuted })
    socket.emit('webrtc:toggle', { roomCode, micMuted: newMuted, cameraOff })
  }

  const toggleCamera = () => {
    const newOff = !cameraOff
    useCallStore.getState().setCameraOff(newOff)
    localStream?.getVideoTracks().forEach(t => { t.enabled = !newOff })
    socket.emit('webrtc:toggle', { roomCode, micMuted, cameraOff: newOff })
  }

  return { micMuted, cameraOff, toggleMic, toggleCamera }
}

export function MicIcon({ muted }: { muted: boolean }) {
  return (
    <>
      <path d="M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <path d="M12 19v3" />
      {muted && <path d="M4 4l16 16" />}
    </>
  )
}

export function CameraIcon({ off }: { off: boolean }) {
  return (
    <>
      <path d="M3 7h11v10H3z" />
      <path d="M14 10.5l7-3.5v10l-7-3.5" />
      {off && <path d="M3 3l18 18" />}
    </>
  )
}

interface CallControlsProps {
  className?: string
}

/** Small mic/camera switches on the player's own seat (landscape and desktop layouts). */
export function CallControls({ className }: CallControlsProps) {
  const { micMuted, cameraOff, toggleMic, toggleCamera } = useCallToggles()

  const button = (label: string, pressed: boolean, onClick: () => void, icon: React.ReactNode) => (
    <button
      type="button"
      onClick={e => { e.stopPropagation(); onClick() }}
      className="club-btn w-7 h-7"
      aria-pressed={pressed}
      title={label}
      aria-label={label}
    >
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        {icon}
      </svg>
    </button>
  )

  return (
    <div className={`flex gap-1 ${className ?? ''}`}>
      {button(micMuted ? 'Activar mic' : 'Silenciar mic', micMuted, toggleMic, <MicIcon muted={micMuted} />)}
      {button(cameraOff ? 'Activar camara' : 'Apagar camara', cameraOff, toggleCamera, <CameraIcon off={cameraOff} />)}
    </div>
  )
}

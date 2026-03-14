import { useUIStore } from '../../store/uiStore'

export function SfxToggleButton() {
  const sfxEnabled = useUIStore(s => s.sfxEnabled)
  const toggleSfx = useUIStore(s => s.toggleSfx)

  return (
    <button
      onClick={toggleSfx}
      className="fixed bottom-20 left-4 z-30 rounded-full shadow-lg w-10 h-10
        flex items-center justify-center
        bg-black/60 hover:bg-black/80 text-white
        transition-colors duration-200"
      title={sfxEnabled ? 'Silenciar efectos' : 'Activar efectos'}
    >
      {sfxEnabled ? '🔊' : '🔇'}
    </button>
  )
}

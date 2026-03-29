import { useUIStore } from '../../store/uiStore'

export function AudioControls() {
  const sfxEnabled = useUIStore(s => s.sfxEnabled)
  const toggleSfx = useUIStore(s => s.toggleSfx)

  return (
    <div className="fixed bottom-20 left-4 z-30">
      <button
        onClick={toggleSfx}
        className="rounded-full shadow-lg w-10 h-10 flex items-center justify-center
          bg-black/60 hover:bg-black/80 text-white transition-colors duration-200"
        title={sfxEnabled ? 'Silenciar' : 'Activar sonido'}
      >
        {sfxEnabled ? '\uD83D\uDD0A' : '\uD83D\uDD07'}
      </button>
    </div>
  )
}

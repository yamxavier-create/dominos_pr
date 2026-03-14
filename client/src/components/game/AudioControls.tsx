import { useUIStore } from '../../store/uiStore'

export function AudioControls() {
  const sfxEnabled = useUIStore(s => s.sfxEnabled)
  const musicEnabled = useUIStore(s => s.musicEnabled)
  const toggleSfx = useUIStore(s => s.toggleSfx)
  const toggleMusic = useUIStore(s => s.toggleMusic)

  return (
    <div className="fixed bottom-20 left-4 z-30 flex flex-col gap-2">
      <button
        onClick={toggleSfx}
        className="rounded-full shadow-lg w-10 h-10 flex items-center justify-center
          bg-black/60 hover:bg-black/80 text-white transition-colors duration-200"
        title={sfxEnabled ? 'Silenciar efectos' : 'Activar efectos'}
      >
        {sfxEnabled ? '\uD83D\uDD0A' : '\uD83D\uDD07'}
      </button>
      <button
        onClick={toggleMusic}
        className="rounded-full shadow-lg w-10 h-10 flex items-center justify-center
          bg-black/60 hover:bg-black/80 text-white transition-colors duration-200"
        title={musicEnabled ? 'Silenciar musica' : 'Activar musica'}
      >
        {musicEnabled ? '\uD83C\uDFB5' : '\uD83D\uDD15'}
      </button>
    </div>
  )
}

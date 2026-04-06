import { useUIStore } from '../../store/uiStore'

export function AudioControls() {
  const sfxEnabled = useUIStore(s => s.sfxEnabled)
  const musicEnabled = useUIStore(s => s.musicEnabled)
  const toggleSfx = useUIStore(s => s.toggleSfx)
  const toggleMusic = useUIStore(s => s.toggleMusic)

  const allOn = sfxEnabled && musicEnabled
  const allOff = !sfxEnabled && !musicEnabled

  const handleToggle = () => {
    if (allOn) {
      // Mute both
      if (sfxEnabled) toggleSfx()
      if (musicEnabled) toggleMusic()
    } else {
      // Enable both
      if (!sfxEnabled) toggleSfx()
      if (!musicEnabled) toggleMusic()
    }
  }

  return (
    <div className="fixed z-30" style={{ bottom: 'calc(5rem + env(safe-area-inset-bottom))', left: 'calc(1rem + env(safe-area-inset-left))' }}>
      <button
        onClick={handleToggle}
        className="game-btn-circle rounded-full w-10 h-10 flex items-center justify-center
          text-white"
        title={allOff ? 'Activar sonido' : 'Silenciar'}
      >
        {allOff ? '\uD83D\uDD07' : '\uD83D\uDD0A'}
      </button>
    </div>
  )
}

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
    <button
      onClick={handleToggle}
      className="club-btn w-10 h-10"
      title={allOff ? 'Activar sonido' : 'Silenciar'}
      aria-label={allOff ? 'Activar sonido' : 'Silenciar'}
    >
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
        {allOff ? (
          <>
            <line x1="23" y1="9" x2="17" y2="15" />
            <line x1="17" y1="9" x2="23" y2="15" />
          </>
        ) : (
          <>
            <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
            <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
          </>
        )}
      </svg>
    </button>
  )
}

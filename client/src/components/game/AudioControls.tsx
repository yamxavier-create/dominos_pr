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
    <div className="fixed bottom-20 left-4 z-30">
      <button
        onClick={handleToggle}
        className="rounded-full w-10 h-10 flex items-center justify-center text-white active:scale-90 transition-transform"
        style={{
          background: 'rgba(0,0,0,0.55)',
          border: '1px solid rgba(255,255,255,0.12)',
          backdropFilter: 'blur(8px)',
          boxShadow: '0 4px 12px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.08)',
        }}
        title={allOff ? 'Activar sonido' : 'Silenciar'}
        aria-label={allOff ? 'Activar sonido' : 'Silenciar'}
      >
        <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
    </div>
  )
}

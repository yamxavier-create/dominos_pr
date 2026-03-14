import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { useUIStore } from '../store/uiStore'
import { playMusic, stopMusic, pauseMusic } from '../audio/music'

const MUSIC_ROUTES = ['/', '/lobby']

export function useBackgroundMusic(): void {
  const { pathname } = useLocation()
  const musicEnabled = useUIStore(s => s.musicEnabled)

  useEffect(() => {
    const shouldPlay = MUSIC_ROUTES.includes(pathname) && musicEnabled

    if (shouldPlay) {
      playMusic()
    } else if (!musicEnabled) {
      pauseMusic()
    } else {
      stopMusic()
    }
  }, [pathname, musicEnabled])
}

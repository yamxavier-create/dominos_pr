import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { useUIStore } from '../store/uiStore'
import { playMusic, stopMusic, pauseMusic } from '../audio/music'

const MUSIC_ROUTES = ['/', '/lobby']

export function useBackgroundMusic(): void {
  const { pathname } = useLocation()
  const musicEnabled = useUIStore(s => s.musicEnabled)
  const unlockRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    // Clean up any previous unlock listener
    if (unlockRef.current) {
      unlockRef.current()
      unlockRef.current = null
    }

    if (MUSIC_ROUTES.includes(pathname) && musicEnabled) {
      playMusic().then(started => {
        if (!started) {
          // Autoplay blocked -- unlock on first user interaction
          const unlock = () => {
            playMusic()
            cleanup()
          }
          const cleanup = () => {
            document.removeEventListener('click', unlock)
            document.removeEventListener('keydown', unlock)
            document.removeEventListener('touchstart', unlock)
            unlockRef.current = null
          }
          document.addEventListener('click', unlock)
          document.addEventListener('keydown', unlock)
          document.addEventListener('touchstart', unlock)
          unlockRef.current = cleanup
        }
      })
    } else if (!musicEnabled) {
      pauseMusic() // Preserve position for resume when toggled back on
    } else {
      stopMusic() // Full stop + reset when leaving music routes (e.g. /game)
    }

    return () => {
      if (unlockRef.current) {
        unlockRef.current()
        unlockRef.current = null
      }
    }
  }, [pathname, musicEnabled])
}

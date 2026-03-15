import { useEffect, useRef } from 'react'
import { useUIStore } from '../store/uiStore'
import { playMusic, pauseMusic } from '../audio/music'

export function useBackgroundMusic(): void {
  const musicEnabled = useUIStore(s => s.musicEnabled)
  const unlockRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    // Clean up any previous unlock listener
    if (unlockRef.current) {
      unlockRef.current()
      unlockRef.current = null
    }

    if (musicEnabled) {
      playMusic().then(started => {
        if (!started) {
          // Autoplay blocked — unlock on first user interaction
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
    } else {
      pauseMusic()
    }

    return () => {
      if (unlockRef.current) {
        unlockRef.current()
        unlockRef.current = null
      }
    }
  }, [musicEnabled])
}

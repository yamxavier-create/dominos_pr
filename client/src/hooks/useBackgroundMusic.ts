import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { useUIStore } from '../store/uiStore'
import { useCallStore } from '../store/callStore'
import { playMusic, stopMusic, pauseMusic } from '../audio/music'
import { startTableMusic, stopTableMusic, duckTableMusic } from '../audio/tableMusic'

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

  // The game has its own quiet playlist, ducked while anyone talks
  const atTable = pathname === '/game' && musicEnabled
  const someoneTalking = useCallStore(s => Object.values(s.speakingPeers).some(Boolean))
  useEffect(() => {
    if (atTable) startTableMusic()
    else stopTableMusic()
  }, [atTable])
  useEffect(() => {
    duckTableMusic(someoneTalking)
  }, [someoneTalking])
}

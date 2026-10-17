import { useEffect } from 'react'
import { useUIStore } from '../store/uiStore'
import { useCallStore } from '../store/callStore'
import { playPlaylist, pausePlaylist, duckPlaylist } from '../audio/playlist'

/** One playlist for the whole app: it starts on open and keeps going across screens. */
export function useBackgroundMusic(): void {
  const musicEnabled = useUIStore(s => s.musicEnabled)
  const someoneTalking = useCallStore(s => Object.values(s.speakingPeers).some(Boolean))

  useEffect(() => {
    if (!musicEnabled) {
      pausePlaylist()
      return
    }
    // Browsers block playback until the first tap: retry then
    const events = ['click', 'touchend', 'keydown'] as const
    const unlock = () => {
      playPlaylist().then(started => {
        if (started) events.forEach(evt => document.removeEventListener(evt, unlock, true))
      })
    }
    playPlaylist().then(started => {
      if (!started) events.forEach(evt => document.addEventListener(evt, unlock, true))
    })
    return () => events.forEach(evt => document.removeEventListener(evt, unlock, true))
  }, [musicEnabled])

  useEffect(() => {
    duckPlaylist(someoneTalking)
  }, [someoneTalking])
}

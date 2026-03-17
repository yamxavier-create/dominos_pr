let audio: HTMLAudioElement | null = null

function getAudio(): HTMLAudioElement {
  if (!audio) {
    audio = new Audio('/audio/lofi-loop.mp3')
    audio.loop = true
    audio.volume = 0.3
  }
  return audio
}

/** Attempts to play. Resolves true if playing, false if autoplay blocked. */
export async function playMusic(volume = 0.3): Promise<boolean> {
  const el = getAudio()
  el.volume = volume
  if (!el.paused) return true
  try {
    await el.play()
    return true
  } catch {
    return false
  }
}

export function stopMusic(): void {
  if (audio && !audio.paused) {
    audio.pause()
    audio.currentTime = 0
  }
}

export function pauseMusic(): void {
  if (audio && !audio.paused) {
    audio.pause()
    // Don't reset currentTime -- resume from same position
  }
}

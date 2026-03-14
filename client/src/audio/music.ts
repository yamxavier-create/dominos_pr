let audio: HTMLAudioElement | null = null

function getAudio(): HTMLAudioElement {
  if (!audio) {
    audio = new Audio('/audio/lofi-loop.mp3')
    audio.loop = true
    audio.volume = 0.3
  }
  return audio
}

export function playMusic(): void {
  const el = getAudio()
  if (el.paused) {
    el.play().catch(() => {
      // Autoplay blocked -- will retry on next user interaction
    })
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

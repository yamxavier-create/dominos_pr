import { getAudioContext } from './audioContext'

// Menu and lobby music: Pixabay 522534, «Salsa estilo New York 03» (vjgalaxy),
// normalized to -18 LUFS like the table playlist. It goes through Web Audio
// because iOS ignores HTMLAudioElement.volume.
const LEVEL = 0.1

let audio: HTMLAudioElement | null = null
let gain: GainNode | null = null

function getAudio(): HTMLAudioElement {
  if (!audio) {
    audio = new Audio('/audio/salsa-menu.mp3')
    audio.loop = true
    const ctx = getAudioContext()
    gain = ctx.createGain()
    gain.gain.value = LEVEL
    ctx.createMediaElementSource(audio).connect(gain)
    gain.connect(ctx.destination)
  }
  return audio
}

/** Attempts to play. Resolves true if playing, false if autoplay blocked. */
export async function playMusic(): Promise<boolean> {
  const el = getAudio()
  const ctx = getAudioContext()
  if (ctx.state === 'suspended') ctx.resume().catch(() => {})
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

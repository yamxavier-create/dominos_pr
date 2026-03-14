let audioContext: AudioContext | null = null
let unlockRegistered = false

function registerAutoplayUnlock(): void {
  if (unlockRegistered) return
  unlockRegistered = true

  const events = ['click', 'touchend', 'keydown'] as const

  const handler = (): void => {
    if (audioContext && audioContext.state === 'suspended') {
      audioContext.resume().then(() => {
        if (audioContext && audioContext.state === 'running') {
          events.forEach(evt => document.removeEventListener(evt, handler, true))
        }
      }).catch(() => {})
    } else if (audioContext && audioContext.state === 'running') {
      events.forEach(evt => document.removeEventListener(evt, handler, true))
    }
  }

  events.forEach(evt => document.addEventListener(evt, handler, { capture: true }))
}

export function getAudioContext(): AudioContext {
  if (!audioContext) {
    audioContext = new AudioContext()
    registerAutoplayUnlock()
  }
  return audioContext
}

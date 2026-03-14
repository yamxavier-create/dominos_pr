import { loadAudio, playBuffer } from './audioLoader'
import { useUIStore } from '../store/uiStore'

const SFX_URLS = {
  tileClack: '/audio/tile-clack.mp3',
} as const

type SfxName = keyof typeof SFX_URLS

const buffers: Partial<Record<SfxName, AudioBuffer>> = {}
let preloaded = false

export async function preloadSfx(): Promise<void> {
  if (preloaded) return
  preloaded = true
  const entries = Object.entries(SFX_URLS) as [SfxName, string][]
  await Promise.all(
    entries.map(async ([name, url]) => {
      try {
        buffers[name] = await loadAudio(url)
      } catch {
        // Silently skip — audio is non-critical
      }
    })
  )
}

export function playSfx(name: SfxName, volume?: number): void {
  if (!useUIStore.getState().sfxEnabled) return
  const buffer = buffers[name]
  if (buffer) {
    playBuffer(buffer, volume)
  } else {
    // Lazy-load: buffer may not be ready if preload ran before AudioContext was unlocked
    loadAudio(SFX_URLS[name]).then(buf => {
      buffers[name] = buf
      playBuffer(buf, volume)
    }).catch(() => {})
  }
}


import { loadAudio, playBuffer } from './audioLoader'
import { useUIStore } from '../store/uiStore'

const SFX_URLS = {
  tileClack: '/audio/tile-clack.mp3',
  turnNotify: '/audio/turn-notify.mp3',
  pass: '/audio/pass.mp3',
} as const

type SfxName = keyof typeof SFX_URLS

const buffers: Partial<Record<SfxName, AudioBuffer>> = {}

export async function preloadSfx(): Promise<void> {
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
  }
}

let passDebounceTimer: ReturnType<typeof setTimeout> | null = null

export function playPassSfx(): void {
  if (passDebounceTimer) return
  playSfx('pass')
  passDebounceTimer = setTimeout(() => {
    passDebounceTimer = null
  }, 300)
}

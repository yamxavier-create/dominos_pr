import { loadAudio, playBuffer } from './audioLoader'
import { useUIStore } from '../store/uiStore'

// Files in public/audio/sfx come from Pixabay (free for commercial use, no attribution),
// trimmed and peak-normalized to -1 dB; `volume` balances them against each other.
// tile-clack is quieter at the source, so it plays at full volume.
const SFX = {
  tileClack: { url: '/audio/tile-clack.mp3', volume: 1 },
  turno: { url: '/audio/sfx/turno.mp3', volume: 0.45 },
  paso: { url: '/audio/sfx/paso.mp3', volume: 0.35 },
  start: { url: '/audio/sfx/start.mp3', volume: 0.4 },
  tick: { url: '/audio/sfx/tick.mp3', volume: 0.45 },
  tiempo: { url: '/audio/sfx/tiempo.mp3', volume: 0.5 },
  capicu: { url: '/audio/sfx/capicu.mp3', volume: 0.55 },
  tranque: { url: '/audio/sfx/tranque.mp3', volume: 0.6 },
  ganaMano: { url: '/audio/sfx/gana-mano.mp3', volume: 0.4 },
  ganaPartida: { url: '/audio/sfx/gana-partida.mp3', volume: 0.6 },
  click: { url: '/audio/sfx/click.mp3', volume: 0.25 },
  entra: { url: '/audio/sfx/entra.mp3', volume: 0.35 },
  sale: { url: '/audio/sfx/sale.mp3', volume: 0.35 },
} as const

export type SfxName = keyof typeof SFX

const buffers: Partial<Record<SfxName, AudioBuffer>> = {}
const playing: Partial<Record<SfxName, AudioBufferSourceNode>> = {}
let preloaded = false

export async function preloadSfx(): Promise<void> {
  if (preloaded) return
  preloaded = true
  const names = Object.keys(SFX) as SfxName[]
  await Promise.all(
    names.map(async name => {
      try {
        buffers[name] = await loadAudio(SFX[name].url)
      } catch {
        // Silently skip — audio is non-critical
      }
    })
  )
}

export function playSfx(name: SfxName, delayMs = 0): void {
  if (delayMs > 0) {
    setTimeout(() => playSfx(name), delayMs)
    return
  }
  if (!useUIStore.getState().sfxEnabled) return
  const { url, volume } = SFX[name]
  const start = (buffer: AudioBuffer) => {
    const source = playBuffer(buffer, volume)
    playing[name] = source
    source.onended = () => {
      if (playing[name] === source) delete playing[name]
    }
  }
  const buffer = buffers[name]
  if (buffer) {
    start(buffer)
  } else {
    // Lazy-load: buffer may not be ready if preload ran before AudioContext was unlocked
    loadAudio(url).then(buf => {
      buffers[name] = buf
      start(buf)
    }).catch(() => {})
  }
}

/** Cuts a sound short, e.g. the clock ticking once the turn is over. */
export function stopSfx(name: SfxName): void {
  try {
    playing[name]?.stop()
  } catch {
    // Already stopped
  }
  delete playing[name]
}

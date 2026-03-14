import { getAudioContext } from './audioContext'

const bufferCache = new Map<string, AudioBuffer>()

export async function loadAudio(url: string): Promise<AudioBuffer> {
  const cached = bufferCache.get(url)
  if (cached) return cached

  const ctx = getAudioContext()
  // Safety net: ensure context is running before decodeAudioData (iOS pitfall)
  if (ctx.state === 'suspended') {
    await ctx.resume()
  }

  const response = await fetch(url)
  const arrayBuffer = await response.arrayBuffer()
  const audioBuffer = await ctx.decodeAudioData(arrayBuffer)
  bufferCache.set(url, audioBuffer)
  return audioBuffer
}

export function playBuffer(buffer: AudioBuffer, volume?: number): void {
  const ctx = getAudioContext()
  // Safety net: resume if suspended (user gesture may not have fired yet)
  if (ctx.state === 'suspended') {
    ctx.resume().catch(() => {})
  }

  const source = ctx.createBufferSource()
  source.buffer = buffer

  if (volume !== undefined && volume !== 1.0) {
    const gain = ctx.createGain()
    gain.gain.value = volume
    source.connect(gain)
    gain.connect(ctx.destination)
  } else {
    source.connect(ctx.destination)
  }

  source.start(0)
}

import { getAudioContext } from './audioContext'

// Music under the game, quiet enough to talk over: a shuffled playlist of
// Pixabay tracks (287103, 581648, 282264, 514561, 500627), loudness-normalized
// to -18 LUFS. It goes through Web Audio because iOS ignores HTMLAudioElement.volume.
const TRACKS = [1, 2, 3, 4, 5].map(n => `/audio/mesa/mesa-${n}.mp3`)

const LEVEL = 0.05 // Background, under the call
const DUCKED = 0.02 // While someone at the table talks
const CROSSFADE_S = 3

interface Deck {
  el: HTMLAudioElement
  gain: GainNode
}

let decks: [Deck, Deck] | null = null
let active = 0
let order: string[] = []
let position = 0
let playing = false
let ducked = false
let fading = false

function shuffled(): string[] {
  const list = [...TRACKS]
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[list[i], list[j]] = [list[j], list[i]]
  }
  return list
}

function makeDeck(ctx: AudioContext): Deck {
  const el = new Audio()
  el.preload = 'auto'
  const gain = ctx.createGain()
  gain.gain.value = 0
  ctx.createMediaElementSource(el).connect(gain)
  gain.connect(ctx.destination)
  el.addEventListener('timeupdate', () => {
    if (decks?.[active].el !== el || fading || !playing) return
    if (el.duration && el.duration - el.currentTime <= CROSSFADE_S) next()
  })
  el.addEventListener('ended', () => {
    if (decks?.[active].el === el && playing && !fading) next()
  })
  return { el, gain }
}

function getDecks(): [Deck, Deck] {
  if (!decks) {
    const ctx = getAudioContext()
    decks = [makeDeck(ctx), makeDeck(ctx)]
  }
  return decks
}

function target(): number {
  return ducked ? DUCKED : LEVEL
}

function rampTo(deck: Deck, value: number, seconds: number) {
  const ctx = getAudioContext()
  const g = deck.gain.gain
  g.cancelScheduledValues(ctx.currentTime)
  g.setValueAtTime(g.value, ctx.currentTime)
  g.linearRampToValueAtTime(value, ctx.currentTime + seconds)
}

function playTrack(deck: Deck, src: string, fadeIn: number) {
  deck.el.src = src
  deck.el.currentTime = 0
  deck.el.play().catch(() => {})
  rampTo(deck, target(), fadeIn)
}

/** Crossfades into the next track of the shuffled playlist. */
function next() {
  const [a, b] = getDecks()
  const from = active === 0 ? a : b
  const to = active === 0 ? b : a
  position = (position + 1) % order.length
  if (position === 0) order = shuffled()
  fading = true
  rampTo(from, 0, CROSSFADE_S)
  playTrack(to, order[position], CROSSFADE_S)
  active = 1 - active
  setTimeout(() => {
    from.el.pause()
    fading = false
  }, CROSSFADE_S * 1000)
}

/** Starts the table music on a random track; a no-op if it's already on. */
export function startTableMusic(): void {
  if (playing) return
  const ctx = getAudioContext()
  if (ctx.state === 'suspended') ctx.resume().catch(() => {})
  playing = true
  order = shuffled()
  position = 0
  const deck = getDecks()[active]
  playTrack(deck, order[0], 2)
}

export function stopTableMusic(): void {
  if (!playing || !decks) return
  playing = false
  fading = false
  for (const deck of decks) {
    rampTo(deck, 0, 0.6)
    setTimeout(() => {
      if (!playing) deck.el.pause()
    }, 700)
  }
}

/** Lowers the music while anyone at the table is talking. */
export function duckTableMusic(on: boolean): void {
  if (ducked === on) return
  ducked = on
  if (!playing || !decks || fading) return
  // Duck fast, come back slowly so it doesn't pump between words
  rampTo(decks[active], target(), on ? 0.25 : 1.5)
}

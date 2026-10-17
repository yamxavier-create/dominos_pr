import { getAudioContext } from './audioContext'

// One shuffled playlist for the whole app, from the menu to the table, so the
// music never restarts between screens. Pixabay tracks Yamir picked (salsa,
// reggaetón tropical, merengue, bachata, afro latino), loudness-normalized to
// -18 LUFS at 64 kbps; they stream instead of being precached. Playback goes
// through Web Audio because iOS ignores HTMLAudioElement.volume.
const TRACKS = [
  'salsa-new-york-03', 'salsa-new-york-01', 'salsa-energetica-01', 'salsa-energetica-02',
  'salsa-old-school-01', 'salsa-old-school-02', 'tropical-reggaeton-2', 'reggaeton-song',
  'chill-reggaeton', 'merengue-baila-conmigo', 'merengue-latin-cafe', 'bachata-no-puedo-olvidarte',
  'bachata-beat', 'bachata-street', 'san-juan-sunset', 'playa-en-puerto-rico', 'afro-pop-water',
  'afrobeat-dancehall', 'afrobeat-reggae', 'la-vida-es-una-fiesta',
].map(name => `/audio/playlist/${name}.mp3`)

const LEVEL = 0.05 // Background
const DUCKED = 0.02 // While someone on the call talks
const CROSSFADE_S = 3

interface Deck {
  el: HTMLAudioElement
  gain: GainNode
}

let decks: [Deck, Deck] | null = null
let active = 0
let order: string[] = []
let position = -1
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

function nextSrc(): string {
  position++
  if (position >= order.length) {
    order = shuffled()
    position = 0
  }
  return order[position]
}

/** Crossfades into the next track. */
function next() {
  const [a, b] = getDecks()
  const from = active === 0 ? a : b
  const to = active === 0 ? b : a
  fading = true
  rampTo(from, 0, CROSSFADE_S)
  to.el.src = nextSrc()
  to.el.play().catch(() => {})
  rampTo(to, target(), CROSSFADE_S)
  active = 1 - active
  setTimeout(() => {
    from.el.pause()
    fading = false
  }, CROSSFADE_S * 1000)
}

/**
 * Starts the music, or resumes the current track where it paused. Resolves
 * false when the browser blocks playback until the first tap.
 */
export async function playPlaylist(): Promise<boolean> {
  const ctx = getAudioContext()
  if (ctx.state === 'suspended') ctx.resume().catch(() => {})
  const deck = getDecks()[active]
  if (!deck.el.src) {
    order = shuffled()
    position = -1
    deck.el.src = nextSrc()
  }
  try {
    await deck.el.play()
  } catch {
    return false
  }
  playing = true
  rampTo(deck, target(), 1.5)
  return true
}

export function pausePlaylist(): void {
  if (!playing || !decks) return
  playing = false
  fading = false
  for (const deck of decks) {
    rampTo(deck, 0, 0.5)
    setTimeout(() => {
      if (!playing) deck.el.pause()
    }, 600)
  }
}

/** Lowers the music while anyone on the call is talking. */
export function duckPlaylist(on: boolean): void {
  if (ducked === on) return
  ducked = on
  if (!playing || !decks || fading) return
  // Duck fast, come back slowly so it doesn't pump between words
  rampTo(decks[active], target(), on ? 0.25 : 1.5)
}

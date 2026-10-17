import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useGameStore } from '../../store/gameStore'
import { useRoomStore } from '../../store/roomStore'
import type { RoundEndPayload, ClientGameState } from '../../types/game'
import { DominoTile } from '../domino/DominoTile'

type Kind = 'capicu' | 'chuchazo' | 'tranque'

interface Tally {
  label: string
  pips: number
  won: boolean
}

interface Shown {
  kind: Kind
  bonus: boolean
  tallies?: Tally[]
}

/**
 * What a tranque compared, from your side of the table: the two teams' pips
 * (each team's lightest hand when the table plays it individual), or the two
 * hands in a 2-player game. The server already picked the winner.
 */
function tranqueTallies(data: RoundEndPayload, game: ClientGameState, me: number): Tally[] {
  const pips = (i: number) => data.remainingTiles.find(r => r.playerIndex === i)?.pipSum ?? 0
  if (game.playerCount === 2) {
    const rival = 1 - me
    return [
      { label: 'Tú', pips: pips(me), won: data.winnerIndex === me },
      { label: game.players[rival]?.name ?? 'Rival', pips: pips(rival), won: data.winnerIndex === rival },
    ]
  }
  const myTeam = me % 2
  const team = (t: number) => {
    const hands = [t, t + 2].map(pips)
    return game.rules.tranque === 'individual' ? Math.min(...hands) : hands[0] + hands[1]
  }
  return [
    { label: 'Nosotros', pips: team(myTeam), won: data.winningTeam === myTeam },
    { label: 'Ellos', pips: team(1 - myTeam), won: data.winningTeam === 1 - myTeam },
  ]
}

// The capicú and tranque sounds play 700 ms after the hand ends (useSocket).
// Capicú and chuchazo take ~520 ms to land, so they start early enough to hit
// with it; the tranque one lands as it starts
const START_MS = 180
const TRANQUE_START_MS = 700
const COUNT_MS = 650
const LAND_MS = 520
const HOLD_MS = 1150
// The tranque stays longer: people read who had fewer pips before it goes
const TRANQUE_HOLD_MS = 3300
const EXIT_MS = 300

const OUT = 'cubic-bezier(0.16, 1, 0.3, 1)'
const POP = 'cubic-bezier(0.2, 0.9, 0.3, 1.25)'
const SLAM = 'cubic-bezier(0.55, 0, 1, 0.45)'
const INK = '#06140B'

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))
const run = (el: Element | null | undefined, keyframes: Keyframe[], options: KeyframeAnimationOptions) =>
  el ? el.animate(keyframes, { fill: 'both', ...options }).finished.catch(() => {}) : Promise.resolve()

function shake(rail: Element | null) {
  run(rail, [
    { transform: 'translate(0, 0)' },
    { transform: 'translate(-7px, 4px)' },
    { transform: 'translate(6px, -3px)' },
    { transform: 'translate(-3px, 2px)' },
    { transform: 'translate(0, 0)' },
  ], { duration: 260, easing: 'ease-out', fill: 'none' })
}

/**
 * Capicú: a spark leaves each end of the line of play, they meet in the middle
 * and the word bursts out. Chuchazo: a giant double blank drops spinning onto
 * the felt and the word stamps across it. Tranque: the word drops and each
 * side's pips count up; the side that takes the hand lights up gold. All of
 * them leave on their own.
 */
export function HandCelebration() {
  const roundEndData = useGameStore(s => s.roundEndData)
  const gameState = useGameStore(s => s.gameState)
  const myPlayerIndex = useRoomStore(s => s.myPlayerIndex)
  const [shown, setShown] = useState<Shown | null>(null)
  const root = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!roundEndData || !gameState) return
    if (roundEndData.reason === 'blocked') {
      const tallies = tranqueTallies(roundEndData, gameState, myPlayerIndex ?? gameState.myPlayerIndex)
      const timer = setTimeout(() => setShown({ kind: 'tranque', bonus: false, tallies }), TRANQUE_START_MS)
      return () => clearTimeout(timer)
    }
    if (!(roundEndData.isCapicu || roundEndData.isChuchazo)) return
    const timer = setTimeout(() => {
      setShown({ kind: roundEndData.isChuchazo ? 'chuchazo' : 'capicu', bonus: gameState.gameMode === 'modo500' })
    }, START_MS)
    return () => clearTimeout(timer)
    // Only a new hand result starts it, not every new snapshot
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roundEndData])

  useLayoutEffect(() => {
    const el = root.current
    if (!shown || !el) return
    let cancelled = false
    const part = (name: string) => el.querySelector(`[data-part="${name}"]`)
    const rail = el.closest('.club-rail')
    const ends = [...(el.parentElement?.querySelectorAll<HTMLElement>('[data-board-end]') ?? [])]

    const play = async () => {
      if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
        const words = part('words')
        if (shown.kind !== 'tranque') await sleep(LAND_MS)
        for (const name of ['word', 'chip', 'tallies', 'dim']) (part(name) as HTMLElement | null)?.style.setProperty('opacity', '1')
        el.querySelectorAll<HTMLElement>('[data-pips]').forEach(n => { n.textContent = n.dataset.pips ?? '' })
        el.querySelectorAll<HTMLElement>('[data-won]').forEach(t => t.classList.add(t.dataset.won === 'true' ? 'hc-won' : 'hc-lost'))
        await run(words, [{ opacity: 0 }, { opacity: 1 }], { duration: 220 })
        await sleep((shown.kind === 'tranque' ? TRANQUE_HOLD_MS : HOLD_MS) + 200)
        if (cancelled) return
        await run(words, [{ opacity: 1 }, { opacity: 0 }], { duration: 220 })
        return
      }

      if (shown.kind === 'tranque') {
        // The word drops with the door slam, then each side's pips count up and
        // the lighter side lights up gold: that side takes the hand
        run(part('dim'), [{ opacity: 0 }, { opacity: 1 }], { duration: 260 })
        run(part('word'), [{ transform: 'translateY(-20px)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 320, easing: OUT })
        await run(part('tallies'), [{ transform: 'translateY(16px)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 300, delay: 120, easing: OUT })
        if (cancelled) return
        const counters = [...el.querySelectorAll<HTMLElement>('[data-pips]')]
        const t0 = performance.now()
        await new Promise<void>(done => {
          const tick = (now: number) => {
            const k = Math.min(1, (now - t0) / COUNT_MS)
            const eased = 1 - Math.pow(1 - k, 3)
            counters.forEach(n => { n.textContent = String(Math.round(Number(n.dataset.pips) * eased)) })
            if (k < 1 && !cancelled) requestAnimationFrame(tick)
            else done()
          }
          requestAnimationFrame(tick)
        })
        if (cancelled) return
        el.querySelectorAll<HTMLElement>('[data-won]').forEach(t => {
          const won = t.dataset.won === 'true'
          t.classList.add(won ? 'hc-won' : 'hc-lost')
          if (won) run(t, [{ transform: 'scale(1)' }, { transform: 'scale(1.1)' }, { transform: 'scale(1)' }], { duration: 300, easing: POP, fill: 'none' })
        })
        await sleep(TRANQUE_HOLD_MS)
        if (cancelled) return
        run(part('dim'), [{ opacity: 1 }, { opacity: 0 }], { duration: EXIT_MS })
        await run(part('words'), [{ transform: 'none', opacity: 1 }, { transform: 'translateY(-20px)', opacity: 0 }], { duration: EXIT_MS, easing: 'ease-in' })
        return
      }

      if (shown.kind === 'capicu') {
        const box = el.getBoundingClientRect()
        const mid = { x: box.width / 2, y: box.height / 2 }
        const sparks = ['spark-left', 'spark-right'].map((name, i) => {
          const end = ends.find(e => e.dataset.boardEnd === (i === 0 ? 'left' : 'right'))
          const r = end?.getBoundingClientRect()
          // An end scrolled out of view still sends its spark from the edge
          const from = r
            ? {
                x: Math.min(Math.max(r.left - box.left + r.width / 2, 12), box.width - 12),
                y: Math.min(Math.max(r.top - box.top + r.height / 2, 12), box.height - 12),
              }
            : { x: i === 0 ? 24 : box.width - 24, y: mid.y }
          if (end) {
            run(end, [
              { filter: 'drop-shadow(0 0 0 rgba(253,208,75,0))' },
              { filter: 'drop-shadow(0 0 7px rgba(253,208,75,1))', offset: 0.3 },
              { filter: 'drop-shadow(0 0 0 rgba(253,208,75,0))' },
            ], { duration: 900, iterations: 2, fill: 'none' })
          }
          return run(part(name), [
            { transform: `translate(${from.x - 8}px, ${from.y - 8}px) scale(.6)`, opacity: 0 },
            { transform: `translate(${from.x - 8}px, ${from.y - 8}px) scale(1)`, opacity: 1, offset: 0.2 },
            { transform: `translate(${mid.x - 8}px, ${mid.y - 8}px) scale(1.3)`, opacity: 1, offset: 0.99 },
            { transform: `translate(${mid.x - 8}px, ${mid.y - 8}px) scale(1.3)`, opacity: 0 },
          ], { duration: LAND_MS, easing: 'cubic-bezier(.5, 0, .75, 0)' })
        })
        await Promise.all(sparks)
        if (cancelled) return
        run(part('flash'), [{ transform: 'scale(.2)', opacity: 1 }, { transform: 'scale(3.2)', opacity: 0 }], { duration: 620, easing: OUT })
        run(part('word'), [
          { transform: 'scale(.3)', opacity: 0 },
          { transform: 'scale(1.08)', opacity: 1, offset: 0.7 },
          { transform: 'scale(1)', opacity: 1 },
        ], { duration: 440, easing: POP })
        run(part('chip'), [{ transform: 'translateY(10px) scale(.6)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 320, delay: 160, easing: POP })
        await sleep(HOLD_MS)
        if (cancelled) return
        await run(part('words'), [{ transform: 'none', opacity: 1 }, { transform: 'translateY(-26px)', opacity: 0 }], { duration: EXIT_MS, easing: 'ease-in' })
        return
      }

      // Chuchazo
      const tile = part('tile')
      await run(tile, [
        { transform: 'translateY(-420px) rotate(-210deg) scale(1.2)', opacity: 1 },
        { transform: 'translateY(0) rotate(-10deg) scale(1)', opacity: 1 },
      ], { duration: LAND_MS, easing: SLAM })
      if (cancelled) return
      shake(rail)
      run(part('ring'), [{ transform: 'scale(.6)', opacity: 0.7 }, { transform: 'scale(2.4)', opacity: 0 }], { duration: 560, easing: OUT })
      run(part('word'), [{ transform: 'scale(1.9)', opacity: 0 }, { transform: 'scale(1)', opacity: 1 }], { duration: 170, delay: 90, easing: SLAM })
      run(part('chip'), [{ transform: 'scale(.6)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 260, delay: 200, easing: POP })
      await sleep(HOLD_MS)
      if (cancelled) return
      run(part('words'), [{ transform: 'none', opacity: 1 }, { transform: 'translateY(-20px)', opacity: 0 }], { duration: 240, easing: 'ease-in' })
      await run(tile, [
        { transform: 'translateY(0) rotate(-10deg)', opacity: 1 },
        { transform: 'translateY(300px) rotate(75deg)', opacity: 0 },
      ], { duration: 360, easing: 'cubic-bezier(.6, 0, .9, .4)' })
    }

    play().then(() => { if (!cancelled) setShown(null) })
    return () => { cancelled = true }
  }, [shown])

  if (!shown) return null
  const text = { capicu: '¡CAPICÚ!', chuchazo: '¡CHUCHAZO!', tranque: '¡TRANQUE!' }[shown.kind]
  const label = { capicu: 'Capicú', chuchazo: 'Chuchazo', tranque: 'Tranque' }[shown.kind]

  return (
    <div ref={root} className="hand-celebration absolute inset-0 z-30 pointer-events-none overflow-hidden" role="status" aria-label={label}>
      {shown.kind === 'tranque' ? (
        <span data-part="dim" className="hc-dim" />
      ) : shown.kind === 'capicu' ? (
        <>
          <span data-part="spark-left" className="hc-spark" />
          <span data-part="spark-right" className="hc-spark" />
          <span data-part="flash" className="hc-flash hc-center" />
        </>
      ) : (
        <>
          <span data-part="ring" className="hc-ring hc-center" />
          <div data-part="tile" className="hc-center" style={{ opacity: 0 }}>
            <div className="hc-tile">
              <DominoTile pip1={0} pip2={0} orientation="vertical" depth="none" style={{ width: '100%', height: '100%', borderRadius: 9, boxShadow: `0 0 0 3px ${INK}, 0 7px 0 3px ${INK}` }} />
            </div>
          </div>
        </>
      )}
      <div data-part="words" className="hc-center flex flex-col items-center gap-2" style={shown.kind === 'chuchazo' ? { rotate: '-8deg' } : undefined}>
        <div data-part="word" className="hc-word" style={{ opacity: 0 }}>{text}</div>
        {shown.bonus && <div data-part="chip" className="hc-chip" style={{ opacity: 0 }}>+100</div>}
        {shown.tallies && (
          <div data-part="tallies" className="flex gap-2.5 mt-1" style={{ opacity: 0 }}>
            {shown.tallies.map(t => (
              <div key={t.label} data-won={t.won} className="hc-tally">
                <div className="hc-tally-label">{t.label}</div>
                <div data-pips={t.pips} className="hc-tally-pips">0</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

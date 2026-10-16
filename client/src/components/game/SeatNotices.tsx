import { SeatNotice, useUIStore } from '../../store/uiStore'

function graceText(ms = 60_000) {
  const seconds = Math.round(ms / 1000)
  return seconds % 60 === 0
    ? `${seconds / 60} ${seconds === 60 ? 'minuto' : 'minutos'}`
    : `${seconds} segundos`
}

const COPY: Record<SeatNotice['kind'], { title: string; detail: (n: SeatNotice) => string; tone: 'out' | 'in' }> = {
  away: { title: 'se desconectó', detail: n => `Tiene ${graceText(n.graceMs)} para volver a su puesto.`, tone: 'out' },
  bot: { title: 'no volvió a tiempo', detail: () => 'Un bot juega por su puesto hasta que vuelva.', tone: 'out' },
  left: { title: 'se fue de la partida', detail: () => 'Un bot juega por su puesto.', tone: 'out' },
  back: { title: 'volvió', detail: () => 'Sigue jugando en su puesto.', tone: 'in' },
}

/** Tells the table who left, lost the connection or came back. */
export function SeatNotices() {
  const notices = useUIStore(s => s.seatNotices)
  if (notices.length === 0) return null

  return (
    <div
      className="fixed left-1/2 -translate-x-1/2 z-50 flex flex-col items-center gap-1.5 pointer-events-none w-[min(92vw,22rem)]"
      style={{ top: 'calc(4.5rem + var(--safe-top))' }}
      role="status"
      aria-live="polite"
    >
      {notices.map(n => {
        const copy = COPY[n.kind]
        return (
          <div key={n.id} className="mm-drop club-sign w-full flex items-center gap-2.5 px-3 py-2">
            <span
              className={`shrink-0 h-2.5 w-2.5 rounded-full border-2 border-[#06140B] ${copy.tone === 'in' ? 'bg-club-us' : 'bg-club-them'}`}
              aria-hidden
            />
            <div className="min-w-0">
              <p className="font-chunky text-base leading-tight truncate">
                {n.playerName} <span className={copy.tone === 'in' ? 'text-club-us' : 'text-club-them'}>{copy.title}</span>
              </p>
              <p className="font-body text-xs font-semibold text-club-ink/70 leading-snug">{copy.detail(n)}</p>
            </div>
          </div>
        )
      })}
    </div>
  )
}

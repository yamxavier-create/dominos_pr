import { useEffect, useMemo, useState } from 'react'

/**
 * Torneo: whole seconds left on the turn clock, counting down from the last
 * snapshot; null when nobody is on the clock. `turnId` restarts the count even
 * when two turns in a row get the same time.
 */
export function useTurnClock(turnTimeLeftMs: number | null | undefined, turnId: number | undefined): number | null {
  const deadline = useMemo(
    () => (turnTimeLeftMs == null ? null : Date.now() + turnTimeLeftMs),
    [turnTimeLeftMs, turnId],
  )
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (deadline === null) return
    setNow(Date.now())
    const id = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(id)
  }, [deadline])
  if (deadline === null) return null
  return Math.max(0, Math.ceil((deadline - now) / 1000))
}

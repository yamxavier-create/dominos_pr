import { useState, useEffect } from 'react'

// Big enough screen to not need the phone-landscape compact layout
const mq = typeof window !== 'undefined'
  ? window.matchMedia('(min-width: 1024px) and (min-height: 600px)')
  : null

export function useIsDesktop() {
  const [desktop, setDesktop] = useState(() => mq?.matches ?? false)

  useEffect(() => {
    if (!mq) return
    const handler = (e: MediaQueryListEvent) => setDesktop(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  return desktop
}

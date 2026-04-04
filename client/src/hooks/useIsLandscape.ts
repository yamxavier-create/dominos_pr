import { useState, useEffect } from 'react'

const mq = typeof window !== 'undefined'
  ? window.matchMedia('(orientation: landscape)')
  : null

export function useIsLandscape() {
  const [landscape, setLandscape] = useState(() => mq?.matches ?? false)

  useEffect(() => {
    if (!mq) return
    const handler = (e: MediaQueryListEvent) => setLandscape(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  return landscape
}

import { useState, useEffect, useRef } from 'react'
import { DominoTile } from '../domino/DominoTile'

interface BoneyardPileProps {
  count: number
  className?: string
}

export function BoneyardPile({ count, className }: BoneyardPileProps) {
  const [visible, setVisible] = useState(count > 0)
  const fadeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (count > 0) {
      // Cancel any pending fade-out
      if (fadeTimerRef.current) {
        clearTimeout(fadeTimerRef.current)
        fadeTimerRef.current = null
      }
      setVisible(true)
    } else {
      // Start fade-out, then unmount after transition
      fadeTimerRef.current = setTimeout(() => {
        setVisible(false)
        fadeTimerRef.current = null
      }, 300)
    }

    return () => {
      if (fadeTimerRef.current) {
        clearTimeout(fadeTimerRef.current)
      }
    }
  }, [count])

  if (!visible && count === 0) return null

  const layerCount = Math.min(count, 4)

  return (
    <div
      className={className}
      style={{
        opacity: count > 0 ? 1 : 0,
        pointerEvents: count > 0 ? 'auto' : 'none',
        transition: 'opacity 300ms ease-out',
      }}
    >
      {/* Pile container */}
      <div className="relative" style={{ width: 36, height: 68 }}>
        {Array.from({ length: layerCount }, (_, i) => (
          <div
            key={i}
            className="absolute"
            style={{
              left: i * 2,
              top: (layerCount - 1 - i) * 2,
              width: 30,
              height: 60,
            }}
          >
            <DominoTile
              pip1={0}
              pip2={0}
              orientation="vertical"
              faceDown
              style={{ width: 30, height: 60 }}
            />
          </div>
        ))}

        {/* Count badge */}
        <div
          className="absolute bg-black/60 text-white/80 text-xs font-bold px-1.5 py-0.5 rounded-full"
          style={{
            bottom: -6,
            right: -8,
            minWidth: 20,
            textAlign: 'center',
          }}
        >
          {count}
        </div>
      </div>
    </div>
  )
}

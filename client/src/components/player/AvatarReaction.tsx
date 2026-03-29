import { useEffect, useState } from 'react'
import { ActiveReaction } from '../../store/uiStore'

interface AvatarReactionProps {
  reactions: ActiveReaction[]
  position: 'top' | 'bottom' | 'left' | 'right'
}

interface PositionedReaction extends ActiveReaction {
  screenX: number
  screenY: number
}

// Offset the reaction toward the center of the table from the avatar
function getOffsets(position: 'top' | 'bottom' | 'left' | 'right') {
  switch (position) {
    case 'top':    return { dx: 0, dy: 50 }
    case 'bottom': return { dx: 0, dy: -60 }
    case 'left':   return { dx: 60, dy: 0 }
    case 'right':  return { dx: -60, dy: 0 }
  }
}

export function AvatarReaction({ reactions, position }: AvatarReactionProps) {
  const [positioned, setPositioned] = useState<PositionedReaction[]>([])

  useEffect(() => {
    if (reactions.length === 0) {
      setPositioned([])
      return
    }

    // Find the seat element to get screen coordinates
    const seatEl = document.querySelector(`[data-seat="${position}"]`)
    if (!seatEl) {
      setPositioned([])
      return
    }

    const rect = seatEl.getBoundingClientRect()
    const offsets = getOffsets(position)
    const centerX = rect.left + rect.width / 2
    const centerY = rect.top + rect.height / 2

    setPositioned(reactions.map((r, i) => ({
      ...r,
      screenX: centerX + offsets.dx + (i - (reactions.length - 1) / 2) * 20,
      screenY: centerY + offsets.dy,
    })))
  }, [reactions, position])

  if (positioned.length === 0) return null

  return (
    <>
      {positioned.map(r => (
        <span
          key={r.id}
          className="reaction-pop fixed text-4xl drop-shadow-lg"
          style={{
            left: r.screenX,
            top: r.screenY,
            transform: 'translate(-50%, -50%)',
            zIndex: 45,
          }}
        >
          {r.emoji}
        </span>
      ))}
    </>
  )
}

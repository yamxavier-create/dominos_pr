import { useEffect, useState, useRef } from 'react'
import { useUIStore } from '../../store/uiStore'
import { useRoomStore } from '../../store/roomStore'
import { DominoTile } from '../domino/DominoTile'
import { getPosition } from '../../hooks/usePlayerPositions'

interface TileFlyAnimationProps {
  playerCount: number
}

interface FlyState {
  pip1: number
  pip2: number
  startX: number
  startY: number
  endX: number
  endY: number
  phase: 'start' | 'flying'
}

export function TileFlyAnimation({ playerCount }: TileFlyAnimationProps) {
  const flyingTile = useUIStore(s => s.flyingTile)
  const myPlayerIndex = useRoomStore(s => s.myPlayerIndex) ?? 0
  const [flyState, setFlyState] = useState<FlyState | null>(null)
  const rafRef = useRef<number>(0)

  useEffect(() => {
    if (!flyingTile) {
      setFlyState(null)
      return
    }

    const position = getPosition(flyingTile.playerIndex, myPlayerIndex, playerCount)
    const seatEl = document.querySelector(`[data-seat="${position}"]`)

    if (!seatEl) {
      setFlyState(null)
      return
    }

    const seatRect = seatEl.getBoundingClientRect()

    // Try to find the exact end tile where this tile will land
    // The new tile hasn't been rendered yet, but the PREVIOUS end tile is still there
    // Fly to the end tile position as best approximation
    let endX: number
    let endY: number

    const endTileEl = document.querySelector(`[data-board-end="${flyingTile.targetEnd}"]`)
    if (endTileEl) {
      const endRect = endTileEl.getBoundingClientRect()
      endX = endRect.left + endRect.width / 2 - 20
      endY = endRect.top + endRect.height / 2 - 40
    } else {
      // Fallback: board center
      const boardEl = document.querySelector('[data-board]')
      if (!boardEl) { setFlyState(null); return }
      const boardRect = boardEl.getBoundingClientRect()
      endX = boardRect.left + boardRect.width / 2 - 20
      endY = boardRect.top + boardRect.height / 2 - 40
    }

    setFlyState({
      pip1: flyingTile.pip1,
      pip2: flyingTile.pip2,
      startX: seatRect.left + seatRect.width / 2 - 20,
      startY: seatRect.top + seatRect.height / 2 - 40,
      endX,
      endY,
      phase: 'start',
    })

    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = requestAnimationFrame(() => {
        setFlyState(prev => prev ? { ...prev, phase: 'flying' } : null)
      })
    })

    return () => cancelAnimationFrame(rafRef.current)
  }, [flyingTile, myPlayerIndex, playerCount])

  if (!flyState) return null

  const { pip1, pip2, startX, startY, endX, endY, phase } = flyState
  const isFlying = phase === 'flying'

  return (
    <div
      className="fixed pointer-events-none z-50"
      style={{
        left: isFlying ? endX : startX,
        top: isFlying ? endY : startY,
        width: 40,
        height: 80,
        opacity: isFlying ? 0 : 1,
        transform: isFlying ? 'scale(1)' : 'scale(0.7)',
        transition: isFlying
          ? 'left 0.5s cubic-bezier(0.22, 0.61, 0.36, 1), top 0.5s cubic-bezier(0.22, 0.61, 0.36, 1), opacity 0.15s ease-out 0.4s, transform 0.5s cubic-bezier(0.22, 0.61, 0.36, 1)'
          : 'none',
      }}
    >
      <DominoTile
        pip1={pip1}
        pip2={pip2}
        orientation="vertical"
        style={{ width: 40, height: 80 }}
      />
    </div>
  )
}

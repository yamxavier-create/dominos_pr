import { useEffect, useRef, useState } from 'react'
import { useGameStore } from '../../store/gameStore'
import { useRoomStore } from '../../store/roomStore'
import { getPosition, Position } from '../../hooks/usePlayerPositions'
import { DominoTile } from '../domino/DominoTile'

interface BoneyardDrawAnimationProps {
  myPlayerIndex: number
  playerCount: number
}

export function BoneyardDrawAnimation({ myPlayerIndex, playerCount }: BoneyardDrawAnimationProps) {
  const queue = useGameStore(s => s.boneyardDrawQueue)
  const shiftBoneyardDraw = useGameStore(s => s.shiftBoneyardDraw)
  const handleBoneyardDraw = useGameStore(s => s.handleBoneyardDraw)

  const [animating, setAnimating] = useState(false)
  const [flyDirection, setFlyDirection] = useState<Position | null>(null)
  const isProcessingRef = useRef(false)

  const currentDraw = queue.length > 0 ? queue[0] : null

  useEffect(() => {
    if (!currentDraw || isProcessingRef.current) return

    isProcessingRef.current = true

    const direction = getPosition(currentDraw.playerIndex, myPlayerIndex, playerCount)
    setFlyDirection(direction)
    setAnimating(true)

    // After flight animation (350ms), apply state and shift queue
    const animTimer = setTimeout(() => {
      const myIdx = useRoomStore.getState().myPlayerIndex
      if (myIdx !== null && myIdx !== undefined) {
        handleBoneyardDraw(currentDraw, myIdx)
      }
      setAnimating(false)
      shiftBoneyardDraw()

      // Wait 500ms before allowing next draw to process
      const pauseTimer = setTimeout(() => {
        isProcessingRef.current = false
      }, 500)

      return () => clearTimeout(pauseTimer)
    }, 350)

    return () => clearTimeout(animTimer)
  }, [currentDraw, myPlayerIndex, playerCount, shiftBoneyardDraw, handleBoneyardDraw])

  if (!animating || !flyDirection) return null

  return (
    <div
      className={`absolute bottom-2 right-2 z-20 boneyard-fly-${flyDirection}`}
      style={{ width: 30, height: 60, pointerEvents: 'none' }}
    >
      <DominoTile
        pip1={0}
        pip2={0}
        orientation="vertical"
        faceDown
        style={{ width: 30, height: 60 }}
      />
    </div>
  )
}

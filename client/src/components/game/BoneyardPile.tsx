import { useState } from 'react'
import { DominoTile } from '../domino/DominoTile'

interface BoneyardPileProps {
  count: number
  awaitingDraw: boolean
  isMyTurn: boolean
  onDraw: () => void
  currentPlayerName: string
}

export function BoneyardPile({ count, awaitingDraw, isMyTurn, onDraw, currentPlayerName }: BoneyardPileProps) {
  const [tappedIndex, setTappedIndex] = useState<number | null>(null)

  if (count === 0) return null

  const handleTap = (index: number) => {
    if (!isMyTurn || !awaitingDraw || tappedIndex !== null) return
    setTappedIndex(index)
    onDraw()
    setTimeout(() => setTappedIndex(null), 400)
  }

  // Spread mode — current player needs to draw
  if (awaitingDraw) {
    const tileW = 36
    const tileH = 72

    return (
      <div
        className="absolute inset-x-0 bottom-0 z-20 flex flex-col items-center pb-2 pt-3"
        style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.85) 90%, transparent)' }}
      >
        <p className="text-white/70 text-xs font-body mb-2">
          {isMyTurn ? 'Toca una ficha para jalar' : `${currentPlayerName} está jalando...`}
        </p>
        <div className="flex flex-wrap items-center justify-center gap-1.5 px-3">
          {Array.from({ length: count }, (_, i) => (
            <button
              key={i}
              onClick={() => handleTap(i)}
              disabled={!isMyTurn || tappedIndex !== null}
              className={`
                relative transition-transform duration-150 rounded shrink-0
                ${isMyTurn && tappedIndex === null ? 'cursor-pointer hover:-translate-y-2 active:scale-95' : 'cursor-default'}
                ${tappedIndex === i ? '-translate-y-3 opacity-40' : ''}
              `}
              style={{ width: tileW, height: tileH }}
            >
              <DominoTile
                pip1={0}
                pip2={0}
                orientation="vertical"
                faceDown
                style={{ width: tileW, height: tileH }}
              />
            </button>
          ))}
        </div>
      </div>
    )
  }

  // Compact mode — small stacked pile in corner
  const layerCount = Math.min(count, 4)
  return (
    <div className="absolute bottom-2 right-2 z-10">
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
        <div
          className="absolute bg-black/60 text-white/80 text-xs font-bold px-1.5 py-0.5 rounded-full"
          style={{ bottom: -6, right: -8, minWidth: 20, textAlign: 'center' }}
        >
          {count}
        </div>
      </div>
    </div>
  )
}

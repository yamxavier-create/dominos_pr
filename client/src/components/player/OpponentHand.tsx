import { DominoTileBack } from '../domino/DominoTileBack'
import { ClientPlayer } from '../../types/game'

interface OpponentHandProps {
  player: ClientPlayer
  position: 'top' | 'left' | 'right'
}

// Tile dimensions for face-down tiles
const BACK_W = 18  // narrow width for face-down tiles
const BACK_H = 36

export function OpponentHand({ player, position }: OpponentHandProps) {
  const count = player.tileCount
  const tiles = Array.from({ length: count }, (_, i) => i)

  if (position === 'top') {
    return (
      <div className="flex items-center justify-center gap-1 px-2 py-1">
        {tiles.map(i => (
          <DominoTileBack
            key={i}
            orientation="vertical"
            style={{ width: BACK_W, height: BACK_H }}
          />
        ))}
        {count === 0 && <span className="text-white/30 text-xs font-body">sin fichas</span>}
      </div>
    )
  }

  if (position === 'left' || position === 'right') {
    return (
      <div className="flex flex-col items-center justify-center gap-0.5 py-1">
        {tiles.map(i => (
          <DominoTileBack
            key={i}
            orientation="horizontal"
            style={{ width: 28, height: 14 }}
          />
        ))}
        {count === 0 && <span className="text-white/30 text-xs font-body">sin fichas</span>}
      </div>
    )
  }

  return null
}

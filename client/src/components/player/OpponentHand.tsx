import { DominoTileBack } from '../domino/DominoTileBack'
import { ClientPlayer } from '../../types/game'

interface OpponentHandProps {
  player: ClientPlayer
  position: 'top' | 'left' | 'right'
  compact?: boolean
}

// Tile dimensions for face-down tiles
const BACK_W = 18
const BACK_H = 36
const BACK_W_COMPACT = 14
const BACK_H_COMPACT = 28

export function OpponentHand({ player, position, compact }: OpponentHandProps) {
  const count = player.tileCount
  const tiles = Array.from({ length: count }, (_, i) => i)
  const bw = compact ? BACK_W_COMPACT : BACK_W
  const bh = compact ? BACK_H_COMPACT : BACK_H

  if (position === 'top') {
    return (
      <div className={`flex items-center justify-center gap-0.5 px-2 ${compact ? 'py-0' : 'py-1'}`}>
        {tiles.map(i => (
          <DominoTileBack
            key={i}
            orientation="vertical"
            style={{ width: bw, height: bh }}
          />
        ))}
        {count === 0 && <span className="text-white/30 text-xs font-body">sin fichas</span>}
      </div>
    )
  }

  if (position === 'left' || position === 'right') {
    const sw = compact ? 22 : 28
    const sh = compact ? 11 : 14
    return (
      <div className="flex flex-col items-center justify-center gap-0.5 py-1">
        {tiles.map(i => (
          <DominoTileBack
            key={i}
            orientation="horizontal"
            style={{ width: sw, height: sh }}
          />
        ))}
        {count === 0 && <span className="text-white/30 text-xs font-body">sin fichas</span>}
      </div>
    )
  }

  return null
}

import { BoardTile as BoardTileType } from '../../types/game'
import { DominoTile } from '../domino/DominoTile'

interface BoardTileProps {
  boardTile: BoardTileType
  isNew: boolean
  flipped?: boolean  // true for tiles in left-going snake rows: mirrors pip display
  corner?: boolean   // true for snake corner tiles: rendered vertically (rotated 90°)
}

// Board tile dimensions (CSS pixels)
const TILE_H_W = 80   // horizontal tile width (1:1 with SVG viewBox)
const TILE_H_H = 40   // horizontal tile height
const TILE_V_W = 40   // vertical tile width
const TILE_V_H = 80   // vertical tile height

export { TILE_H_W, TILE_H_H, TILE_V_W, TILE_V_H }

export function BoardTileItem({ boardTile, isNew, flipped = false, corner = false }: BoardTileProps) {
  const { orientation, leftPip, rightPip } = boardTile

  // Vertical tiles (doubles) and corner tiles are both rendered vertically.
  // Corner tiles use natural pip order: leftPip → top, rightPip → bottom.
  if (orientation === 'vertical' || corner) {
    const pip1 = flipped ? rightPip : leftPip
    const pip2 = flipped ? leftPip : rightPip
    return (
      <div
        className={`board-tile-wrapper ${isNew ? 'tile-new' : ''}`}
        style={{ width: TILE_V_W, height: TILE_V_H, flexShrink: 0 }}
      >
        <DominoTile
          pip1={pip1}
          pip2={pip2}
          orientation="vertical"
          style={{ width: TILE_V_W, height: TILE_V_H }}
        />
      </div>
    )
  }

  // Horizontal tile: flip pip order for left-going rows so the connecting pip
  // appears on the side visually adjacent to the previous tile in the chain.
  const pip1 = flipped ? rightPip : leftPip
  const pip2 = flipped ? leftPip : rightPip

  return (
    <div
      className={`board-tile-wrapper ${isNew ? 'tile-new' : ''}`}
      style={{ width: TILE_H_W, height: TILE_H_H, flexShrink: 0 }}
    >
      <DominoTile
        pip1={pip1}
        pip2={pip2}
        orientation="horizontal"
        style={{ width: TILE_H_W, height: TILE_H_H }}
      />
    </div>
  )
}

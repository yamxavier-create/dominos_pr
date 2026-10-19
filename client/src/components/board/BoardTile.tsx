import { BoardTile as BoardTileType } from '../../types/game'
import { DominoTile } from '../domino/DominoTile'
import { TILE_H_W, TILE_H_H, TILE_V_W, TILE_V_H } from './snakeLayout'

interface BoardTileProps {
  boardTile: BoardTileType
  isNew: boolean
  flipped?: boolean  // true for rows running back toward the anchor: mirrors pip display
  display: 'h' | 'v' // how the layout draws it: lying along the row or standing across it
}

/**
 * A tile on the snake. The layout decides the direction: doubles stand across a
 * row and lie flat on the column between rows; the tiles joining two rows stand
 * upright. Upright tiles use natural pip order: leftPip on top, rightPip below,
 * which is the connecting pip for the arm that wraps that way.
 */
export function BoardTileItem({ boardTile, isNew, flipped = false, display }: BoardTileProps) {
  const { leftPip, rightPip } = boardTile
  const pip1 = flipped ? rightPip : leftPip
  const pip2 = flipped ? leftPip : rightPip
  const size = display === 'v'
    ? { width: TILE_V_W, height: TILE_V_H }
    : { width: TILE_H_W, height: TILE_H_H }

  return (
    <div
      className={`board-tile-wrapper ${isNew ? 'tile-new' : ''}`}
      style={{ ...size, flexShrink: 0 }}
    >
      <DominoTile
        pip1={pip1}
        pip2={pip2}
        orientation={display === 'v' ? 'vertical' : 'horizontal'}
        style={size}
      />
    </div>
  )
}

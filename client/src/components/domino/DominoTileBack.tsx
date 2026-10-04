import { DominoTile } from './DominoTile'

// Face-down tile (opponents' hands, boneyard): the tile's ink body with a
// faint cream edge and its rivet. Deliberately not cream: a blank cream tile
// is the double blank (0·0).

interface DominoTileBackProps {
  orientation?: 'horizontal' | 'vertical'
  className?: string
  style?: React.CSSProperties
}

export function DominoTileBack({ orientation = 'vertical', className, style }: DominoTileBackProps) {
  return (
    <DominoTile
      pip1={0}
      pip2={0}
      faceDown
      depth="none"
      orientation={orientation}
      className={className}
      style={{ borderRadius: 3, ...style }}
    />
  )
}

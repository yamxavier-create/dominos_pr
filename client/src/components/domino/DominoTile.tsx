import { DotPattern } from './DotPattern'

interface DominoTileProps {
  pip1: number              // left pip (horizontal) or top pip (vertical)
  pip2: number              // right pip (horizontal) or bottom pip (vertical)
  orientation?: 'horizontal' | 'vertical'
  isPlayable?: boolean
  isSelected?: boolean      // brass outline
  isNew?: boolean           // triggers entry animation
  faceDown?: boolean        // blank face, no pips
  /** How the tile's thickness reads: lying on the felt, standing on the shelf, or flat. */
  depth?: 'board' | 'hand' | 'none'
  className?: string
  style?: React.CSSProperties
  onClick?: () => void
}

// «Mesa de club» tile: an ink body showing as a slot between two cream faces,
// a brass rivet in the middle, and its edge (thickness) as a hard shadow below.
const BODY = '#2B1B12'
const FACE = '#F4EBD3'
const BRASS = '#C9A24A'
const BRASS_EDGE = '#7A5A1E'

const DEPTH_SHADOW: Record<NonNullable<DominoTileProps['depth']>, string | undefined> = {
  board: '0 3px 0 #C6B287, 0 6px 7px rgba(3, 12, 7, 0.55)',
  hand: '0 -2px 6px rgba(3, 12, 7, 0.4)',
  none: undefined,
}

// Board tiles are 40×80 (or 80×40) px, 1:1 with the viewBox
const SLOT = 2      // gap between the two faces
const BODY_R = 6
const FACE_R = 5
const RIVET_R = 3.5

export function DominoTile({
  pip1, pip2, orientation = 'vertical', isSelected, isNew, faceDown, depth = 'board', className, style, onClick,
}: DominoTileProps) {
  const vertical = orientation === 'vertical'
  const W = vertical ? 40 : 80
  const H = vertical ? 80 : 40
  // Each face is a square half of the tile, minus half the slot
  const half = (vertical ? H : W) / 2 - SLOT / 2
  const face1 = { x: 0, y: 0, w: vertical ? W : half, h: vertical ? half : H }
  const face2 = vertical
    ? { x: 0, y: half + SLOT, w: W, h: half }
    : { x: half + SLOT, y: 0, w: half, h: H }

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className={`domino-tile ${isNew ? 'tile-new' : ''} ${className ?? ''}`}
      style={{
        display: 'block',
        borderRadius: BODY_R,
        boxShadow: DEPTH_SHADOW[depth],
        cursor: onClick ? 'pointer' : 'default',
        ...style,
      }}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      aria-hidden={onClick ? undefined : true}
    >
      <rect x="0" y="0" width={W} height={H} rx={BODY_R} fill={BODY} />
      {faceDown ? (
        // The back: plain ink body with a faint cream edge — never cream,
        // which would read as the double blank (0·0)
        <rect x="1" y="1" width={W - 2} height={H - 2} rx={BODY_R - 1} fill="none" stroke="rgba(241, 227, 194, 0.55)" strokeWidth="2" />
      ) : (
        <>
          <rect x={face1.x} y={face1.y} width={face1.w} height={face1.h} rx={FACE_R} fill={FACE} />
          <rect x={face2.x} y={face2.y} width={face2.w} height={face2.h} rx={FACE_R} fill={FACE} />
          <DotPattern count={pip1} xMin={face1.x} yMin={face1.y} xMax={face1.x + face1.w} yMax={face1.y + face1.h} />
          <DotPattern count={pip2} xMin={face2.x} yMin={face2.y} xMax={face2.x + face2.w} yMax={face2.y + face2.h} />
        </>
      )}
      <circle cx={W / 2} cy={H / 2} r={RIVET_R - 0.5} fill={BRASS} stroke={BRASS_EDGE} strokeWidth="1" />
      {isSelected && (
        <rect x="1" y="1" width={W - 2} height={H - 2} rx={BODY_R - 1} fill="none" stroke={BRASS} strokeWidth="2" />
      )}
    </svg>
  )
}

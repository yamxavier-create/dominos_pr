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

// «Mesa de club» tile: one cream rectangle split by a thin ink line, a brass
// rivet on the line, and its edge (thickness) as a hard shadow below. One
// continuous face, so a vertical tile never reads as two stacked squares (an 8).
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
const BODY_R = 5
const LINE_INSET = 6 // the divider stops short of the edges, like an engraved line
const RIVET_R = 3.5

export function DominoTile({
  pip1, pip2, orientation = 'vertical', isSelected, isNew, faceDown, depth = 'board', className, style, onClick,
}: DominoTileProps) {
  const vertical = orientation === 'vertical'
  const W = vertical ? 40 : 80
  const H = vertical ? 80 : 40
  // Each half is a square; the pips sit on a 3×3 grid inside it
  const face1 = { x: 0, y: 0, w: vertical ? W : W / 2, h: vertical ? H / 2 : H }
  const face2 = vertical
    ? { x: 0, y: H / 2, w: W, h: H / 2 }
    : { x: W / 2, y: 0, w: W / 2, h: H }
  const divider = vertical
    ? { x1: LINE_INSET, y1: H / 2, x2: W - LINE_INSET, y2: H / 2 }
    : { x1: W / 2, y1: LINE_INSET, x2: W / 2, y2: H - LINE_INSET }

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
      {faceDown ? (
        // The back: the ink body with a faint cream edge — never cream,
        // which would read as the double blank (0·0)
        <>
          <rect x="0" y="0" width={W} height={H} rx={BODY_R} fill={BODY} />
          <rect x="1" y="1" width={W - 2} height={H - 2} rx={BODY_R - 1} fill="none" stroke="rgba(241, 227, 194, 0.55)" strokeWidth="2" />
        </>
      ) : (
        <>
          <rect x="0.5" y="0.5" width={W - 1} height={H - 1} rx={BODY_R} fill={FACE} stroke="rgba(43, 27, 18, 0.35)" strokeWidth="1" />
          <line {...divider} stroke={BODY} strokeWidth="1.5" strokeLinecap="round" />
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

import { DotPattern } from './DotPattern'

interface DominoTileProps {
  pip1: number              // left pip (horizontal) or top pip (vertical)
  pip2: number              // right pip (horizontal) or bottom pip (vertical)
  orientation?: 'horizontal' | 'vertical'
  isPlayable?: boolean      // teal glow + brighter border
  isSelected?: boolean      // gold border + lifted
  isNew?: boolean           // triggers entry animation
  className?: string
  style?: React.CSSProperties
  onClick?: () => void
}

// Horizontal SVG: 80 × 40 viewBox
function HorizontalTile({
  pip1, pip2, isPlayable, isSelected, isNew, className, style, onClick
}: DominoTileProps) {
  const borderColor = isSelected ? '#FFD93D' : isPlayable ? '#0D7377' : '#8899aa'
  const bgColor = '#FFF8F0'
  const animClass = isNew ? 'tile-new' : ''
  const selectedClass = isSelected ? 'tile-selected' : ''
  const playableClass = isPlayable ? 'tile-playable' : ''

  return (
    <svg
      viewBox="0 0 80 40"
      className={`domino-tile ${animClass} ${selectedClass} ${playableClass} ${className ?? ''}`}
      style={{ cursor: onClick ? 'pointer' : 'default', display: 'block', ...style }}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
    >
      {/* Background */}
      <rect x="1" y="1" width="78" height="38" rx="4" fill={bgColor} stroke={borderColor} strokeWidth="1.5" />
      {/* Center divider */}
      <line x1="40" y1="4" x2="40" y2="36" stroke={borderColor} strokeWidth="1" />
      {/* Pips */}
      <DotPattern count={pip1} xMin={4} yMin={4} xMax={36} yMax={36} />
      <DotPattern count={pip2} xMin={44} yMin={4} xMax={76} yMax={36} />
    </svg>
  )
}

// Vertical SVG: 40 × 80 viewBox
function VerticalTile({
  pip1, pip2, isPlayable, isSelected, isNew, className, style, onClick
}: DominoTileProps) {
  const borderColor = isSelected ? '#FFD93D' : isPlayable ? '#0D7377' : '#8899aa'
  const bgColor = '#FFF8F0'
  const animClass = isNew ? 'tile-new' : ''
  const selectedClass = isSelected ? 'tile-selected' : ''
  const playableClass = isPlayable ? 'tile-playable' : ''

  return (
    <svg
      viewBox="0 0 40 80"
      className={`domino-tile ${animClass} ${selectedClass} ${playableClass} ${className ?? ''}`}
      style={{ cursor: onClick ? 'pointer' : 'default', display: 'block', ...style }}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
    >
      {/* Background */}
      <rect x="1" y="1" width="38" height="78" rx="4" fill={bgColor} stroke={borderColor} strokeWidth="1.5" />
      {/* Center divider */}
      <line x1="4" y1="40" x2="36" y2="40" stroke={borderColor} strokeWidth="1" />
      {/* Pips */}
      <DotPattern count={pip1} xMin={4} yMin={4} xMax={36} yMax={36} />
      <DotPattern count={pip2} xMin={4} yMin={44} xMax={36} yMax={76} />
    </svg>
  )
}

export function DominoTile(props: DominoTileProps) {
  const { orientation = 'vertical' } = props
  return orientation === 'horizontal'
    ? <HorizontalTile {...props} />
    : <VerticalTile {...props} />
}

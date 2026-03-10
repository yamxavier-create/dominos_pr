// Face-down domino tile (opponent's hand)

interface DominoTileBackProps {
  orientation?: 'horizontal' | 'vertical'
  className?: string
  style?: React.CSSProperties
}

export function DominoTileBack({ orientation = 'vertical', className, style }: DominoTileBackProps) {
  if (orientation === 'horizontal') {
    return (
      <svg
        viewBox="0 0 80 40"
        className={className}
        style={{ display: 'block', ...style }}
      >
        <rect x="1" y="1" width="78" height="38" rx="4" fill="#2a3655" stroke="#3d5080" strokeWidth="1.5" />
        <line x1="40" y1="4" x2="40" y2="36" stroke="#3d5080" strokeWidth="1" />
        {/* Decorative diamond pattern */}
        <polygon points="20,8 28,20 20,32 12,20" fill="none" stroke="#4a6090" strokeWidth="1" />
        <polygon points="60,8 68,20 60,32 52,20" fill="none" stroke="#4a6090" strokeWidth="1" />
      </svg>
    )
  }

  return (
    <svg
      viewBox="0 0 40 80"
      className={className}
      style={{ display: 'block', ...style }}
    >
      <rect x="1" y="1" width="38" height="78" rx="4" fill="#2a3655" stroke="#3d5080" strokeWidth="1.5" />
      <line x1="4" y1="40" x2="36" y2="40" stroke="#3d5080" strokeWidth="1" />
      {/* Decorative diamond pattern */}
      <polygon points="20,8 30,20 20,32 10,20" fill="none" stroke="#4a6090" strokeWidth="1" />
      <polygon points="20,48 30,60 20,72 10,60" fill="none" stroke="#4a6090" strokeWidth="1" />
    </svg>
  )
}

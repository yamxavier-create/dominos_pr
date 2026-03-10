interface BoardEndsProps {
  leftEnd: number | null
  rightEnd: number | null
  selectedTileId: string | null
  validPlays: Array<{ tileId: string; targetEnd: 'left' | 'right' }>
  onEndClick: (end: 'left' | 'right') => void
}

export function BoardEnds({ leftEnd, rightEnd, selectedTileId, validPlays, onEndClick }: BoardEndsProps) {
  const canPlayLeft = selectedTileId !== null && validPlays.some(vp => vp.tileId === selectedTileId && vp.targetEnd === 'left')
  const canPlayRight = selectedTileId !== null && validPlays.some(vp => vp.tileId === selectedTileId && vp.targetEnd === 'right')

  const EndBadge = ({ end, value, canPlay }: { end: 'left' | 'right'; value: number | null; canPlay: boolean }) => (
    <button
      onClick={() => canPlay && onEndClick(end)}
      className={`
        flex items-center justify-center w-9 h-9 rounded-full text-sm font-bold font-body
        border-2 transition-all duration-200 z-10 shrink-0
        ${value === null ? 'opacity-0 pointer-events-none' : ''}
        ${canPlay
          ? 'bg-gold border-gold text-bg cursor-pointer scale-110 animate-pulse shadow-lg shadow-gold/50'
          : 'bg-surface border-border text-white/60 cursor-default'
        }
      `}
      style={{ pointerEvents: value === null ? 'none' : undefined }}
    >
      {value ?? ''}
    </button>
  )

  return (
    <>
      <div className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1 z-10">
        <EndBadge end="left" value={leftEnd} canPlay={canPlayLeft} />
      </div>
      <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1 z-10">
        <EndBadge end="right" value={rightEnd} canPlay={canPlayRight} />
      </div>
    </>
  )
}

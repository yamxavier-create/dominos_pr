import { useRef, useEffect, useState, useMemo } from 'react'
import { BoardState, BoardTile as BoardTileType } from '../../types/game'
import { BoardTileItem } from './BoardTile'
import { computeSnakeLayout, displaySize, EDGE_INSET, boardFit, snakeExtents } from './snakeLayout'
import { useGameStore } from '../../store/gameStore'
import { useUIStore } from '../../store/uiStore'

interface GameBoardProps {
  board: BoardState
  allowZoom?: boolean  // desktop: grow tiles to use the larger table
}

export function GameBoard({ board, allowZoom }: GameBoardProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [dims, setDims] = useState({ w: 0, h: 0 })
  const lastTileSequence = useGameStore(s => s.lastTileSequence)
  const flyingTileId = useUIStore(s => s.flyingTile?.tileId ?? null)

  // On big screens, lay the snake out in a smaller virtual board and scale it up,
  // so tiles grow with the table instead of staying phone-sized in the middle
  const zoom = allowZoom ? Math.min(1.6, Math.max(1, Math.min(dims.w / 760, dims.h / 480))) : 1
  const vw = dims.w / zoom
  const vh = dims.h / zoom
  const { scale: handScale, snakeW } = useMemo(() => boardFit(vw, vh), [vw, vh])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect
      if (width > 0 && height > 0) setDims({ w: width, h: height })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  if (board.tiles.length === 0) {
    return (
      <div ref={containerRef} className="w-full h-full flex items-center justify-center">
        <div className="text-center">
          <p className="font-club font-semibold text-sm text-club-muted">Esperando la primera ficha</p>
        </div>
      </div>
    )
  }

  // Wait for ResizeObserver to provide real dimensions before rendering tiles
  if (dims.w === 0 || dims.h === 0) {
    return <div ref={containerRef} className="w-full h-full" />
  }

  // Tiles stay where they were put, at one size, like on a real table. The
  // first tile sits on the board's center line and the rows run out from it to
  // both sides, so a tile never slides sideways; the snake only moves down or
  // up, as one, when an arm turns into a new row. A hand that outgrows the
  // board (a row too many, doubles lying on the columns) is drawn smaller.
  const layout = computeSnakeLayout(board.tiles, snakeW)
  const { halfW, minY, maxY } = snakeExtents(board.tiles, layout)
  const fitScale = Math.min(1, (vw / 2 - EDGE_INSET) / halfW, (vh - 2 * EDGE_INSET) / (maxY - minY))
  const scale = Math.min(handScale, Number.isFinite(fitScale) ? Math.max(0.15, fitScale) : 1) * zoom
  const offsetX = vw / 2
  const offsetY = vh / 2 - (minY + maxY) / 2

  return (
    <div ref={containerRef} className="w-full h-full overflow-hidden relative">
      <div
        style={{
          position: 'absolute',
          left: (dims.w - vw) / 2,
          top: (dims.h - vh) / 2,
          width: vw,
          height: vh,
          transform: scale !== 1 ? `scale(${scale})` : undefined,
          transformOrigin: 'center center',
          transition: 'transform 350ms ease-out',
        }}
      >
        {/* Tiles */}
        {board.tiles.map((bt, idx) => {
          const item = layout[idx]
          if (!item) return null
          const { pos, flipped, display } = item
          const { w, h } = displaySize(display)
          const isFlying = bt.tile.id === flyingTileId
          // Mark the end tiles so drag-drop and fly animation can find them
          const isLeftEnd = idx === 0 && board.tiles.length > 1
          const isRightEnd = idx === board.tiles.length - 1 && board.tiles.length > 1
          const isOnlyTile = board.tiles.length === 1
          return (
            <div
              key={bt.tile.id}
              className="absolute"
              data-board-end={isLeftEnd ? 'left' : isRightEnd ? 'right' : undefined}
              data-board-single={isOnlyTile || undefined}
              style={{
                left: pos.x + offsetX - w / 2,
                top: pos.y + offsetY - h / 2,
                width: w,
                height: h,
                // No overflow clipping: the tile's edge (thickness) is a shadow
                // below its box, and clipping it left only two points at the corners
                opacity: isFlying ? 0 : undefined,
                transition: 'left 350ms ease-out, top 350ms ease-out',
              }}
            >
              <BoardTileItem boardTile={bt} isNew={bt.sequence === lastTileSequence} flipped={flipped} display={display} />
            </div>
          )
        })}

      </div>
    </div>
  )
}

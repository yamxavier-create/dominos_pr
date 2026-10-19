import { useRef, useEffect, useState, useMemo } from 'react'
import { BoardState, BoardTile as BoardTileType } from '../../types/game'
import { BoardTileItem } from './BoardTile'
import { computeSnakeLayout, displaySize, EDGE_INSET, LayoutItem, REFERENCE_HAND, SNAKE_WIDTHS } from './snakeLayout'
import { useGameStore } from '../../store/gameStore'
import { useUIStore } from '../../store/uiStore'

interface FittedLayout {
  layout: LayoutItem[]
  snakeW: number
  scale: number
  // Center of the snake's bounding box, in layout coordinates
  cx: number
  cy: number
}

/** Lay the snake out at one width and measure how big it can be drawn on the board */
function fitLayout(tiles: BoardTileType[], snakeW: number, boardW: number, boardH: number): FittedLayout {
  const layout = computeSnakeLayout(tiles, snakeW)
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  tiles.forEach((_bt, idx) => {
    const item = layout[idx]
    if (!item) return
    const { w, h } = displaySize(item.display)
    minX = Math.min(minX, item.pos.x - w / 2)
    minY = Math.min(minY, item.pos.y - h / 2)
    maxX = Math.max(maxX, item.pos.x + w / 2)
    maxY = Math.max(maxY, item.pos.y + h / 2)
  })
  const raw = Math.min(1, (boardW - 2 * EDGE_INSET) / (maxX - minX), (boardH - 2 * EDGE_INSET) / (maxY - minY))
  return {
    layout,
    snakeW,
    scale: Number.isFinite(raw) ? Math.max(0.15, raw) : 1,
    cx: (minX + maxX) / 2,
    cy: (minY + maxY) / 2,
  }
}

/** Rows the reference hand runs in at this width: distinct heights of its row tiles */
function referenceRows(layout: LayoutItem[]): number {
  const ys = new Set<number>()
  REFERENCE_HAND.forEach((bt, i) => {
    if (bt.orientation === 'horizontal' && layout[i].display === 'h') ys.add(Math.round(layout[i].pos.y))
  })
  return ys.size
}

/**
 * Pick the snake width for this board: the one that draws a full hand as three
 * rows (two bends) biggest. That's the shape of the snake on the phone, so a
 * hand never comes out as two long rows or a tight S. If no width gives three
 * rows, the one that draws the hand biggest wins.
 */
function snakeWidthFor(boardW: number, boardH: number): number {
  let best: FittedLayout | null = null
  let bestThreeRows: FittedLayout | null = null
  for (const w of SNAKE_WIDTHS) {
    const fit = fitLayout(REFERENCE_HAND, w, boardW, boardH)
    if (!best || fit.scale > best.scale) best = fit
    if (referenceRows(fit.layout) === 3 && (!bestThreeRows || fit.scale > bestThreeRows.scale)) bestThreeRows = fit
  }
  return (bestThreeRows ?? best!).snakeW
}

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
  const snakeW = useMemo(() => snakeWidthFor(vw, vh), [vw, vh])
  const handScale = useMemo(() => fitLayout(REFERENCE_HAND, snakeW, vw, vh).scale, [snakeW, vw, vh])

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

  const fitted = fitLayout(board.tiles, snakeW, vw, vh)
  const { layout } = fitted
  // Tiles keep one size for the whole hand: the size a full hand needs on this
  // board, so the snake grows without shrinking. Only a hand that outgrows the
  // reference (more doubles on the columns) shrinks further.
  const scale = Math.min(handScale, fitted.scale) * zoom
  // Center the snake's bounding box on the board, not the first tile
  const offsetX = vw / 2 - fitted.cx
  const offsetY = vh / 2 - fitted.cy


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

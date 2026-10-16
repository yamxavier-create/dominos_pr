import { useRef, useEffect, useState, useMemo } from 'react'
import { BoardState, BoardTile as BoardTileType } from '../../types/game'
import { BoardTileItem, TILE_H_W, TILE_H_H, TILE_V_W, TILE_V_H } from './BoardTile'
import { useGameStore } from '../../store/gameStore'
import { useUIStore } from '../../store/uiStore'

const GAP = 1
// Snake widths tried for each board: from 3 tiles per row up to a single long line
const SNAKE_WIDTHS = Array.from({ length: 24 }, (_, i) => 240 + i * 80)
// The snake width is fixed per board size, so the snake bends where it will
// bend for the rest of the hand instead of starting as a straight line and
// reflowing once it gets too long. It's the width that draws a full hand biggest:
// 24 tiles played to both ends with a few doubles. That runs the rows across
// the whole board from the first tiles.
const REFERENCE_SIDES = 'RLRLRRLLRLRLRRLLRLRLRLRL'
const REFERENCE_DOUBLES = [0, 5, 11]
const REFERENCE_HAND: BoardTileType[] = (() => {
  let tiles: BoardTileType[] = []
  for (let k = 0; k < REFERENCE_SIDES.length; k++) {
    const bt: BoardTileType = {
      tile: { id: `ref-${k}`, high: 0, low: 0, isDouble: false },
      orientation: REFERENCE_DOUBLES.includes(k) ? 'vertical' : 'horizontal',
      leftPip: 0,
      rightPip: 0,
      playedByIndex: 0,
      sequence: k,
    }
    tiles = REFERENCE_SIDES[k] === 'L' ? [bt, ...tiles] : [...tiles, bt]
  }
  return tiles
})()
const EDGE_INSET = 14 // the felt's brass lip plus breathing room

interface TilePos { x: number; y: number }
interface LayoutItem { pos: TilePos; flipped: boolean; corner: boolean }

/** Effective display size after applying corner rotation */
function tileDisplaySize(bt: BoardTileType, corner: boolean) {
  if (corner && bt.orientation === 'horizontal') {
    return { w: TILE_V_W, h: TILE_V_H }
  }
  return tileSize(bt)
}

function tileSize(bt: BoardTileType) {
  return bt.orientation === 'vertical'
    ? { w: TILE_V_W, h: TILE_V_H }
    : { w: TILE_H_W, h: TILE_H_H }
}

/**
 * Snake layout around the first-played tile (lowest sequence) at the origin.
 *
 * The right arm (tiles added to right end) extends rightward from the anchor;
 * the left arm (tiles added to left end) extends leftward. Each arm wraps
 * independently at ±snakeW/2 from the anchor, so adding tiles to one side
 * never shifts tiles on the other side.
 */
function computeSnakeLayout(tiles: BoardTileType[], snakeW: number): LayoutItem[] {
  const n = tiles.length
  if (n === 0) return []

  const EDGE_PAD = 6
  const half = snakeW / 2  // each arm gets ±half from anchor

  // Find anchor: first-played tile = lowest sequence number
  let anchorIdx = 0
  for (let i = 1; i < n; i++) {
    if (tiles[i].sequence < tiles[anchorIdx].sequence) anchorIdx = i
  }

  const raw: TilePos[] = new Array(n)
  const flippedFlags: boolean[] = new Array(n).fill(false)
  const cornerFlags: boolean[] = new Array(n).fill(false)

  // Anchor at origin — offset applied at the end
  raw[anchorIdx] = { x: 0, y: 0 }
  const { w: anchorW, h: anchorH } = tileSize(tiles[anchorIdx])

  // ── Right arm: tiles[anchorIdx+1 … n-1], extending rightward ───────────────
  {
    let x = anchorW / 2 + GAP  // cursor starts at anchor's right edge
    let y = 0
    let dir = 1
    let rowMaxH = anchorH
    let tilesInRow = 0  // don't count anchor — need 2 tiles before first corner
    let pendingCorner = false  // true = next tile is the 2nd vertical tile of a corner pair

    for (let i = anchorIdx + 1; i < n; i++) {
      const { w: tileW, h: tileH } = tileSize(tiles[i])
      const isHorizontal = tiles[i].orientation === 'horizontal'
      let cx: number
      let isCorner = false

      if (pendingCorner) {
        // 2nd tile of the corner pair — flush against the 1st corner tile (no gap)
        isCorner = true
        const effW = isHorizontal ? TILE_V_W : tileW
        const effH = isHorizontal ? TILE_V_H : tileH
        const prevCorner = raw[i - 1]
        const prevH = tileDisplaySize(tiles[i - 1], cornerFlags[i - 1]).h
        cx = prevCorner.x
        const tileY = prevCorner.y + prevH / 2 + effH / 2  // center of 2nd corner tile (with gap)
        // Place the 2nd corner tile at its true center
        raw[i] = { x: cx, y: tileY }
        cornerFlags[i] = true
        flippedFlags[i] = false
        // New horizontal row aligns with the bottom pip of this corner tile
        y = tileY + (effH - TILE_H_H) / 2
        // Now start the new horizontal row
        if (dir === -1) {
          x = cx - effW / 2 - GAP
        } else {
          x = cx + effW / 2 + GAP
        }
        rowMaxH = TILE_H_H
        tilesInRow = 0
        pendingCorner = false
        continue  // already placed raw[i], skip the common assignment below
      } else if (dir === 1) {
        cx = x + tileW / 2
        if (cx + tileW / 2 + EDGE_PAD > half && tilesInRow >= 2) {
          // 1st corner tile — extends downward
          isCorner = true
          const effW = isHorizontal ? TILE_V_W : tileW
          const effH = isHorizontal ? TILE_V_H : tileH

          // If previous tile is a double, place directly below it
          if (tiles[i - 1].orientation === 'vertical') {
            cx = raw[i - 1].x
            const prevH = tileDisplaySize(tiles[i - 1], cornerFlags[i - 1]).h
            const tileY = raw[i - 1].y + prevH / 2 + effH / 2
            raw[i] = { x: cx, y: tileY }
            cornerFlags[i] = true
            flippedFlags[i] = false
            dir = -1
            pendingCorner = true
            continue
          }

          const prevW = tileDisplaySize(tiles[i - 1], cornerFlags[i - 1]).w
          cx = raw[i - 1].x + prevW / 2 + effW / 2
          // Top pip aligns with row center, tile extends downward
          y += (effH - TILE_H_H) / 2
          rowMaxH = effH
          dir = -1
          pendingCorner = true
        } else {
          rowMaxH = Math.max(rowMaxH, tileH)
          x = cx + tileW / 2 + GAP
          tilesInRow++
        }
      } else {
        cx = x - tileW / 2
        if (cx - tileW / 2 - EDGE_PAD < -half && tilesInRow >= 2) {
          // 1st corner tile — extends downward
          isCorner = true
          const effW = isHorizontal ? TILE_V_W : tileW
          const effH = isHorizontal ? TILE_V_H : tileH

          // If previous tile is a double, place directly below it
          if (tiles[i - 1].orientation === 'vertical') {
            cx = raw[i - 1].x
            const prevH = tileDisplaySize(tiles[i - 1], cornerFlags[i - 1]).h
            const tileY = raw[i - 1].y + prevH / 2 + effH / 2
            raw[i] = { x: cx, y: tileY }
            cornerFlags[i] = true
            flippedFlags[i] = false
            dir = 1
            pendingCorner = true
            continue
          }

          const prevW = tileDisplaySize(tiles[i - 1], cornerFlags[i - 1]).w
          cx = raw[i - 1].x - prevW / 2 - effW / 2
          // Top pip aligns with row center, tile extends downward
          y += (effH - TILE_H_H) / 2
          rowMaxH = effH
          dir = 1
          pendingCorner = true
        } else {
          rowMaxH = Math.max(rowMaxH, tileH)
          x = cx - tileW / 2 - GAP
          tilesInRow++
        }
      }

      raw[i] = { x: cx, y }
      cornerFlags[i] = isCorner
      flippedFlags[i] = !isCorner && dir === -1
    }
  }

  // ── Left arm: tiles[anchorIdx-1 … 0], extending leftward ───────────────────
  // Iterate closest-to-anchor first (anchorIdx-1 down to 0).
  // Left arm wraps UPWARD (y decreases) so it never collides with the right arm.
  // Left-end tiles: leftPip=exposed, rightPip=connecting — flipped when dir=1.
  {
    let x = -(anchorW / 2 + GAP)  // cursor starts at anchor's left edge
    let y = 0
    let dir = -1
    let rowMaxH = anchorH
    let tilesInRow = 0  // don't count anchor — need 2 tiles before first corner
    let pendingCorner = false  // true = next tile is the 2nd vertical tile of a corner pair

    for (let i = anchorIdx - 1; i >= 0; i--) {
      const { w: tileW, h: tileH } = tileSize(tiles[i])
      const isHorizontal = tiles[i].orientation === 'horizontal'
      let cx: number
      let isCorner = false

      if (pendingCorner) {
        // 2nd tile of the corner pair — flush against the 1st corner tile (no gap)
        isCorner = true
        const effW = isHorizontal ? TILE_V_W : tileW
        const effH = isHorizontal ? TILE_V_H : tileH
        const prevCorner = raw[i + 1]
        const prevH = tileDisplaySize(tiles[i + 1], cornerFlags[i + 1]).h
        cx = prevCorner.x
        const tileY = prevCorner.y - prevH / 2 - effH / 2  // center of 2nd corner tile (with gap)
        // Place the 2nd corner tile at its true center
        raw[i] = { x: cx, y: tileY }
        cornerFlags[i] = true
        flippedFlags[i] = false
        // New horizontal row aligns with the top pip of this corner tile
        y = tileY - (effH - TILE_H_H) / 2
        // Now start the new horizontal row
        if (dir === 1) {
          x = cx + effW / 2 + GAP
        } else {
          x = cx - effW / 2 - GAP
        }
        rowMaxH = TILE_H_H
        tilesInRow = 0
        pendingCorner = false
        continue  // already placed raw[i], skip the common assignment below
      } else if (dir === -1) {
        cx = x - tileW / 2
        if (cx - tileW / 2 - EDGE_PAD < -half && tilesInRow >= 2) {
          // 1st corner tile — extends upward
          isCorner = true
          const effW = isHorizontal ? TILE_V_W : tileW
          const effH = isHorizontal ? TILE_V_H : tileH

          // If previous tile is a double, place directly above it
          if (tiles[i + 1].orientation === 'vertical') {
            cx = raw[i + 1].x
            const prevH = tileDisplaySize(tiles[i + 1], cornerFlags[i + 1]).h
            const tileY = raw[i + 1].y - prevH / 2 - effH / 2
            raw[i] = { x: cx, y: tileY }
            cornerFlags[i] = true
            flippedFlags[i] = false
            dir = 1
            pendingCorner = true
            continue
          }

          const prevW = tileDisplaySize(tiles[i + 1], cornerFlags[i + 1]).w
          cx = raw[i + 1].x - prevW / 2 - effW / 2
          // Bottom pip aligns with row center, tile extends upward
          y -= (effH - TILE_H_H) / 2
          rowMaxH = effH
          dir = 1
          pendingCorner = true
        } else {
          rowMaxH = Math.max(rowMaxH, tileH)
          x = cx - tileW / 2 - GAP
          tilesInRow++
        }
      } else {
        cx = x + tileW / 2
        if (cx + tileW / 2 + EDGE_PAD > half && tilesInRow >= 2) {
          // 1st corner tile — extends upward
          isCorner = true
          const effW = isHorizontal ? TILE_V_W : tileW
          const effH = isHorizontal ? TILE_V_H : tileH

          // If previous tile is a double, place directly above it
          if (tiles[i + 1].orientation === 'vertical') {
            cx = raw[i + 1].x
            const prevH = tileDisplaySize(tiles[i + 1], cornerFlags[i + 1]).h
            const tileY = raw[i + 1].y - prevH / 2 - effH / 2
            raw[i] = { x: cx, y: tileY }
            cornerFlags[i] = true
            flippedFlags[i] = false
            dir = -1
            pendingCorner = true
            continue
          }

          const prevW = tileDisplaySize(tiles[i + 1], cornerFlags[i + 1]).w
          cx = raw[i + 1].x + prevW / 2 + effW / 2
          // Bottom pip aligns with row center, tile extends upward
          y -= (effH - TILE_H_H) / 2
          rowMaxH = effH
          dir = -1
          pendingCorner = true
        } else {
          rowMaxH = Math.max(rowMaxH, tileH)
          x = cx + tileW / 2 + GAP
          tilesInRow++
        }
      }

      raw[i] = { x: cx, y }
      cornerFlags[i] = isCorner
      flippedFlags[i] = !isCorner && dir === 1
    }
  }

  return raw.map((p, i) => ({
    pos: p,
    flipped: flippedFlags[i],
    corner: cornerFlags[i],
  }))
}

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
  tiles.forEach((bt, idx) => {
    const item = layout[idx]
    if (!item) return
    const { w, h } = tileDisplaySize(bt, item.corner)
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

/** Pick the snake width that draws the reference hand biggest on this board */
function snakeWidthFor(boardW: number, boardH: number): number {
  let best: FittedLayout | null = null
  for (const w of SNAKE_WIDTHS) {
    const fit = fitLayout(REFERENCE_HAND, w, boardW, boardH)
    // Among near-equal widths the widest wins (fewer bends)
    if (!best || fit.scale >= best.scale * 0.995) best = fit
  }
  return best!.snakeW
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
  const scale = fitted.scale * zoom
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
          const { pos, flipped, corner } = item
          const { w, h } = tileDisplaySize(bt, corner)
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
              <BoardTileItem boardTile={bt} isNew={bt.sequence === lastTileSequence} flipped={flipped} corner={corner} />
            </div>
          )
        })}

      </div>
    </div>
  )
}

import { useRef, useEffect, useState } from 'react'
import { BoardState, BoardTile as BoardTileType } from '../../types/game'
import { BoardTileItem, TILE_H_W, TILE_H_H, TILE_V_W, TILE_V_H } from './BoardTile'
import { useGameStore } from '../../store/gameStore'

const GAP = 4
const SNAKE_CAP = 620  // max snake row width (~7 tiles per row at 80px)

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
 * Snake layout anchored to canvas center.
 *
 * The first-played tile (lowest sequence) is fixed at (boardW/2, boardH/2).
 * The right arm (tiles added to right end) extends rightward from the anchor;
 * the left arm (tiles added to left end) extends leftward. Each arm wraps
 * independently at ±snakeW/2 from the anchor, so adding tiles to one side
 * never shifts tiles on the other side.
 */
function computeSnakeLayout(tiles: BoardTileType[], boardW: number, boardH: number): LayoutItem[] {
  const n = tiles.length
  if (n === 0) return []

  const EDGE_PAD = 6
  const snakeW = Math.min(boardW - 40, SNAKE_CAP)
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

  // Anchor tile is always fixed at (boardW/2, boardH/2).
  // Snake extends rightward/downward (right arm) and leftward/upward (left arm)
  // from that fixed point — adding tiles never moves existing tiles.
  const offsetX = boardW / 2
  const offsetY = boardH / 2

  return raw.map((p, i) => ({
    pos: { x: p.x + offsetX, y: p.y + offsetY },
    flipped: flippedFlags[i],
    corner: cornerFlags[i],
  }))
}

interface GameBoardProps {
  board: BoardState
}

export function GameBoard({ board }: GameBoardProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [dims, setDims] = useState({ w: 0, h: 0 })
  const lastTileSequence = useGameStore(s => s.lastTileSequence)

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
        <div className="text-white/30 text-center">
          <div className="text-5xl mb-2">🁣</div>
          <p className="font-body text-sm">Esperando la primera ficha...</p>
        </div>
      </div>
    )
  }

  // Wait for ResizeObserver to provide real dimensions before rendering tiles
  if (dims.w === 0 || dims.h === 0) {
    return <div ref={containerRef} className="w-full h-full" />
  }

  const layout = computeSnakeLayout(board.tiles, dims.w, dims.h)

  // Compute bounding box of all tiles to determine if scaling is needed
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  board.tiles.forEach((bt, idx) => {
    const { pos } = layout[idx]
    const corner = layout[idx].corner
    const { w, h } = tileDisplaySize(bt, corner)
    minX = Math.min(minX, pos.x - w / 2)
    minY = Math.min(minY, pos.y - h / 2)
    maxX = Math.max(maxX, pos.x + w / 2)
    maxY = Math.max(maxY, pos.y + h / 2)
  })
  // Scale so content fits within the container, accounting for transform-origin: center.
  // With scale() at the center, each side must fit independently:
  //   rendered position = center + (original - center) * scale
  // So: rightExtent * scale <= dims.w / 2  (right side)
  //     leftExtent  * scale <= dims.w / 2  (left side)
  const BADGE_MARGIN = 16
  const cx = dims.w / 2
  const cy = dims.h / 2
  const rightExtent = maxX - cx + BADGE_MARGIN
  const leftExtent  = cx - minX + BADGE_MARGIN
  const bottomExtent = maxY - cy + BADGE_MARGIN
  const topExtent    = cy - minY + BADGE_MARGIN
  const scale = Math.min(
    1,
    rightExtent  > 0 ? (dims.w / 2) / rightExtent  : 1,
    leftExtent   > 0 ? (dims.w / 2) / leftExtent   : 1,
    bottomExtent > 0 ? (dims.h / 2) / bottomExtent : 1,
    topExtent    > 0 ? (dims.h / 2) / topExtent    : 1,
  )


  return (
    <div ref={containerRef} className="w-full h-full overflow-hidden relative">
      <div
        style={{
          position: 'absolute',
          inset: 0,
          transform: scale < 1 ? `scale(${scale})` : undefined,
          transformOrigin: 'center center',
        }}
      >
        {/* Tiles */}
        {board.tiles.map((bt, idx) => {
          const { pos, flipped, corner } = layout[idx]
          if (!pos) return null
          const { w, h } = tileDisplaySize(bt, corner)
          return (
            <div
              key={bt.tile.id}
              className="absolute"
              style={{ left: pos.x - w / 2, top: pos.y - h / 2, width: w, height: h, overflow: 'hidden' }}
            >
              <BoardTileItem boardTile={bt} isNew={bt.sequence === lastTileSequence} flipped={flipped} corner={corner} />
            </div>
          )
        })}

      </div>
    </div>
  )
}

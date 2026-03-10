import { useRef, useEffect, useState } from 'react'
import { BoardState, BoardTile as BoardTileType } from '../../types/game'
import { BoardTileItem, TILE_H_W, TILE_H_H, TILE_V_W, TILE_V_H } from './BoardTile'
import { useUIStore } from '../../store/uiStore'
import { useGameStore } from '../../store/gameStore'
import { useGameActions } from '../../hooks/useGameActions'

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
          // 1st corner tile — placed flush against previous tile, extends downward
          isCorner = true
          const effW = isHorizontal ? TILE_V_W : tileW
          const effH = isHorizontal ? TILE_V_H : tileH
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
          // 1st corner tile — placed flush against previous tile, extends downward
          isCorner = true
          const effW = isHorizontal ? TILE_V_W : tileW
          const effH = isHorizontal ? TILE_V_H : tileH
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
          // 1st corner tile — placed flush against previous tile, extends upward
          isCorner = true
          const effW = isHorizontal ? TILE_V_W : tileW
          const effH = isHorizontal ? TILE_V_H : tileH
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
          // 1st corner tile — placed flush against previous tile, extends upward
          isCorner = true
          const effW = isHorizontal ? TILE_V_W : tileW
          const effH = isHorizontal ? TILE_V_H : tileH
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
  validPlays: Array<{ tileId: string; targetEnd: 'left' | 'right' }>
}

export function GameBoard({ board, validPlays }: GameBoardProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [dims, setDims] = useState({ w: 0, h: 0 })
  const lastTileSequence = useGameStore(s => s.lastTileSequence)
  const selectedTileId = useUIStore(s => s.selectedTileId)
  const { playTileOnEnd } = useGameActions()

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
  const BADGE_MARGIN = 48 // space for end badges
  const contentW = maxX - minX + BADGE_MARGIN * 2
  const contentH = maxY - minY + BADGE_MARGIN * 2
  const scale = Math.min(1, dims.w / contentW, dims.h / contentH)

  const leftEnd = board.tiles[0]
  const rightEnd = board.tiles[board.tiles.length - 1]
  const leftItem = layout[0]
  const rightItem = layout[layout.length - 1]

  const canPlayLeft = selectedTileId !== null && validPlays.some(vp => vp.tileId === selectedTileId && vp.targetEnd === 'left')
  const canPlayRight = selectedTileId !== null && validPlays.some(vp => vp.tileId === selectedTileId && vp.targetEnd === 'right')

  const endBadgeClass = (canPlay: boolean) => `
    absolute flex items-center justify-center w-9 h-9 rounded-full text-sm font-bold font-body
    border-2 transition-all duration-200 z-20 -translate-y-1/2
    ${canPlay
      ? 'bg-gold border-gold text-bg cursor-pointer scale-110 animate-pulse shadow-lg shadow-gold/50'
      : 'bg-surface border-border text-white/60 cursor-default'
    }
  `

  // Badge is w-9 (36px). Position depends on which side the exposed pip faces.
  // Left end: exposed pip is leftPip. When flipped, it's displayed on the RIGHT physical side.
  // When corner (vertical), the exposed pip is on top — place badge above.
  const BADGE_OFF = 8  // gap between tile edge and badge edge
  const leftDisplaySize = tileDisplaySize(leftEnd, leftItem.corner)
  const leftBadgeOnRight = leftItem.flipped  // flipped = right-going row after corner turn
  const leftBadgeX = leftItem.corner
    ? leftItem.pos.x + leftDisplaySize.w / 2 + BADGE_OFF  // to the right of corner tile
    : leftBadgeOnRight
      ? leftItem.pos.x + leftDisplaySize.w / 2 + BADGE_OFF
      : Math.max(2, leftItem.pos.x - leftDisplaySize.w / 2 - 36 - BADGE_OFF)
  const leftBadgeY = leftItem.corner
    ? leftItem.pos.y - leftDisplaySize.h / 4  // at exposed (top) pip center
    : leftItem.pos.y

  // Right end: exposed pip is rightPip. When flipped, displayed on LEFT physical side.
  const rightDisplaySize = tileDisplaySize(rightEnd, rightItem.corner)
  const rightBadgeOnLeft = rightItem.flipped
  const rightBadgeX = rightItem.corner
    ? rightItem.pos.x + rightDisplaySize.w / 2 + BADGE_OFF  // to the right of corner tile
    : rightBadgeOnLeft
      ? Math.max(2, rightItem.pos.x - rightDisplaySize.w / 2 - 36 - BADGE_OFF)
      : rightItem.pos.x + rightDisplaySize.w / 2 + BADGE_OFF
  const rightBadgeY = rightItem.corner
    ? rightItem.pos.y + rightDisplaySize.h / 4  // at exposed (bottom) pip center
    : rightItem.pos.y

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

        {/* Left-end badge */}
        {leftItem && board.leftEnd !== null && (
          <button
            onClick={() => canPlayLeft && playTileOnEnd('left')}
            className={endBadgeClass(canPlayLeft)}
            style={{ left: leftBadgeX, top: leftBadgeY }}
          >
            {board.leftEnd}
          </button>
        )}

        {/* Right-end badge */}
        {rightItem && board.rightEnd !== null && (
          <button
            onClick={() => canPlayRight && playTileOnEnd('right')}
            className={endBadgeClass(canPlayRight)}
            style={{ left: rightBadgeX, top: rightBadgeY }}
          >
            {board.rightEnd}
          </button>
        )}
      </div>
    </div>
  )
}

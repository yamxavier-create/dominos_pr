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
    let rowMaxH = anchorH  // anchor is in row 0, count its height for wrap spacing

    for (let i = anchorIdx + 1; i < n; i++) {
      const { w: tileW, h: tileH } = tileSize(tiles[i])
      const isHorizontal = tiles[i].orientation === 'horizontal'
      let cx: number
      let isCorner = false

      if (dir === 1) {
        cx = x + tileW / 2
        if (cx + tileW / 2 + EDGE_PAD > half) {
          isCorner = true
          const effW = isHorizontal ? TILE_V_W : tileW
          const effH = isHorizontal ? TILE_V_H : tileH
          cx = Math.min(raw[i - 1].x, half - EDGE_PAD - effW / 2)
          y += rowMaxH / 2 + effH / 2 + GAP
          rowMaxH = effH
          dir = -1
          x = cx - effW / 2 - GAP
        } else {
          rowMaxH = Math.max(rowMaxH, tileH)
          x = cx + tileW / 2 + GAP
        }
      } else {
        cx = x - tileW / 2
        if (cx - tileW / 2 - EDGE_PAD < -half) {
          isCorner = true
          const effW = isHorizontal ? TILE_V_W : tileW
          const effH = isHorizontal ? TILE_V_H : tileH
          cx = Math.max(raw[i - 1].x, -half + EDGE_PAD + effW / 2)
          y += rowMaxH / 2 + effH / 2 + GAP
          rowMaxH = effH
          dir = 1
          x = cx + effW / 2 + GAP
        } else {
          rowMaxH = Math.max(rowMaxH, tileH)
          x = cx - tileW / 2 - GAP
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

    for (let i = anchorIdx - 1; i >= 0; i--) {
      const { w: tileW, h: tileH } = tileSize(tiles[i])
      const isHorizontal = tiles[i].orientation === 'horizontal'
      let cx: number
      let isCorner = false

      if (dir === -1) {
        cx = x - tileW / 2
        if (cx - tileW / 2 - EDGE_PAD < -half) {
          isCorner = true
          const effW = isHorizontal ? TILE_V_W : tileW
          const effH = isHorizontal ? TILE_V_H : tileH
          cx = Math.max(raw[i + 1].x, -half + EDGE_PAD + effW / 2)
          y -= rowMaxH / 2 + effH / 2 + GAP  // wrap UP
          rowMaxH = effH
          dir = 1
          x = cx + effW / 2 + GAP
        } else {
          rowMaxH = Math.max(rowMaxH, tileH)
          x = cx - tileW / 2 - GAP
        }
      } else {
        cx = x + tileW / 2
        if (cx + tileW / 2 + EDGE_PAD > half) {
          isCorner = true
          const effW = isHorizontal ? TILE_V_W : tileW
          const effH = isHorizontal ? TILE_V_H : tileH
          cx = Math.min(raw[i + 1].x, half - EDGE_PAD - effW / 2)
          y -= rowMaxH / 2 + effH / 2 + GAP  // wrap UP
          rowMaxH = effH
          dir = -1
          x = cx - effW / 2 - GAP
        } else {
          rowMaxH = Math.max(rowMaxH, tileH)
          x = cx + tileW / 2 + GAP
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
  const leftDisplaySize = tileDisplaySize(leftEnd, leftItem.corner)
  const leftBadgeOnRight = leftItem.flipped  // flipped = right-going row after corner turn
  const leftBadgeX = leftItem.corner
    ? leftItem.pos.x - 18  // center badge horizontally on vertical corner tile
    : leftBadgeOnRight
      ? Math.min(dims.w - 40, leftItem.pos.x + leftDisplaySize.w / 2 + 4)
      : Math.max(2, leftItem.pos.x - leftDisplaySize.w / 2 - 40)
  const leftBadgeY = leftItem.corner
    ? Math.max(18, leftItem.pos.y - leftDisplaySize.h / 2 - 22)
    : Math.max(18, Math.min(dims.h - 18, leftItem.pos.y))

  // Right end: exposed pip is rightPip. When flipped, displayed on LEFT physical side.
  const rightDisplaySize = tileDisplaySize(rightEnd, rightItem.corner)
  const rightBadgeOnLeft = rightItem.flipped
  const rightBadgeX = rightItem.corner
    ? rightItem.pos.x - 18  // center badge horizontally on vertical corner tile
    : rightBadgeOnLeft
      ? Math.max(2, rightItem.pos.x - rightDisplaySize.w / 2 - 40)
      : Math.min(dims.w - 40, rightItem.pos.x + rightDisplaySize.w / 2 + 4)
  const rightBadgeY = rightItem.corner
    ? Math.min(dims.h - 18, rightItem.pos.y + rightDisplaySize.h / 2 + 22)
    : Math.max(18, Math.min(dims.h - 18, rightItem.pos.y))

  return (
    <div ref={containerRef} className="w-full h-full overflow-hidden relative">
      {/* Tiles */}
      {board.tiles.map((bt, idx) => {
        const { pos, flipped, corner } = layout[idx]
        if (!pos) return null
        const { w, h } = tileDisplaySize(bt, corner)
        return (
          <div
            key={bt.tile.id}
            className="absolute"
            style={{ left: pos.x - w / 2, top: pos.y - h / 2, width: w, height: h }}
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
  )
}

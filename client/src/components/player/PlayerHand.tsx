import { useRef, useCallback, useState } from 'react'
import { Tile } from '../../types/game'
import { DominoTile } from '../domino/DominoTile'
import { useUIStore } from '../../store/uiStore'
import { useGameActions } from '../../hooks/useGameActions'
import { useGameStore } from '../../store/gameStore'
import { useRoomStore } from '../../store/roomStore'
import { socket } from '../../socket'

interface PlayerHandProps {
  tiles: Tile[]
  validPlayIds: Set<string>
  isMyTurn: boolean
  forcedFirstTileId: string | null
  compact?: boolean
}

const HAND_W = 34
const HAND_H = 68
const HAND_W_COMPACT = 26
const HAND_H_COMPACT = 52
const DRAG_THRESHOLD = 10
const DROP_RADIUS = 80 // px proximity to snap to an end tile
const MAX_PER_ROW = 7

interface DragState {
  tileId: string
  startX: number
  startY: number
  isDragging: boolean
  tileEl: HTMLElement | null
}

/** Get the screen-center of a board end tile element */
function getEndTileCenter(end: 'left' | 'right'): { x: number; y: number } | null {
  const el = document.querySelector(`[data-board-end="${end}"]`)
  if (!el) return null
  const r = el.getBoundingClientRect()
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 }
}

/** Detect which end the pointer is closest to (within DROP_RADIUS) */
function detectNearEnd(px: number, py: number): 'left' | 'right' | null {
  const leftC = getEndTileCenter('left')
  const rightC = getEndTileCenter('right')

  let bestEnd: 'left' | 'right' | null = null
  let bestDist = DROP_RADIUS

  if (leftC) {
    const d = Math.hypot(px - leftC.x, py - leftC.y)
    if (d < bestDist) { bestDist = d; bestEnd = 'left' }
  }
  if (rightC) {
    const d = Math.hypot(px - rightC.x, py - rightC.y)
    if (d < bestDist) { bestDist = d; bestEnd = 'right' }
  }

  // Also allow drop if pointer is over the board area generally
  if (!bestEnd) {
    const boardEl = document.querySelector('[data-board]')
    if (!boardEl) return null
    const r = boardEl.getBoundingClientRect()
    if (py < r.top - 20 || py > r.bottom + 20 || px < r.left - 20 || px > r.right + 20) return null
    // Over the board but not near an end — pick closest end
    const dL = leftC ? Math.hypot(px - leftC.x, py - leftC.y) : Infinity
    const dR = rightC ? Math.hypot(px - rightC.x, py - rightC.y) : Infinity
    if (dL < dR && dL < 200) return 'left'
    if (dR <= dL && dR < 200) return 'right'
  }

  return bestEnd
}

export function PlayerHand({ tiles, validPlayIds, isMyTurn, forcedFirstTileId, compact }: PlayerHandProps) {
  const handW = compact ? HAND_W_COMPACT : HAND_W
  const handH = compact ? HAND_H_COMPACT : HAND_H
  const selectedTileId = useUIStore(s => s.selectedTileId)
  const { selectTile } = useGameActions()

  const dragRef = useRef<DragState | null>(null)
  const [dragPos, setDragPos] = useState<{ x: number; y: number; tileId: string } | null>(null)
  const [nearEnd, setNearEnd] = useState<'left' | 'right' | null>(null)

  const getDragTile = useCallback((tileId: string) => {
    return tiles.find(t => t.id === tileId)
  }, [tiles])

  const onPointerDown = useCallback((e: React.PointerEvent, tileId: string) => {
    if (!isMyTurn || !validPlayIds.has(tileId)) return

    const tileEl = (e.target as HTMLElement).closest('[data-tile-id]') as HTMLElement | null
    dragRef.current = {
      tileId,
      startX: e.clientX,
      startY: e.clientY,
      isDragging: false,
      tileEl,
    }

    tileEl?.setPointerCapture(e.pointerId)
  }, [isMyTurn, validPlayIds])

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    const drag = dragRef.current
    if (!drag) return

    const dx = e.clientX - drag.startX
    const dy = e.clientY - drag.startY

    if (!drag.isDragging && Math.abs(dx) + Math.abs(dy) < DRAG_THRESHOLD) return

    drag.isDragging = true
    setDragPos({ x: e.clientX, y: e.clientY, tileId: drag.tileId })
    setNearEnd(detectNearEnd(e.clientX, e.clientY))
  }, [])

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    const drag = dragRef.current
    if (!drag) return

    const tileId = drag.tileId
    const wasDragging = drag.isDragging

    dragRef.current = null
    setDragPos(null)
    setNearEnd(null)
    drag.tileEl?.releasePointerCapture(e.pointerId)

    if (!wasDragging) {
      selectTile(tileId)
      return
    }

    const gs = useGameStore.getState().gameState
    const rc = useRoomStore.getState().roomCode
    if (!gs || !rc) return
    const playsForTile = gs.validPlays.filter(vp => vp.tileId === tileId)
    if (playsForTile.length === 0) return

    // Empty board — play immediately
    if (gs.board.tiles.length === 0) {
      socket.emit('game:play_tile', { roomCode: rc, tileId, targetEnd: 'right' })
      useUIStore.getState().setSelectedTile(null)
      return
    }

    const dropEnd = detectNearEnd(e.clientX, e.clientY)

    if (dropEnd && playsForTile.some(vp => vp.targetEnd === dropEnd)) {
      socket.emit('game:play_tile', { roomCode: rc, tileId, targetEnd: dropEnd })
      useUIStore.getState().setSelectedTile(null)
    } else if (playsForTile.length === 1 && dropEnd) {
      socket.emit('game:play_tile', { roomCode: rc, tileId, targetEnd: playsForTile[0].targetEnd })
      useUIStore.getState().setSelectedTile(null)
    }
  }, [selectTile])

  const dragTile = dragPos ? getDragTile(dragPos.tileId) : null

  // Split tiles into rows when there are too many for one row
  const needsMultiRow = tiles.length > MAX_PER_ROW
  const rows: Tile[][] = needsMultiRow
    ? [tiles.slice(0, Math.ceil(tiles.length / 2)), tiles.slice(Math.ceil(tiles.length / 2))]
    : [tiles]

  const renderTile = (tile: Tile) => {
    const isPlayable = isMyTurn && validPlayIds.has(tile.id)
    const isSelected = selectedTileId === tile.id
    const isForced = forcedFirstTileId === tile.id && isMyTurn
    const isBeingDragged = dragPos?.tileId === tile.id

    return (
      <div
        key={tile.id}
        data-tile-id={tile.id}
        className={`
          relative transition-transform duration-200 shrink-0 touch-none
          ${isPlayable ? 'cursor-grab hover:-translate-y-2' : 'opacity-60'}
          ${isSelected ? '-translate-y-3' : ''}
          ${isForced ? 'ring-2 ring-gold rounded' : ''}
          ${isBeingDragged ? 'opacity-30' : ''}
        `}
        onPointerDown={e => onPointerDown(e, tile.id)}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
      >
        <DominoTile
          pip1={tile.low}
          pip2={tile.high}
          orientation="vertical"
          isPlayable={isPlayable && !isSelected}
          isSelected={isSelected}
          style={{ width: handW, height: handH }}
        />
        {isForced && (
          <span className="absolute -top-1 -right-1 bg-gold text-bg text-xs font-bold rounded-full w-4 h-4 flex items-center justify-center">
            !
          </span>
        )}
      </div>
    )
  }

  return (
    <>
      <div className="w-full flex flex-col items-center gap-1 px-3 py-1">
        {rows.map((row, ri) => (
          <div key={ri} className="flex items-center justify-center gap-1.5">
            {row.map(renderTile)}
          </div>
        ))}
        {tiles.length === 0 && (
          <span className="text-white/30 font-body text-sm">Sin fichas</span>
        )}
      </div>

      {/* Drag ghost — follows finger */}
      {dragPos && dragTile && (
        <div
          className="drag-ghost fixed"
          style={{
            left: dragPos.x - handW / 2,
            top: dragPos.y - handH / 2 - 30,
            width: handW * 1.3,
            height: handH * 1.3,
          }}
        >
          <DominoTile
            pip1={dragTile.low}
            pip2={dragTile.high}
            orientation="vertical"
            style={{ width: handW * 1.3, height: handH * 1.3 }}
          />
        </div>
      )}

      {/* Glow indicators on actual end tiles */}
      {dragPos && <EndTileGlow nearEnd={nearEnd} />}
    </>
  )
}

/** Renders a glow highlight around the actual board end tiles */
function EndTileGlow({ nearEnd }: { nearEnd: 'left' | 'right' | null }) {
  const leftEl = document.querySelector('[data-board-end="left"]')
  const rightEl = document.querySelector('[data-board-end="right"]')

  return (
    <>
      {leftEl && <TileGlow el={leftEl} active={nearEnd === 'left'} label="IZQ" />}
      {rightEl && <TileGlow el={rightEl} active={nearEnd === 'right'} label="DER" />}
    </>
  )
}

function TileGlow({ el, active, label }: { el: Element; active: boolean; label: string }) {
  const r = el.getBoundingClientRect()
  const pad = 6

  return (
    <div
      className="fixed pointer-events-none rounded-lg transition-all duration-150"
      style={{
        left: r.left - pad,
        top: r.top - pad,
        width: r.width + pad * 2,
        height: r.height + pad * 2,
        border: active ? '2.5px solid rgba(34, 197, 94, 0.9)' : '2px dashed rgba(255,255,255,0.25)',
        backgroundColor: active ? 'rgba(34, 197, 94, 0.15)' : 'transparent',
        boxShadow: active ? '0 0 16px rgba(34, 197, 94, 0.5)' : 'none',
        zIndex: 45,
      }}
    >
      <span
        className="absolute -top-5 left-1/2 -translate-x-1/2 font-body font-bold text-xs whitespace-nowrap transition-opacity duration-150"
        style={{
          color: active ? '#22C55E' : 'rgba(255,255,255,0.4)',
          opacity: active ? 1 : 0.6,
        }}
      >
        {label}
      </span>
    </div>
  )
}

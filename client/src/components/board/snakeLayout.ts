import type { BoardTile as BoardTileType } from '../../types/game'

// Board tile dimensions (CSS pixels)
export const TILE_H_W = 80   // horizontal tile width (1:1 with SVG viewBox)
export const TILE_H_H = 40   // horizontal tile height
export const TILE_V_W = 40   // vertical tile width
export const TILE_V_H = 80   // vertical tile height

const GAP = 1
// Snake widths tried for each board: from 3 tiles per row up to a single long line
export const SNAKE_WIDTHS = Array.from({ length: 24 }, (_, i) => 240 + i * 80)
// The snake width is fixed per board size, so the snake bends where it will
// bend for the rest of the hand instead of starting as a straight line and
// reflowing once it gets too long. It's the width that draws a full hand biggest:
// 24 tiles played to both ends with a few doubles. That runs the rows across
// the whole board from the first tiles.
const REFERENCE_SIDES = 'RLRLRRLLRLRLRRLLRLRLRLRL'
const REFERENCE_DOUBLES = [0, 5, 11]
export const REFERENCE_HAND: BoardTileType[] = (() => {
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
export const EDGE_INSET = 14 // the felt's brass lip plus breathing room

export interface TilePos { x: number; y: number }
/** How a tile is drawn: lying along the row ('h') or standing across it ('v') */
export type Display = 'h' | 'v'
export interface LayoutItem { pos: TilePos; flipped: boolean; display: Display }

export function displaySize(d: Display) {
  return d === 'v'
    ? { w: TILE_V_W, h: TILE_V_H }
    : { w: TILE_H_W, h: TILE_H_H }
}

/** In a row a double stands across the line; every other tile lies along it */
function rowDisplay(bt: BoardTileType): Display {
  return bt.orientation === 'vertical' ? 'v' : 'h'
}

/**
 * Lay out one arm of the snake from the tile next to the anchor outward.
 *
 * A double always lies across the line: standing in a row, lying flat in the
 * column that joins two rows. The column is a pair of tiles. A double never
 * starts the column: it ends the row standing and the column starts straight
 * off it. A double that follows the
 * column stays on it, lying flat, and the next row starts from its side, so it
 * never sits beside the last upright tile.
 *
 * `step` walks the array (+1 right arm, -1 left arm) and `vSign` is the way the
 * arm wraps (+1 down, -1 up), so the arms never run into each other.
 */
function layoutArm(
  tiles: BoardTileType[], anchorIdx: number, step: 1 | -1, vSign: 1 | -1, half: number,
  raw: TilePos[], flipped: boolean[], displays: Display[],
) {
  const EDGE_PAD = 6
  const startDir = step
  const anchor = displaySize(displays[anchorIdx])
  let x = step * (anchor.w / 2 + GAP)  // cursor at the anchor's edge
  let y = 0
  let dir: 1 | -1 = startDir
  let tilesInRow = 0  // the anchor doesn't count: a row needs 2 tiles before it can turn
  let phase: 'row' | 'column' | 'rowStart' = 'row'

  for (let i = anchorIdx + step; i >= 0 && i < tiles.length; i += step) {
    const isDouble = tiles[i].orientation === 'vertical'
    const prevPos = raw[i - step]
    const prevSize = displaySize(displays[i - step])

    if (phase === 'column') {
      // 2nd tile of the column, flush against the 1st
      const d: Display = isDouble ? 'h' : 'v'
      const { w, h } = displaySize(d)
      const cy = prevPos.y + vSign * (prevSize.h / 2 + h / 2)
      raw[i] = { x: prevPos.x, y: cy }
      displays[i] = d
      flipped[i] = false
      // The new row lines up with the pip that faces away from the 1st column tile
      y = cy + vSign * (h - TILE_H_H) / 2
      x = prevPos.x + dir * (w / 2 + GAP)
      tilesInRow = 0
      phase = d === 'v' ? 'rowStart' : 'row'
      continue
    }

    if (phase === 'rowStart') {
      phase = 'row'
      if (isDouble) {
        // A double right after an upright column tile stays on the column, lying flat
        const { w, h } = displaySize('h')
        const cy = prevPos.y + vSign * (prevSize.h / 2 + h / 2)
        raw[i] = { x: prevPos.x, y: cy }
        displays[i] = 'h'
        flipped[i] = false
        y = cy
        x = prevPos.x + dir * (w / 2 + GAP)
        tilesInRow = 1
        continue
      }
    }

    const rd = rowDisplay(tiles[i])
    const { w: tileW } = displaySize(rd)
    let cx = x + dir * (tileW / 2)
    const pastEdge = dir === 1
      ? cx + tileW / 2 + EDGE_PAD > half
      : cx - tileW / 2 - EDGE_PAD < -half
    // A double never turns the corner: it ends the row standing (it's narrow),
    // and the next tile starts the column straight off it
    const turns = pastEdge && tilesInRow >= 2 && !(isDouble && displays[i - step] === 'h')
    if (turns) {
      // 1st tile of the column
      if (displays[i - step] === 'v') {
        // The row ended on a double: the column starts straight off it
        const d: Display = isDouble ? 'h' : 'v'
        const { h } = displaySize(d)
        raw[i] = { x: prevPos.x, y: prevPos.y + vSign * (prevSize.h / 2 + h / 2) }
        displays[i] = d
      } else {
        // Upright at the row's end, its near pip on the row
        cx = prevPos.x + dir * (prevSize.w / 2 + TILE_V_W / 2)
        raw[i] = { x: cx, y: y + vSign * (TILE_V_H - TILE_H_H) / 2 }
        displays[i] = 'v'
      }
      flipped[i] = false
      dir = dir === 1 ? -1 : 1
      phase = 'column'
      continue
    }

    raw[i] = { x: cx, y }
    displays[i] = rd
    // Rows running back toward the anchor show the connecting pip on the near side
    flipped[i] = dir !== startDir
    x = cx + dir * (tileW / 2 + GAP)
    tilesInRow++
  }
}

/**
 * Snake layout around the first-played tile (lowest sequence) at the origin.
 *
 * The right arm (tiles added to right end) extends rightward from the anchor
 * and wraps downward; the left arm extends leftward and wraps upward. Each arm
 * wraps independently at ±snakeW/2 from the anchor, so adding tiles to one
 * side never shifts tiles on the other side.
 */
export function computeSnakeLayout(tiles: BoardTileType[], snakeW: number): LayoutItem[] {
  const n = tiles.length
  if (n === 0) return []
  const half = snakeW / 2  // each arm gets ±half from anchor

  // Anchor: first-played tile = lowest sequence number
  let anchorIdx = 0
  for (let i = 1; i < n; i++) {
    if (tiles[i].sequence < tiles[anchorIdx].sequence) anchorIdx = i
  }

  const raw: TilePos[] = new Array(n)
  const flipped: boolean[] = new Array(n).fill(false)
  const displays: Display[] = new Array(n).fill('h')
  raw[anchorIdx] = { x: 0, y: 0 }
  displays[anchorIdx] = rowDisplay(tiles[anchorIdx])

  layoutArm(tiles, anchorIdx, 1, 1, half, raw, flipped, displays)
  layoutArm(tiles, anchorIdx, -1, -1, half, raw, flipped, displays)

  return raw.map((p, i) => ({ pos: p, flipped: flipped[i], display: displays[i] }))
}

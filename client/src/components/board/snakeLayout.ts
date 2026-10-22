import type { BoardTile as BoardTileType } from '../../types/game'

// Board tile dimensions (CSS pixels)
export const TILE_H_W = 80   // horizontal tile width (1:1 with SVG viewBox)
export const TILE_H_H = 40   // horizontal tile height
export const TILE_V_W = 40   // vertical tile width
export const TILE_V_H = 80   // vertical tile height

const GAP = 1
export const EDGE_INSET = 10 // the felt's brass lip plus breathing room

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
 * A double always lies across the line, and the line goes on through it:
 * standing in a row with the next tile beside it, lying flat on the column
 * with the next tile upright under it. The column joining two rows is an
 * upright pair; a flat double on it adds one more upright before the row
 * starts, so a double never ends up in line with the tile that follows. A
 * double never turns the corner: it ends the row standing and the column
 * starts straight off it.
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
  // 'column': the next tile goes on the column. 'rowStart': the first tile of a
  // new row, which a double turns back into a column tile.
  let phase: 'row' | 'column' | 'rowStart' = 'row'
  let afterFlat = false  // the last column tile is a flat double: the next one stands

  /** Puts the tile on the column, flush against the previous one */
  const onColumn = (i: number, d: Display) => {
    const prevPos = raw[i - step]
    const { h } = displaySize(d)
    raw[i] = { x: prevPos.x, y: prevPos.y + vSign * (displaySize(displays[i - step]).h / 2 + h / 2) }
    displays[i] = d
    flipped[i] = false
  }

  for (let i = anchorIdx + step; i >= 0 && i < tiles.length; i += step) {
    const isDouble = tiles[i].orientation === 'vertical'
    const prevPos = raw[i - step]
    const prevSize = displaySize(displays[i - step])

    if (phase === 'column') {
      if (isDouble && !afterFlat) {
        onColumn(i, 'h')
        afterFlat = true
        continue
      }
      // Upright, or a double standing after a flat one; the row starts from its far pip
      onColumn(i, 'v')
      afterFlat = false
      y = raw[i].y + vSign * (TILE_V_H - TILE_H_H) / 2
      x = raw[i].x + dir * (TILE_V_W / 2 + GAP)
      tilesInRow = 0
      phase = isDouble ? 'row' : 'rowStart'
      continue
    }

    if (phase === 'rowStart') {
      phase = 'row'
      if (isDouble) {
        // A double right after the column lies flat on it; one more upright follows
        onColumn(i, 'h')
        afterFlat = true
        phase = 'column'
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
        onColumn(i, isDouble ? 'h' : 'v')
        afterFlat = isDouble
      } else {
        // Upright at the row's end, its near pip on the row
        cx = prevPos.x + dir * (prevSize.w / 2 + TILE_V_W / 2)
        raw[i] = { x: cx, y: y + vSign * (TILE_V_H - TILE_H_H) / 2 }
        displays[i] = 'v'
        flipped[i] = false
        afterFlat = false
      }
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

/** From one row's center line to the next: the row, plus the two uprights of the column */
const ROW_PITCH = TILE_V_H + TILE_H_H

/** A hand to size the board for: which side each play went to and which plays were doubles */
function referenceHand(sides: string, doubles: number[]): BoardTileType[] {
  let tiles: BoardTileType[] = []
  for (let k = 0; k < sides.length; k++) {
    const bt: BoardTileType = {
      tile: { id: `ref-${k}`, high: 0, low: 0, isDouble: doubles.includes(k) },
      orientation: doubles.includes(k) ? 'vertical' : 'horizontal',
      leftPip: 0,
      rightPip: 0,
      playedByIndex: 0,
      sequence: k,
    }
    tiles = sides[k] === 'L' ? [bt, ...tiles] : [...tiles, bt]
  }
  return tiles
}

/**
 * The hands the board must hold without shrinking: 24 tiles played evenly to
 * both ends, and 24 played mostly to one end, each with a few doubles. One of
 * the doubles lands on a column and lies flat there.
 */
const REFERENCE_HANDS: BoardTileType[][] = [
  referenceHand('RLRLRRLLRLRLRRLLRLRLRLRL', [0, 5, 11]),
  referenceHand('RRLRRRLRRRLRRRLRRLRRRLRR', [0, 4, 9, 15]),
  referenceHand('LLRLLLRLLLRLLLRLLRLLLRLL', [0, 4, 9, 15]),
]

/** How far the snake reaches from its first tile: sideways to either side, up and down */
export function snakeExtents(tiles: BoardTileType[], layout: LayoutItem[]) {
  let halfW = 0, minY = Infinity, maxY = -Infinity
  tiles.forEach((_bt, idx) => {
    const item = layout[idx]
    if (!item) return
    const { w, h } = displaySize(item.display)
    halfW = Math.max(halfW, Math.abs(item.pos.x) + w / 2)
    minY = Math.min(minY, item.pos.y - h / 2)
    maxY = Math.max(maxY, item.pos.y + h / 2)
  })
  return { halfW, minY, maxY }
}

export interface BoardFit {
  /** Tile size on this board, 1 = full size */
  scale: number
  /** Width the rows run across, in layout units */
  snakeW: number
}

/**
 * Tile size and snake width for a board. Tiles keep one size for the whole
 * hand, so the board is sized for whole rows: the fewest rows whose tiles,
 * drawn as big as those rows allow, still hold the reference hands. A wide
 * table gets three long rows; a phone held upright gets five short ones.
 */
export function boardFit(boardW: number, boardH: number): BoardFit {
  const innerW = boardW - 2 * EDGE_INSET
  const innerH = boardH - 2 * EDGE_INSET
  let fallback: BoardFit | null = null
  for (let rows = 3; rows <= 7; rows++) {
    const byHeight = innerH / (TILE_H_H + (rows - 1) * ROW_PITCH)
    // A row holds at least three tiles between its two uprights
    const byWidth = innerW / (3 * TILE_H_W + 2 * TILE_V_W)
    const scale = Math.min(1, byHeight, byWidth)
    const snakeW = Math.max(3 * TILE_H_W, Math.floor((innerW / scale - 2 * TILE_V_W) / TILE_H_W) * TILE_H_W)
    const fit = { scale, snakeW }
    fallback ??= fit
    const holdsAll = REFERENCE_HANDS.every(hand => {
      const { halfW, minY, maxY } = snakeExtents(hand, computeSnakeLayout(hand, snakeW))
      return halfW * scale <= innerW / 2 + 0.5 && (maxY - minY) * scale <= innerH + 0.5
    })
    if (holdsAll) return fit
    fallback = fit
  }
  return fallback!
}

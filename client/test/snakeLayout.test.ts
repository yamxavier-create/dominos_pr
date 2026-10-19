/**
 * Snake layout on the table: doubles always lie across the line. Standing in a
 * row, flat on the column between rows, and never beside the last upright tile.
 */
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { computeSnakeLayout, displaySize, LayoutItem } from '../src/components/board/snakeLayout'
import type { BoardTile } from '../src/types/game'

const SNAKE_W = 480  // ±240 around the anchor: three 80px tiles per row, then it turns

/** Builds a board from the side each play went to and which plays were doubles */
function board(sides: string, doubles: number[]): BoardTile[] {
  let tiles: BoardTile[] = []
  for (let k = 0; k < sides.length; k++) {
    const isDouble = doubles.includes(k)
    const bt: BoardTile = {
      tile: { id: `t${k}`, high: 0, low: 0, isDouble },
      orientation: isDouble ? 'vertical' : 'horizontal',
      leftPip: 0, rightPip: 0, playedByIndex: 0, sequence: k,
    }
    tiles = sides[k] === 'L' ? [bt, ...tiles] : [...tiles, bt]
  }
  return tiles
}

function bySequence(tiles: BoardTile[], layout: LayoutItem[]) {
  const map = new Map<number, LayoutItem>()
  tiles.forEach((t, i) => map.set(t.sequence, layout[i]))
  return (seq: number) => map.get(seq)!
}

function rect(item: LayoutItem) {
  const { w, h } = displaySize(item.display)
  return { l: item.pos.x - w / 2, r: item.pos.x + w / 2, t: item.pos.y - h / 2, b: item.pos.y + h / 2 }
}

function assertNoOverlap(tiles: BoardTile[], layout: LayoutItem[]) {
  for (let i = 0; i < layout.length; i++) {
    for (let j = i + 1; j < layout.length; j++) {
      const a = rect(layout[i]), b = rect(layout[j])
      const overlap = a.l < b.r - 0.01 && b.l < a.r - 0.01 && a.t < b.b - 0.01 && b.t < a.b - 0.01
      assert.ok(!overlap, `tiles ${tiles[i].sequence} and ${tiles[j].sequence} overlap`)
    }
  }
}

describe('snake layout doubles', () => {
  test('a double in a row stands across it', () => {
    const tiles = board('RRR', [2])
    const at = bySequence(tiles, computeSnakeLayout(tiles, SNAKE_W))
    assert.equal(at(2).display, 'v')
    assert.equal(at(1).display, 'h')
  })

  test('a double as the 2nd tile of the column lies flat on it, on both arms', () => {
    // Right arm turns down at play 3; left arm turns up at play 10
    const tiles = board('RRRRRRRRLLLLLLLL', [4, 11])
    const layout = computeSnakeLayout(tiles, SNAKE_W)
    const at = bySequence(tiles, layout)
    for (const [first, dbl, next] of [[3, 4, 5], [10, 11, 12]]) {
      assert.equal(at(first).display, 'v')
      assert.equal(at(dbl).display, 'h', `play ${dbl} lies flat`)
      assert.equal(at(dbl).pos.x, at(first).pos.x, `play ${dbl} stays on the column`)
      // The next row starts beside the flat double, at its height
      assert.equal(at(next).pos.y, at(dbl).pos.y)
    }
    assertNoOverlap(tiles, layout)
  })

  test('a double right after the column stays on it instead of beside the upright tile', () => {
    const tiles = board('RRRRRRRRLLLLLLLL', [5, 12])
    const layout = computeSnakeLayout(tiles, SNAKE_W)
    const at = bySequence(tiles, layout)
    for (const [second, dbl, next] of [[4, 5, 6], [11, 12, 13]]) {
      assert.equal(at(dbl).display, 'h', `play ${dbl} lies flat`)
      assert.equal(at(dbl).pos.x, at(second).pos.x, `play ${dbl} stays on the column`)
      assert.equal(at(next).pos.y, at(dbl).pos.y, `play ${next} starts the row from its side`)
      assert.equal(at(next).display, 'h')
    }
    assertNoOverlap(tiles, layout)
  })

  test('when the row ends on a double the column starts straight off it', () => {
    // Three standing doubles fill the row to the edge; the next one has to turn
    const tiles = board('RRRRRRRRLLLLLLLL', [2, 3, 4, 9, 10, 11])
    const layout = computeSnakeLayout(tiles, SNAKE_W)
    const at = bySequence(tiles, layout)
    assert.equal(at(3).display, 'v')
    assert.equal(at(4).display, 'h', 'a double as 1st column tile lies flat')
    assert.equal(at(4).pos.x, at(3).pos.x)
    assert.ok(at(4).pos.y > at(3).pos.y, 'right arm wraps down')
    assert.equal(at(10).display, 'v')
    assert.equal(at(11).display, 'h')
    assert.equal(at(11).pos.x, at(10).pos.x)
    assert.ok(at(11).pos.y < at(10).pos.y, 'left arm wraps up')
    assertNoOverlap(tiles, layout)
  })

  test('a double never turns the corner: it ends the row and the column starts off it', () => {
    // Play 3 would turn; as a double it stays standing on the row and play 4 turns
    const tiles = board('RRRRRRRRLLLLLLLL', [3, 10])
    const layout = computeSnakeLayout(tiles, SNAKE_W)
    const at = bySequence(tiles, layout)
    for (const [prev, dbl, next] of [[2, 3, 4], [9, 10, 11]]) {
      assert.equal(at(dbl).display, 'v')
      assert.equal(at(dbl).pos.y, at(prev).pos.y, `play ${dbl} stays on the row`)
      assert.equal(at(next).display, 'v')
      assert.equal(at(next).pos.x, at(dbl).pos.x, `play ${next} goes straight off the double`)
    }
    assertNoOverlap(tiles, layout)
  })

  test('a full hand with doubles everywhere never overlaps', () => {
    const tiles = board('RLRLRRLLRLRLRRLLRLRLRLRLRLRL', [0, 3, 4, 5, 6, 11, 12, 13, 20, 21])
    assertNoOverlap(tiles, computeSnakeLayout(tiles, SNAKE_W))
  })
})

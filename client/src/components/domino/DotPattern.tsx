interface DotPatternProps {
  count: number   // 0–6
  xMin: number    // left edge of the half-tile face
  yMin: number    // top edge
  xMax: number    // right edge
  yMax: number    // bottom edge
}

// Pips sit on a 3×3 grid (cells 0–8, row by row), as on a real tile
const GRID_CELLS: Record<number, number[]> = {
  0: [],
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
}

// Face padding and pip size, as fractions of the face (36px face: 5px pad, 6px pip)
const PAD = 5 / 36
const PIP = 6 / 36

export function DotPattern({ count, xMin, yMin, xMax, yMax }: DotPatternProps) {
  const cells = GRID_CELLS[count] ?? []
  const w = xMax - xMin
  const h = yMax - yMin
  const size = Math.min(w, h)
  const cellW = (w - 2 * PAD * size) / 3
  const cellH = (h - 2 * PAD * size) / 3
  const r = (PIP * size) / 2

  return (
    <>
      {cells.map(cell => (
        <circle
          key={cell}
          cx={xMin + PAD * size + (cell % 3 + 0.5) * cellW}
          cy={yMin + PAD * size + (Math.floor(cell / 3) + 0.5) * cellH}
          r={r}
          fill="#1C1410"
        />
      ))}
    </>
  )
}

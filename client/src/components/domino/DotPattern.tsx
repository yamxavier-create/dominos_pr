interface DotPatternProps {
  count: number   // 0–6
  xMin: number    // left edge of the half-tile area
  yMin: number    // top edge
  xMax: number    // right edge
  yMax: number    // bottom edge
}

// Fractional positions [fx, fy] for each pip count
const DOT_POSITIONS: Record<number, Array<[number, number]>> = {
  0: [],
  1: [[0.5, 0.5]],
  2: [[0.25, 0.25], [0.75, 0.75]],
  3: [[0.25, 0.25], [0.5, 0.5], [0.75, 0.75]],
  4: [[0.25, 0.25], [0.75, 0.25], [0.25, 0.75], [0.75, 0.75]],
  5: [[0.25, 0.25], [0.75, 0.25], [0.5, 0.5], [0.25, 0.75], [0.75, 0.75]],
  6: [[0.25, 0.2], [0.25, 0.5], [0.25, 0.8], [0.75, 0.2], [0.75, 0.5], [0.75, 0.8]],
}

export function DotPattern({ count, xMin, yMin, xMax, yMax }: DotPatternProps) {
  const positions = DOT_POSITIONS[count] ?? []
  const w = xMax - xMin
  const h = yMax - yMin
  const r = Math.min(w, h) * 0.11

  return (
    <>
      {positions.map(([fx, fy], i) => (
        <circle
          key={i}
          cx={xMin + fx * w}
          cy={yMin + fy * h}
          r={r}
          fill="#1a1a2e"
        />
      ))}
    </>
  )
}

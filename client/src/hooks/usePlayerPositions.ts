// Player seat layout for 4-player game
// CW order: bottom → right → top → left (play goes clockwise)
// Player 0: bottom (me)
// Player 1: right
// Player 2: top (partner)
// Player 3: left

export type Position = 'bottom' | 'left' | 'top' | 'right'

/**
 * Returns a map of playerIndex → visual Position,
 * oriented relative to the local player (myIndex at bottom).
 */
export function usePlayerPositions(myIndex: number): Map<number, Position> {
  const map = new Map<number, Position>()
  const n = 4

  map.set(myIndex, 'bottom')
  map.set((myIndex + 1) % n, 'right')
  map.set((myIndex + 2) % n, 'top')
  map.set((myIndex + 3) % n, 'left')

  return map
}

export function getPosition(playerIndex: number, myIndex: number): Position {
  const offset = ((playerIndex - myIndex) + 4) % 4
  const positions: Position[] = ['bottom', 'right', 'top', 'left']
  return positions[offset]
}

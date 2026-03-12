// Player seat layout for 2-player and 4-player games
// 4-player CW order: bottom -> right -> top -> left (play goes clockwise)
// 2-player: bottom (me) -> top (opponent)

export type Position = 'bottom' | 'left' | 'top' | 'right'

/**
 * Returns a map of playerIndex -> visual Position,
 * oriented relative to the local player (myIndex at bottom).
 */
export function usePlayerPositions(myIndex: number, playerCount: number = 4): Map<number, Position> {
  const map = new Map<number, Position>()

  if (playerCount === 2) {
    map.set(myIndex, 'bottom')
    map.set((myIndex + 1) % 2, 'top')
  } else {
    map.set(myIndex, 'bottom')
    map.set((myIndex + 1) % 4, 'right')
    map.set((myIndex + 2) % 4, 'top')
    map.set((myIndex + 3) % 4, 'left')
  }

  return map
}

export function getPosition(playerIndex: number, myIndex: number, playerCount: number = 4): Position {
  if (playerCount === 2) {
    const offset = ((playerIndex - myIndex) + 2) % 2
    const positions: Position[] = ['bottom', 'top']
    return positions[offset]
  }
  const offset = ((playerIndex - myIndex) + 4) % 4
  const positions: Position[] = ['bottom', 'right', 'top', 'left']
  return positions[offset]
}

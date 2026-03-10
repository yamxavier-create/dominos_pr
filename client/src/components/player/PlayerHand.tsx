import { Tile } from '../../types/game'
import { DominoTile } from '../domino/DominoTile'
import { useUIStore } from '../../store/uiStore'
import { useGameActions } from '../../hooks/useGameActions'

interface PlayerHandProps {
  tiles: Tile[]
  validPlayIds: Set<string>
  isMyTurn: boolean
  forcedFirstTileId: string | null
}

// Hand tile dimensions
const HAND_W = 34
const HAND_H = 68

export function PlayerHand({ tiles, validPlayIds, isMyTurn, forcedFirstTileId }: PlayerHandProps) {
  const selectedTileId = useUIStore(s => s.selectedTileId)
  const { selectTile } = useGameActions()

  return (
    <div className="flex items-center justify-center gap-1.5 px-3 py-2 overflow-x-auto"
      style={{ scrollbarWidth: 'none' }}>
      {tiles.map(tile => {
        const isPlayable = isMyTurn && validPlayIds.has(tile.id)
        const isSelected = selectedTileId === tile.id
        const isForced = forcedFirstTileId === tile.id && isMyTurn

        return (
          <div
            key={tile.id}
            className={`
              relative transition-transform duration-200 shrink-0
              ${isPlayable ? 'cursor-pointer hover:-translate-y-2' : 'opacity-60'}
              ${isSelected ? '-translate-y-3' : ''}
              ${isForced ? 'ring-2 ring-gold rounded' : ''}
            `}
            onClick={() => isPlayable && selectTile(tile.id)}
          >
            <DominoTile
              pip1={tile.low}
              pip2={tile.high}
              orientation="vertical"
              isPlayable={isPlayable && !isSelected}
              isSelected={isSelected}
              style={{ width: HAND_W, height: HAND_H }}
            />
            {/* Forced first tile badge */}
            {isForced && (
              <span className="absolute -top-1 -right-1 bg-gold text-bg text-xs font-bold rounded-full w-4 h-4 flex items-center justify-center">
                !
              </span>
            )}
          </div>
        )
      })}
      {tiles.length === 0 && (
        <span className="text-white/30 font-body text-sm">Sin fichas</span>
      )}
    </div>
  )
}

import { ClientPlayer } from '../../types/game'

interface PlayerSeatProps {
  player: ClientPlayer
  isCurrentTurn: boolean
  position: 'bottom' | 'top' | 'left' | 'right'
  teamLabel: string
  teamColor: string
}

export function PlayerSeat({ player, isCurrentTurn, position, teamLabel, teamColor }: PlayerSeatProps) {
  const isVertical = position === 'left' || position === 'right'
  const initials = player.name.slice(0, 2).toUpperCase()

  return (
    <div
      className={`
        flex items-center gap-1.5 px-2 py-1 rounded-xl
        bg-black/30 backdrop-blur-sm
        ${isVertical ? 'flex-col text-center' : 'flex-row'}
        transition-all duration-300
      `}
    >
      {/* Avatar circle with tile-count badge */}
      <div className="relative shrink-0">
        <div
          className={`
            flex items-center justify-center w-8 h-8 rounded-full font-header text-sm
            ${isCurrentTurn ? 'neon-glow' : ''}
          `}
          style={{
            background: isCurrentTurn
              ? `radial-gradient(circle, ${teamColor}55 0%, ${teamColor}22 100%)`
              : 'rgba(255,255,255,0.07)',
            border: `2px solid ${isCurrentTurn ? teamColor : 'rgba(255,255,255,0.15)'}`,
            color: isCurrentTurn ? teamColor : 'rgba(255,255,255,0.6)',
          }}
        >
          {initials}
        </div>
        {/* Tile count badge */}
        <span
          className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center font-bold font-body bg-surface border border-white/20"
          style={{ color: teamColor, fontSize: 9 }}
        >
          {player.tileCount}
        </span>
      </div>

      {/* Player info */}
      <div>
        <p className={`font-body font-bold text-white leading-tight truncate ${isVertical ? 'text-xs max-w-14' : 'text-xs max-w-20'}`}>
          {player.name}
        </p>
        <p className="font-body leading-tight text-xs" style={{ color: teamColor, opacity: 0.7 }}>
          {teamLabel}
        </p>
      </div>

      {/* Disconnected indicator */}
      {!player.connected && (
        <span className="text-accent text-xs">⚡</span>
      )}
    </div>
  )
}

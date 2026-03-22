import { ClientPlayer } from '../../types/game'
import { AvatarVideo } from './AvatarVideo'
import { CallControls } from './CallControls'
import { useCallStore } from '../../store/callStore'

interface PlayerSeatProps {
  player: ClientPlayer
  isCurrentTurn: boolean
  position: 'bottom' | 'top' | 'left' | 'right'
  teamLabel: string
  teamColor: string
  stream?: MediaStream | null
  isSpeaking?: boolean
  isCameraOff?: boolean
  isLocalPlayer?: boolean
}

export function PlayerSeat({
  player,
  isCurrentTurn,
  position,
  teamLabel,
  teamColor,
  stream,
  isSpeaking,
  isCameraOff,
  isLocalPlayer,
}: PlayerSeatProps) {
  const isVertical = position === 'left' || position === 'right'
  const avatarSize = isVertical ? 48 : 80
  const initials = player.name.slice(0, 2).toUpperCase()

  // Only subscribe to call state for the local player to avoid unnecessary re-renders
  const inCall = useCallStore(s =>
    isLocalPlayer ? (s.myAudioEnabled || s.myVideoEnabled) : false
  )

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
        <AvatarVideo
          stream={stream ?? null}
          initials={initials}
          teamColor={teamColor}
          isCurrentTurn={isCurrentTurn}
          isSpeaking={isSpeaking ?? false}
          isCameraOff={isCameraOff ?? true}
          size={avatarSize}
        />
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
        <span className="text-accent text-xs">{'\u26A1'}</span>
      )}

      {/* Inline call controls for local player */}
      {isLocalPlayer && inCall && (
        <CallControls className="mt-1" />
      )}
    </div>
  )
}

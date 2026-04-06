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
  compact?: boolean
}

function AvatarWithBadge({ player, initials, teamColor, isCurrentTurn, stream, isSpeaking, isCameraOff, size }: {
  player: ClientPlayer; initials: string; teamColor: string; isCurrentTurn: boolean
  stream: MediaStream | null; isSpeaking: boolean; isCameraOff: boolean; size: number
}) {
  return (
    <div className="relative shrink-0">
      <AvatarVideo
        stream={stream}
        initials={initials}
        teamColor={teamColor}
        isCurrentTurn={isCurrentTurn}
        isSpeaking={isSpeaking}
        isCameraOff={isCameraOff}
        size={size}
      />
      <span
        className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center font-bold font-body bg-surface border border-gold/20 shadow-sm"
        style={{ color: teamColor, fontSize: 9 }}
      >
        {player.tileCount}
      </span>
    </div>
  )
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
  compact,
}: PlayerSeatProps) {
  const isSide = position === 'left' || position === 'right'
  const avatarSize = isSide ? 56 : compact ? 48 : 80
  const initials = player.name.slice(0, 2).toUpperCase()

  const inCall = useCallStore(s =>
    isLocalPlayer ? (s.myAudioEnabled || s.myVideoEnabled) : false
  )

  const avatarProps = {
    player,
    initials,
    teamColor,
    isCurrentTurn,
    stream: stream ?? null,
    isSpeaking: isSpeaking ?? false,
    isCameraOff: isCameraOff ?? true,
    size: avatarSize,
  }

  // Side positions: compact vertical layout
  if (isSide) {
    return (
      <div className="flex flex-col items-center py-0.5">
        <AvatarWithBadge {...avatarProps} />
        <p className="font-body font-bold text-white text-[10px] leading-tight truncate max-w-[44px] mt-0.5 text-center">
          {player.name}
        </p>
        {!player.connected && (
          <span className="text-accent text-[10px]">{'\u26A1'}</span>
        )}
      </div>
    )
  }

  // Compact (landscape): inline horizontal layout
  if (compact) {
    return (
      <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-lg game-glass-card transition-all duration-300">
        <AvatarWithBadge {...avatarProps} />
        <p className="font-body font-bold text-white text-[10px] leading-tight truncate max-w-16">
          {player.name}
        </p>
        {!player.connected && (
          <span className="text-accent text-[10px]">{'\u26A1'}</span>
        )}
        {isLocalPlayer && inCall && (
          <CallControls className="ml-1" />
        )}
      </div>
    )
  }

  // Default (portrait top/bottom): full layout
  return (
    <div className="flex items-center gap-1.5 px-2 py-1 rounded-xl game-glass-card flex-row transition-all duration-300">
      <AvatarWithBadge {...avatarProps} />
      <div>
        <p className="font-body font-bold text-white leading-tight truncate text-xs max-w-20">
          {player.name}
        </p>
        <p className="font-body leading-tight text-xs" style={{ color: teamColor, opacity: 0.7 }}>
          {teamLabel}
        </p>
      </div>
      {!player.connected && (
        <span className="text-accent text-xs">{'\u26A1'}</span>
      )}
      {isLocalPlayer && inCall && (
        <CallControls className="mt-1" />
      )}
    </div>
  )
}

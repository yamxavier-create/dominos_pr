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
  large?: boolean  // desktop: room for bigger camera tiles
}

function AvatarWithBadge({ player, initials, teamColor, isCurrentTurn, stream, isSpeaking, isCameraOff, size, badgeSide }: {
  player: ClientPlayer; initials: string; teamColor: string; isCurrentTurn: boolean
  stream: MediaStream | null; isSpeaking: boolean; isCameraOff: boolean; size: number
  badgeSide: 'left' | 'right'
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
      <TileCountBadge count={player.tileCount} teamColor={teamColor} avatarSize={size} side={badgeSide} />
    </div>
  )
}

/** Tiles left in hand: a small cream sign with a tile glyph + number, sized to the avatar */
function TileCountBadge({ count, avatarSize, side }: { count: number; teamColor: string; avatarSize: number; side: 'left' | 'right' }) {
  const h = Math.max(20, Math.round(avatarSize * 0.26))
  const font = Math.round(h * 0.62)
  const glyphH = Math.round(h * 0.55)
  return (
    <div
      className="absolute flex items-center gap-[3px] font-club font-bold leading-none bg-club-cream text-club-ink"
      style={{
        [side]: -Math.round(h * 0.25),
        bottom: -Math.round(h * 0.15),
        height: h,
        paddingLeft: Math.round(h * 0.28),
        paddingRight: Math.round(h * 0.32),
        fontSize: font,
        borderRadius: 4,
        border: '1.5px solid #5A351E',
        boxShadow: '0 2px 0 #07160E',
      }}
      aria-label={`${count} fichas`}
    >
      <svg viewBox="0 0 10 18" style={{ height: glyphH, width: 'auto' }} aria-hidden>
        <rect x="0.75" y="0.75" width="8.5" height="16.5" rx="1.8" fill="none" stroke="#2B1B12" strokeWidth="1.5" />
        <line x1="2.5" y1="9" x2="7.5" y2="9" stroke="#2B1B12" strokeWidth="1.2" />
      </svg>
      {count}
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
  large,
}: PlayerSeatProps) {
  const isSide = position === 'left' || position === 'right'
  // Phone held sideways: every camera the same size, as big as the height allows
  const avatarSize = large ? (isSide ? 104 : 120) : compact ? 76 : isSide ? 56 : 80
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
    // The right-hand seat hugs the screen edge, so its badge goes on the table side
    badgeSide: (position === 'right' ? 'left' : 'right') as 'left' | 'right',
  }

  // Side positions: compact vertical layout
  if (isSide) {
    return (
      <div className="flex flex-col items-center py-0.5">
        <AvatarWithBadge {...avatarProps} />
        <p className={`font-club font-bold text-club-text leading-tight truncate mt-0.5 text-center ${large ? 'text-xs max-w-[104px]' : 'text-[10px] max-w-[44px]'}`}>
          {player.name}
        </p>
        {!player.connected && (
          <span className="font-club text-club-muted text-[10px]">sin conexión</span>
        )}
      </div>
    )
  }

  // Compact (landscape): inline horizontal layout
  if (compact) {
    return (
      <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-lg bg-club-strip transition-all duration-300">
        <AvatarWithBadge {...avatarProps} />
        <p className="font-club font-bold text-club-text text-[10px] leading-tight truncate max-w-16">
          {player.name}
        </p>
        {!player.connected && (
          <span className="font-club text-club-muted text-[10px]">sin conexión</span>
        )}
        {isLocalPlayer && inCall && (
          <CallControls className="ml-1" />
        )}
      </div>
    )
  }

  // Default (portrait top/bottom): full layout
  return (
    <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-club-strip flex-row transition-all duration-300">
      <AvatarWithBadge {...avatarProps} />
      <div>
        <p className={`font-club font-bold text-club-text leading-tight truncate ${large ? 'text-sm max-w-32' : 'text-xs max-w-20'}`}>
          {player.name}
        </p>
        {/* In 2-player games the "team" is the player, so skip the repeated name */}
        {teamLabel !== player.name && (
          <p className="font-club font-semibold leading-tight text-xs text-club-muted">
            {teamLabel}
          </p>
        )}
      </div>
      {!player.connected && (
        <span className="font-club text-club-muted text-xs">sin conexión</span>
      )}
      {isLocalPlayer && inCall && (
        <CallControls className="mt-1" />
      )}
    </div>
  )
}

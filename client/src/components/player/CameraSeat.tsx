import { useRef, ReactNode } from 'react'
import { ClientPlayer } from '../../types/game'
import { useVideoStream } from './AvatarVideo'
import { DominoTileBack } from '../domino/DominoTileBack'

interface CameraSeatProps {
  player: ClientPlayer
  /** Visual seat this box stands for; animations fly from [data-seat]. Omitted for yourself (your hand is the anchor). */
  seat?: 'left' | 'top' | 'right'
  /** Same team as you (partner, or you): green box */
  isPartner: boolean
  /** Your own box: mirrored video, "tú" in the strip, no face-down row */
  isSelf?: boolean
  isCurrentTurn: boolean
  stream: MediaStream | null
  isCameraOff: boolean
  isSpeaking: boolean
  /** Overlays anchored to this seat (paso chip, reactions, chat bubbles) */
  children?: ReactNode
}

/**
 * One player in the camera row above the table (phone portrait): a camera
 * box 104px tall with name and tiles left in a dark strip inside it. Your
 * side is green, rivals red; your partner gets a brass edge. The player on
 * turn gets a cream "Juega" tab, so the turn visibly travels along the row.
 */
export function CameraSeat({ player, seat, isPartner, isSelf, isCurrentTurn, stream, isCameraOff, isSpeaking, children }: CameraSeatProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const showVideo = stream !== null && !isCameraOff
  useVideoStream(videoRef, stream, showVideo)

  const initials = player.name.slice(0, 2).toUpperCase()
  const edge = isSelf ? '2px solid #C9A24A' : isPartner ? '3px solid #C9A24A' : '2px solid #F1E3C2'

  return (
    <div className="relative min-w-0 flex flex-col items-stretch gap-1.5" data-seat={seat}>
      <div
        className="relative h-[104px] box-border overflow-hidden flex items-center justify-center"
        style={{ borderRadius: 8, background: isPartner ? '#1B5E3A' : '#8E2A22', border: edge }}
      >
        {showVideo ? (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="absolute inset-0 w-full h-full object-cover"
            // Your own camera reads like a mirror, as in any video call
            style={isSelf ? { transform: 'scaleX(-1)' } : undefined}
          />
        ) : (
          <span className="font-club font-bold text-[26px] text-club-text mb-[18px]" aria-hidden>{initials}</span>
        )}

        {isCurrentTurn && (
          <span className="absolute top-0 left-1/2 -translate-x-1/2 px-1.5 pt-0.5 pb-[3px] rounded-b-md bg-club-cream text-club-ink font-club font-bold text-[10px] uppercase tracking-[0.08em] leading-none">
            Juega
          </span>
        )}

        <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-1 px-1.5 py-[3px] bg-club-strip font-club text-xs font-bold text-club-text">
          <span className="truncate min-w-0">
            {isSpeaking && <span className="inline-block w-1.5 h-1.5 mr-1 align-middle rounded-full bg-club-brass" aria-label="hablando" />}
            {isSelf ? 'Tú' : player.name}
          </span>
          {!player.connected ? (
            <span className="shrink-0 font-semibold text-club-muted text-[11px]">sin conexión</span>
          ) : (
            <span className="shrink-0 flex items-center gap-[3px] font-semibold text-club-muted" aria-label={`${player.tileCount} fichas`}>
              <svg viewBox="0 0 10 18" className="h-3 w-auto" aria-hidden>
                <rect x="0.75" y="0.75" width="8.5" height="16.5" rx="1.8" fill="none" stroke="currentColor" strokeWidth="1.5" />
                <line x1="2.5" y1="9" x2="7.5" y2="9" stroke="currentColor" strokeWidth="1.2" />
              </svg>
              {player.tileCount}
            </span>
          )}
        </div>
      </div>

      {/* Their hand, face down: a mini row under the camera (yours is on the shelf) */}
      <div className="flex items-center justify-center gap-[2px] h-4 shrink-0" aria-hidden>
        {!isSelf && Array.from({ length: player.tileCount }, (_, i) => (
          <DominoTileBack key={i} orientation="vertical" style={{ width: 8, height: 16 }} />
        ))}
      </div>

      {/* Overlays (paso, chat) hang over the table edge instead of pushing the row */}
      <div className="absolute inset-x-0 top-full mt-1 z-30 flex flex-col items-center gap-1 pointer-events-none">
        {children}
      </div>
    </div>
  )
}

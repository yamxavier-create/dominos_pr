import { useRef, ReactNode } from 'react'
import { ClientPlayer } from '../../types/game'
import { useVideoStream } from './AvatarVideo'
import { DominoTileBack } from '../domino/DominoTileBack'

interface CameraSeatProps {
  player: ClientPlayer
  /** Visual seat this box stands for; animations fly from [data-seat] */
  seat: 'left' | 'top' | 'right'
  isPartner: boolean
  isCurrentTurn: boolean
  stream: MediaStream | null
  isCameraOff: boolean
  isSpeaking: boolean
  /** Overlays anchored to this seat (paso chip, reactions, chat bubbles) */
  children?: ReactNode
}

/**
 * One player in the row above the table (phone portrait): a square camera,
 * a third of the width, with name and tiles left in a dark strip inside it.
 * The partner's box has a brass edge; rivals have a cream one. The player on
 * turn gets a cream "Juega" tab, so the turn visibly travels along the row.
 */
export function CameraSeat({ player, seat, isPartner, isCurrentTurn, stream, isCameraOff, isSpeaking, children }: CameraSeatProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const showVideo = stream !== null && !isCameraOff
  useVideoStream(videoRef, stream, showVideo)

  const initials = player.name.slice(0, 2).toUpperCase()
  const tilesLeft = player.tileCount === 1 ? '1 ficha' : `${player.tileCount} fichas`

  return (
    <div className="relative min-w-0 flex flex-col items-stretch gap-1.5" data-seat={seat}>
      <div
        className="relative h-[104px] box-border overflow-hidden flex items-center justify-center"
        style={{
          borderRadius: 8,
          background: isPartner ? '#1B5E3A' : '#8E2A22',
          border: isPartner ? '3px solid #C9A24A' : '2px solid #F1E3C2',
        }}
      >
        {showVideo ? (
          <video ref={videoRef} autoPlay playsInline muted className="absolute inset-0 w-full h-full object-cover" />
        ) : (
          <span className="font-club font-bold text-[30px] text-club-text mb-[18px]" aria-hidden>{initials}</span>
        )}

        {isCurrentTurn && (
          <span className="absolute top-0 left-1/2 -translate-x-1/2 px-2 pt-0.5 pb-[3px] rounded-b-md bg-club-cream text-club-ink font-club font-bold text-[11px] uppercase tracking-[0.08em] leading-none">
            Juega
          </span>
        )}

        <div className="absolute inset-x-0 bottom-0 flex items-baseline justify-between gap-1 px-1.5 py-[3px] bg-club-strip font-club text-xs font-bold text-club-text">
          <span className="truncate min-w-0">
            {isSpeaking && <span className="inline-block w-1.5 h-1.5 mr-1 align-middle rounded-full bg-club-brass" aria-label="hablando" />}
            {player.name}{isPartner && ' · pareja'}
          </span>
          <span className="shrink-0 font-semibold text-club-muted">
            {player.connected ? tilesLeft : 'sin conexión'}
          </span>
        </div>
      </div>

      {/* Their hand, face down: a mini row under the camera */}
      <div className="flex items-center justify-center gap-[3px] h-4" aria-hidden>
        {Array.from({ length: player.tileCount }, (_, i) => (
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

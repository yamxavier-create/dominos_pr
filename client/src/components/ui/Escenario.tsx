import type { CSSProperties, ReactNode } from 'react'

/*
 * «Escenario»: the look shared by the menu, the room and the sign-in screens.
 * Thick ink outlines, gold rims, 3D drops and the Lilita One heading font
 * (font-chunky). Animations live in index.css under the mm- prefix.
 */

export const INK = '#06140B'

/**
 * Full-screen backdrop: emerald glow, gold rays, an arena ring and two big tiles
 * in the corners. `still` keeps the rays and the ring from moving, for screens
 * where people read or watch cameras.
 */
export function StageBackdrop({ still = false }: { still?: boolean }) {
  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none" aria-hidden>
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(circle at 50% 42%, #5BEA9B 0%, #1FB862 12%, #0F7A40 28%, #0B4726 48%, #0A2516 66%, #0A1A0F 82%)',
        }}
      />
      <div
        className={`${still ? '' : 'mm-rays'} absolute left-1/2 top-[42%] w-[170vmax] h-[170vmax] -ml-[85vmax] -mt-[85vmax]`}
        style={{
          background: 'repeating-conic-gradient(from 0deg, rgba(253,224,120,0.13) 0deg 7deg, transparent 7deg 22.5deg)',
          maskImage: 'radial-gradient(circle, #000 0%, #000 18%, transparent 48%)',
          WebkitMaskImage: 'radial-gradient(circle, #000 0%, #000 18%, transparent 48%)',
        }}
      />
      <div
        className={`${still ? '' : 'mm-breathe'} absolute left-1/2 top-[42%] w-[118vmin] h-[118vmin] -ml-[59vmin] -mt-[59vmin] rounded-full`}
        style={{
          border: '2px solid rgba(253,208,75,0.22)',
          boxShadow: 'inset 0 0 60px rgba(91,234,155,0.25), 0 0 40px rgba(91,234,155,0.12)',
        }}
      />
      <CornerTile className="-left-16 top-[16%] rotate-[28deg]" />
      <CornerTile className="-right-14 bottom-[20%] -rotate-[22deg]" />
      <div className="absolute inset-x-0 bottom-0 h-48" style={{ background: 'linear-gradient(180deg, transparent, #0A1A0F 85%)' }} />
    </div>
  )
}

/* A big dark tile half off screen, the way Clash Royale frames its arena with pipes */
function CornerTile({ className }: { className: string }) {
  return (
    <div
      className={`absolute w-36 h-72 rounded-[28px] flex flex-col items-center justify-around py-6 ${className}`}
      style={{
        background: 'linear-gradient(160deg, #0F5A31, #0A3A20)',
        border: '3px solid rgba(91,234,155,0.18)',
        boxShadow: 'inset 0 4px 0 rgba(255,255,255,0.06), 0 20px 40px rgba(0,0,0,0.35)',
        opacity: 0.8,
      }}
    >
      {[0, 1].map(half => (
        <div key={half} className="grid grid-cols-2 gap-5">
          {[0, 1, 2, 3].map(i => <span key={i} className="w-5 h-5 rounded-full" style={{ background: 'rgba(5,30,15,0.7)' }} />)}
        </div>
      ))}
    </div>
  )
}

type Tone = 'gold' | 'green' | 'red'

const TONES: Record<Tone, { bg: string; inner: string; text: string }> = {
  gold: { bg: 'linear-gradient(180deg, #FFE27A 0%, #FDD04B 28%, #F2B51C 60%, #D18F0E 100%)', inner: 'rgba(120,70,0,0.35)', text: '#4A2A00' },
  green: { bg: 'linear-gradient(180deg, #2E9A57 0%, #1C7442 50%, #124E2B 100%)', inner: 'rgba(0,0,0,0.25)', text: '#D9F99D' },
  red: { bg: 'linear-gradient(180deg, #E5534A 0%, #C2392F 50%, #8E2A22 100%)', inner: 'rgba(0,0,0,0.25)', text: '#FFE4E1' },
}

interface ChunkyButtonProps {
  onClick?: () => void
  disabled?: boolean
  tone?: Tone
  size?: 'sm' | 'md' | 'lg'
  /** Gloss sweep and pulsing ring: only for the one action the screen is about */
  shine?: boolean
  subtitle?: ReactNode
  type?: 'button' | 'submit'
  className?: string
  style?: CSSProperties
  'aria-label'?: string
  children: ReactNode
}

const SIZES = {
  sm: { pad: 'px-3 py-1.5', title: 'text-base', radius: 'rounded-xl' },
  md: { pad: 'px-4 py-2.5', title: 'text-[1.6rem]', radius: 'rounded-2xl' },
  lg: { pad: 'px-4 pt-2.5 pb-3', title: 'text-[2.3rem]', radius: 'rounded-2xl' },
}

/** Thick 3D button with an ink outline; it drops 3px when pressed */
export function ChunkyButton({ onClick, disabled, tone = 'gold', size = 'md', shine, subtitle, type = 'button', className = '', style, children, ...rest }: ChunkyButtonProps) {
  const t = TONES[tone]
  const z = SIZES[size]
  const live = shine && !disabled
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      aria-label={rest['aria-label']}
      className={`mm-press relative w-full ${z.radius} disabled:opacity-50 disabled:cursor-not-allowed ${live ? 'mm-ring' : ''} ${className}`}
      style={style}
    >
      <span
        className={`relative block overflow-hidden ${z.radius} ${z.pad} text-center`}
        style={{
          background: t.bg,
          border: `3px solid ${INK}`,
          boxShadow: `0 ${size === 'sm' ? 3 : 5}px 0 ${INK}, inset 0 3px 0 rgba(255,255,255,0.45), inset 0 -4px 0 ${t.inner}`,
        }}
      >
        {live && (
          <span className="mm-shine absolute inset-y-0 left-0 w-1/3 pointer-events-none" style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.6), transparent)' }} />
        )}
        <span className={`relative flex items-center justify-center gap-2 font-chunky ${z.title} leading-none mm-stroke tracking-wide`}>{children}</span>
        {subtitle && (
          <span className="relative block font-body font-extrabold text-[12px] leading-tight mt-1 truncate" style={{ color: t.text }}>{subtitle}</span>
        )}
      </span>
    </button>
  )
}

/** Gold ribbon plate with notched ends, like a league banner */
export function GoldPlate({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`relative px-8 py-2 text-center ${className}`}
      style={{
        background: 'linear-gradient(180deg, #FDE68A 0%, #FDD04B 30%, #E4A918 65%, #B8830F 100%)',
        clipPath: 'polygon(5% 0, 95% 0, 100% 50%, 95% 100%, 5% 100%, 0 50%)',
        filter: `drop-shadow(0 4px 0 ${INK})`,
      }}
    >
      {children}
    </div>
  )
}

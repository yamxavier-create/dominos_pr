import type { ReactNode, CSSProperties } from 'react'
import { ChunkyButton } from './Escenario'

interface GoldCTAProps {
  onClick?: () => void
  disabled?: boolean
  children: ReactNode
  subtitle?: string
  size?: 'md' | 'lg'
  className?: string
  style?: CSSProperties
}

/*
 * Primary CTA across the menu, onboarding and room: the «Escenario» gold slab
 * with an ink outline, a gloss sweep and a pulsing ring. Centralized so every
 * surface stays consistent.
 */
export function GoldCTA({ onClick, disabled, children, subtitle, size = 'lg', className, style }: GoldCTAProps) {
  return (
    <ChunkyButton onClick={onClick} disabled={disabled} size={size} subtitle={subtitle} shine className={className} style={style}>
      {children}
    </ChunkyButton>
  )
}

/*
 * Small gold caption used above hero titles
 * e.g. "· MESA DE LA ISLA ·", "· CREAR SALA ·"
 */
export function GoldCaption({ children }: { children: ReactNode }) {
  return (
    <p
      className="font-chunky text-[13px] sm:text-sm tracking-[0.2em] uppercase mm-stroke"
      style={{ color: '#FDE68A' }}
    >
      · {children} ·
    </p>
  )
}

/*
 * Starburst rays — radial decorative element used behind hero elements.
 */
export function Starburst({ rayCount = 16, opacity = 0.35 }: { rayCount?: number; opacity?: number }) {
  const rays = Array.from({ length: rayCount }, (_, i) => i)
  return (
    <svg viewBox="0 0 200 200" className="absolute inset-0 w-full h-full pointer-events-none" style={{ opacity }}>
      <defs>
        <radialGradient id={`starburst-fade-${rayCount}`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#EAB308" stopOpacity="0" />
          <stop offset="30%" stopColor="#EAB308" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#EAB308" stopOpacity="0" />
        </radialGradient>
      </defs>
      {rays.map(i => {
        const angle = (i * 360) / rayCount
        return (
          <line
            key={i}
            x1="100"
            y1="100"
            x2="100"
            y2="10"
            stroke={`url(#starburst-fade-${rayCount})`}
            strokeWidth="0.7"
            transform={`rotate(${angle} 100 100)`}
          />
        )
      })}
    </svg>
  )
}

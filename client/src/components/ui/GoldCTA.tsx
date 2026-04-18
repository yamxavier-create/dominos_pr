import type { ReactNode, CSSProperties } from 'react'

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
 * Primary gold-gradient CTA used across the menu/onboarding/lobby.
 * Renders with a 3D relief effect (top highlight + bottom shadow inset)
 * and a warm gold glow. Centralized so every surface stays consistent.
 */
export function GoldCTA({ onClick, disabled, children, subtitle, size = 'lg', className, style }: GoldCTAProps) {
  const pad = size === 'lg' ? 'py-4 sm:py-[18px]' : 'py-3'
  const titleSize = size === 'lg' ? 'text-[2rem] sm:text-4xl' : 'text-2xl sm:text-3xl'
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`relative w-full ${pad} rounded-2xl active:scale-[0.98] transition-transform disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100 ${className ?? ''}`}
      style={{
        background: 'linear-gradient(180deg, #FDD04B 0%, #E4A918 42%, #B8830F 78%, #8A5E0C 100%)',
        boxShadow: '0 8px 28px rgba(234,179,8,0.35), inset 0 2px 0 rgba(255,255,255,0.55), inset 0 -3px 0 rgba(0,0,0,0.28)',
        ...style,
      }}
    >
      <p className={`font-header ${titleSize} leading-none`} style={{ color: '#2a1600', letterSpacing: '0.06em' }}>
        {children}
      </p>
      {subtitle && (
        <p className="font-body text-[11px] sm:text-xs mt-1" style={{ color: 'rgba(42,22,0,0.75)' }}>
          {subtitle}
        </p>
      )}
    </button>
  )
}

/*
 * Small gold caption used above hero titles
 * e.g. "· MESA DE LA ISLA ·", "· CREAR SALA ·"
 */
export function GoldCaption({ children }: { children: ReactNode }) {
  return (
    <p
      className="font-body text-[10px] sm:text-xs tracking-[0.35em] uppercase"
      style={{ color: 'rgba(234,179,8,0.75)' }}
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

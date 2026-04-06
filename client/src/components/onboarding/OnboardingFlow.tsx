import { useState } from 'react'

interface OnboardingProps {
  onComplete: () => void
}

const screens = [
  {
    icon: (
      <svg width="80" height="80" viewBox="0 0 72 72" fill="none" xmlns="http://www.w3.org/2000/svg">
        <g transform="rotate(-12 36 36)">
          <rect x="14" y="4" width="44" height="64" rx="6" fill="#FFFBF0" stroke="#8899aa" strokeWidth="1.5" />
          <line x1="18" y1="36" x2="54" y2="36" stroke="#bbb" strokeWidth="1" />
          <circle cx="24" cy="14" r="3.5" fill="#1a1a2e" />
          <circle cx="24" cy="22" r="3.5" fill="#1a1a2e" />
          <circle cx="24" cy="30" r="3.5" fill="#1a1a2e" />
          <circle cx="48" cy="14" r="3.5" fill="#1a1a2e" />
          <circle cx="48" cy="22" r="3.5" fill="#1a1a2e" />
          <circle cx="48" cy="30" r="3.5" fill="#1a1a2e" />
          <circle cx="24" cy="44" r="3.5" fill="#1a1a2e" />
          <circle cx="24" cy="58" r="3.5" fill="#1a1a2e" />
          <circle cx="48" cy="44" r="3.5" fill="#1a1a2e" />
          <circle cx="48" cy="58" r="3.5" fill="#1a1a2e" />
          <circle cx="36" cy="51" r="3.5" fill="#1a1a2e" />
        </g>
      </svg>
    ),
    title: 'Bienvenido a Dominó PR',
    subtitle: 'El clásico juego de dominó puertorriqueño, ahora en tu bolsillo.',
    details: 'Juega con amigos en tiempo real, con videollamada y chat incluidos.',
  },
  {
    icon: (
      <div className="text-6xl">🎯</div>
    ),
    title: 'Cómo Jugar',
    subtitle: 'Dominó Doble Seis — 28 fichas, 4 jugadores.',
    details: 'Juegan en equipos de 2 (tú y tu compañero de enfrente). Coloca fichas que coincidan con los extremos de la cadena. El equipo que se quede sin fichas primero, gana la ronda.',
  },
  {
    icon: (
      <div className="flex gap-4">
        <div className="text-center">
          <p className="font-header text-3xl text-gold">M·200</p>
          <p className="font-body text-white/40 text-xs">20 pts</p>
        </div>
        <div className="text-white/20 text-3xl font-thin">vs</div>
        <div className="text-center">
          <p className="font-header text-3xl text-gold">M·500</p>
          <p className="font-body text-white/40 text-xs">500 pts</p>
        </div>
      </div>
    ),
    title: 'Modos de Juego',
    subtitle: 'Elige tu estilo de partida.',
    details: 'Modo 200: partidas rápidas hasta 20 puntos con bonus por pase. Modo 500: partidas largas hasta 500 puntos con Capicú y Chuchazo.',
  },
]

export function OnboardingFlow({ onComplete }: OnboardingProps) {
  const [current, setCurrent] = useState(0)

  const handleNext = () => {
    if (current < screens.length - 1) {
      setCurrent(current + 1)
    } else {
      localStorage.setItem('onboarding_done', '1')
      onComplete()
    }
  }

  const handleSkip = () => {
    localStorage.setItem('onboarding_done', '1')
    onComplete()
  }

  const screen = screens[current]
  const isLast = current === screens.length - 1

  return (
    <div className="fixed inset-0 felt-table flex items-start justify-center pt-12 px-4 pb-4 overflow-y-auto">
      <div className="menu-card flex flex-col items-center gap-4 w-full max-w-xs sm:max-w-sm text-center">
        {/* Skip button */}
        <button
          onClick={handleSkip}
          className="self-end font-body text-white/30 hover:text-white/50 text-xs transition-colors"
        >
          Saltar
        </button>

        {/* Icon */}
        <div className="flex items-center justify-center h-24">
          {screen.icon}
        </div>

        {/* Text */}
        <div>
          <h2 className="font-header text-2xl sm:text-3xl text-gold mb-2">{screen.title}</h2>
          <p className="font-body text-white/70 text-sm">{screen.subtitle}</p>
          <p className="font-body text-white/40 text-xs mt-3 leading-relaxed">{screen.details}</p>
        </div>

        {/* Dots */}
        <div className="flex gap-2">
          {screens.map((_, i) => (
            <div
              key={i}
              className="w-2 h-2 rounded-full transition-all"
              style={{
                background: i === current ? '#EAB308' : 'rgba(255,255,255,0.15)',
                transform: i === current ? 'scale(1.3)' : 'scale(1)',
              }}
            />
          ))}
        </div>

        {/* Button */}
        <button
          onClick={handleNext}
          className="w-full font-body font-bold py-3 rounded-2xl text-white text-base active:scale-95 btn-glow"
        >
          {isLast ? '¡Empezar a Jugar!' : 'Siguiente'}
        </button>
      </div>
    </div>
  )
}

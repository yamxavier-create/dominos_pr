import { useState } from 'react'
import { GoldCTA, GoldCaption } from '../ui/GoldCTA'
import { StageBackdrop } from '../ui/Escenario'
import { DominoTile } from '../domino/DominoTile'

interface OnboardingProps {
  onComplete: () => void
}

const screens = [
  {
    icon: (
      <div className="w-20 -rotate-12" style={{ filter: 'drop-shadow(0 14px 18px rgba(0,0,0,0.5))' }}>
        <DominoTile pip1={6} pip2={5} orientation="vertical" style={{ width: '100%', height: 'auto' }} />
      </div>
    ),
    title: 'Bienvenido a Dominó PR',
    subtitle: 'El clásico juego de dominó puertorriqueño, ahora en tu bolsillo.',
    details: 'Juega con amigos en tiempo real, con videollamada y chat incluidos.',
  },
  {
    icon: (
      <div className="text-6xl" style={{ filter: 'drop-shadow(0 8px 10px rgba(0,0,0,0.45))' }}>🎯</div>
    ),
    title: 'Cómo Jugar',
    subtitle: 'Dominó Doble Seis — 28 fichas, 4 jugadores.',
    details: 'Juegan en equipos de 2 (tú y tu compañero de enfrente). Coloca fichas que coincidan con los extremos de la cadena. El equipo que se quede sin fichas primero, gana la ronda.',
  },
  {
    icon: (
      <div className="flex gap-4">
        <div className="text-center">
          <p className="mm-title text-3xl leading-none">200</p>
          <p className="font-body font-extrabold text-white/75 text-xs mt-1">20 pts</p>
        </div>
        <div className="font-chunky text-white/60 text-2xl self-center mm-stroke">vs</div>
        <div className="text-center">
          <p className="mm-title text-3xl leading-none">500</p>
          <p className="font-body font-extrabold text-white/75 text-xs mt-1">500 pts</p>
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

  const stepCaptions = ['Bienvenido', 'Guía Rápida', 'Modos'] as const

  return (
    <div className="fixed inset-0 felt-table flex items-center justify-center px-4 py-4 overflow-y-auto">
      <StageBackdrop />
      <div className="relative flex flex-col items-center gap-5 w-full max-w-xs sm:max-w-sm text-center py-6">
        {/* Skip button */}
        <button
          onClick={handleSkip}
          className="absolute -top-2 right-0 btn-outline-shine rounded-xl px-3 py-1 font-chunky text-sm tracking-wide mm-stroke"
        >
          Saltar
        </button>

        {/* Caption */}
        <div className="mt-2">
          <GoldCaption>{stepCaptions[current] ?? 'Dominó PR'}</GoldCaption>
        </div>

        {/* Icon floating on a felt disc with a gold rim */}
        <div key={current} className="mm-pop relative flex items-center justify-center w-full max-w-[220px] aspect-square">
          <div
            className="absolute inset-[8%] rounded-full"
            style={{
              background: 'radial-gradient(circle at 50% 40%, #1E8A4C 0%, #126B39 55%, #0B4A27 100%)',
              border: '6px solid #7A4A2B',
              boxShadow: '0 0 0 2px #EAB308, 0 6px 0 #06140B, inset 0 6px 18px rgba(0,0,0,0.45), 0 0 50px rgba(253,208,75,0.25)',
            }}
          />
          <div className="mm-float relative flex items-center justify-center">{screen.icon}</div>
        </div>

        {/* Text */}
        <div key={`t${current}`} className="mm-rise mm-panel px-5 py-5 w-full">
          <h2 className="font-chunky text-[1.9rem] sm:text-[2.2rem] leading-[1.05] mm-stroke tracking-wide">
            {screen.title}
          </h2>
          <p className="font-body font-extrabold text-[#FDE68A] text-sm mt-2">{screen.subtitle}</p>
          <p className="font-body font-semibold text-white/80 text-[13px] mt-3 leading-relaxed">{screen.details}</p>
        </div>

        {/* Dots */}
        <div className="flex gap-2">
          {screens.map((_, i) => (
            <div
              key={i}
              className="h-3 rounded-full transition-all"
              style={{
                background: i === current ? 'linear-gradient(180deg, #FFE27A, #F2B51C)' : 'rgba(6,20,11,0.6)',
                width: i === current ? 28 : 12,
                border: '2px solid #06140B',
                boxShadow: i === current ? '0 2px 0 #06140B' : 'inset 0 2px 0 rgba(0,0,0,0.3)',
              }}
            />
          ))}
        </div>

        {/* CTA */}
        <div className="w-full mt-1">
          <GoldCTA onClick={handleNext} size="md">
            {isLast ? '¡EMPEZAR!' : 'SIGUIENTE'}
          </GoldCTA>
        </div>
      </div>
    </div>
  )
}

import { GameMode, HouseRules } from './types/game'

// Mirror of server/src/game/rules.ts: what the lobby shows and lets the host change

export const MODE_NAMES: Record<GameMode, string> = {
  modo200: 'Modo 200',
  modo500: 'Modo 500',
  torneo: 'Torneo',
}

/** Short name for cards and lists */
export const MODE_SHORT: Record<GameMode, string> = {
  modo200: 'M·200',
  modo500: 'M·500',
  torneo: 'Torneo',
}

/** What the mode card says under the name */
export const MODE_SUMMARY: Record<GameMode, [string, string]> = {
  modo200: ['Hasta 20 pts', 'Bonus por pase'],
  modo500: ['Hasta 500 pts', 'Capicú +100'],
  torneo: ['200 pts o 35 min', 'Reglas oficiales'],
}

export function editableRules(mode: GameMode): readonly (keyof HouseRules)[] {
  switch (mode) {
    case 'modo200': return ['tranque', 'passPoints', 'blockBonus', 'tiedTranque']
    case 'modo500': return ['tranque', 'tiedTranque']
    case 'torneo': return []
  }
}

interface RuleOption<V> { value: V; label: string; detail: string }

export const RULE_OPTIONS: {
  [K in keyof HouseRules]: { title: string; options: RuleOption<HouseRules[K]>[] }
} = {
  tranque: {
    title: 'Tranque',
    options: [
      { value: 'individual', label: 'Individual', detail: 'Gana la pareja del jugador con menos puntos en la mano.' },
      { value: 'pareja', label: 'En pareja', detail: 'Gana la pareja con menos puntos sumando las dos manos.' },
    ],
  },
  passPoints: {
    title: 'Pases con puntos',
    options: [
      { value: true, label: 'Sí', detail: 'Cada pase le da puntos a la otra pareja: +2 el primero, +1 los demás.' },
      { value: false, label: 'No', detail: 'Pasar no da puntos.' },
    ],
  },
  blockBonus: {
    title: 'Bono por trancar',
    options: [
      { value: true, label: 'Sí', detail: 'La pareja que tranca gana +2, además de los puntos de la mano.' },
      { value: false, label: 'No', detail: 'Trancar no da puntos extra.' },
    ],
  },
  tiedTranque: {
    title: 'Tranque empatado',
    options: [
      { value: 'nadie', label: 'Nadie anota', detail: 'Si el tranque queda empatado, la mano no cuenta.' },
      { value: 'salida', label: 'Gana la salida', detail: 'Si el tranque queda empatado, gana la pareja que salió esa mano.' },
    ],
  },
}

export const RULE_KEYS = Object.keys(RULE_OPTIONS) as (keyof HouseRules)[]

/** The label of the option a rule is set to */
export function ruleValueLabel<K extends keyof HouseRules>(key: K, value: HouseRules[K]): string {
  const options = RULE_OPTIONS[key].options as RuleOption<HouseRules[K]>[]
  return options.find(o => o.value === value)?.label ?? String(value)
}

/** Torneo's fixed rules, as the reglamento states them */
export const TORNEO_NOTES = [
  'A 200 puntos o 35 minutos, lo que llegue primero. Al acabarse el tiempo se termina la mano y gana la pareja que va arriba; si van empatados, se juega otra mano.',
  'Tranque en pareja; si queda empatado, nadie anota.',
  'La salida rota cada mano.',
  'Sin puntos por pase ni bonos.',
]

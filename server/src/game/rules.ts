import type { GameMode, ServerGameState } from './GameState'

/**
 * House rules: how a hand is scored where Puerto Rico plays it differently.
 * The host picks them in the lobby; each mode starts from its own defaults and
 * only some of them can be changed (Torneo is fixed).
 */
export interface HouseRules {
  tranque: 'individual' | 'pareja'  // individual: the team of the lightest hand wins; pareja: the lighter team sum wins
  passPoints: boolean               // a pass scores for the other team (first +2, then +1)
  blockBonus: boolean               // the team that closes a tranque gets +2
  tiedTranque: 'nadie' | 'salida'   // a tied tranque scores nothing, or goes to the team that led the hand
}

export const RULE_KEYS: readonly (keyof HouseRules)[] = ['tranque', 'passPoints', 'blockBonus', 'tiedTranque']

/** Torneo (reglamento DRD): 200 points or 35 minutes, whichever comes first */
export const TORNEO_TIME_LIMIT_MS = 35 * 60 * 1000

export function targetScoreFor(mode: GameMode): 20 | 200 | 500 {
  return mode === 'modo200' ? 20 : mode === 'torneo' ? 200 : 500
}

export function defaultRules(mode: GameMode): HouseRules {
  switch (mode) {
    case 'modo200': return { tranque: 'individual', passPoints: true, blockBonus: true, tiedTranque: 'nadie' }
    case 'modo500': return { tranque: 'pareja', passPoints: false, blockBonus: false, tiedTranque: 'nadie' }
    case 'torneo': return { tranque: 'pareja', passPoints: false, blockBonus: false, tiedTranque: 'nadie' }
  }
}

/**
 * Rules the host can change in each mode. Pass points and the tranque bonus are
 * worth 1–2 points, which only makes sense on Modo 200's 20-point scale.
 */
export function editableRules(mode: GameMode): readonly (keyof HouseRules)[] {
  switch (mode) {
    case 'modo200': return RULE_KEYS
    case 'modo500': return ['tranque', 'tiedTranque']
    case 'torneo': return []
  }
}

/** Apply a host's change to the current rules. Returns null if anything in it is invalid or not editable. */
export function applyRuleChange(mode: GameMode, current: HouseRules, change: unknown): HouseRules | null {
  if (typeof change !== 'object' || change === null || Array.isArray(change)) return null
  const editable = editableRules(mode)
  const next: HouseRules = { ...current }
  for (const [key, value] of Object.entries(change)) {
    if (!editable.includes(key as keyof HouseRules)) return null
    switch (key) {
      case 'tranque':
        if (value !== 'individual' && value !== 'pareja') return null
        next.tranque = value
        break
      case 'tiedTranque':
        if (value !== 'nadie' && value !== 'salida') return null
        next.tiedTranque = value
        break
      case 'passPoints':
      case 'blockBonus':
        if (typeof value !== 'boolean') return null
        next[key] = value
        break
    }
  }
  return next
}

/** Time left on a Torneo game's clock; null in modes without one */
export function gameTimeLeftMs(game: ServerGameState, now = Date.now()): number | null {
  if (game.gameMode !== 'torneo') return null
  return Math.max(0, game.startedAt + TORNEO_TIME_LIMIT_MS - now)
}

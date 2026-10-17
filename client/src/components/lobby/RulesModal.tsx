import { GameMode, HouseRules } from '../../types/game'
import { socket } from '../../socket'
import { GoldCTA, GoldCaption } from '../ui/GoldCTA'
import { MODE_NAMES, RULE_KEYS, RULE_OPTIONS, editableRules, torneoNotes } from '../../rules'

interface RulesModalProps {
  gameMode: GameMode
  rules: HouseRules
  canEdit: boolean  // the host, before the game starts
  onClose: () => void
}

/** The table's house rules: the host picks them before the game, everyone else can read them */
export function RulesModal({ gameMode, rules, canEdit, onClose }: RulesModalProps) {
  const editable = editableRules(gameMode)

  const setRule = <K extends keyof HouseRules>(key: K, value: HouseRules[K]) => {
    if (rules[key] === value) return
    socket.emit('room:set_rules', { rules: { [key]: value } })
  }

  return (
    <div
      className="fixed inset-0 z-50 flex overflow-y-auto mm-modal-backdrop p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="rules-title"
    >
      <div
        className="mm-pop mm-panel m-auto w-full max-w-sm p-5 flex flex-col gap-4"
        onClick={e => e.stopPropagation()}
      >
        <div className="text-center flex flex-col items-center gap-1">
          <GoldCaption>{MODE_NAMES[gameMode]}</GoldCaption>
          <h2 id="rules-title" className="mm-title text-3xl leading-none">Reglas de la mesa</h2>
          <p className="font-body font-bold text-white/75 text-xs">
            {gameMode === 'torneo'
              ? canEdit ? 'Escoge el tiempo; lo demás son las reglas oficiales.' : 'El torneo se juega con las reglas oficiales.'
              : canEdit ? 'Escoge cómo se juega en esta mesa.' : 'El host escoge cómo se juega en esta mesa.'}
          </p>
        </div>

        {editable.length > 0 && (
          <div className="flex flex-col gap-3.5">
            {RULE_KEYS.filter(key => editable.includes(key)).map(key => {
              const { title, options } = RULE_OPTIONS[key]
              const selected = options.find(o => o.value === rules[key])
              return (
                <div key={key} className="flex flex-col gap-1.5">
                  <p className="font-chunky text-white text-base tracking-wide mm-stroke">{title}</p>
                  <div className="mm-tabs" role="radiogroup" aria-label={title}>
                    {options.map(option => {
                      const active = option.value === rules[key]
                      return (
                        <button
                          key={String(option.value)}
                          role="radio"
                          aria-checked={active}
                          disabled={!canEdit}
                          onClick={() => setRule(key, option.value as HouseRules[typeof key])}
                          aria-pressed={active}
                          className="mm-tab disabled:cursor-default"
                          style={!active && !canEdit ? { color: 'rgba(255,255,255,0.45)' } : undefined}
                        >
                          {option.label}
                        </button>
                      )
                    })}
                  </div>
                  {selected && <p className="font-body font-semibold text-white/75 text-xs">{selected.detail}</p>}
                </div>
              )
            })}
          </div>
        )}

        {gameMode === 'torneo' && (
          <ul className="mm-well flex flex-col gap-2 font-body font-bold text-white/85 text-sm list-disc pl-8 pr-3 py-3">
            {torneoNotes(rules).map(note => <li key={note}>{note}</li>)}
          </ul>
        )}

        <GoldCTA onClick={onClose} size="md">LISTO</GoldCTA>
      </div>
    </div>
  )
}

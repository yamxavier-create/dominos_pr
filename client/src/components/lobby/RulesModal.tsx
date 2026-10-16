import { GameMode, HouseRules } from '../../types/game'
import { socket } from '../../socket'
import { GoldCTA, GoldCaption } from '../ui/GoldCTA'
import { MODE_NAMES, RULE_KEYS, RULE_OPTIONS, TORNEO_NOTES, editableRules } from '../../rules'

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
      className="fixed inset-0 z-50 flex overflow-y-auto bg-black/70 backdrop-blur-sm p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="rules-title"
    >
      <div
        className="modal-enter m-auto w-full max-w-sm rounded-2xl p-5 flex flex-col gap-4 shadow-2xl"
        style={{ background: '#0F2318', border: '1px solid rgba(255,255,255,0.10)' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="text-center flex flex-col items-center gap-1">
          <GoldCaption>{MODE_NAMES[gameMode]}</GoldCaption>
          <h2 id="rules-title" className="font-header text-white text-3xl leading-none">Reglas de la mesa</h2>
          <p className="font-body text-white/50 text-xs">
            {gameMode === 'torneo'
              ? 'El torneo se juega con las reglas oficiales.'
              : canEdit ? 'Escoge cómo se juega en esta mesa.' : 'El host escoge cómo se juega en esta mesa.'}
          </p>
        </div>

        {gameMode === 'torneo' ? (
          <ul className="flex flex-col gap-2 font-body text-white/75 text-sm list-disc pl-5">
            {TORNEO_NOTES.map(note => <li key={note}>{note}</li>)}
          </ul>
        ) : (
          <div className="flex flex-col gap-3.5">
            {RULE_KEYS.filter(key => editable.includes(key)).map(key => {
              const { title, options } = RULE_OPTIONS[key]
              const selected = options.find(o => o.value === rules[key])
              return (
                <div key={key} className="flex flex-col gap-1.5">
                  <p className="font-body text-white/80 text-sm font-semibold">{title}</p>
                  <div className="flex gap-2" role="radiogroup" aria-label={title}>
                    {options.map(option => {
                      const active = option.value === rules[key]
                      return (
                        <button
                          key={String(option.value)}
                          role="radio"
                          aria-checked={active}
                          disabled={!canEdit}
                          onClick={() => setRule(key, option.value as HouseRules[typeof key])}
                          className="flex-1 rounded-xl py-2 font-body text-sm transition-all disabled:cursor-default"
                          style={{
                            background: active ? 'rgba(234,179,8,0.12)' : 'rgba(255,255,255,0.03)',
                            border: `1.5px solid ${active ? '#EAB308' : 'rgba(255,255,255,0.10)'}`,
                            color: active ? '#EAB308' : canEdit ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.35)',
                          }}
                        >
                          {option.label}
                        </button>
                      )
                    })}
                  </div>
                  {selected && <p className="font-body text-white/45 text-xs">{selected.detail}</p>}
                </div>
              )
            })}
          </div>
        )}

        <GoldCTA onClick={onClose} size="md">LISTO</GoldCTA>
      </div>
    </div>
  )
}

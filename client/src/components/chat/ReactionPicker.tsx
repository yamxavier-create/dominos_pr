import { socket } from '../../socket'

export const QUICK_REACTIONS = [
  '🔥', '😂', '💀', '🫡', '👏', '😤', '🤙', '😎', '🎯', '🤡',
] as const

export function ReactionPicker() {
  const sendReaction = (reaction: string) => {
    socket.emit('chat:send', { message: reaction, type: 'reaction' })
  }

  return (
    <div className="flex flex-wrap gap-2 px-3 py-2 border-t border-white/10">
      {QUICK_REACTIONS.map(reaction => (
        <button
          key={reaction}
          onClick={() => sendReaction(reaction)}
          className="px-2 py-1 text-sm rounded bg-white/10 hover:bg-white/20 transition-colors text-white"
        >
          {reaction}
        </button>
      ))}
    </div>
  )
}

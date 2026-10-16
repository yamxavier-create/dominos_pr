import { socket } from '../../socket'

export const QUICK_REACTIONS = [
  '🔥', '😂', '💀', '🫡', '👏', '😤', '🤙', '😎', '🎯', '🤡',
  '🥶', '😈', '💯', '🫶', '🤯', '👀', '🙏', '🤬', '🏆', '😏', '🫠',
] as const

export function ReactionPicker() {
  const sendReaction = (reaction: string) => {
    socket.emit('chat:send', { message: reaction, type: 'reaction' })
  }

  return (
    <div className="flex flex-wrap gap-2 px-3 py-2.5 border-t-2 border-[#06140B]">
      {QUICK_REACTIONS.map(reaction => (
        <button
          key={reaction}
          onClick={() => sendReaction(reaction)}
          className="mm-press w-10 h-10 flex items-center justify-center text-xl rounded-xl"
          style={{ background: 'linear-gradient(180deg, #23824A, #15592F)', border: '2px solid #06140B', boxShadow: '0 3px 0 #06140B, inset 0 2px 0 rgba(255,255,255,0.2)' }}
        >
          {reaction}
        </button>
      ))}
    </div>
  )
}

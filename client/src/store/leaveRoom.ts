import { useGameStore } from './gameStore'
import { useRoomStore } from './roomStore'
import { useUIStore } from './uiStore'

/**
 * Drop every trace of the current room on this device: game, chat, modals and
 * the room code plus reconnect token, so a later focus or socket reconnect
 * doesn't put the player back in a room they left or lost.
 */
export function leaveRoomLocally() {
  useGameStore.getState().resetGame()
  useRoomStore.getState().exitRoom()
  const ui = useUIStore.getState()
  ui.clearChatState()
  ui.clearRematchState()
  ui.setShowRoundEnd(false)
  ui.setShowGameEnd(false)
}

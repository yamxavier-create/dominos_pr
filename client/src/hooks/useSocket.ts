import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { socket } from '../socket'
import { useGameStore } from '../store/gameStore'
import { useRoomStore } from '../store/roomStore'
import { useUIStore, ChatMessage, ActiveReaction } from '../store/uiStore'
import { useCallStore } from '../store/callStore'
import { useSocialStore } from '../store/socialStore'
import { signalHandlerRef, peerJoinedCallRef, resetForNewGameRef } from './useWebRTC'
import { playSfx, preloadSfx } from '../audio/sfx'
import { ClientGameState, RoundEndPayload, GameEndPayload, PassPayload, RematchVoteUpdate, RematchCancelled, BoneyardDrawPayload } from '../types/game'

export function useSocket() {
  const navigate = useNavigate()
  const { setGameState, setRoundEnd, setGameEnd, setLastTileSequence, addToScoreHistory, clearScoreHistory } = useGameStore()
  const { setRoom, setMyPlayerIndex, setError, setRoomCode } = useRoomStore()
  const { addPasoNotification, setShowRoundEnd, setShowGameEnd, setSelectedTile, setRematchVotes, setRematchCancelled, clearRematchState } = useUIStore()

  useEffect(() => {
    if (!socket.connected) socket.connect()

    // Re-join room after socket reconnection (new socket ID needs to be registered)
    socket.on('connect', () => {
      const roomCode = useRoomStore.getState().roomCode
      const playerName = useRoomStore.getState().playerName
      if (roomCode && playerName) {
        socket.emit('room:rejoin', { roomCode, playerName })
      }
    })

    socket.on('room:created', ({ roomCode, room, myPlayerIndex }: {
      roomCode: string; room: any; myPlayerIndex: number
    }) => {
      setRoom(room)
      setRoomCode(roomCode)
      setMyPlayerIndex(myPlayerIndex)
      navigate('/lobby')
    })

    socket.on('room:joined', ({ roomCode, room, myPlayerIndex }: {
      roomCode: string; room: any; myPlayerIndex: number
    }) => {
      setRoom(room)
      setRoomCode(roomCode)
      setMyPlayerIndex(myPlayerIndex)
      navigate('/lobby')
    })

    socket.on('room:updated', ({ room }: { room: any }) => {
      setRoom(room)
    })

    socket.on('room:seat_swapped', ({ room, myPlayerIndex }: { room: any; myPlayerIndex: number }) => {
      setRoom(room)
      setMyPlayerIndex(myPlayerIndex)
    })

    socket.on('room:error', ({ message }: { message: string }) => {
      setError(message)
    })

    socket.on('game:started', ({ gameState }: { gameState: ClientGameState }) => {
      setGameState(gameState)
      // Clear any stale end-of-game state (handles both initial start and next-game)
      setShowGameEnd(false)
      setShowRoundEnd(false)
      setSelectedTile(null)
      useGameStore.getState().clearGameEnd()
      useGameStore.getState().clearRoundEnd()
      clearScoreHistory()
      clearRematchState()
      useUIStore.getState().clearChatState()
      // Tear down and re-establish WebRTC to prevent stream/PC accumulation
      resetForNewGameRef.current?.()
      navigate('/game')
      preloadSfx()
    })

    socket.on('game:state_snapshot', ({
      gameState,
      lastAction,
    }: { gameState: ClientGameState; lastAction: any }) => {
      const prevIsMyTurn = useGameStore.getState().gameState?.isMyTurn ?? false
      setGameState(gameState)
      // Dismiss round-end modal when new hand starts (non-host players)
      if (gameState.phase === 'playing') {
        setShowRoundEnd(false)
        useGameStore.getState().clearRoundEnd()
      }
      // New game started — dismiss game-end modal and reset history
      if (gameState.phase === 'playing' && gameState.handNumber === 1) {
        setShowGameEnd(false)
        useGameStore.getState().clearGameEnd()
        clearScoreHistory()
      }
      // BUG-03: clear ghost tile selection when turn passes
      if (!gameState.isMyTurn) setSelectedTile(null)
      // BUG-01: use sequence to find newest tile, not array position (left-end plays land at index 0)
      if (lastAction?.type === 'play_tile' && gameState.board.tiles.length > 0) {
        playSfx('tileClack')
        const last = gameState.board.tiles.reduce((a, b) => a.sequence > b.sequence ? a : b)
        // Trigger tile fly animation from the player who placed it
        const action = lastAction as { playerIndex: number; tile?: { low: number; high: number }; targetEnd?: 'left' | 'right' }
        if (action.tile) {
          useUIStore.getState().setFlyingTile({
            playerIndex: action.playerIndex,
            tileId: last.tile.id,
            pip1: action.tile.low,
            pip2: action.tile.high,
            targetEnd: action.targetEnd ?? 'right',
          })
          // Clear flying tile after animation completes, then reveal board tile
          setTimeout(() => {
            useUIStore.getState().setFlyingTile(null)
            setLastTileSequence(last.sequence)
            setTimeout(() => setLastTileSequence(null), 500)
          }, 600)
        } else {
          setLastTileSequence(last.sequence)
          setTimeout(() => setLastTileSequence(null), 500)
        }
      }
    })

    socket.on('game:player_passed', (payload: PassPayload) => {
      addPasoNotification(payload)
      setTimeout(() => {
        useUIStore.getState().removePasoNotification(payload.playerIndex)
      }, 4500)
    })

    socket.on('game:boneyard_draw', (payload: BoneyardDrawPayload) => {
      useGameStore.getState().queueBoneyardDraw(payload)
    })

    socket.on('game:round_ended', (data: RoundEndPayload) => {
      setRoundEnd(data)
      setShowRoundEnd(true)
      const handNumber = useGameStore.getState().gameState?.handNumber ?? 0
      addToScoreHistory(data, handNumber)
    })

    socket.on('game:game_ended', (data: GameEndPayload) => {
      setGameEnd(data)
      setShowGameEnd(true)
    })

    socket.on('game:rematch_vote_update', (data: RematchVoteUpdate) => {
      setRematchVotes(data.votes, data.playerNames)
    })

    socket.on('game:rematch_accepted', () => {
      // Server will emit game:started after 2s delay — no action needed here
    })

    socket.on('game:rematch_cancelled', (data: RematchCancelled) => {
      setRematchCancelled({ playerIndex: data.disconnectedPlayerIndex, playerName: data.disconnectedPlayerName })
      setTimeout(() => {
        useUIStore.getState().clearRematchState()
        navigate('/lobby')
      }, 2500)
    })

    socket.on('webrtc:lobby_updated', ({ from, audio, video }: { from: number; audio: boolean; video: boolean }) => {
      useCallStore.getState().setPeerLobbyOpt(from, audio, video)
      if (audio || video) peerJoinedCallRef.current?.(from)
    })

    // Route WebRTC signaling to the hook instance
    socket.on('webrtc:signal', (data: { from: number; desc?: RTCSessionDescriptionInit; candidate?: RTCIceCandidateInit }) => {
      signalHandlerRef.current?.(data)
    })

    // Update peer mute/camera state in callStore
    socket.on('webrtc:peer_toggle', ({ from, micMuted, cameraOff }: { from: number; micMuted: boolean; cameraOff: boolean }) => {
      useCallStore.getState().setPeerMuted(from, micMuted)
      useCallStore.getState().setPeerCameraOff(from, cameraOff)
    })

    // WebRTC signaling errors from server — signal relay failed
    socket.on('webrtc:error', ({ reason, to }: { reason: string; to: number }) => {
      console.error(`[WebRTC] Server signal error: ${reason} (target peer ${to})`)
    })

    socket.on('chat:message', (msg: ChatMessage) => {
      useUIStore.getState().addChatMessage(msg)
      // Show reactions as animated emojis near avatar
      if (msg.type === 'reaction') {
        const reaction: ActiveReaction = {
          id: msg.id,
          playerIndex: msg.playerIndex,
          emoji: msg.content,
        }
        useUIStore.getState().addActiveReaction(reaction)
        setTimeout(() => {
          useUIStore.getState().removeActiveReaction(reaction.id)
        }, 2500)
      }
    })

    socket.on('chat:history', ({ messages }: { messages: ChatMessage[] }) => {
      useUIStore.getState().setChatMessages(messages)
    })

    socket.on('connection:player_disconnected', ({ playerIndex, playerName }: { playerIndex: number; playerName: string }) => {
      console.log(`Player ${playerName} (${playerIndex}) disconnected`)
    })

    socket.on('connection:player_reconnected', ({ playerIndex, playerName }: { playerIndex: number; playerName: string }) => {
      console.log(`Player ${playerName} (${playerIndex}) reconnected`)
    })

    // Social events -- real-time friend updates
    socket.on('social:friend_request_received', (data: { requestId: string; from: { id: string; username: string; displayName: string; avatarUrl: string | null } }) => {
      useSocialStore.getState().addRequest({ requestId: data.requestId, user: data.from, direction: 'incoming' })
    })

    socket.on('social:friend_request_sent', (data: { requestId: string; to: { id: string; username: string; displayName: string; avatarUrl: string | null } }) => {
      useSocialStore.getState().addRequest({ requestId: data.requestId, user: data.to, direction: 'outgoing' })
    })

    socket.on('social:friend_accepted', (data: { friendshipId: string; friend: { id: string; username: string; displayName: string; avatarUrl: string | null } }) => {
      useSocialStore.getState().addFriend(data.friend)
      // Remove the request that was accepted (could be incoming or outgoing)
      const requests = useSocialStore.getState().requests
      const matchingReq = requests.find(r => r.user.id === data.friend.id)
      if (matchingReq) {
        useSocialStore.getState().removeRequest(matchingReq.requestId)
      }
    })

    socket.on('social:friend_rejected', (data: { requestId: string }) => {
      useSocialStore.getState().removeRequest(data.requestId)
    })

    socket.on('social:friend_removed', (data: { userId: string }) => {
      useSocialStore.getState().removeFriend(data.userId)
    })

    socket.on('social:error', (data: { message: string }) => {
      console.warn('[Social] Error:', data.message)
    })

    return () => {
      socket.off('connect')
      socket.off('room:created')
      socket.off('room:joined')
      socket.off('room:updated')
      socket.off('room:seat_swapped')
      socket.off('room:error')
      socket.off('game:started')
      socket.off('game:state_snapshot')
      socket.off('game:player_passed')
      socket.off('game:boneyard_draw')
      socket.off('game:round_ended')
      socket.off('game:game_ended')
      socket.off('game:rematch_vote_update')
      socket.off('game:rematch_accepted')
      socket.off('game:rematch_cancelled')
      socket.off('webrtc:lobby_updated')
      socket.off('webrtc:signal')
      socket.off('webrtc:peer_toggle')
      socket.off('webrtc:error')
      socket.off('chat:message')
      socket.off('chat:history')
      socket.off('connection:player_disconnected')
      socket.off('connection:player_reconnected')
      socket.off('social:friend_request_received')
      socket.off('social:friend_request_sent')
      socket.off('social:friend_accepted')
      socket.off('social:friend_rejected')
      socket.off('social:friend_removed')
      socket.off('social:error')
    }
  }, [])
}

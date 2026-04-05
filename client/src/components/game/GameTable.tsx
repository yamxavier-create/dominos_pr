import { useEffect, useRef, useState, useCallback } from 'react'
import { useGameStore } from '../../store/gameStore'
import { useRoomStore } from '../../store/roomStore'
import { useUIStore } from '../../store/uiStore'
import { useCallStore } from '../../store/callStore'
import { useSpeakingDetection } from '../../hooks/useSpeakingDetection'
import { useGameActions } from '../../hooks/useGameActions'
import { getPosition } from '../../hooks/usePlayerPositions'
import { GameBoard } from '../board/GameBoard'
import { PlayerHand } from '../player/PlayerHand'
import { OpponentHand } from '../player/OpponentHand'
import { PlayerSeat } from '../player/PlayerSeat'
import { JoinCallButton } from './JoinCallButton'
import { AudioControls } from './AudioControls'
import { TurnIndicator } from '../player/TurnIndicator'
import { ScorePanel } from './ScorePanel'
import { ScoreHistoryPanel } from './ScoreHistoryPanel'
import { BoneyardPile } from './BoneyardPile'
import { BoneyardDrawAnimation } from './BoneyardDrawAnimation'
import { PasoChip } from './PasoChip'
import { FloatingChatBubble } from '../chat/FloatingChatBubble'
import { AvatarReaction } from '../player/AvatarReaction'
import { RoundEndModal } from './RoundEndModal'
import { GameEndModal } from './GameEndModal'
import { useIsLandscape } from '../../hooks/useIsLandscape'

function teamInfo(playerIndex: number, myPlayerIndex: number, playerCount: number, players: { name: string }[]) {
  if (playerCount === 2) {
    return {
      teamLabel: players[playerIndex]?.name ?? (playerIndex === 0 ? 'J1' : 'J2'),
      teamColor: playerIndex === myPlayerIndex ? '#22C55E' : '#F97316',
    }
  }
  const isTeamA = playerIndex % 2 === 0
  return {
    teamLabel: isTeamA ? 'Equipo A' : 'Equipo B',
    teamColor: isTeamA ? '#22C55E' : '#F97316',
  }
}

function RemoteAudio({ stream }: { stream: MediaStream | null }) {
  const audioRef = useRef<HTMLAudioElement>(null)
  useEffect(() => {
    if (!audioRef.current) return
    audioRef.current.srcObject = stream ?? null
    if (stream) audioRef.current.play().catch(e => console.warn('audio play blocked:', e))
    return () => { if (audioRef.current) audioRef.current.srcObject = null }
  }, [stream])
  return <audio ref={audioRef} autoPlay />
}

export function GameTable() {
  const gameState = useGameStore(s => s.gameState)
  const scoreHistory = useGameStore(s => s.scoreHistory)
  const myPlayerIndex = useRoomStore(s => s.myPlayerIndex) ?? 0
  const pasoNotifications = useUIStore(s => s.pasoNotifications)
  const showScoreHistory = useUIStore(s => s.showScoreHistory)
  const setShowScoreHistory = useUIStore(s => s.setShowScoreHistory)
  const showRoundEnd = useUIStore(s => s.showRoundEnd)
  const chatMessages = useUIStore(s => s.chatMessages)
  const activeReactions = useUIStore(s => s.activeReactions)

  // Call store subscriptions
  const localStream = useCallStore(s => s.localStream)
  const remoteStreams = useCallStore(s => s.remoteStreams)
  const speakingPeers = useCallStore(s => s.speakingPeers)
  const cameraOffPeers = useCallStore(s => s.cameraOffPeers)
  const cameraOff = useCallStore(s => s.cameraOff)
  const myAudioEnabled = useCallStore(s => s.myAudioEnabled)
  const myVideoEnabled = useCallStore(s => s.myVideoEnabled)

  // Track which chat messages are still visible (auto-expire after 4s)
  const [visibleMsgIds, setVisibleMsgIds] = useState<Set<string>>(new Set())
  const msgTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())

  useEffect(() => {
    const newIds = new Set(visibleMsgIds)
    let changed = false
    for (const msg of chatMessages) {
      if (!msgTimersRef.current.has(msg.id)) {
        newIds.add(msg.id)
        changed = true
        const timer = setTimeout(() => {
          setVisibleMsgIds(prev => { const s = new Set(prev); s.delete(msg.id); return s })
          msgTimersRef.current.delete(msg.id)
        }, 4500)
        msgTimersRef.current.set(msg.id, timer)
      }
    }
    if (changed) setVisibleMsgIds(newIds)
  }, [chatMessages])

  const getFloatingMessages = useCallback((playerIndex: number) => {
    return chatMessages
      .filter(m => m.playerIndex === playerIndex && m.type === 'text' && visibleMsgIds.has(m.id))
      .slice(-2)
  }, [chatMessages, visibleMsgIds])

  const getReactions = useCallback((playerIndex: number) => {
    return activeReactions.filter(r => r.playerIndex === playerIndex)
  }, [activeReactions])

  // Speaking detection
  useSpeakingDetection(remoteStreams, localStream, myPlayerIndex)

  useEffect(() => {
    if (showRoundEnd) setShowScoreHistory(false)
  }, [showRoundEnd, setShowScoreHistory])

  const isLandscape = useIsLandscape()
  const handleScoreBarClick = () => setShowScoreHistory(!showScoreHistory)

  if (!gameState) {
    return (
      <div className="flex items-center justify-center h-screen bg-bg">
        <p className="font-body text-white/50">Cargando partida...</p>
      </div>
    )
  }

  const { players, board, currentPlayerIndex, scores, gameMode, targetScore, handNumber, validPlays, isMyTurn, forcedFirstTileId, awaitingBoneyardDraw } = gameState
  const { drawFromBoneyard, playTileOnEnd } = useGameActions()
  const selectedTileId = useUIStore(s => s.selectedTileId)

  const playerCount = gameState.playerCount ?? 4
  const boneyardCount = gameState.boneyardCount ?? 0
  const is2Player = playerCount === 2

  // Defensive: show boneyard draw if it's my turn, I have no valid plays, and boneyard has tiles
  // This covers edge cases where server didn't set awaitingBoneyardDraw
  const shouldAwaitDraw = awaitingBoneyardDraw || (isMyTurn && validPlays.length === 0 && boneyardCount > 0)

  const myTiles = players[myPlayerIndex]?.tiles ?? []
  const validPlayIds = new Set(validPlays.map(vp => vp.tileId))

  // When a tile is selected and can play on both ends, show end chooser
  const canPlayLeft = selectedTileId !== null && validPlays.some(vp => vp.tileId === selectedTileId && vp.targetEnd === 'left')
  const canPlayRight = selectedTileId !== null && validPlays.some(vp => vp.tileId === selectedTileId && vp.targetEnd === 'right')
  const showEndChooser = canPlayLeft && canPlayRight

  // CW layout: bottom=me, top=partner(4p)/opponent(2p), left/right=opponents(4p only)
  const topIndex = is2Player ? (myPlayerIndex + 1) % 2 : (myPlayerIndex + 2) % 4
  const leftIndex = is2Player ? -1 : (myPlayerIndex + 3) % 4
  const rightIndex = is2Player ? -1 : (myPlayerIndex + 1) % 4

  const topPlayer = players[topIndex]
  const leftPlayer = !is2Player && leftIndex >= 0 ? players[leftIndex] : undefined
  const rightPlayer = !is2Player && rightIndex >= 0 ? players[rightIndex] : undefined
  const myPlayer = players[myPlayerIndex]

  const currentPlayerName = players[currentPlayerIndex]?.name ?? ''

  const getPaso = (idx: number) => pasoNotifications.find(n => n.playerIndex === idx) ?? null

  // Helper to get call-related props for a seat
  function seatCallProps(playerIndex: number) {
    const isLocal = playerIndex === myPlayerIndex
    return {
      stream: isLocal ? localStream : (remoteStreams[playerIndex] ?? null),
      isSpeaking: speakingPeers[playerIndex] ?? false,
      isCameraOff: isLocal ? cameraOff : (cameraOffPeers[playerIndex] ?? false),
      isLocalPlayer: isLocal,
    }
  }

  return (
    <div className="flex flex-col overflow-hidden select-none game-room-bg" style={{ height: '100dvh', minHeight: isLandscape ? 0 : '-webkit-fill-available' }}>
      {/* Score bar */}
      <ScorePanel
        scores={scores}
        players={players}
        myPlayerIndex={myPlayerIndex}
        gameMode={gameMode}
        targetScore={targetScore}
        handNumber={handNumber}
        onClick={handleScoreBarClick}
        isOpen={showScoreHistory}
        compact={isLandscape}
      />

      {/* Score history panel */}
      <ScoreHistoryPanel
        isOpen={showScoreHistory}
        entries={scoreHistory}
        myPlayerIndex={myPlayerIndex}
        playerCount={playerCount}
        playerNames={players.map(p => p.name)}
        gameMode={gameMode}
      />

      {/* Main table area */}
      <div
        className="flex-1 overflow-hidden"
        style={{
          display: 'grid',
          gridTemplateRows: isLandscape ? 'minmax(0, auto) 1fr minmax(0, auto)' : 'auto 1fr auto',
          gridTemplateColumns: 'minmax(52px, auto) 1fr minmax(52px, auto)',
          minHeight: 0,
        }}
      >
        {/* Top-left corner */}
        <div />

        {/* Top opponent */}
        <div className={`flex flex-col items-center justify-start relative ${isLandscape ? 'pt-0.5 gap-0.5 overflow-hidden' : 'pt-1 gap-1'}`} data-seat="top">
          {topPlayer && (
            <>
              <PlayerSeat
                player={topPlayer}
                isCurrentTurn={currentPlayerIndex === topIndex}
                position={getPosition(topIndex, myPlayerIndex, playerCount)}
                {...teamInfo(topIndex, myPlayerIndex, playerCount, players)}
                {...seatCallProps(topIndex)}
                compact={isLandscape}
              />
              <AvatarReaction reactions={getReactions(topIndex)} position="top" />
              <OpponentHand player={topPlayer} position="top" compact={isLandscape} />
              {getPaso(topIndex) && (
                <PasoChip show playerName={topPlayer.name} bonusPoints={getPaso(topIndex)!.passBonusAwarded} />
              )}
              {getFloatingMessages(topIndex).map(msg => (
                <FloatingChatBubble key={msg.id} message={msg} />
              ))}
            </>
          )}
        </div>

        {/* Top-right corner */}
        <div />

        {/* Left opponent (4-player only) */}
        <div className="flex flex-col items-center justify-center gap-1 px-0.5 relative" data-seat="left">
          {!is2Player && leftPlayer && (
            <>
              <PlayerSeat
                player={leftPlayer}
                isCurrentTurn={currentPlayerIndex === leftIndex}
                position={getPosition(leftIndex, myPlayerIndex, playerCount)}
                {...teamInfo(leftIndex, myPlayerIndex, playerCount, players)}
                {...seatCallProps(leftIndex)}
              />
              <AvatarReaction reactions={getReactions(leftIndex)} position="left" />
              <OpponentHand player={leftPlayer} position="left" compact={isLandscape} />
              {getPaso(leftIndex) && (
                <PasoChip show playerName={leftPlayer.name} bonusPoints={getPaso(leftIndex)!.passBonusAwarded} />
              )}
              {getFloatingMessages(leftIndex).map(msg => (
                <FloatingChatBubble key={msg.id} message={msg} />
              ))}
            </>
          )}
        </div>

        {/* Board center */}
        <div className="relative overflow-hidden w-full h-full table-surface" data-board>
          <GameBoard board={board} />
          <TurnIndicator
            playerName={currentPlayerName}
            isMyTurn={isMyTurn}
          />
          {is2Player && (
            <BoneyardPile
              count={boneyardCount}
              awaitingDraw={shouldAwaitDraw}
              isMyTurn={isMyTurn}
              onDraw={drawFromBoneyard}
              currentPlayerName={players[currentPlayerIndex]?.name ?? ''}
            />
          )}
          {is2Player && (
            <BoneyardDrawAnimation
              myPlayerIndex={myPlayerIndex}
              playerCount={playerCount}
            />
          )}
        </div>

        {/* Right opponent (4-player only) */}
        <div className="flex flex-col items-center justify-center gap-1 px-0.5 relative" data-seat="right">
          {!is2Player && rightPlayer && (
            <>
              <PlayerSeat
                player={rightPlayer}
                isCurrentTurn={currentPlayerIndex === rightIndex}
                position={getPosition(rightIndex, myPlayerIndex, playerCount)}
                {...teamInfo(rightIndex, myPlayerIndex, playerCount, players)}
                {...seatCallProps(rightIndex)}
              />
              <AvatarReaction reactions={getReactions(rightIndex)} position="right" />
              <OpponentHand player={rightPlayer} position="right" compact={isLandscape} />
              {getPaso(rightIndex) && (
                <PasoChip show playerName={rightPlayer.name} bonusPoints={getPaso(rightIndex)!.passBonusAwarded} />
              )}
              {getFloatingMessages(rightIndex).map(msg => (
                <FloatingChatBubble key={msg.id} message={msg} />
              ))}
            </>
          )}
        </div>

        {/* Bottom-left corner */}
        <div />

        {/* My hand (bottom) */}
        <div className={`flex flex-col items-center justify-end relative ${isLandscape ? 'gap-0 overflow-hidden' : 'gap-1'}`} data-seat="bottom" style={{ paddingBottom: isLandscape ? 'max(2px, env(safe-area-inset-bottom))' : 'max(8px, env(safe-area-inset-bottom))' }}>
          {myPlayer && (
            <PlayerSeat
              player={myPlayer}
              isCurrentTurn={isMyTurn}
              position="bottom"
              compact={isLandscape}
              {...teamInfo(myPlayerIndex, myPlayerIndex, playerCount, players)}
              {...seatCallProps(myPlayerIndex)}
            />
          )}
          {!isLandscape && <AvatarReaction reactions={getReactions(myPlayerIndex)} position="bottom" />}
          {!isLandscape && getPaso(myPlayerIndex) && (
            <PasoChip show playerName={myPlayer?.name ?? ''} bonusPoints={getPaso(myPlayerIndex)!.passBonusAwarded} />
          )}
          {!isLandscape && getFloatingMessages(myPlayerIndex).map(msg => (
            <FloatingChatBubble key={msg.id} message={msg} />
          ))}
          {showEndChooser && (
            <div className="flex gap-2 mb-1">
              <button
                onClick={() => playTileOnEnd('left')}
                onTouchEnd={(e) => { e.preventDefault(); playTileOnEnd('left') }}
                className="flex items-center gap-1 rounded-full bg-surface border border-gold/40 text-gold font-bold font-body shadow-lg active:scale-90 transition-transform px-3 py-1.5 text-sm"
                style={{ touchAction: 'manipulation' }}
              >
                ◀ <span className="font-header text-lg">{board.leftEnd}</span>
              </button>
              <button
                onClick={() => playTileOnEnd('right')}
                onTouchEnd={(e) => { e.preventDefault(); playTileOnEnd('right') }}
                className="flex items-center gap-1 rounded-full bg-surface border border-gold/40 text-gold font-bold font-body shadow-lg active:scale-90 transition-transform px-3 py-1.5 text-sm"
                style={{ touchAction: 'manipulation' }}
              >
                <span className="font-header text-lg">{board.rightEnd}</span> ▶
              </button>
            </div>
          )}
          <PlayerHand
            tiles={myTiles}
            validPlayIds={validPlayIds}
            isMyTurn={isMyTurn}
            forcedFirstTileId={forcedFirstTileId}
            compact={isLandscape}
          />
        </div>

        {/* Bottom-right corner */}
        <div />
      </div>

      {/* Remote audio elements — always rendered when in call to prevent audio loss */}
      {(myAudioEnabled || myVideoEnabled) && (
        <>
          {Object.entries(remoteStreams).map(([idx, stream]) => (
            <RemoteAudio key={`audio-${idx}`} stream={stream} />
          ))}
        </>
      )}

      {/* SFX toggle + Join call button */}
      <AudioControls />
      <JoinCallButton />

      {/* Overlays */}
      <RoundEndModal />
      <GameEndModal />
    </div>
  )
}

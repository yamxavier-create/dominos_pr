import { useEffect, useRef, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { socket } from '../../socket'
import { leaveRoomLocally } from '../../store/leaveRoom'
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
import { SocialDock, MediaDock } from './GameDock'
import { TurnIndicator } from '../player/TurnIndicator'
import { TurnStatus } from '../player/TurnStatus'
import { CameraSeat } from '../player/CameraSeat'
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
import { useIsDesktop } from '../../hooks/useIsDesktop'

/** Camera background and label for a seat, relative to me: my side is green, rivals red */
function teamInfo(playerIndex: number, myPlayerIndex: number, playerCount: number, players: { name: string }[]) {
  if (playerCount === 2) {
    return {
      teamLabel: players[playerIndex]?.name ?? (playerIndex === 0 ? 'J1' : 'J2'),
      teamColor: playerIndex === myPlayerIndex ? '#1B5E3A' : '#8E2A22',
    }
  }
  const sameTeam = playerIndex % 2 === myPlayerIndex % 2
  return {
    teamLabel: playerIndex === myPlayerIndex ? 'Tú' : sameTeam ? 'Pareja' : 'Rival',
    teamColor: sameTeam ? '#1B5E3A' : '#8E2A22',
  }
}

function LeaveGameButton({ compact }: { compact?: boolean }) {
  const navigate = useNavigate()
  const [confirming, setConfirming] = useState(false)

  const handleLeave = () => {
    socket.emit('room:leave')
    leaveRoomLocally()
    navigate('/')
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="club-btn shrink-0 self-stretch"
        style={{ width: compact ? 34 : 44 }}
        aria-label="Salir del juego"
        title="Salir del juego"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M15 5l-7 7 7 7" />
        </svg>
      </button>

      {confirming && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div
            className="modal-enter w-full max-w-xs rounded-2xl overflow-hidden text-center"
            style={{ background: '#0F2318', border: '1px solid rgba(255,255,255,0.10)' }}
          >
            <div className="px-6 pt-6 pb-3">
              <div className="text-4xl mb-2">🚪</div>
              <h2 className="font-header text-2xl text-white leading-tight">¿Salir del juego?</h2>
              <p className="font-body text-white/60 text-sm mt-2">
                Vas a abandonar la partida y volver al menu principal.
              </p>
            </div>
            <div className="flex gap-2 px-4 pb-5 pt-2">
              <button
                onClick={() => setConfirming(false)}
                className="flex-1 px-4 py-3 rounded-xl font-body font-bold text-white bg-white/10 border border-white/15 active:scale-95 transition-transform"
              >
                Cancelar
              </button>
              <button
                onClick={handleLeave}
                className="flex-1 px-4 py-3 rounded-xl font-body font-bold text-white active:scale-95 transition-transform"
                style={{ background: 'linear-gradient(135deg, #DC2626, #B91C1C)' }}
              >
                Salir
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
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
  const isDesktop = useIsDesktop()
  // Compact layout is for phones held sideways; a desktop screen is landscape but has room
  const compact = isLandscape && !isDesktop
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

  const portrait = !compact && !isDesktop
  const nextPlayerName = players[(currentPlayerIndex + 1) % playerCount]?.name ?? ''

  const overlaysFor = (idx: number, seat: 'top' | 'left' | 'right', anchored: boolean) => (
    <>
      {getPaso(idx) && (
        <PasoChip show seat={seat} anchored={anchored} playerName={players[idx]?.name ?? ''} bonusPoints={getPaso(idx)!.passBonusAwarded} />
      )}
      {getFloatingMessages(idx).map(msg => (
        <FloatingChatBubble key={msg.id} message={msg} />
      ))}
    </>
  )

  const board_ = (
    <div className={`club-rail min-h-0 ${portrait || compact ? 'flex-1' : 'w-full h-full'}`} style={compact ? { padding: 6, borderRadius: 10 } : undefined}>
      <div className="club-felt relative overflow-hidden w-full h-full" data-board>
        <GameBoard board={board} allowZoom={isDesktop} />
        {!portrait && <TurnIndicator playerName={currentPlayerName} isMyTurn={isMyTurn} />}
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
    </div>
  )

  const endChooser = showEndChooser && (
    <div className="flex justify-center gap-2 mb-1" role="group" aria-label="¿En qué punta?">
      <button
        type="button"
        onClick={() => playTileOnEnd('left')}
        onTouchEnd={(e) => { e.preventDefault(); playTileOnEnd('left') }}
        className="club-btn gap-1.5 px-3 h-9 font-club font-bold text-sm"
        aria-label={`Jugar en la punta ${board.leftEnd}`}
      >
        ◀ <span className="font-club-display text-base">{board.leftEnd}</span>
      </button>
      <button
        type="button"
        onClick={() => playTileOnEnd('right')}
        onTouchEnd={(e) => { e.preventDefault(); playTileOnEnd('right') }}
        className="club-btn gap-1.5 px-3 h-9 font-club font-bold text-sm"
        aria-label={`Jugar en la punta ${board.rightEnd}`}
      >
        <span className="font-club-display text-base">{board.rightEnd}</span> ▶
      </button>
    </div>
  )

  const hand = (
    <PlayerHand
      tiles={myTiles}
      validPlayIds={validPlayIds}
      isMyTurn={isMyTurn}
      forcedFirstTileId={forcedFirstTileId}
      compact={compact}
      large={isDesktop}
    />
  )

  return (
    <div className="fixed inset-0 flex flex-col overflow-hidden select-none game-room-bg font-club">
      {/* Top row: leave + score sign */}
      <div
        className={`flex items-stretch gap-2 ${compact ? 'px-2 pb-1' : 'px-3 pb-2.5'}`}
        style={{ paddingTop: `calc(${compact ? '0.25rem' : '0.875rem'} + var(--safe-top))` }}
      >
        <LeaveGameButton compact={compact} />
        <ScorePanel
          scores={scores}
          players={players}
          myPlayerIndex={myPlayerIndex}
          gameMode={gameMode}
          targetScore={targetScore}
          handNumber={handNumber}
          onClick={handleScoreBarClick}
          isOpen={showScoreHistory}
          compact={compact}
          showTeamNames={isDesktop}
        />
      </div>

      {/* Score history panel */}
      <ScoreHistoryPanel
        isOpen={showScoreHistory}
        entries={scoreHistory}
        myPlayerIndex={myPlayerIndex}
        playerCount={playerCount}
        playerNames={players.map(p => p.name)}
        gameMode={gameMode}
      />

      {portrait ? (
        /* ─── Phone portrait: «mesa de club» ─── */
        <div
          className="flex-1 min-h-0 flex flex-col gap-2.5 px-3"
          style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom, 0px))' }}
        >
          {/* Everyone's camera in one row, same size: you · rival · partner · rival (2 players: you · rival) */}
          <div className={`grid ${is2Player ? 'grid-cols-2 px-[12%]' : 'grid-cols-4'} gap-1.5 relative z-20`}>
            {myPlayer && (
              <CameraSeat
                player={myPlayer}
                isSelf
                isPartner
                isCurrentTurn={isMyTurn}
                stream={seatCallProps(myPlayerIndex).stream}
                isCameraOff={seatCallProps(myPlayerIndex).isCameraOff}
                isSpeaking={seatCallProps(myPlayerIndex).isSpeaking}
              />
            )}
            {!is2Player && leftPlayer && (
              <CameraSeat
                seat="left"
                player={leftPlayer}
                isPartner={false}
                isCurrentTurn={currentPlayerIndex === leftIndex}
                stream={seatCallProps(leftIndex).stream}
                isCameraOff={seatCallProps(leftIndex).isCameraOff}
                isSpeaking={seatCallProps(leftIndex).isSpeaking}
              >
                {overlaysFor(leftIndex, 'left', true)}
              </CameraSeat>
            )}
            {topPlayer && (
              <div>
                <CameraSeat
                  seat="top"
                  player={topPlayer}
                  isPartner={!is2Player}
                  isCurrentTurn={currentPlayerIndex === topIndex}
                  stream={seatCallProps(topIndex).stream}
                  isCameraOff={seatCallProps(topIndex).isCameraOff}
                  isSpeaking={seatCallProps(topIndex).isSpeaking}
                >
                  {overlaysFor(topIndex, 'top', true)}
                </CameraSeat>
              </div>
            )}
            {!is2Player && rightPlayer && (
              <CameraSeat
                seat="right"
                player={rightPlayer}
                isPartner={false}
                isCurrentTurn={currentPlayerIndex === rightIndex}
                stream={seatCallProps(rightIndex).stream}
                isCameraOff={seatCallProps(rightIndex).isCameraOff}
                isSpeaking={seatCallProps(rightIndex).isSpeaking}
              >
                {overlaysFor(rightIndex, 'right', true)}
              </CameraSeat>
            )}
          </div>
          <AvatarReaction reactions={getReactions(topIndex)} position="top" offset={{ dx: 0, dy: 70 }} />
          {!is2Player && <AvatarReaction reactions={getReactions(leftIndex)} position="left" offset={{ dx: 0, dy: 70 }} />}
          {!is2Player && <AvatarReaction reactions={getReactions(rightIndex)} position="right" offset={{ dx: 0, dy: 70 }} />}

          {board_}

          <TurnStatus
            isMyTurn={isMyTurn}
            currentPlayerName={currentPlayerName}
            nextPlayerName={nextPlayerName}
            leftEnd={board.leftEnd}
            rightEnd={board.rightEnd}
          />

          {/* My hand on the shelf. data-seat="bottom" anchors my animations and overlays */}
          <div className="relative min-w-0" data-seat="bottom">
            <div className="absolute inset-x-0 bottom-full mb-1 z-30 flex flex-col items-center gap-1 pointer-events-none">
              {getPaso(myPlayerIndex) && (
                <PasoChip show seat="bottom" anchored playerName={myPlayer?.name ?? ''} bonusPoints={getPaso(myPlayerIndex)!.passBonusAwarded} />
              )}
              {getFloatingMessages(myPlayerIndex).map(msg => (
                <FloatingChatBubble key={msg.id} message={msg} />
              ))}
            </div>
            <AvatarReaction reactions={getReactions(myPlayerIndex)} position="bottom" />
            {endChooser}
            {hand}
          </div>

          <div className="flex items-center justify-between gap-2">
            <SocialDock size={46} direction="row" />
            <MediaDock size={46} direction="row" callControls />
          </div>
        </div>
      ) : compact ? (
        /* ─── Phone landscape: the four cameras in a 2×2 block, table and hand beside it ─── */
        <div
          className="flex-1 min-h-0 flex gap-2 px-2"
          style={{ paddingBottom: 'calc(0.25rem + env(safe-area-inset-bottom, 0px))' }}
        >
          <div
            className={`grid ${is2Player ? 'grid-cols-1' : 'grid-cols-2'} grid-rows-2 gap-1.5 shrink-0 min-h-0 relative z-20`}
            style={{ width: is2Player ? 120 : 236 }}
          >
            {myPlayer && (
              <CameraSeat
                fill
                overlay="over"
                player={myPlayer}
                isSelf
                isPartner
                isCurrentTurn={isMyTurn}
                stream={seatCallProps(myPlayerIndex).stream}
                isCameraOff={seatCallProps(myPlayerIndex).isCameraOff}
                isSpeaking={seatCallProps(myPlayerIndex).isSpeaking}
              />
            )}
            {!is2Player && leftPlayer && (
              <CameraSeat
                fill
                overlay="over"
                seat="left"
                player={leftPlayer}
                isPartner={false}
                isCurrentTurn={currentPlayerIndex === leftIndex}
                stream={seatCallProps(leftIndex).stream}
                isCameraOff={seatCallProps(leftIndex).isCameraOff}
                isSpeaking={seatCallProps(leftIndex).isSpeaking}
              >
                {overlaysFor(leftIndex, 'left', true)}
              </CameraSeat>
            )}
            {topPlayer && (
              <CameraSeat
                fill
                overlay="over"
                seat="top"
                player={topPlayer}
                isPartner={!is2Player}
                isCurrentTurn={currentPlayerIndex === topIndex}
                stream={seatCallProps(topIndex).stream}
                isCameraOff={seatCallProps(topIndex).isCameraOff}
                isSpeaking={seatCallProps(topIndex).isSpeaking}
              >
                {overlaysFor(topIndex, 'top', true)}
              </CameraSeat>
            )}
            {!is2Player && rightPlayer && (
              <CameraSeat
                fill
                overlay="over"
                seat="right"
                player={rightPlayer}
                isPartner={false}
                isCurrentTurn={currentPlayerIndex === rightIndex}
                stream={seatCallProps(rightIndex).stream}
                isCameraOff={seatCallProps(rightIndex).isCameraOff}
                isSpeaking={seatCallProps(rightIndex).isSpeaking}
              >
                {overlaysFor(rightIndex, 'right', true)}
              </CameraSeat>
            )}
          </div>
          <AvatarReaction reactions={getReactions(topIndex)} position="top" offset={{ dx: 0, dy: 0 }} />
          {!is2Player && <AvatarReaction reactions={getReactions(leftIndex)} position="left" offset={{ dx: 0, dy: 0 }} />}
          {!is2Player && <AvatarReaction reactions={getReactions(rightIndex)} position="right" offset={{ dx: 0, dy: 0 }} />}

          {/* Table, and my hand on its shelf below it */}
          <div className="flex-1 min-w-0 min-h-0 flex flex-col gap-1">
            {board_}
            <div className="relative min-w-0 shrink-0" data-seat="bottom">
              <div className="absolute inset-x-0 bottom-full mb-1 z-30 flex flex-col items-center gap-1 pointer-events-none">
                {getPaso(myPlayerIndex) && (
                  <PasoChip show seat="bottom" anchored playerName={myPlayer?.name ?? ''} bonusPoints={getPaso(myPlayerIndex)!.passBonusAwarded} />
                )}
                {getFloatingMessages(myPlayerIndex).map(msg => (
                  <FloatingChatBubble key={msg.id} message={msg} />
                ))}
              </div>
              <AvatarReaction reactions={getReactions(myPlayerIndex)} position="bottom" />
              {endChooser}
              {hand}
            </div>
          </div>

          {/* Buttons down the edge; my seat isn't drawn, so mic/camera live here too */}
          <div className="shrink-0 flex flex-col justify-between py-0.5">
            <SocialDock size={34} direction="column" />
            <MediaDock size={34} direction="column" callControls />
          </div>
        </div>
      ) : (
      /* ─── Desktop: the original grid, in the club materials ─── */
      <div
        className="flex-1 overflow-hidden"
        style={{
          display: 'grid',
          gridTemplateRows: compact ? 'minmax(0, auto) 1fr minmax(0, auto)' : 'auto 1fr auto',
          // minmax(0, …) lets the center shrink instead of pushing the side columns off screen
          gridTemplateColumns: 'minmax(52px, auto) minmax(0, 1fr) minmax(52px, auto)',
          minHeight: 0,
          // Keep the hand and the corner controls above the home indicator and
          // out of the rounded screen corners on iPhone (0 everywhere else)
          paddingBottom: `calc(${compact ? '0.25rem' : '0.75rem'} + env(safe-area-inset-bottom, 0px))`,
        }}
      >
        {/* Top-left corner */}
        <div />

        {/* Top opponent */}
        <div className={`flex flex-col items-center justify-start relative ${compact ? 'pt-0.5 gap-0.5 overflow-hidden' : 'pt-1 gap-1'}`} data-seat="top">
          {topPlayer && (
            <>
              <PlayerSeat
                large={isDesktop}
                player={topPlayer}
                isCurrentTurn={currentPlayerIndex === topIndex}
                position={getPosition(topIndex, myPlayerIndex, playerCount)}
                {...teamInfo(topIndex, myPlayerIndex, playerCount, players)}
                {...seatCallProps(topIndex)}
                compact={compact}
              />
              <AvatarReaction reactions={getReactions(topIndex)} position="top" />
              <OpponentHand player={topPlayer} position="top" compact={compact} large={isDesktop} />
              {overlaysFor(topIndex, 'top', false)}
            </>
          )}
        </div>

        {/* Top-right corner */}
        <div />

        {/* Left opponent (4-player only) */}
        <div className={`flex flex-col items-center justify-center gap-1 relative ${isDesktop ? 'px-4' : 'px-0.5'}`} data-seat="left">
          {!is2Player && leftPlayer && (
            <>
              <PlayerSeat
                large={isDesktop}
                player={leftPlayer}
                isCurrentTurn={currentPlayerIndex === leftIndex}
                position={getPosition(leftIndex, myPlayerIndex, playerCount)}
                {...teamInfo(leftIndex, myPlayerIndex, playerCount, players)}
                {...seatCallProps(leftIndex)}
              />
              <AvatarReaction reactions={getReactions(leftIndex)} position="left" />
              <OpponentHand player={leftPlayer} position="left" compact={compact} large={isDesktop} />
              {overlaysFor(leftIndex, 'left', false)}
            </>
          )}
        </div>

        {/* Board center */}
        <div className={`relative min-h-0 min-w-0 ${compact ? 'p-0.5' : 'p-1'}`}>
          {board_}
        </div>

        {/* Right opponent (4-player only) */}
        <div className={`flex flex-col items-center justify-center gap-1 relative ${isDesktop ? 'px-4' : 'px-0.5'}`} data-seat="right">
          {!is2Player && rightPlayer && (
            <>
              <PlayerSeat
                large={isDesktop}
                player={rightPlayer}
                isCurrentTurn={currentPlayerIndex === rightIndex}
                position={getPosition(rightIndex, myPlayerIndex, playerCount)}
                {...teamInfo(rightIndex, myPlayerIndex, playerCount, players)}
                {...seatCallProps(rightIndex)}
              />
              <AvatarReaction reactions={getReactions(rightIndex)} position="right" />
              <OpponentHand player={rightPlayer} position="right" compact={compact} large={isDesktop} />
              {overlaysFor(rightIndex, 'right', false)}
            </>
          )}
        </div>

        {/* Bottom-left corner: chat + reactions */}
        <div className={`flex items-end justify-center ${compact ? 'pb-1 px-1' : 'pb-2 px-1.5'}`}>
          <SocialDock size={isDesktop ? 46 : 34} direction="column" />
        </div>

        {/* My hand (bottom) */}
        <div className={`flex flex-col items-center justify-end relative min-w-0 ${compact ? 'gap-0 overflow-hidden' : 'gap-1'}`} data-seat="bottom">
          {myPlayer && (
            <PlayerSeat
              large={isDesktop}
              player={myPlayer}
              isCurrentTurn={isMyTurn}
              position="bottom"
              compact={compact}
              {...teamInfo(myPlayerIndex, myPlayerIndex, playerCount, players)}
              {...seatCallProps(myPlayerIndex)}
            />
          )}
          {!compact && <AvatarReaction reactions={getReactions(myPlayerIndex)} position="bottom" />}
          {!compact && getPaso(myPlayerIndex) && (
            <PasoChip show seat="bottom" playerName={myPlayer?.name ?? ''} bonusPoints={getPaso(myPlayerIndex)!.passBonusAwarded} />
          )}
          {!compact && getFloatingMessages(myPlayerIndex).map(msg => (
            <FloatingChatBubble key={msg.id} message={msg} />
          ))}
          {endChooser}
          {hand}
        </div>

        {/* Bottom-right corner: call + sound */}
        <div className={`flex items-end justify-center ${compact ? 'pb-1 px-1' : 'pb-2 px-1.5'}`}>
          <MediaDock size={isDesktop ? 46 : 34} direction="column" />
        </div>
      </div>
      )}

      {/* Remote audio elements — always rendered when in call to prevent audio loss */}
      {(myAudioEnabled || myVideoEnabled) && (
        <>
          {Object.entries(remoteStreams).map(([idx, stream]) => (
            <RemoteAudio key={`audio-${idx}`} stream={stream} />
          ))}
        </>
      )}

      {/* Overlays */}
      <RoundEndModal />
      <GameEndModal />
    </div>
  )
}

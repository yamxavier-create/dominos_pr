import { useEffect, useRef } from 'react'
import { useGameStore } from '../../store/gameStore'
import { useRoomStore } from '../../store/roomStore'
import { useUIStore } from '../../store/uiStore'
import { useCallStore } from '../../store/callStore'
import { useSpeakingDetection } from '../../hooks/useSpeakingDetection'
import { getPosition } from '../../hooks/usePlayerPositions'
import { GameBoard } from '../board/GameBoard'
import { PlayerHand } from '../player/PlayerHand'
import { OpponentHand } from '../player/OpponentHand'
import { PlayerSeat } from '../player/PlayerSeat'
import { JoinCallButton } from './JoinCallButton'
import { SfxToggleButton } from './SfxToggleButton'
import { TurnIndicator } from '../player/TurnIndicator'
import { ScorePanel } from './ScorePanel'
import { ScoreHistoryPanel } from './ScoreHistoryPanel'
import { BoneyardPile } from './BoneyardPile'
import { BoneyardDrawAnimation } from './BoneyardDrawAnimation'
import { PasoChip } from './PasoChip'
import { RoundEndModal } from './RoundEndModal'
import { GameEndModal } from './GameEndModal'

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

  // Call store subscriptions
  const localStream = useCallStore(s => s.localStream)
  const remoteStreams = useCallStore(s => s.remoteStreams)
  const speakingPeers = useCallStore(s => s.speakingPeers)
  const cameraOffPeers = useCallStore(s => s.cameraOffPeers)
  const cameraOff = useCallStore(s => s.cameraOff)
  const myAudioEnabled = useCallStore(s => s.myAudioEnabled)
  const myVideoEnabled = useCallStore(s => s.myVideoEnabled)

  // Speaking detection
  useSpeakingDetection(remoteStreams, localStream, myPlayerIndex)

  useEffect(() => {
    if (showRoundEnd) setShowScoreHistory(false)
  }, [showRoundEnd, setShowScoreHistory])

  const handleScoreBarClick = () => setShowScoreHistory(!showScoreHistory)

  if (!gameState) {
    return (
      <div className="flex items-center justify-center h-screen bg-bg">
        <p className="font-body text-white/50">Cargando partida...</p>
      </div>
    )
  }

  const { players, board, currentPlayerIndex, scores, gameMode, targetScore, handNumber, validPlays, isMyTurn, forcedFirstTileId } = gameState

  const playerCount = gameState.playerCount ?? 4
  const boneyardCount = gameState.boneyardCount ?? 0
  const is2Player = playerCount === 2

  const myTiles = players[myPlayerIndex]?.tiles ?? []
  const validPlayIds = new Set(validPlays.map(vp => vp.tileId))

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
    <div className="flex flex-col h-screen overflow-hidden select-none felt-table">
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
      />

      {/* Score history panel */}
      <ScoreHistoryPanel
        isOpen={showScoreHistory}
        entries={scoreHistory}
        myPlayerIndex={myPlayerIndex}
        playerCount={playerCount}
        playerNames={players.map(p => p.name)}
      />

      {/* Main table area */}
      <div
        className="flex-1 overflow-hidden"
        style={{
          display: 'grid',
          gridTemplateRows: 'auto 1fr auto',
          gridTemplateColumns: 'auto 1fr auto',
        }}
      >
        {/* Top-left corner */}
        <div />

        {/* Top opponent */}
        <div className="flex flex-col items-center justify-start pt-1 gap-1 relative">
          {topPlayer && (
            <>
              <PlayerSeat
                player={topPlayer}
                isCurrentTurn={currentPlayerIndex === topIndex}
                position={getPosition(topIndex, myPlayerIndex, playerCount)}
                {...teamInfo(topIndex, myPlayerIndex, playerCount, players)}
                {...seatCallProps(topIndex)}
              />
              <OpponentHand player={topPlayer} position="top" />
              {getPaso(topIndex) && (
                <PasoChip show playerName={topPlayer.name} bonusPoints={getPaso(topIndex)!.passBonusAwarded} />
              )}
            </>
          )}
        </div>

        {/* Top-right corner */}
        <div />

        {/* Left opponent (4-player only) */}
        <div className="flex flex-col items-center justify-center gap-1 px-1 relative">
          {!is2Player && leftPlayer && (
            <>
              <PlayerSeat
                player={leftPlayer}
                isCurrentTurn={currentPlayerIndex === leftIndex}
                position={getPosition(leftIndex, myPlayerIndex, playerCount)}
                {...teamInfo(leftIndex, myPlayerIndex, playerCount, players)}
                {...seatCallProps(leftIndex)}
              />
              <OpponentHand player={leftPlayer} position="left" />
              {getPaso(leftIndex) && (
                <PasoChip show playerName={leftPlayer.name} bonusPoints={getPaso(leftIndex)!.passBonusAwarded} />
              )}
            </>
          )}
        </div>

        {/* Board center */}
        <div className="relative overflow-hidden w-full h-full">
          <GameBoard board={board} validPlays={validPlays} />
          <TurnIndicator
            playerName={currentPlayerName}
            isMyTurn={isMyTurn}
          />
          {is2Player && <BoneyardPile count={boneyardCount} className="absolute bottom-2 right-2 z-10" />}
          {is2Player && (
            <BoneyardDrawAnimation
              myPlayerIndex={myPlayerIndex}
              playerCount={playerCount}
            />
          )}
        </div>

        {/* Right opponent (4-player only) */}
        <div className="flex flex-col items-center justify-center gap-1 px-1 relative">
          {!is2Player && rightPlayer && (
            <>
              <PlayerSeat
                player={rightPlayer}
                isCurrentTurn={currentPlayerIndex === rightIndex}
                position={getPosition(rightIndex, myPlayerIndex, playerCount)}
                {...teamInfo(rightIndex, myPlayerIndex, playerCount, players)}
                {...seatCallProps(rightIndex)}
              />
              <OpponentHand player={rightPlayer} position="right" />
              {getPaso(rightIndex) && (
                <PasoChip show playerName={rightPlayer.name} bonusPoints={getPaso(rightIndex)!.passBonusAwarded} />
              )}
            </>
          )}
        </div>

        {/* Bottom-left corner */}
        <div />

        {/* My hand (bottom) */}
        <div className="flex flex-col items-center justify-end pb-2 gap-1 relative">
          {myPlayer && (
            <PlayerSeat
              player={myPlayer}
              isCurrentTurn={isMyTurn}
              position="bottom"
              {...teamInfo(myPlayerIndex, myPlayerIndex, playerCount, players)}
              {...seatCallProps(myPlayerIndex)}
            />
          )}
          {getPaso(myPlayerIndex) && (
            <PasoChip show playerName={myPlayer?.name ?? ''} bonusPoints={getPaso(myPlayerIndex)!.passBonusAwarded} />
          )}
          <PlayerHand
            tiles={myTiles}
            validPlayIds={validPlayIds}
            isMyTurn={isMyTurn}
            forcedFirstTileId={forcedFirstTileId}
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
      <SfxToggleButton />
      <JoinCallButton />

      {/* Overlays */}
      <RoundEndModal />
      <GameEndModal />
    </div>
  )
}

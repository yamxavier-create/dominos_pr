import { useEffect } from 'react'
import { useGameStore } from '../../store/gameStore'
import { useRoomStore } from '../../store/roomStore'
import { useUIStore } from '../../store/uiStore'
import { getPosition } from '../../hooks/usePlayerPositions'
import { GameBoard } from '../board/GameBoard'
import { PlayerHand } from '../player/PlayerHand'
import { OpponentHand } from '../player/OpponentHand'
import { VideoTile } from '../player/VideoTile'
import { useCallStore } from '../../store/callStore'
import { TurnIndicator } from '../player/TurnIndicator'
import { ScorePanel } from './ScorePanel'
import { ScoreHistoryPanel } from './ScoreHistoryPanel'
import { PasoChip } from './PasoChip'
import { RoundEndModal } from './RoundEndModal'
import { GameEndModal } from './GameEndModal'

function teamInfo(playerIndex: number) {
  const isTeamA = playerIndex % 2 === 0
  return {
    teamLabel: isTeamA ? 'Equipo A' : 'Equipo B',
    teamColor: isTeamA ? '#22C55E' : '#F97316',
  }
}

export function GameTable() {
  const gameState = useGameStore(s => s.gameState)
  const scoreHistory = useGameStore(s => s.scoreHistory)
  const myPlayerIndex = useRoomStore(s => s.myPlayerIndex) ?? 0
  const pasoNotifications = useUIStore(s => s.pasoNotifications)
  const showScoreHistory = useUIStore(s => s.showScoreHistory)
  const setShowScoreHistory = useUIStore(s => s.setShowScoreHistory)
  const showRoundEnd = useUIStore(s => s.showRoundEnd)

  const localStream = useCallStore(s => s.localStream)
  const remoteStreams = useCallStore(s => s.remoteStreams)
  const mutedPeers = useCallStore(s => s.mutedPeers)
  const cameraOffPeers = useCallStore(s => s.cameraOffPeers)

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

  const myTiles = players[myPlayerIndex]?.tiles ?? []
  const validPlayIds = new Set(validPlays.map(vp => vp.tileId))

  // CW layout: bottom=me, left=+3, top=+2, right=+1
  const topIndex = (myPlayerIndex + 2) % 4
  const leftIndex = (myPlayerIndex + 3) % 4
  const rightIndex = (myPlayerIndex + 1) % 4

  const topPlayer = players[topIndex]
  const leftPlayer = players[leftIndex]
  const rightPlayer = players[rightIndex]
  const myPlayer = players[myPlayerIndex]

  const currentPlayerName = players[currentPlayerIndex]?.name ?? ''

  const getPaso = (idx: number) => pasoNotifications.find(n => n.playerIndex === idx) ?? null

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
              <VideoTile
                player={topPlayer}
                playerIndex={topIndex}
                isMe={false}
                isCurrentTurn={currentPlayerIndex === topIndex}
                position={getPosition(topIndex, myPlayerIndex)}
                stream={remoteStreams[topIndex] ?? null}
                micMuted={mutedPeers[topIndex] ?? false}
                cameraOff={cameraOffPeers[topIndex] ?? false}
                {...teamInfo(topIndex)}
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

        {/* Left opponent */}
        <div className="flex flex-col items-center justify-center gap-1 px-1 relative">
          {leftPlayer && (
            <>
              <VideoTile
                player={leftPlayer}
                playerIndex={leftIndex}
                isMe={false}
                isCurrentTurn={currentPlayerIndex === leftIndex}
                position={getPosition(leftIndex, myPlayerIndex)}
                stream={remoteStreams[leftIndex] ?? null}
                micMuted={mutedPeers[leftIndex] ?? false}
                cameraOff={cameraOffPeers[leftIndex] ?? false}
                {...teamInfo(leftIndex)}
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
        </div>

        {/* Right opponent */}
        <div className="flex flex-col items-center justify-center gap-1 px-1 relative">
          {rightPlayer && (
            <>
              <VideoTile
                player={rightPlayer}
                playerIndex={rightIndex}
                isMe={false}
                isCurrentTurn={currentPlayerIndex === rightIndex}
                position={getPosition(rightIndex, myPlayerIndex)}
                stream={remoteStreams[rightIndex] ?? null}
                micMuted={mutedPeers[rightIndex] ?? false}
                cameraOff={cameraOffPeers[rightIndex] ?? false}
                {...teamInfo(rightIndex)}
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
            <VideoTile
              player={myPlayer}
              playerIndex={myPlayerIndex}
              isMe={true}
              isCurrentTurn={isMyTurn}
              position="bottom"
              stream={localStream}
              micMuted={false}
              cameraOff={false}
              {...teamInfo(myPlayerIndex)}
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

      {/* Overlays */}
      <RoundEndModal />
      <GameEndModal />
    </div>
  )
}

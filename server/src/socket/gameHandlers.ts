import { Socket, Server } from 'socket.io'
import { RoomManager } from '../game/RoomManager'
import {
  ServerGameState,
  BoardState,
  TeamScores,
} from '../game/GameState'
import {
  generateDoubleSixSet,
  shuffleTiles,
  dealTiles,
  findFirstPlayer,
  nextPlayerIndex,
  playerTeam,
  getValidPlays,
  applyTileToBoard,
  isGameBlocked,
  calculatePlayOutPoints,
  calculateBlockedResult,
  calculateMode500Bonuses,
  applyPassBonus200,
  applyScore,
  scoresReachedTarget,
  isCapicu,
  isChuchazo,
  buildClientGameState,
  handPipSum,
  calculateBlockedResult200,
} from '../game/GameEngine'

/**
 * Sync game player socket IDs from room players.
 * Handles cases where sockets reconnected and got new IDs during the game.
 */
function syncPlayerSocketIds(game: ServerGameState, rooms: RoomManager) {
  const room = rooms.getRoom(game.roomCode)
  if (!room) return
  for (const rp of room.players) {
    const gp = game.players.find(p => p.index === rp.seatIndex)
    if (gp) {
      gp.socketId = rp.socketId
      gp.connected = rp.connected
    }
  }
}

function broadcastState(io: Server, game: ServerGameState, rooms?: RoomManager) {
  if (rooms) syncPlayerSocketIds(game, rooms)
  for (const player of game.players) {
    if (!player.connected) continue
    const clientState = buildClientGameState(game, player.index)
    io.to(player.socketId).emit('game:state_snapshot', {
      gameState: clientState,
      lastAction: null,
    })
  }
}

function broadcastStateWithAction(
  io: Server,
  game: ServerGameState,
  lastAction: object
) {
  for (const player of game.players) {
    if (!player.connected) continue
    const clientState = buildClientGameState(game, player.index)
    io.to(player.socketId).emit('game:state_snapshot', {
      gameState: clientState,
      lastAction,
    })
  }
}

/**
 * After a tile is placed (or at game start), process auto-passes for players
 * who have no valid moves. Emits `game:player_passed` for each auto-pass.
 * Modifies game in place. Returns whether the game ended (blocked or score).
 */
function processAutoPassCascade(
  io: Server,
  game: ServerGameState,
  startPlayerIndex: number,
  tilePlayerIndex: number
): boolean {
  let idx = startPlayerIndex
  const playerCount = game.players.length
  const is2Player = playerCount === 2
  // Modo 200: the partner of the tile player gets pass protection.
  // If the partner has to pass right after an opponent passes, that pass never
  // counts as a point — it was caused by their own teammate's play.
  // In 2-player mode there are no partners, so partnerOfTilePlayer = -1 (no partner).
  const partnerOfTilePlayer = is2Player ? -1 : (tilePlayerIndex + 2) % 4

  for (let i = 0; i < playerCount; i++) {
    const validPlays = getValidPlays(
      game.players[idx].tiles,
      game.board,
      game.firstPlayMade,
      game.forcedFirstTileId
    )

    if (validPlays.length > 0) {
      // This player can play — it's their turn
      game.currentPlayerIndex = idx
      return false
    }

    // Auto-pass this player
    let passBonusAwarded: number | null = null
    if (game.gameMode === 'modo200') {
      const isPartnerPass = idx === partnerOfTilePlayer

      if (!isPartnerPass) {
        // Normal opponent pass: award bonus
        passBonusAwarded = game.gamePassCount === 0 ? 2 : 1
        const updatedScores = applyPassBonus200(game.scores, idx, game.gamePassCount)
        game.scores = updatedScores
        game.gamePassCount++

        if (scoresReachedTarget(game.scores, game.targetScore)) {
          game.currentPlayerIndex = idx
          game.consecutivePasses++
          game.handPassCount++
          io.to(game.roomCode).emit('game:player_passed', {
            playerIndex: idx,
            playerName: game.players[idx].name,
            passBonusAwarded,
          })
          return handleGameEnd(io, game)
        }
      }
      // Partner pass: no bonus, no gamePassCount increment — pass is free
    }

    game.consecutivePasses++
    game.handPassCount++

    io.to(game.roomCode).emit('game:player_passed', {
      playerIndex: idx,
      playerName: game.players[idx].name,
      passBonusAwarded,
    })

    if (isGameBlocked(game.consecutivePasses, playerCount)) {
      game.currentPlayerIndex = idx
      return handleBlockedGame(io, game)
    }

    idx = nextPlayerIndex(idx, playerCount)
  }

  // All players can't play (shouldn't happen if isGameBlocked wasn't triggered)
  game.currentPlayerIndex = idx
  return handleBlockedGame(io, game)
}

function handleBlockedGame(io: Server, game: ServerGameState): boolean {
  const isModo200 = game.gameMode === 'modo200'
  let gameOver = false

  // Modo 200: +2 for team that caused the block (last tile player)
  let blockBonusPoints = 0
  if (isModo200) {
    const lastTile = game.board.tiles.reduce((a, b) => a.sequence > b.sequence ? a : b)
    const blockingTeam = playerTeam(lastTile.playedByIndex)
    blockBonusPoints = 2
    const blockResult = applyScore(game.scores, blockingTeam, 2, game.targetScore)
    game.scores = blockResult.updatedScores
    if (blockResult.gameOver) gameOver = true
  }

  // Determine winner — Modo 200 uses individual pips, Modo 500 uses team sums
  let winnerIndex: number | null = null
  let winningTeam: 0 | 1 | null
  let rawPips: number
  let pointsScored: number

  if (isModo200) {
    const result = calculateBlockedResult200(game.players)
    winnerIndex = result.winnerIndex
    winningTeam = result.winningTeam
    rawPips = result.pointsScored
    pointsScored = Math.round(rawPips / 10)
  } else {
    const result = calculateBlockedResult(game.players)
    winningTeam = result.winningTeam
    rawPips = result.pointsScored
    pointsScored = rawPips
  }

  // Apply winner's points
  let updatedScores = { ...game.scores }
  if (winningTeam !== null) {
    const scoreResult = applyScore(game.scores, winningTeam, pointsScored, game.targetScore)
    updatedScores = scoreResult.updatedScores
    if (scoreResult.gameOver) gameOver = true
    game.scores = updatedScores
  }

  // Winner of blocked hand starts next (individual winner in Modo 200)
  const nextStarter = winnerIndex ?? game.handStarterIndex
  game.handStarterIndex = nextStarter
  if (gameOver) game.gameWinnerIndex = nextStarter

  game.phase = gameOver ? 'game_end' : 'round_end'

  io.to(game.roomCode).emit('game:round_ended', {
    reason: 'blocked',
    winnerIndex,
    winningTeam,
    rawPipCount: rawPips,
    pointsFromPips: pointsScored,
    bonusPoints: blockBonusPoints,
    totalPointsScored: pointsScored + blockBonusPoints,
    remainingTiles: game.players.map(p => ({
      playerIndex: p.index,
      playerName: p.name,
      tiles: p.tiles,
      pipSum: handPipSum(p.tiles),
    })),
    isCapicu: false,
    isChuchazo: false,
    scores: updatedScores,
    nextStarterIndex: nextStarter,
  })

  if (gameOver) {
    game.phase = 'game_end'
    const winTeam = updatedScores.team0 >= game.targetScore ? 0 : 1
    io.to(game.roomCode).emit('game:game_ended', {
      winningTeam: winTeam,
      finalScores: updatedScores,
      totalRounds: game.handNumber,
    })
  }

  return true
}

function handleGameEnd(io: Server, game: ServerGameState): boolean {
  game.phase = 'game_end'
  game.gameWinnerIndex = game.handStarterIndex
  const winTeam = game.scores.team0 >= game.targetScore ? 0 : 1
  io.to(game.roomCode).emit('game:game_ended', {
    winningTeam: winTeam,
    finalScores: game.scores,
    totalRounds: game.handNumber,
  })
  return true
}

/**
 * Check if a disconnecting player should cancel an active rematch vote.
 * Called from the main disconnect handler in index.ts.
 */
export function checkRematchCancellation(
  io: Server,
  room: { roomCode: string; rematchVotes: number[]; game: ServerGameState | null },
  disconnectedSocketId: string
): void {
  if (!room.game || !room.rematchVotes || room.rematchVotes.length === 0) return

  const player = room.game.players.find(p => p.socketId === disconnectedSocketId)
  if (!player) return

  io.to(room.roomCode).emit('game:rematch_cancelled', {
    disconnectedPlayerIndex: player.index,
    disconnectedPlayerName: player.name,
  })
  room.rematchVotes = []
}

export function registerGameHandlers(socket: Socket, io: Server, rooms: RoomManager) {

  socket.on('game:start', ({ roomCode }: { roomCode: string }) => {
    const room = rooms.getRoom(roomCode)
    if (!room) return socket.emit('room:error', { code: 'ROOM_NOT_FOUND', message: 'Sala no encontrada' })
    if (room.hostSocketId !== socket.id) return socket.emit('room:error', { code: 'NOT_HOST', message: 'Solo el host puede iniciar' })
    if (room.players.length !== 2 && room.players.length !== 4) {
      return socket.emit('room:error', { code: 'NOT_ENOUGH_PLAYERS', message: 'Se necesitan 2 o 4 jugadores' })
    }

    const playerCount = room.players.length
    const tiles = shuffleTiles(generateDoubleSixSet())
    const { hands, boneyard } = dealTiles(tiles, playerCount)
    const { playerIndex: starterIdx, tile: forcedTile } = findFirstPlayer(hands)

    const game: ServerGameState = {
      roomCode,
      gameMode: room.gameMode,
      targetScore: room.gameMode === 'modo200' ? 20 : 500,
      phase: 'playing',
      handNumber: 1,
      players: room.players.map((rp, i) => ({
        index: i,
        socketId: rp.socketId,
        name: rp.name,
        tiles: hands[i],
        connected: rp.connected,
      })),
      board: { tiles: [], leftEnd: null, rightEnd: null },
      currentPlayerIndex: starterIdx,
      consecutivePasses: 0,
      handPassCount: 0,
      gamePassCount: 0,
      scores: { team0: 0, team1: 0 },
      handStarterIndex: starterIdx,
      firstPlayMade: false,
      forcedFirstTileId: forcedTile.id,
      gameWinnerIndex: starterIdx,
      boneyard,
    }

    room.game = game
    room.status = 'in_game'
    room.rematchVotes = []
    room.chatHistory = []

    // Send personalised game state to each player
    for (const player of game.players) {
      const clientState = buildClientGameState(game, player.index)
      io.to(player.socketId).emit('game:started', { gameState: clientState })
    }
  })

  socket.on('game:play_tile', ({ roomCode, tileId, targetEnd }: {
    roomCode: string
    tileId: string
    targetEnd: 'left' | 'right'
  }) => {
    const room = rooms.getRoom(roomCode)
    if (!room?.game) return

    const game = room.game
    if (game.phase !== 'playing') return

    // Identify which player this socket is
    const player = game.players.find(p => p.socketId === socket.id)
    if (!player) return
    if (player.index !== game.currentPlayerIndex) return

    // Verify the tile exists in the player's hand
    const tileIdx = player.tiles.findIndex(t => t.id === tileId)
    if (tileIdx === -1) return

    const tile = player.tiles[tileIdx]

    // Validate the play
    const validPlays = getValidPlays(player.tiles, game.board, game.firstPlayMade, game.forcedFirstTileId)
    const isValid = validPlays.some(vp => vp.tileId === tileId && vp.targetEnd === targetEnd)
    if (!isValid) return

    // Detect special moves BEFORE applying (board state before placement)
    const capicuTriggered = game.firstPlayMade && player.tiles.length === 1 && isCapicu(tile, game.board)
    const chuchazoTriggered = player.tiles.length === 1 && isChuchazo(tile)

    // Apply tile to board
    game.board = applyTileToBoard(game.board, tile, targetEnd, player.index)

    // Remove tile from hand
    player.tiles.splice(tileIdx, 1)

    // Reset consecutive passes (a tile was placed)
    game.consecutivePasses = 0
    game.firstPlayMade = true

    room.lastActivity = Date.now()

    // Check if this player won (emptied hand)
    if (player.tiles.length === 0) {
      const winningTeam = playerTeam(player.index)
      const rawPips = calculatePlayOutPoints(game.players, player.index)
      const pipsFromOthers = game.gameMode === 'modo200' ? Math.round(rawPips / 10) : rawPips

      let bonusPoints = 0
      if (game.gameMode === 'modo500') {
        bonusPoints = calculateMode500Bonuses(game.handNumber, capicuTriggered, chuchazoTriggered)
      }

      const totalPoints = pipsFromOthers + bonusPoints
      const { updatedScores, gameOver } = applyScore(
        game.scores,
        winningTeam,
        totalPoints,
        game.targetScore
      )
      game.scores = updatedScores
      game.phase = gameOver ? 'game_end' : 'round_end'
      // Winner of this hand starts the next hand/game
      game.handStarterIndex = player.index
      if (gameOver) game.gameWinnerIndex = player.index

      // Broadcast final state before emitting round_ended
      broadcastStateWithAction(io, game, {
        type: 'play_tile',
        playerIndex: player.index,
        tile,
        targetEnd,
      })

      io.to(roomCode).emit('game:round_ended', {
        reason: 'played_out',
        winnerIndex: player.index,
        winningTeam,
        rawPipCount: rawPips,
        pointsFromPips: pipsFromOthers,
        bonusPoints,
        totalPointsScored: totalPoints,
        remainingTiles: game.players.map(p => ({
          playerIndex: p.index,
          playerName: p.name,
          tiles: p.tiles,
          pipSum: handPipSum(p.tiles),
        })),
        isCapicu: capicuTriggered,
        isChuchazo: chuchazoTriggered,
        scores: updatedScores,
        nextStarterIndex: player.index,
      })

      if (gameOver) {
        io.to(roomCode).emit('game:game_ended', {
          winningTeam,
          finalScores: updatedScores,
          totalRounds: game.handNumber,
        })
      }
      return
    }

    // Broadcast the state update (tile placed)
    broadcastStateWithAction(io, game, {
      type: 'play_tile',
      playerIndex: player.index,
      tile,
      targetEnd,
    })

    // Process auto-pass cascade for next player(s)
    const nextIdx = nextPlayerIndex(player.index, game.players.length)
    const ended = processAutoPassCascade(io, game, nextIdx, player.index)
    if (!ended) {
      broadcastState(io, game)
    }
  })

  socket.on('game:next_hand', ({ roomCode }: { roomCode: string }) => {
    const room = rooms.getRoom(roomCode)
    if (!room?.game) return
    if (room.hostSocketId !== socket.id) return

    const game = room.game
    if (game.phase !== 'round_end') return

    // Start new hand
    const tiles = shuffleTiles(generateDoubleSixSet())
    const { hands, boneyard } = dealTiles(tiles, game.players.length)

    // Winner of previous hand starts the new hand
    const newStarterIdx = game.handStarterIndex

    game.handNumber++
    game.phase = 'playing'
    game.board = { tiles: [], leftEnd: null, rightEnd: null }
    game.consecutivePasses = 0
    game.handPassCount = 0
    game.boneyard = boneyard
    // gamePassCount intentionally NOT reset — it tracks total passes for the entire game (Modo 200 bonus)
    game.firstPlayMade = false

    // In subsequent hands, the previous hand winner starts
    // (already tracked as handStarterIndex)
    // But we still need the player who goes first to play first —
    // they don't have to play 6-6; they just start
    // HOWEVER: In PR dominoes, subsequent hands CAN still require 6-6 if they have it
    // Per user rules: "subsequent games: winner of previous game starts"
    // They play any tile, not forced to play 6-6 again
    // So for subsequent hands, the forcedFirstTileId tracks the highest tile of the starter
    // Actually, per user rules: first hand = whoever has 6-6 plays it. Subsequent hands = previous winner starts, plays freely.
    // We'll set firstPlayMade=false, forcedFirstTileId to a special marker for the starter
    // Simple approach: for hand 2+, starter can play any tile, so force is ignored
    // We'll mark forcedFirstTileId = '' to skip forced-tile logic
    // The getValidPlays handles !firstPlayMade correctly: if forcedFirstTileId = '', it returns all valid plays

    // Deal new tiles
    for (let i = 0; i < game.players.length; i++) {
      game.players[i].tiles = hands[i]
    }

    // Determine who starts: previous hand winner (stored in roundEndEvent nextStarterIndex)
    // For now, we'll use `handStarterIndex` from the last round_ended event
    game.currentPlayerIndex = newStarterIdx
    game.handStarterIndex = newStarterIdx
    game.forcedFirstTileId = ''  // no forced tile for subsequent hands

    // Sync socket IDs and send updated state
    syncPlayerSocketIds(game, rooms)
    for (const player of game.players) {
      const clientState = buildClientGameState(game, player.index)
      io.to(player.socketId).emit('game:state_snapshot', {
        gameState: clientState,
        lastAction: null,
      })
    }
  })

  socket.on('game:next_game', ({ roomCode }: { roomCode: string }) => {
    const room = rooms.getRoom(roomCode)
    if (!room?.game) return
    if (room.hostSocketId !== socket.id) return

    const game = room.game
    if (game.phase !== 'game_end') return

    // Shuffle and deal fresh tiles
    const tiles = shuffleTiles(generateDoubleSixSet())
    const { hands, boneyard } = dealTiles(tiles, game.players.length)

    // Winner of the previous game starts the next game, plays any tile freely
    const nextStarter = game.gameWinnerIndex

    // Reset full game state (scores, hand number, pass counts)
    game.phase = 'playing'
    game.handNumber = 1
    game.scores = { team0: 0, team1: 0 }
    game.board = { tiles: [], leftEnd: null, rightEnd: null }
    game.consecutivePasses = 0
    game.handPassCount = 0
    game.gamePassCount = 0
    game.boneyard = boneyard
    game.firstPlayMade = false
    game.currentPlayerIndex = nextStarter
    game.handStarterIndex = nextStarter
    game.gameWinnerIndex = nextStarter
    game.forcedFirstTileId = ''  // no forced tile — winner plays freely

    for (let i = 0; i < game.players.length; i++) {
      game.players[i].tiles = hands[i]
    }

    room.rematchVotes = []
    room.chatHistory = []

    // Sync socket IDs from room (handles reconnections during game)
    syncPlayerSocketIds(game, rooms)

    // Send personalised game state to each player
    for (const player of game.players) {
      const clientState = buildClientGameState(game, player.index)
      io.to(player.socketId).emit('game:started', { gameState: clientState })
    }
  })

  socket.on('game:rematch_vote', ({ roomCode }: { roomCode: string }) => {
    const room = rooms.getRoom(roomCode)
    if (!room?.game) return
    if (room.game.phase !== 'game_end') return

    const game = room.game
    const player = game.players.find(p => p.socketId === socket.id)
    if (!player) return

    if (!room.rematchVotes) room.rematchVotes = []
    if (room.rematchVotes.includes(player.index)) return

    room.rematchVotes.push(player.index)

    io.to(roomCode).emit('game:rematch_vote_update', {
      votes: room.rematchVotes,
      playerNames: game.players.map(p => p.name),
    })

    if (room.rematchVotes.length === game.players.length) {
      io.to(roomCode).emit('game:rematch_accepted', {})

      setTimeout(() => {
        // Reuse next_game logic: shuffle, deal, reset scores, same seats
        const tiles = shuffleTiles(generateDoubleSixSet())
        const { hands, boneyard } = dealTiles(tiles, game.players.length)
        const nextStarter = game.gameWinnerIndex

        game.phase = 'playing'
        game.handNumber = 1
        game.scores = { team0: 0, team1: 0 }
        game.board = { tiles: [], leftEnd: null, rightEnd: null }
        game.consecutivePasses = 0
        game.handPassCount = 0
        game.gamePassCount = 0
        game.boneyard = boneyard
        game.firstPlayMade = false
        game.currentPlayerIndex = nextStarter
        game.handStarterIndex = nextStarter
        game.gameWinnerIndex = nextStarter
        game.forcedFirstTileId = ''

        for (let i = 0; i < game.players.length; i++) {
          game.players[i].tiles = hands[i]
        }

        room.rematchVotes = []
        room.chatHistory = []
        syncPlayerSocketIds(game, rooms)

        for (const p of game.players) {
          const clientState = buildClientGameState(game, p.index)
          io.to(p.socketId).emit('game:started', { gameState: clientState })
        }
      }, 2000)
    }
  })
}

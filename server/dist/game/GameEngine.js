"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateDoubleSixSet = generateDoubleSixSet;
exports.shuffleTiles = shuffleTiles;
exports.dealTiles = dealTiles;
exports.findFirstPlayer = findFirstPlayer;
exports.nextPlayerIndex = nextPlayerIndex;
exports.playerTeam = playerTeam;
exports.tileCanPlayOnEnd = tileCanPlayOnEnd;
exports.getValidPlays = getValidPlays;
exports.applyTileToBoard = applyTileToBoard;
exports.isGameBlocked = isGameBlocked;
exports.handPipSum = handPipSum;
exports.calculatePlayOutPoints = calculatePlayOutPoints;
exports.calculateBlockedResult = calculateBlockedResult;
exports.calculateBlockedResult200 = calculateBlockedResult200;
exports.isCapicu = isCapicu;
exports.isChuchazo = isChuchazo;
exports.calculateMode500Bonuses = calculateMode500Bonuses;
exports.applyPassBonus200 = applyPassBonus200;
exports.applyScore = applyScore;
exports.scoresReachedTarget = scoresReachedTarget;
exports.getLeadingTeam = getLeadingTeam;
exports.buildClientGameState = buildClientGameState;
// ─── Tile Generation ──────────────────────────────────────────────────────────
function generateDoubleSixSet() {
    const tiles = [];
    for (let low = 0; low <= 6; low++) {
        for (let high = low; high <= 6; high++) {
            tiles.push({
                id: `${low}-${high}`,
                high: high,
                low: low,
                isDouble: low === high,
            });
        }
    }
    return tiles; // 28 tiles total
}
function shuffleTiles(tiles) {
    const arr = [...tiles];
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}
function dealTiles(tiles, playerCount = 4) {
    if (playerCount === 2) {
        return {
            hands: [tiles.slice(0, 7), tiles.slice(7, 14)],
            boneyard: tiles.slice(14),
        };
    }
    // 4-player: 7 tiles each, no boneyard
    return {
        hands: [tiles.slice(0, 7), tiles.slice(7, 14), tiles.slice(14, 21), tiles.slice(21, 28)],
        boneyard: [],
    };
}
// ─── First Player ─────────────────────────────────────────────────────────────
/**
 * Finds which player holds the highest double (starting from 6-6).
 * In 4-player mode all tiles are dealt, so 6-6 is always found.
 * Returns { playerIndex, tile }.
 */
function findFirstPlayer(hands) {
    // Check doubles from highest to lowest
    for (let val = 6; val >= 0; val--) {
        const id = `${val}-${val}`;
        for (let p = 0; p < hands.length; p++) {
            const found = hands[p].find(t => t.id === id);
            if (found)
                return { playerIndex: p, tile: found };
        }
    }
    // Fallback: highest composite (6-5, 6-4, … 5-4, …)
    for (let high = 6; high >= 1; high--) {
        for (let low = high - 1; low >= 0; low--) {
            const id = `${low}-${high}`;
            for (let p = 0; p < hands.length; p++) {
                const found = hands[p].find(t => t.id === id);
                if (found)
                    return { playerIndex: p, tile: found };
            }
        }
    }
    // Should never reach here
    return { playerIndex: 0, tile: hands[0][0] };
}
// ─── Turn Order (Counter-Clockwise) ──────────────────────────────────────────
/** Turn order: 0 → 1 → … → (playerCount-1) → 0 */
function nextPlayerIndex(current, playerCount = 4) {
    return (current + 1) % playerCount;
}
/** Returns the team (0 or 1) for a given player index */
function playerTeam(playerIndex) {
    return (playerIndex % 2);
}
// ─── Tile Validation ─────────────────────────────────────────────────────────
function tileCanPlayOnEnd(tile, endValue) {
    return tile.high === endValue || tile.low === endValue;
}
function getValidPlays(hand, board, firstPlayMade, forcedFirstTileId) {
    // Before first play: if a forced tile is set, only that tile is valid.
    // If forcedFirstTileId is empty (subsequent games), the starter plays any tile freely.
    if (!firstPlayMade) {
        if (forcedFirstTileId === '') {
            // Free first play — any tile can go on the empty board
            return hand.map(t => ({ tileId: t.id, targetEnd: 'right' }));
        }
        const forced = hand.find(t => t.id === forcedFirstTileId);
        if (forced)
            return [{ tileId: forced.id, targetEnd: 'right' }];
        return [];
    }
    const { leftEnd, rightEnd } = board;
    if (leftEnd === null || rightEnd === null)
        return [];
    const plays = [];
    const seen = new Set();
    for (const tile of hand) {
        if (tileCanPlayOnEnd(tile, leftEnd)) {
            const key = `${tile.id}:left`;
            if (!seen.has(key)) {
                plays.push({ tileId: tile.id, targetEnd: 'left' });
                seen.add(key);
            }
        }
        if (tileCanPlayOnEnd(tile, rightEnd)) {
            const key = `${tile.id}:right`;
            if (!seen.has(key)) {
                plays.push({ tileId: tile.id, targetEnd: 'right' });
                seen.add(key);
            }
        }
    }
    return plays;
}
// ─── Board Placement ─────────────────────────────────────────────────────────
function orientTile(tile, targetEnd, currentEnd, sequence, playedByIndex) {
    if (tile.isDouble) {
        return {
            tile,
            orientation: 'vertical',
            leftPip: tile.high,
            rightPip: tile.high,
            playedByIndex,
            sequence,
        };
    }
    const exposedPip = (tile.high === currentEnd ? tile.low : tile.high);
    if (targetEnd === 'right') {
        // Connecting pip on the LEFT side (touching chain), exposed on RIGHT
        return {
            tile,
            orientation: 'horizontal',
            leftPip: currentEnd,
            rightPip: exposedPip,
            playedByIndex,
            sequence,
        };
    }
    else {
        // Connecting pip on the RIGHT side (touching chain), exposed on LEFT
        return {
            tile,
            orientation: 'horizontal',
            leftPip: exposedPip,
            rightPip: currentEnd,
            playedByIndex,
            sequence,
        };
    }
}
function applyTileToBoard(board, tile, targetEnd, playedByIndex) {
    const sequence = board.tiles.length;
    if (board.tiles.length === 0) {
        // First tile — always placed as-is (low on left, high on right, or vertical if double)
        const boardTile = {
            tile,
            orientation: tile.isDouble ? 'vertical' : 'horizontal',
            leftPip: tile.low,
            rightPip: tile.high,
            playedByIndex,
            sequence: 0,
        };
        return {
            tiles: [boardTile],
            leftEnd: tile.low,
            rightEnd: tile.high,
        };
    }
    const currentEnd = (targetEnd === 'left' ? board.leftEnd : board.rightEnd);
    const boardTile = orientTile(tile, targetEnd, currentEnd, sequence, playedByIndex);
    const newTiles = targetEnd === 'left'
        ? [boardTile, ...board.tiles]
        : [...board.tiles, boardTile];
    const newLeftEnd = targetEnd === 'left' ? boardTile.leftPip : board.leftEnd;
    const newRightEnd = targetEnd === 'right' ? boardTile.rightPip : board.rightEnd;
    return { tiles: newTiles, leftEnd: newLeftEnd, rightEnd: newRightEnd };
}
// ─── Blocked Game ─────────────────────────────────────────────────────────────
function isGameBlocked(consecutivePasses, playerCount = 4) {
    return consecutivePasses >= playerCount;
}
// ─── Scoring ─────────────────────────────────────────────────────────────────
function handPipSum(tiles) {
    return tiles.reduce((sum, t) => sum + t.high + t.low, 0);
}
/** Points a team earns when one of their players empties their hand */
function calculatePlayOutPoints(players, winnerIndex) {
    return players
        .filter((_, i) => i !== winnerIndex)
        .reduce((sum, p) => sum + handPipSum(p.tiles), 0);
}
/** For a blocked game: determine winning team and points */
function calculateBlockedResult(players) {
    const pipCounts = players.map(p => handPipSum(p.tiles));
    if (players.length === 2) {
        // 2-player: individual pip comparison
        const p0 = pipCounts[0];
        const p1 = pipCounts[1];
        if (p0 < p1)
            return { winningTeam: playerTeam(0), pointsScored: p1, pipCounts };
        if (p1 < p0)
            return { winningTeam: playerTeam(1), pointsScored: p0, pipCounts };
        return { winningTeam: null, pointsScored: 0, pipCounts };
    }
    // 4-player: team sum comparison
    const teamA = pipCounts[0] + pipCounts[2];
    const teamB = pipCounts[1] + pipCounts[3];
    if (teamA < teamB)
        return { winningTeam: 0, pointsScored: teamB, pipCounts };
    if (teamB < teamA)
        return { winningTeam: 1, pointsScored: teamA, pipCounts };
    return { winningTeam: null, pointsScored: 0, pipCounts };
}
/** Modo 200 blocked game: individual player with fewest pips wins */
function calculateBlockedResult200(players) {
    const pipCounts = players.map(p => handPipSum(p.tiles));
    const minPips = Math.min(...pipCounts);
    const minPlayers = pipCounts.filter(p => p === minPips);
    // Tie: multiple players share minimum → nobody scores
    if (minPlayers.length > 1) {
        return { winnerIndex: null, winningTeam: null, pointsScored: 0, pipCounts };
    }
    const winnerIndex = pipCounts.indexOf(minPips);
    const winningTeam = playerTeam(winnerIndex);
    const pointsScored = pipCounts.reduce((s, p, i) => i !== winnerIndex ? s + p : s, 0);
    return { winnerIndex, winningTeam, pointsScored, pipCounts };
}
/**
 * Hand bonus for Modo 500 based on hand number (1-indexed).
 * Hand 1 → +100, 2 → +75, 3 → +50, 4 → +25, 5+ → 0
 */
function handBonus500(handNumber) {
    const bonuses = [100, 75, 50, 25];
    return bonuses[handNumber - 1] ?? 0;
}
/**
 * Capicú: last tile covers BOTH board ends
 * (tile.high matches one end AND tile.low matches the other)
 */
function isCapicu(tile, board) {
    if (board.tiles.length === 0)
        return false;
    const { leftEnd, rightEnd } = board;
    if (leftEnd === null || rightEnd === null)
        return false;
    return ((tile.high === leftEnd && tile.low === rightEnd) ||
        (tile.low === leftEnd && tile.high === rightEnd));
}
/** Chuchazo: winning tile is the 0-0 (double-zero) */
function isChuchazo(tile) {
    return tile.isDouble && tile.high === 0;
}
/**
 * Calculate total bonus points for Modo 500.
 * Capicú and Chuchazo are not combinable (max +100).
 */
function calculateMode500Bonuses(handNumber, capicuTriggered, chuchazoTriggered) {
    const hBonus = handBonus500(handNumber);
    const specialBonus = capicuTriggered || chuchazoTriggered ? 100 : 0;
    return hBonus + specialBonus;
}
/** Apply pass bonus for Modo 200. Returns updated scores. */
function applyPassBonus200(scores, passingPlayerIndex, gamePassCount // total passes in entire game BEFORE this one (first=+2, rest=+1)
) {
    const passingTeam = playerTeam(passingPlayerIndex);
    const scoringTeam = (1 - passingTeam);
    const bonus = gamePassCount === 0 ? 2 : 1;
    return {
        team0: scoringTeam === 0 ? scores.team0 + bonus : scores.team0,
        team1: scoringTeam === 1 ? scores.team1 + bonus : scores.team1,
    };
}
/** Apply earned points to team scores. Returns updated scores and gameOver flag. */
function applyScore(scores, winningTeam, points, targetScore) {
    const updatedScores = {
        team0: winningTeam === 0 ? scores.team0 + points : scores.team0,
        team1: winningTeam === 1 ? scores.team1 + points : scores.team1,
    };
    const gameOver = updatedScores.team0 >= targetScore || updatedScores.team1 >= targetScore;
    return { updatedScores, gameOver };
}
/** Check if current scores have already reached target (from mid-hand bonuses) */
function scoresReachedTarget(scores, targetScore) {
    return scores.team0 >= targetScore || scores.team1 >= targetScore;
}
function getLeadingTeam(scores) {
    return scores.team0 >= scores.team1 ? 0 : 1;
}
// ─── Build personalised ClientGameState for a specific player ─────────────────
function buildClientGameState(game, forPlayerIndex) {
    const hand = game.players[forPlayerIndex].tiles;
    const board = game.board;
    return {
        roomCode: game.roomCode,
        gameMode: game.gameMode,
        targetScore: game.targetScore,
        phase: game.phase,
        handNumber: game.handNumber,
        myPlayerIndex: forPlayerIndex,
        players: game.players.map(p => ({
            index: p.index,
            name: p.name,
            tileCount: p.tiles.length,
            connected: p.connected,
            isMe: p.index === forPlayerIndex,
            tiles: p.index === forPlayerIndex ? p.tiles : undefined,
        })),
        board,
        currentPlayerIndex: game.currentPlayerIndex,
        consecutivePasses: game.consecutivePasses,
        scores: game.scores,
        isMyTurn: game.currentPlayerIndex === forPlayerIndex && game.phase === 'playing',
        validPlays: game.currentPlayerIndex === forPlayerIndex && game.phase === 'playing'
            ? getValidPlays(hand, board, game.firstPlayMade, game.forcedFirstTileId)
            : [],
        forcedFirstTileId: !game.firstPlayMade ? game.forcedFirstTileId : null,
        boneyardCount: game.boneyard.length,
        playerCount: game.players.length,
    };
}

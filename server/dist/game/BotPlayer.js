"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BOT_DRAW_DELAY = exports.BOT_THINK_DELAY = void 0;
exports.generateBotName = generateBotName;
exports.isBotSocketId = isBotSocketId;
exports.generateBotSocketId = generateBotSocketId;
exports.chooseBotPlay = chooseBotPlay;
const GameEngine_1 = require("./GameEngine");
const BOT_NAMES = [
    'Don Felo', 'Doña Carmen', 'Tito', 'Marisol',
    'Panchito', 'Luz María', 'Cuco', 'Yolanda',
    'Bebo', 'Minerva', 'Papo', 'Iris',
];
let nameIndex = 0;
function generateBotName() {
    const name = BOT_NAMES[nameIndex % BOT_NAMES.length];
    nameIndex++;
    return name;
}
function isBotSocketId(socketId) {
    return socketId.startsWith('bot-');
}
function generateBotSocketId(seatIndex) {
    return `bot-${seatIndex}-${Date.now()}`;
}
/**
 * Bot AI: choose which tile to play and on which end.
 * Strategy (simple but effective):
 * 1. Play doubles first (get rid of heavy tiles)
 * 2. Prefer the highest pip tile (reduce pip count in case of block)
 * 3. If multiple valid plays, prefer the end that matches more tiles in hand (keeps options open)
 */
function chooseBotPlay(hand, board, firstPlayMade, forcedFirstTileId) {
    const validPlays = (0, GameEngine_1.getValidPlays)(hand, board, firstPlayMade, forcedFirstTileId);
    if (validPlays.length === 0)
        return null;
    // Forced first tile — just play it
    if (!firstPlayMade && forcedFirstTileId) {
        const forced = validPlays.find(p => p.tileId === forcedFirstTileId);
        if (forced)
            return forced;
    }
    // Score each valid play
    const scored = validPlays.map(play => {
        const tile = hand.find(t => t.id === play.tileId);
        let score = 0;
        // Prefer doubles (get rid of them early — they're harder to play)
        if (tile.isDouble)
            score += 10;
        // Prefer higher pip tiles (reduce pip count risk)
        score += tile.high + tile.low;
        // Prefer plays that leave more options in hand
        // Check how many remaining hand tiles match the new exposed end
        const playedTile = tile;
        const newExposedPip = play.targetEnd === 'left'
            ? (playedTile.high === board.leftEnd || (!firstPlayMade) ? playedTile.low : playedTile.high)
            : (playedTile.high === board.rightEnd || (!firstPlayMade) ? playedTile.low : playedTile.high);
        const remainingHand = hand.filter(t => t.id !== play.tileId);
        const matchCount = remainingHand.filter(t => t.high === newExposedPip || t.low === newExposedPip).length;
        score += matchCount * 3;
        return { play, score };
    });
    // Sort by score descending and pick the best
    scored.sort((a, b) => b.score - a.score);
    return scored[0].play;
}
/** Delay before bot acts (ms) — feels more natural */
exports.BOT_THINK_DELAY = 2500;
exports.BOT_DRAW_DELAY = 1500;

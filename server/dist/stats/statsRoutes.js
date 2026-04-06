"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_1 = __importDefault(require("../db/prisma"));
const jwt_1 = require("../auth/jwt");
const router = (0, express_1.Router)();
// Helper: extract userId from Bearer token
function getUserId(req) {
    const auth = req.headers.authorization;
    if (!auth?.startsWith('Bearer '))
        return null;
    try {
        const payload = (0, jwt_1.verifyToken)(auth.slice(7));
        return payload.sub;
    }
    catch {
        return null;
    }
}
// GET /api/stats/me — my stats
router.get('/me', async (req, res) => {
    try {
        const userId = getUserId(req);
        if (!userId) {
            res.status(401).json({ error: 'Not authenticated' });
            return;
        }
        const stats = await prisma_1.default.userStats.findUnique({ where: { userId } });
        const totalGames = stats?.gamesPlayed ?? 0;
        const totalWins = stats?.gamesWon ?? 0;
        const winRate = totalGames > 0 ? Math.round((totalWins / totalGames) * 100) : 0;
        res.json({
            gamesPlayed: totalGames,
            gamesWon: totalWins,
            winRate,
        });
    }
    catch (err) {
        console.error('[Stats] Error fetching stats:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// GET /api/stats/history?limit=20&offset=0 — my game history
router.get('/history', async (req, res) => {
    try {
        const userId = getUserId(req);
        if (!userId) {
            res.status(401).json({ error: 'Not authenticated' });
            return;
        }
        const limit = Math.min(parseInt(req.query.limit) || 20, 50);
        const offset = parseInt(req.query.offset) || 0;
        const participations = await prisma_1.default.gameParticipant.findMany({
            where: { userId },
            orderBy: { gameHistory: { endedAt: 'desc' } },
            take: limit,
            skip: offset,
            include: {
                gameHistory: {
                    include: {
                        participants: {
                            select: { playerName: true, playerIndex: true, team: true, won: true },
                        },
                    },
                },
            },
        });
        const games = participations.map((p) => ({
            id: p.gameHistory.id,
            gameMode: p.gameHistory.gameMode,
            won: p.won,
            team: p.team,
            winningTeam: p.gameHistory.winningTeam,
            scoreTeam0: p.gameHistory.scoreTeam0,
            scoreTeam1: p.gameHistory.scoreTeam1,
            totalRounds: p.gameHistory.totalRounds,
            playerCount: p.gameHistory.playerCount,
            endedAt: p.gameHistory.endedAt,
            players: p.gameHistory.participants.map((part) => ({
                name: part.playerName,
                index: part.playerIndex,
                team: part.team,
                won: part.won,
            })),
        }));
        res.json({ games });
    }
    catch (err) {
        console.error('[Stats] Error fetching history:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// GET /api/stats/leaderboard?limit=50 — top players by wins
router.get('/leaderboard', async (req, res) => {
    try {
        const limit = Math.min(parseInt(req.query.limit) || 50, 100);
        const leaders = await prisma_1.default.userStats.findMany({
            where: { gamesPlayed: { gte: 1 } },
            orderBy: { gamesWon: 'desc' },
            take: limit,
            include: {
                user: {
                    select: { id: true, username: true, displayName: true, avatarUrl: true },
                },
            },
        });
        const leaderboard = leaders.map((s, i) => ({
            rank: i + 1,
            userId: s.user.id,
            username: s.user.username,
            displayName: s.user.displayName,
            avatarUrl: s.user.avatarUrl,
            gamesPlayed: s.gamesPlayed,
            gamesWon: s.gamesWon,
            winRate: s.gamesPlayed > 0 ? Math.round((s.gamesWon / s.gamesPlayed) * 100) : 0,
        }));
        res.json({ leaderboard });
    }
    catch (err) {
        console.error('[Stats] Error fetching leaderboard:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});
exports.default = router;

"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_1 = __importDefault(require("../db/prisma"));
const jwt_1 = require("../auth/jwt");
const router = (0, express_1.Router)();
/** Extract authenticated userId from Bearer token, or send 401 */
async function requireAuth(req, res) {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
        res.status(401).json({ error: 'Authentication required' });
        return null;
    }
    try {
        const payload = (0, jwt_1.verifyToken)(authHeader.slice(7));
        return payload.sub;
    }
    catch {
        res.status(401).json({ error: 'Invalid token' });
        return null;
    }
}
const userSelect = { id: true, username: true, displayName: true, avatarUrl: true };
// GET /search?q=xxx — search users by username prefix, annotated with friendship status
router.get('/search', async (req, res) => {
    try {
        const userId = await requireAuth(req, res);
        if (!userId)
            return;
        const q = (req.query.q || '').trim().toLowerCase();
        if (q.length < 2) {
            res.json({ users: [] });
            return;
        }
        const users = await prisma_1.default.user.findMany({
            where: {
                username: { startsWith: q, mode: 'insensitive' },
                id: { not: userId },
            },
            select: userSelect,
            take: 10,
        });
        if (users.length === 0) {
            res.json({ users: [] });
            return;
        }
        // Fetch existing friendships between current user and each result
        const userIds = users.map(u => u.id);
        const friendships = await prisma_1.default.friendship.findMany({
            where: {
                OR: [
                    { requesterId: userId, targetId: { in: userIds } },
                    { requesterId: { in: userIds }, targetId: userId },
                ],
            },
        });
        // Build lookup: otherUserId -> friendship
        const friendshipMap = new Map();
        for (const f of friendships) {
            const otherId = f.requesterId === userId ? f.targetId : f.requesterId;
            friendshipMap.set(otherId, f);
        }
        const annotated = users.map(u => {
            const f = friendshipMap.get(u.id);
            return {
                ...u,
                friendshipStatus: f ? f.status : null,
                friendshipDirection: f
                    ? f.requesterId === userId ? 'outgoing' : 'incoming'
                    : null,
            };
        });
        res.json({ users: annotated });
    }
    catch (err) {
        console.error('[Social] Search error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// GET /friends — list all accepted friends (both directions)
router.get('/friends', async (req, res) => {
    try {
        const userId = await requireAuth(req, res);
        if (!userId)
            return;
        const friendships = await prisma_1.default.friendship.findMany({
            where: {
                status: 'ACCEPTED',
                OR: [{ requesterId: userId }, { targetId: userId }],
            },
            include: {
                requester: { select: userSelect },
                target: { select: userSelect },
            },
        });
        const friends = friendships.map(f => f.requesterId === userId ? f.target : f.requester);
        res.json({ friends });
    }
    catch (err) {
        console.error('[Social] Friends error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// GET /requests — list incoming and outgoing pending friend requests
router.get('/requests', async (req, res) => {
    try {
        const userId = await requireAuth(req, res);
        if (!userId)
            return;
        const [incoming, outgoing] = await Promise.all([
            prisma_1.default.friendship.findMany({
                where: { targetId: userId, status: 'PENDING' },
                include: { requester: { select: userSelect } },
                orderBy: { createdAt: 'desc' },
            }),
            prisma_1.default.friendship.findMany({
                where: { requesterId: userId, status: 'PENDING' },
                include: { target: { select: userSelect } },
                orderBy: { createdAt: 'desc' },
            }),
        ]);
        const requests = [
            ...incoming.map(f => ({ requestId: f.id, user: f.requester, direction: 'incoming' })),
            ...outgoing.map(f => ({ requestId: f.id, user: f.target, direction: 'outgoing' })),
        ];
        res.json({ requests });
    }
    catch (err) {
        console.error('[Social] Requests error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});
exports.default = router;

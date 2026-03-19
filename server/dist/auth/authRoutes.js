"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_1 = __importDefault(require("../db/prisma"));
const passwordUtils_1 = require("./passwordUtils");
const jwt_1 = require("./jwt");
const google_1 = require("./google");
const router = (0, express_1.Router)();
// POST /api/auth/register
router.post('/register', async (req, res) => {
    try {
        const { username, password, displayName } = req.body;
        if (!username || !password) {
            res.status(400).json({ error: 'Username and password are required' });
            return;
        }
        if (username.length < 3 || username.length > 20) {
            res.status(400).json({ error: 'Username must be 3-20 characters' });
            return;
        }
        if (password.length < 6) {
            res.status(400).json({ error: 'Password must be at least 6 characters' });
            return;
        }
        if (!/^[a-zA-Z0-9_]+$/.test(username)) {
            res.status(400).json({ error: 'Username can only contain letters, numbers, and underscores' });
            return;
        }
        const existing = await prisma_1.default.user.findUnique({ where: { username: username.toLowerCase() } });
        if (existing) {
            res.status(409).json({ error: 'Username already taken' });
            return;
        }
        const passwordHash = await (0, passwordUtils_1.hashPassword)(password);
        const user = await prisma_1.default.user.create({
            data: {
                username: username.toLowerCase(),
                displayName: displayName || username,
                passwordHash,
                stats: { create: {} },
            },
            select: { id: true, username: true, displayName: true, avatarUrl: true, createdAt: true },
        });
        const { token, jti, expiresAt } = (0, jwt_1.signToken)(user.id, user.username);
        await prisma_1.default.session.create({ data: { userId: user.id, token: jti, expiresAt } });
        res.status(201).json({ token, user });
    }
    catch (err) {
        console.error('[Auth] Register error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// POST /api/auth/login
router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        if (!username || !password) {
            res.status(400).json({ error: 'Username and password are required' });
            return;
        }
        const user = await prisma_1.default.user.findUnique({
            where: { username: username.toLowerCase() },
            select: { id: true, username: true, displayName: true, avatarUrl: true, passwordHash: true },
        });
        if (!user || !user.passwordHash) {
            res.status(401).json({ error: 'Invalid username or password' });
            return;
        }
        const valid = await (0, passwordUtils_1.comparePassword)(password, user.passwordHash);
        if (!valid) {
            res.status(401).json({ error: 'Invalid username or password' });
            return;
        }
        const { token, jti, expiresAt } = (0, jwt_1.signToken)(user.id, user.username);
        await prisma_1.default.session.create({ data: { userId: user.id, token: jti, expiresAt } });
        await prisma_1.default.user.update({ where: { id: user.id }, data: { lastSeenAt: new Date() } });
        const { passwordHash: _, ...safeUser } = user;
        res.json({ token, user: safeUser });
    }
    catch (err) {
        console.error('[Auth] Login error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// POST /api/auth/google
router.post('/google', async (req, res) => {
    try {
        const { idToken } = req.body;
        if (!idToken) {
            res.status(400).json({ error: 'Google ID token is required' });
            return;
        }
        const profile = await (0, google_1.verifyGoogleToken)(idToken);
        // Find by googleId or email
        let user = await prisma_1.default.user.findFirst({
            where: { OR: [{ googleId: profile.googleId }, { email: profile.email }] },
        });
        if (user) {
            // Update Google ID if they previously registered with email/password
            if (!user.googleId) {
                user = await prisma_1.default.user.update({
                    where: { id: user.id },
                    data: { googleId: profile.googleId, avatarUrl: user.avatarUrl || profile.picture },
                });
            }
            await prisma_1.default.user.update({ where: { id: user.id }, data: { lastSeenAt: new Date() } });
        }
        else {
            // Create new account from Google
            const baseUsername = profile.name.toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 16);
            let username = baseUsername;
            let counter = 1;
            while (await prisma_1.default.user.findUnique({ where: { username } })) {
                username = `${baseUsername}${counter++}`;
            }
            user = await prisma_1.default.user.create({
                data: {
                    username,
                    displayName: profile.name,
                    email: profile.email,
                    googleId: profile.googleId,
                    avatarUrl: profile.picture,
                    stats: { create: {} },
                },
            });
        }
        const { token, jti, expiresAt } = (0, jwt_1.signToken)(user.id, user.username);
        await prisma_1.default.session.create({ data: { userId: user.id, token: jti, expiresAt } });
        const { passwordHash: _, ...safeUser } = user;
        res.json({ token, user: safeUser });
    }
    catch (err) {
        console.error('[Auth] Google auth error:', err);
        res.status(401).json({ error: 'Invalid Google token' });
    }
});
// GET /api/auth/me
router.get('/me', async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader?.startsWith('Bearer ')) {
            res.status(401).json({ error: 'No token provided' });
            return;
        }
        const token = authHeader.slice(7);
        const payload = (0, jwt_1.verifyToken)(token);
        // Check session exists (not revoked)
        const session = await prisma_1.default.session.findUnique({ where: { token: payload.jti } });
        if (!session || session.expiresAt < new Date()) {
            res.status(401).json({ error: 'Session expired' });
            return;
        }
        const user = await prisma_1.default.user.findUnique({
            where: { id: payload.sub },
            select: {
                id: true, username: true, displayName: true, avatarUrl: true, email: true, createdAt: true,
                stats: { select: { gamesPlayed: true, gamesWon: true } },
            },
        });
        if (!user) {
            res.status(404).json({ error: 'User not found' });
            return;
        }
        res.json({ user });
    }
    catch {
        res.status(401).json({ error: 'Invalid token' });
    }
});
// POST /api/auth/logout
router.post('/logout', async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader?.startsWith('Bearer ')) {
            res.status(200).json({ ok: true });
            return;
        }
        const token = authHeader.slice(7);
        const payload = (0, jwt_1.verifyToken)(token);
        await prisma_1.default.session.deleteMany({ where: { token: payload.jti } });
        res.json({ ok: true });
    }
    catch {
        res.status(200).json({ ok: true });
    }
});
exports.default = router;

"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authMiddleware = authMiddleware;
exports.getSocketUser = getSocketUser;
const jwt_1 = require("../auth/jwt");
const prisma_1 = __importDefault(require("../db/prisma"));
async function authMiddleware(socket, next) {
    const token = socket.handshake.auth?.token;
    if (!token) {
        // No token = guest mode. Always allow connection.
        ;
        socket.data = { guest: true };
        next();
        return;
    }
    try {
        const payload = (0, jwt_1.verifyToken)(token);
        // Check session not revoked
        const session = await prisma_1.default.session.findUnique({ where: { token: payload.jti } });
        if (!session || session.expiresAt < new Date()) {
            ;
            socket.data = { guest: true };
            next();
            return;
        }
        const user = await prisma_1.default.user.findUnique({
            where: { id: payload.sub },
            select: { id: true, username: true, displayName: true },
        });
        if (!user) {
            ;
            socket.data = { guest: true };
            next();
            return;
        }
        ;
        socket.data = {
            user: { id: user.id, username: user.username, displayName: user.displayName },
            guest: false,
        };
        // Update lastSeenAt (non-critical)
        await prisma_1.default.user.update({
            where: { id: user.id },
            data: { lastSeenAt: new Date() },
        }).catch(() => { });
        next();
    }
    catch {
        // Invalid token — allow as guest, don't reject
        ;
        socket.data = { guest: true };
        next();
    }
}
// Helper to get typed socket data
function getSocketUser(socket) {
    return socket.data || { guest: true };
}

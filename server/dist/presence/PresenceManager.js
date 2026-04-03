"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PresenceManager = void 0;
const prisma_1 = __importDefault(require("../db/prisma"));
class PresenceManager {
    constructor(io, rooms) {
        this.connections = new Map(); // userId -> Set<socketId>
        this.graceTimers = new Map(); // userId -> pending offline timer
        this.io = io;
        this.rooms = rooms;
    }
    /** Register a new socket for an authenticated user */
    addSocket(userId, socketId) {
        // Clear any pending grace timer (user reconnected before going offline)
        const existingTimer = this.graceTimers.get(userId);
        if (existingTimer) {
            clearTimeout(existingTimer);
            this.graceTimers.delete(userId);
        }
        let sockets = this.connections.get(userId);
        const wasOffline = !sockets || sockets.size === 0;
        if (!sockets) {
            sockets = new Set();
            this.connections.set(userId, sockets);
        }
        sockets.add(socketId);
        if (wasOffline) {
            this.broadcastStatusToFriends(userId);
        }
    }
    /** Unregister a socket for an authenticated user */
    removeSocket(userId, socketId) {
        const sockets = this.connections.get(userId);
        if (!sockets)
            return;
        sockets.delete(socketId);
        if (sockets.size === 0) {
            // Start grace period -- prevents flicker on tab refresh or brief disconnect
            const timer = setTimeout(() => {
                this.graceTimers.delete(userId);
                this.connections.delete(userId);
                this.broadcastStatusToFriends(userId);
            }, 5000);
            this.graceTimers.set(userId, timer);
        }
    }
    /** Derive the current presence status for a user */
    getStatus(userId) {
        const sockets = this.connections.get(userId);
        if (!sockets || sockets.size === 0)
            return 'offline';
        const roomCode = this.rooms.getRoomCodeByUserId(userId);
        if (roomCode) {
            const room = this.rooms.getRoom(roomCode);
            if (room) {
                return room.status === 'in_game' ? 'in_game' : 'in_lobby';
            }
        }
        return 'online';
    }
    /** Get statuses for multiple users at once */
    getStatuses(userIds) {
        const result = {};
        for (const id of userIds) {
            result[id] = this.getStatus(id);
        }
        return result;
    }
    /** Public hook -- call after room/game events that change user status */
    notifyStatusChange(userId) {
        this.broadcastStatusToFriends(userId);
    }
    /** Broadcast current status to all online friends via their per-user Socket.IO rooms */
    async broadcastStatusToFriends(userId) {
        const status = this.getStatus(userId);
        // Compute joinability -- can friends join this user's room?
        const roomCode = this.rooms.getRoomCodeByUserId(userId);
        const room = roomCode ? this.rooms.getRoom(roomCode) : undefined;
        const canJoin = !!(room && room.status === 'waiting' && room.players.length < 4);
        const friendIds = await this.getFriendIds(userId);
        for (const friendId of friendIds) {
            this.io.to(`user:${friendId}`).emit('presence:friend_status_changed', {
                userId,
                status,
                canJoin,
            });
        }
        // Toast-worthy transitions: emit additional events with display name
        if (status === 'online' || status === 'in_lobby') {
            const user = await prisma_1.default.user.findUnique({
                where: { id: userId },
                select: { displayName: true },
            });
            if (user) {
                const eventName = status === 'online'
                    ? 'presence:friend_online'
                    : 'presence:friend_in_lobby';
                for (const friendId of friendIds) {
                    this.io.to(`user:${friendId}`).emit(eventName, {
                        userId,
                        displayName: user.displayName,
                    });
                }
            }
        }
    }
    /** Query accepted friendships and return the IDs of the other users */
    async getFriendIds(userId) {
        const friendships = await prisma_1.default.friendship.findMany({
            where: {
                status: 'ACCEPTED',
                OR: [{ requesterId: userId }, { targetId: userId }],
            },
            select: { requesterId: true, targetId: true },
        });
        return friendships.map(f => f.requesterId === userId ? f.targetId : f.requesterId);
    }
}
exports.PresenceManager = PresenceManager;

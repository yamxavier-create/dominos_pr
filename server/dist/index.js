"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const http_1 = require("http");
const socket_io_1 = require("socket.io");
const cors_1 = __importDefault(require("cors"));
const path_1 = __importDefault(require("path"));
const config_1 = require("./config");
const RoomManager_1 = require("./game/RoomManager");
const handlers_1 = require("./socket/handlers");
const GameEngine_1 = require("./game/GameEngine");
const gameHandlers_1 = require("./socket/gameHandlers");
const authRoutes_1 = __importDefault(require("./auth/authRoutes"));
const socialRoutes_1 = __importStar(require("./social/socialRoutes"));
const statsRoutes_1 = __importDefault(require("./stats/statsRoutes"));
const PresenceManager_1 = require("./presence/PresenceManager");
const authMiddleware_1 = require("./socket/authMiddleware");
const app = (0, express_1.default)();
const httpServer = (0, http_1.createServer)(app);
if (config_1.config.NODE_ENV !== 'production') {
    app.use((0, cors_1.default)({ origin: config_1.config.CLIENT_ORIGIN }));
}
app.use(express_1.default.json());
// Auth REST API
app.use('/api/auth', authRoutes_1.default);
// Social REST API (friends, search, requests)
app.use('/api/social', socialRoutes_1.default);
// Stats REST API (history, leaderboard)
app.use('/api/stats', statsRoutes_1.default);
const io = new socket_io_1.Server(httpServer, {
    cors: config_1.config.NODE_ENV !== 'production'
        ? { origin: config_1.config.CLIENT_ORIGIN, methods: ['GET', 'POST'] }
        : undefined,
    pingTimeout: 60000,
    pingInterval: 25000,
});
// Socket.io auth middleware — identifies user or marks as guest
io.use(authMiddleware_1.authMiddleware);
const rooms = new RoomManager_1.RoomManager();
(0, socialRoutes_1.setRoomManager)(rooms);
const presence = new PresenceManager_1.PresenceManager(io, rooms);
(0, socialRoutes_1.setPresenceManager)(presence);
// Health check for Railway
app.get('/health', (_req, res) => {
    res.status(200).json({ status: 'ok' });
});
// Serve built client files in production
if (config_1.config.NODE_ENV === 'production') {
    const clientBuild = path_1.default.join(__dirname, '../../client/dist');
    app.use(express_1.default.static(clientBuild));
    app.get('*', (_req, res) => res.sendFile(path_1.default.join(clientBuild, 'index.html')));
}
io.on('connection', socket => {
    console.log(`[socket] connected: ${socket.id}`);
    // Join per-user room for real-time social notifications
    const userData = (0, authMiddleware_1.getSocketUser)(socket);
    if (userData.user) {
        socket.join(`user:${userData.user.id}`);
        presence.addSocket(userData.user.id, socket.id);
    }
    (0, handlers_1.registerHandlers)(socket, io, rooms, presence);
    socket.on('disconnect', reason => {
        console.log(`[socket] disconnected: ${socket.id} — ${reason}`);
        // Remove socket from presence tracking (starts grace period if last socket)
        if (userData.user) {
            presence.removeSocket(userData.user.id, socket.id);
        }
        const result = rooms.leaveRoom(socket.id);
        if (!result) {
            // Even without a room, presence may have changed (online -> offline)
            if (userData.user) {
                presence.notifyStatusChange(userData.user.id);
            }
            return;
        }
        const { roomCode, room } = result;
        // Cancel rematch voting if disconnecting player was part of it
        (0, gameHandlers_1.checkRematchCancellation)(io, room, socket.id);
        if (room.status === 'in_game' && room.game) {
            const player = room.game.players.find(p => p.socketId === socket.id);
            if (player) {
                io.to(roomCode).emit('connection:player_disconnected', {
                    playerIndex: player.index,
                    playerName: player.name,
                });
                // Broadcast updated state so other players see the disconnected indicator
                for (const p of room.game.players) {
                    if (p.connected) {
                        io.to(p.socketId).emit('game:state_snapshot', {
                            gameState: (0, GameEngine_1.buildClientGameState)(room.game, p.index),
                            lastAction: null,
                        });
                    }
                }
            }
        }
        else {
            io.to(roomCode).emit('room:updated', { room: rooms.getRoomInfo(room) });
        }
        // Notify friends about status change (room leave)
        if (userData.user) {
            presence.notifyStatusChange(userData.user.id);
        }
    });
});
httpServer.listen(config_1.config.PORT, () => {
    console.log(`🎲 Dominó PR v${config_1.APP_VERSION} running on port ${config_1.config.PORT}`);
});

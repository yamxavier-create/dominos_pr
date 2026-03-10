"use strict";
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
const app = (0, express_1.default)();
const httpServer = (0, http_1.createServer)(app);
app.use((0, cors_1.default)({ origin: config_1.config.CLIENT_ORIGIN }));
app.use(express_1.default.json());
const io = new socket_io_1.Server(httpServer, {
    cors: {
        origin: config_1.config.CLIENT_ORIGIN,
        methods: ['GET', 'POST'],
    },
    pingTimeout: 60000,
    pingInterval: 25000,
});
const rooms = new RoomManager_1.RoomManager();
// Serve built client files in production
if (config_1.config.NODE_ENV === 'production') {
    const clientBuild = path_1.default.join(__dirname, '../../client/dist');
    app.use(express_1.default.static(clientBuild));
    app.get('*', (_req, res) => res.sendFile(path_1.default.join(clientBuild, 'index.html')));
}
io.on('connection', socket => {
    console.log(`[socket] connected: ${socket.id}`);
    (0, handlers_1.registerHandlers)(socket, io, rooms);
    socket.on('disconnect', reason => {
        console.log(`[socket] disconnected: ${socket.id} — ${reason}`);
        const result = rooms.leaveRoom(socket.id);
        if (!result)
            return;
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
    });
});
httpServer.listen(config_1.config.PORT, () => {
    console.log(`🎲 Dominó PR server running on port ${config_1.config.PORT}`);
});

"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerRoomHandlers = registerRoomHandlers;
const GameEngine_1 = require("../game/GameEngine");
const authMiddleware_1 = require("./authMiddleware");
function registerRoomHandlers(socket, io, rooms, presence) {
    socket.on('room:create', ({ playerName, gameMode }) => {
        const socketUser = (0, authMiddleware_1.getSocketUser)(socket);
        const name = playerName?.trim() || socketUser.user?.displayName;
        if (!name) {
            return socket.emit('room:error', { code: 'INVALID_NAME', message: 'Nombre inválido' });
        }
        const userId = socketUser.user?.id;
        const room = rooms.createRoom(socket.id, name, gameMode, userId);
        socket.join(room.roomCode);
        socket.emit('room:created', {
            roomCode: room.roomCode,
            room: rooms.getRoomInfo(room),
            myPlayerIndex: 0,
        });
        if (userId)
            presence.notifyStatusChange(userId);
    });
    socket.on('room:join', ({ roomCode, playerName }) => {
        const socketUser = (0, authMiddleware_1.getSocketUser)(socket);
        const name = playerName?.trim() || socketUser.user?.displayName;
        if (!name) {
            return socket.emit('room:error', { code: 'INVALID_NAME', message: 'Nombre inválido' });
        }
        const userId = socketUser.user?.id;
        const result = rooms.joinRoom(socket.id, roomCode?.toUpperCase(), name, userId);
        if (!result) {
            return socket.emit('room:error', {
                code: 'ROOM_NOT_FOUND',
                message: 'Sala no encontrada o llena',
            });
        }
        const { room, seatIndex } = result;
        socket.join(room.roomCode);
        if (room.status === 'in_game' && room.game) {
            // Reconnect: send current game state
            socket.emit('room:joined', { roomCode: room.roomCode, room: rooms.getRoomInfo(room), myPlayerIndex: seatIndex });
            socket.emit('game:state_snapshot', {
                gameState: (0, GameEngine_1.buildClientGameState)(room.game, seatIndex),
                lastAction: null,
            });
            io.to(room.roomCode).emit('connection:player_reconnected', {
                playerIndex: seatIndex,
                playerName: playerName.trim(),
            });
        }
        else {
            socket.emit('room:joined', { roomCode: room.roomCode, room: rooms.getRoomInfo(room), myPlayerIndex: seatIndex });
            io.to(room.roomCode).emit('room:updated', { room: rooms.getRoomInfo(room) });
        }
        if (userId)
            presence.notifyStatusChange(userId);
    });
    // Lightweight reconnection: update socket ID in room/game state and re-join Socket.IO room.
    // Triggered by client on socket reconnect (new socket ID after transport close).
    socket.on('room:rejoin', ({ roomCode, playerName }) => {
        if (!roomCode || !playerName)
            return;
        const room = rooms.getRoom(roomCode);
        if (!room)
            return;
        // Update room player's socket ID
        const rp = room.players.find(p => p.name === playerName);
        if (!rp)
            return;
        const oldSocketId = rp.socketId;
        rp.socketId = socket.id;
        rp.connected = true;
        // Update game player's socket ID if in game
        if (room.game) {
            const gp = room.game.players.find(p => p.index === rp.seatIndex);
            if (gp) {
                gp.socketId = socket.id;
                gp.connected = true;
            }
        }
        // Update host reference if this player is the host
        if (room.hostSocketId === oldSocketId) {
            room.hostSocketId = socket.id;
        }
        // Re-join Socket.IO room and update socketToRoom mapping
        socket.join(roomCode);
        rooms.registerSocket(socket.id, roomCode);
        console.log(`[room:rejoin] ${playerName} reconnected to ${roomCode}: ${oldSocketId} → ${socket.id}`);
        // Send chat history on reconnect
        if (room.chatHistory?.length) {
            socket.emit('chat:history', { messages: room.chatHistory });
        }
    });
    socket.on('room:swap_seats', ({ seatA, seatB }) => {
        const room = rooms.swapSeats(socket.id, seatA, seatB);
        if (!room)
            return;
        // Notify all players of updated room info AND their new seat index
        for (const p of room.players) {
            io.to(p.socketId).emit('room:seat_swapped', {
                room: rooms.getRoomInfo(room),
                myPlayerIndex: p.seatIndex,
            });
        }
    });
    socket.on('room:leave', () => {
        const result = rooms.leaveRoom(socket.id);
        if (!result)
            return;
        const { roomCode, room } = result;
        socket.leave(roomCode);
        io.to(roomCode).emit('room:updated', { room: rooms.getRoomInfo(room) });
        const socketUser = (0, authMiddleware_1.getSocketUser)(socket);
        if (socketUser.user)
            presence.notifyStatusChange(socketUser.user.id);
    });
}

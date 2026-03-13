"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerWebRTCHandlers = registerWebRTCHandlers;
function registerWebRTCHandlers(socket, io, rooms) {
    // Pure signaling relay: forward SDP offers/answers and ICE candidates to the target peer
    socket.on('webrtc:signal', ({ roomCode, to, desc, candidate }) => {
        const room = rooms.getRoom(roomCode);
        if (!room)
            return;
        if (!room.game)
            return;
        const fromPlayer = room.game.players.find(p => p.socketId === socket.id);
        if (fromPlayer === undefined)
            return;
        const fromIndex = fromPlayer.index;
        const targetPlayer = room.game.players.find(p => p.index === to);
        if (!targetPlayer?.socketId)
            return;
        io.to(targetPlayer.socketId).emit('webrtc:signal', { from: fromIndex, desc, candidate });
    });
    // Broadcast mute/camera state changes to all other players in room
    socket.on('webrtc:toggle', ({ roomCode, micMuted, cameraOff }) => {
        const room = rooms.getRoom(roomCode);
        if (!room)
            return;
        if (!room.game)
            return;
        const fromPlayer = room.game.players.find(p => p.socketId === socket.id);
        if (fromPlayer === undefined)
            return;
        socket.to(roomCode).emit('webrtc:peer_toggle', {
            from: fromPlayer.index,
            micMuted,
            cameraOff,
        });
    });
    // Broadcast lobby opt-in state to all players in room (visible to everyone in lobby)
    socket.on('webrtc:lobby_opt', ({ roomCode, audio, video }) => {
        const room = rooms.getRoom(roomCode);
        if (!room)
            return;
        const fromPlayer = room.players.find(p => p.socketId === socket.id);
        if (fromPlayer === undefined)
            return;
        // Broadcast to everyone else in room (sender updates own local state)
        socket.to(roomCode).emit('webrtc:lobby_updated', {
            from: fromPlayer.seatIndex,
            audio,
            video,
        });
    });
}

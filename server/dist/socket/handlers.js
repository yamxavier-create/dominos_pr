"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerHandlers = registerHandlers;
const roomHandlers_1 = require("./roomHandlers");
const gameHandlers_1 = require("./gameHandlers");
const chatHandlers_1 = require("./chatHandlers");
const webrtcHandlers_1 = require("./webrtcHandlers");
const socialHandlers_1 = require("../social/socialHandlers");
function registerHandlers(socket, io, rooms, presence) {
    (0, roomHandlers_1.registerRoomHandlers)(socket, io, rooms, presence);
    (0, gameHandlers_1.registerGameHandlers)(socket, io, rooms, presence);
    (0, chatHandlers_1.registerChatHandlers)(socket, io, rooms);
    (0, webrtcHandlers_1.registerWebRTCHandlers)(socket, io, rooms);
    (0, socialHandlers_1.registerSocialHandlers)(socket, io, rooms);
}

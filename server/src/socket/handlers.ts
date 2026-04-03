import { Socket, Server } from 'socket.io'
import { RoomManager } from '../game/RoomManager'
import { PresenceManager } from '../presence/PresenceManager'
import { registerRoomHandlers } from './roomHandlers'
import { registerGameHandlers } from './gameHandlers'
import { registerChatHandlers } from './chatHandlers'
import { registerWebRTCHandlers } from './webrtcHandlers'
import { registerSocialHandlers } from '../social/socialHandlers'

export function registerHandlers(socket: Socket, io: Server, rooms: RoomManager, presence: PresenceManager): void {
  registerRoomHandlers(socket, io, rooms, presence)
  registerGameHandlers(socket, io, rooms, presence)
  registerChatHandlers(socket, io, rooms)
  registerWebRTCHandlers(socket, io, rooms)
  registerSocialHandlers(socket, io, rooms, presence)
}

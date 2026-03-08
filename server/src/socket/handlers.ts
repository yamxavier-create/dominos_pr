import { Socket, Server } from 'socket.io'
import { RoomManager } from '../game/RoomManager'
import { registerRoomHandlers } from './roomHandlers'
import { registerGameHandlers } from './gameHandlers'
import { registerChatHandlers } from './chatHandlers'

export function registerHandlers(socket: Socket, io: Server, rooms: RoomManager): void {
  registerRoomHandlers(socket, io, rooms)
  registerGameHandlers(socket, io, rooms)
  registerChatHandlers(socket, io, rooms)
}

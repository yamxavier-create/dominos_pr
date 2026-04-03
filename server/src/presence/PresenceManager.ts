import { Server } from 'socket.io'
import { RoomManager } from '../game/RoomManager'
import prisma from '../db/prisma'

export type PresenceStatus = 'online' | 'in_lobby' | 'in_game' | 'offline'

export class PresenceManager {
  private io: Server
  private rooms: RoomManager
  private connections = new Map<string, Set<string>>()   // userId -> Set<socketId>
  private graceTimers = new Map<string, NodeJS.Timeout>() // userId -> pending offline timer

  constructor(io: Server, rooms: RoomManager) {
    this.io = io
    this.rooms = rooms
  }

  /** Register a new socket for an authenticated user */
  addSocket(userId: string, socketId: string): void {
    // Clear any pending grace timer (user reconnected before going offline)
    const existingTimer = this.graceTimers.get(userId)
    if (existingTimer) {
      clearTimeout(existingTimer)
      this.graceTimers.delete(userId)
    }

    let sockets = this.connections.get(userId)
    const wasOffline = !sockets || sockets.size === 0

    if (!sockets) {
      sockets = new Set<string>()
      this.connections.set(userId, sockets)
    }
    sockets.add(socketId)

    if (wasOffline) {
      this.broadcastStatusToFriends(userId)
    }
  }

  /** Unregister a socket for an authenticated user */
  removeSocket(userId: string, socketId: string): void {
    const sockets = this.connections.get(userId)
    if (!sockets) return

    sockets.delete(socketId)

    if (sockets.size === 0) {
      // Start grace period -- prevents flicker on tab refresh or brief disconnect
      const timer = setTimeout(() => {
        this.graceTimers.delete(userId)
        this.connections.delete(userId)
        this.broadcastStatusToFriends(userId)
      }, 5000)

      this.graceTimers.set(userId, timer)
    }
  }

  /** Derive the current presence status for a user */
  getStatus(userId: string): PresenceStatus {
    const sockets = this.connections.get(userId)
    if (!sockets || sockets.size === 0) return 'offline'

    const roomCode = this.rooms.getRoomCodeByUserId(userId)
    if (roomCode) {
      const room = this.rooms.getRoom(roomCode)
      if (room) {
        return room.status === 'in_game' ? 'in_game' : 'in_lobby'
      }
    }

    return 'online'
  }

  /** Get statuses for multiple users at once */
  getStatuses(userIds: string[]): Record<string, PresenceStatus> {
    const result: Record<string, PresenceStatus> = {}
    for (const id of userIds) {
      result[id] = this.getStatus(id)
    }
    return result
  }

  /** Public hook -- call after room/game events that change user status */
  notifyStatusChange(userId: string): void {
    this.broadcastStatusToFriends(userId)
  }

  /** Broadcast current status to all online friends via their per-user Socket.IO rooms */
  private async broadcastStatusToFriends(userId: string): Promise<void> {
    const status = this.getStatus(userId)
    const friendIds = await this.getFriendIds(userId)

    for (const friendId of friendIds) {
      this.io.to(`user:${friendId}`).emit('presence:friend_status_changed', {
        userId,
        status,
      })
    }

    // Toast-worthy transitions: emit additional events with display name
    if (status === 'online' || status === 'in_lobby') {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { displayName: true },
      })

      if (user) {
        const eventName = status === 'online'
          ? 'presence:friend_online'
          : 'presence:friend_in_lobby'

        for (const friendId of friendIds) {
          this.io.to(`user:${friendId}`).emit(eventName, {
            userId,
            displayName: user.displayName,
          })
        }
      }
    }
  }

  /** Query accepted friendships and return the IDs of the other users */
  private async getFriendIds(userId: string): Promise<string[]> {
    const friendships = await prisma.friendship.findMany({
      where: {
        status: 'ACCEPTED',
        OR: [{ requesterId: userId }, { targetId: userId }],
      },
      select: { requesterId: true, targetId: true },
    })

    return friendships.map(f =>
      f.requesterId === userId ? f.targetId : f.requesterId
    )
  }
}

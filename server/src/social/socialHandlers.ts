import { Socket, Server } from 'socket.io'
import prisma from '../db/prisma'
import { getSocketUser } from '../socket/authMiddleware'
import { RoomManager } from '../game/RoomManager'

const userSelect = { id: true, username: true, displayName: true, avatarUrl: true } as const

export function registerSocialHandlers(socket: Socket, io: Server, rooms?: RoomManager): void {

  // --- social:friend_request ---
  socket.on('social:friend_request', async ({ targetUserId }: { targetUserId: string }) => {
    try {
      const userData = getSocketUser(socket)
      if (!userData.user) {
        return socket.emit('social:error', { message: 'Login required' })
      }
      const userId = userData.user.id

      // Self-friend guard
      if (userId === targetUserId) {
        return socket.emit('social:error', { message: 'Cannot friend yourself' })
      }

      // Rate limit: max 20 pending outgoing requests
      const pendingCount = await prisma.friendship.count({
        where: { requesterId: userId, status: 'PENDING' },
      })
      if (pendingCount >= 20) {
        return socket.emit('social:error', { message: 'Too many pending requests (max 20)' })
      }

      // Bidirectional check — prevent duplicate/race
      const existing = await prisma.friendship.findFirst({
        where: {
          OR: [
            { requesterId: userId, targetId: targetUserId },
            { requesterId: targetUserId, targetId: userId },
          ],
        },
      })

      if (existing) {
        if (existing.status === 'ACCEPTED') {
          return socket.emit('social:error', { message: 'Already friends' })
        }

        if (existing.status === 'PENDING' && existing.requesterId === userId) {
          return socket.emit('social:error', { message: 'Request already sent' })
        }

        // Reverse PENDING request exists — auto-accept
        if (existing.status === 'PENDING' && existing.requesterId === targetUserId) {
          const updated = await prisma.friendship.update({
            where: { id: existing.id },
            data: { status: 'ACCEPTED' },
            include: {
              requester: { select: userSelect },
              target: { select: userSelect },
            },
          })

          // Notify both parties
          socket.emit('social:friend_accepted', {
            friendshipId: updated.id,
            friend: updated.requester, // the other user (who originally requested)
          })
          io.to(`user:${targetUserId}`).emit('social:friend_accepted', {
            friendshipId: updated.id,
            friend: updated.target, // us
          })
          return
        }
      }

      // Create new friend request
      const friendship = await prisma.friendship.create({
        data: { requesterId: userId, targetId: targetUserId },
        include: {
          requester: { select: userSelect },
          target: { select: userSelect },
        },
      })

      socket.emit('social:friend_request_sent', {
        requestId: friendship.id,
        to: friendship.target,
      })
      io.to(`user:${targetUserId}`).emit('social:friend_request_received', {
        requestId: friendship.id,
        from: friendship.requester,
      })
    } catch (err) {
      console.error('[Social] friend_request error:', err)
      socket.emit('social:error', { message: 'Failed to send friend request' })
    }
  })

  // --- social:friend_accept ---
  socket.on('social:friend_accept', async ({ requestId }: { requestId: string }) => {
    try {
      const userData = getSocketUser(socket)
      if (!userData.user) {
        return socket.emit('social:error', { message: 'Login required' })
      }
      const userId = userData.user.id

      const friendship = await prisma.friendship.findUnique({ where: { id: requestId } })

      if (!friendship) {
        return socket.emit('social:error', { message: 'Request not found' })
      }
      if (friendship.targetId !== userId) {
        return socket.emit('social:error', { message: 'Not authorized' })
      }
      if (friendship.status !== 'PENDING') {
        return socket.emit('social:error', { message: 'Request is no longer pending' })
      }

      const updated = await prisma.friendship.update({
        where: { id: requestId },
        data: { status: 'ACCEPTED' },
        include: {
          requester: { select: userSelect },
          target: { select: userSelect },
        },
      })

      // Notify both parties
      socket.emit('social:friend_accepted', {
        friendshipId: updated.id,
        friend: updated.requester, // the other user
      })
      io.to(`user:${updated.requesterId}`).emit('social:friend_accepted', {
        friendshipId: updated.id,
        friend: updated.target, // us
      })
    } catch (err) {
      console.error('[Social] friend_accept error:', err)
      socket.emit('social:error', { message: 'Failed to accept request' })
    }
  })

  // --- social:friend_reject ---
  socket.on('social:friend_reject', async ({ requestId }: { requestId: string }) => {
    try {
      const userData = getSocketUser(socket)
      if (!userData.user) {
        return socket.emit('social:error', { message: 'Login required' })
      }
      const userId = userData.user.id

      const friendship = await prisma.friendship.findUnique({ where: { id: requestId } })

      if (!friendship) {
        return socket.emit('social:error', { message: 'Request not found' })
      }
      if (friendship.targetId !== userId) {
        return socket.emit('social:error', { message: 'Not authorized' })
      }
      if (friendship.status !== 'PENDING') {
        return socket.emit('social:error', { message: 'Request is no longer pending' })
      }

      // Delete the row (not set to REJECTED)
      await prisma.friendship.delete({ where: { id: requestId } })

      socket.emit('social:friend_rejected', { requestId })
      io.to(`user:${friendship.requesterId}`).emit('social:friend_rejected', { requestId })
    } catch (err) {
      console.error('[Social] friend_reject error:', err)
      socket.emit('social:error', { message: 'Failed to reject request' })
    }
  })

  // --- social:friend_remove ---
  socket.on('social:friend_remove', async ({ friendUserId }: { friendUserId: string }) => {
    try {
      const userData = getSocketUser(socket)
      if (!userData.user) {
        return socket.emit('social:error', { message: 'Login required' })
      }
      const userId = userData.user.id

      // Delete bidirectionally
      const result = await prisma.friendship.deleteMany({
        where: {
          status: 'ACCEPTED',
          OR: [
            { requesterId: userId, targetId: friendUserId },
            { requesterId: friendUserId, targetId: userId },
          ],
        },
      })

      if (result.count === 0) {
        return socket.emit('social:error', { message: 'Not friends' })
      }

      socket.emit('social:friend_removed', { userId: friendUserId })
      io.to(`user:${friendUserId}`).emit('social:friend_removed', { userId })
    } catch (err) {
      console.error('[Social] friend_remove error:', err)
      socket.emit('social:error', { message: 'Failed to remove friend' })
    }
  })

  // --- social:invite_to_game ---
  socket.on('social:invite_to_game', async ({ friendUserId }: { friendUserId: string }) => {
    try {
      const userData = getSocketUser(socket)
      if (!userData.user || !rooms) {
        return socket.emit('social:error', { message: 'Login required' })
      }
      const userId = userData.user.id

      // Verify friendship
      const friendship = await prisma.friendship.findFirst({
        where: {
          status: 'ACCEPTED',
          OR: [
            { requesterId: userId, targetId: friendUserId },
            { requesterId: friendUserId, targetId: userId },
          ],
        },
      })
      if (!friendship) {
        return socket.emit('social:error', { message: 'Not friends' })
      }

      // Get sender's current room
      const roomCode = rooms.getRoomCodeBySocket(socket.id)
      if (!roomCode) {
        return socket.emit('social:error', { message: 'Not in a room' })
      }
      const room = rooms.getRoom(roomCode)
      if (!room || room.status !== 'waiting') {
        return socket.emit('social:error', { message: 'Room not accepting players' })
      }
      if (room.players.length >= 4) {
        return socket.emit('social:error', { message: 'Room is full' })
      }

      // Send invite to friend
      io.to(`user:${friendUserId}`).emit('social:game_invite', {
        roomCode,
        from: {
          id: userData.user.id,
          displayName: userData.user.displayName,
        },
        playerCount: room.players.length,
        gameMode: room.gameMode,
      })

      socket.emit('social:invite_sent', { to: friendUserId, roomCode })
    } catch (err) {
      console.error('[Social] invite_to_game error:', err)
      socket.emit('social:error', { message: 'Failed to send invite' })
    }
  })
}

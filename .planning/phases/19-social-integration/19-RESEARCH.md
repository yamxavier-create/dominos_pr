# Phase 19: Social Integration - Research

**Researched:** 2026-04-03
**Domain:** Socket.io real-time social features, room joining, post-game UI
**Confidence:** HIGH

## Summary

Phase 19 connects the social system (Phase 17-18) to gameplay. Two features: (1) direct join via friend's userId without exposing room codes, and (2) post-game "Add Friend" button for opponents. Both features are well-supported by the existing infrastructure -- the heavy lifting (friendship model, presence tracking, room management, socket events) is already complete.

The primary challenge for direct join is the **privacy-safe room resolution** (STATE.md pitfall P5). The current FriendsList already shows a "Unirse" button using `friend.roomCode` from the REST API, which leaks room codes to the client. The correct approach: client sends `social:join_friend` with only the friend's `userId`, and the server resolves the room internally, validates friendship + seat availability, then performs the join. The client never sees the room code until `room:joined` fires.

The post-game "Add Friend" feature is straightforward: the `GameEndModal` already displays opponent names, the `ClientPlayer` type includes `userId`, and the `social:friend_request` socket event is battle-tested. The only complexity is determining which opponents are logged-in, non-friend, and not already pending -- this requires a lightweight server endpoint or socket event to check friendship status for a set of userIds.

**Primary recommendation:** Implement `social:join_friend` server handler that resolves userId -> roomCode internally, and add a `social:check_friendship_status` event (or batch check) for the post-game screen to annotate opponents before showing "Add Friend" buttons.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| JOIN-01 | User can join a friend's lobby directly from the friends list via "Join" button | Existing `FriendsList` has the button + `handleJoinRoom`. Replace `room:join` with new `social:join_friend` that takes `friendUserId` instead of `roomCode`. Server-side room resolution via `RoomManager.getRoomCodeByUserId()` already exists. |
| JOIN-02 | Join button only appears when friend is in a lobby with available seats | REST GET /friends already filters: returns `roomCode` only when `room.status === 'waiting' && room.players.length < 4`. For real-time updates, `presence:friend_status_changed` already fires on room transitions. Need to also emit joinability info alongside presence updates so the button appears/disappears in real time. |
| FRD-06 | User can send a friend request from the post-game screen | `GameEndModal` has access to `gameState.players` which includes `userId`. `social:friend_request` event already handles the full flow. Need to add opponent list with "Add Friend" buttons, filtered to logged-in non-friend users. |
</phase_requirements>

## Standard Stack

### Core (already in project)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Socket.io | existing | Real-time join + friend request events | Already handles all social events |
| Zustand | existing | socialStore, roomStore state management | Already manages friends, presence, room state |
| Prisma | existing | Friendship queries for status checks | Already has Friendship model with bidirectional queries |
| React Router | existing | Navigation after join (navigate to /lobby) | Already used for room:joined flow |

### Supporting
No new libraries needed. This phase is 100% built on existing infrastructure.

## Architecture Patterns

### Pattern 1: Privacy-Safe Direct Join (Server-Side Room Resolution)

**What:** Client sends only the friend's userId. Server resolves userId to roomCode, validates everything, and performs the join. The client never explicitly requests a room code.

**When to use:** Always for friend-based joining. Never expose room codes in friend list data or presence events.

**Current anti-pattern in codebase (to fix):**
```typescript
// socialRoutes.ts GET /friends (lines 117-123) -- currently leaks roomCode
const friends = friendships.map(f => {
  const friend = f.requesterId === userId ? f.target : f.requester
  const roomCode = roomManagerRef?.getRoomCodeByUserId(friend.id)
  const room = roomCode ? roomManagerRef?.getRoom(roomCode) : undefined
  return {
    ...friend,
    roomCode: room && room.status === 'waiting' && room.players.length < 4 ? roomCode : null,
    // ^ PRIVACY ISSUE: roomCode exposed to client
    status,
  }
})
```

**Correct pattern:**
```typescript
// Server: new socket handler in socialHandlers.ts
socket.on('social:join_friend', async ({ friendUserId }: { friendUserId: string }) => {
  const userData = getSocketUser(socket)
  if (!userData.user) return socket.emit('social:error', { message: 'Login required' })

  // 1. Verify friendship
  const friendship = await prisma.friendship.findFirst({
    where: {
      status: 'ACCEPTED',
      OR: [
        { requesterId: userData.user.id, targetId: friendUserId },
        { requesterId: friendUserId, targetId: userData.user.id },
      ],
    },
  })
  if (!friendship) return socket.emit('social:error', { message: 'Not friends' })

  // 2. Resolve room (server-side only)
  const roomCode = rooms.getRoomCodeByUserId(friendUserId)
  if (!roomCode) return socket.emit('social:error', { message: 'Friend not in a room' })

  const room = rooms.getRoom(roomCode)
  if (!room || room.status !== 'waiting') {
    return socket.emit('social:error', { message: 'Room not available' })
  }
  if (room.players.length >= 4) {
    return socket.emit('social:error', { message: 'Room is full' })
  }

  // 3. Perform join (reuse RoomManager.joinRoom)
  const name = userData.user.displayName
  const result = rooms.joinRoom(socket.id, roomCode, name, userData.user.id)
  if (!result) return socket.emit('social:error', { message: 'Could not join room' })

  // 4. Standard room:joined flow
  socket.join(roomCode)
  socket.emit('room:joined', {
    roomCode,
    room: rooms.getRoomInfo(result.room),
    myPlayerIndex: result.seatIndex,
  })
  io.to(roomCode).emit('room:updated', { room: rooms.getRoomInfo(result.room) })
  presence.notifyStatusChange(userData.user.id)
})

// Client: FriendsList replaces roomCode join with userId join
const handleJoinFriend = (friendUserId: string) => {
  socket.emit('social:join_friend', { friendUserId })
}
```

**Key insight:** The REST /friends endpoint should return `canJoin: boolean` instead of `roomCode`. The presence:friend_status_changed event already pushes status updates -- extend it or add a companion event for joinability.

### Pattern 2: Joinability Signal in Presence Updates

**What:** When a friend's joinability changes (enters lobby, lobby fills up, game starts), broadcast whether they're joinable alongside the status change.

**Current:** `presence:friend_status_changed` sends `{ userId, status }`. The client infers joinability from `status === 'in_lobby'` but can't know if seats are available.

**Improved pattern:**
```typescript
// In PresenceManager.broadcastStatusToFriends, add canJoin flag
const roomCode = this.rooms.getRoomCodeByUserId(userId)
const room = roomCode ? this.rooms.getRoom(roomCode) : undefined
const canJoin = room?.status === 'waiting' && room.players.length < 4

for (const friendId of friendIds) {
  this.io.to(`user:${friendId}`).emit('presence:friend_status_changed', {
    userId,
    status,
    canJoin,  // NEW: boolean flag
  })
}
```

```typescript
// socialStore: update Friend type to track canJoin
export interface Friend {
  // ... existing fields
  canJoin?: boolean  // replaces roomCode
}

// updateFriendStatus action updated:
updateFriendStatus: (userId, status, canJoin) =>
  set((state) => ({
    friends: state.friends.map((f) =>
      f.id === userId ? { ...f, status, canJoin } : f
    ),
  })),
```

### Pattern 3: Post-Game Opponent Friend Request

**What:** After game ends, show "Add Friend" buttons next to each opponent who is (a) logged in and (b) not already a friend or pending request.

**Data flow:**
1. `GameEndModal` reads `gameState.players` -- each player has `userId` (or undefined for guests)
2. When `game:game_ended` fires, client emits `social:check_users` with opponent userIds
3. Server returns friendship status for each userId
4. Client renders "Add Friend" / "Pending" / nothing based on status

**Server handler:**
```typescript
socket.on('social:check_users', async ({ userIds }: { userIds: string[] }, callback) => {
  const userData = getSocketUser(socket)
  if (!userData.user) return callback({ users: {} })

  const friendships = await prisma.friendship.findMany({
    where: {
      OR: [
        { requesterId: userData.user.id, targetId: { in: userIds } },
        { requesterId: { in: userIds }, targetId: userData.user.id },
      ],
    },
  })

  const statusMap: Record<string, { status: string; direction: string | null }> = {}
  for (const uid of userIds) {
    const f = friendships.find(
      fr => fr.requesterId === uid || fr.targetId === uid
    )
    if (f) {
      statusMap[uid] = {
        status: f.status,
        direction: f.requesterId === userData.user.id ? 'outgoing' : 'incoming',
      }
    } else {
      statusMap[uid] = { status: 'NONE', direction: null }
    }
  }
  callback({ users: statusMap })
})
```

**Client in GameEndModal:**
```typescript
// On game end, check friendship status of opponents
useEffect(() => {
  if (!showGameEnd || !isAuthenticated || !gameState) return
  const opponentIds = gameState.players
    .filter(p => !p.isMe && p.userId)
    .map(p => p.userId!)

  if (opponentIds.length === 0) return

  socket.emit('social:check_users', { userIds: opponentIds }, (res) => {
    setOpponentStatuses(res.users)
  })
}, [showGameEnd])
```

### Anti-Patterns to Avoid

- **Exposing room codes in friend data:** Never send `roomCode` to clients via friend lists or presence events. Use `canJoin: boolean` instead.
- **Client-side availability calculation:** Don't try to determine seat availability on the client. Server is the authority -- it knows the real room state.
- **Blocking the join flow on extra API calls:** The `social:join_friend` handler should be a single socket event, not a REST call + socket event combo. Keep it fast.
- **Showing "Add Friend" for teammates:** The requirement says "opponents" specifically. Team partners (indices 0&2 or 1&3) should not show the button.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Room resolution for friends | Custom lookup logic in client | `RoomManager.getRoomCodeByUserId()` on server | Already exists, O(1) map lookup |
| Friendship verification | Re-querying from scratch | Reuse `prisma.friendship.findFirst` pattern from socialHandlers | Battle-tested bidirectional check |
| Join room mechanics | Custom join logic | `RoomManager.joinRoom()` + existing `room:joined` event flow | Handles seat assignment, reconnection, host transfer |
| Real-time joinability | Polling REST endpoint | Extend `presence:friend_status_changed` with `canJoin` boolean | Already fires on every room transition |
| Friendship status batch check | Multiple individual queries | Single `prisma.friendship.findMany` with `{ in: userIds }` | Efficient batch DB query |

**Key insight:** Phase 19 builds ZERO new infrastructure. Every capability exists -- this phase is about connecting existing pieces through 2 new socket events and 1 UI addition.

## Common Pitfalls

### Pitfall 1: Race Condition on Direct Join
**What goes wrong:** User clicks "Join" but between the click and the server processing, the room fills up or starts a game.
**Why it happens:** Presence updates are asynchronous -- the "canJoin" state may be stale by the time the join request arrives.
**How to avoid:** Server MUST validate room state at join time (not trust client state). Return a clear error (`social:error` with message "Room is full" or "Game already started") so the client can show feedback.
**Warning signs:** Join silently fails with no user feedback.

### Pitfall 2: Name Collision on Join
**What goes wrong:** Friend's display name matches an existing player in the room.
**Why it happens:** `RoomManager.joinRoom()` rejects duplicate names (line 68: `if (room.players.some(p => p.name === playerName)) return null`).
**How to avoid:** The server handler should catch this null result and return a descriptive error. Consider: since display names can be edited, this is unlikely but possible. Fallback: append a number if collision detected, or just error with "Name already taken in this room".
**Warning signs:** Silent join failure.

### Pitfall 3: Already-in-Room Guard Missing
**What goes wrong:** User is already in a room and tries to join a friend's room, ending up in a corrupted state.
**Why it happens:** The `social:join_friend` handler doesn't check if the user is already in a room.
**How to avoid:** Check `rooms.getRoomCodeByUserId(userId)` or `rooms.getRoomCodeBySocket(socket.id)` at the start of the handler. If already in a room, either auto-leave first or return an error.
**Warning signs:** User appears in two rooms simultaneously in the RoomManager state.

### Pitfall 4: Post-Game Screen Timing
**What goes wrong:** User clicks "Add Friend" but the socket has already disconnected (e.g., opponent left).
**Why it happens:** After game end, players may disconnect before friend requests are sent.
**How to avoid:** The friend request doesn't require the target to be online -- it's a DB write. The `social:friend_request` handler only needs the target userId to exist in the DB. The request will appear in their requests list next time they load friends.
**Warning signs:** None really -- this works correctly by design.

### Pitfall 5: Stale canJoin State After Room Events
**What goes wrong:** "Join" button persists after a friend's room is full, or doesn't appear when a seat opens up.
**Why it happens:** `presence.notifyStatusChange()` fires on room join/leave/game start, but not on every room:updated event (e.g., when a 3rd player joins making it 3/4, the canJoin flag for the remaining seat doesn't update for friends watching).
**How to avoid:** Ensure `presence.notifyStatusChange()` is called for ALL players in the room whenever a player joins or leaves during waiting status. The existing roomHandlers already call it for the joining player -- also call it for each existing player in the room so their friends see updated canJoin.
**Warning signs:** canJoin out of sync with actual room capacity.

## Code Examples

### Example 1: FriendsList "Join" Button (Client Update)
```typescript
// FriendsList.tsx -- replace roomCode-based join with userId-based join
const handleJoinFriend = (friendUserId: string) => {
  socket.emit('social:join_friend', { friendUserId })
}

// In render, replace friend.roomCode check with friend.canJoin
{friend.canJoin && (
  <button
    onClick={() => handleJoinFriend(friend.id)}
    className="font-body text-xs font-bold px-3 py-1.5 rounded-lg ..."
    style={{ background: 'linear-gradient(135deg, #22C55E, #16a34a)' }}
  >
    Unirse
  </button>
)}
```

### Example 2: socialStore canJoin Flag
```typescript
// socialStore.ts -- Friend interface update
export interface Friend {
  id: string
  username: string
  displayName: string
  avatarUrl: string | null
  canJoin?: boolean    // NEW: replaces roomCode
  status: PresenceStatus
}

// updateFriendStatus signature update:
updateFriendStatus: (userId: string, status: PresenceStatus, canJoin?: boolean) => void
```

### Example 3: GameEndModal "Add Friend" Section
```typescript
// Inside GameEndModal, after rematch section
{isAuthenticated && opponentStatuses && (
  <div className="px-6 pb-4 border-t border-white/10 pt-3">
    <p className="font-body text-white/40 text-xs mb-2 uppercase tracking-wider">
      Agregar Amigo
    </p>
    {gameState.players
      .filter(p => !p.isMe && p.userId && p.userId !== authUser?.id)
      .filter(p => {
        // Only opponents (different team)
        const myTeam = (myPlayerIndex ?? 0) % 2
        const theirTeam = p.index % 2
        return myTeam !== theirTeam
      })
      .map(p => {
        const status = opponentStatuses[p.userId!]
        const isFriend = status?.status === 'ACCEPTED'
        const isPending = status?.status === 'PENDING'
        return (
          <div key={p.index} className="flex items-center justify-between py-1.5">
            <span className="font-body text-white/70 text-sm">{p.name}</span>
            {isFriend ? (
              <span className="font-body text-green-400 text-xs">Amigos</span>
            ) : isPending ? (
              <span className="font-body text-white/40 text-xs">Pendiente</span>
            ) : (
              <button
                onClick={() => socket.emit('social:friend_request', { targetUserId: p.userId })}
                className="font-body text-xs font-bold px-3 py-1 rounded-lg bg-green-500/20 text-green-400 hover:bg-green-500/30 transition-colors"
              >
                Agregar
              </button>
            )}
          </div>
        )
      })}
  </div>
)}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Expose roomCode in friend data | canJoin boolean, server resolves room | Phase 19 | Privacy-safe join, no room code leakage |
| No post-game social features | Add Friend on game end | Phase 19 | Social growth loop after games |

**Key migration:** The REST GET /friends endpoint currently returns `roomCode`. It must be changed to return `canJoin: boolean` instead. The `presence:friend_status_changed` event must also include `canJoin`.

## Open Questions

1. **Should the "Add Friend" button appear for ALL opponents or just non-teammate opponents?**
   - What we know: Requirements say "any logged-in opponent". In 4-player, opponents are team 1 vs team 0.
   - What's unclear: Does "opponent" mean "the other team" or "anyone else in the game"?
   - Recommendation: Show for all non-self logged-in players (teammates AND opponents). The social value of adding any player you enjoyed playing with outweighs the strict "opponent" label. Simpler to implement too.

2. **Should the already-in-room guard auto-leave or error?**
   - What we know: If a user is in a lobby and clicks "Join" on a friend's lobby, they need to leave their current room first.
   - What's unclear: Should this be automatic or require explicit action?
   - Recommendation: Auto-leave if in a waiting lobby (not in-game). This is the expected UX -- clicking "Join" on a friend means "I want to be there." If in-game, show error "Leave your current game first."

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | None (project has no test framework) |
| Config file | None |
| Quick run command | `cd /Users/yamirx/The\ Vault/dominos_pr && npx tsc --noEmit` |
| Full suite command | `cd /Users/yamirx/The\ Vault/dominos_pr && npx tsc --noEmit` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| JOIN-01 | Direct join friend's lobby via userId | manual | Open 2 browser tabs, login both, create room in tab A, click Join in tab B's friend list | N/A |
| JOIN-02 | Join button only when friend in available lobby | manual | Watch friend list while friend creates room, fills room, starts game -- button should appear/disappear | N/A |
| FRD-06 | Send friend request from post-game screen | manual | Complete a game with a non-friend logged-in player, check Add Friend button appears in GameEndModal | N/A |

### Sampling Rate
- **Per task commit:** `npx tsc --noEmit` (TypeScript strict mode is the project's check)
- **Per wave merge:** Manual end-to-end test of both features
- **Phase gate:** All 3 requirements manually verified before /gsd:verify-work

### Wave 0 Gaps
None -- no test infrastructure to set up. TypeScript strict mode serves as the automated quality gate.

## Sources

### Primary (HIGH confidence)
- **Codebase analysis** -- direct reading of all relevant files:
  - `server/src/social/socialHandlers.ts` -- existing friend request/accept/reject/remove handlers
  - `server/src/social/socialRoutes.ts` -- REST API for friends, search, requests (lines 117-123 show roomCode leak)
  - `server/src/presence/PresenceManager.ts` -- status derivation, broadcast to friends
  - `server/src/game/RoomManager.ts` -- `getRoomCodeByUserId()`, `joinRoom()`, `getRoom()`
  - `server/src/socket/roomHandlers.ts` -- `room:join` handler pattern to replicate
  - `server/src/socket/authMiddleware.ts` -- `getSocketUser()` for auth verification
  - `client/src/components/social/FriendsList.tsx` -- existing Join button using roomCode
  - `client/src/components/game/GameEndModal.tsx` -- where Add Friend buttons go
  - `client/src/store/socialStore.ts` -- Friend interface, presence notification types
  - `client/src/hooks/useSocket.ts` -- socket listener registration pattern
  - `client/src/hooks/useGameActions.ts` -- joinRoom action pattern

### Secondary (HIGH confidence -- project decisions)
- `.planning/STATE.md` -- Pitfall P5 (Direct join privacy: don't expose room codes)
- `.planning/REQUIREMENTS.md` -- JOIN-01, JOIN-02, FRD-06 requirement definitions

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- no new libraries, 100% existing infrastructure
- Architecture: HIGH -- patterns derived directly from codebase analysis, reusing proven patterns
- Pitfalls: HIGH -- identified from actual code paths and edge cases in existing handlers

**Research date:** 2026-04-03
**Valid until:** 2026-05-03 (stable -- codebase-specific, not library-dependent)

# Phase 18: Presence - Research

**Researched:** 2026-04-03
**Domain:** Real-time presence tracking (Socket.io + in-memory state)
**Confidence:** HIGH

## Summary

Phase 18 adds real-time presence tracking so logged-in users can see what their friends are doing: online, in a lobby, in a game, or offline. The core challenge is **multi-tab correctness** -- a user with 3 tabs open must show as "online" (not flicker between online/offline), and only transition to "offline" when ALL tabs close, with a grace period to handle page refreshes.

The project already has the critical infrastructure: per-user Socket.io rooms (`user:{userId}`), authenticated socket connections via JWT middleware, and `RoomManager` with `userToRoom` mapping. What's missing is a **PresenceManager** class that tracks `Map<userId, Set<socketId>>`, computes derived status from the socket set + RoomManager state, and broadcasts changes to friends.

**Primary recommendation:** Build a `PresenceManager` class (following the existing `RoomManager` pattern) that hooks into socket connect/disconnect events, uses a 5-second grace period timer on last-socket-disconnect, and emits `presence:friend_status_changed` to all online friends of the affected user. No database changes needed -- presence is entirely in-memory (ephemeral by nature).

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| PRES-01 | User can see if a friend is online, in a lobby, in a game, or offline | PresenceManager computes status from socket set + RoomManager state; client socialStore extended with `status` field on Friend; FriendsList renders status badges |
| PRES-02 | User receives real-time notification when a friend comes online or enters a lobby | `presence:friend_online` and `presence:friend_in_lobby` events emitted to `user:{friendId}` rooms; client shows toast notifications |
| PRES-03 | Presence handles multi-tab correctly (offline only when ALL tabs close) | `Map<userId, Set<socketId>>` tracks all connections; grace period timer (5s) on last socket disconnect before emitting offline; timer cancelled if new socket connects within window |
</phase_requirements>

## Standard Stack

### Core (already installed)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| socket.io | ^4.7.2 | Server-side real-time communication | Already used for all real-time features |
| socket.io-client | ^4.7.2 | Client-side socket | Already used |
| zustand | ^4.4.7 | Client state management | Already used for socialStore, gameStore, etc. |

### Supporting (no new dependencies)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| RoomManager | Internal | Determines in_lobby vs in_game status | Status computation |
| Socket.io rooms | Internal | `user:{userId}` rooms for targeted events | Broadcasting presence to friends |
| Prisma Friendship | ^7.5.0 | Query friend list for broadcast targets | On status change, find who to notify |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| In-memory Map | Redis pub/sub | Overkill for single-server architecture; Redis needed only at multi-server scale |
| Socket.io rooms for broadcast | Direct socket.emit to each friend | Rooms already exist per-user, more efficient |
| Grace period timer | Immediate offline | Causes flickering on page refresh / tab close-and-reopen |

**Installation:**
```bash
# No new dependencies needed
```

## Architecture Patterns

### Recommended File Structure
```
server/src/
  presence/
    PresenceManager.ts    # Core class: Map<userId, Set<socketId>>, status, grace period
  social/
    socialHandlers.ts     # Extended with presence event listeners (existing file)
  index.ts                # Hook PresenceManager into connection/disconnect (existing file)

client/src/
  store/
    socialStore.ts        # Extended: Friend gets `status` field (existing file)
  components/social/
    FriendsList.tsx        # Extended: status badges (existing file)
    PresenceToast.tsx      # NEW: toast for "friend came online" / "friend in lobby"
  hooks/
    useSocket.ts           # Extended: presence event listeners (existing file)
```

### Pattern 1: PresenceManager Class
**What:** Server-side singleton that tracks all authenticated socket connections per user and computes presence status
**When to use:** On every socket connect/disconnect and room join/leave
**Example:**
```typescript
// server/src/presence/PresenceManager.ts
import { Server } from 'socket.io'
import prisma from '../db/prisma'
import { RoomManager } from '../game/RoomManager'

export type PresenceStatus = 'online' | 'in_lobby' | 'in_game' | 'offline'

export class PresenceManager {
  // userId -> Set of socketIds for that user
  private connections = new Map<string, Set<string>>()
  // userId -> grace period timer (fires offline after delay)
  private graceTimers = new Map<string, NodeJS.Timeout>()

  constructor(
    private io: Server,
    private rooms: RoomManager
  ) {}

  /** Called when an authenticated socket connects */
  addSocket(userId: string, socketId: string): void {
    // Cancel any pending offline timer
    const timer = this.graceTimers.get(userId)
    if (timer) {
      clearTimeout(timer)
      this.graceTimers.delete(userId)
    }

    let sockets = this.connections.get(userId)
    const wasOffline = !sockets || sockets.size === 0
    if (!sockets) {
      sockets = new Set()
      this.connections.set(userId, sockets)
    }
    sockets.add(socketId)

    if (wasOffline) {
      // User just came online -- broadcast to friends
      this.broadcastStatusToFriends(userId)
    }
  }

  /** Called when any socket disconnects */
  removeSocket(userId: string, socketId: string): void {
    const sockets = this.connections.get(userId)
    if (!sockets) return
    sockets.delete(socketId)

    if (sockets.size === 0) {
      // Last socket gone -- start grace period
      const timer = setTimeout(() => {
        this.graceTimers.delete(userId)
        this.connections.delete(userId)
        this.broadcastStatusToFriends(userId)
      }, 5000) // 5s grace period
      this.graceTimers.set(userId, timer)
    }
  }

  /** Compute current status for a user */
  getStatus(userId: string): PresenceStatus {
    const sockets = this.connections.get(userId)
    if (!sockets || sockets.size === 0) return 'offline'

    // Check RoomManager for lobby/game status
    const roomCode = this.rooms.getRoomCodeByUserId(userId)
    if (roomCode) {
      const room = this.rooms.getRoom(roomCode)
      if (room) {
        return room.status === 'in_game' ? 'in_game' : 'in_lobby'
      }
    }

    return 'online'
  }

  /** Get statuses for multiple users (batch for friends list) */
  getStatuses(userIds: string[]): Record<string, PresenceStatus> {
    const result: Record<string, PresenceStatus> = {}
    for (const id of userIds) {
      result[id] = this.getStatus(id)
    }
    return result
  }

  /** Broadcast status change to all online friends */
  private async broadcastStatusToFriends(userId: string): Promise<void> {
    const status = this.getStatus(userId)
    const friendIds = await this.getFriendIds(userId)
    for (const friendId of friendIds) {
      this.io.to(`user:${friendId}`).emit('presence:friend_status_changed', {
        userId,
        status,
      })
    }
  }

  /** Query accepted friendships to get friend user IDs */
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
```

### Pattern 2: Status-Change Hooks for Room Events
**What:** When a user joins/leaves a room, their presence status changes (online -> in_lobby -> in_game). These transitions must trigger broadcasts.
**When to use:** After `room:create`, `room:join`, `room:leave`, `game:start`, game end, and socket disconnect
**Example:**
```typescript
// In server/src/index.ts -- after room operations, notify presence
// The PresenceManager.broadcastStatusToFriends is called when:
// 1. Socket connects (addSocket) -- triggers if was offline
// 2. Socket disconnects (removeSocket) -- triggers after grace period
// 3. Room join/leave/game start -- explicit call to broadcastStatusToFriends
presence.notifyStatusChange(userId) // recomputes and broadcasts if changed
```

### Pattern 3: Client-Side Presence in socialStore
**What:** Extend the existing `Friend` interface with a `status` field, update via socket events
**When to use:** On initial friends list load + on `presence:friend_status_changed` events
**Example:**
```typescript
// Extended Friend interface
export interface Friend {
  id: string
  username: string
  displayName: string
  avatarUrl: string | null
  roomCode?: string | null
  status: PresenceStatus  // NEW
}

export type PresenceStatus = 'online' | 'in_lobby' | 'in_game' | 'offline'

// New action in socialStore
updateFriendStatus: (userId: string, status: PresenceStatus) => void
```

### Anti-Patterns to Avoid
- **Polling for presence:** Never poll the server for friend statuses. Use socket events pushed from server on status change.
- **Storing presence in database:** Presence is ephemeral. Writing online/offline to PostgreSQL adds write load with zero value. Keep it in-memory only.
- **Individual socket tracking on client:** The client should not know about socket IDs or tab counts. It receives a single `status` string per friend.
- **Broadcasting to ALL users:** Only broadcast to friends of the affected user, not all connected users.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Multi-tab tracking | Custom BroadcastChannel API | Server-side `Map<userId, Set<socketId>>` | Server is authority; client-side tab coordination is fragile and doesn't handle different devices |
| Grace period debounce | Manual setTimeout management scattered across handlers | Centralized in PresenceManager.removeSocket | Single point of timer lifecycle management prevents leaks |
| Friend notification routing | Manual socket iteration to find friend sockets | `io.to('user:' + friendId)` rooms | Already established pattern from Phase 17; Socket.io rooms handle it efficiently |
| Status derivation | Client-side logic combining multiple signals | Server computes single status enum | Server has all data (socket set + RoomManager); client just displays what server says |

**Key insight:** The server already has everything needed to compute status -- socket connections and RoomManager state. The PresenceManager is a thin layer that combines these two data sources and pushes changes to friends.

## Common Pitfalls

### Pitfall 1: Multi-Tab Presence Flicker
**What goes wrong:** User opens 2 tabs, closes 1, shows as offline briefly then online again. Or refreshes a page and flickers offline.
**Why it happens:** Without tracking socket sets per user, each disconnect triggers an offline broadcast.
**How to avoid:** `Map<userId, Set<socketId>>` -- only consider user offline when set is empty AND grace period expires.
**Warning signs:** Friends see a user rapidly toggling online/offline in the friends list.

### Pitfall 2: Grace Period Timer Leaks
**What goes wrong:** User disconnects, grace timer starts, user reconnects (cancelling timer), user disconnects again -- now there's a new timer but the old one was already cleared. If cleanup isn't precise, timers can leak.
**Why it happens:** Timer lifecycle not centralized.
**How to avoid:** Store timer reference in `Map<userId, NodeJS.Timeout>`, always clear before setting new one. In `addSocket`, clear any existing timer. In `removeSocket`, only set timer if socket set is empty.
**Warning signs:** Users stuck in "online" status even after fully disconnecting.

### Pitfall 3: Stale Room Status After Game Ends
**What goes wrong:** User finishes a game, goes back to lobby or menu, but presence still shows "in_game".
**Why it happens:** RoomManager state changes (game ends, player leaves) don't trigger presence recalculation.
**How to avoid:** After any room state change (leave, game end, game start), call `presence.notifyStatusChange(userId)`. Key integration points:
  - `room:create` / `room:join` -> in_lobby
  - `game:start` -> in_game
  - `room:leave` / disconnect from room -> online (if still connected) or offline
  - `game:game_ended` -> in_lobby (players return to lobby)
**Warning signs:** Friends showing "in_game" after the game has ended.

### Pitfall 4: Friend Query N+1 on Every Status Change
**What goes wrong:** Every presence change queries Prisma for the user's friend list, causing excessive DB reads.
**Why it happens:** `broadcastStatusToFriends` runs a DB query each time.
**How to avoid:** For MVP, the query is fine (friendship count is small, ~20 max per user). If needed later, cache friendIds in-memory with invalidation on friend add/remove. At current scale, this is not a problem.
**Warning signs:** Slow response times on high-connection-churn scenarios.

### Pitfall 5: Presence Events for Guests
**What goes wrong:** Guest sockets (no userId) accidentally enter the presence system.
**Why it happens:** Not guarding `addSocket`/`removeSocket` behind authentication check.
**How to avoid:** Only call PresenceManager methods when `userData.user` exists (authenticated user). Guests are invisible to the presence system.
**Warning signs:** Null/undefined userId in the connections Map.

### Pitfall 6: roomCode Exposure in Presence
**What goes wrong:** Presence broadcasts include room codes, allowing anyone to join private games.
**Why it happens:** Leaking internal data in presence events.
**How to avoid:** Presence events only include `{ userId, status }`. The `roomCode` for joinable lobbies is already handled separately by the friends REST endpoint (`GET /api/social/friends`). The "Join" button logic is in Phase 19 (Direct Join) -- presence only communicates STATUS, not location details.
**Warning signs:** Room codes visible in browser DevTools socket messages for non-friends.

## Code Examples

### Server: PresenceManager Integration in index.ts
```typescript
// server/src/index.ts -- integration points

import { PresenceManager } from './presence/PresenceManager'

const presence = new PresenceManager(io, rooms)

io.on('connection', socket => {
  const userData = getSocketUser(socket)
  if (userData.user) {
    socket.join(`user:${userData.user.id}`)
    presence.addSocket(userData.user.id, socket.id)
  }

  registerHandlers(socket, io, rooms)

  socket.on('disconnect', reason => {
    if (userData.user) {
      presence.removeSocket(userData.user.id, socket.id)
    }
    // ... existing disconnect logic
  })
})
```

### Server: Presence Status Query Endpoint
```typescript
// In socialRoutes.ts -- extend GET /friends to include presence
// Already returns roomCode; now also include status from PresenceManager

router.get('/friends', async (req, res) => {
  // ... existing friend query ...
  const friends = friendships.map(f => {
    const friend = f.requesterId === userId ? f.target : f.requester
    const roomCode = roomManagerRef?.getRoomCodeByUserId(friend.id)
    const room = roomCode ? roomManagerRef?.getRoom(roomCode) : undefined
    const status = presenceRef?.getStatus(friend.id) ?? 'offline'
    return {
      ...friend,
      roomCode: room && room.status === 'waiting' && room.players.length < 4 ? roomCode : null,
      status,
    }
  })
  res.json({ friends })
})
```

### Server: Room Event Hooks for Presence
```typescript
// After room:create, room:join -- user enters lobby
// In roomHandlers.ts, after successful create/join:
if (userId && presenceRef) {
  presenceRef.notifyStatusChange(userId)
}

// After room:leave / disconnect -- user leaves room
// Already in index.ts disconnect handler:
if (userData.user && presenceRef) {
  presenceRef.notifyStatusChange(userData.user.id)
}
```

### Client: Presence Event Handling in useSocket
```typescript
// In useSocket.ts -- add presence listeners
socket.on('presence:friend_status_changed', (data: { userId: string; status: PresenceStatus }) => {
  useSocialStore.getState().updateFriendStatus(data.userId, data.status)
})

// Notifications for specific transitions
socket.on('presence:friend_online', (data: { userId: string; displayName: string }) => {
  // Show toast: "{name} esta en linea"
})

socket.on('presence:friend_in_lobby', (data: { userId: string; displayName: string }) => {
  // Show toast: "{name} esta en una sala"
})
```

### Client: Status Badge UI
```typescript
// In FriendsList.tsx -- status indicator
const statusConfig: Record<PresenceStatus, { color: string; label: string }> = {
  online: { color: 'bg-green-500', label: 'En linea' },
  in_lobby: { color: 'bg-blue-500', label: 'En sala' },
  in_game: { color: 'bg-yellow-500', label: 'En juego' },
  offline: { color: 'bg-gray-500', label: 'Desconectado' },
}

// Small dot next to avatar
<span className={`w-2.5 h-2.5 rounded-full ${statusConfig[friend.status].color} ring-2 ring-green-950`} />
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Poll lastSeenAt from DB | Server pushes presence via socket events | Standard since Socket.io 2.x | Real-time updates, no polling overhead |
| Single connection = user | Map<userId, Set<socketId>> | Standard for multi-device/tab apps | Correct presence for modern usage patterns |
| Immediate offline on disconnect | Grace period (3-5s) | Common pattern since ~2018 | Handles page refreshes and brief network blips |

**Deprecated/outdated:**
- Database-backed presence (lastSeenAt polling): Still used for "last seen X ago" display, but not for real-time status. The existing `lastSeenAt` field in User model is fine for that secondary use case.

## Open Questions

1. **Notification preference: all transitions or selective?**
   - What we know: PRES-02 specifies "online" and "enters a lobby" notifications
   - What's unclear: Should "in_game" or "offline" also show toasts?
   - Recommendation: Only toast for "online" and "in_lobby" per requirements. "in_game" and "offline" update the badge silently.

2. **Should presence persist across server restarts?**
   - What we know: In-memory means all users show "offline" after restart
   - What's unclear: Is this acceptable?
   - Recommendation: Yes, acceptable. Users reconnect via socket.io auto-reconnect and presence rebuilds naturally. This is standard for presence systems.

3. **Notification deduplication for rapid status changes**
   - What we know: If a user joins a room, starts a game, all within seconds, friends could get 3 status change events
   - What's unclear: Should we debounce notifications?
   - Recommendation: Status changes are cheap (just a field update). No debounce needed for the badge. For toasts, only trigger on specific transitions (offline->online, *->in_lobby), not on every change.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | None (TypeScript strict mode is the primary check) |
| Config file | None |
| Quick run command | `npm run build` (TypeScript compilation) |
| Full suite command | `npm run build` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PRES-01 | Friend status visible and updates in real-time | manual | Open 2 browsers, check status updates | N/A |
| PRES-02 | Toast notification on friend online/in_lobby | manual | Open 2 browsers, verify toast appears | N/A |
| PRES-03 | Multi-tab: offline only when ALL tabs close | manual | Open 3 tabs, close 2, verify still online; close last, verify offline after 5s | N/A |

### Sampling Rate
- **Per task commit:** `npm run build` (TypeScript catches type errors)
- **Per wave merge:** Manual QA with 2+ browser windows
- **Phase gate:** All 3 requirements manually verified

### Wave 0 Gaps
None -- no test infrastructure to set up. TypeScript compilation is the check. Manual QA covers the behavioral requirements.

## Sources

### Primary (HIGH confidence)
- **Codebase analysis** -- Full read of server/src/index.ts, socket/handlers.ts, social/socialHandlers.ts, social/socialRoutes.ts, game/RoomManager.ts, socket/authMiddleware.ts
- **Codebase analysis** -- Full read of client/src/store/socialStore.ts, components/social/FriendsList.tsx, hooks/useSocket.ts, socket.ts, App.tsx
- **Prisma schema** -- server/prisma/schema.prisma (User, Friendship models)
- **Research SUMMARY.md** -- .planning/research/SUMMARY.md (P4: Multi-Tab Presence Flicker pattern documented)

### Secondary (MEDIUM confidence)
- **Socket.io rooms pattern** -- Already proven in codebase via `user:{userId}` rooms from Phase 17
- **RoomManager pattern** -- Existing class demonstrates the in-memory singleton pattern this phase follows

### Tertiary (LOW confidence)
- None -- all research is based on codebase analysis and established patterns

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- no new dependencies, everything already installed and proven
- Architecture: HIGH -- PresenceManager follows exact same pattern as existing RoomManager; hooks into existing infrastructure
- Pitfalls: HIGH -- multi-tab flicker pitfall already documented in research SUMMARY.md (P4); grace period is well-understood pattern

**Research date:** 2026-04-03
**Valid until:** 2026-05-03 (stable -- no external dependencies involved)

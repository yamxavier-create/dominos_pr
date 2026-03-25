# Architecture Research

**Domain:** Social features (auth, friends, presence, direct join) for real-time multiplayer domino app
**Researched:** 2026-03-25
**Confidence:** HIGH

## Current Architecture Snapshot

Before defining the new architecture, here is what already exists and works.

### What Is Already Built

**Auth (complete):**
- REST API at `/api/auth` with register, login, Google OAuth, `/me`, logout
- JWT tokens with session table for revocation (Prisma + PostgreSQL)
- Socket.io auth middleware that identifies authenticated users or marks as guest
- `socket.data` carries `{ user?: { id, username, displayName }, guest: boolean }`
- Client: `authStore` (Zustand), `useAuth` hook, `AuthPage` with LoginForm/RegisterForm/GoogleLoginButton
- Token stored in `localStorage`, passed to socket via `socket.auth.token`

**Database (complete):**
- Prisma with PostgreSQL (via `@prisma/adapter-pg` driver adapter)
- Models: `User`, `Session`, `UserStats`, `Friendship` (with `FriendshipStatus` enum: PENDING/ACCEPTED/REJECTED)
- Friendship model has `@@unique([requesterId, targetId])` constraint

**Scaffolding (empty):**
- `server/src/social/` directory exists but is empty
- No presence tracking code exists
- No friend request handlers exist
- No socialStore on client

### What Is NOT Built

| Feature | Server | Client | Notes |
|---------|--------|--------|-------|
| Friend request/accept/reject | Nothing | Nothing | DB schema ready (Friendship model) |
| Friends list query | Nothing | Nothing | Need REST endpoint + socket events |
| Online presence | Nothing | Nothing | Core feature -- socket-based |
| Direct lobby join | Nothing | Nothing | Requires presence + room visibility |
| User search (by username) | Nothing | Nothing | Needed for friend requests |
| Social socket handlers | Nothing | Nothing | `server/src/social/` is empty |
| Social Zustand store | Nothing | Nothing | No `socialStore.ts` yet |

## System Overview

```
                          CLIENT                                       SERVER
 ┌────────────────────────────────────┐     ┌────────────────────────────────────────────┐
 │                                    │     │                                            │
 │  ┌──────────┐   ┌──────────────┐   │     │  ┌──────────────┐   ┌──────────────────┐   │
 │  │authStore │   │ socialStore  │   │     │  │ authRoutes   │   │ socialRoutes     │   │
 │  │(exists)  │   │ (NEW)        │   │     │  │ (exists)     │   │ (NEW: REST)      │   │
 │  └────┬─────┘   └──────┬───────┘   │     │  └──────────────┘   └──────────────────┘   │
 │       │                │           │     │                                            │
 │  ┌────┴────────────────┴────────┐  │     │  ┌──────────────────────────────────────┐  │
 │  │          socket.ts           │  │◄───►│  │           Socket.io Server           │  │
 │  │  (token in handshake.auth)   │  │ WS  │  │  authMiddleware (exists)             │  │
 │  └──────────────────────────────┘  │     │  │                                      │  │
 │                                    │     │  │  ┌──────────────┐  ┌──────────────┐  │  │
 │  ┌──────────────────────────────┐  │     │  │  │roomHandlers  │  │socialHandlers│  │  │
 │  │  useSocket (exists)          │  │     │  │  │(exists)      │  │(NEW)         │  │  │
 │  │  + social events (NEW)       │  │     │  │  └──────────────┘  └──────────────┘  │  │
 │  └──────────────────────────────┘  │     │  └──────────────────────────────────────┘  │
 │                                    │     │                                            │
 │  ┌──────────────────────────────┐  │     │  ┌──────────────────────────────────────┐  │
 │  │  UI Components               │  │     │  │  PresenceManager (NEW)               │  │
 │  │  - FriendsList (NEW)         │  │     │  │  - userId -> { socketIds, roomCode } │  │
 │  │  - FriendRequests (NEW)      │  │     │  │  - Per-user Socket.io rooms          │  │
 │  │  - OnlineIndicator (NEW)     │  │     │  └──────────────────────────────────────┘  │
 │  └──────────────────────────────┘  │     │                                            │
 │                                    │     │  ┌──────────────────────────────────────┐  │
 │                                    │     │  │  RoomManager (exists)                │  │
 │                                    │     │  │  + getUserRoom() (NEW method)        │  │
 │                                    │     │  └──────────────────────────────────────┘  │
 │                                    │     │                                            │
 │                                    │     │  ┌──────────────────────────────────────┐  │
 │                                    │     │  │  Prisma / PostgreSQL (exists)        │  │
 │                                    │     │  │  Friendship model (exists, unused)   │  │
 │                                    │     │  └──────────────────────────────────────┘  │
 └────────────────────────────────────┘     └────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Status |
|-----------|----------------|--------|
| `authStore` (client) | User identity, token, login state | EXISTS -- no changes needed |
| `socialStore` (client) | Friends list, friend requests, presence map, pending counts | NEW |
| `useAuth` hook (client) | Login/register/logout API calls, socket auth | EXISTS -- no changes needed |
| `useSocket` hook (client) | All socket event listeners including social events | EXISTS -- add social event listeners |
| `authMiddleware` (server) | Identify user or guest on socket connect | EXISTS -- no changes needed |
| `authRoutes` (server) | REST: register, login, Google OAuth, /me, logout | EXISTS -- no changes needed |
| `socialRoutes` (server) | REST: search users, get friends list, get friend requests | NEW |
| `socialHandlers` (server) | Socket: friend request, accept/reject, presence subscribe | NEW |
| `PresenceManager` (server) | Track online users, map userId to socketIds and room info | NEW |
| `RoomManager` (server) | In-memory room/game state | EXISTS -- add userId-based room lookup |

## Recommended New File Structure

```
server/src/
├── auth/                    # EXISTS -- no changes
│   ├── authRoutes.ts
│   ├── google.ts
│   ├── jwt.ts
│   └── passwordUtils.ts
├── db/
│   └── prisma.ts            # EXISTS -- no changes
├── game/
│   ├── GameEngine.ts        # EXISTS -- no changes
│   ├── GameState.ts         # EXISTS -- no changes (userId already on RoomPlayer)
│   └── RoomManager.ts       # EXISTS -- add getUserRoom() method
├── social/
│   ├── socialRoutes.ts      # NEW: REST endpoints for friend queries
│   ├── socialHandlers.ts    # NEW: Socket event handlers for social
│   └── PresenceManager.ts   # NEW: In-memory presence tracking
├── socket/
│   ├── authMiddleware.ts    # EXISTS -- no changes
│   ├── chatHandlers.ts      # EXISTS -- no changes
│   ├── gameHandlers.ts      # EXISTS -- no changes
│   ├── handlers.ts          # EXISTS -- register socialHandlers
│   ├── roomHandlers.ts      # EXISTS -- notify presence on room join/leave
│   └── webrtcHandlers.ts    # EXISTS -- no changes
├── config.ts                # EXISTS -- no changes
└── index.ts                 # EXISTS -- mount socialRoutes, instantiate PresenceManager

client/src/
├── store/
│   ├── authStore.ts         # EXISTS -- no changes
│   ├── socialStore.ts       # NEW: friends, requests, presence
│   ├── gameStore.ts         # EXISTS -- no changes
│   ├── roomStore.ts         # EXISTS -- no changes
│   ├── callStore.ts         # EXISTS -- no changes
│   └── uiStore.ts           # EXISTS -- no changes
├── hooks/
│   ├── useAuth.ts           # EXISTS -- no changes
│   ├── useSocket.ts         # EXISTS -- add social event listeners
│   └── ...                  # other existing hooks unchanged
├── components/
│   ├── auth/                # EXISTS -- no changes
│   ├── social/              # NEW
│   │   ├── FriendsList.tsx       # Friends list with online indicators
│   │   ├── FriendRequests.tsx    # Pending request list (incoming/outgoing)
│   │   ├── UserSearch.tsx        # Search users by username
│   │   ├── OnlineBadge.tsx       # Green/gray dot component
│   │   └── SocialPanel.tsx       # Container that shows on MenuPage
│   └── ...                  # other existing components unchanged
├── pages/
│   ├── MenuPage.tsx         # EXISTS -- add SocialPanel for logged-in users
│   └── ...                  # other pages unchanged
└── ...
```

### Structure Rationale

- **`social/` on server:** Keeps all social logic (presence, friends, search) in one cohesive module, separate from game logic. Same pattern as `auth/` and `game/`.
- **`socialStore` on client:** Single Zustand store for all social state (friends, requests, presence). Avoids fragmenting related state across multiple stores.
- **`PresenceManager` as a class:** Mirrors the existing `RoomManager` pattern -- a plain TypeScript class holding in-memory state, injected into socket handlers.
- **REST for queries, Socket for mutations and real-time:** Friend list fetch is a one-time query (REST). Friend request notifications and presence changes are real-time (Socket).

## Architectural Patterns

### Pattern 1: Per-User Socket.io Rooms for Presence

**What:** When an authenticated user connects, their socket joins a room named `user:{userId}`. This enables targeted notifications (friend requests, presence updates) without maintaining a separate userId-to-socketId mapping for emit purposes.

**When to use:** Always, for every authenticated socket connection.

**Trade-offs:**
- PRO: Socket.io manages the room lifecycle -- no manual cleanup needed on disconnect
- PRO: Multi-tab safe -- multiple sockets from same user join the same room
- PRO: `io.to('user:' + userId).emit(...)` works without custom lookup tables
- CON: Adds one room join per authenticated connection (negligible cost)

**Example:**
```typescript
// In the connection handler, after authMiddleware runs:
io.on('connection', (socket) => {
  const userData = getSocketUser(socket)
  if (userData.user) {
    socket.join(`user:${userData.user.id}`)
    presence.connect(userData.user.id, socket.id)
  }

  // ... existing registerHandlers(socket, io, rooms) ...

  socket.on('disconnect', () => {
    if (userData.user) {
      const result = presence.disconnect(userData.user.id, socket.id)
      if (result?.wentOffline) {
        // Notify subscribers that this user went offline
        notifyFriendsOfPresenceChange(io, userData.user.id, 'offline')
      }
    }
    // ... existing disconnect handler ...
  })
})
```

### Pattern 2: PresenceManager for Aggregated Status

**What:** A server-side in-memory class that tracks which authenticated users are online and their current activity (idle on menu, in a specific lobby, playing a game). Updated on socket connect/disconnect and room join/leave.

**When to use:** For answering "is this user online?" and "what is this user doing?" queries.

**Trade-offs:**
- PRO: O(1) lookup for any user's status
- PRO: Handles multi-tab correctly (tracks all socketIds per user, only goes "offline" when last socket disconnects)
- PRO: No database queries for real-time presence -- purely in-memory
- CON: In-memory only -- lost on server restart (acceptable; matches existing RoomManager pattern)

**Example:**
```typescript
type PresenceStatus = 'online' | 'in_lobby' | 'in_game'

interface UserPresence {
  userId: string
  socketIds: Set<string>
  status: PresenceStatus
  roomCode?: string  // which lobby/game they're in
}

class PresenceManager {
  private users = new Map<string, UserPresence>()
  private socketToUser = new Map<string, string>() // socketId -> userId

  connect(userId: string, socketId: string): void {
    this.socketToUser.set(socketId, userId)
    const existing = this.users.get(userId)
    if (existing) {
      existing.socketIds.add(socketId)
    } else {
      this.users.set(userId, {
        userId,
        socketIds: new Set([socketId]),
        status: 'online',
      })
    }
  }

  disconnect(userId: string, socketId: string): { wentOffline: boolean } {
    this.socketToUser.delete(socketId)
    const user = this.users.get(userId)
    if (!user) return { wentOffline: false }
    user.socketIds.delete(socketId)
    if (user.socketIds.size === 0) {
      this.users.delete(userId)
      return { wentOffline: true }
    }
    return { wentOffline: false }
  }

  setActivity(userId: string, status: PresenceStatus, roomCode?: string): void {
    const user = this.users.get(userId)
    if (user) {
      user.status = status
      user.roomCode = roomCode
    }
  }

  getPresence(userId: string): UserPresence | null {
    return this.users.get(userId) || null
  }

  getPresenceForMany(userIds: string[]): Map<string, UserPresence> {
    const result = new Map<string, UserPresence>()
    for (const id of userIds) {
      const p = this.users.get(id)
      if (p) result.set(id, p)
    }
    return result
  }

  getUserIdBySocket(socketId: string): string | undefined {
    return this.socketToUser.get(socketId)
  }
}
```

### Pattern 3: REST for Reads, Socket for Writes and Real-Time Push

**What:** Use REST endpoints for data that loads once on page mount (friends list, pending requests, user search results). Use Socket.io events for actions that need instant delivery to another user (send friend request, accept/reject, presence changes).

**When to use:** Deciding whether a social feature should be REST or socket.

**Trade-offs:**
- PRO: REST requests use the existing Express + Prisma pipeline with proper HTTP error handling and status codes
- PRO: Socket events only handle things that need real-time push to OTHER users
- PRO: Avoids putting query-heavy DB reads on the socket event loop
- CON: Two communication channels (but auth token already works for both -- HTTP header for REST, socket.handshake.auth for Socket)

**REST endpoints (new, mounted at `/api/social`):**
```
GET  /api/social/friends          -- My accepted friends + their presence status
GET  /api/social/requests         -- Pending incoming and outgoing requests
GET  /api/social/search?q=xxx     -- Search users by username (for adding friends)
```

**Socket events (new, prefixed with `social:`):**
```
Client -> Server:
  social:friend_request     { targetUsername: string }
  social:friend_accept      { requestId: string }
  social:friend_reject      { requestId: string }
  social:friend_remove      { friendId: string }
  social:subscribe_presence { friendIds: string[] }

Server -> Client:
  social:friend_request_received   { from: { id, username, displayName, avatarUrl }, requestId }
  social:friend_request_sent       { requestId, to: { id, username, displayName } }
  social:friend_accepted           { by: { id, username, displayName }, friendshipId }
  social:friend_rejected           { requestId }
  social:friend_removed            { byUserId }
  social:presence_update           { userId, status, roomCode? }
  social:presence_snapshot         { presences: Record<string, { status, roomCode? }> }
  social:error                     { message: string }
```

### Pattern 4: Presence Subscription Model

**What:** Instead of broadcasting presence changes to ALL connected users, each client subscribes to presence updates only for their specific friends. The server maintains a lightweight subscription map: which userId cares about which other userIds.

**When to use:** When presence broadcasts would waste bandwidth on users who don't have the changing user in their friends list.

**Trade-offs:**
- PRO: Only sends presence to users who have the friend in their list
- PRO: Scales to many concurrent users without N^2 broadcasts
- CON: Requires a subscription map on the server (simple Map, same as PresenceManager)
- CON: Client must re-subscribe if friends list changes (on accept/remove)

**Implementation approach:**

```typescript
// Server-side: track who subscribes to whose presence
class PresenceManager {
  // ... existing fields ...
  private subscriptions = new Map<string, Set<string>>()
  // key = userId being watched, value = set of userIds watching

  subscribe(watcherUserId: string, targetUserIds: string[]): void {
    for (const targetId of targetUserIds) {
      if (!this.subscriptions.has(targetId)) {
        this.subscriptions.set(targetId, new Set())
      }
      this.subscriptions.get(targetId)!.add(watcherUserId)
    }
  }

  unsubscribeAll(watcherUserId: string): void {
    for (const [, watchers] of this.subscriptions) {
      watchers.delete(watcherUserId)
    }
  }

  getSubscribers(userId: string): Set<string> {
    return this.subscriptions.get(userId) || new Set()
  }
}

// When user X changes status:
function notifyPresenceChange(io: Server, userId: string, status: string, roomCode?: string) {
  const subscribers = presence.getSubscribers(userId)
  for (const subscriberId of subscribers) {
    io.to(`user:${subscriberId}`).emit('social:presence_update', {
      userId, status, roomCode,
    })
  }
}
```

**Client-side flow:**

```typescript
// After loading friends list, subscribe to their presence
socket.emit('social:subscribe_presence', { friendIds: friends.map(f => f.id) })

// Server responds with initial snapshot
socket.on('social:presence_snapshot', ({ presences }) => {
  socialStore.getState().setPresenceMap(presences)
})

// Ongoing updates
socket.on('social:presence_update', ({ userId, status, roomCode }) => {
  socialStore.getState().updatePresence(userId, status, roomCode)
})
```

## Data Flow

### Friend Request Flow (new)

```
[UserA clicks "Add Friend" for username "bob"]
    |
    v
socket.emit('social:friend_request', { targetUsername: 'bob' })
    |
    v
[Server: socialHandlers.ts]
    ├── Validate: caller is authenticated (not guest)
    ├── Prisma: find User where username = 'bob'
    ├── Prisma: check no existing Friendship (either direction)
    ├── Prisma: create Friendship(PENDING, requesterId=A, targetId=B)
    ├── io.to('user:' + targetUserId).emit('social:friend_request_received', ...)
    └── socket.emit('social:friend_request_sent', { requestId, to: {...} })
```

### Friend Accept Flow (new)

```
[UserB clicks "Accept" on pending request]
    |
    v
socket.emit('social:friend_accept', { requestId: 'xxx' })
    |
    v
[Server: socialHandlers.ts]
    ├── Prisma: update Friendship set status = ACCEPTED
    ├── io.to('user:' + requesterId).emit('social:friend_accepted', ...)
    ├── socket.emit('social:friend_accepted', ...)
    ├── Auto-subscribe both users to each other's presence
    └── Send initial presence for the new friend to both users
```

### Presence Update Flow (new)

```
[User connects with valid token]
    |
    v
[authMiddleware identifies user] -> socket.join('user:' + userId)
    |
    v
[PresenceManager.connect(userId, socketId)]
    ├── First socket for this user? -> user just came online
    │   └── Notify subscribers: io.to('user:' + subscriberId).emit('social:presence_update', ...)
    └── Additional tab? -> no broadcast needed (already online)

[User creates or joins room]
    |
    v
[roomHandlers: room:create / room:join]
    └── PresenceManager.setActivity(userId, 'in_lobby', roomCode)
        └── Notify subscribers with { status: 'in_lobby', roomCode: 'COQUI-1234' }

[Game starts]
    |
    v
[gameHandlers: game:start]
    └── PresenceManager.setActivity(userId, 'in_game', roomCode)
        └── Notify subscribers with { status: 'in_game' } (no roomCode -- can't join mid-game)

[User disconnects (last socket)]
    |
    v
[PresenceManager.disconnect(userId, socketId)]
    ├── Any other sockets for this user? NO -> went offline
    └── Notify subscribers: presence_update { userId, status: 'offline' }
```

### Direct Join Flow (new)

```
[UserA sees friend "bob" with status 'in_lobby' and roomCode 'COQUI-1234']
    |
    v
[FriendsList shows green "Join" button next to bob]
    |
    v
[Click "Join"] -> populate roomStore with roomCode, navigate to join flow
    |
    v
socket.emit('room:join', { roomCode: 'COQUI-1234', playerName: userA.displayName })
    |
    v
[Existing room:join handler -- ZERO new server logic needed]
```

The critical insight: **direct join requires NO new server endpoint**. The client already has `room:join`. The presence data includes `roomCode` when a friend is `in_lobby`, so the FriendsList UI passes it to the existing join flow. The only gate: roomCode is only visible in presence when status is `in_lobby` (not `in_game`, since 4-player games fill up and joining mid-game isn't supported).

### Friends List Load Flow (new)

```
[MenuPage mounts, user is authenticated]
    |
    v
[SocialPanel mounts]
    |
    v
[useEffect: fetch friends and requests]
    ├── GET /api/social/friends -> [{ id, username, displayName, avatarUrl }]
    └── GET /api/social/requests -> { incoming: [...], outgoing: [...] }
    |
    v
[socialStore.setFriends(friends), socialStore.setRequests(requests)]
    |
    v
[socket.emit('social:subscribe_presence', { friendIds })]
    |
    v
[Server responds with initial presence snapshot]
    └── Server emits 'social:presence_snapshot' with current status of all online friends
    |
    v
[socialStore.setPresenceMap(presences)]
    |
    v
[FriendsList renders with online indicators and "Join" buttons where applicable]
```

## Integration Points with Existing Code

### Files That Need Modification

| File | Change | Risk |
|------|--------|------|
| `server/src/index.ts` | Mount `socialRoutes`, instantiate `PresenceManager`, pass to handlers, call `presence.connect/disconnect` in connection lifecycle | LOW -- additive |
| `server/src/socket/handlers.ts` | Import and call `registerSocialHandlers` (one new line) | LOW -- additive |
| `server/src/socket/roomHandlers.ts` | After `room:create`, `room:join`, `room:leave`: call `presence.setActivity()` (3-4 lines) | LOW -- additive, no logic changes |
| `server/src/game/RoomManager.ts` | Add `getUserRoom(userId)` method for looking up room by userId | LOW -- new method, no changes to existing |
| `client/src/hooks/useSocket.ts` | Add `social:*` event listeners in existing `useEffect` | LOW -- additive, same pattern as all other listeners |
| `client/src/pages/MenuPage.tsx` | Conditionally render `SocialPanel` when `isAuthenticated` | LOW -- one conditional block |

### Files That Stay Completely Unchanged

- All auth files (authRoutes, authMiddleware, jwt, google, passwordUtils, authStore, useAuth, AuthPage, LoginForm, RegisterForm, GoogleLoginButton) -- complete and sufficient
- All game files (GameEngine, GameState, gameHandlers, gameStore) -- game logic is untouched by social features
- All WebRTC files (useWebRTC, webrtcHandlers, callStore) -- independent concern
- All chat files (chatHandlers, chat components, uiStore chat state) -- independent concern
- Prisma schema -- Friendship model already defined, no migration needed
- Audio files -- independent concern
- Socket.ts client -- no changes (auth token passing already works)

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| `socialHandlers` <-> `PresenceManager` | Direct method calls (same process) | Both in-memory, server-side |
| `socialHandlers` <-> `Prisma` | Async DB queries | For friendship CRUD |
| `roomHandlers` <-> `PresenceManager` | Direct method calls | Room handlers notify presence on join/leave |
| `socialRoutes` <-> `Prisma` | Async DB queries | REST endpoints for friend/request list fetches |
| `socialStore` <-> `useSocket` | Zustand actions called from socket listener callbacks | Same pattern as gameStore/roomStore |
| `SocialPanel` <-> `socialStore` | Zustand selectors | Same pattern as all existing components |
| `socialRoutes` auth | Read `Authorization` header, verify JWT | Same pattern as `/api/auth/me` endpoint |

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| PostgreSQL (Railway) | Prisma ORM via `@prisma/adapter-pg` | Already configured, deployed, and running |
| Google OAuth | `google-auth-library` server-side verification | Already implemented, no changes needed |

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| 0-200 concurrent users | Current architecture is fine. In-memory PresenceManager, single server instance on Railway. |
| 200-2000 concurrent users | Still fine. Socket.io handles 10k+ connections per instance. PresenceManager Map is O(1). Subscription map is lightweight. |
| 2000+ concurrent users | Consider Redis adapter for Socket.io if horizontal scaling needed. Move PresenceManager state to Redis. Not needed for this app's target audience. |

### Scaling Priorities

1. **First bottleneck:** PostgreSQL connection pool. Current `pg.Pool` uses defaults (~10 connections). For 200+ concurrent users doing friend queries, may need to increase pool size in `db/prisma.ts`. Railway Postgres handles this well.
2. **Second bottleneck:** In-memory state (RoomManager + PresenceManager) ties the app to a single server instance. Only matters if deploying multiple instances behind a load balancer. Not a concern for current scope.

## Anti-Patterns

### Anti-Pattern 1: Querying Database for Real-Time Presence

**What people do:** Store `lastSeenAt` in the database and poll it to determine "online" status (e.g., "seen in last 60 seconds").
**Why it's wrong:** Database polling is slow, stale, and creates unnecessary load. The server ALREADY KNOWS who is connected via Socket.io.
**Do this instead:** Use the in-memory PresenceManager. The existing database `lastSeenAt` field is fine for "last seen 3 days ago" profile info, but real-time presence must come from socket connection state.

### Anti-Pattern 2: Broadcasting Presence to All Connected Users

**What people do:** When any user's status changes, emit to ALL connected sockets via `io.emit(...)`.
**Why it's wrong:** Wastes bandwidth. User A doesn't care that User Z (not their friend) went offline. With 200 users online, each presence change triggers 200 messages instead of ~5 (average friend count).
**Do this instead:** Subscription model. Clients subscribe to presence for their friends only. Server only notifies subscribers via per-user rooms.

### Anti-Pattern 3: Using Socket Events for Data Fetching

**What people do:** Use socket events for everything: `socket.emit('get_friends')` with a callback or response event.
**Why it's wrong:** Socket events are fire-and-forget with no built-in error handling, HTTP status codes, or request/response correlation. Loading a friends list is a standard request/response pattern. REST gives proper error codes, caching headers, and simpler debugging.
**Do this instead:** REST for queries (`GET /api/social/friends`). Socket for real-time push notifications only.

### Anti-Pattern 4: Creating a Special Server Event for Direct Join

**What people do:** Build a new `social:join_friend` socket event that looks up the friend's room and performs a special join flow.
**Why it's wrong:** Duplicates existing `room:join` logic. Two code paths for the same operation. If room join logic changes, the social join might not get updated.
**Do this instead:** Include `roomCode` in presence data when status is `in_lobby`. Client reads the room code from presence and calls the EXISTING `room:join`. Zero new server logic for the join itself.

### Anti-Pattern 5: Separate Socket.io Namespace for Social

**What people do:** Create a `/social` namespace to separate social events from game events.
**Why it's wrong:** Doubles the number of WebSocket connections per user (default namespace + social namespace). The auth middleware would need to run on both. Adds complexity for no benefit at this scale.
**Do this instead:** Use the default namespace. Prefix social events with `social:` (same convention as `room:`, `game:`, `chat:`, `webrtc:` that already exist).

### Anti-Pattern 6: Storing Presence in the Database

**What people do:** Create a `UserPresence` table in PostgreSQL and update it on every connect/disconnect.
**Why it's wrong:** Adds write load on every connection event. Stale data if server crashes (user appears "online" forever). A server restart already clears all Socket.io connections anyway.
**Do this instead:** Purely in-memory PresenceManager. Mirrors how RoomManager already works. If the server restarts, all presence resets -- which is correct because all sockets also reset.

## Build Order Recommendation

Based on dependency analysis, the recommended implementation order:

### Phase 1: Server Foundation (no client changes)
1. **PresenceManager class** -- standalone, no dependencies on other new code
2. **Wire PresenceManager into `index.ts`** -- connect/disconnect lifecycle
3. **socialRoutes (REST)** -- `/api/social/friends`, `/requests`, `/search`. Depends only on Prisma (exists)
4. **Mount socialRoutes in `index.ts`** -- `app.use('/api/social', socialRoutes)`

### Phase 2: Server Social Socket Handlers
5. **socialHandlers** -- friend request/accept/reject/remove socket events. Depends on PresenceManager + Prisma
6. **Presence hooks in roomHandlers** -- call `presence.setActivity()` on room:create, room:join, room:leave
7. **Register socialHandlers in handlers.ts**

### Phase 3: Client Store and Listeners
8. **socialStore (Zustand)** -- friends, requests, presence map
9. **Social event listeners in useSocket** -- wire `social:*` events to socialStore actions

### Phase 4: Client UI
10. **Social UI components** -- FriendsList, FriendRequests, UserSearch, OnlineBadge, SocialPanel
11. **MenuPage integration** -- render SocialPanel for authenticated users
12. **Direct join flow** -- "Join" button reads roomCode from presence, calls existing join

Steps 1-7 are server-side. Steps 8-12 are client-side. Within each phase, the order is strictly sequential (later steps depend on earlier ones). Phases 1-2 can be tested independently with Postman / socket client before any UI exists.

## Sources

- [Socket.IO Rooms documentation](https://socket.io/docs/v3/rooms/) -- per-user room pattern for targeted emit
- [Socket.IO Private Messaging tutorial Part I](https://socket.io/get-started/private-messaging-part-1/) -- userId-based room joins
- [Socket.IO Private Messaging tutorial Part II](https://socket.io/get-started/private-messaging-part-2/) -- presence tracking with rooms
- [Socket.IO Server API: fetchSockets()](https://socket.io/docs/v4/server-api/#serverin-room) -- checking connected sockets in a room
- [Socket.IO presence tracking patterns](https://medium.com/@ruveydayilmaz/handle-users-online-offline-status-with-socket-io-e92113c07eac) -- online/offline status with multi-tab handling
- [Real-time notification system with Socket.IO](https://medium.com/jeeon/using-socket-io-in-oder-to-build-a-realtime-notification-system-249a1bfd960d) -- friend request notification architecture
- Existing codebase: `server/src/socket/authMiddleware.ts` -- SocketUserData interface, getSocketUser helper
- Existing codebase: `server/src/game/RoomManager.ts` -- in-memory state management pattern (Map-based)
- Existing codebase: `server/src/auth/authRoutes.ts` -- REST endpoint pattern with JWT verification
- Existing codebase: `server/prisma/schema.prisma` -- Friendship model already defined
- Existing codebase: `client/src/hooks/useSocket.ts` -- socket event listener registration pattern
- Existing codebase: `client/src/store/roomStore.ts` -- Zustand store pattern

---
*Architecture research for: Social features integration into Domino PR*
*Researched: 2026-03-25*

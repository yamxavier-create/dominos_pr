# Phase 17: Friends System - Research

**Researched:** 2026-04-02
**Domain:** Friends CRUD (search, request, accept/reject, list, unfriend) with real-time Socket.io notifications for a multiplayer domino game
**Confidence:** HIGH

## Summary

Phase 17 builds the complete friends system -- the foundation for all subsequent social features (presence in Phase 18, direct join in Phase 19). The Prisma `Friendship` model is already migrated with `PENDING/ACCEPTED/REJECTED` status enum and a `@@unique([requesterId, targetId])` constraint. The server auth middleware already identifies authenticated users on every socket connection. The client has `authStore` with user identity and token management. No new dependencies are needed.

The two plans (17-01 server, 17-02 client) split cleanly: Plan 17-01 creates REST endpoints for queries (`GET /api/social/search`, `GET /api/social/friends`, `GET /api/social/requests`) and socket event handlers for mutations (`social:friend_request`, `social:friend_accept`, `social:friend_reject`, `social:friend_remove`) with the critical bidirectional race prevention on request creation. Plan 17-02 creates `socialStore` (Zustand), wires socket listeners in `useSocket`, and builds the UI components (UserSearch, FriendRequests, FriendsList, SocialPanel) integrated into the MainMenu.

**Primary recommendation:** Follow the REST-for-reads, socket-for-writes pattern established in the architecture research. Use `social:` event prefix consistent with existing `room:`, `game:`, `chat:`, `webrtc:` conventions. The bidirectional friendship check (Pitfall P3) is the single most critical implementation detail -- must check BOTH `(A,B)` and `(B,A)` directions before creating any request. Rate-limit outgoing requests to 20 pending max per user.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| FRD-01 | User can search for other users by username | REST endpoint `GET /api/social/search?q=xxx` with case-insensitive `startsWith` on username field. Prisma `User.findMany` with `where: { username: { startsWith, mode: 'insensitive' } }`. Exclude self, limit results to 10. |
| FRD-02 | User can send a friend request to another user | Socket event `social:friend_request` with bidirectional check (both directions) before insert. If reverse PENDING exists, auto-accept. Real-time notification to recipient via `io.to('user:' + targetId)`. Rate limit: max 20 pending outgoing. |
| FRD-03 | User can accept or reject a pending friend request | Socket events `social:friend_accept` and `social:friend_reject`. Accept updates status to ACCEPTED and notifies requester. Reject deletes the row (not REJECTED status -- cleaner, allows re-request). Server validates the accepting user is the `targetId` of the request. |
| FRD-04 | User can view their friends list showing all accepted friends | REST endpoint `GET /api/social/friends` returning accepted friendships in both directions (user as requester OR target). Include friend's `id`, `username`, `displayName`, `avatarUrl`. Phase 18 will enrich with presence. |
| FRD-05 | User can unfriend someone and they disappear from both users' lists | Socket event `social:friend_remove` deletes the Friendship row. Notifies the other user in real-time via `social:friend_removed`. Bidirectional removal (delete the row regardless of who was requester/target). |
</phase_requirements>

## Standard Stack

### Core (All Already Installed)
| Library | Version | Purpose | Status |
|---------|---------|---------|--------|
| `express` | 4.18.2 | REST routes for social queries | Installed, pattern established in `authRoutes.ts` |
| `socket.io` | 4.7.2+ | Real-time friend request/accept notifications | Installed, auth middleware wired |
| `@prisma/client` | 7.5.0 | Friendship model CRUD | Installed, model migrated |
| `jsonwebtoken` | 9.0.3 | JWT verification for REST endpoints | Installed, `verifyToken` helper exists |
| `zustand` | 4.4.7 | Client `socialStore` for friends/requests state | Installed, pattern established in `authStore` |
| `react` | 18.2.0 | Social UI components | Installed |
| `socket.io-client` | 4.7.2 | Client socket for social events | Installed |

### New Dependencies
None. Zero new packages needed for Phase 17.

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| REST for friend list queries | Socket events with callbacks | REST gives HTTP status codes, proper error handling, and caching. Socket callbacks are fire-and-forget with no built-in error semantics. REST is correct here. |
| Socket for mutations (request/accept/reject/remove) | REST POST/DELETE | Mutations need real-time push to the OTHER user. Socket events naturally push to both parties. REST would require a separate notification channel. |
| Delete row on reject | Set status to REJECTED | Deleting allows the user to re-request later. REJECTED status would require checking and handling that state in all queries, adding complexity for no value at this scale. |

**Installation:**
```bash
# Nothing to install -- all dependencies already present
```

## Architecture Patterns

### Recommended New Files

```
server/src/
  social/
    socialRoutes.ts      # NEW: REST endpoints (search, friends, requests)
    socialHandlers.ts    # NEW: Socket handlers (request, accept, reject, remove)

client/src/
  store/
    socialStore.ts       # NEW: Zustand store (friends, requests, counts)
  components/
    social/
      UserSearch.tsx     # NEW: Search input + results
      FriendRequests.tsx # NEW: Incoming request list with accept/reject
      FriendsList.tsx    # NEW: Accepted friends list
      SocialPanel.tsx    # NEW: Container tab/panel for social features
```

### Files That Need Modification

| File | Change | Risk |
|------|--------|------|
| `server/src/index.ts` | Mount `socialRoutes` at `/api/social`, join `user:{userId}` room on authenticated connect | LOW -- additive, 5-8 lines |
| `server/src/socket/handlers.ts` | Import and call `registerSocialHandlers` | LOW -- one new line |
| `client/src/hooks/useSocket.ts` | Add `social:*` event listeners in existing `useEffect` | LOW -- additive, same pattern as existing listeners |
| `client/src/components/lobby/MainMenu.tsx` | Render `SocialPanel` for authenticated users | LOW -- one conditional block |

### Files That Stay Unchanged

All auth files, all game files, all WebRTC files, all chat files, Prisma schema (model exists), audio files, `socket.ts`, `authStore.ts`, `useAuth.ts`.

### Pattern 1: REST for Reads, Socket for Writes

**What:** Friend list and search results load via REST on component mount. Mutations (send/accept/reject/remove) go through Socket.io for bidirectional real-time push.

**Why:** REST gives proper HTTP error codes and is cacheable. Socket events naturally push notifications to the other user without requiring polling or a separate notification channel.

**REST Endpoints (new, mounted at `/api/social`):**
```
GET  /api/social/search?q=xxx    -- Search users by username prefix
GET  /api/social/friends          -- List accepted friends
GET  /api/social/requests         -- Pending incoming + outgoing requests
```

**Socket Events (new, `social:` prefix):**
```
Client -> Server:
  social:friend_request     { targetUserId: string }
  social:friend_accept      { requestId: string }
  social:friend_reject      { requestId: string }
  social:friend_remove      { friendUserId: string }

Server -> Client:
  social:friend_request_received  { from: { id, username, displayName, avatarUrl }, requestId }
  social:friend_request_sent      { requestId, to: { id, username, displayName, avatarUrl } }
  social:friend_accepted          { friendshipId, friend: { id, username, displayName, avatarUrl } }
  social:friend_rejected          { requestId }
  social:friend_removed           { userId }
  social:error                    { message: string }
```

### Pattern 2: Auth Verification for REST Social Routes

**What:** Social REST endpoints verify JWT the same way `/api/auth/me` does -- extract Bearer token from Authorization header, call `verifyToken()`, use `payload.sub` as userId.

**Example:**
```typescript
// Reusable auth helper for social routes
async function requireAuth(req: Request, res: Response): Promise<string | null> {
  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Authentication required' })
    return null
  }
  try {
    const payload = verifyToken(authHeader.slice(7))
    return payload.sub // userId
  } catch {
    res.status(401).json({ error: 'Invalid token' })
    return null
  }
}
```

### Pattern 3: Auth Guard for Socket Social Events

**What:** All `social:*` socket events must verify the socket is authenticated (not a guest). Use `getSocketUser(socket)` and reject if `guest === true`.

**Example:**
```typescript
export function registerSocialHandlers(socket: Socket, io: Server) {
  const userData = getSocketUser(socket)

  socket.on('social:friend_request', async ({ targetUserId }) => {
    if (!userData.user) {
      return socket.emit('social:error', { message: 'Login required' })
    }
    // ... handle friend request
  })
}
```

### Pattern 4: Per-User Socket.io Room for Notifications

**What:** When an authenticated user connects, join them to `user:{userId}` room. This enables `io.to('user:' + userId).emit(...)` to reach all tabs of a specific user without maintaining a custom userId-to-socketId map.

**Where to wire:** In `server/src/index.ts` inside the `io.on('connection', ...)` handler, after `registerHandlers`:

```typescript
io.on('connection', socket => {
  const userData = getSocketUser(socket)
  if (userData.user) {
    socket.join(`user:${userData.user.id}`)
  }
  registerHandlers(socket, io, rooms)
  // ... existing disconnect handler
})
```

This is lightweight (one room join per authenticated connection) and multi-tab safe (multiple sockets from the same user join the same room). This room will also be used by Phase 18 (presence) and Phase 19 (direct join).

### Anti-Patterns to Avoid

- **Using socket events for data fetching:** Do NOT `socket.emit('social:get_friends')` with a callback. Use `GET /api/social/friends` with HTTP. Sockets are for push, not request-response.
- **Storing request/accept as separate tables:** The Friendship model with status column is the correct pattern. Do not create a separate `FriendRequest` table.
- **Checking only one direction for existing friendship:** ALWAYS check both `(A,B)` and `(B,A)` before creating a request. The `@@unique` constraint only prevents exact duplicates in one direction.
- **Using REJECTED status as a permanent block:** Reject should delete the row, not set status to REJECTED. This keeps queries simple and allows re-requesting.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| JWT verification in social routes | Custom middleware chain | Reuse `verifyToken()` from `auth/jwt.ts` directly | Already tested and working. Same pattern as `/api/auth/me`. |
| User notification delivery | Custom userId-to-socketId map | Socket.io rooms: `socket.join('user:' + id)` + `io.to('user:' + id).emit(...)` | Socket.io manages room lifecycle automatically. Multi-tab safe. |
| Debounced search input | Custom setTimeout/clearTimeout logic | Simple 300ms debounce in the search component | At this scale (< 100 users), even non-debounced search is fine. A simple `setTimeout` in the onChange handler is sufficient -- no need for lodash.debounce or useDeferredValue. |
| Friendship uniqueness enforcement | Application-level only | Database `@@unique([requesterId, targetId])` constraint (already exists) + application-level bidirectional check | The DB constraint is the safety net. The app-level check provides better error messages. |

## Common Pitfalls

### Pitfall 1: Bidirectional Friendship Race Condition (CRITICAL -- P3 from research)

**What goes wrong:** Player A sends a request to B. Simultaneously, B sends one to A. Two rows created: `(A->B, PENDING)` and `(B->A, PENDING)`. Neither can be properly accepted because accept logic expects the acceptor to be `targetId`.

**Why it happens:** The `@@unique([requesterId, targetId])` prevents `(A,B)` duplication but NOT `(B,A)`.

**How to avoid:** Before creating ANY friend request, check both directions in one query:
```typescript
const existing = await prisma.friendship.findFirst({
  where: {
    OR: [
      { requesterId: senderId, targetId: receiverId },
      { requesterId: receiverId, targetId: senderId },
    ]
  }
})
```
If a reverse PENDING request exists, auto-accept it instead of creating a new one. Wrap in a transaction for safety.

**Warning signs:** Users appearing as both "pending" and "friend". Duplicate entries. "Accept" button doing nothing.

### Pitfall 2: Friend List Query Missing Both Directions

**What goes wrong:** Query only fetches friendships where user is `requesterId` with status ACCEPTED. Misses all friendships where user was the `targetId` who accepted.

**Why it happens:** The Friendship model is directional (requester -> target). A query on only one relation misses half the friends.

**How to avoid:** Always query BOTH directions:
```typescript
const friendships = await prisma.friendship.findMany({
  where: {
    status: 'ACCEPTED',
    OR: [
      { requesterId: userId },
      { targetId: userId },
    ]
  },
  include: {
    requester: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
    target: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
  }
})
// Then extract the "other" user from each friendship
const friends = friendships.map(f =>
  f.requesterId === userId ? f.target : f.requester
)
```

### Pitfall 3: No Rate Limiting on Friend Requests

**What goes wrong:** A user sends hundreds of friend requests, spamming other users with notifications and filling the database.

**Why it happens:** No limit on pending outgoing requests.

**How to avoid:** Before creating a request, count pending outgoing:
```typescript
const pendingCount = await prisma.friendship.count({
  where: { requesterId: userId, status: 'PENDING' }
})
if (pendingCount >= 20) {
  return socket.emit('social:error', { message: 'Too many pending requests' })
}
```

### Pitfall 4: Unfriend Deletes Wrong Row

**What goes wrong:** Unfriend logic assumes the current user is the `requesterId`, but they might be the `targetId`.

**How to avoid:** Delete by matching EITHER direction:
```typescript
await prisma.friendship.deleteMany({
  where: {
    OR: [
      { requesterId: userId, targetId: friendUserId },
      { requesterId: friendUserId, targetId: userId },
    ]
  }
})
```

### Pitfall 5: Search Returns Self or Already-Friends

**What goes wrong:** User searches for a username and sees themselves in results, or sees users they're already friends with.

**How to avoid:** Exclude self from results. For existing relationships, either exclude from results or annotate with status ("Already friends", "Request pending") so the UI can handle it.

### Pitfall 6: Guest Users Triggering Social Actions

**What goes wrong:** A guest socket emits `social:friend_request`. Server tries to look up `userData.user.id` which is undefined, causing a crash or unhandled error.

**How to avoid:** Every `social:*` handler must start with an auth guard:
```typescript
if (!userData.user) {
  return socket.emit('social:error', { message: 'Login required' })
}
```

## Code Examples

### Server: socialRoutes.ts -- Search Users (FRD-01)

```typescript
// GET /api/social/search?q=xxx
router.get('/search', async (req: Request, res: Response) => {
  const userId = await requireAuth(req, res)
  if (!userId) return

  const q = (req.query.q as string || '').trim().toLowerCase()
  if (q.length < 2) {
    return res.json({ users: [] })
  }

  const users = await prisma.user.findMany({
    where: {
      username: { startsWith: q, mode: 'insensitive' },
      id: { not: userId }, // Exclude self
    },
    select: { id: true, username: true, displayName: true, avatarUrl: true },
    take: 10,
  })

  // Optionally annotate with friendship status
  const friendships = await prisma.friendship.findMany({
    where: {
      OR: users.map(u => ({
        OR: [
          { requesterId: userId, targetId: u.id },
          { requesterId: u.id, targetId: userId },
        ]
      })).flat()
    },
    select: { requesterId: true, targetId: true, status: true }
  })

  const annotated = users.map(u => {
    const fs = friendships.find(f =>
      (f.requesterId === userId && f.targetId === u.id) ||
      (f.requesterId === u.id && f.targetId === userId)
    )
    return { ...u, friendshipStatus: fs?.status || null }
  })

  res.json({ users: annotated })
})
```

### Server: socialHandlers.ts -- Send Friend Request (FRD-02, with P3 prevention)

```typescript
socket.on('social:friend_request', async ({ targetUserId }: { targetUserId: string }) => {
  if (!userData.user) {
    return socket.emit('social:error', { message: 'Login required' })
  }
  const senderId = userData.user.id

  if (senderId === targetUserId) {
    return socket.emit('social:error', { message: 'Cannot friend yourself' })
  }

  try {
    // Rate limit: max 20 pending outgoing
    const pendingCount = await prisma.friendship.count({
      where: { requesterId: senderId, status: 'PENDING' }
    })
    if (pendingCount >= 20) {
      return socket.emit('social:error', { message: 'Too many pending requests (max 20)' })
    }

    // CRITICAL: Check BOTH directions (P3 race prevention)
    const existing = await prisma.friendship.findFirst({
      where: {
        OR: [
          { requesterId: senderId, targetId: targetUserId },
          { requesterId: targetUserId, targetId: senderId },
        ]
      }
    })

    if (existing) {
      if (existing.status === 'ACCEPTED') {
        return socket.emit('social:error', { message: 'Already friends' })
      }
      if (existing.requesterId === senderId && existing.status === 'PENDING') {
        return socket.emit('social:error', { message: 'Request already sent' })
      }
      // Reverse PENDING: other user already sent us a request -- auto-accept
      if (existing.requesterId === targetUserId && existing.status === 'PENDING') {
        const updated = await prisma.friendship.update({
          where: { id: existing.id },
          data: { status: 'ACCEPTED' },
          include: {
            requester: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
            target: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
          }
        })
        // Notify both users
        socket.emit('social:friend_accepted', {
          friendshipId: updated.id,
          friend: updated.requester, // the other user
        })
        io.to(`user:${targetUserId}`).emit('social:friend_accepted', {
          friendshipId: updated.id,
          friend: updated.target, // us
        })
        return
      }
    }

    // Create new PENDING request
    const friendship = await prisma.friendship.create({
      data: { requesterId: senderId, targetId: targetUserId },
      include: {
        requester: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
        target: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
      }
    })

    // Notify sender (confirmation)
    socket.emit('social:friend_request_sent', {
      requestId: friendship.id,
      to: friendship.target,
    })

    // Notify recipient (real-time)
    io.to(`user:${targetUserId}`).emit('social:friend_request_received', {
      requestId: friendship.id,
      from: friendship.requester,
    })
  } catch (err) {
    console.error('[Social] Friend request error:', err)
    socket.emit('social:error', { message: 'Failed to send friend request' })
  }
})
```

### Client: socialStore.ts Shape

```typescript
interface Friend {
  id: string
  username: string
  displayName: string
  avatarUrl: string | null
}

interface FriendRequest {
  requestId: string
  user: Friend // who sent/received
  direction: 'incoming' | 'outgoing'
}

interface SocialState {
  friends: Friend[]
  requests: FriendRequest[]
  searchResults: (Friend & { friendshipStatus: string | null })[]
  pendingCount: number
  loading: boolean

  setFriends: (friends: Friend[]) => void
  setRequests: (requests: FriendRequest[]) => void
  setSearchResults: (results: any[]) => void
  addFriend: (friend: Friend) => void
  removeFriend: (userId: string) => void
  addRequest: (request: FriendRequest) => void
  removeRequest: (requestId: string) => void
  setPendingCount: (count: number) => void
}
```

### Client: REST API Helper for Social Routes

```typescript
const API_BASE = import.meta.env.VITE_API_URL || ''

async function socialApi(path: string, token: string) {
  const res = await fetch(`${API_BASE}/api/social${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error((await res.json()).error || 'Request failed')
  return res.json()
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Two separate tables (FriendRequest + Friend) | Single Friendship table with status column | Standard since ~2020 | Simpler queries, atomic state transitions, no orphaned rows |
| REST polling for new requests | Socket.io push notifications | N/A (this project always had Socket.io) | Instant delivery, no wasted requests |
| Client-side friendship validation | Server is authority (existing pattern) | N/A | Prevents spoofing, consistent with game logic pattern |

**Deprecated/outdated:**
- None relevant. The Friendship model with status enum is the standard pattern for this scale.

## Open Questions

1. **Reject behavior: delete row or set REJECTED?**
   - What we know: Deleting allows re-requesting later. REJECTED status blocks re-requests but adds query complexity.
   - Recommendation: **Delete the row on reject.** Simpler queries, no need for a "block" feature at this scale. If re-request spam becomes an issue, can add rate limiting per target per day later.

2. **Search by displayName or username only?**
   - What we know: UX research (FEATURES.md) suggests users may know friends by display name, not username. But display names can have duplicates.
   - Recommendation: **Search by username only for v1.** Username is the unique identifier. Display name is shown in results alongside username. Keep it simple.

3. **Notification count persistence across page refreshes?**
   - What we know: Pending count must survive page refresh. REST `GET /api/social/requests` returns the data.
   - Recommendation: **Fetch on mount.** When SocialPanel mounts (or when MenuPage mounts for authenticated users), fetch pending requests and compute count. No need for persistent storage beyond the server.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | None (TypeScript strict mode is the primary check) |
| Config file | None -- `tsconfig.json` in both client/ and server/ |
| Quick run command | `cd server && npx tsc --noEmit && cd ../client && npx tsc --noEmit` |
| Full suite command | `npm run build` (builds both workspaces with TypeScript check) |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| FRD-01 | Search returns matching users, excludes self | manual | Test via curl: `curl -H "Authorization: Bearer $TOKEN" "localhost:3001/api/social/search?q=test"` | N/A |
| FRD-02 | Friend request created, recipient notified in real-time | manual | Open two browser tabs as different users, send request from one, observe notification on other | N/A |
| FRD-03 | Accept updates status, reject deletes row, both notify | manual | Accept/reject from recipient UI, verify both users see updated state | N/A |
| FRD-04 | Friends list shows all accepted friends in both directions | manual | Verify list after accepting from both sides of friendships | N/A |
| FRD-05 | Unfriend removes from both users' lists in real-time | manual | Unfriend from one user, verify other user's list updates | N/A |

### Sampling Rate
- **Per task commit:** `npm run build` (TypeScript compilation catches type errors)
- **Per wave merge:** Manual verification of all FRD requirements
- **Phase gate:** All 5 success criteria verified before `/gsd:verify-work`

### Wave 0 Gaps
- No test framework exists for this project. TypeScript strict mode + manual testing is the established pattern.
- No automated tests to add -- this is consistent with the project's existing approach (CLAUDE.md states "No hay test ni lint scripts").

## Sources

### Primary (HIGH confidence)
- **Codebase analysis:** `server/prisma/schema.prisma` -- Friendship model with PENDING/ACCEPTED/REJECTED enum, `@@unique([requesterId, targetId])`, relations on User. Already migrated (20260319112129_init).
- **Codebase analysis:** `server/src/auth/authRoutes.ts` -- REST endpoint pattern with JWT verification (GET /api/auth/me serves as template for social routes).
- **Codebase analysis:** `server/src/socket/authMiddleware.ts` -- `getSocketUser()` helper, `SocketUserData` interface with `user` and `guest` fields.
- **Codebase analysis:** `server/src/socket/handlers.ts` -- Handler registration pattern (`registerXHandlers(socket, io, rooms)`).
- **Codebase analysis:** `server/src/socket/roomHandlers.ts` -- Socket event handler pattern with auth checks.
- **Codebase analysis:** `client/src/hooks/useSocket.ts` -- Socket listener pattern with cleanup in useEffect return.
- **Codebase analysis:** `client/src/store/authStore.ts` -- Zustand store pattern with typed interface.
- **Existing research:** `.planning/research/ARCHITECTURE.md` -- Detailed architecture patterns including per-user Socket.io rooms, PresenceManager, REST-for-reads/socket-for-writes.
- **Existing research:** `.planning/research/PITFALLS.md` -- P3 (bidirectional race condition), P1 (dual identity), rate limiting.
- **Existing research:** `.planning/research/FEATURES.md` -- Feature landscape, friend request flow, dependency graph.

### Secondary (MEDIUM confidence)
- **Existing research:** `.planning/research/STACK.md` -- No new dependencies needed, all verified.
- [Socket.IO Rooms documentation](https://socket.io/docs/v3/rooms/) -- per-user room pattern for targeted notifications.

### Tertiary (LOW confidence)
- None. All findings verified against codebase and existing research.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all libraries already installed and verified in codebase
- Architecture: HIGH -- patterns directly from existing codebase analysis + architecture research
- Pitfalls: HIGH -- P3 bidirectional race verified against actual Prisma schema constraint
- Code examples: HIGH -- derived from existing codebase patterns (authRoutes, roomHandlers)

**Research date:** 2026-04-02
**Valid until:** 2026-05-02 (stable -- no external dependency changes, all patterns from existing codebase)

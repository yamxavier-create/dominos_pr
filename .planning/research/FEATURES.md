# Feature Landscape: Social & Accounts (v1.3)

**Domain:** User accounts, friends system, online presence, and direct lobby join for a casual multiplayer domino web app
**Researched:** 2026-03-25

---

## Existing Infrastructure to Leverage

The codebase already has significant scaffolding that reduces the work for social features:

| Existing Asset | Location | Relevance |
|----------------|----------|-----------|
| Auth store (Zustand) | `client/src/store/authStore.ts` | `AuthUser` type with id, username, displayName, avatarUrl, stats. `setAuth`, `logout`, `updateUser` already wired. Token persisted to localStorage. |
| Auth routes (REST) | `server/src/auth/authRoutes.ts` | Register, login (username/password), Google OAuth, `/me` endpoint, logout -- all functional. JWT-based sessions with Prisma Session model. |
| Socket auth middleware | `server/src/socket/authMiddleware.ts` | Validates JWT on socket connect, populates `socket.data` with `{ user, guest }`. Graceful fallback to guest mode on invalid/missing token. Updates `lastSeenAt`. |
| Prisma Friendship model | `server/prisma/schema.prisma` | `Friendship` table with `requesterId`, `targetId`, `status` (PENDING/ACCEPTED/REJECTED), timestamps, unique constraint on `[requesterId, targetId]`. Relations wired on User model. |
| User model with userId | `server/src/game/GameState.ts` | `PlayerState.userId` and `RoomPlayer.userId` already optional fields. Room creation and joining already pass `userId` from auth middleware. |
| Room info broadcast | `server/src/game/RoomManager.ts` | `getRoomInfo()` already includes `userId` per player. Room status (`waiting` / `in_game`) and roomCode are already exposed. |
| MainMenu auth awareness | `client/src/components/lobby/MainMenu.tsx` | Already shows user badge when authenticated, login link when guest. Auto-fills playerName from `user.displayName`. |
| Auth page + forms | `client/src/pages/AuthPage.tsx`, `LoginForm.tsx`, `RegisterForm.tsx`, `GoogleLoginButton.tsx` | Login/register UI scaffolded. Google OAuth button component exists. |
| useAuth hook | `client/src/hooks/useAuth.ts` | Auth flow hook for client-side login/register/token refresh. |

**What does NOT exist yet:** Friends list UI, friend request/accept handlers (server), presence tracking system, friends panel/drawer, direct join flow, search-by-username feature, any socket events for social interactions.

---

## Table Stakes

Features that users of a "friends + accounts" system absolutely expect. Shipping without these makes the feature feel broken or incomplete.

### 1. Friend Request by Username Search

**Why expected:** The primary way to add friends in a casual game without address book access or social media integration. Users need to find each other by a handle they can share verbally or via text.

**Concrete behavior:**
- Text input to search by username (exact match or prefix search)
- Search results show displayName, username, and avatar
- "Add Friend" button sends a request
- Cannot send duplicate requests to the same user
- Cannot send request to yourself
- Shows "Request Sent" state if pending request exists

**Complexity:** Low
**Dependencies:** Auth (must be logged in), Friendship model (already in schema)
**Notes:** Keep search simple -- exact match or starts-with. Full-text search is overkill for a casual domino game. The username is the unique handle; displayName can have duplicates.

### 2. Friend Request Inbox (Accept / Reject)

**Why expected:** Bidirectional consent is the standard pattern. Users need to see who wants to be their friend and act on it.

**Concrete behavior:**
- Badge/counter showing number of pending incoming requests
- List of pending requests with requester's displayName, username, avatar
- Accept button: changes status to ACCEPTED
- Reject button: changes status to REJECTED (or deletes the row -- simpler)
- Real-time notification via Socket.io when a request arrives while online
- Real-time update to requester when request is accepted

**Complexity:** Low-Medium
**Dependencies:** Auth, Friendship model, Socket.io event for real-time notification
**Notes:** Reject should silently remove the request rather than notify the requester. No "block" feature needed for MVP -- a rejected request just disappears.

### 3. Friends List with Online Status

**Why expected:** The entire point of adding friends is seeing them and knowing when they're available. A friends list without status indicators is useless.

**Concrete behavior:**
- List of accepted friends grouped by status: Online > In Lobby > In Game > Offline
- Each entry shows: displayName, avatar, status dot (green=online, yellow=in lobby, blue=in game, gray=offline)
- Online status updates in real-time via Socket.io
- Offline threshold: user disconnects all sockets = offline (update within a few seconds)
- Accessible from main menu via a "Friends" button or icon

**Presence states:**
| State | Color | Meaning | Actionable? |
|-------|-------|---------|-------------|
| Online | Green | Connected, not in a room | No direct action |
| In Lobby | Yellow/Amber | In a room, waiting for players | "Join" button available |
| In Game | Blue | Currently playing a match | No action (room is full/active) |
| Offline | Gray | No active socket connection | No action |

**Complexity:** Medium
**Dependencies:** Auth, Friendship model, presence tracking system (new), Socket.io rooms/events for presence broadcast
**Notes:** This is the most technically involved table-stakes feature because presence requires tracking socket connections per user and broadcasting to their friends.

### 4. Direct Join to Friend's Lobby

**Why expected:** Seeing a friend "In Lobby" without being able to join them is frustrating. The join button is the payoff for the entire social system.

**Concrete behavior:**
- "Join" button appears next to friends with "In Lobby" status
- Clicking "Join" auto-fills the room code and joins (skipping manual code entry)
- If lobby is full (4/4 players), show error "Sala llena"
- If friend left the lobby between presence update and join attempt, show error "Sala no encontrada"
- Uses existing `room:join` socket event -- no new join mechanism needed, just auto-filling the roomCode from presence data

**Complexity:** Low
**Dependencies:** Friends list, presence tracking (must include roomCode for "In Lobby" friends)
**Notes:** This is surprisingly simple because the room:join mechanism already exists. The "hard" part is presence tracking exposing the roomCode to friends. Privacy consideration: only friends should see what room you're in.

### 5. Guest Mode Preserved

**Why expected:** The current app is frictionless -- enter name, join. Adding mandatory accounts would destroy the casual value proposition. The PROJECT.md explicitly requires this.

**Concrete behavior:**
- Guest users can still create/join rooms with a name, no account required
- Social features (friends, presence, direct join) are grayed out or hidden for guests
- A subtle "Log in to add friends" prompt appears in appropriate places
- Logged-in users get their displayName auto-filled but can still change it per-session
- If a guest later creates an account, their current game session is unaffected

**Complexity:** Low
**Dependencies:** Auth middleware already handles this (guest fallback exists)
**Notes:** The auth middleware already gracefully falls back to guest mode. The client's MainMenu already conditionally renders auth state. Just ensure new social UI components check `isAuthenticated` before rendering.

### 6. Persistent User Profile

**Why expected:** Users who create an account expect their identity (name, avatar, stats) to persist across sessions and devices.

**Concrete behavior:**
- Display name editable from a profile/settings area
- Avatar from Google OAuth (if used) or first-letter fallback
- Stats visible: games played, games won (already in UserStats model)
- Profile accessible from main menu (already partially rendered in MainMenu)

**Complexity:** Low
**Dependencies:** Auth, UserStats model (exists), `/me` endpoint (exists)
**Notes:** Most of this is already built. The missing piece is a dedicated profile view/edit screen and wiring stats updates after game completion (currently UserStats exists but is never incremented).

---

## Differentiators

Features that elevate the social experience beyond basic expectations. Not required for launch but add significant value.

| Feature | Value Proposition | Complexity | Dependencies | Notes |
|---------|-------------------|------------|--------------|-------|
| **Friend request via in-game context** | After playing a game with someone, a "Add Friend" button in the post-game modal lets you friend people you just played with | Low | Auth, Friendship model, game-end modal | Natural friendship formation point. Research shows proximity + shared experience is how game friendships form. Only show for logged-in users playing with other logged-in users. |
| **Notification badge on main menu** | Red badge on "Friends" icon showing pending request count | Low | Friendship query on connect, real-time updates | Standard mobile UX pattern. Drives engagement with friend system. |
| **"Last seen" for offline friends** | Shows "Last seen 2h ago" instead of just "Offline" | Low | `lastSeenAt` already tracked in User model on socket disconnect | Tiny effort, big UX improvement. Already have the data. |
| **Invite link sharing** | Generate a shareable URL like `dominos.pr/join/COQUI-1234` that deep-links into a specific room | Medium | URL routing, PWA deep link handling | Bridges the gap between social features and the existing room-code system. Useful for sharing via WhatsApp/iMessage. |
| **Real-time friend activity feed** | Small toast/notification when a friend comes online or starts a game | Low-Medium | Presence events, toast UI component | "YamirX is online" or "JuanPR started a game" toasts. Subtle, not intrusive. Drives re-engagement. |
| **Friend count / social proof on profile** | Show "12 friends" on user profile | Low | Count query on Friendship table | Minor social proof element. Trivial to implement. |
| **Rematch with same group** | After game ends, if all players are friends, show "Play Again" that creates new room with same group | Low-Medium | Friendship checks, room creation flow | Natural extension of the existing rematch system. Only valuable after friends system exists. |
| **Game history with friend context** | "You played with JuanPR 3 times this week" in friends list | High | New GameHistory model, post-game persistence | Requires persisting game results to DB. Significant schema and logic addition. Defer to later milestone. |

---

## Anti-Features

Features to explicitly NOT build. These add complexity without proportional value, or actively harm the casual game experience.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| **Public matchmaking / random pairing** | This is a friends-and-family domino game, not a competitive ladder. Random matchmaking changes the social dynamic entirely and requires rating systems, abuse prevention, and queue management. | Keep room codes + friends join. Players who want to play with strangers can share codes in external communities. |
| **Block / report system** | For a small-circle casual game, block/report adds moderation burden with near-zero need. The friend system is opt-in bidirectional -- you only see people you accepted. | Reject friend request = done. Unfriend = remove from list. No formal block needed for MVP. |
| **Chat with friends outside of games** | DM system requires message persistence, delivery tracking, offline queuing, notification infrastructure. Massive feature surface. Players already have WhatsApp/iMessage for texting friends. | In-game chat (already built) is sufficient. Friends list is for finding people to play with, not chatting. |
| **Friend groups / categorization** | Tags, groups, favorites -- adds UI complexity for a friends list that will realistically have 5-20 entries | Flat list sorted by online status. Simple. |
| **Email/push notifications** | "Your friend is online!" via email or push notification requires notification service, email infrastructure, user preferences, and can feel spammy | In-app presence indicators are sufficient. Players who want to coordinate can text each other externally. |
| **Leaderboards (global or friends)** | Ranking systems change the game's social dynamic from cooperative fun to competitive pressure. Puerto Rican dominos among friends is about camaraderie, not climbing a ladder. | Show personal stats (games played/won) on profile. No rankings. |
| **Avatar upload / customization** | Image hosting, moderation, storage costs, abuse potential. Completely disproportionate effort for a domino game. | Google avatar if available, first-letter colored circle if not. Clean and consistent. |
| **Social login with Facebook/Apple** | Facebook SDK is heavy and privacy-controversial. Apple Sign-In requires Apple Developer Program ($99/yr). Google OAuth covers the vast majority of users. | Google OAuth + username/password covers all use cases. Add Apple only if user demand is clear. |
| **Friend suggestions / "People you may know"** | Requires graph analysis, raises privacy concerns, and is creepy for a small casual game | Manual search by username. Players know who they want to add. |
| **Spectator mode via friends list** | "Watch friend's game" requires a read-only game state stream, new UI mode, server-side spectator slots | Out of scope (already noted in PROJECT.md). Separate milestone if ever. |

---

## Feature Dependencies

```
Auth System (already built)
  |
  +--> User Profile (partially built -- needs edit screen + stats wiring)
  |
  +--> Friend System
  |      |
  |      +--> Username Search (requires: auth, User model)
  |      |
  |      +--> Friend Request / Accept (requires: auth, Friendship model)
  |      |     |
  |      |     +--> Request Notification (requires: Socket.io event)
  |      |     |
  |      |     +--> Notification Badge (requires: pending count query)
  |      |
  |      +--> Friends List UI (requires: accepted friendships query)
  |             |
  |             +--> Presence Tracking (requires: socket connect/disconnect + user-to-room mapping)
  |             |     |
  |             |     +--> Status Indicators (Online / In Lobby / In Game / Offline)
  |             |     |
  |             |     +--> Presence Broadcast to Friends (requires: friends query + Socket.io rooms per user)
  |             |
  |             +--> Direct Join (requires: presence data with roomCode + existing room:join)
  |
  +--> Post-Game Add Friend (requires: friend system + game-end modal)
  |
  +--> Stats Tracking (requires: UserStats model + game completion hook)
```

**Critical path:** Auth (done) -> Friend Request/Accept -> Friends List -> Presence Tracking -> Direct Join

The presence system is the bottleneck. Everything else is straightforward CRUD + Socket.io events, but presence requires:
1. Tracking which sockets belong to which userId
2. Mapping userId to room status (not in room / in lobby / in game)
3. Broadcasting status changes only to that user's accepted friends
4. Handling multiple tabs / reconnections gracefully

---

## Presence System Design (Key Technical Detail)

Because presence is the most complex new subsystem, here's the expected behavior in detail:

### State Machine per User

```
OFFLINE  <-->  ONLINE  <-->  IN_LOBBY  <-->  IN_GAME
  ^                             |                |
  |                             v                v
  +-------- disconnect ---------+----------------+
```

### State Transitions

| Trigger | From | To | Data Broadcast |
|---------|------|----|----------------|
| Socket connects (authenticated) | OFFLINE | ONLINE | `{ userId, status: 'online' }` |
| `room:create` or `room:join` | ONLINE | IN_LOBBY | `{ userId, status: 'in_lobby', roomCode }` |
| `game:started` | IN_LOBBY | IN_GAME | `{ userId, status: 'in_game' }` |
| `game:game_ended` + back to lobby | IN_GAME | IN_LOBBY | `{ userId, status: 'in_lobby', roomCode }` |
| `room:leave` | IN_LOBBY | ONLINE | `{ userId, status: 'online' }` |
| Socket disconnects (all tabs) | Any | OFFLINE | `{ userId, status: 'offline' }` |

### Broadcast Strategy

Use a Socket.io room per user for friend notifications: `user:{userId}`. When user A's friends come online, they join room `user:A` so A receives their presence updates. This avoids querying the friends list on every status change.

**On connect (authenticated user):**
1. Query accepted friends from DB
2. For each friend: join their notification room `user:{friendId}`
3. Emit own status to own notification room `user:{myUserId}`

**On status change:**
1. Emit to `user:{myUserId}` room -- all online friends receive it

**On disconnect:**
1. After brief delay (3-5s debounce for reconnections), emit offline status to `user:{myUserId}`

---

## MVP Recommendation

**Ship in this order for maximum impact with minimum risk:**

### Phase 1: Friend System Core

1. **Server: Friend request/accept/reject endpoints** -- Socket.io events: `friend:request`, `friend:accept`, `friend:reject`, `friend:list`, `friend:search`
2. **Server: Pending count on connect** -- Return pending request count when authenticated user connects
3. **Client: Friends panel/drawer** -- Accessible from main menu, shows friends list and pending requests
4. **Client: Username search + send request** -- Search input, results, "Add" button
5. **Client: Accept/reject incoming requests** -- Inbox with action buttons

This delivers the core social graph without the complexity of real-time presence.

### Phase 2: Presence + Direct Join

1. **Server: Presence tracking** -- userId-to-status mapping, socket room per user for broadcasts
2. **Server: Broadcast presence to friends** -- Status changes emitted to friend notification rooms
3. **Client: Online status indicators** -- Green/yellow/blue/gray dots on friends list
4. **Client: Direct "Join" button** -- Auto-join friend's lobby from friends list
5. **Client: Friend activity toasts** -- Optional: "FriendName is online" notifications

This is where the real value lands -- seeing friends and joining them.

### Phase 3: Polish

1. **Post-game "Add Friend" button** -- In round-end/game-end modal for logged-in non-friend players
2. **Stats wiring** -- Increment UserStats.gamesPlayed/gamesWon on game completion
3. **Profile edit screen** -- Change display name
4. **Unfriend option** -- Remove friend from list
5. **"Last seen" display** -- For offline friends

**Defer entirely:**
- **Matchmaking**: Different product direction. Not for this game.
- **DMs/chat outside games**: Use WhatsApp.
- **Leaderboards**: Changes the social dynamic negatively.
- **Game history persistence**: Requires new DB model and significant work. Future milestone.

---

## Complexity Assessment

| Feature Area | Estimated Effort | Risk | Notes |
|--------------|-----------------|------|-------|
| Friend request/accept (server) | 2-3 hours | Low | CRUD on existing Friendship model. Standard socket events. |
| Friend request/accept (client) | 3-4 hours | Low | Panel UI, search input, request list. Zustand store for friends state. |
| Username search | 1 hour | Low | Prisma query with `startsWith` on username field. |
| Pending count + badge | 30 min | Low | Count query on connect, badge component. |
| Presence tracking (server) | 3-4 hours | Medium | userId-to-socket mapping, status state machine, debounced disconnect. Most complex new server feature. |
| Presence broadcast to friends | 2-3 hours | Medium | Socket.io rooms per user, friend list query on connect, room join/leave lifecycle. |
| Friends list UI with status | 2-3 hours | Low | List component with status dots, grouping by status. |
| Direct join button | 1 hour | Low | Reads roomCode from presence data, calls existing `joinRoom` action. |
| Post-game add friend | 1 hour | Low | Button in existing game-end modal, conditional on auth state. |
| Stats wiring | 1-2 hours | Low | Hook into game completion flow on server, increment Prisma UserStats. |
| Profile edit | 1 hour | Low | Form with displayName input, REST endpoint for update. |

**Total estimated effort:** 18-25 hours for full feature set (Phases 1-3).
**Critical risk:** Presence tracking at scale -- but with <100 concurrent users initially, in-memory tracking is perfectly adequate. Redis-backed presence is a future optimization, not an MVP requirement.

---

## Sources

- **Direct codebase analysis (HIGH confidence):**
  - `server/prisma/schema.prisma`: Friendship model with PENDING/ACCEPTED/REJECTED enum, unique constraint on [requesterId, targetId], relations on User
  - `server/src/socket/authMiddleware.ts`: Socket auth with guest fallback, `socket.data` typed as `SocketUserData`
  - `server/src/game/RoomManager.ts`: Room creation/join already passes userId, `getRoomInfo()` includes userId per player
  - `server/src/game/GameState.ts`: `PlayerState.userId` and `RoomPlayer.userId` optional fields exist
  - `server/src/auth/authRoutes.ts`: Full REST auth (register, login, Google OAuth, /me, logout) with JWT sessions
  - `client/src/store/authStore.ts`: AuthUser type, setAuth/logout/updateUser actions, localStorage token persistence
  - `client/src/components/lobby/MainMenu.tsx`: Auth-aware rendering, auto-fills displayName

- **Friends system database design (HIGH confidence):**
  - [User Friends System & Database Design - CoderBased](https://www.coderbased.com/p/user-friends-system-and-database) -- Single-row with status column pattern (matches our existing Prisma schema)
  - [Prisma Discussion #18380 - Friends schema](https://github.com/prisma/prisma/discussions/18380) -- Explicit join model approach for friendship metadata

- **Presence tracking patterns (MEDIUM confidence):**
  - [Socket.IO Heartbeat Discussion](https://github.com/socketio/socket.io/discussions/5214) -- Heartbeat-based presence with Redis for multi-node
  - [Handle users' online-offline status with Socket.io](https://medium.com/@ruveydayilmaz/handle-users-online-offline-status-with-socket-io-e92113c2d94a) -- userId-to-socket mapping pattern
  - [Real-Time Reliability: Heartbeats for Online Status](https://medium.com/@onakoyak/real-time-reliability-using-client-server-heartbeats-to-ensure-consistent-online-status-in-a-chat-429ae3c2d94a) -- 30s heartbeat, 60s timeout, Redis-backed for scale

- **Game social feature patterns (MEDIUM confidence):**
  - [Game Design Patterns for Building Friendships - Lostgarden](https://lostgarden.com/2017/01/27/game-design-patterns-for-building-friendships/) -- Proximity, similarity, reciprocity as friendship formation drivers
  - [Top 13 Social Features in Mobile Games - Udonis](https://www.blog.udonis.co/mobile-marketing/mobile-games/social-features-mobile-games) -- Players 2.7x more likely to keep playing when part of a community
  - [Discord Social Layer at GDC 2026](https://discord.com/blog/building-on-the-social-layer-of-games-whats-new-from-gdc-2026) -- Linked players show 25% increase in active game days

- **Invite flow UX patterns (MEDIUM confidence):**
  - [Microsoft GDK - Multiplayer Invite Flows](https://learn.microsoft.com/en-us/gaming/gdk/docs/services/multiplayer/invites/concepts/live-multiplayer-invite-flows) -- Toast notification patterns, "Launch and accept" flow
  - [Discord Managing Game Invites](https://docs.discord.com/developers/discord-social-sdk/development-guides/managing-game-invites) -- Join secret + lobby pattern for seamless friend joining

- **Status indicator UX (MEDIUM confidence):**
  - [Status Dot UI Design - Mobbin](https://mobbin.com/glossary/status-dot) -- Color choice matters for recognition; green for online is universal
  - [User Experiences with Online Status Indicators - ACM](https://dl.acm.org/doi/fullHtml/10.1145/3313831.3376240) -- Number of cues needed varies by color; green is fastest recognized
  - [Friend list design pattern - UI Patterns](https://ui-patterns.com/patterns/friend-list) -- Friends lists should be contextual and integral to content consumption

**Confidence assessment:**

| Area | Confidence | Notes |
|------|------------|-------|
| Feature requirements | HIGH | Directly from PROJECT.md milestone scope + standard game social patterns |
| Existing codebase integration | HIGH | Verified every hook point by reading actual source files |
| Friends system implementation | HIGH | Standard CRUD + Socket.io pattern, Prisma model already exists |
| Presence system design | MEDIUM | Pattern is well-known but multi-tab handling and disconnect debouncing need careful implementation |
| UX patterns (status dots, join flow) | MEDIUM | Based on multiple game platform patterns; specific mobile web game examples are sparse |
| Effort estimates | MEDIUM | Based on codebase familiarity; presence tracking may take longer than estimated |
| Anti-feature decisions | HIGH | Based on project constraints (casual game, solo dev, small user base) and explicit out-of-scope items in PROJECT.md |

# Pitfalls Research

**Domain:** User accounts, friends system, online presence, and direct join added to existing real-time Socket.io multiplayer game
**Researched:** 2026-03-25
**Milestone:** v1.3 Social & Accounts
**Confidence:** HIGH (codebase analysis + existing implementation review + verified web sources)

---

## Critical Pitfalls

Mistakes that cause broken authentication flows, data loss, security holes, or require architectural rewrites.

---

### Pitfall 1: Dual Identity Crisis -- Guest vs. Authenticated Player in Active Games

**What goes wrong:**
A player joins a room as guest (identified by display name + socket ID). Mid-game, they log in or register from another tab/device. Now the same human has two identities: one guest socket in the active game, and one authenticated socket that knows nothing about the game. The in-game reconnection logic in `RoomManager.joinRoom()` (line 49) tries to match by `userId` first, then by `name` -- but the guest socket never had a `userId`. If the authenticated socket tries to join, it creates a duplicate or gets rejected. If the guest socket disconnects and the authenticated one tries to reconnect, the match-by-name may fail if they changed their display name during registration.

**Why it happens:**
The current `authMiddleware.ts` sets `socket.data` once on connection handshake and never updates it. A socket that connected as guest stays guest for its entire lifetime even if the user logs in via the REST API. The existing code in `roomHandlers.ts` reads `getSocketUser(socket)` at event time -- but the socket data was frozen at connection time.

**How to avoid:**
1. Do NOT allow login/register to change identity of an active socket. Login is a separate action from "reconnect to game."
2. After login, the client must disconnect the socket and reconnect with the token in `socket.auth`. The existing `useAuth.ts` (line 35-38) already does this: `socket.disconnect(); socket.connect()`. Ensure this pattern is the ONLY way identity propagates.
3. Never allow linking a guest in-game session to a newly created account mid-game. The game finishes under the guest identity. Stats can be retroactively credited only if the player was authenticated when the game started.
4. Add a clear UI rule: login/register is only available from the home screen or lobby, NOT during an active game.

**Warning signs:**
- Players complaining they "lost their game" after logging in
- Duplicate player entries in room.players with same name but different socketIds
- `userId` is undefined in `PlayerState` despite user being logged in

**Phase to address:**
Phase 1 (Supabase + Auth integration) -- the socket reconnection flow after login must be rock-solid before any social features depend on user identity.

---

### Pitfall 2: Prisma Connection Pool Exhaustion from Socket.io Auth Middleware

**What goes wrong:**
Every new socket connection runs `authMiddleware.ts`, which makes TWO Prisma queries: `prisma.session.findUnique()` (line 24) and `prisma.user.findUnique()` (line 31), plus a fire-and-forget `prisma.user.update()` for `lastSeenAt` (line 48). Socket.io reconnection fires frequently -- after every network blip, tab switch, or phone lock. With 20 concurrent users each reconnecting 2-3 times per session, that's 60-100 database queries just for auth middleware. Add friend list queries, presence updates, and the actual game logic, and the default Prisma connection pool (5 connections via `@prisma/adapter-pg`) gets exhausted. Queries start timing out with "Timed out fetching a new connection from the connection pool."

**Why it happens:**
The current `prisma.ts` creates a `PrismaClient` with `@prisma/adapter-pg` using a `pg.Pool` with default settings (10 connections). But each middleware call holds a connection for the duration of the async query. Under reconnection storms (common in multiplayer -- server restart, network wobble affects all 4 players simultaneously), connections stack up. The `lastSeenAt` update is fire-and-forget but still consumes a connection.

**How to avoid:**
1. Configure the `pg.Pool` explicitly: `new pg.Pool({ connectionString, max: 20 })`. Match it to expected concurrent queries, not concurrent users.
2. Cache auth results in memory. After verifying a token once, store `{ userId, username, displayName }` in a `Map<jti, UserData>` with a TTL (e.g., 5 minutes). Skip the DB query on subsequent connections with the same token.
3. Move `lastSeenAt` updates out of the auth middleware. Batch them: update `lastSeenAt` at most once per minute per user, using an in-memory timestamp check before hitting the DB.
4. For the Supabase-hosted PostgreSQL: use the transaction mode pooler (port 6543) for application queries and the direct connection (port 5432) only for migrations. Add `pgbouncer=true` to the connection string when using Supabase's pooler to disable prepared statements.
5. Monitor with: `pool.on('error', ...)` and log pool stats periodically.

**Warning signs:**
- Intermittent "connection timeout" errors in server logs
- Login/reconnect takes 5+ seconds
- Game actions feel laggy despite low CPU/memory usage

**Phase to address:**
Phase 1 (Supabase + Auth integration) -- connection pooling config and auth caching must be set up before adding friend queries and presence tracking that multiply DB load.

---

### Pitfall 3: Friendship Race Condition -- Duplicate or Contradictory Friend Requests

**What goes wrong:**
Player A sends a friend request to Player B. Simultaneously, Player B sends a friend request to Player A. Two `Friendship` rows are created: `(A->B, PENDING)` and `(B->A, PENDING)`. Neither can be accepted because the accept logic looks for a row where the accepting user is the `targetId`, but each user is both requester and target in different rows. Or worse: A accepts B's request, creating an ACCEPTED friendship, while A's own request to B remains PENDING -- the system shows them as both friends and pending.

**Why it happens:**
The current Prisma schema has `@@unique([requesterId, targetId])` (line 59 of schema.prisma), which prevents A from sending two requests to B. But it does NOT prevent the reverse: B can also send a request to A because `(B, A)` is a different unique pair than `(A, B)`. Without a check for the reverse direction before inserting, concurrent requests create contradictory state.

**How to avoid:**
1. Before creating a friend request, ALWAYS check both directions in a single transaction:
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
2. If a reverse PENDING request exists, auto-accept it instead of creating a new one. This is the natural "mutual interest" case.
3. Add a database-level constraint or trigger that enforces `requesterId < targetId` ordering (normalize the pair), or add application-level normalization before insert.
4. Wrap the check-then-insert in a Prisma `$transaction` with isolation level to prevent TOCTOU races.

**Warning signs:**
- Users showing up as both "pending" and "friend" simultaneously
- Friend list showing duplicate entries
- "Accept" button does nothing (wrong row being updated)

**Phase to address:**
Phase 3 (Friends system) -- this must be handled in the very first implementation of friend request creation, not patched later.

---

### Pitfall 4: Presence Tracking Treats Socket = User, Breaking on Multi-Tab/Multi-Device

**What goes wrong:**
User opens the app in two browser tabs. Each tab creates a separate socket connection. The server tracks presence per socket ID. When the user closes Tab 1, the server marks them as "offline" and broadcasts this to all friends. But the user is still active in Tab 2. Friends see them flicker between online and offline every time a tab is closed, a socket reconnects, or a phone screen locks briefly.

**Why it happens:**
The naive implementation tracks `Map<socketId, userId>` for presence. When a socket disconnects, the user is considered offline. But one user can have multiple concurrent sockets. The current `RoomManager` uses `socketToRoom: Map<string, string>` (socket to room), not user to room. There is no concept of "all sockets for a given user."

**How to avoid:**
1. Track presence as `Map<userId, Set<socketId>>`. A user is online if their set is non-empty, offline only when the set becomes empty.
2. On socket connect: add socketId to user's set. On disconnect: remove socketId from set. Broadcast "offline" only when the set empties.
3. Add a grace period (3-5 seconds) before broadcasting "offline" after the last socket disconnects. This covers brief reconnections, tab switches, and phone screen locks.
4. For guests (no userId): do NOT track presence. Guests don't have friends, so presence is irrelevant for them.
5. Use Socket.io rooms as the presence channel: each authenticated user auto-joins `user:{userId}` room. Check room size > 0 for online status.

**Warning signs:**
- Friends list shows user flickering online/offline rapidly
- Closing one of two tabs marks user offline
- Phone screen lock triggers "offline" for 2 seconds then "online" again

**Phase to address:**
Phase 4 (Online presence) -- must design presence tracking correctly from the start; retrofitting multi-socket awareness is painful.

---

### Pitfall 5: JWT Token Stuck on Socket After Expiry -- Zombie Authenticated Sessions

**What goes wrong:**
User logs in, gets a 7-day JWT (as configured in `jwt.ts` line 5). The socket connects with this token in `socket.auth`. The auth middleware validates the token once at handshake. The socket stays alive for hours via ping/pong keep-alive. After 7 days (or after the user logs out from another device and the session is deleted from DB), the socket still carries the old token. The server still treats this socket as authenticated because `socket.data` was set at connection time and never re-validated.

**Why it happens:**
Socket.io auth middleware only runs once: at the initial handshake. There is no periodic re-validation. The current `authMiddleware.ts` checks the session table -- but only on connect. A deleted or expired session is never rechecked for active sockets. The `lastSeenAt` update (line 48) fires on connect, creating a false sense of recent activity.

**How to avoid:**
1. For the current scale (casual game, sessions rarely exceed 2-3 hours), this is LOW risk. The 7-day token and active keep-alive mean tokens expire much longer than sessions last.
2. If implementing logout-from-all-devices or session revocation: maintain an in-memory `Set<revokedJti>` on the server. Check it in critical socket event handlers (friend request, direct join) not just at connect time.
3. Do NOT re-validate the token on every socket event -- that would re-introduce the connection pool problem (Pitfall 2). Only validate on sensitive operations.
4. On client logout: explicitly call `socket.disconnect()` before clearing the token (current `useAuth.ts` does call `setSocketAuth(null)` but does not disconnect -- it should).

**Warning signs:**
- User logs out on phone but appears online on desktop for minutes/hours
- Revoked sessions still appear to work for existing connections
- "Ghost" authenticated actions from expired tokens

**Phase to address:**
Phase 1 (Auth integration) -- ensure logout disconnects the socket. Session revocation check can be deferred to Phase 4 (presence) since that's when "online status" matters.

---

### Pitfall 6: Direct Join Bypasses Room Privacy -- Any Friend Can Join Any Lobby

**What goes wrong:**
The "direct join" feature lets friends click "Join" to enter a friend's lobby. The implementation naively takes the friend's current `roomCode` from presence data and calls the existing `room:join` event. Problem: the room might be full (4/4 players), in a game already, or the friend might not want random friends joining mid-setup. The current `joinRoom()` in `RoomManager` already rejects full rooms and in-game rooms (lines 46, 65), but there's no concept of "this room is invite-only" or "only the host can invite people."

**Why it happens:**
The existing room system was designed around room codes as the access control mechanism -- knowing the code IS the invitation. Direct join removes that access barrier. Without additional authorization, presence data essentially leaks room codes to all friends.

**How to avoid:**
1. Direct join should only work when the friend's room is in `waiting` status AND has open seats. Grey out the "Join" button otherwise, with a tooltip explaining why.
2. The server must verify on `room:join` that the joining user is actually friends with someone in the room (check the Friendship table) IF the join was triggered via direct-join (add a `directJoin: true` flag to the event payload).
3. Consider adding a room setting: "Friends can join" toggle (default: on). The host can disable it for private games.
4. Do NOT expose the roomCode in presence data. Instead, expose a boolean `inLobby: true` and let the server handle the join server-side: `friend:join_lobby` event that takes `targetUserId`, server looks up their room, validates friendship and room availability, then joins.

**Warning signs:**
- Players joining lobbies uninvited
- Room codes visible in network traffic from presence updates
- Friends joining mid-game and getting rejected with confusing errors

**Phase to address:**
Phase 5 (Direct join) -- but the presence data structure designed in Phase 4 must NOT include raw room codes; plan the abstraction early.

---

## Technical Debt Patterns

Shortcuts that seem reasonable but create long-term problems.

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Storing presence in-memory (no Redis) | Zero new infrastructure, instant reads | Lost on server restart; won't work with multiple server instances | Acceptable now -- single Railway instance, casual scale. Add Redis only if scaling to multiple instances. |
| JWT with 7-day expiry, no refresh tokens | Simple auth flow, no refresh logic needed | Users stay authenticated for a week even after password change. No way to force re-auth short of DB session deletion. | Acceptable for casual game. Add refresh tokens only if security requirements increase. |
| `lastSeenAt` updated on every socket connect | Always-fresh presence data | Unnecessary DB writes on reconnection storms | Move to batch/throttled updates (once per minute max) before adding presence features. |
| Friend count unlimited | No artificial cap on social features | Potential for abuse (spam friend requests) or performance issues with huge friend lists | Acceptable initially. Add rate limiting on friend requests (e.g., 20 pending max) and paginate friend list queries. |
| No email verification for email/password registration | Frictionless signup | Fake emails, no password recovery possible, no way to verify account ownership | Acceptable for v1.3 MVP. Add email verification flow in a later milestone if needed. |
| Prisma `@prisma/adapter-pg` driver adapter | Direct pg pool control, Supabase compatibility | Known issues: schema parameter ignored, array handling bugs, performance degrades under concurrent transactions (GitHub issues #28611, #27823, #25811) | Acceptable -- the app uses simple queries. Watch for regressions on Prisma upgrades. |

---

## Integration Gotchas

Common mistakes when connecting to external services or integrating new systems with the existing codebase.

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| **Supabase PostgreSQL + Railway** | Using the pooler connection string (port 6543) for `prisma migrate deploy`. Migrations need DDL access that poolers don't support. | Use `DATABASE_URL` with port 6543 and `pgbouncer=true` for the app. Add `DIRECT_URL` with port 5432 (direct connection) for migrations. Configure in `schema.prisma`: `datasource db { url = env("DATABASE_URL") directUrl = env("DIRECT_URL") }` |
| **Supabase PostgreSQL + Railway** | Setting `DATABASE_URL` in Railway but forgetting `JWT_SECRET` and `GOOGLE_CLIENT_ID` env vars. Server starts, auth routes return 500s. | Checklist for Railway env vars: `DATABASE_URL`, `DIRECT_URL`, `JWT_SECRET` (MUST change from default), `GOOGLE_CLIENT_ID`, `NODE_ENV=production`. Add them all BEFORE first deploy with auth. |
| **Google OAuth + Railway** | Railway's auto-assigned URL changes on redeploy (e.g., `server-production-b2a8.up.railway.app`). Google OAuth requires exact authorized origins. After redeployment to a new URL, OAuth breaks silently. | Use a custom domain or Railway's stable URL. Add BOTH the Railway URL and any custom domain to Google Cloud Console authorized JavaScript origins. The app already has a stable Railway URL. |
| **Google OAuth consent screen** | Staying in "Testing" mode, which limits to 100 test users. When the 101st user tries to log in with Google, they get a scary "This app isn't verified" screen and can't proceed. | For external apps: submit for verification early. Only requires a privacy policy URL and basic app info for non-sensitive scopes (profile + email). Or: stay in testing mode and manually add tester emails for the initial rollout. |
| **Socket.io + Prisma in auth middleware** | Running `await prisma.user.update()` in the middleware and blocking the connection until it resolves. If the DB is slow, ALL new connections hang. | The current code (line 48) uses `.catch(() => {})` which is correct -- fire and forget. Maintain this pattern for all non-critical DB writes in socket event handlers. |
| **Express CORS + Supabase auth** | Production mode has CORS disabled (`cors: undefined` on Socket.io, no `app.use(cors())` for Express in production). But the REST auth routes (`/api/auth/*`) need CORS headers if the client ever loads from a different origin (e.g., during development with Vite proxy). | Current setup is correct for production (same-origin serving). For development: the Vite proxy already handles it. No change needed, but be aware this breaks if the client is ever served from a different domain. |
| **Prisma schema + Supabase managed schemas** | Referencing Supabase's `auth.users` table directly in Prisma schema. Prisma can't manage Supabase internal schemas and migrations will conflict. | The current approach is correct: maintain a separate `User` table in the public schema. Never reference `auth.*` tables in Prisma. The app uses its own JWT, not Supabase Auth service. |

---

## Performance Traps

Patterns that work at small scale but fail as usage grows.

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| N+1 queries in friend list: loading each friend's presence status individually | Friend list takes 2-3 seconds to load for users with 20+ friends | Load all friend UserIds in one query, then batch-fetch presence from in-memory map. Never query presence from DB. | 15+ friends per user |
| Broadcasting presence updates to ALL friends on every status change | Server CPU spikes; each status change triggers N socket emits where N = friend count | Use Socket.io rooms: each user joins `friends:{userId}` room. Emit once to the room. Socket.io handles fan-out efficiently. | 10+ concurrent users with overlapping friend graphs |
| Querying the Friendship table on every `room:join` for direct-join validation | Adds 50-100ms latency to every join attempt; hits DB for non-direct joins too | Only query Friendship table when `directJoin: true` flag is present. For room-code joins, skip the check entirely. | Any scale -- unnecessary latency |
| Storing full friend profiles in presence data sent to clients | Payload size grows linearly with friend count; repeated on every status change | Send minimal presence: `{ userId, status, roomStatus }`. Client already has friend profiles from the initial list fetch. | 20+ online friends |
| `prisma.user.update({ data: { lastSeenAt } })` on every socket connect | Under reconnection storms (4 players reconnect = 4 updates in 1 second), writes pile up | Throttle: update `lastSeenAt` at most once per 60 seconds per user. Use an in-memory `Map<userId, lastUpdateTimestamp>`. | Reconnection storms (network blips, server restart) |

---

## Security Mistakes

Domain-specific security issues beyond general web security.

| Mistake | Risk | Prevention |
|---------|------|------------|
| `JWT_SECRET` left as default `'dev-secret-change-in-production'` (jwt.ts line 4) | Anyone who reads the source code can forge valid JWTs, impersonating any user. Full account takeover. | Generate a cryptographically random secret (32+ bytes): `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`. Set as Railway env var. Add a startup check that rejects the default value in production. |
| Friend request endpoint doesn't rate-limit | Attacker sends thousands of friend requests to harass users or spam the database | Add rate limiting: max 20 pending outgoing requests per user. Max 5 requests per minute per user. Check before insert, not after. |
| Presence data leaks room codes to all friends | Any authenticated user who adds you as friend can see your room code and join uninvited | Never include `roomCode` in presence data. Expose only `inLobby: boolean` / `inGame: boolean`. The join flow should go through a server-validated event. |
| No input sanitization on display names from Google OAuth | Google returns arbitrary UTF-8 names. XSS via display name rendered in friends list or lobby player list. | Sanitize display names: strip HTML, limit length (30 chars max), validate no control characters. Apply on creation AND on every Google OAuth update. |
| Session tokens not cleaned up on expiry | The `Session` table grows indefinitely. Old sessions with expired `expiresAt` remain in the database forever. | Add a cleanup job: `prisma.session.deleteMany({ where: { expiresAt: { lt: new Date() } } })`. Run daily via a setInterval or on-deploy script. |
| Username enumeration via register endpoint | The `/register` endpoint returns "Username already taken" (authRoutes.ts line 23), revealing which usernames exist. | For a casual game app, this is LOW risk and acceptable UX. In a security-sensitive context, use a generic "registration failed" message. |

---

## UX Pitfalls

Common user experience mistakes in this domain.

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Forcing login before any gameplay | New users bounce immediately. The app's core value is "start playing in seconds." | Preserve current guest flow as default. Show login as optional enhancement: "Login to add friends and track stats." Never gate gameplay behind auth. |
| Friend search only by exact username | Users don't remember friends' usernames. They know their display name or nothing. | Search by display name (case-insensitive, partial match). Show avatar if available. Add "share your profile" link/QR for in-person friend adds. |
| No feedback during friend request send/accept | User clicks "Add Friend", nothing visible happens. They click again, get "request already sent" error. | Show immediate optimistic UI: button changes to "Requested" with a pending spinner. Toast notification on success/error. |
| Presence shows "offline" during brief disconnections | Friends think the user left. Social features feel unreliable. | Add 5-second grace period before marking offline. Show "recently online" (e.g., "5 min ago") instead of binary online/offline. |
| Direct join with no confirmation | User accidentally clicks "Join" and gets pulled into a lobby, leaving their current context. | Add a confirmation: "Join [Friend]'s lobby?" with Join/Cancel buttons. If user is already in a room, warn: "You'll leave your current room." |
| Login form blocks the entire screen | User was browsing the app, taps "Login", gets a full-screen form with no way to continue as guest. | Use a modal or slide-up sheet for login. Include a prominent "Continue as Guest" or X button. Never navigate away from the current screen for auth. |

---

## "Looks Done But Isn't" Checklist

Things that appear complete but are missing critical pieces.

- [ ] **Auth login flow:** Often missing socket reconnection after login -- verify the socket disconnects and reconnects with the new token (check `setSocketAuth` is called before `socket.connect()`)
- [ ] **Auth logout flow:** Often missing socket disconnect -- verify `socket.disconnect()` is called on logout (currently missing in `useAuth.ts` `handleLogout`)
- [ ] **Friend request creation:** Often missing reverse-direction check -- verify both `(A,B)` and `(B,A)` are checked before creating a new request
- [ ] **Friend list query:** Often missing the ACCEPTED status filter -- verify the query filters `status: 'ACCEPTED'` and includes both directions (where user is requester OR target)
- [ ] **Presence "offline" event:** Often missing multi-socket check -- verify that "offline" is only broadcast when ALL sockets for a user have disconnected, not just one tab
- [ ] **Presence grace period:** Often missing the timeout cancellation -- verify that if a user reconnects within the grace period, the pending "offline" broadcast is cancelled
- [ ] **Direct join button state:** Often missing disabled state -- verify the button is disabled/hidden when friend is in-game or lobby is full, not just returning an error after click
- [ ] **Google OAuth popup:** Often missing the popup-blocked fallback -- verify that if the browser blocks the OAuth popup, the user sees a message to allow popups, not a silent failure
- [ ] **Session cleanup:** Often missing scheduled deletion -- verify expired sessions are periodically purged from the Session table, not growing indefinitely
- [ ] **Railway env vars:** Often missing one critical variable -- verify ALL of `DATABASE_URL`, `JWT_SECRET`, `GOOGLE_CLIENT_ID` are set in Railway BEFORE deploying the auth feature

---

## Recovery Strategies

When pitfalls occur despite prevention, how to recover.

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Dual identity crisis (P1) | LOW | Force-disconnect the guest socket. User reconnects with auth token. In-game state matches by name as fallback. |
| Connection pool exhaustion (P2) | LOW | Increase `pg.Pool({ max })` value. Add auth caching. Restart server to reset pool. No data loss. |
| Duplicate friend requests (P3) | MEDIUM | Write a migration script to deduplicate: for each pair with two rows, keep the one with status ACCEPTED (or the older one), delete the other. Add the bidirectional check to prevent recurrence. |
| Multi-tab presence flicker (P4) | LOW | Add the `Map<userId, Set<socketId>>` tracking and grace period. Client-side: no data migration needed, just a server-side fix. |
| Zombie authenticated sessions (P5) | LOW | Add `socket.disconnect()` to the logout flow. For existing zombie sockets: they'll expire naturally when the JWT expires (7 days). |
| Direct join privacy leak (P6) | MEDIUM | Remove room codes from presence data (breaking change for clients consuming it). Add the server-side `friend:join_lobby` event. Update client UI. |

---

## Pitfall-to-Phase Mapping

How roadmap phases should address these pitfalls.

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| P1: Dual identity crisis | Phase 1 (Auth) | Test: login while in lobby, verify socket reconnects cleanly and player identity is preserved |
| P2: Connection pool exhaustion | Phase 1 (Auth) | Load test: simulate 20 concurrent socket connections + reconnections, verify no pool timeout errors |
| P3: Friendship race condition | Phase 3 (Friends) | Test: send simultaneous friend requests in both directions (e.g., via two API calls in quick succession), verify only one Friendship row exists |
| P4: Multi-tab presence flicker | Phase 4 (Presence) | Test: open two tabs, close one, verify friend list still shows user as online |
| P5: Zombie sessions | Phase 1 (Auth) | Test: logout from app, verify socket disconnects immediately and `socket.data` is no longer authenticated |
| P6: Direct join privacy | Phase 4 + Phase 5 | Verify: network tab shows no room codes in presence payloads; direct join goes through server-validated event |
| Rate limiting on friend requests | Phase 3 (Friends) | Test: send 25 friend requests rapidly, verify the 21st is rejected |
| JWT_SECRET default check | Phase 1 (Auth) | Deploy to Railway without `JWT_SECRET`, verify server refuses to start or logs a critical warning |
| Session table cleanup | Phase 1 (Auth) | After 8+ days, verify expired sessions are deleted from the Session table |
| Display name sanitization | Phase 2 (Profiles) | Test: register with Google account whose name contains `<script>`, verify it's sanitized in DB and rendered safely |

---

## Sources

- Codebase analysis: `authMiddleware.ts` (frozen socket.data, two DB queries per connect), `RoomManager.ts` (userId-first reconnection, socketToRoom map), `jwt.ts` (7-day expiry, hardcoded dev secret), `prisma.ts` (`@prisma/adapter-pg` with default pool), `schema.prisma` (Friendship @@unique only one direction), `useAuth.ts` (socket reconnect on login, missing disconnect on logout), `authRoutes.ts` (Google OAuth account linking), `config.ts` (env var defaults)
- [Socket.io JWT integration guide](https://socket.io/how-to/use-with-jwt) -- middleware only runs on handshake, no token refresh guidance
- [Socket.io presence tracking patterns](https://medium.com/@ruveydayilmaz/handle-users-online-offline-status-with-socket-io-e92113c07eac) -- multi-tab/multi-device complications
- [Socket.io multi-tab user management](https://medium.com/@lalrishav.14/prerequisite-basic-knowledge-of-node-express-passport-and-socket-io-f4b0c3c4be4b) -- session-based identification across tabs
- [Socket.io reconnection and state recovery](https://socket.io/docs/v4/connection-state-recovery) -- socket ID regeneration, room membership loss on reconnect
- [Prisma connection pool documentation](https://www.prisma.io/docs/orm/prisma-client/setup-and-configuration/databases-connections/connection-pool) -- pool size configuration, timeout handling
- [Prisma + Supabase troubleshooting](https://supabase.com/docs/guides/database/prisma/prisma-troubleshooting) -- pooler vs direct connection for migrations, prepared statement errors
- [Prisma @prisma/adapter-pg known issues](https://github.com/prisma/prisma/issues/27506) -- peer dependency, schema parameter ignored, performance under concurrency
- [Database race conditions catalogue](https://www.ketanbhatt.com/p/db-concurrency-defects) -- account uniqueness bypasses, concurrent insert patterns
- [Supabase RLS common mistakes](https://designrevision.com/blog/supabase-row-level-security) -- not relevant to this project since we use Prisma directly, not Supabase client SDK, but good awareness
- [Google OAuth consent screen verification](https://support.google.com/cloud/answer/7454865?hl=en) -- testing mode 100-user limit, verification requirements
- [Railway deployment + Supabase config](https://station.railway.com/questions/how-do-i-configure-the-database-url-in-s-68283f2a) -- DATABASE_URL format for Railway

---

*Pitfalls analysis: 2026-03-25 -- v1.3 Social & Accounts milestone*

# Stack Research: v1.3 Social & Accounts

**Domain:** Real-time multiplayer game -- user accounts, social features, presence
**Researched:** 2026-03-25
**Confidence:** HIGH

---

## Executive Verdict

**The auth/database foundation is already built. No new server dependencies needed. One client dependency to add: `@react-oauth/google`.**

The codebase already contains a fully functional custom auth stack: Prisma 7.5 + PostgreSQL + JWT + bcryptjs + google-auth-library + Socket.io auth middleware. The schema already includes User, Session, UserStats, and Friendship models. REST routes for register, login, Google OAuth, /me, and logout are implemented. The client has authStore (Zustand), useAuth hook, AuthPage, LoginForm, RegisterForm, and GoogleLoginButton (placeholder).

What remains to build is NOT stack selection -- it's feature implementation:
1. Wire up `@react-oauth/google` for the client-side Google Sign-In button (currently a placeholder)
2. Build friends REST API routes (request/accept/reject/list) using existing Prisma Friendship model
3. Build presence tracking via Socket.io (server-side Map of userId to socketId/roomCode)
4. Build direct-join feature (lookup friend's room, call existing room:join)

---

## Current Stack (Already Installed & Integrated)

### Server -- Auth & Database

| Technology | Version | Purpose | Status |
|------------|---------|---------|--------|
| Prisma Client | 7.5.0 | Type-safe PostgreSQL ORM | Installed, schema migrated, singleton in `db/prisma.ts` |
| Prisma CLI | 7.5.0 | Schema management & migrations | Installed, init migration applied |
| @prisma/adapter-pg | 7.5.0 | PostgreSQL driver adapter for Prisma | Installed, configured with pg pool |
| pg | 8.20.0 | PostgreSQL connection pool | Installed, used by Prisma adapter |
| jsonwebtoken | 9.0.3 | JWT signing & verification (7-day expiry) | Installed, `auth/jwt.ts` with sign/verify |
| bcryptjs | 3.0.3 | Password hashing (10 salt rounds) | Installed, `auth/passwordUtils.ts` |
| google-auth-library | 10.6.2 | Server-side Google ID token verification | Installed, `auth/google.ts` with verifyGoogleToken |
| dotenv | 16.3.1 | Environment variable loading | Installed, loaded in `config.ts` |

### Server -- Existing (Unchanged)

| Technology | Version | Role in v1.3 |
|------------|---------|--------------|
| Express | 4.18.2 | REST routes for auth + friends API |
| Socket.io | 4.8.3 (installed, ^4.7.2 in package.json) | Real-time presence + friend status events |
| cors | 2.8.5 | Dev-mode CORS (prod same-origin) |

### Client -- Auth UI (Already Built)

| Component | Purpose | Status |
|-----------|---------|--------|
| `store/authStore.ts` | Zustand store: user, token, isAuthenticated, loading | Complete |
| `hooks/useAuth.ts` | Register, login, loginWithGoogle, logout, auto-login from localStorage | Complete |
| `pages/AuthPage.tsx` | Auth page with login/register toggle + Google + guest option | Complete |
| `components/auth/LoginForm.tsx` | Username/password login form | Complete |
| `components/auth/RegisterForm.tsx` | Registration form | Complete |
| `components/auth/GoogleLoginButton.tsx` | Google sign-in button (placeholder -- needs GIS integration) | Placeholder |
| `socket.ts` | `setSocketAuth(token)` function for Socket.io auth handshake | Complete |
| `socket/authMiddleware.ts` | Server middleware: JWT validation, guest fallback, lastSeenAt update | Complete |

### Database Schema (Already Migrated)

| Model | Fields | Status |
|-------|--------|--------|
| User | id, username, displayName, email, passwordHash, googleId, avatarUrl, createdAt, lastSeenAt | Migrated |
| Session | id, userId, token, expiresAt, createdAt | Migrated |
| UserStats | id, userId, gamesPlayed, gamesWon | Migrated |
| Friendship | id, requesterId, targetId, status (PENDING/ACCEPTED/REJECTED), createdAt, updatedAt | Migrated |

---

## New Dependency: @react-oauth/google

**The only new package to install.**

| Library | Version | Purpose | Why |
|---------|---------|---------|-----|
| @react-oauth/google | 0.13.4 | Google Identity Services React wrapper | Provides `GoogleOAuthProvider` + `GoogleLogin` component that handles the entire Google Sign-In flow, returns `credentialResponse.credential` (ID token) for server verification |

### Why @react-oauth/google

- The existing `GoogleLoginButton.tsx` is a placeholder with a TODO comment: "Integrate Google Identity Services when GOOGLE_CLIENT_ID is configured"
- The server-side `verifyGoogleToken()` in `auth/google.ts` already expects a Google ID token -- `@react-oauth/google` provides exactly that
- Wrapping the app with `<GoogleOAuthProvider clientId={...}>` and using `<GoogleLogin onSuccess={...}>` replaces the manual GIS script loading and `google.accounts.id.renderButton()` boilerplate
- 582K+ weekly npm downloads, actively maintained, compatible with React >= 16.8 (project uses React 18)
- Alternative: manually load `https://accounts.google.com/gsi/client` script and call GIS APIs -- works but more boilerplate for no benefit

### Integration Pattern

```tsx
// In App.tsx or a provider wrapper:
import { GoogleOAuthProvider } from '@react-oauth/google'

<GoogleOAuthProvider clientId={import.meta.env.VITE_GOOGLE_CLIENT_ID}>
  <BrowserRouter>
    <AppRoutes />
  </BrowserRouter>
</GoogleOAuthProvider>

// In GoogleLoginButton.tsx:
import { GoogleLogin } from '@react-oauth/google'

<GoogleLogin
  onSuccess={(credentialResponse) => {
    onGoogleLogin(credentialResponse.credential!) // This is the ID token
  }}
  onError={() => console.error('Google login failed')}
  theme="filled_black"
  shape="pill"
  size="large"
/>
```

The `credential` returned by GoogleLogin is the same ID token that `auth/google.ts` verifies server-side. No additional server changes needed.

---

## No New Server Dependencies Needed

The friends system, presence tracking, and direct join features use only what's already installed:

### Friends REST API

Uses: Express (router), Prisma (Friendship model), jsonwebtoken (auth verification)

```
POST   /api/friends/request    -- Send friend request (by username)
POST   /api/friends/accept     -- Accept friend request
POST   /api/friends/reject     -- Reject friend request
DELETE /api/friends/:friendshipId -- Remove friend / cancel request
GET    /api/friends             -- List accepted friends (with presence)
GET    /api/friends/pending     -- List pending incoming requests
```

All queries use existing Prisma Friendship model with its PENDING/ACCEPTED/REJECTED enum. No schema changes needed.

### Presence Tracking

Uses: Socket.io (already has auth middleware identifying users on connection)

Pattern: Server-side in-memory Map tracking userId -> { socketId, roomCode, status }.

```typescript
// In-memory presence (NOT in database -- ephemeral by nature)
const presenceMap = new Map<string, {
  socketId: string
  roomCode: string | null
  status: 'online' | 'in_lobby' | 'in_game'
}>()
```

- On authenticated socket connection: add to presenceMap
- On disconnect: remove from presenceMap
- On room:create / room:join: update roomCode and status
- On game:start: update status to 'in_game'
- On room:leave / disconnect: clear roomCode

Friends query enriched: when fetching friend list via REST, join presence data from in-memory map to return each friend's online status and room code (if any).

Alternatively, presence queries can flow through Socket.io events to avoid REST polling:
- `friends:presence` -- server pushes presence updates to a user's friend subscribers
- Uses Socket.io rooms: each authenticated user joins a `user:{userId}` room for targeted presence broadcasts

### Direct Join

Uses: Socket.io (existing room:join event), Prisma (verify friendship), RoomManager (existing joinRoom method)

Pattern: Client requests to join friend's room. Server verifies friendship, looks up friend's roomCode from presenceMap, emits existing room:join flow.

```
Socket event: friends:join_lobby { friendUserId: string }
Server:
  1. Verify caller is authenticated
  2. Verify friendship exists (Prisma query)
  3. Look up friend's roomCode from presenceMap
  4. If room exists and has space, execute same logic as room:join
```

---

## Installation

```bash
# Client -- single new dependency
cd client && npm install @react-oauth/google@0.13.4

# Server -- nothing new needed
# All auth/db deps already installed:
# prisma, @prisma/client, @prisma/adapter-pg, pg,
# jsonwebtoken, bcryptjs, google-auth-library, dotenv
```

### Environment Variables (Railway + Local)

```bash
# Already in server config.ts:
JWT_SECRET=<production-secret>
GOOGLE_CLIENT_ID=<from-google-cloud-console>
DATABASE_URL=<railway-postgresql-url>

# New client env (for @react-oauth/google):
VITE_GOOGLE_CLIENT_ID=<same-google-client-id>

# Already functional:
# VITE_API_URL (empty for same-origin in production)
```

---

## Alternatives Considered

| Recommended | Alternative | Why Not |
|-------------|-------------|---------|
| Custom JWT auth (already built) | Supabase Auth client SDK | PROJECT.md says "Supabase" but codebase already implemented custom auth with Prisma + JWT. Ripping it out to use @supabase/supabase-js would be a rewrite of working code. Keep what's built. |
| Custom JWT auth (already built) | NextAuth.js / Auth.js | The project is Express + Vite, not Next.js. Auth.js framework adapters don't fit this architecture. |
| Custom JWT auth (already built) | Firebase Auth | Adds Google Cloud vendor lock-in and a new SDK for something already working. |
| @react-oauth/google | Manual GIS script loading | @react-oauth/google handles script loading, provider context, and component lifecycle. Manual approach is more code for the same result. |
| @react-oauth/google | react-google-login | Deprecated -- uses old Google Sign-In platform library, not Google Identity Services. |
| In-memory presence Map | Redis | Single-server deployment on Railway. Redis adds a second service ($), complexity, and is unnecessary until horizontal scaling. If Railway adds a second instance later, migrate to Redis then. |
| In-memory presence Map | Supabase Realtime Presence | Would require @supabase/supabase-js client, Supabase project setup, and a second real-time channel alongside Socket.io. The app already has Socket.io for real-time -- use it. |
| REST API for friends | GraphQL | Overkill for 6 CRUD endpoints. Express REST routes match the existing auth API pattern. |
| Prisma Friendship model (existing) | Separate friends microservice | Solo developer, single server. The Friendship model is already in the schema. |

---

## What NOT to Add

| Do Not Add | Reason |
|------------|--------|
| `@supabase/supabase-js` | The codebase already has custom auth with Prisma + JWT + Google Auth Library. Adding Supabase client would create a dual-auth system. The PROJECT.md mentions Supabase but the implementation went custom -- honor the implementation. |
| `@supabase/realtime-js` | Socket.io already handles all real-time needs. A second real-time system adds complexity and latency. |
| `redis` / `ioredis` | Single Railway instance. In-memory Map is sufficient and simpler. Add Redis only if/when you scale to multiple server instances. |
| `passport` / `passport-google-oauth20` | Passport adds middleware abstraction over what's already cleanly implemented in 4 files. The auth code is working -- don't abstract it. |
| `express-session` | Sessions are JWT-based with Prisma Session model. Express session middleware with cookies would conflict. |
| `socket.io-redis` / `@socket.io/redis-adapter` | Single server deployment. The Redis adapter is only needed for multi-server Socket.io. |
| `react-google-login` | Deprecated. Uses old Google Sign-In library, not Google Identity Services. |
| `firebase` / `firebase-admin` | Unnecessary vendor lock-in when custom auth is already working. |
| `pusher` / `ably` | Third-party real-time services redundant with Socket.io. |

---

## Version Compatibility

| Package | Compatible With | Notes |
|---------|-----------------|-------|
| @react-oauth/google@0.13.4 | React >= 16.8 | Project uses React 18.2 -- fully compatible |
| @react-oauth/google@0.13.4 | google-auth-library@10.6.2 (server) | Client sends ID token, server verifies -- no version coupling |
| Prisma@7.5.0 | pg@8.20.0 via @prisma/adapter-pg | Already configured and working in `db/prisma.ts` |
| Socket.io@4.8.3 (server) | socket.io-client@4.7.2 (client) | Socket.io maintains backward compatibility within major version 4.x |
| jsonwebtoken@9.0.3 | Node.js 20+ | No known issues |

---

## Architectural Note: Supabase vs Custom Stack

The PROJECT.md states "Supabase integration (PostgreSQL + Auth)" as a target feature. However, the actual implementation on the `feature/social-v2` branch has gone with:

- **Prisma ORM** instead of Supabase client SDK
- **Custom JWT** instead of Supabase Auth
- **google-auth-library** instead of Supabase Google OAuth provider
- **Direct PostgreSQL** (via pg pool + Prisma adapter) instead of Supabase's PostgREST

This is a reasonable decision for a monorepo with an Express server that's sole authority. Using Supabase Auth would mean:
1. Auth lives in Supabase's hosted service, not your server
2. JWT verification hits Supabase's JWKS endpoint
3. Database queries through Supabase client bypass your Express server
4. Two sources of truth for "who is this user"

The custom stack keeps everything in one place. The tradeoff is implementing things Supabase provides for free (email verification, password reset, social providers beyond Google) -- but those are out of scope for v1.3.

**Recommendation:** Update PROJECT.md to reflect the actual implementation ("PostgreSQL + Prisma + custom JWT auth") instead of "Supabase". This avoids confusion in future milestones.

---

## What Still Needs to Be Built (Feature Work, Not Stack)

| Feature | Existing Foundation | What to Build |
|---------|---------------------|---------------|
| Google OAuth (client) | GoogleLoginButton.tsx placeholder, server verifyGoogleToken() | Wire @react-oauth/google into GoogleLoginButton, pass credential to loginWithGoogle() |
| Friends API | Prisma Friendship model, User relations | Express REST routes for request/accept/reject/list + Socket.io events for real-time notifications |
| Presence tracking | Socket.io auth middleware (identifies users), RoomManager (tracks rooms) | Server-side presenceMap, Socket.io events for status broadcast to friends |
| Direct join | room:join Socket.io event, RoomManager.joinRoom() | New Socket.io event that resolves friendUserId -> roomCode via presenceMap, then delegates to existing join logic |
| Friend search | Prisma User model with username index | REST endpoint to search users by username prefix |

---

## Confidence Assessment

| Claim | Confidence | Basis |
|-------|------------|-------|
| Existing auth stack is complete and functional | HIGH | Verified by reading every auth file in the codebase |
| @react-oauth/google@0.13.4 is current and compatible | HIGH | Verified via `npm view`, peer deps checked |
| No new server dependencies needed | HIGH | All required packages already in server/package.json and installed |
| In-memory presence Map sufficient for single server | HIGH | App runs on single Railway instance; Redis premature |
| Prisma Friendship model covers friends feature | HIGH | Schema verified: PENDING/ACCEPTED/REJECTED enum, unique constraint on requester+target |
| Socket.io presence via connection/disconnect events | HIGH | Standard pattern; auth middleware already identifies users |
| Google Identity Services is current Google auth approach | HIGH | Verified via official Google developer docs |

---

## Sources

- **Codebase:** `server/prisma/schema.prisma` -- verified User, Session, UserStats, Friendship models
- **Codebase:** `server/src/auth/` -- 4 files implementing complete auth flow (routes, JWT, Google, password)
- **Codebase:** `server/src/socket/authMiddleware.ts` -- Socket.io auth with JWT validation and guest fallback
- **Codebase:** `server/src/db/prisma.ts` -- Prisma client with pg adapter
- **Codebase:** `client/src/store/authStore.ts`, `hooks/useAuth.ts` -- complete client auth state management
- **Codebase:** `client/src/components/auth/` -- LoginForm, RegisterForm, GoogleLoginButton (placeholder)
- **Codebase:** `server/src/game/RoomManager.ts` -- userId already threaded through room/player tracking
- **npm registry:** `npm view @react-oauth/google` -- version 0.13.4, peerDeps react>=16.8
- **npm registry:** installed package versions verified via node require()
- **Google Developers:** [GIS Integration Guide](https://developers.google.com/identity/gsi/web/guides/integrate) -- confirms ID token flow
- **npm:** [@react-oauth/google](https://www.npmjs.com/package/@react-oauth/google) -- 582K weekly downloads

---
*Stack research for: Dominos PR v1.3 Social & Accounts*
*Researched: 2026-03-25*

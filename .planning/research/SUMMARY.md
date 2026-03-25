# Research Summary: v1.3 Social & Accounts

**Synthesized:** 2026-03-25
**Sources:** STACK.md, FEATURES.md, ARCHITECTURE.md, PITFALLS.md
**Confidence:** HIGH

---

## Critical Discovery

**Auth and database are already built on `feature/social-v2`.** The codebase has a complete custom stack — NOT Supabase:
- **Prisma 7.5 + PostgreSQL** with User, Session, UserStats, Friendship models
- **JWT auth** with bcryptjs + google-auth-library
- **REST routes** for register, login, Google OAuth, /me, logout
- **Socket.io auth middleware** that identifies authenticated vs guest users
- **Client scaffolding**: authStore (Zustand), useAuth hook, AuthPage, LoginForm, RegisterForm, GoogleLoginButton (placeholder)

**What remains to build:** Friends CRUD, presence tracking, direct join, and all client UI for social features.

## Stack Additions

| Dependency | Side | Purpose |
|------------|------|---------|
| `@react-oauth/google@0.13.4` | Client | Google Sign-In button (currently placeholder) |
| None | Server | All server deps already installed |

**No Supabase needed.** The custom stack is the right call for a monorepo where Express is sole authority.

## Feature Table Stakes

1. **Friend request/accept/reject** — Prisma Friendship model exists, need REST endpoints + socket events
2. **Friends list with online status** — Need socialStore on client, friends panel UI
3. **Search by username** — REST endpoint to find users
4. **Presence tracking** — Server-side Map<userId, Set<socketId>> with status (online/in_lobby/in_game/offline)
5. **Direct join** — "Join" button on friend in lobby, uses existing room:join
6. **Post-game "Add Friend"** — Highest-value differentiator (shared experience moment)

## Architecture Summary

- **PresenceManager**: New class following RoomManager pattern — plain Map, in-memory, single server
- **Per-user Socket.io rooms**: `socket.join('user:' + userId)` for targeted friend notifications
- **socialHandlers.ts**: New socket handler file for friend CRUD + presence events
- **friendRoutes.ts**: REST endpoints for friend request/accept/reject/list/search
- **socialStore.ts**: New Zustand store for friends list, presence, requests

## Top Pitfalls

| # | Pitfall | Prevention | Phase |
|---|---------|------------|-------|
| P1 | Dual Identity: guest socket frozen at connect | After login, disconnect + reconnect with token. No mid-game login. | 1 |
| P2 | Connection Pool Exhaustion | Cache auth results, throttle lastSeenAt writes | 1 |
| P3 | Bidirectional Friend Request Race | Check BOTH directions before insert | 2 |
| P4 | Multi-Tab Presence Flicker | Map<userId, Set<socketId>> + 3-5s grace period | 3 |
| P5 | Direct Join Privacy | Don't expose room codes in presence data; server-validated join | 4 |

## Recommended Build Order

1. **Google OAuth wiring** — Complete the auth flow (placeholder exists)
2. **Friends REST API + Socket Events** — CRUD on existing Prisma model + real-time notifications
3. **Presence System** — PresenceManager + socket room-per-user pattern
4. **Client UI** — socialStore, friends panel, search, direct join button
5. **Polish** — Post-game add friend, profile improvements

## PROJECT.md Update Required

Replace "Supabase" references with actual stack: **Prisma + PostgreSQL + custom JWT auth**. The Supabase decision was made before discovering the existing implementation.

---
*Synthesized from 4 parallel research agents — 2026-03-25*

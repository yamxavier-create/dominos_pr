---
phase: 18-presence
verified: 2026-04-03T15:10:00Z
status: passed
score: 11/11 must-haves verified
re_verification: false
---

# Phase 18: Presence — Verification Report

**Phase Goal:** Logged-in users can see what their friends are doing in real-time — online, in a lobby, in a game, or offline — with correct multi-tab behavior
**Verified:** 2026-04-03T15:10:00Z
**Status:** PASSED
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | PresenceManager tracks all authenticated sockets per userId via Map<string, Set<string>> | VERIFIED | `PresenceManager.ts` lines 10-11: `private connections = new Map<string, Set<string>>()` |
| 2 | Grace period of 5 seconds prevents flicker on last-socket disconnect | VERIFIED | `PresenceManager.ts` lines 50-56: `setTimeout(..., 5000)` only fires when `sockets.size === 0` |
| 3 | Status correctly derived from socket set + RoomManager state (online/in_lobby/in_game/offline) | VERIFIED | `getStatus()` lines 61-74: checks connections, then `getRoomCodeByUserId` + `room.status` |
| 4 | Status changes broadcast to all online friends via user:{friendId} rooms | VERIFIED | `broadcastStatusToFriends()` lines 91-121: emits `presence:friend_status_changed` to each `user:${friendId}` room |
| 5 | GET /api/social/friends returns status field for each friend | VERIFIED | `socialRoutes.ts` line 121: `const status = presenceRef?.getStatus(friend.id) ?? 'offline'`; included in response |
| 6 | Guest sockets never enter presence system | VERIFIED | `index.ts` lines 64-67: `if (userData.user)` guard wraps both `addSocket` and `removeSocket` calls |
| 7 | Friends list shows a colored status dot next to each friend's avatar | VERIFIED | `FriendsList.tsx` lines 16-21: `statusConfig` with `bg-green-500/bg-blue-500/bg-yellow-500/bg-gray-500`; dot rendered lines 79-81 |
| 8 | Status dot updates in real-time when a friend's presence changes | VERIFIED | `useSocket.ts` lines 248-250: `presence:friend_status_changed` calls `updateFriendStatus()`, which mutates store and triggers React re-render |
| 9 | Toast notification appears when a friend comes online | VERIFIED | `useSocket.ts` lines 252-259: `presence:friend_online` calls `addPresenceNotification`; `PresenceToast.tsx` renders and auto-dismisses at 4000ms |
| 10 | Toast notification appears when a friend enters a lobby | VERIFIED | `useSocket.ts` lines 261-269: `presence:friend_in_lobby` calls `addPresenceNotification` with type `'in_lobby'`; text "entro a una sala" in PresenceToast |
| 11 | Friends list sorts online friends above offline friends | VERIFIED | `FriendsList.tsx` lines 23-26: `sortedFriends` sorts by order `{in_lobby:0, in_game:1, online:2, offline:3}` |

**Score:** 11/11 truths verified

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `server/src/presence/PresenceManager.ts` | Presence tracking singleton class | VERIFIED | 139 lines; exports `PresenceManager` class and `PresenceStatus` type; full implementation |
| `server/src/social/socialRoutes.ts` | Extended GET /friends with status field | VERIFIED | `presenceRef?.getStatus(friend.id)` at line 121; `setPresenceManager` export at line 14 |
| `server/src/index.ts` | PresenceManager instantiation and socket connect/disconnect hooks | VERIFIED | `new PresenceManager(io, rooms)` line 44; `addSocket` line 66; `removeSocket` line 76 |
| `server/src/socket/handlers.ts` | Passes presence to room/game handlers | VERIFIED | Signature includes `presence: PresenceManager`; passed to `registerRoomHandlers` and `registerGameHandlers` |
| `server/src/socket/roomHandlers.ts` | Presence notifications on room create/join/leave | VERIFIED | `presence.notifyStatusChange(userId)` after `room:create` (line 24), `room:join` (line 59), `room:leave` (line 121) |
| `server/src/socket/gameHandlers.ts` | Presence notifications on game:start | VERIFIED | `for (const rp of room.players) { if (rp.userId) presence.notifyStatusChange(rp.userId) }` lines 337-339 |
| `client/src/store/socialStore.ts` | Friend interface with status field and updateFriendStatus action | VERIFIED | `status: PresenceStatus` in Friend interface (line 11); `updateFriendStatus` action (lines 106-110) |
| `client/src/hooks/useSocket.ts` | Presence event listeners for 3 events + cleanup | VERIFIED | Listeners for `presence:friend_status_changed`, `presence:friend_online`, `presence:friend_in_lobby` (lines 248-270); all three `socket.off` calls in cleanup (lines 306-308) |
| `client/src/components/social/FriendsList.tsx` | Status badge dots and sorted friend list | VERIFIED | `statusConfig` object, `sortedFriends`, relative avatar wrapper with absolute status dot span |
| `client/src/components/social/PresenceToast.tsx` | Toast notification component for presence events | VERIFIED | New file, 36 lines; renders `presenceNotifications`, auto-dismisses via `useEffect` + `setTimeout(4000)`, max 3 visible |
| `client/src/App.tsx` | Renders PresenceToast globally | VERIFIED | `import { PresenceToast }` at line 10; `<PresenceToast />` at line 20 as sibling to `<GameInviteToast />` |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `server/src/index.ts` | `PresenceManager.ts` | `new PresenceManager(io, rooms)` | WIRED | Line 44 constructs; `setPresenceManager(presence)` wires to REST routes |
| `PresenceManager.ts` | `RoomManager.ts` | `this.rooms.getRoomCodeByUserId` | WIRED | Line 65 in `getStatus()`; both `getRoomCodeByUserId` and `getRoom` verified present in RoomManager |
| `server/src/social/socialRoutes.ts` | `PresenceManager.ts` | `presenceRef?.getStatus(friend.id)` | WIRED | Line 121; `setPresenceManager` exports wired in index.ts |
| `server/src/socket/roomHandlers.ts` | `PresenceManager.ts` | `presence.notifyStatusChange` | WIRED | 3 call sites: after room:create, room:join, room:leave |
| `client/src/hooks/useSocket.ts` | `client/src/store/socialStore.ts` | `updateFriendStatus()` | WIRED | Line 249 calls `useSocialStore.getState().updateFriendStatus(data.userId, data.status)` |
| `client/src/hooks/useSocket.ts` | `client/src/store/socialStore.ts` | `addPresenceNotification()` | WIRED | Lines 253 and 263 call `useSocialStore.getState().addPresenceNotification(...)` |
| `client/src/components/social/FriendsList.tsx` | `client/src/store/socialStore.ts` | `friend.status` for badge rendering | WIRED | `statusConfig[friend.status ?? 'offline']` at line 80; conditional color class at lines 85-90 |
| `client/src/App.tsx` | `PresenceToast.tsx` | `<PresenceToast />` rendered | WIRED | Imported at line 10; rendered at line 20 |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| PRES-01 | 18-01, 18-02 | User can see if a friend is online, in a lobby, in a game, or offline | SATISFIED | FriendsList renders colored status dot and label for all 4 states; GET /friends returns `status` field from PresenceManager |
| PRES-02 | 18-02 | User receives real-time notification when a friend comes online or enters a lobby | SATISFIED | PresenceToast renders auto-dismissing notifications driven by `presence:friend_online` and `presence:friend_in_lobby` socket events |
| PRES-03 | 18-01, 18-02 | Presence handles multi-tab correctly (offline only when ALL tabs close) | SATISFIED | `PresenceManager.connections` is a `Map<userId, Set<socketId>>`; `removeSocket` only starts the 5s grace timer when `sockets.size === 0`; `addSocket` clears any pending grace timer on reconnect |

All 3 requirements verified. No orphaned requirements found in REQUIREMENTS.md for Phase 18.

---

### Anti-Patterns Found

No anti-patterns detected across all 11 phase-modified files. The single `return null` in `PresenceToast.tsx` is correct conditional rendering.

---

### Human Verification Required

#### 1. Multi-tab Offline Grace Period

**Test:** Log in as User A in two browser tabs. Close one tab. Within 5 seconds, check what User B (a friend) sees in their FriendsList.
**Expected:** User A remains shown as online/in_lobby/in_game during the grace window. After 5 seconds, status changes to "Desconectado" with gray dot.
**Why human:** Timer-based behavior cannot be verified programmatically from static code analysis.

#### 2. Toast Visibility During Active Gameplay

**Test:** While in an active game as User B, have User A (a friend) come online.
**Expected:** PresenceToast appears at `top-4 right-4` without obscuring game UI. Z-index 50 should render above game board but not block critical controls.
**Why human:** Spatial layout and visual overlap require manual inspection.

#### 3. Status Dot Color Correctness

**Test:** Observe a friend in each of the 4 states (offline, online, in_lobby, in_game).
**Expected:** Gray dot for offline, green for online, blue for in_lobby, yellow for in_game. Status label text matches.
**Why human:** Visual rendering verification requires a browser.

---

### Gaps Summary

No gaps. All 11 observable truths verified across both plans. Server-side PresenceManager is a complete, substantive implementation (139 lines) with proper multi-tab tracking, grace period, status derivation from RoomManager, and friend broadcast. Client-side wiring is complete: socket listeners call into Zustand store, FriendsList reads `friend.status` and renders colored dots with sorted ordering, PresenceToast renders from notification queue. TypeScript compilation passes with zero errors on both server and client.

---

_Verified: 2026-04-03T15:10:00Z_
_Verifier: Claude (gsd-verifier)_

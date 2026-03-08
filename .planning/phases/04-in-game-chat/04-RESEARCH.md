# Phase 4: In-Game Chat - Research

**Researched:** 2026-03-08
**Domain:** Socket.io real-time chat, Zustand state, XSS sanitization
**Confidence:** HIGH

## Summary

This phase adds text chat and quick reactions to an existing Socket.io + Zustand app. The codebase already has every pattern needed: socket event emission/handling, Zustand stores, overlay panels (score history), badge counters, and reconnection logic. No new libraries are required.

The server stores a rolling buffer of 50 messages per room (in-memory on the `Room` object), broadcasts to the Socket.io room, enforces rate limiting via a per-player timestamp array, and sanitizes text by stripping HTML tags. The client adds chat state to `uiStore`, a `ChatPanel` component, and a `ChatButton` with unread badge.

**Primary recommendation:** Follow the exact patterns from Phase 2 (score history panel) and Phase 3 (rematch handlers). No new dependencies needed -- use built-in string replacement for sanitization since the app already uses React (which auto-escapes JSX).

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| CHAT-01 | Free text messages up to 200 chars | Server truncates/validates length, client enforces maxLength on input |
| CHAT-02 | Real-time broadcast to all players | `io.to(roomCode).emit('chat:message', msg)` -- same pattern as `broadcastState` |
| CHAT-03 | Quick reactions with single tap | Client emits same `chat:message` event with `type: 'reaction'`, server validates against allowlist |
| CHAT-04 | Unread badge when panel closed | `uiStore` tracks `unreadCount`, incremented on incoming message when `chatOpen === false` |
| CHAT-05 | Reconnect receives last 50 messages | `Room.chatHistory: ChatMessage[]` buffer, sent on `room:rejoin` response |
| CHAT-06 | Rate limiting 5 msgs / 10 sec | Server-side per-player sliding window: array of last 5 timestamps, reject if oldest < 10s ago |
| CHAT-07 | Server-side XSS sanitization | Strip HTML tags with regex replace before broadcast; React auto-escapes on render |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| socket.io | (existing) | Real-time message transport | Already used for all game events |
| zustand | (existing) | Client chat state | Already used for game/ui/room stores |
| React | (existing) | Chat UI components | Already the UI framework |
| Tailwind | (existing) | Chat panel styling | Already used everywhere |

### Supporting
No new libraries needed.

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Regex HTML strip | DOMPurify | Overkill -- private rooms, no rich text, React escapes output |
| In-memory buffer | Redis/DB | Out of scope per REQUIREMENTS.md -- in-memory is sufficient |

## Architecture Patterns

### Recommended Project Structure
```
server/src/socket/chatHandlers.ts    # New: registerChatHandlers()
server/src/game/GameState.ts         # Add: ChatMessage interface, chatHistory to Room
client/src/store/uiStore.ts          # Add: chat state (messages, unreadCount, chatOpen)
client/src/components/chat/ChatPanel.tsx    # New: message list + input
client/src/components/chat/ChatButton.tsx   # New: toggle button + unread badge
client/src/components/chat/ReactionPicker.tsx # New: quick reaction buttons
client/src/hooks/useSocket.ts        # Add: chat:message, chat:history listeners
```

### Pattern 1: Socket Handler Registration
**What:** Same pattern as `roomHandlers.ts` and `gameHandlers.ts`
**When to use:** Always for new socket event domains
**Example:**
```typescript
// server/src/socket/chatHandlers.ts
export function registerChatHandlers(socket: Socket, io: Server, rooms: RoomManager): void {
  socket.on('chat:send', ({ message, type }) => {
    // validate, sanitize, rate-limit, broadcast
  })
}

// server/src/socket/handlers.ts -- add registration
import { registerChatHandlers } from './chatHandlers'
registerChatHandlers(socket, io, rooms)
```

### Pattern 2: Chat Message Type
**What:** Shared interface for text and reaction messages
```typescript
interface ChatMessage {
  id: string              // crypto.randomUUID() on server
  playerIndex: number
  playerName: string
  content: string
  type: 'text' | 'reaction'
  timestamp: number       // Date.now()
}
```

### Pattern 3: Rate Limiting (Sliding Window)
**What:** Per-player timestamp tracking, no external library needed
```typescript
// Map<socketId, number[]> -- last N timestamps
const rateLimits = new Map<string, number[]>()

function isRateLimited(socketId: string): boolean {
  const timestamps = rateLimits.get(socketId) || []
  const now = Date.now()
  const recent = timestamps.filter(t => now - t < 10000)
  if (recent.length >= 5) return true
  recent.push(now)
  rateLimits.set(socketId, recent)
  return false
}
```

### Pattern 4: Unread Badge (uiStore)
**What:** Counter incremented when panel is closed, reset when opened
```typescript
// In uiStore additions:
chatMessages: ChatMessage[]
chatOpen: boolean
unreadCount: number

addChatMessage: (msg) => set(state => ({
  chatMessages: [...state.chatMessages, msg].slice(-50),
  unreadCount: state.chatOpen ? state.unreadCount : state.unreadCount + 1,
}))
setChatOpen: (open) => set({ chatOpen: open, ...(open ? { unreadCount: 0 } : {}) })
```

### Anti-Patterns to Avoid
- **Separate chat store:** Don't create a 4th Zustand store. Chat UI state belongs in `uiStore` (per project convention of 3 stores).
- **Client-side sanitization:** Always sanitize on server. Client rendering via React JSX already escapes.
- **Sending playerName from client:** Derive from server-side room state, not from client payload (prevents spoofing).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Message IDs | Incrementing counter | `crypto.randomUUID()` | Node built-in, no collisions |
| HTML sanitization | Full parser | `content.replace(/<[^>]*>/g, '')` + React JSX escaping | Private rooms, no rich text needed |
| Rate limiting | Token bucket | Sliding window with timestamp array | 5 messages is trivial, no library needed |

## Common Pitfalls

### Pitfall 1: Rate limit state not cleaned up on disconnect
**What goes wrong:** `rateLimits` Map grows unbounded
**How to avoid:** Delete entry in socket `disconnect` handler

### Pitfall 2: Chat history not cleared on new game
**What goes wrong:** Messages from previous game bleed into new game
**How to avoid:** Clear `room.chatHistory` in `game:next_game` and `game:start` handlers; clear client `chatMessages` in `game:started` handler (same pattern as `clearScoreHistory`)

### Pitfall 3: Chat input steals keyboard focus from game
**What goes wrong:** Typing in chat triggers game shortcuts or vice versa
**How to avoid:** Chat input only rendered when panel is open; `stopPropagation` on key events

### Pitfall 4: Quick reaction allowlist mismatch
**What goes wrong:** Client shows reactions server rejects
**How to avoid:** Define allowlist once in shared constant or server-side; server validates `type === 'reaction'` content against allowlist

### Pitfall 5: Reconnect sends history but client already has messages
**What goes wrong:** Duplicate messages after reconnect
**How to avoid:** On `chat:history` event, replace (not append) the entire messages array

## Code Examples

### Server: Sanitize message
```typescript
function sanitize(input: string): string {
  return input.replace(/<[^>]*>/g, '').trim().slice(0, 200)
}
```

### Server: Chat history on reconnect
```typescript
// In roomHandlers.ts room:rejoin handler, after existing reconnect logic:
if (room.chatHistory?.length) {
  socket.emit('chat:history', { messages: room.chatHistory })
}
```

### Client: Chat button with badge
```typescript
// Positioned fixed bottom-right, similar to existing UI patterns
<button onClick={() => setChatOpen(!chatOpen)} className="relative">
  <ChatIcon />
  {unreadCount > 0 && (
    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
      {unreadCount > 9 ? '9+' : unreadCount}
    </span>
  )}
</button>
```

### Quick Reactions
```typescript
const QUICK_REACTIONS = ['¡Capicú!', '¡Trancado!', '¡Buena jugada!', '¡Mala suerte!', '🔥', '🤡'] as const
```

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | None configured (per CLAUDE.md: "no test or lint scripts configured") |
| Config file | none -- see Wave 0 |
| Quick run command | `cd server && npx tsc --noEmit && cd ../client && npx tsc --noEmit` |
| Full suite command | Same (type-check only) |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CHAT-01 | 200 char limit enforced | manual | Manual: send >200 char message | N/A |
| CHAT-02 | Broadcast to all players | manual | Manual: open 4 browser tabs | N/A |
| CHAT-03 | Quick reaction single tap | manual | Manual: tap reaction button | N/A |
| CHAT-04 | Unread badge count | manual | Manual: close panel, receive msg | N/A |
| CHAT-05 | Reconnect gets 50 messages | manual | Manual: disconnect/reconnect | N/A |
| CHAT-06 | Rate limit 5/10s | manual | Manual: spam messages quickly | N/A |
| CHAT-07 | XSS sanitization | manual | Manual: send `<script>` tag | N/A |

### Sampling Rate
- **Per task commit:** `cd server && npx tsc --noEmit && cd ../client && npx tsc --noEmit`
- **Per wave merge:** Same + manual smoke test with `npm run dev`
- **Phase gate:** Type-check green + manual verification of all 5 success criteria

### Wave 0 Gaps
None -- no test infrastructure exists in this project. TypeScript strict mode is the primary correctness check (per CLAUDE.md). All validation is manual.

## Sources

### Primary (HIGH confidence)
- Codebase analysis: `server/src/socket/handlers.ts`, `roomHandlers.ts`, `gameHandlers.ts` -- established handler registration pattern
- Codebase analysis: `client/src/store/uiStore.ts` -- Zustand store pattern for UI state
- Codebase analysis: `server/src/game/GameState.ts` -- Room interface to extend
- Codebase analysis: `client/src/hooks/useSocket.ts` -- socket event listener pattern
- CLAUDE.md -- architecture documentation, invariants, conventions

### Secondary (MEDIUM confidence)
- Socket.io room broadcast (`io.to().emit()`) -- well-known API, used throughout codebase

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - no new libraries, all existing
- Architecture: HIGH - follows exact patterns from phases 2-3
- Pitfalls: HIGH - common chat implementation concerns, project-specific patterns observed

**Research date:** 2026-03-08
**Valid until:** 2026-04-08 (stable -- no external dependencies)

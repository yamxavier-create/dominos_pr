# Phase 6: Chat Bug Fixes & Verification - Research

**Researched:** 2026-03-10
**Domain:** Server-side chat state management, documentation gap closure, verification writing
**Confidence:** HIGH

## Summary

Phase 6 is a gap-closure phase, not a feature phase. All code to implement CHAT-03 (ReactionPicker) and CHAT-04 (unread badge) already exists and is correct. The work is: (1) verify CHAT-05's stale-history bug is already fixed, (2) produce a proper VERIFICATION.md that maps requirements correctly, and (3) document CHAT-03 and CHAT-04 with code evidence.

The existing `04-VERIFICATION.md` has **reversed requirement IDs** — it labels CHAT-03 as "unread badge" and CHAT-04 as "chat panel UI", while `REQUIREMENTS.md` defines CHAT-03 as ReactionPicker and CHAT-04 as unread badge. The new VERIFICATION.md must use the IDs as defined in REQUIREMENTS.md.

**Primary recommendation:** Write a corrected VERIFICATION.md for Phase 04 that (a) uses requirement IDs from REQUIREMENTS.md verbatim, (b) confirms both `game:next_game` and rematch consensus paths reset `room.chatHistory = []`, and (c) provides line-level code evidence for CHAT-03 and CHAT-04.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| CHAT-03 | User can send a quick reaction with one click — options: "¡Capicú!", "¡Trancado!", "¡Buena jugada!", "¡Mala suerte!", "🔥", "🤡" | `ReactionPicker.tsx` exists at `client/src/components/chat/ReactionPicker.tsx` (26 lines); exports `QUICK_REACTIONS` array of 21 emoji; each emits `chat:send` with `type:'reaction'` |
| CHAT-04 | Chat button shows unread-message badge when panel is closed | `ChatButton.tsx` at `client/src/components/chat/ChatButton.tsx` (39 lines); renders red badge when `unreadCount > 0`; `uiStore` increments `unreadCount` in `addChatMessage` only when `chatOpen` is false |
| CHAT-05 | Reconnecting player receives history of last 50 messages | `roomHandlers.ts` emits `chat:history` on rejoin; both `game:next_game` (line 541) and rematch consensus (line 599) set `room.chatHistory = []` — stale history bug is already fixed |
</phase_requirements>

## Standard Stack

No new libraries required. This phase touches only:

| File | Purpose |
|------|---------|
| `server/src/socket/gameHandlers.ts` | Source of truth for `room.chatHistory = []` reset paths |
| `client/src/components/chat/ReactionPicker.tsx` | CHAT-03 implementation artifact |
| `client/src/components/chat/ChatButton.tsx` | CHAT-04 implementation artifact |
| `client/src/store/uiStore.ts` | CHAT-04 unread counter logic |
| `.planning/phases/04-in-game-chat/04-VERIFICATION.md` | Existing verification file — has ID mapping errors, will be replaced/corrected |

## Architecture Patterns

### Pattern 1: chatHistory Reset — Two Paths

Both new-game paths in `gameHandlers.ts` already set `room.chatHistory = []`:

**Path A — `game:next_game` (host-initiated, line 541):**
```typescript
// gameHandlers.ts line 540-541
room.rematchVotes = []
room.chatHistory = []
```

**Path B — Rematch consensus (4-vote timeout, line 598-599):**
```typescript
// gameHandlers.ts line 598-599
room.rematchVotes = []
room.chatHistory = []
syncPlayerSocketIds(game, rooms)
```

Also set on initial `game:start` (line 318):
```typescript
room.rematchVotes = []
room.chatHistory = []
```

The Success Criterion 1 ("stale chat history bug") is **already satisfied** in the code. Phase 6's job is to verify and document this, not fix it.

### Pattern 2: CHAT-03 (ReactionPicker) Evidence

`client/src/components/chat/ReactionPicker.tsx`:
- Exports `QUICK_REACTIONS` as a `const` array of 21 emoji strings
- Each button calls `socket.emit('chat:send', { message: reaction, type: 'reaction' })`
- Note: the original REQUIREMENTS.md spec says reactions are phrases ("¡Capicú!", etc.) but the actual implementation uses 21 emoji. This was a deliberate Phase 04 decision logged in STATE.md: "Emoji-only reactions (21 total) instead of text phrases; rate limit raised to 15/10s; removed allowlist validation"
- The VERIFICATION.md must document this deviation as an accepted decision, not a gap

### Pattern 3: CHAT-04 (Unread Badge) Evidence

`client/src/components/chat/ChatButton.tsx`:
- Reads `unreadCount` from `useUIStore`
- Renders a red badge `<span>` when `unreadCount > 0`
- Shows `9+` when count exceeds 9

`client/src/store/uiStore.ts`:
- `addChatMessage` increments `unreadCount` only when `chatOpen === false`
- `setChatOpen(true)` resets `unreadCount` to 0

### Pattern 4: Requirement ID Mapping Correction

The existing `04-VERIFICATION.md` has IDs in the wrong order:

| VERIFICATION.md (wrong) | REQUIREMENTS.md (correct) |
|------------------------|--------------------------|
| CHAT-03 = "Unread badge" | CHAT-03 = ReactionPicker (quick reactions) |
| CHAT-04 = "Chat panel UI" | CHAT-04 = Unread badge |
| CHAT-05 = "Rate limiting" | CHAT-05 = Reconnect history (last 50 msgs) |
| CHAT-06 = "HTML sanitization" | CHAT-06 = Rate limiting (15 msg / 10s) |
| CHAT-07 = "Reconnect history" | CHAT-07 = Sanitization |

The new VERIFICATION.md must use the IDs from REQUIREMENTS.md verbatim.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead |
|---------|-------------|-------------|
| Chat history clearing | Custom event / lifecycle hook | Direct `room.chatHistory = []` already in place — just document it |
| Requirement traceability | New schema or table format | Standard VERIFICATION.md format established in prior phases |

## Common Pitfalls

### Pitfall 1: ID Mismatch Propagation
**What goes wrong:** New VERIFICATION.md copies the wrong IDs from the existing `04-VERIFICATION.md` instead of from `REQUIREMENTS.md`.
**How to avoid:** Always cross-reference requirement IDs against `REQUIREMENTS.md`, not against previous verification files.

### Pitfall 2: Treating Spec Deviations as Bugs
**What goes wrong:** CHAT-03 spec says "¡Capicú!", "🔥", "🤡" (6 phrases). Implementation has 21 emoji. Marking this as a gap.
**How to avoid:** Check STATE.md decisions. This was an explicit Phase 04 decision: "Emoji-only reactions (21 total) instead of text phrases." Document as accepted deviation, not a failure.

### Pitfall 3: Rate Limit Confusion
**What goes wrong:** The existing verification file flags `RATE_LIMIT_MAX = 15` as a gap against the "5/10s" spec, but REQUIREMENTS.md does not specify 5 — it says "máximo 15 mensajes por jugador cada 10 segundos." The plan success criteria had the wrong number. Rate limiting is satisfied per REQUIREMENTS.md.
**How to avoid:** For compliance questions, REQUIREMENTS.md is the authoritative source, not plan-level success criteria.

### Pitfall 4: Claiming stale history is unfixed
**What goes wrong:** Phase objective says "fix stale chat history bug" but the bug is already fixed.
**How to avoid:** Read the code. Both `game:next_game` (line 541) and rematch consensus (line 599) reset `room.chatHistory = []`. Document this as verified-correct, not as something to fix.

## Code Examples

### chatHistory reset — game:next_game path
```typescript
// server/src/socket/gameHandlers.ts lines 540-541
room.rematchVotes = []
room.chatHistory = []
```

### chatHistory reset — rematch consensus path
```typescript
// server/src/socket/gameHandlers.ts lines 598-599
room.rematchVotes = []
room.chatHistory = []
syncPlayerSocketIds(game, rooms)
```

### CHAT-03 — ReactionPicker
```typescript
// client/src/components/chat/ReactionPicker.tsx
export const QUICK_REACTIONS = [
  '🔥', '😂', '💀', '🫡', '👏', '😤', '🤙', '😎', '🎯', '🤡',
  '🥶', '😈', '💯', '🫶', '🤯', '👀', '🙏', '🤬', '🏆', '😏', '🫠',
] as const

// Each button:
socket.emit('chat:send', { message: reaction, type: 'reaction' })
```

### CHAT-04 — Unread Badge
```typescript
// client/src/components/chat/ChatButton.tsx lines 32-35
{unreadCount > 0 && (
  <span className="absolute -top-1 -right-1 min-w-5 h-5 flex items-center justify-center rounded-full bg-red-500 text-white text-xs font-bold px-1">
    {unreadCount > 9 ? '9+' : unreadCount}
  </span>
)}
```

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | TypeScript strict mode (no test runner configured) |
| Config file | `tsconfig.json` per workspace |
| Quick run command | `cd client && npx tsc --noEmit && cd ../server && npx tsc --noEmit` |
| Full suite command | Same — no separate test runner |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CHAT-03 | ReactionPicker renders 21 emoji, each emits chat:send | manual smoke | n/a | ✅ `ReactionPicker.tsx` |
| CHAT-04 | Unread badge appears when chatOpen is false and message arrives | manual smoke | n/a | ✅ `ChatButton.tsx` |
| CHAT-05 | chatHistory = [] on next_game and rematch — reconnector gets empty history | manual-only | n/a | ✅ `gameHandlers.ts` lines 541, 599 |

TypeScript compile passes as the verification check. Runtime behaviors (chat delivery, reconnect) require human verification in a live 4-player session.

### Sampling Rate
- **Per task commit:** `cd /Users/yamirx/Claude_Code/dominos_pr/client && npx tsc --noEmit && cd ../server && npx tsc --noEmit`
- **Per wave merge:** Same
- **Phase gate:** TypeScript clean + human sign-off on VERIFICATION.md content

### Wave 0 Gaps
None — existing infrastructure covers all phase requirements. No new code files needed.

## Open Questions

1. **Reaction allowlist on server**
   - What we know: `chatHandlers.ts` has no `QUICK_REACTIONS` allowlist; any string with `type:'reaction'` is accepted
   - What's unclear: Was this intentional? STATE.md says "removed allowlist validation" as a Phase 04 decision
   - Recommendation: Document as accepted decision. This is a private room (no strangers) — the security tradeoff is acceptable. Do NOT treat as a blocking gap.

2. **REQUIREMENTS.md says reactions are phrases, implementation uses emoji**
   - What we know: Spec says "¡Capicú!", "¡Trancado!", "¡Buena jugada!", "¡Mala suerte!", "🔥", "🤡"
   - What's unclear: Whether to update REQUIREMENTS.md or just document the deviation
   - Recommendation: Document deviation in VERIFICATION.md as a Phase 04 accepted decision. REQUIREMENTS.md update is optional housekeeping, not blocking.

## Sources

### Primary (HIGH confidence)
- Direct code inspection: `server/src/socket/gameHandlers.ts` — lines 318, 541, 599 confirmed
- Direct code inspection: `client/src/components/chat/ReactionPicker.tsx` — 26 lines
- Direct code inspection: `client/src/components/chat/ChatButton.tsx` — 39 lines
- `.planning/REQUIREMENTS.md` — authoritative requirement ID definitions
- `.planning/phases/04-in-game-chat/04-VERIFICATION.md` — existing verification with ID mapping errors
- `.planning/STATE.md` — logged decisions including emoji reactions and rate limit threshold

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all files directly inspected, no external dependencies
- Architecture: HIGH — chatHistory reset confirmed at both call sites by line number
- Pitfalls: HIGH — ID mismatch confirmed by cross-referencing REQUIREMENTS.md against VERIFICATION.md

**Research date:** 2026-03-10
**Valid until:** 2026-04-10 (stable codebase, no external dependencies)

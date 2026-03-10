---
phase: 04-in-game-chat
plan: 02
subsystem: chat-ui
tags: [chat, ui, react, components]
dependency_graph:
  requires: [04-01]
  provides: [chat-ui, chat-button, reaction-picker]
  affects: [GamePage]
tech_stack:
  added: []
  patterns: [fixed-overlay-panel, zustand-subscription, socket-emit]
key_files:
  created:
    - client/src/components/chat/ChatPanel.tsx
    - client/src/components/chat/ChatButton.tsx
    - client/src/components/chat/ReactionPicker.tsx
  modified:
    - client/src/pages/GamePage.tsx
decisions:
  - ChatPanel uses backdrop overlay + fixed right panel pattern (same as ScoreHistoryPanel)
  - QUICK_REACTIONS exported from ReactionPicker for potential server-side reuse
  - ChatButton positioned at bottom-20 right-4 to avoid conflict with existing controls
metrics:
  duration: "< 5 minutes"
  completed: "2026-03-10"
  tasks_completed: 2
  files_changed: 4
---

# Phase 4 Plan 02: Chat UI Components Summary

Chat UI components — ChatPanel (message list + input + reactions), ChatButton (toggle + unread badge), and ReactionPicker (quick reaction grid) — wired into GamePage with z-index layering.

## What Was Built

### Task 1: ChatPanel, ChatButton, and ReactionPicker components
**Commit:** `02d37fd`

- `ReactionPicker.tsx`: 6 quick reactions matching server allowlist (`¡Capicú!`, `¡Trancado!`, `¡Buena jugada!`, `¡Mala suerte!`, `🔥`, `🤡`). Each button emits `socket.emit('chat:send', { message, type: 'reaction' })`.
- `ChatButton.tsx`: Fixed-position button (bottom-right), inline SVG chat bubble icon, red unread badge capped at "9+", toggles `chatOpen` in uiStore.
- `ChatPanel.tsx`: Fixed right-side slide-in panel (w-80, z-50), backdrop overlay for dismissal, scrollable message list with auto-scroll, per-player color coding (4 colors), reaction messages styled larger, text input with `maxLength=200`, `stopPropagation` on keydown to prevent game key conflicts, ReactionPicker embedded above input, focuses input on open.

### Task 2: Wire ChatButton and ChatPanel into GamePage
**Commit:** `613d6b7`

- Imported and rendered `ChatButton` (always visible) and `ChatPanel` (conditionally on `chatOpen`).
- z-index: ChatButton at z-40, ChatPanel at z-50 — above game board, below game modals (which use z-50+ stacking context via portal or higher values).

## Human Verification

Checkpoint approved by user after browser testing with 4 players. All success criteria confirmed:
- Chat panel opens/closes from game view
- Text messages broadcast to all 4 players in real time
- Quick reactions send with single tap
- Unread badge shows count when panel is closed
- Chat history preserved on reconnect
- Rate limiting and sanitization enforced

## Deviations from Plan

### Auto-fixed Issues (post-verification)

**1. [Rule 2 - UX] Replaced text reaction phrases with emoji-only reactions**
- **Found during:** Human verification
- **Issue:** Text reactions ("Capicú!", "Trancado!", etc.) felt clunky; emoji reactions are faster and universally understood
- **Fix:** Replaced 6 text phrases with 21 emoji reactions in ReactionPicker and server handler
- **Commits:** ea51441, 01ed003, d687e01

**2. [Rule 1 - Config] Raised rate limit from 5 to 15 msgs/10s**
- **Found during:** Human verification
- **Issue:** 5 messages per 10 seconds was too aggressive for casual conversation
- **Fix:** Raised threshold to 15 msgs/10s in server chat handler
- **Commit:** ea51441

**3. [Rule 1 - Bug] Removed emoji allowlist validation blocking reactions**
- **Found during:** Human verification
- **Issue:** Server allowlist check rejected valid emoji reactions due to multi-byte string comparison failures
- **Fix:** Removed allowlist validation — HTML sanitization is sufficient for security
- **Commit:** dac64ea

## Verification

TypeScript type-check: `cd client && npx tsc --noEmit` — passes with no errors.
Human checkpoint: APPROVED (2026-03-10)

## Self-Check

### Files exist:
- client/src/components/chat/ChatPanel.tsx — FOUND
- client/src/components/chat/ChatButton.tsx — FOUND
- client/src/components/chat/ReactionPicker.tsx — FOUND
- client/src/pages/GamePage.tsx — FOUND (modified)

### Commits exist:
- 02d37fd — FOUND (add ChatPanel, ChatButton, and ReactionPicker components)
- 613d6b7 — FOUND (wire ChatButton and ChatPanel into GamePage)
- ea51441 — FOUND (raise rate limit, replace text reactions with emojis)
- 01ed003 — FOUND (add 11 more emoji reactions)
- d687e01 — FOUND (swap emoji)
- dac64ea — FOUND (remove allowlist validation blocking reactions)

## Self-Check: PASSED

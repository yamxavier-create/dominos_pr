---
phase: 6
slug: chat-bug-fixes-verification
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-10
---

# Phase 6 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | TypeScript strict mode (no test runner) |
| **Config file** | tsconfig.json (client + server) |
| **Quick run command** | `cd client && npx tsc --noEmit && cd ../server && npx tsc --noEmit` |
| **Full suite command** | `cd client && npx tsc --noEmit && cd ../server && npx tsc --noEmit` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd client && npx tsc --noEmit && cd ../server && npx tsc --noEmit`
- **After every plan wave:** Run full type-check suite
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 06-01-01 | 01 | 1 | CHAT-05 | manual | grep chatHistory server/src/game/gameHandlers.ts | ✅ | ⬜ pending |
| 06-01-02 | 01 | 1 | CHAT-03 | manual | grep -r ReactionPicker client/src | ✅ | ⬜ pending |
| 06-01-03 | 01 | 1 | CHAT-04 | manual | grep -r unreadCount client/src | ✅ | ⬜ pending |
| 06-01-04 | 01 | 1 | CHAT-03,CHAT-04,CHAT-05 | manual | cat .planning/phases/04-in-game-chat/04-VERIFICATION.md | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `.planning/phases/04-in-game-chat/04-VERIFICATION.md` — create verification document for Phase 04

*Existing code infrastructure covers all phase requirements (no new code needed).*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| chatHistory resets on next_game | CHAT-05 | Code inspection | Check gameHandlers.ts lines ~541 and ~599 for `room.chatHistory = []` |
| ReactionPicker exists and works | CHAT-03 | UI behavior | Open game, click reaction button, verify emoji picker shows |
| Unread badge shows/hides | CHAT-04 | UI behavior | Send message while chat closed, verify red badge appears; open chat, verify badge clears |
| VERIFICATION.md correctness | CHAT-03,CHAT-04 | Document review | Confirm ID mapping matches REQUIREMENTS.md definitions |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

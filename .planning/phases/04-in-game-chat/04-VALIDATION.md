---
phase: 4
slug: in-game-chat
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-08
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | None (TypeScript strict mode is primary correctness check per CLAUDE.md) |
| **Config file** | none |
| **Quick run command** | `cd server && npx tsc --noEmit && cd ../client && npx tsc --noEmit` |
| **Full suite command** | `cd server && npx tsc --noEmit && cd ../client && npx tsc --noEmit` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd server && npx tsc --noEmit && cd ../client && npx tsc --noEmit`
- **After every plan wave:** Run full type-check + manual smoke test with `npm run dev`
- **Before `/gsd:verify-work`:** Full type-check green + manual verification of all 5 success criteria
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 04-01-01 | 01 | 1 | CHAT-01 | type-check + manual | `cd server && npx tsc --noEmit` | ✅ | ⬜ pending |
| 04-01-02 | 01 | 1 | CHAT-02 | type-check + manual | `cd server && npx tsc --noEmit` | ✅ | ⬜ pending |
| 04-01-03 | 01 | 1 | CHAT-06 | type-check + manual | `cd server && npx tsc --noEmit` | ✅ | ⬜ pending |
| 04-01-04 | 01 | 1 | CHAT-07 | type-check + manual | `cd server && npx tsc --noEmit` | ✅ | ⬜ pending |
| 04-02-01 | 02 | 1 | CHAT-01 | type-check + manual | `cd client && npx tsc --noEmit` | ✅ | ⬜ pending |
| 04-02-02 | 02 | 1 | CHAT-03 | type-check + manual | `cd client && npx tsc --noEmit` | ✅ | ⬜ pending |
| 04-02-03 | 02 | 1 | CHAT-04 | type-check + manual | `cd client && npx tsc --noEmit` | ✅ | ⬜ pending |
| 04-02-04 | 02 | 1 | CHAT-05 | type-check + manual | `cd client && npx tsc --noEmit` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

*Existing infrastructure covers all phase requirements.* No test framework to install — TypeScript strict mode is the project's correctness gate.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| 200-char message limit enforced | CHAT-01 | UI interaction + server validation | Send message >200 chars, verify truncation/rejection |
| Broadcast to all 4 players | CHAT-02 | Multi-client coordination | Open 4 browser tabs, send message, verify all receive |
| Quick reaction single-tap send | CHAT-03 | UI interaction | Tap reaction button, verify instant send without typing |
| Unread badge count | CHAT-04 | UI state observation | Close chat panel, receive messages, verify badge shows count |
| Reconnect receives last 50 messages | CHAT-05 | Network interruption | Disconnect client, reconnect, verify chat history present |
| Rate limit 5 messages/10s | CHAT-06 | Timing-dependent | Spam >5 messages in <10s, verify server rejects excess |
| XSS sanitization | CHAT-07 | Security validation | Send `<script>alert(1)</script>`, verify rendered as text |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

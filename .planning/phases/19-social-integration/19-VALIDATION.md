---
phase: 19
slug: social-integration
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-03
---

# Phase 19 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Manual verification via Socket.io client + browser |
| **Config file** | none — no test framework in project |
| **Quick run command** | `npx tsc --noEmit` |
| **Full suite command** | `npx tsc --noEmit && npm run build` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx tsc --noEmit`
- **After every plan wave:** Run `npx tsc --noEmit && npm run build`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 19-01-01 | 01 | 1 | JOIN-01 | integration | `npx tsc --noEmit` | ✅ | ⬜ pending |
| 19-01-02 | 01 | 1 | JOIN-02 | integration | `npx tsc --noEmit` | ✅ | ⬜ pending |
| 19-02-01 | 02 | 1 | FRD-06 | integration | `npx tsc --noEmit` | ✅ | ⬜ pending |
| 19-02-02 | 02 | 1 | JOIN-01, JOIN-02, FRD-06 | e2e | `npm run build` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements. TypeScript strict mode is the primary automated check.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Join button appears/disappears in real-time as rooms fill | JOIN-02 | Real-time UI behavior requires live socket connections | 1. Open two browsers. 2. User A creates room. 3. User B sees "Join" on friend A. 4. Fill room to 4 players. 5. "Join" disappears for User B. |
| Direct join navigates to correct lobby | JOIN-01 | End-to-end flow spanning friend list -> room join -> lobby render | 1. User A creates room. 2. User B clicks "Join" on friend A. 3. User B enters lobby with correct players. |
| Post-game Add Friend sends request | FRD-06 | Post-game UI interaction with socket event | 1. Complete a game with a non-friend opponent. 2. Click "Add Friend" on post-game screen. 3. Opponent receives friend request notification. |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

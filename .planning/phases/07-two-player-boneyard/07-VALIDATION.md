---
phase: 7
slug: two-player-boneyard
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-12
---

# Phase 7 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | None (TypeScript strict mode is primary check) |
| **Config file** | tsconfig.json (client + server) |
| **Quick run command** | `cd client && npx tsc --noEmit && cd ../server && npx tsc --noEmit` |
| **Full suite command** | Same as quick run + manual play-test |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd client && npx tsc --noEmit && cd ../server && npx tsc --noEmit`
- **After every plan wave:** Run full type-check + manual play-test
- **Before `/gsd:verify-work`:** Full suite must be green + complete 2-player game play-through
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 07-01-01 | 01 | 1 | TWO-01, TWO-02, TWO-03, TWO-04, TWO-07 | type-check | `cd server && npx tsc --noEmit` | N/A | ⬜ pending |
| 07-02-01 | 02 | 1 | TWO-06 | type-check | `cd client && npx tsc --noEmit` | N/A | ⬜ pending |
| 07-03-01 | 03 | 2 | TWO-01, TWO-06 | type-check + manual | Full type-check + lobby test | N/A | ⬜ pending |
| 07-04-01 | 04 | 2 | ALL | manual | Full 2-player game play-through | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

*Existing infrastructure covers all phase requirements. TypeScript strict mode is the automated correctness check.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| 2 players in lobby auto-starts 2-player mode | TWO-01 | UI flow, no test framework | Open 2 browsers, join room, start game with 2 players |
| Boneyard draw when stuck | TWO-03 | Game flow requires human observation | Play until unable to move, verify tiles drawn from boneyard |
| Individual scoring displayed | TWO-04 | Visual check | Win a hand, verify player names shown (not team names) |
| Layout shows only bottom + top | TWO-06 | Visual check | Start 2-player game, verify no left/right seats |
| Blocked game with empty boneyard | TWO-07 | Game flow | Play until boneyard empty and both stuck |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

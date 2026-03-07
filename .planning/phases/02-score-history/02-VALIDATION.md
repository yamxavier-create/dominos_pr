---
phase: 2
slug: score-history
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-06
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | None — TypeScript strict mode is the primary automated check |
| **Config file** | none — no test runner installed |
| **Quick run command** | `cd client && npx tsc --noEmit` |
| **Full suite command** | `cd client && npx tsc --noEmit && cd ../server && npx tsc --noEmit` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd client && npx tsc --noEmit`
- **After every plan wave:** Run `cd client && npx tsc --noEmit && cd ../server && npx tsc --noEmit`
- **Before `/gsd:verify-work`:** Full suite must be green + all manual verifications completed
- **Max feedback latency:** ~10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 2-01-01 | 01 | 1 | SCORE-01 | TypeScript compile | `cd client && npx tsc --noEmit` | ❌ New store fields | ⬜ pending |
| 2-01-02 | 01 | 1 | SCORE-03 | TypeScript compile | `cd client && npx tsc --noEmit` | ❌ New store action | ⬜ pending |
| 2-01-03 | 01 | 1 | SCORE-02 | TypeScript compile | `cd client && npx tsc --noEmit` | ❌ New uiStore field | ⬜ pending |
| 2-02-01 | 02 | 1 | SCORE-01, SCORE-02 | TypeScript compile | `cd client && npx tsc --noEmit` | ❌ New component | ⬜ pending |
| 2-03-01 | 03 | 2 | SCORE-01, SCORE-02, SCORE-03 | TypeScript compile + manual | `cd client && npx tsc --noEmit` | ❌ Modified files | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all automated verification needs. TypeScript strict-mode compilation (`npx tsc --noEmit`) requires no setup and acts as the primary correctness gate.

No Wave 0 test file scaffolding needed for this phase.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Panel renders correct team labels (Nosotros/Ellos) relative to viewer | SCORE-01 | UI rendering, no test runner | Open game, complete 2+ hands, verify winner shown as Nosotros/Ellos from each player's perspective |
| Capicú/Chuchazo/Trancado badges appear on correct rows | SCORE-01 | Requires actual game state | Play to capicú and blocked-game ends, verify correct badge appears on that row |
| Panel animates open and closed smoothly | SCORE-02 | CSS animation cannot be automated without browser | Click score bar, verify slide-down animation; click again, verify slide-up |
| Panel auto-closes when round-end modal appears | SCORE-02 | Timing/interaction between two UI states | Open panel mid-game, complete a round, verify panel closes before modal shows |
| History is empty at the start of a fresh game | SCORE-03 | Requires full game flow | Complete a game, start a new one, open history panel, verify empty state |
| handNumber displays correctly across multiple hands | SCORE-01 | Off-by-one risk with server timing | Complete 3+ hands, verify Mano numbers are sequential and correct |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

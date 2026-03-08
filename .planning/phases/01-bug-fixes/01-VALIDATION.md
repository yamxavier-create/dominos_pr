---
phase: 01
slug: bug-fixes
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-08
---

# Phase 01 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | None configured (TypeScript strict mode only) |
| **Config file** | none |
| **Quick run command** | `cd client && npx tsc --noEmit && cd ../server && npx tsc --noEmit` |
| **Full suite command** | `cd client && npx tsc --noEmit && cd ../server && npx tsc --noEmit` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd client && npx tsc --noEmit && cd ../server && npx tsc --noEmit`
- **After every plan wave:** Run full suite + manual smoke test
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 01-01-01 | 01 | 1 | BUG-01 | manual + tsc | `cd client && npx tsc --noEmit` | N/A | ⬜ pending |
| 01-01-02 | 01 | 1 | BUG-02 | manual + tsc | `cd client && npx tsc --noEmit` | N/A | ⬜ pending |
| 01-01-03 | 01 | 1 | BUG-03 | manual + tsc | `cd client && npx tsc --noEmit` | N/A | ⬜ pending |
| 01-01-04 | 01 | 1 | BUG-04 | smoke + tsc | `cd server && npx tsc --noEmit` | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements. No test framework install needed — TypeScript strict mode + manual verification is the validation strategy for these four targeted bug fixes.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Animation targets newest tile by sequence on left-end play | BUG-01 | Visual animation behavior | Play tile on left end of board, observe fly animation targets correct tile |
| Host indicator correct after promotion | BUG-02 | UI state after player disconnect | Original host leaves, verify promoted player sees host UI |
| Selected tile clears on turn change | BUG-03 | UI interaction state | Select a tile, wait for turn to pass, verify tile is deselected |
| No dynamic require warning on startup | BUG-04 | Console output check | Run `npm run dev --workspace=server`, verify no require warning |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

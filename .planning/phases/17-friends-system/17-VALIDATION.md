---
phase: 17
slug: friends-system
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-02
---

# Phase 17 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | TypeScript strict mode (tsc --noEmit) |
| **Config file** | server/tsconfig.json, client/tsconfig.json |
| **Quick run command** | `npx tsc -p server/tsconfig.json --noEmit` |
| **Full suite command** | `npm run build` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx tsc -p server/tsconfig.json --noEmit`
- **After every plan wave:** Run `npm run build`
- **Before `/gsd:verify-work`:** Full build must succeed
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 17-01-01 | 01 | 1 | FRD-01, FRD-02, FRD-03, FRD-04, FRD-05 | compile + manual | `npx tsc -p server/tsconfig.json --noEmit` | ✅ | ⬜ pending |
| 17-01-02 | 01 | 1 | FRD-02 | compile + manual | `npx tsc -p server/tsconfig.json --noEmit` | ✅ | ⬜ pending |
| 17-02-01 | 02 | 2 | FRD-01, FRD-02, FRD-03, FRD-04, FRD-05 | compile + manual | `npm run build` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

*Existing infrastructure covers all phase requirements. TypeScript strict mode is the primary automated check.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Search returns matching users | FRD-01 | Requires 2+ user accounts in DB | Create 2 accounts, search by username |
| Friend request sends in real-time | FRD-02 | Requires 2 browser sessions | Open 2 tabs, send request, verify notification |
| Accept/reject updates both sides | FRD-03 | Requires 2 browser sessions | Accept request, verify friends list on both |
| Friends list shows accepted friends | FRD-04 | Requires completed friend flow | Complete friend flow, verify list |
| Unfriend removes from both lists | FRD-05 | Requires existing friendship | Unfriend, verify removal on both sides |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

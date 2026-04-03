---
phase: 18
slug: presence
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-03
---

# Phase 18 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | TypeScript strict mode (no test framework) |
| **Config file** | tsconfig.json (both client/ and server/) |
| **Quick run command** | `npm run build` |
| **Full suite command** | `npm run build` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm run build`
- **After every plan wave:** Run `npm run build`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 18-01-01 | 01 | 1 | PRES-01, PRES-03 | build | `npm run build` | ❌ W0 | ⬜ pending |
| 18-01-02 | 01 | 1 | PRES-01 | build | `npm run build` | ❌ W0 | ⬜ pending |
| 18-01-03 | 01 | 1 | PRES-02 | build | `npm run build` | ❌ W0 | ⬜ pending |
| 18-02-01 | 02 | 2 | PRES-01 | manual | 2 browsers, check badges | N/A | ⬜ pending |
| 18-02-02 | 02 | 2 | PRES-02 | manual | 2 browsers, verify toast | N/A | ⬜ pending |
| 18-02-03 | 02 | 2 | PRES-03 | manual | 3 tabs, close sequence | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

*Existing infrastructure covers all phase requirements. No test framework to install.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Friend status badges update in real-time | PRES-01 | Requires 2 browser windows with different users | Log in as User A and User B in separate browsers; verify status changes propagate |
| Toast notification on friend online/in_lobby | PRES-02 | Requires visual verification of toast UI | User B opens app → User A should see "friend online" toast |
| Multi-tab offline grace period | PRES-03 | Requires multi-tab browser interaction | Open 3 tabs as User A; close 2 tabs; verify User B still sees "online"; close last tab; verify offline after ~5s |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

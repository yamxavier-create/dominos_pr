---
phase: 9
slug: camera-and-microphone-for-2-player-duo-mode
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-12
---

# Phase 9 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | TypeScript strict mode (no test framework configured) |
| **Config file** | `client/tsconfig.json`, `server/tsconfig.json` |
| **Quick run command** | `cd client && npx tsc --noEmit && cd ../server && npx tsc --noEmit` |
| **Full suite command** | `npm run build` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd client && npx tsc --noEmit && cd ../server && npx tsc --noEmit`
- **After every plan wave:** Run `npm run build`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 09-01-01 | 01 | 1 | DUO-CAM-01 | unit | `cd client && npx tsc --noEmit` | N/A | ⬜ pending |
| 09-01-02 | 01 | 1 | DUO-CAM-02 | unit | `cd client && npx tsc --noEmit` | N/A | ⬜ pending |
| 09-01-03 | 01 | 1 | DUO-CAM-03 | build | `npm run build` | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements. No test framework to add — TypeScript strict mode is the existing validation mechanism.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| WebRTC connects between 2 players (no phantom peers) | DUO-CAM-01 | Requires 2 browser instances with camera/mic | 1. Start 2-player game, 2. Both opt in to video, 3. Verify only 1 peer connection created per player, 4. Verify video/audio streams work |
| VideoCallPanel shows 2 tiles in duo mode | DUO-CAM-02 | Visual verification in browser | 1. Start 2-player game with video, 2. Open VideoCallPanel, 3. Verify exactly 2 video tiles shown (not 4) |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

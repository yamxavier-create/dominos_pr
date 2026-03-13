---
phase: 12
slug: avatar-cameras
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-13
---

# Phase 12 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | TypeScript strict mode (no test framework configured) |
| **Config file** | `client/tsconfig.json`, `server/tsconfig.json` |
| **Quick run command** | `cd client && npx tsc --noEmit` |
| **Full suite command** | `cd client && npx tsc --noEmit && cd ../server && npx tsc --noEmit` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd client && npx tsc --noEmit`
- **After every plan wave:** Run `cd client && npx tsc --noEmit && cd ../server && npx tsc --noEmit`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 12-01-01 | 01 | 1 | CAM-01 | manual | `cd client && npx tsc --noEmit` | N/A | ⬜ pending |
| 12-01-02 | 01 | 1 | CAM-02 | manual | `cd client && npx tsc --noEmit` | N/A | ⬜ pending |
| 12-01-03 | 01 | 1 | CAM-05 | manual | `cd client && npx tsc --noEmit` | N/A | ⬜ pending |
| 12-02-01 | 02 | 1 | CAM-03 | manual | `cd client && npx tsc --noEmit` | N/A | ⬜ pending |
| 12-02-02 | 02 | 1 | CAM-04 | manual | `cd client && npx tsc --noEmit` | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements. No test framework changes needed — TypeScript strict mode provides compile-time validation.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Video displays in circular avatar | CAM-01 | Requires real camera + WebRTC peer connection | Join a 2+ player game with camera on. Verify video appears as circle above player name. |
| Initials fallback when camera off | CAM-02 | Requires camera toggle interaction | Toggle camera off during game. Verify initials circle appears instead of video. |
| Mic toggle during gameplay | CAM-03 | Requires audio device | Click mic toggle. Verify remote players can/cannot hear you. |
| Camera toggle during gameplay | CAM-04 | Requires video device | Click camera toggle. Verify video feed starts/stops for remote players. |
| Speaking glow indicator | CAM-05 | Requires audio + WebRTC | Speak while in call. Verify green glow ring appears around speaking player's avatar. |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

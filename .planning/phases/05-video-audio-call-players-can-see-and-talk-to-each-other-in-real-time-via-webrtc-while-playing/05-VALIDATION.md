---
phase: 5
slug: video-audio-call-players-can-see-and-talk-to-each-other-in-real-time-via-webrtc-while-playing
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-10
---

# Phase 5 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | TypeScript strict mode (primary per CLAUDE.md) — no test runner configured |
| **Config file** | none |
| **Quick run command** | `cd client && npx tsc --noEmit` |
| **Full suite command** | `cd client && npx tsc --noEmit && cd ../server && npx tsc --noEmit` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd client && npx tsc --noEmit && cd ../server && npx tsc --noEmit`
- **After every plan wave:** Same + manual smoke test with 2 browser tabs
- **Before `/gsd:verify-work`:** Full TypeScript compile green + manual 4-player test
- **Max feedback latency:** ~10 seconds (TypeScript compile)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 5-01-01 | 01 | 1 | CALL-01 | unit | `cd client && npx tsc --noEmit` | ❌ W0 | ⬜ pending |
| 5-01-02 | 01 | 1 | CALL-03 | unit | `cd client && npx tsc --noEmit` | ❌ W0 | ⬜ pending |
| 5-01-03 | 01 | 1 | CALL-03 | unit | `cd server && npx tsc --noEmit` | ❌ W0 | ⬜ pending |
| 5-02-01 | 02 | 2 | CALL-02 | manual-only | n/a — requires browser permission API | n/a | ⬜ pending |
| 5-02-02 | 02 | 2 | CALL-03 | manual-only | n/a — requires 2+ browsers | n/a | ⬜ pending |
| 5-03-01 | 03 | 3 | CALL-04 | unit | `cd client && npx tsc --noEmit` | ❌ W0 | ⬜ pending |
| 5-03-02 | 03 | 3 | CALL-04 | manual-only | n/a — requires camera | n/a | ⬜ pending |
| 5-04-01 | 04 | 3 | CALL-05 | unit | `cd client && npx tsc --noEmit` | ❌ W0 | ⬜ pending |
| 5-04-02 | 04 | 3 | CALL-05 | manual-only | n/a — requires live media | n/a | ⬜ pending |
| 5-04-03 | 04 | 3 | CALL-06 | unit | `cd client && npx tsc --noEmit` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `client/src/store/callStore.ts` — stub with typed interface; covers CALL-01, CALL-05
- [ ] `client/src/hooks/useWebRTC.ts` — stub; covers CALL-03
- [ ] `server/src/socket/webrtcHandlers.ts` — stub; covers CALL-01, CALL-03

*No new test framework install needed — TypeScript strict is the automated check.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Lobby opt-in toggle visible + broadcast | CALL-01 | Requires browser + socket | Open 2 tabs, toggle camera icon in lobby, verify both tabs update |
| getUserMedia prompt on game start | CALL-02 | Requires browser permission API | Start game with video opted in, verify permission dialog appears |
| RTCPeerConnection established | CALL-03 | Requires 2+ browsers | Open 4 tabs, start game, verify video streams appear in each seat |
| Video tile renders stream or avatar | CALL-04 | Requires camera hardware | With camera: verify video shows. Without/denied: verify avatar fallback |
| Mute/camera toggle disables track + badge | CALL-05 | Requires live media | Toggle mute on own tile, verify mic badge appears on other players' views |
| No memory leak after game ends | CALL-03 | Requires browser devtools | After game end, verify camera LED off and no lingering PCs in devtools |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

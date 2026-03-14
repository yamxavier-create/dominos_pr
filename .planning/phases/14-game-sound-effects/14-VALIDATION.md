---
phase: 14
slug: game-sound-effects
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-14
---

# Phase 14 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | TypeScript strict mode (no test framework configured) |
| **Config file** | `client/tsconfig.json`, `server/tsconfig.json` |
| **Quick run command** | `cd client && npx tsc --noEmit` |
| **Full suite command** | `cd client && npx tsc --noEmit && cd ../server && npx tsc --noEmit` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd client && npx tsc --noEmit`
- **After every plan wave:** Run `cd client && npx tsc --noEmit && cd ../server && npx tsc --noEmit`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 14-01-01 | 01 | 1 | SFX-01 | manual | `cd client && npx tsc --noEmit` | N/A | ⬜ pending |
| 14-01-02 | 01 | 1 | SFX-02 | manual | `cd client && npx tsc --noEmit` | N/A | ⬜ pending |
| 14-01-03 | 01 | 1 | SFX-03 | manual | `cd client && npx tsc --noEmit` | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `client/public/audio/tile-clack.mp3` — audio file for SFX-01 (tile placement clack)
- [ ] `client/public/audio/turn-notify.mp3` — audio file for SFX-02 (turn notification)
- [ ] `client/public/audio/pass.mp3` — audio file for SFX-03 (pass sound)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Clack plays on tile placement | SFX-01 | Audio playback requires browser + human listener | Play a tile in dev mode, listen for clack sound |
| Notification plays on turn start | SFX-02 | Audio playback requires browser + human listener | Have opponent play a tile, listen for notification when it becomes your turn |
| Pass sound plays (debounced) | SFX-03 | Audio playback + cascade timing requires human verification | Create a position where auto-pass cascade occurs, verify single pass sound |
| No glitches on mobile Safari/Chrome | ALL | Device-specific audio requires real device testing | Test all 3 sounds on mobile Safari and Chrome |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

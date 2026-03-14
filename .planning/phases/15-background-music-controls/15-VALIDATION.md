---
phase: 15
slug: background-music-controls
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-14
---

# Phase 15 — Validation Strategy

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
| 15-01-01 | 01 | 1 | MUS-01 | type-check + manual | `cd client && npx tsc --noEmit` | N/A | ⬜ pending |
| 15-01-02 | 01 | 1 | MUS-02 | type-check + manual | `cd client && npx tsc --noEmit` | N/A | ⬜ pending |
| 15-01-03 | 01 | 1 | CTL-01 | type-check + manual | `cd client && npx tsc --noEmit` | N/A | ⬜ pending |
| 15-01-04 | 01 | 1 | CTL-02 | type-check + manual | `cd client && npx tsc --noEmit` | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `client/public/audio/lofi-loop.mp3` — placeholder music file for MUS-01

*Existing infrastructure covers all other phase requirements.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Lo-fi music plays on menu and lobby | MUS-01 | Audio playback requires browser | Navigate to `/` and `/lobby`, confirm music is audible and loops |
| Music stops when game starts | MUS-02 | Route transition + audio state requires browser | Start a game from lobby, confirm music stops on `/game` |
| SFX toggle independent of music | CTL-01 | Audio toggle interaction requires browser | Toggle SFX off, confirm music still plays; play tile, confirm no clack |
| Music toggle independent of SFX | CTL-02 | Audio toggle interaction requires browser | Toggle music off, confirm SFX still work; toggle music on, confirm it resumes |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

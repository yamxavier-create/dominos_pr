---
phase: 13
slug: audio-foundation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-14
---

# Phase 13 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | None (TypeScript strict mode is primary correctness check) |
| **Config file** | none — no test framework in project |
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
| 13-01-01 | 01 | 1 | AUD-01 | manual | `cd client && npx tsc --noEmit` | N/A | ⬜ pending |
| 13-01-02 | 01 | 1 | AUD-01 | manual | Start dev, open voice chat, verify green glow ring | N/A | ⬜ pending |
| 13-02-01 | 02 | 1 | AUD-02 | manual | Load app fresh, click anywhere, verify AudioContext `running` | N/A | ⬜ pending |
| 13-03-01 | 03 | 1 | AUD-03 | manual | Build, serve, go offline in DevTools, verify audio in Cache Storage | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements. No test framework to set up — all validation is TypeScript compilation + manual browser testing. This is appropriate because:
- AudioContext behavior cannot be unit tested without browser APIs
- Autoplay policy requires real browser interaction
- PWA caching requires a built service worker

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Shared AudioContext singleton with speaking detection | AUD-01 | Requires real browser WebRTC + AudioContext interaction | 1. Start dev server 2. Join voice chat 3. Speak — verify green glow ring still appears 4. Check console for single AudioContext |
| Autoplay unlock on first gesture | AUD-02 | Requires real browser autoplay policy enforcement | 1. Load app fresh (clear cache) 2. Click anywhere 3. Check `audioContext.state === 'running'` in console |
| Audio files cached for offline | AUD-03 | Requires built service worker and DevTools | 1. `npm run build` 2. Serve production build 3. Go offline in DevTools Network tab 4. Verify audio files in Cache Storage |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

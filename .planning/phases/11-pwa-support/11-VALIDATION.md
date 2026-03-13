---
phase: 11
slug: pwa-support
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-13
---

# Phase 11 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | No test framework configured (TypeScript strict mode is primary check) |
| **Config file** | none |
| **Quick run command** | `cd client && npx tsc --noEmit` |
| **Full suite command** | `cd client && npx tsc --noEmit && npm run build` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd client && npx tsc --noEmit`
- **After every plan wave:** Run `npm run build` (full build both workspaces)
- **Before `/gsd:verify-work`:** Full build must succeed + Lighthouse PWA audit on deployed URL
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 11-01-01 | 01 | 1 | PWA-01 | manual | Chrome DevTools > Application > Manifest | N/A | ⬜ pending |
| 11-01-02 | 01 | 1 | PWA-02 | manual | Install on Android/Chrome, verify standalone launch | N/A | ⬜ pending |
| 11-01-03 | 01 | 1 | PWA-03 | manual + type-check | `cd client && npx tsc --noEmit` | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `client/public/` directory — does not exist yet, must be created for icon files
- [ ] Icon PNG files — must be created (192x192, 512x512, regular + maskable variants)

*No test framework installation needed — TypeScript strict mode + build is the verification gate.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Install prompt appears | PWA-01 | Browser-specific UI, cannot be automated without Puppeteer | 1. Open deployed URL in Chrome Android 2. Wait for install banner or use menu > "Add to Home Screen" 3. Verify app installs |
| Standalone mode launch | PWA-02 | Requires physical device/emulator to verify display mode | 1. Launch installed PWA from home screen 2. Verify no browser chrome 3. Verify splash screen with branding |
| Correct icons on home screen | PWA-03 | Visual verification on device | 1. Check home screen icon matches Domino PR branding 2. Not a generic browser icon |
| Socket.io works in PWA | N/A | Real-time connection test in installed app context | 1. Open installed PWA 2. Join/create room 3. Play full game 4. Verify no connection drops |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

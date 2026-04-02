---
phase: 16
slug: auth-profile
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-02
---

# Phase 16 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Manual + TypeScript strict (no test framework in project) |
| **Config file** | tsconfig.json (strict mode) |
| **Quick run command** | `npx tsc --noEmit -p client/tsconfig.json && npx tsc --noEmit -p server/tsconfig.json` |
| **Full suite command** | `npm run build` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx tsc --noEmit -p client/tsconfig.json`
- **After every plan wave:** Run `npm run build`
- **Before `/gsd:verify-work`:** Full build must succeed
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 16-01-01 | 01 | 1 | AUTH-01 | integration | `curl -s localhost:3001/api/auth/google -X POST` | ❌ W0 | ⬜ pending |
| 16-01-02 | 01 | 1 | AUTH-02 | manual | Browser: open app, play as guest | ✅ | ⬜ pending |
| 16-01-03 | 01 | 1 | AUTH-03 | manual | Browser: login, refresh, check still logged in | ❌ W0 | ⬜ pending |
| 16-02-01 | 02 | 2 | PROF-01 | integration | `curl -s localhost:3001/api/auth/profile -X PATCH` | ❌ W0 | ⬜ pending |
| 16-02-02 | 02 | 2 | PROF-02 | manual | Browser: login with Google, check avatar shows | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- Existing TypeScript strict mode covers all compile-time verification
- No test framework needed — phase is integration-heavy, verified via build + manual browser testing

*Existing infrastructure covers all phase requirements.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Google OAuth flow | AUTH-01 | Requires real browser + Google consent screen | 1. Open app 2. Tap Google login 3. Complete OAuth 4. Verify redirected back logged in |
| Guest mode preserved | AUTH-02 | UX behavior, no programmatic test | 1. Open app in incognito 2. Enter name 3. Join/create room 4. Verify no login prompt |
| JWT persistence | AUTH-03 | Requires browser localStorage | 1. Login 2. Refresh page 3. Verify still logged in |
| Edit display name | PROF-01 | UX flow | 1. Login 2. Open profile 3. Change name 4. Verify updated |
| Google avatar display | PROF-02 | Visual verification | 1. Login with Google 2. Check avatar in game seat |

---

## Validation Sign-Off

- [ ] All tasks have automated verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

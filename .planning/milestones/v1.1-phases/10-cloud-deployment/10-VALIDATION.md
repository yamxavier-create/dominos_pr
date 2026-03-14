---
phase: 10
slug: cloud-deployment
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-13
---

# Phase 10 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | None (deployment phase — type-check only) |
| **Config file** | `client/tsconfig.json`, `server/tsconfig.json` |
| **Quick run command** | `cd client && npx tsc --noEmit && cd ../server && npx tsc --noEmit` |
| **Full suite command** | `cd client && npx tsc --noEmit && cd ../server && npx tsc --noEmit` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd client && npx tsc --noEmit && cd ../server && npx tsc --noEmit`
- **After every plan wave:** Run full type-check + manual smoke test of deployed URL
- **Before `/gsd:verify-work`:** Full suite must be green + all 5 success criteria verified on live deployment
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 10-01-01 | 01 | 1 | DEPLOY-01 | type-check | `cd server && npx tsc --noEmit` | ✅ | ⬜ pending |
| 10-01-02 | 01 | 1 | DEPLOY-01 | smoke | `curl -s https://<app-url>/health` | N/A | ⬜ pending |
| 10-01-03 | 01 | 1 | DEPLOY-01 | manual-only | Visit URL, check WebSocket in devtools | N/A | ⬜ pending |
| 10-02-01 | 02 | 2 | DEPLOY-02 | manual-only | Configure custom domain in Railway dashboard | N/A | ⬜ pending |
| 10-02-02 | 02 | 2 | DEPLOY-03 | manual-only | Push commit, verify redeploy in dashboard | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements. No test framework installation needed — this phase is deployment-focused with type-checking as the automated gate.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| App accessible at public HTTPS URL | DEPLOY-01 | Requires live deployment | Visit Railway-provided URL, verify landing page loads |
| Socket.io WebSocket upgrade | DEPLOY-01 | Requires browser devtools on live site | Open Network tab, filter WS, join a room, verify WebSocket frame (not polling-only) |
| Cross-network gameplay + video | DEPLOY-01 | Requires two physical devices on different networks | Two players on different WiFi/cellular create room, play full game, test video call |
| Custom domain configuration | DEPLOY-02 | Requires DNS provider access | Add CNAME in DNS, configure in Railway dashboard, verify SSL auto-provisions |
| Auto-redeploy on push | DEPLOY-03 | Requires actual git push + Railway observation | Push commit to main, verify new deploy starts in Railway dashboard |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

# Project Retrospective

*A living document updated after each milestone. Lessons feed forward into future planning.*

## Milestone: v1.0 — Social Features + Two-Player Mode

**Shipped:** 2026-03-13
**Phases:** 10 | **Plans:** 23 | **Timeline:** 7 days

### What Was Built
- 8 game flow bug fixes establishing a stable baseline
- Per-hand score history panel with running team totals
- Rematch voting system (4/4 consensus, live counter, disconnect handling)
- In-game chat with free text, 21 emoji reactions, unread badges, reconnect history
- WebRTC video/audio calling with lobby opt-in and collapsible side panel
- 2-player mode with boneyard draw mechanic, animated pile, and duo camera

### What Worked
- Bug fixes first strategy: landing prerequisite fixes before features prevented rework in chat/rematch phases
- Score history before rematch: established the overlay UX pattern and gameStore extension pattern that chat reused
- Phase 6 gap-closure phase: audit-driven phase creation efficiently closed documentation and verification gaps
- Additive approach: GameEngine.ts pure functions were never modified — all new features layered on top
- WebRTC Perfect Negotiation pattern: clean implementation that compiled first pass with zero type errors
- playerCount parameterization: backward-compatible 2/4 player support without breaking existing code

### What Was Inefficient
- Phase 1 and Phase 6 ROADMAP checkboxes not updated despite completion — caused audit false positives
- VERIFICATION.md skipped for Phase 04 during execution — required a dedicated gap-closure phase later
- CHAT-03 and CHAT-04 not tracked in SUMMARY requirements-completed fields — provenance gap only found by audit
- Traceability table in REQUIREMENTS.md not updated for Phases 7-9 (BONE/DUO-CAM still showed "Planned")
- Some plan one-liners not extractable by summary-extract tool (empty accomplishments array)

### Patterns Established
- `is2Player` derived from `gameState.playerCount` across all components for consistent branching
- Boneyard draw events use split emit pattern (tile data to drawer, null to opponents)
- Animation queue with `isProcessingRef` for one-at-a-time sequential animations
- `signalHandlerRef` module-level export for routing events to hook instances without prop drilling
- REQUIREMENTS.md as sole authoritative source for requirement IDs

### Key Lessons
1. Always create VERIFICATION.md during phase execution, not retroactively — it's cheaper in-phase than as a gap-closure phase
2. Update traceability table status when phases complete, not just requirement checkboxes
3. Audit before milestone completion catches real issues — Phase 6 fixed stale chat history and documentation gaps
4. WebRTC complexity was overestimated in initial PROJECT.md — shipped in v1.0 instead of deferring to v2
5. Split emit pattern (different payloads per player) is clean for asymmetric information games

### Cost Observations
- Model mix: primarily opus for execution, sonnet for research/planning
- 23 plans executed across ~75 minutes of agent time
- Average plan duration: ~3.3 minutes
- Longest plan: Phase 07 P04 (12min, 3 tasks, 6 files — largest UI adaptation phase)

---

## Milestone: v1.1 — Deploy & Polish

**Shipped:** 2026-03-13
**Phases:** 3 | **Plans:** 5 | **Timeline:** 7 days (overlapping with v1.0 final phases)

### What Was Built
- Cloud deployment to Railway with HTTPS, health endpoint, auto-deploy from main
- Custom domain configuration guide (CNAME/DNS/SSL documentation)
- PWA support: installable from browser, standalone mode, branded icons, service worker
- Circular live video avatars embedded in player seat positions (replacing VideoCallPanel side panel)
- Speaking detection with green glow ring using Web Audio API frequency analysis
- Inline call controls (mic/camera toggle) and mid-game join button

### What Worked
- Railway deployment was straightforward: only 2 code files changed (railway.toml + index.ts), rest was config
- vite-plugin-pwa required minimal code: ~20 lines in vite.config.ts for full PWA support
- Avatar cameras architecture was clean: seatCallProps helper centralized stream routing to all 4 seats
- Phase dependencies worked well: Phase 10 (HTTPS) → Phase 11 (SW requires HTTPS) → Phase 12 (getUserMedia requires HTTPS)

### What Was Inefficient
- SUMMARY one_liner fields were null — summary-extract returned empty accomplishments
- Phase 10 verification was mostly human_needed (4/5 items) — deployment phases inherently resist automated verification
- VideoCallPanel.tsx left as dead code after Phase 12 replaced it — should have been deleted in the plan

### Patterns Established
- `seatCallProps(playerIndex)` helper for routing per-seat call data in GameTable
- Service worker denylist pattern for socket.io and health paths
- Conditional CORS: disabled in production (same-origin serving), enabled in dev

### Key Lessons
1. Deployment phases generate mostly human-verification items — consider inline checkpoint tasks during execution
2. Delete replaced files in the same plan that removes their usage — prevents dead code accumulation
3. PWA + Railway + WebRTC all work together cleanly over HTTPS without special config
4. Avatar integration was simpler than expected because callStore already had all needed state from v1.0

### Cost Observations
- Model mix: opus for execution, sonnet for research/planning/integration-checking
- 5 plans executed, 3 human-gated (deployment/PWA verification), 2 automated (~2-3min each)
- Milestone audit revealed only tech debt, no blockers — clean completion

---

## Cross-Milestone Trends

| Metric | v1.0 | v1.1 |
|--------|------|------|
| Phases | 10 | 3 |
| Plans | 23 | 5 |
| Timeline | 7 days | 7 days |
| LOC | 5,721 | 6,132 |
| Commits | 147 | 29 |
| Avg plan duration | ~3.3 min | ~3 min (2 automated) |
| Audit gaps found | 5 critical, 3 non-critical | 0 critical, 3 tech debt |
| Gap-closure phases needed | 1 | 0 |

### Top Lessons (Verified Across Milestones)

1. Always run milestone audit before completion — catches real gaps both times (v1.0: 5 critical, v1.1: 3 tech debt)
2. Phase dependency ordering matters — both milestones benefited from foundation-first execution
3. Additive architecture scales well — v1.0 built callStore/WebRTC, v1.1 layered avatar cameras on top without touching core

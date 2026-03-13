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

## Cross-Milestone Trends

| Metric | v1.0 |
|--------|------|
| Phases | 10 |
| Plans | 23 |
| Timeline | 7 days |
| LOC | 5,721 |
| Commits | 147 |
| Avg plan duration | ~3.3 min |
| Audit gaps found | 5 critical, 3 non-critical |
| Gap-closure phases needed | 1 |

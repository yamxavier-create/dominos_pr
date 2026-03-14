# Milestones

## v1.1 Deploy & Polish (Shipped: 2026-03-14)

**Phases completed:** 3 phases, 5 plans | 29 commits | +9,526 / -1,955 lines | 6,132 LOC total

**Timeline:** 7 days (2026-03-06 → 2026-03-13)

**Key accomplishments:**
- Deployed to Railway with HTTPS, health endpoint, auto-deploy from main, and custom domain guide
- Added PWA support: installable from browser with standalone mode, service worker, and branded icons
- Replaced VideoCallPanel side panel with circular live video avatars embedded in player seat positions
- Added speaking detection with green glow ring using Web Audio API frequency analysis
- Built inline call controls (mic/camera toggle) and mid-game join button

---

## v1.0 Social Features + Two-Player Mode (Shipped: 2026-03-13)

**Phases completed:** 9 phases, 23 plans, 2 tasks

**Timeline:** 7 days (2026-03-06 → 2026-03-12) | 147 commits | 5,721 LOC TypeScript

**Key accomplishments:**
- Fixed 8 game flow bugs establishing a stable baseline (animation targeting, host detection, board responsiveness, empty board placement)
- Added per-hand score history panel with running team totals accessible from the score bar
- Built rematch voting system with 4/4 consensus, live counter, and disconnect cancellation
- Shipped in-game chat with free text, emoji reactions, unread badges, and reconnect history
- Integrated WebRTC video/audio calling with lobby opt-in and collapsible side panel
- Added 2-player mode with boneyard draw mechanic, animated pile, and duo camera support

---


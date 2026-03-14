# Dominos PR

## What This Is

A real-time multiplayer Puerto Rican dominoes web app supporting 2 or 4 players. Players join via room codes, play with full Puerto Rican rules (Modo 200 / Modo 500), and see the game unfold on an animated snake board. Includes in-game chat, rematch voting, per-hand score history, WebRTC video/audio calling with circular live video avatars, and a 2-player mode with boneyard draw mechanics. Deployed as a PWA at a public HTTPS URL — installable from browser, no accounts needed, just share a code and play.

## Core Value

Friends can start and finish a complete game of Puerto Rican dominoes online, in real time, from any device — without friction.

## Requirements

### Validated

- ✓ Room creation and joining via room codes — existing
- ✓ 4-player real-time game via Socket.io — existing
- ✓ Full Puerto Rican domino rules (Modo 200 / Modo 500) — existing
- ✓ Auto-pass cascade and blocked game detection — existing
- ✓ Snake board layout with tile animations — existing
- ✓ Score tracking per round and per game — existing
- ✓ Player reconnection support (match by name) — existing
- ✓ Host management and promotion on disconnect — existing
- ✓ Bug fixes: animation targeting, host detection, selectedTileId clearing, static imports — v1.0
- ✓ Game flow bugs: next-game starter, hand starter, responsive board, empty board placement — v1.0
- ✓ Per-hand score history panel with running team totals — v1.0
- ✓ Rematch voting (4/4 consensus, live counter, disconnect cancellation) — v1.0
- ✓ In-game chat (text messages, emoji reactions, unread badges, reconnect history) — v1.0
- ✓ WebRTC video/audio calling with lobby opt-in — v1.0
- ✓ 2-player mode with boneyard draw mechanic — v1.0
- ✓ Boneyard visual pile with draw animation — v1.0
- ✓ Duo mode camera/mic (player-count-aware WebRTC) — v1.0
- ✓ Cloud deployment with HTTPS, health checks, and auto-deploy — v1.1
- ✓ Custom domain configuration guide — v1.1
- ✓ PWA installable from browser with standalone mode and branded icons — v1.1
- ✓ Circular live video avatars in player seat positions — v1.1
- ✓ Camera and mic toggle controls during gameplay — v1.1
- ✓ Speaking detection with visual glow indicator — v1.1

## Current Milestone: v1.2 Sound & Audio

**Goal:** Add audio feedback to make the game feel alive — tile sounds, turn/pass notifications, and ambient lobby music.

**Target features:**
- Tile clack sound effect on play
- Turn notification sound
- Pass sound effect
- Lo-fi background music in menu/lobby
- Separate toggles for music and SFX

### Active

- [ ] Sound effects for tile placement, turn notification, and pass events
- [ ] Lo-fi background music in menu and lobby screens
- [ ] Separate audio controls for music and SFX

### Out of Scope

- Persistent accounts / login — in-memory rooms are sufficient for casual play
- Native mobile app (App Store / Google Play) — deferred to future milestone
- Offline mode — real-time is core value
- Persistent chat history — in-memory is sufficient for casual play sessions
- Spectator mode — requires seat assignment changes
- TURN server — monitor post-deploy; add only if users report WebRTC connection failures

## Context

Shipped v1.1 with 6,132 LOC TypeScript across 12 phases (28 plans) in two milestones over 7 days.
Tech stack: React + Vite, Express + Socket.io, Zustand, WebRTC, TailwindCSS.
Monorepo: `client/` and `server/`, both TypeScript strict mode.
No REST API — all game state flows exclusively through Socket.io events.
Server is sole authority: game logic, scoring, and valid-move computation live only server-side.
Zero test coverage — pure functions in `GameEngine.ts` are ideal unit test targets when ready.
Deployed to Railway at https://server-production-b2a8.up.railway.app with auto-deploy from main.
PWA installable with service worker (socket.io and /health excluded from caching).

## Constraints

- **Tech Stack**: React + Socket.io + Zustand + Express + WebRTC — no new frameworks without clear justification
- **No persistence**: In-memory room state only; server restart loses active games (acceptable for current scope)
- **No auth**: Players identified by display name + socket ID; reconnection by name match
- **TypeScript strict**: Both client and server enforce `"strict": true`

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Video calling shipped in v1.0 | WebRTC complexity was manageable with Perfect Negotiation pattern and lobby opt-in UX | ✓ Good |
| Chat: text + emoji reactions | Free text for real conversation; 21 emoji for low-friction in-game response | ✓ Good |
| Score history: accumulated table | Simple running total is what players glance at during play | ✓ Good |
| Rematch: 4/4 consensus with cancellation | Ensures all players agree; disconnect cancels cleanly | ✓ Good |
| 2-player mode with boneyard | Draw mechanic adds strategic depth for smaller games | ✓ Good |
| Boneyard draw animation queue | One-at-a-time animation with 500ms pause builds tension like real table play | ✓ Good |
| ChatMessage type duplicated client/server | No shared types package; duplication is acceptable for 1 interface | ⚠️ Revisit if types grow |
| Rate limit 15/10s (not 5/10s) | Plan spec was incorrect; REQUIREMENTS.md authoritative at 15/10s | ✓ Good |
| playerCount default=4 with ?? fallback | Backward-compatible 2/4 layout without breaking existing code | ✓ Good |
| Railway for cloud hosting | WebSocket support, auto-HTTPS, no Dockerfile needed, GitHub auto-deploy | ✓ Good |
| CORS disabled in production | Same-origin serving from Express eliminates cross-origin requests | ✓ Good |
| vite-plugin-pwa for PWA | Single dev dependency, ~20 lines config, zero-maintenance generateSW | ✓ Good |
| Circular avatar cameras over side panel | Video in player avatar position is less intrusive than side panel; works better on mobile | ✓ Good |
| Speaking threshold 25 on first 8 FFT bins | Reliable speech frequency detection without over-sensitivity | ✓ Good |

---
*Last updated: 2026-03-14 after v1.2 milestone start*

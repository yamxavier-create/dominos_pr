# Dominos PR

## What This Is

A real-time multiplayer Puerto Rican dominoes web app for 4 players. Players join via room codes, play with full Puerto Rican rules (Modo 200 / Modo 500), and see the game unfold on an animated snake board. Built with React + Socket.io — no backend database, no accounts, just share a code and play.

## Core Value

Four friends can start and finish a complete game of Puerto Rican dominoes online, in real time, from any device — without friction.

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

### Active

- [ ] Bug fix: Tile animation targets wrong tile when played on left end of board
- [ ] Rematch in same room — play again without re-sharing room code
- [ ] In-game chat — free text messages + quick reactions (emojis/preset phrases)
- [ ] Running score history panel — accumulated team score visible during game

### Out of Scope

- Video calling (WebRTC) — high complexity; defer to next milestone after core features stabilize
- Persistent accounts / login — in-memory rooms are sufficient for casual play
- Mobile native app — web-first; mobile browser is acceptable for now

## Context

- Monorepo: `client/` (React + Vite) and `server/` (Express + Socket.io), both TypeScript strict mode
- No REST API — all game state flows exclusively through Socket.io events
- Server is sole authority: game logic, scoring, and valid-move computation live only server-side
- Codebase map at `.planning/codebase/` — architecture, stack, concerns, and known bugs documented
- Known tech debt in `CONCERNS.md`: `game:next_hand` starter bug (wrong player starts hand 2+), `selectedTileId` not cleared on turn change, reconnection name-only matching
- Zero test coverage — pure functions in `GameEngine.ts` are ideal unit test targets when ready

## Constraints

- **Tech Stack**: React + Socket.io + Zustand + Express — no new frameworks without clear justification
- **No persistence**: In-memory room state only; server restart loses active games (acceptable for v1)
- **No auth**: Players identified by display name + socket ID; reconnection by name match
- **TypeScript strict**: Both client and server enforce `"strict": true`

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Video calling deferred | WebRTC + STUN/TURN adds significant complexity; better to ship stable social features first | — Pending |
| Chat: text + quick reactions | Free text for real conversation; quick reactions for low-friction in-game response | — Pending |
| Score history: accumulated table only | Simple running total is what players actually glance at during play; per-hand detail is v2 | — Pending |

---
*Last updated: 2026-03-06 after initialization*

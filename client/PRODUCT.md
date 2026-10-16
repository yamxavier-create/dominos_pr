# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Puerto Ricans, on the island and in the diaspora, who play dominó the Puerto Rican way: 4 players in two partnerships (2-player is also supported). Today it is mainly family and friends who meet at a private table, often with the video call on, and fill empty seats with bots. The product is meant to grow to the general public through the App Store.

## Product Purpose

A real-time online Puerto Rican dominó table. Success is getting from opening the app to a game with your people in as few steps as possible, and a game that plays and scores the way the table expects.

## Positioning

- No retention economy: no coins, XP, crowns, roulette, missions, ads or calendar. You open it and play.
- House rules: each table chooses how it plays (tranque individual or en pareja, pass points, the tranque bonus, a tied tranque), plus a fixed Torneo mode based on the DRD reglamento.
- Private rooms by code (word + 3 digits, like `COQUI482`) or by inviting friends.

## Operating Context

- Mostly phones, upright and sideways, plus iPad and desktop. Installable PWA; a Capacitor build for the App Store is the next milestone.
- Players are often on a video call at the table while they play.
- Modes: Modo 200 (to 20 points, pips counted in tens, pass bonus), Modo 500 (hand bonuses, capicú and chuchazo +100), Torneo (200 points or 35 minutes).
- Accounts are optional (guest play); signed-in players get friends, invites, stats and ranking.

## Capabilities and Constraints

- Server is the authority: the client never computes scores or valid plays.
- Main menu actions that exist today: quick play (creates a room), create a room with a mode, join by code, friends, stats and ranking, profile and settings.
- **Jugar** creates a room in the mode picked on the round button next to it (200 → 500 → Torneo); the pick is remembered per device.

## Brand Commitments

- Name: Dominó PR. Spanish UI with Puerto Rican vocabulary (tranque, capicú, chuchazo, pase, salida, Nosotros/Ellos).
- Keep the green felt and gold palette (decided 2026-10-15).
- Clash Royale is the reference for the home screen's energy (glowing stage, centerpiece, play dock, idle animation), redone in green and gold (2026-10-16).
- Mesa28 is a style reference for button language only (thick 3D buttons, gold outlines, heavy rounded headings). It must not look like a copy of Mesa28, and it must not take its violet.
- The domino tiles stay white (ivory) by default.

## Evidence on Hand

- Mesa28 reference screens: `.planning/research/mesa28/screens/` with notes in `.planning/research/mesa28/README.md`.
- No testimonials, player counts or rankings to quote; do not invent them.

## Product Principles

1. Playing comes first: the fastest path to a table is the biggest thing on screen.
2. Less than Mesa28: every element on the menu earns its place; nothing that only exists to keep people hooked.
3. The table belongs to its players: house rules and private rooms over matchmaking with strangers.
4. Puerto Rican, not generic casino: the vocabulary and the feel come from how dominó is played in PR.

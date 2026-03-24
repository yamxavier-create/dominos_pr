# Dominó PR — App de Dominó en Tiempo Real

## Stack
Monorepo npm workspaces: `client/` (React + Vite + Zustand) y `server/` (Express + Socket.io). TypeScript strict en ambos.

## Comandos
```bash
npm run dev          # Client (5173) + Server (3001) concurrente
npm run build        # Build ambos workspaces
npm run start        # Production server (sirve client/dist/)
```

No hay test ni lint scripts. TypeScript strict mode es el check principal.

## Gotchas (no obvios del código)

- `PORT=3001` está hardcodeado en el script `dev` para evitar que tooling inyecte `PORT=5173`
- Si `EADDRINUSE`: `lsof -ti:3001,5173 | xargs kill -9`
- `vite.config.ts` tiene `host: '0.0.0.0'` — necesario para ngrok/LAN
- Google Fonts `@import` DEBE ser la primera línea de `client/src/index.css` (antes de `@tailwind`)

## Reglas de dominio críticas

- **4 jugadores siempre.** 7 fichas cada uno = 28 (set completo), boneyard vacío
- **Clockwise visual:** `nextPlayer = (current + 3) % 4` — bottom → right → top → left
- **Equipos:** 0 & 2 vs 1 & 3 (partners arriba/abajo, oponentes izq/der)
- **Server es autoridad absoluta.** Client nunca computa scores ni valid plays
- **No existe `game:pass` del client.** Server auto-pasa después de `game:play_tile`
- **Capicú + Chuchazo no stackean** — máximo +100 total (Modo 500)
- **Host-only:** `game:start`, `game:next_hand`, `game:next_game`

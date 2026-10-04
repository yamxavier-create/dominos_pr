# Dominó PR — App de Dominó en Tiempo Real

## Stack
Monorepo npm workspaces: `client/` (React + Vite + Zustand) y `server/` (Express + Socket.io). TypeScript strict en ambos.

## Comandos
```bash
npm run dev          # Client (5173) + Server (3001) concurrente
npm run build        # Build ambos workspaces
npm run start        # Production server (sirve client/dist/)
npm test             # Server (server/test/) + lógica pura del client (client/test/)
npm run test:e2e     # Llamada de video en Chromium con cámara y micrófono falsos (e2e/)
npm run test:db:setup --workspace=server   # Crea y migra la DB local dominos_pr_test (una vez)
```

No hay lint script. TypeScript strict mode más `npm test` son los checks principales.

- Los tests del server apuntan Prisma a una DB inalcanzable (`server/test/env.ts`). Los que necesitan DB (`auth`, `socialStats`) usan `dominos_pr_test` en localhost y se saltan con aviso si no existe. Nunca tocan Supabase.
- `test:e2e` levanta server (contra `dominos_pr_test`) y Vite en 3001/5173. En macOS la app de terminal necesita permiso de Cámara y Micrófono; sin él, `getUserMedia` se queda colgado aunque los dispositivos sean falsos.

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
- **Host-only:** `game:start`, `game:next_hand`, `game:next_game`, `room:back_to_lobby`
- **La llamada es de la sala, no de la partida.** `CallHost` (montado en `App` por `roomCode`) la mantiene desde el lobby hasta salir de la sala. Los peers se identifican por asiento; cada reindexado sube `room.callEpoch`, el client reconstruye la llamada y el server descarta señales de un epoch viejo

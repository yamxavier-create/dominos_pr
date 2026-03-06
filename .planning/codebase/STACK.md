# Technology Stack

**Analysis Date:** 2026-03-06

## Languages

**Primary:**
- TypeScript 5.3.x - Both client (`client/src/`) and server (`server/src/`)

**Secondary:**
- CSS (Tailwind utility classes) - Styling in `client/src/index.css` and component files

## Runtime

**Environment:**
- Node.js v25.7.0

**Package Manager:**
- npm 11.10.1
- Lockfile: present (`package-lock.json`)
- Workspace layout: `npm workspaces` with `client/` and `server/`

## Frameworks

**Core (Client):**
- React 18.2.0 - UI rendering, `client/src/App.tsx`
- React Router DOM 6.21.0 - Client-side routing (`/`, `/lobby`, `/game`)

**Core (Server):**
- Express 4.18.2 - HTTP server, static file serving in production, `server/src/index.ts`
- Socket.io 4.7.2 (server) - Real-time WebSocket communication, `server/src/index.ts`

**State Management:**
- Zustand 4.4.7 - Three client stores in `client/src/store/` (gameStore, roomStore, uiStore)

**Styling:**
- Tailwind CSS 3.4.0 - Utility-first CSS, config at `client/tailwind.config.ts`
- PostCSS 10.4.16 - CSS processing, config at `client/postcss.config.js`
- Google Fonts (Bebas Neue, Nunito) - Loaded via `@import` at top of `client/src/index.css`

**Testing:**
- None configured

**Build/Dev:**
- Vite 5.0.8 - Client dev server and bundler, config at `client/vite.config.ts`
- tsx 4.6.2 - TypeScript execution for server dev hot reload (`tsx watch`)
- concurrently 8.2.2 - Runs client and server dev processes in parallel (root `package.json`)

## Key Dependencies

**Critical:**
- `socket.io` 4.7.2 (server) + `socket.io-client` 4.7.2 (client) - All game state flows through Socket.io; there is no REST API
- `zustand` 4.4.7 - Sole client state management; three independent stores
- `react-router-dom` 6.21.0 - Route-based page navigation

**Infrastructure:**
- `cors` 2.8.5 - CORS handling in Express, configured via `CLIENT_ORIGIN` env var
- `dotenv` 16.3.1 - Environment variable loading in `server/src/config.ts`
- `@vitejs/plugin-react` 4.2.1 - React Fast Refresh in Vite dev mode

## Configuration

**Environment:**
- Configured via `server/src/config.ts` using `dotenv`
- Key env vars: `PORT` (default `3001`), `CLIENT_ORIGIN` (default `http://localhost:5173`), `NODE_ENV` (default `development`)
- No `.env` file present in repo; env vars must be set externally for deployment

**Build:**
- Client: `tsc && vite build` → `client/dist/` (ESNext modules)
- Server: `tsc` → `server/dist/` (CommonJS, target ES2020)
- TypeScript strict mode enabled in both `client/tsconfig.json` and `server/tsconfig.json`

**Dev Proxy:**
- Vite proxies `/socket.io` → `http://localhost:3001` (WebSocket upgrade included) — config in `client/vite.config.ts`
- `host: '0.0.0.0'` set in Vite config for ngrok/LAN access

## TypeScript Configuration

**Client (`client/tsconfig.json`):**
- `"strict": true`, `"noEmit": true`, `"module": "ESNext"`, `"moduleResolution": "bundler"`
- Target: ES2020, JSX: react-jsx

**Server (`server/tsconfig.json`):**
- `"strict": true`, `"module": "CommonJS"`, `"outDir": "./dist"`
- Target: ES2020

## Platform Requirements

**Development:**
- Node.js v20+ (types at `@types/node` ^20)
- Ports 3001 (server) and 5173 (client dev) must be available
- Kill both ports on address conflict: `lsof -ti:3001,5173 | xargs kill -9`

**Production:**
- Single Node.js process; Express serves `client/dist/` as static files
- Socket.io shares the same HTTP server — no separate origin/proxy needed
- `NODE_ENV=production` must be set to enable static file serving

---

*Stack analysis: 2026-03-06*

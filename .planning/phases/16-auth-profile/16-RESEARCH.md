# Phase 16: Auth & Profile - Research

**Researched:** 2026-04-02
**Domain:** Google OAuth integration, JWT auth persistence, profile management for real-time multiplayer game
**Confidence:** HIGH

## Summary

Phase 16 builds on a substantial existing scaffold. The server already has complete REST auth routes (`/api/auth/register`, `/login`, `/google`, `/me`, `/logout`), JWT signing/verification, Google token verification via `google-auth-library`, a Prisma User model with `googleId`/`avatarUrl`/`displayName` fields, and Socket.io auth middleware that cleanly separates guest vs authenticated users. The client has `authStore` (Zustand), `useAuth` hook with auto-login from localStorage, `AuthPage` with login/register forms, and a `GoogleLoginButton` placeholder component.

The two remaining gaps are: (1) the `GoogleLoginButton` is a placeholder -- it logs to console instead of invoking Google Identity Services, and (2) there is no profile update endpoint (PATCH for `displayName`). Both the Vite proxy for `/api` routes and the `VITE_GOOGLE_CLIENT_ID` env var are also missing and needed for the client to communicate with the server in dev mode.

**Primary recommendation:** Install `@react-oauth/google@0.13.4` on the client, wire the `GoogleOAuthProvider` at the app root, replace the placeholder `GoogleLoginButton` with a real `useGoogleLogin` implementation, add the `/api` proxy to Vite config, create a `PATCH /api/auth/profile` endpoint for display name editing, and build a minimal profile UI section in the MainMenu.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| AUTH-01 | User can complete Google OAuth login via the existing placeholder button | `@react-oauth/google` library wires GIS SDK; server `/api/auth/google` already verifies ID tokens via `google-auth-library`. Only the client-side button needs real implementation. |
| AUTH-02 | User can play as guest without logging in (current behavior preserved) | Socket auth middleware already falls through to guest mode when no token present. `useAuth` hook sets `loading: false` immediately if no saved token. Zero changes needed -- verify only. |
| AUTH-03 | Logged-in user's identity persists across browser refresh (JWT + localStorage) | `authStore.setAuth()` already saves to localStorage; `useAuth` useEffect already calls `/api/auth/me` on mount to restore session. Already works -- verify only. |
| PROF-01 | User can edit their display name after registration | **Gap found:** No `PATCH /api/auth/profile` endpoint exists. Must create endpoint + client UI (inline edit or modal in profile section). |
| PROF-02 | User's avatar displays from Google account or default placeholder | Server already saves `profile.picture` to `avatarUrl` on Google OAuth. Client `authStore` already carries `avatarUrl`. Need UI component to display avatar image or fallback initial. |
</phase_requirements>

## Standard Stack

### Core (Already Installed)
| Library | Version | Purpose | Status |
|---------|---------|---------|--------|
| `google-auth-library` | 10.6.2 | Server-side Google ID token verification | Installed, working |
| `jsonwebtoken` | 9.0.3 | JWT sign/verify for session tokens | Installed, working |
| `bcryptjs` | 3.0.3 | Password hashing (register/login) | Installed, working |
| `@prisma/client` | 7.5.0 | ORM for User, Session models | Installed, schema defined |
| `zustand` | 4.4.7 | Client state (authStore exists) | Installed, working |

### New Dependency (Must Install)
| Library | Version | Purpose | Why |
|---------|---------|---------|-----|
| `@react-oauth/google` | 0.13.4 | React wrapper for Google Identity Services SDK | Renders Sign-In button, handles popup flow, returns `credential` (ID token JWT) for server verification. Existing research identified this as the standard approach. |

**Version verified:** `npm view @react-oauth/google version` returns `0.13.4` (published ~3 months ago as of 2026-04-02).

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `@react-oauth/google` | Raw GIS SDK (`accounts.google.com/gsi/client` script tag) | More control, but requires manual script loading, callback wiring, TypeScript types. The React wrapper handles all of this. |
| `@react-oauth/google` | `react-google-login` (deprecated) | This was the old library. Google deprecated it. Do not use. |

**Installation:**
```bash
cd client && npm install @react-oauth/google@0.13.4
```

## Architecture Patterns

### Existing File Map (What Already Exists)

```
server/src/
  auth/
    authRoutes.ts        # REST: register, login, google, me, logout (COMPLETE)
    google.ts            # verifyGoogleToken using google-auth-library (COMPLETE)
    jwt.ts               # signToken, verifyToken with 7-day expiry (COMPLETE)
    passwordUtils.ts     # hashPassword, comparePassword (COMPLETE)
  socket/
    authMiddleware.ts    # Socket auth: token -> user or guest (COMPLETE)
  db/
    prisma.ts            # PrismaClient with @prisma/adapter-pg (COMPLETE)
  config.ts              # GOOGLE_CLIENT_ID, JWT_SECRET from env (COMPLETE)

client/src/
  store/authStore.ts     # Zustand: user, token, isAuthenticated, loading (COMPLETE)
  hooks/useAuth.ts       # Auto-login, register, login, loginWithGoogle, logout (COMPLETE)
  socket.ts              # setSocketAuth(token) helper (COMPLETE)
  pages/AuthPage.tsx     # Login/Register/Google forms (COMPLETE layout)
  components/auth/
    LoginForm.tsx         # Username/password form (COMPLETE)
    RegisterForm.tsx      # Username/password/displayName form (COMPLETE)
    GoogleLoginButton.tsx # PLACEHOLDER -- only logs to console, needs real GIS integration
```

### What Must Be Built

```
server/src/auth/authRoutes.ts    # ADD: PATCH /api/auth/profile endpoint
client/vite.config.ts            # ADD: /api proxy to localhost:3001
client/src/main.tsx              # WRAP: GoogleOAuthProvider around App
client/src/components/auth/
  GoogleLoginButton.tsx          # REPLACE: placeholder with real useGoogleLogin
client/src/components/auth/
  ProfileSection.tsx             # NEW: avatar display + display name edit
client/src/pages/MenuPage.tsx    # MODIFY: show ProfileSection for authenticated users
```

### Pattern 1: Google OAuth Credential Flow

**What:** Client uses `@react-oauth/google`'s `useGoogleLogin` or `GoogleLogin` component. On success, the credential response contains `credential` (a Google ID token JWT). Client sends this to `POST /api/auth/google` where `google-auth-library` verifies it and returns app JWT + user data.

**When to use:** When the Google login button is tapped.

**Flow:**
```
User taps "Continue with Google"
  -> @react-oauth/google opens Google popup
  -> User selects Google account
  -> Google returns credentialResponse.credential (ID token)
  -> Client POSTs { idToken: credential } to /api/auth/google
  -> Server verifies with google-auth-library
  -> Server creates/finds user, returns { token, user }
  -> Client calls setAuth(user, token) + setSocketAuth(token)
  -> Socket disconnects and reconnects with token
```

**Example (client):**
```typescript
// Source: @react-oauth/google docs + existing useAuth hook
import { useGoogleLogin } from '@react-oauth/google'

// Option A: useGoogleLogin with popup (custom button, returns credential)
const googleLogin = useGoogleLogin({
  onSuccess: async (credentialResponse) => {
    // credentialResponse.credential is the Google ID token
    await loginWithGoogle(credentialResponse.credential)
    navigate('/')
  },
  onError: () => setError('Error con Google'),
  flow: 'implicit',  // default -- returns credential directly
})

// Option B: GoogleLogin component (Google-styled button)
<GoogleLogin
  onSuccess={(credentialResponse) => {
    handleGoogleLogin(credentialResponse.credential!)
  }}
  onError={() => setError('Error con Google')}
  theme="filled_black"
  size="large"
  text="continue_with"
/>
```

**Important note on flow types:** The `GoogleLogin` component uses the Sign In With Google button which returns an ID token directly in `credentialResponse.credential`. The `useGoogleLogin` hook with `flow: 'implicit'` returns an access token, NOT an ID token. For this project, use `GoogleLogin` component (not `useGoogleLogin`) because the server expects an ID token for `verifyGoogleToken()`.

### Pattern 2: Socket Reconnect After Auth State Change

**What:** After login/register/logout, the socket must disconnect and reconnect so the auth middleware picks up the new token (or lack thereof).

**When to use:** Every time auth state changes.

**Already implemented in `useAuth.ts`:**
```typescript
// setAuth calls setSocketAuth(token) which sets socket.auth = { token }
// Then: if (socket.connected) { socket.disconnect(); socket.connect() }
```

**Gap found:** The logout function calls `setSocketAuth(null)` but does NOT call `socket.disconnect()`. This means the socket keeps its old authenticated identity after logout until the next natural reconnection. Must add `socket.disconnect(); socket.connect()` to handleLogout.

### Pattern 3: Profile Update (REST)

**What:** Authenticated user can update their display name via `PATCH /api/auth/profile`.

**Example (server endpoint to create):**
```typescript
// PATCH /api/auth/profile
router.patch('/profile', async (req: Request, res: Response) => {
  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'No token provided' })
    return
  }
  const token = authHeader.slice(7)
  const payload = verifyToken(token)

  const { displayName } = req.body
  if (!displayName || typeof displayName !== 'string') {
    res.status(400).json({ error: 'Display name is required' })
    return
  }
  const sanitized = displayName.trim().slice(0, 20)
  if (sanitized.length < 1) {
    res.status(400).json({ error: 'Display name too short' })
    return
  }

  const user = await prisma.user.update({
    where: { id: payload.sub },
    data: { displayName: sanitized },
    select: { id: true, username: true, displayName: true, avatarUrl: true },
  })
  res.json({ user })
})
```

### Anti-Patterns to Avoid

- **Do NOT use `useGoogleLogin` hook with `flow: 'implicit'` for backend auth.** It returns an access token, not an ID token. The server's `verifyGoogleToken()` expects an ID token. Use the `GoogleLogin` component which returns `credential` (ID token) directly.
- **Do NOT allow login during an active game.** Login button should only be accessible from MenuPage. During a game, the socket identity is frozen.
- **Do NOT create a separate profile page with routing.** A profile section within the existing MenuPage is sufficient for v1.3. Keeps the app simple.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Google Sign-In button | Manual `<script>` tag + `google.accounts.id.initialize()` | `@react-oauth/google` GoogleLogin component | Handles script loading, TypeScript types, callback wiring, popup blocked detection |
| Google ID token verification | Manual JWT decoding + public key fetch | `google-auth-library` `verifyIdToken()` | Already handles key rotation, audience check, expiry, iss validation |
| Auth state persistence | Custom cookie/session logic | Existing JWT in localStorage + `/api/auth/me` on mount | Already built and working in `useAuth.ts` |
| Socket auth propagation | Manual token refresh on socket events | Existing `setSocketAuth()` + disconnect/reconnect pattern | Already built in `socket.ts` + `useAuth.ts` |

**Key insight:** 80% of this phase is already built. The primary work is wiring the last mile: real Google button, profile editing UI, and fixing the few gaps (Vite proxy, logout disconnect, profile endpoint).

## Common Pitfalls

### Pitfall 1: Vite Dev Proxy Missing for /api Routes
**What goes wrong:** In development, `useAuth.ts` calls `fetch('/api/auth/...')` with `VITE_API_URL` defaulting to `''` (same origin = port 5173). But the Vite proxy only forwards `/socket.io` to port 3001. All REST API calls fail with 404 in development.
**Why it happens:** The proxy was set up for Socket.io when the game was built but never extended for REST routes (auth was added later).
**How to avoid:** Add `/api` proxy to `vite.config.ts`:
```typescript
proxy: {
  '/socket.io': { target: 'http://localhost:3001', ws: true, changeOrigin: true },
  '/api': { target: 'http://localhost:3001', changeOrigin: true },
}
```
**Warning signs:** Auth forms showing errors in dev but working in production (same-origin serving).

### Pitfall 2: GoogleLogin Component Returns credential as Undefined
**What goes wrong:** The `credentialResponse.credential` field is `undefined` when using `useGoogleLogin` hook with implicit flow. The code sends `undefined` to the server which rejects it.
**Why it happens:** `useGoogleLogin` with implicit flow returns an access token in `tokenResponse.access_token`, NOT a credential. Only the `GoogleLogin` component (Sign In With Google button) returns the ID token in `credential`.
**How to avoid:** Use the `GoogleLogin` component, not `useGoogleLogin` hook. The existing server expects an ID token (`verifyGoogleToken(idToken)`). If you want a custom button, use `useGoogleLogin` with `flow: 'auth-code'` and exchange the code server-side (more complex, unnecessary for this app).

### Pitfall 3: Google OAuth Fails Silently Without GOOGLE_CLIENT_ID
**What goes wrong:** The `GoogleLoginButton` reads `VITE_GOOGLE_CLIENT_ID` from env. If not set, it returns `null` (renders nothing). User sees no Google button and has no idea why.
**Why it happens:** The `.env` file has `GOOGLE_CLIENT_ID=""` on the server, and no `VITE_GOOGLE_CLIENT_ID` is configured anywhere for the client.
**How to avoid:** Set up Google Cloud Console OAuth credentials first. Add `VITE_GOOGLE_CLIENT_ID=<client_id>` to a `client/.env.local` file (gitignored). Add the same `GOOGLE_CLIENT_ID` to `server/.env`. Add both to Railway env vars for production.
**Warning signs:** Google button completely missing from the auth page.

### Pitfall 4: Logout Doesn't Disconnect Socket (Known Bug)
**What goes wrong:** After logout, the socket retains authenticated identity because `handleLogout` in `useAuth.ts` calls `setSocketAuth(null)` but never disconnects the socket. The next socket event still carries the old `socket.data.user`.
**Why it happens:** `setSocketAuth(null)` only sets `socket.auth = {}` for the NEXT connection. It does not affect the current live connection's `socket.data`.
**How to avoid:** Add `socket.disconnect(); socket.connect()` after `setSocketAuth(null)` in the logout handler. Same pattern already used in the login flow.

### Pitfall 5: Display Name XSS via Google Profile
**What goes wrong:** Google returns arbitrary UTF-8 in `profile.name`. If rendered as `dangerouslySetInnerHTML` or in an unescaped context, it could be an XSS vector.
**Why it happens:** No server-side sanitization of Google-provided names.
**How to avoid:** React's JSX automatically escapes text content, so `{user.displayName}` is safe. Additionally, sanitize on the server: strip HTML, limit length (20 chars), validate no control characters. Apply in the profile update endpoint AND in the Google OAuth user creation flow.

## Code Examples

Verified patterns from existing codebase and official sources:

### GoogleOAuthProvider Setup (main.tsx)
```typescript
// Source: @react-oauth/google official docs
import { GoogleOAuthProvider } from '@react-oauth/google'

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || ''

ReactDOM.createRoot(document.getElementById('root')!).render(
  <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
    <App />
  </GoogleOAuthProvider>
)
```

### GoogleLogin Button (replacing placeholder)
```typescript
// Source: @react-oauth/google docs + existing GoogleLoginButton.tsx pattern
import { GoogleLogin, CredentialResponse } from '@react-oauth/google'

export function GoogleLoginButton({ onGoogleLogin }: { onGoogleLogin: (idToken: string) => Promise<void> }) {
  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID
  if (!googleClientId) return null

  const handleSuccess = async (credentialResponse: CredentialResponse) => {
    if (credentialResponse.credential) {
      await onGoogleLogin(credentialResponse.credential)
    }
  }

  return (
    <div className="flex justify-center">
      <GoogleLogin
        onSuccess={handleSuccess}
        onError={() => console.error('[Auth] Google login failed')}
        theme="filled_black"
        size="large"
        text="continue_with"
        width={320}
      />
    </div>
  )
}
```

### Avatar Display with Fallback
```typescript
// Source: existing MainMenu.tsx pattern for user badge
function Avatar({ user, size = 32 }: { user: AuthUser; size?: number }) {
  if (user.avatarUrl) {
    return (
      <img
        src={user.avatarUrl}
        alt={user.displayName}
        className="rounded-full object-cover"
        style={{ width: size, height: size }}
        referrerPolicy="no-referrer" // Required for Google profile pics
      />
    )
  }
  return (
    <div
      className="rounded-full bg-green-500/20 border border-green-500/40 flex items-center justify-center font-bold text-green-400"
      style={{ width: size, height: size, fontSize: size * 0.4 }}
    >
      {user.displayName[0]?.toUpperCase()}
    </div>
  )
}
```

**Note:** Google profile picture URLs require `referrerPolicy="no-referrer"` or they may return 403. This is a well-known Google CDN behavior.

### Profile Update (client-side)
```typescript
// Source: follows existing useAuth.ts apiCall pattern
async function updateProfile(displayName: string, token: string) {
  const res = await fetch(`${API_BASE}/api/auth/profile`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ displayName }),
  })
  if (!res.ok) {
    const data = await res.json()
    throw new Error(data.error || 'Update failed')
  }
  return res.json()
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `react-google-login` package | `@react-oauth/google` (GIS SDK wrapper) | 2022+ (Google deprecated old Sign-In) | Old library no longer works. Must use GIS-based library. |
| Google Sign-In `gapi.auth2` | Google Identity Services `accounts.google.com/gsi/client` | March 2023 (deprecated) | `gapi.auth2` fully removed. All new implementations must use GIS. |
| Store tokens in cookies | JWT in localStorage + HTTP-only considerations | Ongoing debate | For this app (casual game, no sensitive data beyond email), localStorage is fine. The project already uses this pattern. |

## Open Questions

1. **Google Cloud Console OAuth Setup**
   - What we know: `GOOGLE_CLIENT_ID` is empty in the server `.env`. The app needs a real Google OAuth Client ID.
   - What's unclear: Whether Yamir has already created the Google Cloud project and OAuth credentials. Authorized JavaScript origins need the Railway URL and `localhost:5173` for dev.
   - Recommendation: This is a setup step before coding. Document as a prerequisite in the plan. Google Cloud Console > APIs & Services > Credentials > Create OAuth Client ID > Web application. Add `http://localhost:5173` and the Railway production URL as authorized origins.

2. **Google OAuth Consent Screen Mode**
   - What we know: Google OAuth apps start in "Testing" mode (limited to 100 manually added test users). For a casual game app, this may be fine initially.
   - What's unclear: Whether the app needs verification for broader rollout.
   - Recommendation: Stay in Testing mode for v1.3. Only profile/email scopes are needed (non-sensitive). If more than 100 users need Google login, submit for verification later.

3. **Profile Section Placement**
   - What we know: The MainMenu already shows a user badge (avatar initial + display name) when authenticated. PROF-01 requires editing display name. PROF-02 requires showing the avatar.
   - What's unclear: Exact UI treatment -- inline edit in the existing badge area, or a separate profile section/modal.
   - Recommendation: Expand the existing user badge area in MainMenu to include a tap-to-edit display name and show the Google avatar image. Keep it minimal -- no separate page or route.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | None (no test framework configured) |
| Config file | none -- see Wave 0 |
| Quick run command | `cd server && npx tsc --noEmit && cd ../client && npx tsc --noEmit` |
| Full suite command | TypeScript strict mode compilation only |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| AUTH-01 | Google OAuth login completes and returns JWT | manual-only | Manual: tap Google button, complete flow, verify redirect to menu | N/A |
| AUTH-02 | Guest can play without login prompt | manual-only | Manual: open app fresh, create room, start game -- no auth prompt | N/A |
| AUTH-03 | Logged-in user persists on refresh | manual-only | Manual: login, refresh browser, verify still logged in | N/A |
| PROF-01 | Display name editable | manual-only | Manual: change display name in profile, verify persists on refresh | N/A |
| PROF-02 | Avatar shows Google picture or fallback | manual-only | Manual: login with Google, verify profile pic shows; check guest shows initial | N/A |

**Justification for manual-only:** No test framework exists in this project. TypeScript strict compilation is the only automated check. All auth requirements involve browser OAuth flows, localStorage, and socket reconnection that require a live browser environment.

### Sampling Rate
- **Per task commit:** `cd server && npx tsc --noEmit && cd ../client && npx tsc --noEmit`
- **Per wave merge:** Same + manual smoke test of login/guest/refresh flows
- **Phase gate:** All 5 success criteria manually verified

### Wave 0 Gaps
- No test framework exists -- this is consistent with the entire project (CLAUDE.md: "No hay test ni lint scripts")
- Not introducing a test framework for this phase -- would be scope creep

## Sources

### Primary (HIGH confidence)
- **Existing codebase analysis** -- `server/src/auth/authRoutes.ts`, `server/src/auth/google.ts`, `server/src/auth/jwt.ts`, `server/src/socket/authMiddleware.ts`, `client/src/store/authStore.ts`, `client/src/hooks/useAuth.ts`, `client/src/components/auth/GoogleLoginButton.tsx`, `client/src/socket.ts`, `client/src/App.tsx`, `client/src/pages/AuthPage.tsx`, `client/src/pages/MenuPage.tsx`, `client/vite.config.ts`, `server/prisma/schema.prisma`, `server/.env`
- **`.planning/research/` directory** -- SUMMARY.md, PITFALLS.md, ARCHITECTURE.md (researched 2026-03-25)
- **npm registry** -- `@react-oauth/google@0.13.4` (verified via `npm view`)
- **npm registry** -- `google-auth-library@10.6.2` (verified via `npm view`)

### Secondary (MEDIUM confidence)
- [Google Identity Services Web guides](https://developers.google.com/identity/gsi/web/guides/verify-google-id-token) -- ID token verification flow
- [@react-oauth/google GitHub](https://github.com/MomenSherif/react-oauth) -- GoogleLogin component, useGoogleLogin hook, CredentialResponse type
- [@react-oauth/google npm](https://www.npmjs.com/package/@react-oauth/google) -- Version, dependencies, publish date

### Tertiary (LOW confidence)
- None -- all findings verified against codebase and official sources

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all server-side libraries already installed and verified working; only client addition (`@react-oauth/google`) is well-established
- Architecture: HIGH -- 80%+ of the code already exists; gaps are clearly identified and small in scope
- Pitfalls: HIGH -- pitfalls identified from actual codebase analysis (Vite proxy gap, logout bug, credential vs token confusion), not theoretical

**Research date:** 2026-04-02
**Valid until:** 2026-05-02 (stable domain, no fast-moving dependencies)

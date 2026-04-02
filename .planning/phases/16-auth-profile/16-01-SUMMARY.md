---
phase: 16-auth-profile
plan: 01
subsystem: auth
tags: [google-oauth, react-oauth, vite-proxy, jwt, socket-auth]

# Dependency graph
requires:
  - phase: pre-existing
    provides: server auth routes (register, login, google, me, logout), authStore, useAuth hook, socket auth middleware
provides:
  - Real Google Sign-In button using @react-oauth/google
  - Vite dev proxy for /api routes to backend
  - GoogleOAuthProvider wrapper at app root
  - Fixed logout socket disconnect clearing authenticated identity
affects: [16-02-PLAN (profile/avatar), future social features requiring auth]

# Tech tracking
tech-stack:
  added: ["@react-oauth/google@0.13.4"]
  patterns: ["GoogleOAuthProvider at root, env-gated GoogleLogin component"]

key-files:
  created: []
  modified:
    - client/vite.config.ts
    - client/src/main.tsx
    - client/src/components/auth/GoogleLoginButton.tsx
    - client/src/hooks/useAuth.ts

key-decisions:
  - "Used GoogleLogin component (not useGoogleLogin hook) to get ID token for server verification"
  - "Env-gated: GoogleLoginButton returns null when VITE_GOOGLE_CLIENT_ID is not set"

patterns-established:
  - "OAuth provider wraps App inside StrictMode in main.tsx"
  - "Logout always disconnects+reconnects socket to clear server-side identity"

requirements-completed: [AUTH-01, AUTH-02, AUTH-03]

# Metrics
duration: 3min
completed: 2026-04-02
---

# Phase 16 Plan 01: Google OAuth Client Wiring Summary

**Real Google Sign-In via @react-oauth/google with /api dev proxy and fixed logout socket disconnect**

## Performance

- **Duration:** 3 min
- **Started:** 2026-04-02T21:59:38Z
- **Completed:** 2026-04-02T22:02:12Z
- **Tasks:** 2
- **Files modified:** 5 (+ package-lock.json, dist rebuild)

## Accomplishments
- Installed @react-oauth/google and replaced placeholder GoogleLoginButton with real GoogleLogin component that returns ID tokens
- Added /api proxy to Vite dev server so auth API calls reach localhost:3001
- Wrapped App with GoogleOAuthProvider reading VITE_GOOGLE_CLIENT_ID from env
- Fixed logout bug: socket now disconnects and reconnects without auth token, clearing server-side identity

## Task Commits

Each task was committed atomically:

1. **Task 1: Install @react-oauth/google, add /api proxy, wrap GoogleOAuthProvider, replace GoogleLoginButton** - `eaec21d` (feat)
2. **Task 2: Fix logout socket disconnect bug** - `27a82fc` (fix)
3. **Dist rebuild** - `1d33d28` (chore)

**Plan metadata:** (pending final commit)

## Files Created/Modified
- `client/package.json` - Added @react-oauth/google@0.13.4 dependency
- `client/vite.config.ts` - Added /api proxy entry to dev server config
- `client/src/main.tsx` - GoogleOAuthProvider wrapper + VITE_GOOGLE_CLIENT_ID env read
- `client/src/components/auth/GoogleLoginButton.tsx` - Real GoogleLogin component replacing placeholder
- `client/src/hooks/useAuth.ts` - socket.disconnect() + socket.connect() on logout

## Decisions Made
- Used GoogleLogin component (not useGoogleLogin hook) because it returns an ID token in credentialResponse.credential, which the server's verifyGoogleToken() expects. The hook's implicit flow returns an access token instead.
- GoogleLoginButton is env-gated: returns null when VITE_GOOGLE_CLIENT_ID is not set, preserving guest-only experience.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required

Google OAuth requires manual configuration before the Google Sign-In button will appear:

**Environment variables needed:**
- `VITE_GOOGLE_CLIENT_ID` in `client/.env` - Google Cloud Console > APIs & Services > Credentials > OAuth 2.0 Client IDs > Web application > Client ID
- `GOOGLE_CLIENT_ID` in `server/.env` - Same value as VITE_GOOGLE_CLIENT_ID

**Google Cloud Console configuration:**
- Create OAuth 2.0 Client ID (Web application type)
- Add authorized JavaScript origins: `http://localhost:5173` and production Railway URL

Without these configured, the Google button returns null (hidden) and the app works in guest-only mode.

## Next Phase Readiness
- Auth flow is end-to-end functional: Google login, JWT persistence on refresh, clean logout
- Ready for 16-02 (profile display, avatar, username management)
- Google OAuth credentials must be configured by the user for the button to appear

## Self-Check: PASSED

All files exist, all commits verified.

---
*Phase: 16-auth-profile*
*Completed: 2026-04-02*

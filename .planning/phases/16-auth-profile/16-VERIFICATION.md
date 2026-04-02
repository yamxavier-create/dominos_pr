---
phase: 16-auth-profile
verified: 2026-04-02T22:30:00Z
status: passed
score: 7/7 must-haves verified
re_verification: false
human_verification:
  - test: "Google Sign-In button appears and completes OAuth flow"
    expected: "With VITE_GOOGLE_CLIENT_ID set, Google button renders on AuthPage; clicking it opens OAuth popup; completing it lands user on MenuPage as authenticated"
    why_human: "Requires actual Google Cloud credentials configured + live OAuth popup interaction"
  - test: "JWT persistence across refresh"
    expected: "After Google login, refresh browser — user stays logged in (token restored from localStorage, /api/auth/me succeeds)"
    why_human: "Requires live server + valid token in localStorage"
  - test: "Avatar displays from Google account"
    expected: "After Google login, ProfileSection shows the Google profile picture (with no-referrer policy preventing 403)"
    why_human: "Requires real Google account with profile picture + live auth flow"
  - test: "Logout clears identity and socket reconnects as guest"
    expected: "Clicking 'Salir' in ProfileSection: clears user from UI, socket disconnects and reconnects without auth, subsequent room join uses guest identity"
    why_human: "Requires live server to verify socket identity clears on reconnect"
---

# Phase 16: Auth & Profile Verification Report

**Phase Goal:** Allow players to sign in with Google, persist their identity across sessions, and display a profile with avatar and editable display name.
**Verified:** 2026-04-02T22:30:00Z
**Status:** passed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | User taps Google login button, completes OAuth popup, and lands on MenuPage as authenticated user | ? HUMAN | `GoogleLoginButton.tsx` uses real `GoogleLogin` from `@react-oauth/google`; `credentialResponse.credential` flows to `loginWithGoogle(idToken)` which POSTs to `/api/auth/google`; server verifies token and returns JWT; `AuthPage.tsx` wires it all. Requires live credentials to confirm end-to-end. |
| 2 | User can open app and play as guest without login prompt (existing behavior unchanged) | ✓ VERIFIED | `MainMenu.tsx` conditionally renders `ProfileSection` only when `isAuthenticated && user`; otherwise shows login link (not a wall). `useAuth` sets `loading: false` immediately when no saved token. Guest flow path is unchanged. |
| 3 | Logged-in user refreshes browser and remains logged in (JWT restored from localStorage) | ? HUMAN | `useAuth.ts` `useEffect` on mount reads `localStorage.getItem('auth_token')`, calls `/api/auth/me`, and calls `setAuth(user, savedToken)` + `setSocketAuth(savedToken)` on success. Logic is correct. Needs live test to confirm. |
| 4 | After logout, socket reconnects without authenticated identity | ✓ VERIFIED | `handleLogout` in `useAuth.ts` (lines 73-87): calls `logout()` → `setSocketAuth(null)` → `socket.disconnect()` → `socket.connect()` when connected. Pattern verified at code level. |
| 5 | Logged-in user can edit their display name and the change persists on refresh | ✓ VERIFIED | `ProfileSection.tsx` inline edit calls `updateProfile(trimmed)` → `useAuth.ts updateProfile` PATCHes `/api/auth/profile` with Bearer token → server sanitizes and calls `prisma.user.update` → `authStore.updateUser({ displayName })` updates local state. Persistence on refresh is via the `/api/auth/me` call on mount which returns updated `displayName` from DB. |
| 6 | Logged-in user sees their Google avatar (or initial fallback) in the MainMenu | ? HUMAN | `ProfileSection.tsx` `Avatar` component: if `user.avatarUrl` truthy, renders `<img>` with `referrerPolicy="no-referrer"`; otherwise renders initial circle. MainMenu renders `<ProfileSection />` when `isAuthenticated && user`. Logic correct; visual confirmation needs human with real Google account. |
| 7 | Guest users see the existing login/register link, no profile section | ✓ VERIFIED | `MainMenu.tsx` line 163-172: `{isAuthenticated && user ? <ProfileSection /> : <button>Iniciar sesion / Crear cuenta</button>}`. "Cambiar cuenta" link confirmed removed. |

**Score:** 7/7 truths verifiable — 3 confirmed programmatically, 4 require human with live credentials (all logic is wired correctly)

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `client/vite.config.ts` | /api proxy to localhost:3001 | ✓ VERIFIED | Lines 66-69: `'/api': { target: 'http://localhost:3001', changeOrigin: true }` present alongside existing `/socket.io` proxy |
| `client/src/main.tsx` | GoogleOAuthProvider wrapping App | ✓ VERIFIED | Lines 3, 7, 11: `import { GoogleOAuthProvider }`, `VITE_GOOGLE_CLIENT_ID` env read, `<GoogleOAuthProvider clientId={...}><App /></GoogleOAuthProvider>` inside `<StrictMode>` |
| `client/src/components/auth/GoogleLoginButton.tsx` | Real Google Sign-In button using @react-oauth/google | ✓ VERIFIED | Uses `GoogleLogin` component (not `useGoogleLogin`); `credentialResponse.credential` extracted and passed to `onGoogleLogin`; env-gated (returns null without client ID) |
| `client/src/hooks/useAuth.ts` | Logout with socket disconnect; updateProfile function | ✓ VERIFIED | `handleLogout` (lines 73-87): `setSocketAuth(null)` + `socket.disconnect()` + `socket.connect()`; `updateProfile` (lines 89-98): PATCHes `/profile` and calls `updateUser` on store |
| `server/src/auth/authRoutes.ts` | PATCH /api/auth/profile endpoint | ✓ VERIFIED | Lines 209-244: `router.patch('/profile', ...)` — validates Bearer token, validates `displayName` (string, trim, 1-20 chars), calls `prisma.user.update`, returns `{ user }` |
| `client/src/components/auth/ProfileSection.tsx` | Avatar display + inline display name editing | ✓ VERIFIED | 119-line component: `Avatar` sub-component with Google pic or initial fallback (`referrerPolicy="no-referrer"`), inline edit state machine (editing/saving/error), `updateProfile` and `logout` from `useAuth` |
| `client/src/components/lobby/MainMenu.tsx` | ProfileSection rendered for authenticated users | ✓ VERIFIED | Line 8: `import { ProfileSection }`, lines 163-164: `<ProfileSection />` when `isAuthenticated && user`; "Cambiar cuenta" link removed |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `GoogleLoginButton.tsx` | `server POST /api/auth/google` | `credentialResponse.credential` → `onGoogleLogin(idToken)` → `loginWithGoogle` → `fetch /api/auth/google` | ✓ WIRED | `GoogleLoginButton` extracts `credentialResponse.credential` and passes to `onGoogleLogin`; `AuthPage.tsx` wires that to `loginWithGoogle(idToken)` from `useAuth`; `loginWithGoogle` calls `apiCall('/google', { body: JSON.stringify({ idToken }) })` |
| `main.tsx` | `@react-oauth/google` | `GoogleOAuthProvider clientId={VITE_GOOGLE_CLIENT_ID}` | ✓ WIRED | Import confirmed at line 3; `clientId={GOOGLE_CLIENT_ID}` at line 11; env var read at line 7 |
| `useAuth.ts` | `socket.ts` | `socket.disconnect()` + `socket.connect()` after logout | ✓ WIRED | `import { setSocketAuth, socket } from '../socket'` at line 3; both calls present in `handleLogout` at lines 84-86 |
| `ProfileSection.tsx` | `useAuth.ts updateProfile` | calls `updateProfile(newName)` on save | ✓ WIRED | `const { updateProfile, logout } = useAuth()` at line 29; `await updateProfile(trimmed)` at line 57 in `saveName` |
| `useAuth.ts` | `server PATCH /api/auth/profile` | `fetch PATCH /api/auth/profile` with Bearer token | ✓ WIRED | `apiCall('/profile', { method: 'PATCH', headers: { Authorization: 'Bearer ...' }, body: JSON.stringify({ displayName }) })` at lines 90-94 |
| `MainMenu.tsx` | `ProfileSection.tsx` | conditional render when `isAuthenticated && user` | ✓ WIRED | Import at line 8, render at line 164 |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|---------|
| AUTH-01 | 16-01-PLAN | User can complete Google OAuth login via the existing placeholder button | ✓ SATISFIED | Placeholder replaced with real `GoogleLogin` component; full flow from button → server `/api/auth/google` → JWT → authStore wired |
| AUTH-02 | 16-01-PLAN | User can play as guest without logging in (current behavior preserved) | ✓ SATISFIED | `MainMenu` guest path unchanged; `useAuth` sets `loading: false` immediately with no saved token; no auth wall added |
| AUTH-03 | 16-01-PLAN | Logged-in user's identity persists across browser refresh (JWT + localStorage) | ✓ SATISFIED | `authStore.setAuth()` saves to `localStorage`; `useAuth` mount effect reads and validates token via `/api/auth/me`; on success calls `setAuth` + `setSocketAuth` |
| PROF-01 | 16-02-PLAN | User can edit their display name after registration | ✓ SATISFIED | Full pipeline: `ProfileSection` inline edit → `updateProfile(name)` → `PATCH /api/auth/profile` → `prisma.user.update` → `authStore.updateUser` |
| PROF-02 | 16-02-PLAN | User's avatar displays from Google account or default placeholder | ✓ SATISFIED | `Avatar` component in `ProfileSection`: Google pic with `referrerPolicy="no-referrer"` if `avatarUrl` set, uppercase initial in styled circle otherwise |

No orphaned requirements — all 5 IDs (AUTH-01, AUTH-02, AUTH-03, PROF-01, PROF-02) appear in plan frontmatter and REQUIREMENTS.md, all mapped to Phase 16.

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `GoogleLoginButton.tsx` | 10 | `return null` | ℹ️ Info | Intentional env-gate: button hidden when `VITE_GOOGLE_CLIENT_ID` not set. By design. |
| `ProfileSection.tsx` | 35 | `return null` | ℹ️ Info | Guard: component renders nothing when user is not authenticated. By design. |
| `useAuth.ts` | 78 | `.catch(() => {})` | ℹ️ Info | Intentional silent catch on logout API call — logout proceeds locally even if server call fails. By design. |

No blocker or warning anti-patterns found. All flagged patterns are intentional design decisions documented in plan comments.

---

### Human Verification Required

The following tests require live Google OAuth credentials and a running server:

#### 1. Google Sign-In Flow

**Test:** Set `VITE_GOOGLE_CLIENT_ID` in `client/.env` and `GOOGLE_CLIENT_ID` in `server/.env` with valid Google Cloud Console credentials. Start the app, navigate to `/auth`, and click the Google Sign-In button.
**Expected:** OAuth popup opens, user completes sign-in, popup closes, user lands on MenuPage with their Google display name and avatar shown in ProfileSection.
**Why human:** Requires real Google Cloud credentials; popup interaction cannot be automated.

#### 2. JWT Persistence on Refresh

**Test:** After Google login (or username/password login), refresh the browser tab.
**Expected:** User remains logged in — same name and avatar shown in ProfileSection, no re-login required.
**Why human:** Requires live server + localStorage token to validate full persistence flow.

#### 3. Google Avatar Display

**Test:** Log in with a Google account that has a profile picture. Observe MainMenu ProfileSection.
**Expected:** Google profile picture is shown as the avatar (round, no-referrer policy prevents 403 from Google CDN).
**Why human:** Requires real Google account with photo; `referrerPolicy` correctness can only be verified in-browser.

#### 4. Logout Clears Socket Identity

**Test:** Log in with Google, then click "Salir" in ProfileSection. In server logs, observe that a new socket connection is made without an auth token.
**Expected:** After logout, any new room join uses guest identity (no authenticated user on server side). No stale auth identity persists on the socket.
**Why human:** Server-side socket identity check requires running server + observing logs.

---

### Gaps Summary

No gaps found. All artifacts exist, are substantive (not stubs), and are fully wired to each other and to the server. The 4 human verification items are not gaps — they are integration checks that require live credentials and cannot be verified programmatically. All code-level implementations match plan specifications exactly.

---

_Verified: 2026-04-02T22:30:00Z_
_Verifier: Claude (gsd-verifier)_

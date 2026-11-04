# SuperAdmin Architecture

## Structure

```text
app/                     Expo Router routes only (thin; no logic)
  _layout.tsx            SafeAreaProvider > AuthProvider > SessionGate > Stack
  index.tsx              Redirects to login or the role's home
  +not-found.tsx         404 (Expo Router's special route name)
  (auth)/                login, forgot-password, reset-password
  (admin)/               PLATFORM_ADMIN portal (9 modules)
  (support)/             PLATFORM_SUPPORT portal (dashboard, customers, support)
src/
  core/api/              axios client, endpoints, error-message helper
  core/auth/             AuthContext, SessionGate, auth.service, token-storage
  core/permissions/      PlatformRole type, role guard, homeForRole
  core/config/           env (EXPO_PUBLIC_API_URL), role navigation menus
  features/<module>/     screens/, api/, types.ts (add components/ only when needed)
  shared/components/     AppButton, AppModal, Loading/Error states, WorkspaceLayout, ...
  theme/tokens.ts        colors, spacing, radii, typography, breakpoints
```

## Conventions

- **New screen**: create it in `src/features/<module>/screens/`, then add a one-line route:
  `export { default } from '../../../src/features/<module>/screens/XScreen';`
- **API calls** live in `features/<module>/api/*.api.ts`, use `apiClient` and `endpoints` from `core/api`. Add the path to `endpoints.ts`.
- **Shared UI** goes in `shared/components/`; take colors/spacing from `theme/tokens.ts`. No hardcoded values.
- Do not create empty folders or placeholder files; add a file when it has content.

## Authentication

`POST /platform/auth/login` returns `{ accessToken, tokenType: 'Bearer', user }`. The token is stored in
`expo-secure-store` (native) or `sessionStorage` (web), and `GET /platform/auth/me` restores the session on launch.
A 401 on an authenticated request clears the session via `onSessionExpired`. Logout calls `POST /platform/auth/logout`.
`SessionGate` shows loading / retry while the session is restored. Only platform roles are accepted.

## Role-based navigation

`WorkspaceLayout` wraps each portal: no user redirects to login; a user whose role does not match the portal is
redirected to their own home. Menu items come from `core/config/navigation.ts` (sidebar on wide screens, scrollable
tabs on narrow).

## Backend status per module

| Module | Frontend | Backend endpoints (already exist) |
|---|---|---|
| Auth | Real (login, session restore, logout) | `platform/auth/*` |
| Customers | Real (list, filter, details, status change) | `platform/customers` |
| Dashboard | Welcome card only | `platform/dashboard/summary` |
| Billing | Route placeholder | `platform/billing/{summary,invoices,payments}` |
| Support | Route placeholder | `platform/support/*` |
| Audit | Route placeholder | `platform/audit/*` |
| Settings | Route placeholder | `platform/settings/{general,history}` |
| Marketing / Offers | Route placeholder | `platform/marketing/offers/*` (no separate prospects API) |
| Plans | Route placeholder | **No platform plans endpoint** (backend work needed) |
| Forgot / reset password | Route placeholder | **No platform endpoint** (backend work needed) |

Placeholder routes render `DevelopmentNotice`; they keep navigation working but are not implemented features.

## Cleanup log

- Removed 87 zero-byte placeholder files (empty `src/ui/*`, `src/mocks/*`, unimplemented feature components/api/schemas,
  empty tests and docs, empty providers/permissions stubs). None were imported anywhere. Recreate when implementing.
- Removed `app/not-found.tsx` (duplicate of `app/+not-found.tsx`, which Expo Router actually uses).
- Removed unused dependencies: `react-hook-form`, `@hookform/resolvers`, `zod`, `@tanstack/react-query`, `expo-device`, `expo-image`.
- Removed the `reset-project` script (its script file does not exist); added `typecheck`.

## Legacy / known gaps

- No WebView or bundled-HTML code exists in this app; nothing legacy to isolate.
- No test runner or test files are configured; add one (e.g. jest-expo) with the first tests.
- `eas.json` is empty (invalid) and `app.json` still uses the `superadmin-temp` name/slug/scheme. Both need real values
  before a build; left unchanged because they affect app identity.

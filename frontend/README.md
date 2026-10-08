# Frontend Developer 1 handoff

This frontend implements login and session restoration, the business dashboard, company and branch selection, shared navigation, and CRM screens for leads, contacts, customers, deals and quotes. Live accounts use real HTTP requests; the current backend only implements health checks, so live workflows require the contract below before end-to-end use. The sign-in page provides Business & staff and Employee portals with empty credential fields and API authentication.

## APK login reference

The sign-in page keeps the APK's Business & staff and Employee tabs. Demo selectors, sample credentials and preview messages have been removed. The centered form adapts to web, Android and iOS, including small portrait and landscape screens, scrolling, safe-area keyboard avoidance, email-to-password keyboard navigation and an accessible password eye toggle.

Employees open the My work dashboard with attendance check-in/out, assigned task summaries, leave balances, latest published pay and profile details. See [EMPLOYEE_API.md](EMPLOYEE_API.md) for the employee API contract and remaining self-service workflows. The signup/trial workflows shown in the APK are outside the current frontend scope and are not implemented here.

Live login sends `portal: "staff"` or `portal: "employee"` alongside credentials. The backend must verify the selected portal and return appropriate memberships. The frontend filters the returned memberships, guards business and employee routes separately, and persists the selected live portal for session restoration. Workspace scope comes from server memberships after login.

## Run and verify

```powershell
cd frontend
npm ci
Copy-Item .env.example .env
# Set EXPO_PUBLIC_API_URL to your backend /api/v1 URL.
npm start
npm run typecheck
npm test
npm run export:web
npm run test:e2e
```

Use your computer's LAN address for a physical phone. Android emulator users can use `http://10.0.2.2:4000/api/v1`. The backend must allow the frontend's origin for web requests, including Authorization and the three scope headers. Use HTTPS in production.

Native sessions store only the access token in [Expo SecureStore](https://docs.expo.dev/versions/latest/sdk/securestore/). Web sessions store it in sessionStorage for the browser tab. Routing follows [Expo Router's authentication guidance](https://docs.expo.dev/router/advanced/authentication/). Restoration calls `/auth/me` before mounting business screens. Expired business requests return the user to login; offline restoration offers retry or sign out. Logout clears local credentials and query data even when the server is unavailable. This contract uses reauthentication on expiration and does not assume a refresh-token endpoint.

## Backend contract

All paths below are relative to `/api/v1`. Responses are direct JSON objects, without an additional `data` envelope. Runtime response validation lives in `src/types/index.ts`; endpoint adapters live in `src/services/business.ts`.

| Method | Path | Request and response |
| --- | --- | --- |
| POST | `/auth/login` | `{ email, password, portal: "staff" or "employee" }` → `{ accessToken, session }` |
| GET | `/auth/me` | Bearer token → session |
| POST | `/auth/logout` | Bearer token → successful response; invalidate the server session |
| GET | `/dashboard` | Scoped business dashboard |
| GET | `/crm/{kind}` | Scoped list; query `search`, `status`, `cursor`, `limit=25` → `{ items, nextCursor: string or null }` |
| GET | `/crm/{kind}/{id}` | Scoped CRM record |
| POST | `/crm/{kind}` | Record input → saved CRM record |
| PATCH | `/crm/{kind}/{id}` | Record input → saved CRM record |
| DELETE | `/crm/{kind}/{id}` | Successful response, normally 204 |

`kind` is one of `leads`, `contacts`, `customers`, `deals`, `quotes`. A session has this structure:

```json
{
  "user": { "id": "user-id", "name": "Alex", "email": "alex@example.com" },
  "memberships": [{
    "id": "membership-id", "tenantId": "tenant-id", "companyId": "company-id",
    "companyName": "Example Company", "role": "SALES",
    "permissions": ["dashboard:read", "leads:read", "leads:create", "leads:update", "leads:delete"],
    "branches": [{ "id": "branch-id", "name": "Main branch" }]
  }]
}
```

Permissions follow `{kind}:read`, `{kind}:create`, `{kind}:update`, `{kind}:delete`, plus `dashboard:read`. Screens for create and edit require read permission too. Linking a contact or customer requires read permission on that module. Memberships must contain only branches the server authorizes. No branch assignment produces an explicit access state.

Every business request carries `Authorization: Bearer ...`, `X-Tenant-Id`, `X-Company-Id`, and `X-Branch-Id`. These headers express the selected workspace; the backend must validate the membership, company/tenant/branch relationship, action permission, target record scope and linked record scope. Client role visibility is never security. Changing branch cancels queries, clears cached business data and resets screens; switching and logout are disabled while a write is pending.

CRM records require `id`, `name`, `status`, `createdAt` (ISO timestamp). The optional fields used by each module are:

| Module | Fields | Statuses |
| --- | --- | --- |
| Leads | `email`, `phone`, `organization`, `source`, `notes` | NEW, CONTACTED, QUALIFIED, CONVERTED, LOST |
| Contacts | `email`, `phone`, `organization`, `notes` | ACTIVE, INACTIVE |
| Customers | `email`, `phone`, `organization`, `contactId`, `notes` | ACTIVE, INACTIVE |
| Deals | `customerId`, `amount`, `currency`, `expectedCloseDate`, `notes` | OPEN, QUALIFIED, PROPOSAL, NEGOTIATION, WON, LOST |
| Quotes | `customerId`, `currency`, `validUntil`, `items`, `taxRate`, `total`, `notes` | DRAFT, SENT, ACCEPTED, REJECTED, EXPIRED |

Currency defaults to INR in new forms. Supported codes are INR, USD, EUR, GBP, AED, AUD, CAD, SGD, CHF, CNY, NZD and SAR; lowercase input is normalized to uppercase. This list is application configuration in `src/utils/validation.ts`, not a list of every currency. Dates in requests are `YYYY-MM-DD` or null when cleared. Optional relationship IDs are null when cleared. Empty optional text is sent as an empty string so edits can remove previous values. Amounts and item prices are JSON numbers, with up to two decimals. If Prisma returns Decimal values as strings, normalize them in the backend response serializer or adapt the frontend schema deliberately.

Quote input items are `{ description, quantity, unitPrice }`; quantity is positive, price is non-negative and `taxRate` is 0–100. A customer and at least one item are required. The frontend displays an estimate only and never sends `total`. Invalid numeric fields suppress the estimate. The backend must calculate monetary amounts using decimal arithmetic, validate status transitions, and return the authoritative `total`. Persist quote currency and amounts independently of employee salary/payroll modules.

## Input validation

Rules are shared by the UI and request services. Form errors appear beside the affected field after blur or submission and update as the user corrects the value. Invalid submissions never send a save or login request. Character limits also apply when typing or pasting. Optional empty text is allowed; names and passwords containing only whitespace are not.

| Input | Validation |
| --- | --- |
| Login email | Required, email format, at most 254 characters |
| Login password | Required, not whitespace-only, at most 1024 characters; preserved verbatim, with no registration-strength rule |
| Record name or quote title | Required, at most 160 characters |
| CRM email | Optional, email format when supplied, at most 254 characters |
| Phone | Optional, 7–15 digits, optional leading +, spaces/dots/hyphens and balanced parentheses; at most 32 characters |
| Organization | Optional, at most 160 characters |
| Lead source | Optional, at most 100 characters |
| Notes | Optional, at most 4000 characters; newlines and tabs allowed |
| Status | Must belong to that module's allowed statuses |
| Linked contact/customer | Optional except quote customer; nonblank identifier, at most 128 characters, no whitespace or control characters; server verifies scope and existence |
| Currency | Must match the supported application codes |
| Deal amount and unit price | Non-negative decimal, up to two decimals, at most 1 trillion |
| Expected close or valid-until date | Optional, real calendar date in YYYY-MM-DD format, including leap-year checks |
| Quote description | Required for each item, at most 500 characters |
| Quote quantity | Greater than zero, up to three decimals, at most 1 million |
| Quote tax | 0–100 inclusive, up to two decimals |
| Quote items and estimate | 1–100 items, each checked individually; total at most 1 trillion |
| List/picker search | Optional, at most 160 characters; trimmed before querying |

Single-line fields reject control characters; notes allow only normal text plus tabs and line breaks. Numeric input rejects negative signs, exponent/hexadecimal notation, non-finite values and excessive precision. The frontend accepts past dates for historical records; additional business rules such as future-only quotes belong in the agreed backend contract. Branch selection is restricted to branches in the current server-provided membership. The backend must independently validate every field and permission.

Dashboard response:

```json
{
  "leads": 12, "customers": 8, "openDeals": 4, "pipelineValue": 250000,
  "quotesAwaitingResponse": 3, "currency": "INR",
  "recentActivity": [{ "id": "activity-id", "title": "New lead", "description": "Alex added a lead", "createdAt": "2026-10-07T08:00:00Z" }]
}
```

The backend must define one currency for dashboard aggregation or convert amounts explicitly; never add mixed currencies. Dashboard totals and activity must respect module permissions as well as scope.

## Acceptance checks

Automated checks cover form validation, date and amount rejection, quote calculations, runtime response shapes, bearer and scope headers, and 401 versus 403 handling. The web export verifies the router and bundle. Browser tests use intercepted API fixtures to check login, lead CRUD, branch isolation in the UI, quote creation, denied create routes, and phone layouts. They do not validate backend authorization. On Windows they use installed Edge; elsewhere run `npx playwright install chromium` first. Set `PLAYWRIGHT_CHANNEL` to use another installed browser. Export with a configured API base URL ending in `/api/v1` before running browser tests.

With the backend connected, verify valid/invalid login; session restoration; expired tokens; sign out offline; no memberships; different companies and branches; direct links to inaccessible modules; record CRUD; relation search; pagination; filters; quote calculations; server errors; and denied cross-branch record IDs. Verify layouts and keyboards on Android and iOS devices before release.

Frontend Developer 2 owns employee, tasks, attendance/leave, payroll and payslip screens. This change adds none of those modules or customer invoice screens, which are outside the supplied Frontend Developer 1 list. Backend integrations and device acceptance remain dependencies for release.

The installed Expo 57 dependency tree reports 28 npm audit findings (18 high, 10 moderate). The suggested automated fixes change major framework versions, including downgrades. Review the transitive advisories and supported framework upgrades before production release; no forced framework change is applied here.

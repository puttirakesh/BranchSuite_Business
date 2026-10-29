# BranchSuite Business - Simple Development Setup

Business app only.

## Stack
- Frontend: React Native + TypeScript + Expo
- Backend: NestJS + TypeScript
- Database: PostgreSQL + Prisma

## Main folders
- `frontend/` - Android/iOS mobile app
- `backend/` - REST API and database access
- `docs/` - project notes and developer split

## Start frontend
```bash
cd frontend
npm install
npx expo start
```

## Start backend
```bash
cd backend
npm install
cp .env.example .env
npx prisma generate
npx prisma migrate dev --name init
npm run prisma:seed
npm run start:dev
```

## App logo

The approved original is `frontend/assets/logo.png`. Mobile launcher icons, the web favicon,
Apple touch icon, and web installation icons are generated from it. The website displays the
same artwork on authentication screens and in workspace navigation. Native Android/iOS apps
show the logo only as their home-screen icon and on the launch splash screen, configured by
the `expo-splash-screen` plugin. `BrandLogo.native.tsx` suppresses in-screen logos on native;
the authentication brand header is also web-only.

After replacing the original, regenerate the derived files and commit them:

```powershell
cd frontend
npm.cmd run branding:generate
```

The generator crops the surrounding backdrop using the current artwork's proportions, keeps
the original unchanged, and pads adaptive/maskable icons for launcher masks. Preview the
generated files when replacing the logo with a different composition.

Mobile launcher and splash changes require a new Android/iOS build and installation; they do not update
through a JavaScript-only update. For the website, run `npm.cmd run export:web` and deploy
`frontend/dist`. The web manifest and Apple touch icon support home-screen branding on the
deployed HTTPS website. Store listing artwork must also be updated in the relevant store console.

Verify the native splash on an installed release or preview build. Expo Go and development
builds do not reproduce the complete standalone launch-screen appearance.

## Verification

Frontend checks:
```powershell
cd frontend
npm.cmd test
npm.cmd run typecheck
npx.cmd expo export --platform all
```

Backend checks:
```powershell
cd backend
npm.cmd run build
npm.cmd test
npm.cmd run test:integration
```

The integration suite requires the configured local PostgreSQL database, current migrations, and RBAC configuration. It creates isolated test tenants and removes their records afterward. It covers CRM, role and branch access, tasks, attendance, leave, advances, payroll approval/publication/payment, audit records, and subscription reads. Payroll preparation and approval use separate users.

To check the exported web screens in a browser, first run `npm.cmd run export:web` in `frontend`, then run the following in `backend`:
```powershell
$env:RUN_APP_INTEGRATION = '1'
$env:RUN_BROWSER_AUDIT = '1'
$env:BROWSER_CHANNEL = 'msedge'
node --test test/app.integration.test.cjs
```

Use an installed Playwright browser instead of `msedge` on other systems. The browser suite serves the local export, routes API requests to the actual Nest application and database, checks phone/tablet/desktop layouts and staff roles, and creates a lead through the form. Preview screenshots are written to `frontend/dist/audit`.

Set `$env:BROWSER_ROLE_AUDIT = '1'` for the extended browser audit of all eight roles. It includes Owner, Admin, Company Manager, Branch Manager, HR, Payroll, Sales and Employee navigation, personal tasks, permitted modules and company/branch isolation. Staff layouts are checked at phone, tablet and desktop widths; owner and employee checks also include 320px and 1024px. Screenshots are written to the same audit folder. Remove the variable afterward with `Remove-Item Env:BROWSER_ROLE_AUDIT`.

For the additional responsive audit, set `$env:BROWSER_RESPONSIVE_AUDIT = '1'` before running that command. This checks 320×568, 568×320, 844×390, 1024×600 and 1920×1080 viewports, including landscape screenshots and section-title visibility. Remove the variable afterward with `Remove-Item Env:BROWSER_RESPONSIVE_AUDIT` to return to the normal viewport matrix.

Android allows portrait and landscape layouts. Rebuild an installed app after changing `app.json` orientation settings; a JavaScript reload cannot update a built app's orientation configuration. On a physical device, also check rotation, enlarged system text, keyboard opening/closing, safe areas and PDF sharing. Browser viewport checks and Android bundle compilation do not replace these device checks.

## Role panels

Staff panels use the existing admin design and show modules and actions permitted by the signed-in roles and assigned company/branch access. Employees use their separate personal panel.

Every staff role has **My tasks** in More and web navigation for its own assignments, status updates and comments. This does not grant HR or Payroll task creation, reassignment, cancellation or other employees' tasks. Cancelled tasks can only be reopened by a task manager. Personal task access follows current active company and branch assignments.

CRM and task assignment use a scoped directory containing only user IDs, names and branch details. Sales does not request HR employee records. Active staff created through Roles & access can receive assignments without requiring an employee payroll profile.

Staff profile updates protect the owner's account and prevent administrators editing peer administrators; an owner can manage administrator profiles. Login email changes and company/branch access changes revoke existing sessions. All access-grant, replacement and revocation endpoints enforce the acting administrator's scope and reject self-assignment. Payroll can read scoped attendance records but cannot mark or correct team attendance.

| Role | Main responsibilities |
| --- | --- |
| Business Owner / Business Admin | Business administration, people, CRM, payroll preparation and publication |
| Company Manager / Branch Manager | Assigned operations, CRM and tasks, team reviews, independent payroll approval or return for changes |
| HR Manager | Scoped employee onboarding and editing, attendance, leave and request approvals |
| Payroll Officer | Payroll preparation, salary inputs, publication, manual payment and advance payout records |
| Sales Executive | Scoped CRM and tasks, sales pipeline reports |
| Employee | Own attendance, leave, assigned tasks, published payslips, advances and documents |

Run `npm run prisma:seed` in the backend after deployment to provision the role/permission definitions, including `COMPANY_MANAGER`. The seed does not create demo accounts. Existing `BRANCH_MANAGER` accounts retain their assignments; assign Company Manager explicitly through Roles & access where appropriate. Sign in again after role changes. Managers approve payroll; preparers cannot approve their own runs. Returned payroll requires recalculation and a new review, with the return reason retained in the audit history and shown to the preparer.

After exporting the web frontend, run `npm run test:browser` in `frontend` to check the role panels, payroll workflow, reporting manager picker and responsive screens. Browser files run sequentially to avoid competing browser instances on development machines. Use `npm run test:e2e` to export and run these checks together. The browser role tests cover phone and desktop widths; device installation and native OS dialogs require separate physical-device verification.

## Features requiring additional services

Password login uses shared PostgreSQL counters: 10 attempts per normalized email and 100 per client IP in a fixed 15-minute window. All attempts count, including successful logins and unknown accounts. Requests over either limit return HTTP 429 before password verification. Blocked requests do not extend the window, and database failures do not bypass throttling. This combines account and source controls as recommended by the [OWASP authentication guidance](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html#login-throttling).

Before deploying this version, run `npx prisma migrate deploy` from `backend` to create `LoginThrottle`. When behind a reverse proxy, set `TRUSTED_PROXY_CIDRS` to a comma-separated list of the actual proxy addresses or CIDRs. Keep the backend reachable only through those proxies. The default trusts no forwarded headers; without proxy configuration all proxied users share the proxy IP budget. Do not trust arbitrary client-supplied forwarding headers.

Schedule `DELETE FROM "LoginThrottle" WHERE "expiresAt" < CURRENT_TIMESTAMP` periodically (for example hourly) to remove expired counters. Keys store SHA-256 digests rather than raw emails or IPs. To validate the SQL without applying migrations or changing application data, set `RUN_LOGIN_THROTTLE_DB=1` and run `node -r ts-node/register/transpile-only --test test/login-throttle.test.cjs` in `backend`; the database check uses a temporary table.

Leave requests with a selected reporting manager can only be approved or rejected by that person, who must still hold an eligible manager role and access to the request's company and branch. Owners and administrators cannot bypass the selection. The picker offers only roles eligible to review leave. Requests without a selected manager retain the existing scoped manager review rules.

Online subscription charging/renewals and real bank transfers require external providers. Recording a payment or advance payout confirms a manual business action and does not transfer funds. Attendance payroll, company calendars, calendar-day salary proration, advance recovery, company payslip settings, employee documents, support tickets and invoice records are stored through the backend. Email delivery and invitation acceptance still require their respective configured services/workflows.

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

## Role panels

Staff panels use the existing admin design and show modules and actions permitted by the signed-in roles and assigned company/branch access. Employees use their separate personal panel.

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

Online subscription charging/renewals and real bank transfers require external providers. Recording a payment or advance payout confirms a manual business action and does not transfer funds. Attendance payroll, company calendars, calendar-day salary proration, advance recovery, company payslip settings, employee documents, support tickets and invoice records are stored through the backend. Email delivery and invitation acceptance still require their respective configured services/workflows.

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

## Features requiring additional services

Online subscription payments and renewals, invoice history, support tickets, official employment documents, and invitation acceptance are not connected. The app labels these limitations explicitly. Subscription plan/status reads and published payroll payslips are connected. Attendance-based payroll calculation remains unavailable; fixed payroll is supported.

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

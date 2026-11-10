# BranchSuite SuperAdmin

Independent Expo SDK 58 / React Native / TypeScript application for PLATFORM_ADMIN and PLATFORM_SUPPORT. Backend contracts are under `/api/v1/platform/*`; API URL must include `/api/v1`.

From PowerShell:

```powershell
cd C:\Users\KK\Documents\BranchSuite_Business\superadmin
npm.cmd ci
# Local preview, without reading or changing any .env file:
$env:EXPO_NO_DOTENV='1'
$env:EXPO_PUBLIC_API_URL=''
$env:EXPO_PUBLIC_PREVIEW_DATA='true'
npm.cmd run web
# Or: npm.cmd run android
```

Preview credentials: `platform@demo.example` or `support@demo.example`, password `Demo123`. These work only against isolated preview fixtures. Disable preview for production builds.

To use the backend in the same terminal, set `EXPO_PUBLIC_PREVIEW_DATA=false` and `EXPO_PUBLIC_API_URL=http://localhost:4000/api/v1` (use the host LAN address on a phone). Never put credentials in EXPO_PUBLIC variables.

```powershell
npm.cmd run typecheck
npm.cmd test
npx.cmd expo install --check
npx.cmd expo-doctor
npm.cmd run export:web
```

See [implementation summary](docs/IMPLEMENTATION_SUMMARY.md), [screen checklist](docs/SCREEN_COMPLETION_CHECKLIST.md), [architecture](docs/ARCHITECTURE.md), [calendar guide](docs/CALENDAR_COMPONENT_GUIDE.md), and [backend report](docs/BACKEND_ENHANCEMENT_REPORT.md). Some UI workflows remain preview-only until the backend adds their contracts; no simulated payments are presented as real.

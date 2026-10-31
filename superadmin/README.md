# BranchSuite SuperAdmin

Expo Router + React Native + TypeScript app for platform staff (`PLATFORM_ADMIN`, `PLATFORM_SUPPORT`). It talks to the shared NestJS backend under `/api/v1/platform/*`.

```powershell
npm install
copy .env.example .env     # set EXPO_PUBLIC_API_URL
npm run web | npm run android
npm run typecheck
npx expo-doctor
```

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for structure and conventions.

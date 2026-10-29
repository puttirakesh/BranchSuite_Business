# BranchSuite SuperAdmin

The supplied `superadmin.zip` Expo Router structure is preserved. The interface and local business rules come from `BranchSuite_Admin1_v2.3.apk`, including its purple admin theme, platform owner and customer support roles, customers, subscriptions, plans, invoices, support conversations, prospects, offers, campaigns, settings and audit history.

This project uses Expo SDK 58 with matching React Native and native-module versions, for Expo Go that supports SDK 58. An older cached SDK 57 session must be closed before scanning the current server's QR code. Dependency versions follow the [Expo SDK upgrade guide](https://docs.expo.dev/workflow/upgrading-expo-sdk-walkthrough/).

Run from the project directory:

```powershell
cd C:\Users\user\Documents\superadmin\superadmin
npm install
npm start
```

Open Expo Go on the Android phone and choose **Scan QR code**. Scan the QR printed in the computer's terminal. Keep the computer, terminal and phone connected to the internet. Close the previous SDK 57 project in Expo Go before scanning. `npm start` and `npm run android` rebuild the bundled APK assets and start the approved ngrok tunnel, which works without an Expo account login. The temporary tunnel URL exposes the development server and bundled demo app to anyone who knows it; stop the server with Ctrl+C when finished.

For web, run `npm run web` in the project directory, or press **w** in the running Expo terminal. To rebuild assets and start with a clean Metro cache, run `npm run start:clean`. To use only local Wi-Fi, run `npm run start:lan` and ensure the computer and phone share the same Wi-Fi; scan its LAN QR code instead of using `localhost` or `127.0.0.1` on the phone.

Sign in with `platform@demo.example` or `support@demo.example`, password `Demo123`. Sample account buttons are also available. Support accounts can access customer and support screens; owner-only configuration stays restricted by the original model.

The APK is itself an offline HTML application. The admin route files select its original screens and editors inside one persistent WebView on Android/iOS and iframe on web. The interface uses the APK's original markup, styles, icons, sidebar and mobile navigation. Responsive additions preserve the original design while handling narrow screens, landscape, safe areas and scrollable dialogs. Changes persist through AsyncStorage. Device exports use the system sharing sheet; web exports download directly.

All original ZIP directories and filenames are retained, including the restored `src` and `tests` trees. Feature screens live under `src/features`; the persistent host lives in `src/core/providers/AppProviders.tsx`. Shared components, types, schemas, local data readers, permissions, hooks, theme and fixtures fill the original source structure. Readable APK files live in `assets`. `assets/branchsuite-document.ts` is generated, so after changing an HTML application asset run:

```sh
npm run build:reference
npm run typecheck
npm test
npm run export:web
```

`npm run test:browser` checks the static export at `.expo/web-export` with Playwright. Generate that export with `npx expo export --platform web --output-dir .expo/web-export`. The test runner uses installed Edge on Windows, or the browser path in `PLAYWRIGHT_BROWSER`. It verifies both roles, form validation, saved edits, PDF download, deep links and 14 APK screens at 320, 390, 768 and 1440 pixels. Screenshots are saved under `.expo`. Tests use an isolated browser profile and local sample records.

The original responsive interface includes phone bottom navigation, desktop sidebars, tablet grids, safe areas, touch controls and keyboard focus. Orientation is unlocked. Subscription edits, offers, campaigns, prospect follow-ups, settings and support replies use the original APK forms and business rules. The existing `/plans/create` route also supports adding a plan using the APK editor's styling. Billing includes PDF export and simulated payment results. Lists and audit history update from the saved workspace.

This is a local demo, matching the APK. No backend, real authentication, payment gateway or outgoing email is configured. Recovery pages explain the available sample sign-in instead of pretending to send reset emails. Native WebView/AsyncStorage/sharing dependencies require an Expo development build when unavailable in the installed Expo Go version. The app contains its own scripts and PDF library and does not fetch application code from the network.

# Data and host boundary

The APK has no remote API. Its database is seeded by `DemoData`, upgraded by the supplied models, and stored under `branchsuite-admin-demo`; drafts use `branchsuite-admin-drafts`.

The Expo host persists those strings under AsyncStorage key `branchsuite-expo-storage-v1`. Save operations are queued to preserve ordering. A storage failure produces a visible notification. Account access and plan/subscription validation remain in the APK models. These checks implement a demo, not a server security boundary.

Host messages use channel `branchsuite-host-v1`: `navigate` and `back` enter the embedded app; `ready`, `route`, `storage`, `back-result` and `export` leave it. Web messages are accepted only from the embedded frame and the current origin. A restrictive document CSP blocks network connections and external scripts. Native navigation is restricted to the local document.

For production, implement server authentication and password recovery, tenant authorization, persistent API data, invoice/payment integration, and notification delivery. Do not expose demo credentials as production credentials.

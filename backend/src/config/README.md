# Config

Environment and application configuration.

## Local development and OTP delivery

Run `npm.cmd run start:dev` from `backend` and `npx.cmd expo start --clear` from
`frontend`. The API listens on all interfaces at port 4000, under `/api/v1`.

For a physical phone on the same Wi-Fi, set `EXPO_PUBLIC_API_URL` in
`frontend/.env` to `http://<computer-LAN-IP>:4000/api/v1`. The current machine
uses `192.168.1.13`. For web on the same computer, `http://localhost:4000/api/v1`
also works; Android Emulator uses `http://10.0.2.2:4000/api/v1`.
Restart Expo after changing the environment. Browser origins must appear in
backend `CORS_ORIGIN`; the current localhost and LAN origins on port 8081 are configured.

The backend `.env` is configured for local PostgreSQL on `localhost:5432`,
database `branchsuite_business`. The previous hosted settings are preserved in
ignored `.env.hosted.backup`; `.env.local.backup` contains the original local settings.
`DATABASE_URL` and `DIRECT_URL` both point to the local database. The current
Prisma schema reads `DATABASE_URL`. Encode special characters in database
passwords when constructing URLs (for example, `@` becomes `%40`).

After changing a database URL, restart the backend so Prisma connects to the
selected database. Apply pending migrations with `npx.cmd prisma migrate deploy`
and configure roles with `npm.cmd run prisma:seed`. Local and hosted accounts
are independent: use an account in the selected database or create one through signup.
A login HTTP 401 means the API was reached but rejected the credentials, account
status, portal selection, or business access; a connection failure has no HTTP response.

Email OTP delivery uses existing `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`,
`SMTP_PASS`, and optional `SMTP_FROM`. No SMS provider is needed. Keep SMTP
credentials on the backend only.

Signup verifies email only. The ten-digit mobile number is stored as unverified
contact information; it is not an account identifier or a recovery method.
Request a code through `POST /auth/signup/otp` with `{ email }`, then verify it
through `POST /auth/verify-otp` with `{ challengeId, otp }`. Final `/auth/signup`
requires `emailChallengeId` and `emailOtp` alongside the registration fields.
The verified email must match the form. The account is created only when the
verified email challenge is consumed in the signup transaction.

Password recovery starts with `POST /auth/forgot-password` using `{ email }`.
Verify the code before calling `/auth/reset-password` with
`{ challengeId, otp, newPassword, confirmPassword }`. Challenge IDs are internal
correlation IDs, not credentials; no reset tokens or links are emailed.
Codes remain in component memory and are never placed in URLs or local storage.

OTPs expire after ten minutes, allow five comparisons, and have a sixty-second
resend cooldown per email and purpose. Codes use keyed hashes in PostgreSQL;
resending replaces the previous challenge. A successful reset stores a bcrypt
password hash, increments the session version, and invalidates other reset challenges.
Previously issued phone challenges cannot be verified or used for password resets.

Validation: `npm.cmd test` in each project, backend `npm.cmd run build`, and
frontend `npm.cmd run typecheck`. Set `RUN_AUTH_OTP_DB=1` when running the backend
OTP tests to exercise signup, reset, and subsequent login in a real PostgreSQL
transaction that is rolled back after verification. Email delivery is mocked
in those tests; real delivery requires configured SMTP credentials.

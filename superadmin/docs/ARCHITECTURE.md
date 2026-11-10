# SuperAdmin architecture

The independently buildable Expo Router app uses `app/(auth)` for signed-out routes and `app/(admin)` for both platform roles. Individual routes enforce capabilities through RequireCapability; the shared WorkspaceLayout filters sidebar/bottom navigation. A separate support route group is unnecessary.

`src/core/api` owns HTTP, endpoint names, mapping helpers and typed errors. Feature `api/` services map the NestJS contracts into domain types. `src/core/data/source.ts` selects API, explicitly enabled preview, or unconfigured mode. API errors never fall back to preview. Fixture access is guarded outside preview mode, and preview writes are session-only.

`src/core/auth` restores/validates sessions, clears cached data on account changes and 401s, and stores tokens in SecureStore on native or sessionStorage on web. The backend remains the authorization authority. Current customer endpoints are admin-only; support directory access is explained rather than attempted.

Feature screens own forms and view state; TanStack Query hooks in `shared/hooks/queries.ts` own fetching and invalidation. React Hook Form and Zod validate mutation forms. DatePickerField and FormDate replace manual date entry. Shared UI consumes `theme/tokens.ts` and the adapted Business module accents. No application code imports another project.

Lists use FlatList virtualization and explicit page controls. Customer sorting and overdue invoice filtering state their page scope. Dialogs use native Modal and scrollable Sheet content, with web focus management.

Use SCREEN_COMPLETION_CHECKLIST.md for the 21-route inventory, SHARED_DESIGN_SYSTEM.md for visual sources, CALENDAR_COMPONENT_GUIDE.md for date semantics, BACKEND_ENHANCEMENT_REPORT.md for verified contracts, and IMPLEMENTATION_SUMMARY.md for commands, checks and limitations. This document supersedes the old placeholder inventory.

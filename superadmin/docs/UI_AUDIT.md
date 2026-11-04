# SuperAdmin UI audit

Review date: 04 Nov 2026. Branch: `dev/rakhi`. Scope: SuperAdmin implementation; Business frontend and backend reviewed read-only.

## Initial inventory and plan

The app has 21 feature routes: 3 authentication routes and 18 workspace routes (including plan/offer create and detail deep links, and More). One shared dashboard adapts to two roles; no separate support route group is necessary. Root redirects and the not-found screen are infrastructure routes.

Existing workflows are substantial: customer details and subscription sheet, plan editor, invoice details and CSV, ticket conversations and reply/status/priority editor, prospect follow-up, offers and campaign sheets, settings, audit, module search, account switching, confirmation dialogs and role gates. Preserve these rather than rebuilding them.

Initial issues:

- Purple APK-derived palette differs from Business blue/navy design. Most screens already consume shared tokens, but several hardcoded lavender surfaces remain.
- Eight manual date fields: renewal, trial end, prospect follow-up, offer expiry, two billing filters, two audit filters. No calendar component exists in SuperAdmin.
- Customer, billing, support, marketing and audit lists request at most 100 rows without pagination controls. Some filters run after pagination.
- Offers discard start dates and actual lifecycle status, and editing active offers conflicts with backend rules. Creating a disabled offer attempts the unsupported DRAFT -> PAUSED transition.
- Support role navigation permits customer views that the current backend restricts to admin. Dashboard eagerly fetches plans even for support.
- Backend audit search accepts an exact action, while the UI promises free text across person/detail. Audit detail endpoint exists but is not exposed in the UI.
- Settings UI omits support phone, announcement and portal preferences already supported by the backend.
- Preview fixtures are isolated behind a typed service dispatcher, but preview can be enabled in release builds. No provider silently falls back to preview after API errors.
- Missing backend operations are surfaced as integration errors rather than fake success. Recovery screens and several editors are UI-complete but cannot complete live transactions.
- Existing uncommitted `Blocks.tsx` changes must be preserved.

Implementation sequence: shared design and calendar primitives; migrate every date field and add range constraints; list/workflow and contract fixes; document backend gaps; TypeScript, tests, Expo validation, web/native bundling and browser checks where available.

See SCREEN_COMPLETION_CHECKLIST.md for the final route inventory and IMPLEMENTATION_SUMMARY.md for validation and limitations.
